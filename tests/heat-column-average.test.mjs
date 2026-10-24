import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeExample } from '../core.js';
import { prepareSurfaceHeatStudy } from '../surface-heat.js';
import { prepareHeatColumnStudy, evaluateHeatColumnTarget } from '../heat-column.js';
import { prepareHeatColumnEvidence, compareHeatColumnEvidence, authoredHeatColumnEvidenceExample } from '../heat-column-evidence.js';
import { parsePortableProject, serializePortableProject } from '../project-portability.js';

const oracle = JSON.parse(readFileSync(new URL('./fixtures/heat-column-average-oracle.json', import.meta.url), 'utf8'));
const close = (actual, expected, tolerance = 2e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, actual + ' differs from ' + expected);
function project({ h = 10, g = 20 } = {}) {
  const p = makeExample();
  const surface = { capacityJm2K: 20000, exchangeWm2K: h, absorptivity: .8, initialC: 20, source: 'Authored independent integral control' };
  p.surfaceHeatStudy = prepareSurfaceHeatStudy(p, { cellIndex: 0, existing: surface, proposal: surface,
    schedule: [{ minutes: 60, incidentWm2: 700, reservoirC: 20, source: 'Authored pulse' },
      { minutes: 360, incidentWm2: 0, reservoirC: 20, source: 'Authored dark interval' }] });
  const lower = { capacityJm2K: 80000, conductanceWm2K: g, initialC: 20, source: 'Authored lower store' };
  p.heatColumnStudy = prepareHeatColumnStudy(p, { existing: lower, proposal: lower });
  return p;
}
function input() {
  return { target: 'existing', associationSource: 'Authored interval means, not independently acquired readings',
    hypotheses: [{ label: 'Reference', capacityJm2K: 80000, conductanceWm2K: 20, source: 'Authored' },
      { label: 'Larger', capacityJm2K: 160000, conductanceWm2K: 20, source: 'Authored' }],
    readings: [{ aggregation: 'interval-mean', fromMinute: 0, minute: 60, temperatureC: 37.47920767285588,
      halfWidthC: .0001, use: 'calibration', source: 'Independent augmented affine-system integral' },
    { aggregation: 'interval-mean', fromMinute: 60, minute: 120, temperatureC: 30.949145738082176,
      halfWidthC: .0001, use: 'challenge', source: 'Independent augmented affine-system integral' }] };
}

for (const row of oracle) test('independent integrated-temperature oracle: ' + row.name, () => {
  const p = project(row), before = structuredClone(p);
  const result = evaluateHeatColumnTarget(p.heatColumnStudy, 'existing', [], [{ fromMinute: row.fromMinute, minute: row.toMinute }]);
  const mean = result.averages[0], end = result.trajectory.find(r => r.minute === row.toMinute);
  close(mean.surfaceMeanC, row.averageSurfaceC); close(mean.subsurfaceMeanC, row.averageLowerC);
  close(end.surfaceC, row.endpointSurfaceC); close(end.subsurfaceC, row.endpointLowerC);
  assert.equal(mean.segments, row.fromMinute < 60 && row.toMinute > 60 ? 2 : 1);
  assert.deepEqual(p, before);
});

test('a mean operator accepts its declared average while endpoint substitution rejects it', () => {
  const p = project(); p.heatColumnEvidence = prepareHeatColumnEvidence(p, input());
  const before = structuredClone(p), means = compareHeatColumnEvidence(p);
  assert.equal(means.status, 'one-survivor'); assert.deepEqual(means.survivingLabels, ['Reference']);
  close(means.candidates[0].calibration.rows[0].predictionC, oracle[0].averageSurfaceC);
  assert.equal(means.candidates[0].calibration.rows[0].fromMinute, 0);
  assert.equal(means.candidates[0].calibration.rows[0].aggregation, 'interval-mean');
  assert.deepEqual(p, before);
  for (const r of p.heatColumnEvidence.readings) { delete r.aggregation; delete r.fromMinute; }
  assert.equal(compareHeatColumnEvidence(p).status, 'calibration-rejected');
});

test('challenge means retain roles and original indices without changing candidate physics', () => {
  const p = project(), raw = input(); raw.readings.reverse();
  p.heatColumnEvidence = prepareHeatColumnEvidence(p, raw);
  const before = compareHeatColumnEvidence(p), parameters = structuredClone(p.heatColumnEvidence.hypotheses);
  p.heatColumnEvidence.readings[0].temperatureC = 100;
  const after = compareHeatColumnEvidence(p); assert.equal(after.status, 'challenged');
  for (let i = 0; i < after.candidates.length; i++) {
    assert.deepEqual(after.candidates[i].calibration, before.candidates[i].calibration);
    assert.deepEqual(after.candidates[i].trajectory, before.candidates[i].trajectory);
    assert.deepEqual(after.candidates[i].summary, before.candidates[i].summary);
    assert.equal(after.candidates[i].challenge.rows[0].index, 0);
  }
  assert.deepEqual(p.heatColumnEvidence.hypotheses, parameters);
});

test('short, late and subnormal windows are evaluated locally without cumulative subtraction', () => {
  const p = project();
  for (const [fromMinute, minute] of [[0, Number.MIN_VALUE], [60 - 1e-9, 60 + 1e-9], [419.9, 419.9 + 1e-10]]) {
    const r = evaluateHeatColumnTarget(p.heatColumnStudy, 'existing', [], [{ fromMinute, minute }]);
    const a = r.trajectory.find(x => x.minute === fromMinute), b = r.trajectory.find(x => x.minute === minute), mean = r.averages[0];
    assert.ok(Number.isFinite(mean.surfaceMeanC)); assert.ok(Number.isFinite(mean.subsurfaceMeanC));
    for (const [field, name] of [['surfaceC', 'surfaceMeanC'], ['subsurfaceC', 'subsurfaceMeanC']]) {
      assert.ok(mean[name] >= Math.min(a[field], b[field]) - 1e-7);
      assert.ok(mean[name] <= Math.max(a[field], b[field]) + 1e-7);
    }
  }
});

test('raw replay preserves averaging support and legacy instantaneous declarations', () => {
  const p = project(); p.heatColumnEvidence = prepareHeatColumnEvidence(p, input());
  const expected = compareHeatColumnEvidence(p), reopened = parsePortableProject(serializePortableProject(p));
  assert.deepEqual(reopened.heatColumnEvidence, p.heatColumnEvidence);
  reopened.heatColumnEvidence.averages = [{ surfaceMeanC: -999 }];
  assert.deepEqual(compareHeatColumnEvidence(reopened), expected);
  const legacy = project(); legacy.heatColumnEvidence = prepareHeatColumnEvidence(legacy, authoredHeatColumnEvidenceExample(legacy));
  assert.ok(legacy.heatColumnEvidence.readings.every(r => !Object.hasOwn(r, 'aggregation') && !Object.hasOwn(r, 'fromMinute')));
  const result = compareHeatColumnEvidence(legacy); assert.equal(result.status, 'one-survivor');
  close(result.candidates[1].calibration.rows[0].predictionC, 44.53099896635513);
});

test('invalid, duplicate and unsupported averaging supports refuse before comparison', () => {
  const p = project();
  for (const patch of [{ aggregation: 'median' }, { fromMinute: 60 }, { fromMinute: -1 }, { minute: 421 },
    { aggregation: 'instant', fromMinute: 0 }, { fromMinute: NaN }, { fromMinute: '0' }]) {
    const raw = input(); Object.assign(raw.readings[0], patch);
    assert.throws(() => prepareHeatColumnEvidence(p, raw), /averaging windows/);
  }
  const duplicate = input(); duplicate.readings.push({ ...duplicate.readings[0] });
  assert.throws(() => prepareHeatColumnEvidence(p, duplicate), /unique/);
  assert.throws(() => evaluateHeatColumnTarget(p.heatColumnStudy, 'existing', [], Array(3)), /averaging windows/);
  assert.throws(() => evaluateHeatColumnTarget(p.heatColumnStudy, 'existing', Array(1999).fill(0), [{ fromMinute: 0, minute: 1 }]), /work limit/);
});
