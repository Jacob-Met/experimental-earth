import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDraft, summaryFigures, requestNemotronReview } from '../nemotron-review.js';

const figures = [
  { label: 'Water infiltrated', unit: 'L', existing: 500.25, proposed: 760.4 },
  { label: 'Maximum cell water depth', unit: 'mm', existing: 18.7, proposed: 11.2 },
];

test('a draft whose numbers all appear in the figures is verified', () => {
  const check = checkDraft('Infiltration rises from 500.25 L to 760.4 L. Peak depth falls to 11.2 mm.', figures);
  assert.equal(check.checked, 3);
  assert.equal(check.verified, true);
  assert.deepEqual(check.unmatched, []);
});

test('a number absent from the figures is flagged with its sentence', () => {
  const check = checkDraft('Infiltration rises to 900 L. Peak depth is 11.2 mm.', figures);
  assert.equal(check.verified, false);
  assert.equal(check.checked, 2);
  assert.equal(check.matched, 1);
  assert.equal(check.unmatched[0].token, '900');
  assert.equal(check.unmatched[0].sentence, 'Infiltration rises to 900 L.');
});

test('a difference the draft computed itself is not accepted', () => {
  const check = checkDraft('The gain is 260.15 L.', figures);
  assert.equal(check.verified, false);
  assert.equal(check.unmatched[0].token, '260.15');
});

test('rounding to the decimals a draft uses is accepted, and thousands separators are read', () => {
  const big = [{ label: 'Rain', unit: 'L', existing: 1234.5678, proposed: 1234.5678 }];
  assert.equal(checkDraft('About 1,234.6 L fell.', big).verified, true);
  assert.equal(checkDraft('About 1,235 L fell.', big).verified, true);
  assert.equal(checkDraft('About 1,234 L fell.', big).verified, false);
});

test('numbers written into a figure label count as shown', () => {
  const labelled = [{ label: 'Cells ever at or above 10 mm', unit: 'cells', existing: 46, proposed: 40 }];
  assert.equal(checkDraft('Only 10 mm was crossed by 46 cells.', labelled).verified, true);
  assert.equal(checkDraft('Depth reached 12 mm.', labelled).verified, false);
});

test('a draft with no numbers reports that nothing could be checked', () => {
  const check = checkDraft('The change lowers standing water.', figures);
  assert.equal(check.noFigures, true);
  assert.equal(check.verified, false);
});

test('summaryFigures sends rounded summary numbers only', () => {
  const results = {
    existing: { rainLiters: 1000.123, exitLiters: 300.555, absorbedLiters: 600.1, peakPondingLiters: 50, storedLiters: 99.9, cellsOver10Mm: 4, maxDepthMm: 18.456 },
    proposal: { rainLiters: 1000.123, exitLiters: 200, absorbedLiters: 780.2, peakPondingLiters: 30, storedLiters: 19.9, cellsOver10Mm: 2, maxDepthMm: 11.2 },
  };
  const out = summaryFigures(results, { rainMmHr: 40, stormMinutes: 30, durationMinutes: 90 });
  assert.equal(out.find(f => f.label === 'Water leaving modeled edges').existing, 300.56);
  assert.equal(out.find(f => f.label === 'Rain intensity').proposed, 40);
  assert.ok(out.every(f => Object.keys(f).sort().join() === 'existing,label,proposed,unit'));
});

test('requestNemotronReview posts only figures and returns checked text', async () => {
  let sent;
  const fetchImpl = async (url, init) => {
    sent = { url, body: JSON.parse(init.body) };
    return { ok: true, status: 200, json: async () => ({ model: 'm', text: 'Infiltration is 760.4 L.' }) };
  };
  const reply = await requestNemotronReview(figures, { fetchImpl });
  assert.equal(sent.url, '/api/nemotron-review');
  assert.deepEqual(Object.keys(sent.body), ['figures']);
  assert.equal(reply.status, 'ok');
  assert.equal(reply.check.verified, true);
});

test('server refusals and offline failures become readable errors', async () => {
  const noKey = await requestNemotronReview(figures, {
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ code: 'no_key', error: 'Set NEBIUS_API_KEY.' }) }),
  });
  assert.deepEqual([noKey.status, noKey.code, noKey.message], ['error', 'no_key', 'Set NEBIUS_API_KEY.']);
  const offline = await requestNemotronReview(figures, { fetchImpl: async () => { throw new TypeError('down'); } });
  assert.equal(offline.code, 'offline');
});

const numericFigures = (...values) => values.map(value => ({
  label: 'Value', unit: 'L', existing: value, proposed: value,
}));

test('isolated negative claims do not verify against only their positive magnitude', () => {
  for (const token of ['-1000', '−1000', '-.5', '−.5']) {
    const check = checkDraft(`Water is ${token} L.`, numericFigures(1000, 0.5, 5));
    assert.equal(check.verified, false, token);
    assert.equal(check.checked, 1, token);
    assert.equal(check.unmatched[0].token, token);
  }
});

test('signed and leading-decimal values compare at their actual magnitude', () => {
  for (const [token, value] of [['-5', -5], ['+5', 5], ['−5', -5],
    ['.5', 0.5], ['-.5', -0.5], ['−.5', -0.5], ['+.5', 0.5], ['5.', 5]]) {
    for (const sentence of [`Water is ${token}L.`, `Water (${token}) L.`]) {
      const check = checkDraft(sentence, numericFigures(value));
      assert.equal(check.verified, true, sentence);
      assert.equal(check.checked, 1, sentence);
    }
  }
  assert.equal(checkDraft('Water is .5 L.', numericFigures(5)).verified, false);
  assert.equal(checkDraft('Water is -1,000.5 L.', numericFigures(-1000.5)).verified, true);
});

test('range separators preserve positive and negative endpoints', () => {
  for (const text of ['1-5', '1 - 5', '1 -5', '1–5', '1—5']) {
    const check = checkDraft(`Water spans ${text} L.`, numericFigures(1, 5));
    assert.equal(check.verified, true, text);
    assert.equal(check.checked, 2, text);
  }
  for (const text of ['-5--2', '−5–−2', '-5 - -2']) {
    assert.equal(checkDraft(`Water spans ${text} L.`, numericFigures(-5, -2)).verified, true, text);
    assert.equal(checkDraft(`Water spans ${text} L.`, numericFigures(5, 2)).verified, false, text);
  }
});

test('label numbers use the same signed decimal interpretation', () => {
  const labelled = [{ label: 'At or below −.5 mm', unit: 'cells', existing: 46, proposed: 40 }];
  assert.equal(checkDraft('Below -.5 mm: 46 cells.', labelled).verified, true);
  assert.equal(checkDraft('Above .5 mm: 46 cells.', labelled).verified, false);
  const ranged = [{ label: 'Depth 1-5 mm', unit: 'cells', existing: 46, proposed: 40 }];
  assert.equal(checkDraft('Depth 1–5 mm: 46 cells.', ranged).verified, true);
});

test('a new line preserves a negative reading after a positive reading', () => {
  for (const newline of ['\n', '\r\n']) {
    const check = checkDraft(`Water readings:${newline}1000${newline}-1000 L`, numericFigures(1000));
    assert.equal(check.verified, false);
    assert.equal(check.checked, 2);
    assert.deepEqual(check.unmatched.map(row => row.token), ['-1000']);
  }
});
