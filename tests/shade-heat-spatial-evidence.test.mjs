import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { intersectTwoProfileBands } from '../shade-heat-profile-two-bands.js';
import { prepareSpatialProfileEvidence, prepareSpatialProfileEvidenceSource,
  parseSpatialProfileEvidence, parseSpatialOriginalReading } from '../shade-heat-spatial-evidence.js';
import { profileFraction } from '../shade-heat-profile-band.js';
import { compareShadeHeat } from '../shade-heat.js';
import { prepareSolarStudy } from '../solar-occlusion.js';

const originalText = await readFile(new URL('../examples/shared-sky-two-points.json', import.meta.url), 'utf8');
const original = JSON.parse(originalText), reference = parseSpatialProfileEvidence(originalText);
const band = (temperatureC, halfWidthC = 0) => ({ temperatureC, halfWidthC });

test('two exact bands can require a three-bin vertex while excluding every one- and two-bin profile', () => {
  const family = intersectTwoProfileBands([[0, 1, 0], [0, 0, 1]], [band(.25), band(.25)]);
  assert.equal(family.status, 'compatible'); assert.equal(family.candidates.length, 1);
  assert.deepEqual(family.candidates[0].support, [0, 1, 2]);
  assert.deepEqual(family.candidates[0].weights.map(value => profileFraction(value).exact), [
    { numerator: '1', denominator: '2' }, { numerator: '1', denominator: '4' }, { numerator: '1', denominator: '4' },
  ]);
  assert.equal(family.work.admittedOriginalVertices, 0); assert.equal(family.work.admittedPairVertices, 0);
});

test('dependent, constant, impossible and broad observations retain exact lower-dimensional behavior', () => {
  const constant = intersectTwoProfileBands([[2, 2, 2], [3, 3, 3]], [band(2), band(3)]);
  assert.deepEqual(constant.candidates.map(value => value.support), [[0], [1], [2]]);
  const dependent = intersectTwoProfileBands([[0, 1, 2], [0, 2, 4]], [band(1), band(2)]);
  assert.deepEqual(dependent.candidates.map(value => value.support), [[1], [0, 2]]);
  const impossible = intersectTwoProfileBands([[0, 1, 2], [0, 1, 2]], [band(.25), band(.75)]);
  assert.equal(impossible.status, 'incompatible'); assert.deepEqual(impossible.candidates, []);
  const broad = intersectTwoProfileBands([[0, 1, 2], [2, 1, 0]], [band(1, 2), band(1, 2)]);
  assert.equal(broad.candidates.length, 3); assert.equal(broad.work.admittedTriangleVertices, 0);
  assert.throws(() => intersectTwoProfileBands([[0, , 1], [0, 1, 2]], [band(0), band(0)]), /complete finite/);
});

test('both complete original bases narrow same-profile consequences without mutating inputs', () => {
  const raw = structuredClone(original), before = JSON.stringify(raw);
  const prepared = prepareSpatialProfileEvidence(raw.readings, raw.query), r = prepared.report;
  assert.equal(JSON.stringify(raw), before); assert.deepEqual(prepared.investigation, original);
  assert.equal(r.work.executedThermalCourses, 64); assert.equal(r.work.profileIntersection.candidates, 64);
  assert.equal(r.work.profileIntersection.admittedTriangleVertices, 64);
  assert.ok(r.firstReadingOnly.ranges.surfaceC.lower.differenceC.lower < 0);
  assert.ok(r.ranges.surfaceC.lower.differenceC.lower > .98);
  assert.ok(r.witnesses.every(w => w.support.length === 3 && w.observedC.length === 2));
  assert.ok(r.witnesses.some(w => w.id >= r.witnesses.length));
  assert.deepEqual(parseSpatialProfileEvidence(JSON.stringify(prepared.investigation)), prepared);
});

test('extremal mixtures replay both original complete thermal models at their own receivers', () => {
  for (const witness of reference.report.witnesses) for (let i = 0; i < 2; i++) {
    const source = reference.investigation.readings[i].source;
    const replay = compareShadeHeat(source.project, { ...source.declaration,
      diffuseSky: { method: 'weighted-continuous-columns', azimuthWeights: witness.weights.map(w => w.lower) } });
    assert.ok(Math.abs(replay.summary.existing.final.lower.surfaceC - witness.observedC[i].lower) < 2e-12);
    if (i === 0) for (const target of ['existing', 'proposal']) for (const store of ['surfaceC', 'subsurfaceC'])
      for (const bound of ['lower', 'upper']) assert.ok(Math.abs(replay.summary[target].final[bound][store]
        - witness.targets[target][bound][store][bound]) < 2e-12);
  }
});

test('original bins, per-point thermal declarations and original source records survive a different common query', () => {
  const raw = structuredClone(original); raw.readings[0].query.bins = 4; raw.readings[1].query.bins = 16;
  const result = prepareSpatialProfileEvidence(raw.readings, raw.query);
  assert.deepEqual(result.investigation.readings, raw.readings);
  assert.deepEqual(result.report.readings.map(r => r.originalBins), [4, 16]);
  assert.deepEqual(result.report.ranges, reference.report.ranges);
  assert.deepEqual(parseSpatialOriginalReading(JSON.stringify(raw.readings[1])), raw.readings[1]);
  const reversed = prepareSpatialProfileEvidence([...raw.readings].reverse(), raw.query);
  assert.equal(reversed.report.cellIndex, raw.readings[1].query.reading.cellIndex);
  assert.deepEqual(reversed.investigation.readings[0], raw.readings[1]);
  assert.throws(() => parseSpatialOriginalReading('{'), /Invalid original/);
});

test('independently valid different forcing, duplicate receivers and forged results refuse the complete join', () => {
  for (const [mutate, reason] of [
    [raw => { raw.report = {}; }, /saved results/],
    [raw => { raw.readings[1].report = {}; }, /derived results/],
    [raw => { raw.readings[1].source.declaration.path.gridColumnBearingDeg += 10; }, /agree exactly/],
    [raw => { raw.readings[1].source.declaration.diffuseHorizontalWm2 += 1; }, /agree exactly/],
    [raw => { raw.readings[1] = raw.readings[0]; }, /distinct original/],
    [raw => { raw.readings[1].query.reading.cellIndex = 5; }, /saved receiver/],
    [raw => { raw.query.sharingSource = ' '; }, /Declare why/],
  ]) { const raw = structuredClone(original); mutate(raw); assert.throws(() => parseSpatialProfileEvidence(JSON.stringify(raw)), reason); }
});

test('incompatible bands complete both bases, while unresolved observation endpoints refuse', () => {
  const raw = structuredClone(original); raw.readings[1].query.reading.temperatureC = 50;
  const empty = parseSpatialProfileEvidence(JSON.stringify(raw));
  assert.equal(empty.report.compatibility, 'incompatible'); assert.equal(empty.report.ranges, null);
  assert.deepEqual(empty.report.witnesses, []); assert.equal(empty.report.work.executedThermalCourses, 64);
  assert.deepEqual(empty.investigation, raw);
  const uncertain = structuredClone(original);
  for (const original of uncertain.readings) { const p = original.source.project;
    p.solarStudy = prepareSolarStudy(p, { ...p.solarStudy, existing: p.solarStudy.existing.map(c => ({ ...c, heightMinM: 2, heightMaxM: 4 })) }); }
  assert.throws(() => prepareSpatialProfileEvidence(uncertain.readings, uncertain.query), /unresolved existing observation/);
});

test('source admission retains the parent course limit and accounts for both complete originals', () => {
  const raw = structuredClone(original); raw.query.bins = 16;
  raw.readings.forEach(r => { r.source.declaration.path.stepMinutes = 5; });
  assert.throws(() => prepareSpatialProfileEvidenceSource(raw.readings, raw.query), /at most 24 intervals/);
  assert.equal(reference.report.work.thermalCourses, 64);
  assert.equal(reference.report.work.courseIntervals, 1024);
  assert.equal(reference.report.work.sources.length, 2);
  const malformed = structuredClone(original); malformed.readings[0].model.version = 2;
  assert.throws(() => parseSpatialProfileEvidence(JSON.stringify(malformed)), /unknown reading models/);
});
