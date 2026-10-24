import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, validateProject } from '../core.js';
import { prepareSurfaceHeatStudy, inspectSurfaceHeat, absorbedSurfaceHeatEnergy } from '../surface-heat.js';
import { prepareHeatEvidence, compareHeatEvidence, authoredHeatEvidenceExample, authoredHeatEnergyExample } from '../surface-heat-evidence.js';
import { HEAT_EVIDENCE_SCHEMA, HEAT_ENERGY_EVIDENCE_SCHEMA } from '../surface-heat-evidence-contract.js';
import { parseHeatEnergyReadings, formatHeatEnergyReadings } from '../surface-heat-evidence-table.js';
import { serializePortableProject, parsePortableProject } from '../project-portability.js';

const close = (a, b, relative = 1e-12) => assert.ok(Math.abs(a - b) <= relative * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function fixture(schedule = [
  { minutes: 60, incidentWm2: 600, reservoirC: 25, source: 'Authored heating' },
  { minutes: 180, incidentWm2: 0, reservoirC: 25, source: 'Authored darkness' },
]) {
  const p = makeExample(), a = { absorptivity: .4, capacityJm2K: 40000, exchangeWm2K: 10, initialC: 25, source: 'Authored layer' };
  p.surfaceHeatStudy = prepareSurfaceHeatStudy(p, { cellIndex: 0, existing: a, proposal: { ...a, absorptivity: .8, capacityJm2K: 80000, exchangeWm2K: 20 }, schedule });
  p.surfaceHeatEvidence = prepareHeatEvidence(p, authoredHeatEvidenceExample(p));
  return p;
}
function withEnergy(p, readings) {
  p.surfaceHeatEvidence = prepareHeatEvidence(p, { ...p.surfaceHeatEvidence, energyReadings: readings });
  return p;
}
const reading = (patch = {}) => ({ fromMinute: 0, toMinute: 60, energyJm2: 864000, halfWidthJm2: 20000,
  use: 'challenge', source: 'Authored absorbed-input arithmetic control; no measurement', ...patch });

test('absorbed-input integral crosses exposure boundaries and distinguishes equal temperatures', () => {
  const p = fixture([
    { minutes: 7.3, incidentWm2: 600, reservoirC: 25, source: 'First authored interval' },
    { minutes: 11.2, incidentWm2: 0, reservoirC: 5, source: 'Dark interval' },
    { minutes: 23.7, incidentWm2: 200, reservoirC: 30, source: 'Later authored interval' },
  ]);
  for (const minute of [0, 6.3, 7.3, 8, 18.5, 19.5, 42.2]) {
    const r = inspectSurfaceHeat(p.surfaceHeatStudy, minute); close(r.existing.temperatureC, r.proposal.temperatureC, 0);
  }
  // One minute at600 plus one at200, independently integrated by hand.
  close(absorbedSurfaceHeatEnergy(p.surfaceHeatStudy, 'existing', 6.3, 19.5), 19200);
  close(absorbedSurfaceHeatEnergy(p.surfaceHeatStudy, 'proposal', 6.3, 19.5), 38400);
  assert.equal(absorbedSurfaceHeatEnergy(p.surfaceHeatStudy, 'existing', 8, 18), 0);
  assert.equal(absorbedSurfaceHeatEnergy(p.surfaceHeatStudy, 'proposal', 8, 18), 0);
});

test('short late intervals are integrated locally without cumulative subtraction', () => {
  const p = fixture([
    { minutes: 720, incidentWm2: 600, reservoirC: 25, source: 'Long first interval' },
    { minutes: 720, incidentWm2: 600, reservoirC: 25, source: 'Long second interval' },
  ]);
  const from = 1439.99, to = from + 1e-9;
  const expected = .4 * 600 * ((to - from) * 60);
  assert.ok(expected > 0);
  close(absorbedSurfaceHeatEnergy(p.surfaceHeatStudy, 'existing', from, to), expected, 1e-15);
  for (const times of [[-1, 1], [1, 1], [2, 1], [0, 1441], [0, Infinity], ['0', 1]]) {
    assert.throws(() => absorbedSurfaceHeatEnergy(p.surfaceHeatStudy, 'existing', ...times), /interval/);
  }
});

test('sourced energy challenges break common-scale ambiguity without changing calibration', () => {
  const p = fixture(), original = compareHeatEvidence(p), raw = structuredClone(p.surfaceHeatEvidence);
  withEnergy(p, [reading()]); const result = compareHeatEvidence(p);
  assert.equal(result.status, 'one-survivor'); assert.deepEqual(result.survivingLabels, [raw.hypotheses[0].label]);
  assert.deepEqual(result.calibrationLabels, original.calibrationLabels);
  assert.deepEqual(result.candidates.map(c => c.calibration), original.candidates.map(c => c.calibration));
  assert.deepEqual(p.surfaceHeatEvidence.hypotheses, raw.hypotheses); assert.deepEqual(p.surfaceHeatEvidence.readings, raw.readings);
  assert.deepEqual(result.modalities, { temperature: 5, absorbedEnergy: 1 });
  const rows = result.candidates.map(c => c.challenge.rows.find(r => r.kind === 'absorbed-input'));
  assert.equal(rows[0].predictionJm2, 864000); assert.equal(rows[1].predictionJm2, 1728000);
  assert.equal(rows[0].withinBand, true); assert.equal(rows[1].withinBand, false);
});

test('schedule-boundary roundoff does not reject a dark zero-width energy control', () => {
  const p = fixture([
    ...Array.from({ length: 10 }, () => ({ minutes: .1, incidentWm2: 0, reservoirC: 25, source: 'Exact decimal dark interval' })),
    { minutes: .1, incidentWm2: 2000, reservoirC: 25, source: 'Bright interval after minute one' },
  ]);
  // Ten exact decimal0.1 intervals end at1; even their exact binary-input sum
  // lies above1. Naive sequential addition ends just below it instead.
  p.surfaceHeatEvidence.readings = [];
  withEnergy(p, [reading({ fromMinute: 1 - 1e-12, toMinute: 1, energyJm2: 0, halfWidthJm2: 0, use: 'calibration' })]);
  const r = compareHeatEvidence(p);
  assert.equal(r.status, 'needs-challenge'); assert.equal(r.calibrationLabels.length, 3);
  for (const candidate of r.candidates) {
    const row = candidate.calibration.rows[0]; assert.ok(Math.abs(row.residualJm2) <= row.arithmeticGuardJm2);
  }
});

test('declared precision and dark intervals preserve or reject exactly the offered candidates', () => {
  const p = withEnergy(fixture(), [reading({ energyJm2: 1296000, halfWidthJm2: 432000 })]);
  assert.equal(compareHeatEvidence(p).status, 'ambiguous');
  p.surfaceHeatEvidence.energyReadings[0].halfWidthJm2 = 431999;
  assert.equal(compareHeatEvidence(p).status, 'challenged');
  withEnergy(p, [reading({ fromMinute: 60, toMinute: 120, energyJm2: 0, halfWidthJm2: 0 })]);
  const dark = compareHeatEvidence(p); assert.equal(dark.status, 'ambiguous'); assert.equal(dark.survivingLabels.length, 2);
});

test('energy-only support cannot distinguish equal absorption or invent calibration', () => {
  const p = fixture(); p.surfaceHeatEvidence.readings = [];
  withEnergy(p, [reading({ use: 'calibration' })]);
  const result = compareHeatEvidence(p);
  assert.equal(result.status, 'needs-challenge'); assert.deepEqual(result.survivingLabels, [p.surfaceHeatEvidence.hypotheses[0].label, p.surfaceHeatEvidence.hypotheses[2].label]);
  p.surfaceHeatEvidence.energyReadings[0].use = 'challenge';
  assert.equal(compareHeatEvidence(p).status, 'need-calibration'); assert.deepEqual(compareHeatEvidence(p).survivingLabels, []);
});

test('challenge energy cannot rescue a candidate rejected by calibration energy', () => {
  const p = withEnergy(fixture(), [reading({ use: 'calibration' }), reading({ fromMinute: 0, toMinute: 120, energyJm2: 1728000 })]);
  const raw = JSON.stringify(p), result = compareHeatEvidence(p);
  assert.equal(result.status, 'challenged'); assert.deepEqual(result.survivingLabels, []);
  assert.equal(result.candidates[1].calibration.compatible, false);
  assert.equal(result.candidates[1].challenge.compatible, true);
  assert.equal(JSON.stringify(p), raw);
});

test('versioned input-only replay preserves both quantities and refuses mislabeled modality', () => {
  const old = fixture(), rawOld = JSON.stringify(old.surfaceHeatEvidence);
  assert.equal(old.surfaceHeatEvidence.schema, HEAT_EVIDENCE_SCHEMA);
  assert.equal(JSON.stringify(parsePortableProject(serializePortableProject(old)).surfaceHeatEvidence), rawOld);
  const p = withEnergy(fixture(), [reading()]); assert.equal(p.surfaceHeatEvidence.schema, HEAT_ENERGY_EVIDENCE_SCHEMA);
  const raw = serializePortableProject(p), reopened = parsePortableProject(raw);
  assert.deepEqual(reopened.surfaceHeatEvidence, p.surfaceHeatEvidence);
  reopened.surfaceHeatEvidence.result = { survivingLabels: ['invented'] };
  assert.deepEqual(compareHeatEvidence(reopened).survivingLabels, compareHeatEvidence(p).survivingLabels);
  for (const change of [e => e.schema = HEAT_EVIDENCE_SCHEMA, e => e.schema = 'experimental-earth-surface-heat-evidence/3',
    e => e.energyQuantity = 'incident', e => delete e.energyReadings]) {
    const invalid = structuredClone(p); change(invalid.surfaceHeatEvidence); assert.throws(() => validateProject(invalid));
  }
});

test('bounded source-bearing energy admission rejects holes, duplicate intervals and malformed values', () => {
  const changes = [r => r.fromMinute = -1, r => r.toMinute = 241, r => r.toMinute = r.fromMinute,
    r => r.energyJm2 = -1, r => r.energyJm2 = Infinity, r => r.halfWidthJm2 = NaN,
    r => r.halfWidthJm2 = -1, r => r.source = ' ', r => r.use = 'verified'];
  for (const change of changes) { const r = reading(); change(r); assert.throws(() => withEnergy(fixture(), [r])); }
  for (const rows of [[reading(), reading()], Array(1), Array.from({ length: 101 }, () => reading())]) {
    assert.throws(() => withEnergy(fixture(), rows));
  }
  assert.throws(() => withEnergy(fixture(), {}));
});

test('energy CSV retains exact literal sources and refuses incident-power or ambiguous numeric columns', () => {
  const rows = [reading({ source: 'Independent record, raw\n"quoted" <img src=x>' })];
  assert.deepEqual(parseHeatEnergyReadings(formatHeatEnergyReadings(rows)), rows);
  assert.deepEqual(parseHeatEnergyReadings(formatHeatEnergyReadings([])), []);
  assert.deepEqual(parseHeatEnergyReadings('  \n'), []);
  assert.throws(() => parseHeatEnergyReadings('from_minute,to_minute,incident_w_m2,half_width_j_m2,use,source\n0,60,600,1,challenge,raw'), /columns/);
  assert.throws(() => parseHeatEnergyReadings('from_minute,to_minute,absorbed_j_m2,half_width_j_m2,use,source\n0,60,0x20,1,challenge,raw'), /decimal/);
});

test('combined authored control remains explicitly synthetic and exposure-bound', () => {
  const p = fixture(), input = authoredHeatEnergyExample(p);
  assert.match(input.energyReadings[0].source, /not a measured, independent/);
  assert.throws(() => prepareHeatEvidence(p, { ...input, energyQuantity: 'incident' }), /cannot be relabeled/);
  assert.throws(() => prepareHeatEvidence(p, { ...input, energyQuantity: 'stored-heat' }), /cannot be relabeled/);
  p.surfaceHeatEvidence = prepareHeatEvidence(p, input); assert.equal(compareHeatEvidence(p).status, 'one-survivor');
  p.surfaceHeatStudy.schedule[0].incidentWm2 += 1; assert.equal(compareHeatEvidence(p).status, 'context-changed');
});
