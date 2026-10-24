import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, validateProject } from '../core.js';
import { prepareSurfaceHeatStudy } from '../surface-heat.js';
import { prepareHeatColumnStudy, evaluateHeatColumnTarget } from '../heat-column.js';
import { prepareHeatColumnEvidence, compareHeatColumnEvidence, authoredHeatColumnEvidenceExample } from '../heat-column-evidence.js';
import { parsePortableProject, serializePortableProject } from '../project-portability.js';

const close = (a, b, tol = 1e-8) => assert.ok(Math.abs(a - b) <= tol, a + ' differs from ' + b);
function project() {
  const p = makeExample();
  const top = { capacityJm2K: 20000, exchangeWm2K: 10, absorptivity: .8, initialC: 20, source: 'Authored surface reference' };
  p.surfaceHeatStudy = prepareSurfaceHeatStudy(p, { cellIndex: 0, existing: top, proposal: { ...top, absorptivity: .4 },
    schedule: [{ minutes: 60, incidentWm2: 700, reservoirC: 20, source: 'Authored pulse' },
      { minutes: 360, incidentWm2: 0, reservoirC: 20, source: 'Authored dark interval' }] });
  const lower = { capacityJm2K: 80000, conductanceWm2K: 20, initialC: 20, source: 'Authored lower reference' };
  p.heatColumnStudy = prepareHeatColumnStudy(p, { existing: lower, proposal: lower });
  p.heatColumnEvidence = prepareHeatColumnEvidence(p, authoredHeatColumnEvidenceExample(p));
  return p;
}

test('one surface reading leaves a large finite hidden-peak spread, while challenge screens without refitting', () => {
  const p = project(), challenge = structuredClone(p.heatColumnEvidence.readings[1]);
  p.heatColumnEvidence.readings.pop();
  const before = structuredClone(p), r = compareHeatColumnEvidence(p);
  assert.equal(r.status, 'needs-challenge'); assert.equal(r.calibrationLabels.length, 5); assert.equal(r.survivingLabels.length, 5);
  close(r.peakRanges.lowerMaximumC.minimum, 22.14616617279468);
  close(r.peakRanges.lowerMaximumC.maximum, 36.36079223791248);
  for (const c of r.candidates) {
    close(c.calibration.rows[0].predictionC, 44.53099896635513);
    assert.ok(c.trajectory.some(row => row.minute === c.summary.subsurface.maximumMinute));
    close(c.trajectory.find(row => row.minute === c.summary.subsurface.maximumMinute).subsurfaceC, c.summary.subsurface.maximumC);
  }
  assert.deepEqual(p, before);
  const parameters = structuredClone(p.heatColumnEvidence.hypotheses);
  p.heatColumnEvidence.readings.push(challenge);
  const received = compareHeatColumnEvidence(p);
  assert.equal(received.status, 'one-survivor'); assert.equal(received.calibrationLabels.length, 5);
  assert.deepEqual(received.survivingLabels, [parameters[1].label]);
  close(received.peakRanges.lowerMaximumC.minimum, 32.33238368285362);
  assert.equal(received.candidates[1].challenge.rows[0].index, 1);
  assert.deepEqual(p.heatColumnEvidence.hypotheses, parameters);
  for (let i = 0; i < r.candidates.length; i++) assert.deepEqual(received.candidates[i].summary, r.candidates[i].summary);
});

test('missing calibration, calibration rejection and challenge rejection stay distinct', () => {
  const p = project();
  p.heatColumnEvidence.readings[1].temperatureC = 100;
  const challenged = compareHeatColumnEvidence(p);
  assert.equal(challenged.status, 'challenged'); assert.equal(challenged.calibrationLabels.length, 5);
  assert.deepEqual(challenged.survivingLabels, []); assert.equal(challenged.peakRanges.lowerMaximumC, null);
  p.heatColumnEvidence.readings[0].temperatureC = 100;
  assert.equal(compareHeatColumnEvidence(p).status, 'calibration-rejected');
  p.heatColumnEvidence.readings = [p.heatColumnEvidence.readings[1]];
  assert.equal(compareHeatColumnEvidence(p).status, 'need-calibration');
  delete p.heatColumnEvidence;
  assert.equal(compareHeatColumnEvidence(p).status, 'no-evidence');
});

test('identical offered physics remain indistinguishable and guards remain separate from reading widths', () => {
  const p = project(), reference = structuredClone(p.heatColumnEvidence.hypotheses[1]);
  p.heatColumnEvidence.hypotheses = [reference, { ...reference, label: 'Distinct sourced statement of the same physics' }];
  const before = structuredClone(p), r = compareHeatColumnEvidence(p);
  assert.equal(r.status, 'ambiguous'); assert.equal(r.survivingLabels.length, 2);
  for (const c of r.candidates) for (const row of [...c.calibration.rows, ...c.challenge.rows]) {
    assert.ok(Number.isFinite(row.arithmeticGuardC) && row.arithmeticGuardC > 0);
    assert.ok(row.arithmeticGuardC < 1e-6);
  }
  assert.deepEqual(p, before);
});

test('source and target changes require explicit clearing, while unchanged raw reopening recomputes', () => {
  const p = project(), original = compareHeatColumnEvidence(p), input = authoredHeatColumnEvidenceExample(p);
  assert.throws(() => prepareHeatColumnEvidence(p, { ...input, target: 'proposal' }), /clearing/);
  const raw = parsePortableProject(serializePortableProject(p));
  raw.heatColumnEvidence.report = { status: 'one-survivor', survivingLabels: ['forged'] };
  raw.heatColumnEvidence.trajectory = [{ surfaceC: -999 }];
  raw.heatColumnEvidence.peakRanges = { lowerMaximumC: { minimum: -999, maximum: -999 } };
  assert.deepEqual(compareHeatColumnEvidence(raw), original);
  raw.heatColumnStudy.lowerLayers.existing.initialC += 1;
  assert.equal(compareHeatColumnEvidence(raw).status, 'context-changed');
  assert.throws(() => prepareHeatColumnEvidence(raw, input), /another two-store/);
  delete raw.heatColumnEvidence;
  raw.heatColumnEvidence = prepareHeatColumnEvidence(raw, { ...input, target: 'proposal' });
  assert.equal(raw.heatColumnEvidence.target, 'proposal');
  raw.existing[0].provenance += ' changed place source';
  assert.equal(compareHeatColumnEvidence(raw).status, 'context-changed');
});

test('admission refuses unsupported quantities, hidden varied properties, duplicate times and sparse requests', () => {
  const p = project(), input = authoredHeatColumnEvidenceExample(p);
  assert.throws(() => prepareHeatColumnEvidence(p, { ...input, quantity: 'lower-temperature' }), /surface temperature/);
  const extra = structuredClone(input); extra.hypotheses[0].initialC = 50;
  assert.throws(() => prepareHeatColumnEvidence(p, extra), /stay fixed/);
  const duplicate = structuredClone(input); duplicate.readings.push({ ...duplicate.readings[0] });
  assert.throws(() => prepareHeatColumnEvidence(p, duplicate), /unique times/);
  const blank = structuredClone(p); blank.heatColumnEvidence.hypotheses[0].source = ' ';
  assert.throws(() => validateProject(blank), /sources/);
  assert.throws(() => evaluateHeatColumnTarget(p.heatColumnStudy, 'existing', Array(3)), /finite times/);
});

test('an unsupported unobserved interval refuses the whole candidate course', () => {
  const p = makeExample();
  const top = { capacityJm2K: 1000, exchangeWm2K: 0, absorptivity: 1, initialC: 20, source: 'Authored high input' };
  p.surfaceHeatStudy = prepareSurfaceHeatStudy(p, { cellIndex: 0, existing: top, proposal: top,
    schedule: [{ minutes: 120, incidentWm2: 2000, reservoirC: 20, source: 'Authored forcing outside isolated model support' }] });
  const lower = { capacityJm2K: 1e7, conductanceWm2K: 1000, initialC: 20, source: 'Authored coupled sink' };
  p.heatColumnStudy = prepareHeatColumnStudy(p, { existing: lower, proposal: lower });
  p.heatColumnEvidence = prepareHeatColumnEvidence(p, { target: 'existing', associationSource: 'Authored time-zero-only control',
    hypotheses: [{ label: 'Coupled', capacityJm2K: 1e7, conductanceWm2K: 1000, source: 'Authored' },
      { label: 'Isolated', capacityJm2K: 1e7, conductanceWm2K: 0, source: 'Authored' }],
    readings: [{ minute: 0, temperatureC: 20, halfWidthC: 0, use: 'calibration', source: 'Authored initial temperature' }] });
  const before = structuredClone(p);
  assert.throws(() => compareHeatColumnEvidence(p), /range/);
  assert.deepEqual(p, before);
});

test('short decimal exposures retain exact admitted plotting endpoints', () => {
  for (const duration of [.1018, .1001, 123.456789]) {
    const p = project(), lower = structuredClone(p.heatColumnStudy.lowerLayers);
    delete p.heatColumnEvidence; delete p.heatColumnStudy;
    p.surfaceHeatStudy.schedule = [{ ...p.surfaceHeatStudy.schedule[0], minutes: duration }];
    p.heatColumnStudy = prepareHeatColumnStudy(p, lower);
    const input = authoredHeatColumnEvidenceExample(p); input.readings = [];
    p.heatColumnEvidence = prepareHeatColumnEvidence(p, input);
    const r = compareHeatColumnEvidence(p);
    assert.equal(r.status, 'need-calibration');
    for (const c of r.candidates) {
      assert.equal(c.trajectory[0].minute, 0); assert.equal(c.trajectory.at(-1).minute, duration);
      assert.ok(c.trajectory.every(row => row.minute >= 0 && row.minute <= duration));
    }
  }
});
