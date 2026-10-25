import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample } from '../core.js';
import { prepareSurfaceHeatStudy } from '../surface-heat.js';
import { prepareHeatColumnStudy } from '../heat-column.js';
import { prepareBottomHeatStudy, evaluateBottomHeatTarget } from '../bottom-heat-study.js';
import { prepareBottomEvidence, compareBottomEvidence, serializeBottomEvidence, parseBottomEvidence } from '../bottom-heat-evidence.js';
const near = (a, b, t = 1e-8) => assert.ok(Math.abs(a - b) <= t, a + ' != ' + b);
const surface = { absorptivity: .8, capacityJm2K: 20000, exchangeWm2K: 10, initialC: 20, source: 'Authored source; no field validation' };
const lower = { capacityJm2K: 80000, conductanceWm2K: 20, initialC: 20, source: 'Authored lower store' };
function original() {
  const p = makeExample();
  p.surfaceHeatStudy = prepareSurfaceHeatStudy(p, { cellIndex: 0, existing: surface, proposal: surface,
    schedule: [{ minutes: 60, incidentWm2: 700, reservoirC: 20, source: 'Authored pulse' },
      { minutes: 360, incidentWm2: 0, reservoirC: 20, source: 'Authored darkness' }] });
  p.heatColumnStudy = prepareHeatColumnStudy(p, { existing: lower, proposal: lower });
  return prepareBottomHeatStudy(p, { existing: { conductanceWm2K: 10, reservoirC: 20, source: 'Authored bottom' },
    proposal: { conductanceWm2K: 10, reservoirC: 20, source: 'Authored bottom' } });
}
const hypothesis = b => ({ label: 'b' + b, conductanceWm2K: b, reservoirRangeC: [-20, 60], source: 'Authored offered boundary, not an inferred soil property' });
const reading = (minute, temperatureC, use = 'calibration', extra = {}) =>
  ({ minute, temperatureC, halfWidthC: .05, use, source: 'Frozen independent RK4 authored reference, not acquired evidence', ...extra });
function evidence() {
  return prepareBottomEvidence(original(), { target: 'existing', associationSource: 'Authored fixed original place and forcing',
    hypotheses: [0, 5, 10, 20, 50].map(hypothesis),
    readings: [reading(60, 43.73770625579893), reading(420, 20.171312173325774, 'challenge')] });
}
test('continuous reservoir confounding survives calibration and a later band separates offered conductances', () => {
  const e = evidence(), before = structuredClone(e), r = compareBottomEvidence(e);
  assert.deepEqual(e, before);
  assert.deepEqual(r.calibrationLabels, ['b5', 'b10', 'b20', 'b50']);
  assert.deepEqual(r.survivingLabels, ['b10']);
  assert.equal(r.candidates[0].status, 'calibration-rejected');
  const c = r.candidates[2];
  near(c.calibrationRangeC[0], 19.704633165761855);
  near(c.calibrationRangeC[1], 20.29536683425015);
  near(c.survivingRangeC[0], 19.87365636437608);
  near(c.survivingRangeC[1], 20.126343635623236);
  assert.ok(c.survivingRangeC[1] > c.survivingRangeC[0]); // no fabricated point estimate
  assert.ok(c.rows.every(row => row.arithmeticGuardC > 0));
  const changed = structuredClone(e); changed.readings[1].temperatureC = 50;
  const challenged = compareBottomEvidence(changed);
  assert.deepEqual(challenged.calibrationLabels, r.calibrationLabels);
  assert.deepEqual(challenged.candidates.map(c => c.calibrationRangeC), r.candidates.map(c => c.calibrationRangeC));
  assert.deepEqual(challenged.survivingLabels, []);
});

test('true interval means agree with independent augmented RK4 integration across forcing changes', () => {
  // Independently integrated temperature as a third state, dt3 and dt1.5 seconds;
  // the two resolutions differed by at most 3.6e-12 C for these windows.
  const windows = [{ fromMinute: 0, minute: 60 }, { fromMinute: 30, minute: 90 },
    { fromMinute: 60, minute: 120 }, { fromMinute: 360, minute: 420 }];
  const expected = [37.26099807977096, 37.07446545185907, 29.156154528587624, 20.24339897746524];
  const out = evaluateBottomHeatTarget(original(), 'existing', [60, 420], windows);
  out.averages.forEach((row, i) => near(row.surfaceMeanC, expected[i]));
  assert.equal(out.averages[1].segments, 2);
  const e = evidence(); e.hypotheses = [{ ...hypothesis(10), reservoirRangeC: [20, 20] }];
  e.readings = [reading(60, expected[0], 'calibration', { aggregation: 'interval-mean', fromMinute: 0 }),
    reading(420, expected[3], 'challenge', { aggregation: 'interval-mean', fromMinute: 360 })];
  assert.deepEqual(compareBottomEvidence(e).survivingLabels, ['b10']);
  const wrong = structuredClone(e); delete wrong.readings[0].aggregation; delete wrong.readings[0].fromMinute;
  assert.equal(compareBottomEvidence(wrong).candidates[0].status, 'calibration-rejected');
  const tiny = evaluateBottomHeatTarget(original(), 'existing', [100 + .5e-9], [{ fromMinute: 100, minute: 100 + 1e-9 }]);
  near(tiny.averages[0].surfaceMeanC, tiny.trajectory.find(r => r.minute === 100 + .5e-9).surfaceC);
});

test('zero bottom or zero internal coupling preserves reservoir non-identifiability', () => {
  const e = evidence(); e.hypotheses = [hypothesis(0)];
  e.readings = [reading(60, 44.530998966355135)];
  let c = compareBottomEvidence(e).candidates[0];
  assert.deepEqual(c.calibrationRangeC, [-20, 60]); assert.equal(c.rows[0].sensitivity, 'none');
  assert.equal(c.status, 'needs-challenge');
  e.original.heatColumnStudy.lowerLayers.existing.conductanceWm2K = 0;
  e.hypotheses = [0, 10, 1000].map(hypothesis);
  e.readings = [reading(60, 20 + 56 * (1 - Math.exp(-1.8)))];
  for (c of compareBottomEvidence(e).candidates) {
    assert.deepEqual(c.calibrationRangeC, [-20, 60]); assert.equal(c.rows[0].sensitivity, 'none');
  }
});

test('each intermediate reservoir follows the affine model for point and mean operators', () => {
  const s = original(), times = [30, 60, 420], windows = [{ fromMinute: 30, minute: 90 }];
  const evaluate = t => { const v = structuredClone(s); v.bottoms.existing.reservoirC = t;
    return evaluateBottomHeatTarget(v, 'existing', times, windows); };
  const a = evaluate(-20), b = evaluate(60);
  for (const fraction of [.03, .37, .91]) {
    const m = evaluate(-20 + 80 * fraction);
    for (const minute of times) {
      const value = r => r.trajectory.find(row => row.minute === minute).surfaceC;
      near(value(m), value(a) + fraction * (value(b) - value(a)), 1e-10);
    }
    near(m.averages[0].surfaceMeanC, a.averages[0].surfaceMeanC +
      fraction * (b.averages[0].surfaceMeanC - a.averages[0].surfaceMeanC), 1e-10);
  }
});

test('unsupported full courses remain explicit alternatives instead of a fallback fit', () => {
  const e = evidence(), h = e.original.heatColumnStudy;
  h.heatStudy.existing = { ...surface, capacityJm2K: 1000, exchangeWm2K: 0, absorptivity: 1 };
  h.lowerLayers.existing = { ...lower, capacityJm2K: 1000 };
  h.heatStudy.schedule[0].incidentWm2 = 2000;
  e.hypotheses = [hypothesis(0), hypothesis(1000)]; e.readings = [reading(60, 122)];
  const r = compareBottomEvidence(e);
  assert.equal(r.candidates.length, 2); assert.equal(r.candidates[0].status, 'unsupported-course');
  assert.match(r.candidates[0].reason, /temperature leaves/);
  assert.ok(r.candidates[1].calibrationRangeC);
});

test('source-only roundtrip, role contract and unsupported observations cannot manufacture success', () => {
  const e = evidence(); e.report = { survivingLabels: ['forged'] }; e.original.heatColumnStudy.report = { maximumC: -999 };
  const raw = serializeBottomEvidence(e), restored = parseBottomEvidence(raw);
  assert.equal(restored.report, undefined); assert.equal(restored.original.heatColumnStudy.report, undefined);
  assert.deepEqual(compareBottomEvidence(restored).survivingLabels, ['b10']);
  const noCalibration = structuredClone(restored); noCalibration.readings = [noCalibration.readings[1]];
  assert.deepEqual(compareBottomEvidence(noCalibration).survivingLabels, []);
  assert.ok(compareBottomEvidence(noCalibration).candidates.every(c => c.status === 'need-calibration'));
  for (const mutation of [
    x => { x.readings[0].aggregation = 'interval-mean'; x.readings[0].fromMinute = 61; },
    x => { x.readings[0].source = ' '; }, x => { x.quantity = 'air-temperature'; },
    x => { x.hypotheses.push(structuredClone(x.hypotheses[0])); },
    x => { x.hypotheses[0].reservoirRangeC = [60, -20]; },
    x => { x.readings[0].minute = 421; }
  ]) { const bad = structuredClone(restored); mutation(bad); assert.throws(() => compareBottomEvidence(bad)); }
  assert.throws(() => parseBottomEvidence(' '.repeat(4 * 1024 * 1024 + 1)), /limit|larger/);
});


test('weak numerical sensitivity preserves an enclosing band without manufacturing a narrow inverse', () => {
  const e = evidence(); e.hypotheses = [hypothesis(1e-12)];
  e.readings = [reading(.001, 20, 'calibration', { halfWidthC: 1 })];
  let c = compareBottomEvidence(e).candidates[0];
  assert.equal(c.rows[0].sensitivity, 'numerically-unresolved');
  assert.deepEqual(c.calibrationRangeC, [-20, 60]);
  const predicted = c.rows[0].predictionsAtRangeEndsC[0], guard = c.rows[0].arithmeticGuardC;
  e.readings = [reading(.001, predicted + guard / 2, 'calibration', { halfWidthC: 0 })];
  c = compareBottomEvidence(e).candidates[0];
  assert.equal(c.status, 'numerical-contact'); assert.equal(c.calibrationRangeC, null);
  assert.deepEqual(c.calibrationWithAllowanceC, [-20, 60]);
  e.readings[0].temperatureC = 100;
  assert.equal(compareBottomEvidence(e).candidates[0].status, 'calibration-rejected');
  e.hypotheses = new Array(2);
  assert.throws(() => compareBottomEvidence(e));
});


test('exact arithmetic-guard contact cannot establish a nominal weak-sensitivity interval', () => {
  const e = evidence(); e.hypotheses = [hypothesis(1e-12)];
  e.readings = [reading(.001, 0, 'calibration', { halfWidthC: 100 })];
  const initial = compareBottomEvidence(e).candidates[0].rows[0];
  assert.equal(initial.sensitivity, 'numerically-unresolved');
  const boundary = Math.max(...initial.predictionsAtRangeEndsC) + initial.arithmeticGuardC;
  e.readings[0].halfWidthC = boundary;
  const c = compareBottomEvidence(e).candidates[0];
  assert.equal(c.rows[0].arithmeticGuardC, initial.arithmeticGuardC);
  assert.equal(Math.max(...c.rows[0].predictionsAtRangeEndsC) + c.rows[0].arithmeticGuardC, e.readings[0].halfWidthC);
  assert.equal(c.status, 'numerical-contact');
  assert.equal(c.calibrationRangeC, null);
  assert.deepEqual(c.calibrationWithAllowanceC, [-20, 60]);
});
