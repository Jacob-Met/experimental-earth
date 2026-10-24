import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, validateProject } from '../core.js';
import { prepareSurfaceHeatStudy, inspectSurfaceHeat } from '../surface-heat.js';
import { prepareHeatEvidence, compareHeatEvidence, authoredHeatEvidenceExample } from '../surface-heat-evidence.js';
import { parseHeatHypotheses, formatHeatHypotheses, parseHeatReadings, formatHeatReadings } from '../surface-heat-evidence-table.js';
import { serializePortableProject, parsePortableProject } from '../project-portability.js';

function fixture() {
  const p = makeExample(), h = { absorptivity: .4, capacityJm2K: 40000, exchangeWm2K: 10, initialC: 25, source: 'Authored material' };
  p.surfaceHeatStudy = prepareSurfaceHeatStudy(p, { cellIndex: 0, existing: h, proposal: h, schedule: [
    { minutes: 60, incidentWm2: 600, reservoirC: 25, source: 'Authored heat interval' },
    { minutes: 180, incidentWm2: 0, reservoirC: 25, source: 'Authored cooling interval' },
  ] });
  p.surfaceHeatEvidence = prepareHeatEvidence(p, authoredHeatEvidenceExample(p));
  return p;
}
const close = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);

test('common-scale properties preserve every temperature but retain doubled energy ambiguity', () => {
  const p = fixture(), r = compareHeatEvidence(p), [a, b, c] = r.candidates;
  assert.equal(r.status, 'ambiguous'); assert.deepEqual(r.survivingLabels, [a.label, b.label]);
  assert.equal(c.calibration.compatible, false);
  for (let i = 0; i < a.trajectory.length; i++) {
    close(a.trajectory[i].temperatureC, b.trajectory[i].temperatureC, 0);
    for (const k of ['inputJm2', 'storedJm2', 'exchangedJm2']) close(b.trajectory[i][k], 2 * a.trajectory[i][k], 0);
  }
  close(a.trajectory.find(r => r.minute === 60).temperatureC, 25 + 24 * (1 - Math.exp(-.9)));
  close(r.energyRanges.storedJm2.maximum, 2 * r.energyRanges.storedJm2.minimum, 0);
});

test('challenge readings cannot refit, reorder or rescue calibration-rejected candidates', () => {
  const p = fixture(), before = compareHeatEvidence(p);
  const c = p.surfaceHeatEvidence.hypotheses[2], study = { ...p.surfaceHeatStudy, existing: c, proposal: c };
  for (const r of p.surfaceHeatEvidence.readings.filter(r => r.use === 'challenge')) {
    r.temperatureC = inspectSurfaceHeat(study, r.minute).existing.temperatureC;
  }
  const after = compareHeatEvidence(p);
  assert.equal(after.status, 'challenged'); assert.deepEqual(after.survivingLabels, []);
  assert.deepEqual(after.calibrationLabels, before.calibrationLabels);
  assert.deepEqual(after.candidates.map(c => [c.label, c.trajectory, c.calibration]), before.candidates.map(c => [c.label, c.trajectory, c.calibration]));
  assert.equal(after.candidates[2].challenge.compatible, true);
});

test('absence of calibration or challenge is preserved rather than counted as evidence', () => {
  const p = fixture(); p.surfaceHeatEvidence.readings = p.surfaceHeatEvidence.readings.filter(r => r.use === 'challenge');
  let r = compareHeatEvidence(p); assert.equal(r.status, 'need-calibration'); assert.deepEqual(r.survivingLabels, []);
  p.surfaceHeatEvidence.readings = []; r = compareHeatEvidence(p); assert.equal(r.status, 'need-calibration');
  const q = fixture(); q.surfaceHeatEvidence.readings = q.surfaceHeatEvidence.readings.filter(r => r.use === 'calibration');
  r = compareHeatEvidence(q); assert.equal(r.status, 'needs-challenge'); assert.equal(r.survivingLabels.length, 2);
});

test('changed selected place, material source or exposure refuses retained reading association', () => {
  for (const edit of [
    p => { p.existing[0].provenance = 'new measurement'; },
    p => { p.weather.cellSizeM *= 2; },
    p => { p.surfaceHeatStudy.schedule[0].incidentWm2 += 1; },
    p => { p.surfaceHeatStudy.existing.source = 'changed declared material'; },
    p => { delete p.surfaceHeatStudy; },
  ]) { const p = fixture(); edit(p); assert.equal(compareHeatEvidence(p).status, 'context-changed'); }
  const p = fixture(); p.selectedIndex = 3; assert.equal(compareHeatEvidence(p).status, 'ambiguous');
});

test('unobserved unsupported trajectory is refused at its exact interval endpoint', () => {
  const p = fixture();
  p.surfaceHeatEvidence.hypotheses[0] = { ...p.surfaceHeatEvidence.hypotheses[0], absorptivity: 1, capacityJm2K: 1000, exchangeWm2K: 0 };
  p.surfaceHeatEvidence.readings = [{ minute: 0, temperatureC: 25, halfWidthC: 0, use: 'calibration', source: 'initial-only control' }];
  assert.throws(() => compareHeatEvidence(p), /supported.*range/);
});

test('strict source, role, time and finite-family bounds preserve the accepted input', () => {
  const changes = [
    e => { e.readings[0].source = ''; }, e => { e.associationSource = ''; },
    e => { e.readings[1].minute = e.readings[0].minute; }, e => { e.readings[0].minute = 241; },
    e => { e.readings[0].use = 'verified'; }, e => { e.readings[0].halfWidthC = -1; },
    e => { e.hypotheses[1].label = e.hypotheses[0].label; }, e => { e.hypotheses[0].capacityJm2K = Infinity; },
    e => { e.hypotheses = Array.from({ length: 13 }, (_, i) => ({ ...e.hypotheses[0], label: String(i) })); },
  ];
  for (const change of changes) { const p = fixture(); change(p.surfaceHeatEvidence); assert.throws(() => validateProject(p)); }
});

test('whole-project export/reopen preserves raw evidence and ignores imported derived answers', () => {
  const p = fixture(), before = JSON.stringify(p);
  const text = serializePortableProject(p), reopened = parsePortableProject(text);
  assert.deepEqual(reopened.surfaceHeatEvidence, p.surfaceHeatEvidence);
  reopened.surfaceHeatEvidence.result = { status: 'one-survivor', survivingLabels: ['invented'] };
  assert.equal(compareHeatEvidence(reopened).status, 'ambiguous');
  compareHeatEvidence(p); assert.equal(JSON.stringify(p), before);
});

test('CSV retains quoted source text and refuses ambiguous numeric or header tokens', () => {
  const p = fixture(), e = p.surfaceHeatEvidence;
  e.readings[0].source = 'Instrument A, raw note\n"quoted" <img src=x>';
  assert.deepEqual(parseHeatReadings(formatHeatReadings(e.readings)), e.readings);
  assert.deepEqual(parseHeatHypotheses(formatHeatHypotheses(e.hypotheses)), e.hypotheses);
  assert.throws(() => parseHeatReadings('minute,temperature_c,half_width_c,use,source\n1,0x20,1,calibration,authored'), /decimal/);
  assert.throws(() => parseHeatReadings('minute,temperature_f,half_width_c,use,source\n1,50,1,calibration,authored'), /columns/);
  assert.throws(() => parseHeatReadings('minute,temperature_c,half_width_c,use,source\n1,25,1,calibration,"unterminated'), /unclosed/);
});
