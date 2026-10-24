import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain, compare, validateProject } from '../core.js';
import { compareRainOrigins } from '../rain-origin-study.js';
import { compareRainOriginHypotheses as investigate, rainOriginHypothesisSignature,
  MAX_ORIGIN_HYPOTHESIS_CELL_STEPS } from '../rain-origin-hypotheses.js';

const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
function courtyard() {
  const p = makeExample();
  p.rainOriginStudy = { targetCells: [29], fate: 'stored', minute: 60 };
  p.infiltrationStudy = { target: 'existing', surface: 'turf', ratesMmHr: [3, 9, 22] };
  p.observations = [{ cellIndex: 29, minute: 60, depthMm: 42, uncertaintyMm: 3,
    source: 'authored ambiguity control; not a field observation', scenario: 'existing', use: 'calibration' }];
  return p;
}
function small() {
  const p = courtyard();p.width = p.height = 2;p.selectedIndex = 0;p.observations = [];
  p.existing = ['sealed', 'garden', 'turf', 'sealed'].map((surface, i) => ({
    surface, elevationM: i === 0 ? 0.8 : i === 2 ? -0.2 : 0, provenance: 'authored forward-tag control' }));
  p.existing[0].internalBarriers = { east: { closed: true, source: 'authored wall control' } };
  p.proposal = structuredClone(p.existing);p.proposal[3].surface = 'garden';
  Object.assign(p.weather, { rainMmHr: 113, stormMinutes: 13.2, durationMinutes: 30.7,
    stepMinutes: 7, cellSizeM: 2.3, mobilityPerHour: 10, boundaryExitPerHour: 3 });
  p.infiltrationStudy.ratesMmHr = [3, 12, 48];p.rainOriginStudy = { targetCells: [1, 3], fate: 'stored', minute: 7 };
  return p;
}

test('one admitted depth band retains materially different rainfall-origin explanations', () => {
  const p = courtyard(), before = structuredClone(p), r = investigate(p, { subset: 'calibration' });
  assert.equal(r.status, 'compared');assert.equal(r.evidence.status, 'needs-challenge');
  assert.deepEqual(r.candidates.map(c => c.rateMmHr), [3, 9, 22]);
  const expected = [33.91057521094693, 30.191519974715778, 21.957726406006078];
  r.candidates.forEach((c, i) => close(c.comparison.existing.bySourceLiters[30], expected[i]));
  close(r.originRanges[30].existing.min, expected[2]);close(r.originRanges[30].existing.max, expected[0]);
  assert.ok(r.maxBalanceErrorLiters < 1e-9);assert.equal(r.minute, 60);
  assert.deepEqual(p, before);
});

test('paired change ranges cannot mix different rates into an invented sign reversal', () => {
  const r = investigate(courtyard(), { subset: 'calibration' }), source = r.originRanges[30];
  close(source.delta.min, -1.7091966374998435);close(source.delta.max, -0.9606844159386618);
  assert.ok(source.proposal.max - source.existing.min > 10, 'independent extrema would invent an increase');
  assert.ok(source.delta.max < 0, 'every actual matched hypothesis reduces this source contribution');
  assert.ok(r.totals.rainfallLiters.delta.max < -15);
  assert.ok(r.totals.rainfallLiters.delta.min > -16);
  assert.ok(r.totals.rainfallLiters.proposal.max - r.totals.rainfallLiters.existing.min > 1);
});

test('immobile one-hour balance has independently known storage and absorption for every rate', () => {
  const p = small();
  p.existing = Array.from({ length: 4 }, () => ({ surface: 'turf', elevationM: 0, provenance: 'authored closed control' }));
  p.proposal = p.existing.map(c => ({ ...c, surface: 'garden' }));
  Object.assign(p.weather, { rainMmHr: 30, stormMinutes: 60, durationMinutes: 60,
    stepMinutes: 5, cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0 });
  p.infiltrationStudy.ratesMmHr = [3, 9, 22];p.rainOriginStudy = { targetCells: [0, 1, 2, 3], minute: 60, fate: 'stored' };
  const stored = investigate(p);p.rainOriginStudy.fate = 'absorbed';const absorbed = investigate(p);
  for (let i = 0; i < stored.candidates.length; i++) {
    const c = stored.candidates[i], a = absorbed.candidates[i], rate = c.rateMmHr;
    close(c.comparison.existing.rainfallLiters, 4 * (30 - rate));
    close(a.comparison.existing.rainfallLiters, 4 * rate);
    close(c.comparison.existing.rainfallLiters + a.comparison.existing.rainfallLiters, 120);
    c.comparison.existing.bySourceLiters.forEach(value => close(value, 30 - rate));
    close(c.comparison.proposal.rainfallLiters, 24);
  }
});

test('every retained origin/fate/time agrees with actual forward tags under each paired override', () => {
  const p = small(), area = p.weather.cellSizeM ** 2;
  for (const minute of [0, 7, 30.7]) for (const fate of ['stored', 'absorbed', 'exit']) {
    p.rainOriginStudy = { targetCells: [1, 3], minute, fate };
    const r = investigate(p);
    for (const candidate of r.candidates) for (const scenario of ['existing', 'proposal']) {
      for (let source = 0; source < 4; source++) {
        const forward = runRain(p[scenario], 2, 2, p.weather, {
          surfaceInfiltrationOverride: { surface: 'turf', rateMmHr: candidate.rateMmHr },
          rainTrace: { sourceCells: [source], captureSteps: true },
        }).rainTrace.snapshots.find(s => s.minute === minute);
        const values = fate === 'stored' ? forward.depthsMm.map(d => d * area)
          : forward[fate === 'absorbed' ? 'absorbedByCellLiters' : 'exitByCellLiters'];
        close(candidate.comparison[scenario].bySourceLiters[source], values[1] + values[3]);
      }
      close(candidate.comparison[scenario].balanceErrorLiters, 0);
    }
  }
});

test('calibration and held-aside filtering reuse distinct maintained admission without refitting', () => {
  const p = courtyard(), baseline = investigate(p, { subset: 'calibration' });
  p.observations.push({ cellIndex: 29, minute: 120, depthMm: 40.87091295285532, uncertaintyMm: 0.01,
    source: 'authored held-aside control', scenario: 'existing', use: 'challenge' });
  const calibrated = investigate(p, { subset: 'calibration' }), challenged = investigate(p, { subset: 'surviving' });
  assert.deepEqual(calibrated.candidates, baseline.candidates, 'challenge values cannot alter calibration-only maps');
  assert.deepEqual(challenged.candidates.map(c => c.rateMmHr), [9]);
  assert.deepEqual(challenged.candidates[0], baseline.candidates[1]);
  p.observations[1].depthMm = 999;
  const none = investigate(p, { subset: 'surviving' });assert.equal(none.status, 'no-compatible-rates');
  assert.deepEqual(none.candidates, []);assert.deepEqual(none.originRanges, []);
});

test('missing and contradictory evidence refuse without selecting a closest failed model', () => {
  const p = courtyard();p.observations = [];
  assert.equal(investigate(p, { subset: 'calibration' }).status, 'need-calibration');
  p.observations = courtyard().observations;
  assert.equal(investigate(p, { subset: 'surviving' }).status, 'need-challenge');
  p.observations[0].depthMm = 999;p.observations[0].uncertaintyMm = 0;
  assert.equal(investigate(p, { subset: 'calibration' }).status, 'no-compatible-rates');
  assert.equal(investigate(p, { subset: 'surviving' }).status, 'no-compatible-rates');
});

test('all declared hypotheses ignore evidence values and do not claim admission', () => {
  const p = courtyard(), a = investigate(p);p.observations[0].depthMm = 999;
  const b = investigate(p);assert.deepEqual(a, b);assert.equal(b.evidence, null);
  assert.deepEqual(b.candidates.map(c => c.rateMmHr), [3, 9, 22]);
});

test('absence in the evidence site cannot support a proposed new material rate', () => {
  const p = courtyard();p.infiltrationStudy.surface = 'garden';
  const all = investigate(p);assert.equal(all.status, 'compared');assert.equal(all.affected.existing, 0);
  assert.equal(investigate(p, { subset: 'calibration' }).status, 'evidence-surface-absent');
  p.proposal = structuredClone(p.existing);assert.equal(investigate(p).status, 'surface-absent');
});

test('hypothesis order cannot alter ranges or per-rate forecasts', () => {
  const p = courtyard(), a = investigate(p);p.infiltrationStudy.ratesMmHr = [22, 3, 9];const b = investigate(p);
  assert.deepEqual(b.candidates.map(c => c.rateMmHr), [22, 3, 9]);
  assert.deepEqual(a.originRanges, b.originRanges);assert.deepEqual(a.totals, b.totals);
  for (const c of a.candidates) assert.deepEqual(c, b.candidates.find(x => x.rateMmHr === c.rateMmHr));
});

test('full-event individual and cohort budgets cannot be bypassed by early queries or filtering', () => {
  const p = courtyard();p.width = p.height = 24;
  p.existing = Array.from({ length: 576 }, () => ({ surface: 'turf', elevationM: 0, provenance: 'authored budget control' }));
  p.proposal = structuredClone(p.existing);p.rainOriginStudy.minute = 0;
  Object.assign(p.weather, { durationMinutes: 400, stepMinutes: 1 });p.infiltrationStudy.ratesMmHr = [1,2,3,4,5,6,7,8,9];
  for (const subset of ['all', 'calibration', 'surviving']) {
    const r = investigate(p, { subset });assert.equal(r.status, 'work-limit');
    assert.ok(r.cellStepUpperBound > MAX_ORIGIN_HYPOTHESIS_CELL_STEPS);assert.equal(r.evidence, null);
  }
  p.infiltrationStudy.ratesMmHr = [3,9];p.weather.durationMinutes = 720;
  assert.equal(investigate(p).status, 'work-limit');
});

test('default explanation and ordinary simulation are unchanged by examining other rates', () => {
  const p = courtyard(), before = structuredClone(p), plain = compareRainOrigins(p), bulk = compare(p);
  const r = investigate(p);assert.notEqual(r.candidates[0].comparison.existing.rainfallLiters, plain.existing.rainfallLiters);
  assert.deepEqual(compareRainOrigins(p), plain);assert.deepEqual(compare(p), bulk);assert.deepEqual(p, before);
});

test('future event duration and rain cannot change an earlier origin under a fixed rate', () => {
  const a = small();a.weather.stormMinutes = 7;const b = structuredClone(a);
  b.weather.stormMinutes = 28;b.weather.durationMinutes = 70;
  const first = investigate(a), later = investigate(b);
  first.candidates.forEach((c,i) => {
    assert.deepEqual(c.comparison.existing, later.candidates[i].comparison.existing);
    assert.deepEqual(c.comparison.proposal, later.candidates[i].comparison.proposal);
  });
});

test('saved subset is validated and recomputed; evidence edits invalidate only comparison signatures', () => {
  const p = courtyard();p.rainOriginStudy.hypothesisSubset = 'calibration';
  const saved = JSON.parse(JSON.stringify(p));validateProject(saved);
  assert.deepEqual(investigate(saved), investigate(p));
  const signature = rainOriginHypothesisSignature(p);p.selectedIndex = 5;
  assert.equal(rainOriginHypothesisSignature(p), signature);
  p.observations[0].uncertaintyMm = 1;assert.notEqual(rainOriginHypothesisSignature(p), signature);
  p.rainOriginStudy.hypothesisSubset = 'closest';assert.throws(() => validateProject(p), /hypothesis subset/);
});

test('invalid and unsupported query inputs cannot produce a partial range', () => {
  const p = courtyard();p.rainOriginStudy.minute = 61;
  assert.throws(() => investigate(p), /not interpolated/);
  p.rainOriginStudy.minute = 900;assert.doesNotThrow(() => validateProject(p));
  assert.throws(() => investigate(p), /within the modeled event/);
  p.rainOriginStudy.minute = 60;p.infiltrationStudy.ratesMmHr = [3,3];
  assert.throws(() => investigate(p), /distinct infiltration rates/);
});
