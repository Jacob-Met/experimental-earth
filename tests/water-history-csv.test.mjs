import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { serializeWaterHistoryCsv } from '../water-history-csv.js';

// A separate character-by-character reader receives actual CSV text. It does
// not share the exporter's quoting implementation or parse by line splitting.
function parseCsv(csv) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < csv.length; ++i) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') { value += '"'; ++i; }
      else if (c === '"') quoted = false;
      else value += c;
    } else if (c === '"') { assert.equal(value, ''); quoted = true; }
    else if (c === ',') { row.push(value); value = ''; }
    else if (c === '\r' && csv[i + 1] === '\n') { row.push(value); rows.push(row); row = []; value = ''; ++i; }
    else value += c;
  }
  assert.equal(quoted, false); assert.deepEqual(row, []); assert.equal(value, ''); return rows;
}
const comparison = (minutes, a, b) => ({
  existing: { snapshots: minutes.map((minute, i) => ({ minute, storedLiters: a[i] })) },
  proposal: { snapshots: minutes.map((minute, i) => ({ minute, storedLiters: b[i] })) },
});
const projectText = title => JSON.stringify({ schema: 'experimental-earth-site/1', title, source: 'Native serializer control; application receives the validated complete original project.' }, null, 2);
const sha = text => createHash('sha256').update(text).digest('hex');

test('CSV keeps every original minute, value and signed difference through an independent reader', async () => {
  const minutes = [0, 2, 4, 5.5], a = [-0, Number.MIN_VALUE, 17210879999.99969, 0.1], b = [0, 0.3, 15621119999.999893, 0.3];
  const input = comparison(minutes, a, b), before = structuredClone(input), text = projectText('Original water');
  const rows = parseCsv(await serializeWaterHistoryCsv(input, text));
  assert.deepEqual(rows[0], ['project_title_json', 'project_input_digest', 'model_minute', 'existing_stored_litres', 'proposed_stored_litres', 'proposed_minus_existing_litres']);
  assert.equal(rows.length, 5);
  for (let i = 0; i < minutes.length; ++i) {
    assert.deepEqual(rows[i + 1].slice(0, 2), [JSON.stringify('Original water'), 'sha256:' + sha(text)]);
    for (const [j, expected] of [minutes[i], a[i], b[i], b[i] - a[i]].entries()) assert.ok(Object.is(Number(rows[i + 1][j + 2]), expected));
  }
  assert.deepEqual(input, before);
});

test('Quoted Unicode context is literal, round-trippable and never a formula prefix', async () => {
  const input = comparison([0], [0], [0]);
  for (const title of ['Courtyard, "east"\r\n雨 🌱', '=1+1', '+SUM(A1)', '-1+1', '@name', '\t=1+1', '\ud800']) {
    const text = projectText(title), csv = await serializeWaterHistoryCsv(input, text);
    const rows = parseCsv(csv);
    assert.equal(rows.length, 2); assert.equal(rows[1].length, 6);
    assert.equal(JSON.parse(rows[1][0]), title);
    assert.equal(rows[1][0][0], '"'); assert.match(rows[1][1], /^sha256:[a-f0-9]{64}$/);
    assert.equal(rows[1][1], 'sha256:' + sha(text));
    assert.equal(new TextDecoder().decode(new TextEncoder().encode(csv)), csv);
  }
});

test('The entire721-snapshot course is deterministic and includes both original endpoints', async () => {
  const minutes = Array.from({ length: 721 }, (_, i) => i);
  const input = comparison(minutes, minutes.map(i => i * 23904000), minutes.map(i => (720 - i) * 23674000));
  const text = projectText('Complete course'), csv = await serializeWaterHistoryCsv(input, text);
  assert.equal(await serializeWaterHistoryCsv(input, text), csv);
  const rows = parseCsv(csv); assert.equal(rows.length, 722);
  for (let i = 0; i <= 720; ++i) {
    assert.equal(Number(rows[i + 1][2]), i);
    assert.equal(Number(rows[i + 1][3]), input.existing.snapshots[i].storedLiters);
    assert.equal(Number(rows[i + 1][4]), input.proposal.snapshots[i].storedLiters);
    assert.equal(Number(rows[i + 1][5]), input.proposal.snapshots[i].storedLiters - input.existing.snapshots[i].storedLiters);
  }
});

test('Original scalar values are captured before the asynchronous digest', async () => {
  const input = comparison([0, 5], [0, 12.25], [0, 8.125]), text = projectText('Captured input');
  const pending = serializeWaterHistoryCsv(input, text);
  input.existing.snapshots[1].storedLiters = 999; input.proposal.snapshots[1].minute = 4;
  const rows = parseCsv(await pending);
  assert.deepEqual(rows[2].slice(2), ['5', '12.25', '8.125', '-4.125']);
  assert.equal(rows[2][1], 'sha256:' + sha(text));
  const changed = await serializeWaterHistoryCsv(comparison([0], [0], [0]), text + '\n');
  assert.equal(parseCsv(changed)[1][1], 'sha256:' + sha(text + '\n'));
  assert.notEqual(sha(text), sha(text + '\n'));
});

test('Malformed source, oversized Unicode input and misaligned values refuse before producing CSV', async () => {
  const input = comparison([0], [0], [0]);
  for (const text of [null, '', 'not JSON', '{}', '{"schema":"wrong","title":"x"}', projectText('x'.repeat(121)), ' '.repeat(4 * 1024 * 1024 + 1)]) {
    await assert.rejects(serializeWaterHistoryCsv(input, text));
  }
  const hugeUnicode = JSON.stringify({ schema: 'experimental-earth-site/1', title: 'Within character bound', source: '雨'.repeat(1500000) });
  assert.ok(hugeUnicode.length < 4 * 1024 * 1024);
  await assert.rejects(serializeWaterHistoryCsv(input, hugeUnicode), /4 MiB/);
  await assert.rejects(serializeWaterHistoryCsv(comparison([0, 0], [0, 1], [0, 2]), projectText('Invalid course')), /increasing/);
  await assert.rejects(serializeWaterHistoryCsv(comparison([0], [Infinity], [0]), projectText('Invalid total')), /finite/);
});
