import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEpochSkyExample } from '../shade-heat-epoch-example.js';
import { prepareEpochSkySource, prepareEpochSkyEvidence, parseEpochSkyEvidence, EPOCH_SKY_LIMITS } from '../shade-heat-epoch-evidence.js';
import { prepareSpatialProfileEvidence } from '../shade-heat-spatial-evidence.js';
import { intersectTwoRationalProfileBands } from '../shade-heat-profile-two-bands.js';
import { rational as q, add, sub, mul, cmp } from '../vendor/chronos/exact-halfplanes.mjs';
import { sampleShadeHeatForcing } from '../shade-heat.js';
import { evaluateHeatColumnTarget } from '../heat-column.js';
import { prepareSolarStudy } from '../solar-occlusion.js';

const raw = makeEpochSkyExample(), originalText = JSON.stringify(raw);
const reference = parseEpochSkyEvidence(originalText);
const targets = ['existing', 'proposal'], bounds = ['lower', 'upper'], stores = ['surfaceC', 'subsurfaceC'];
const exact = value => [BigInt(value.exact.numerator), BigInt(value.exact.denominator)];
const sum = values => values.reduce(add, q(0));
const dot = (weights, values) => sum(weights.map((weight, i) => mul(weight, values[i])));

function fullOriginalPair(source, split, early, late) {
  // Independent replay: two complete maintained weighted-sky samplings, then
  // original interval irradiances and the unchanged thermal solver. No new adapter.
  const phases = [early, late].map(bin => sampleShadeHeatForcing(source.project, { ...source.declaration,
    diffuseSky: { method: 'weighted-continuous-columns', azimuthWeights: [0, 1, 2, 3].map(i => Number(i === bin)) } }));
  return Object.fromEntries(targets.map(target => [target, Object.fromEntries(bounds.map(bound => {
    const study = structuredClone(source.project.heatColumnStudy);
    study.heatStudy.schedule = phases[0].intervals.map((_row, index) => {
      const row = phases[index < split ? 0 : 1].intervals[index];
      return { minutes: row.toMinute - row.fromMinute, incidentWm2: row[target].irradiance[bound],
        reservoirC: row.weather.reservoirC, source: 'Independent original full weighted-sky replay' };
    });
    return [bound, evaluateHeatColumnTarget(study, target).summary.final];
  }))]));
}

test('the changing-sky source admits both bands that both static comparisons reject', () => {
  const r = reference.report;
  assert.equal(r.compatibility, 'compatible');
  assert.equal(r.originalStatic.compatibility, 'incompatible'); assert.equal(r.additiveStatic.compatibility, 'incompatible');
  assert.equal(r.staticCompatibilityAgrees, true); assert.equal(r.work.profileIntersection.candidates, 308);
  assert.equal(r.work.geometryPasses, 2); assert.equal(r.work.executedBasisCourses, 128);
  assert.equal(r.work.executedThermalCourses, 144); assert.equal(r.splitUtc, '2026-06-21T08:00:00.000Z');
  assert.equal(r.finalUtc, raw.readings[0].query.reading.utc);
  assert.ok(r.ranges.surfaceC.lower.differenceC.lower > 1.636 && r.ranges.surfaceC.upper.differenceC.upper < 1.641);
  assert.ok(r.ranges.subsurfaceC.lower.differenceC.lower > 1.14 && r.ranges.subsurfaceC.upper.differenceC.upper < 1.157);
  assert.deepEqual(r.witnesses.map(w => w.id), [4, 52]);
  assert.deepEqual(raw, makeEpochSkyExample());
});

test('exact epoch marginals reproduce every joint objective from independently reconstructed coefficients', () => {
  for (const witness of reference.report.witnesses) {
    const phases = witness.phaseProfiles.map(row => row.map(exact)), weights = witness.masses.map(exact);
    phases.forEach(row => assert.equal(cmp(sum(row), q(1)), 0)); assert.equal(cmp(sum(weights), q(1)), 0);
    const product = Array.from({ length: 16 }, (_, i) => mul(phases[0][Math.floor(i / 4)], phases[1][i % 4]));
    for (const [pointIndex, evidence] of reference.report.numericalEvidence.points.entries()) {
      for (const target of targets) for (const bound of bounds) for (const store of stores) {
        const original = evidence.pairs.map(pair => q(pair.originalFinalC[target][bound][store]));
        const coefficients = original.map((_value, i) => sub(add(original[Math.floor(i / 4) * 4], original[i % 4]), original[0]));
        const value = dot(weights, coefficients); assert.equal(cmp(value, dot(product, coefficients)), 0);
        if (pointIndex === 0) assert.equal(cmp(value, exact(witness.finalC[target][bound][store])), 0);
        if (target === 'existing' && bound === 'lower' && store === 'surfaceC') {
          assert.equal(cmp(value, exact(witness.observedC[pointIndex])), 0);
          const r = raw.readings[pointIndex].query.reading;
          assert.ok(cmp(value, sub(q(r.temperatureC), q(r.halfWidthC))) >= 0);
          assert.ok(cmp(value, add(q(r.temperatureC), q(r.halfWidthC))) <= 0);
        }
      }
    }
  }
});

test('original floating replay discrepancies and outside-band endpoints remain explicit', () => {
  assert.ok(reference.report.numericalEvidence.points.some(point => point.nonzeroDiscrepancies > 0));
  assert.ok(reference.report.witnesses.some(w => w.originalReplays.some(r =>
    Object.values(r.originalObservationEndpointStatus).includes('outside-original-band'))));
  for (const witness of reference.report.witnesses) {
    assert.ok(witness.maximumReplayResidualC.upper > 0 && witness.maximumReplayResidualC.upper < 2e-13);
    witness.approximateProfiles.forEach(p => assert.ok(Math.abs(p.weights.reduce((a,b) => a+b, 0) - 1) < 3e-16));
    for (const [i, replay] of witness.originalReplays.entries()) for (const bound of bounds) {
      const reading = raw.readings[i].query.reading, value = q(replay.originalFinalC.existing[bound].surfaceC);
      const within = cmp(value, sub(q(reading.temperatureC), q(reading.halfWidthC))) >= 0
        && cmp(value, add(q(reading.temperatureC), q(reading.halfWidthC))) <= 0;
      assert.equal(replay.originalObservationEndpointStatus[bound], within ? 'within-original-band' : 'outside-original-band');
    }
  }
});

test('the original static comparison exactly matches the maintained static consumer on the same four bins', () => {
  const input = makeEpochSkyExample(); input.readings.forEach(r => { r.query.reading.halfWidthC = 4; });
  const epoch = prepareEpochSkyEvidence(input.readings, input.query);
  const baseline = prepareSpatialProfileEvidence(input.readings, { bins: 4, sharingSource: input.query.sharingSource });
  assert.equal(epoch.report.originalStatic.compatibility, baseline.report.compatibility);
  assert.deepEqual(epoch.report.originalStatic.ranges, baseline.report.ranges);
  assert.deepEqual(epoch.report.originalStatic.work, baseline.report.work.profileIntersection);
});

test('held-back splits, direct forcing and proposal roof intervals match independent complete original courses', () => {
  for (const [split, direct, early, late, roofs] of [[3, 0, 1, 3, false], [13, 150, 2, 0, false],
    [3, 150, 3, 1, true], [13, 0, 0, 2, true]]) {
    const input = makeEpochSkyExample(); input.query.splitAfterInterval = split;
    for (const reading of input.readings) {
      reading.source.declaration.directNormalWm2 = direct;
      if (roofs) { const p = reading.source.project; p.solarStudy = prepareSolarStudy(p, { ...p.solarStudy,
        proposal: p.solarStudy.proposal.map(column => ({ ...column, heightMinM: 2.5, heightMaxM: 4.5 })) }); }
      const original = fullOriginalPair(reading.source, split, early, late);
      reading.query.reading.temperatureC = original.existing.lower.surfaceC; reading.query.reading.halfWidthC = .001;
    }
    const { report } = prepareEpochSkyEvidence(input.readings, input.query);
    assert.equal(report.compatibility, 'compatible'); assert.equal(report.work.executedBasisCourses, 128);
    for (const [i, inputReading] of input.readings.entries()) {
      const original = fullOriginalPair(inputReading.source, split, early, late);
      const retained = report.numericalEvidence.points[i].pairs[early * 4 + late].originalFinalC;
      for (const target of targets) for (const bound of bounds) for (const store of stores)
        assert.equal(retained[target][bound][store], original[target][bound][store]);
      assert.ok(report.numericalEvidence.points[i].maximumAdditivePairDiscrepancyC.upper < 3e-13);
    }
  }
});

test('source-only reopening retains both complete originals and original bin histories without mutation', () => {
  const input = makeEpochSkyExample(); input.readings[0].query.bins = 4; input.readings[1].query.bins = 16;
  const before = JSON.stringify(input), result = prepareEpochSkyEvidence(input.readings, input.query);
  assert.equal(JSON.stringify(input), before); assert.deepEqual(result.investigation, input);
  assert.deepEqual(parseEpochSkyEvidence(JSON.stringify(result.investigation)), result);
  const reversed = prepareEpochSkyEvidence([...input.readings].reverse(), input.query);
  assert.equal(reversed.report.cellIndex, 7); assert.deepEqual(reversed.investigation.readings, [...input.readings].reverse());
  assert.deepEqual(reversed.report.readings.map(r => r.originalBins), [16, 4]);
  input.readings[0].query.reading.temperatureC = 0; assert.deepEqual(makeEpochSkyExample(), raw);
});

test('incompatible readings complete all original pair courses while unresolved observation endpoints refuse', () => {
  const impossible = makeEpochSkyExample(); impossible.readings[1].query.reading.temperatureC = 50;
  const empty = prepareEpochSkyEvidence(impossible.readings, impossible.query);
  assert.equal(empty.report.compatibility, 'incompatible'); assert.equal(empty.report.ranges, null);
  assert.deepEqual(empty.report.witnesses, []); assert.equal(empty.report.work.executedBasisCourses, 128);
  assert.equal(empty.report.work.executedWitnessCourses, 0); assert.deepEqual(empty.investigation, impossible);
  for (const reading of impossible.readings) { const p = reading.source.project;
    p.solarStudy = prepareSolarStudy(p, { ...p.solarStudy,
      existing: p.solarStudy.existing.map(c => ({ ...c, heightMinM: 2, heightMaxM: 4 })) }); }
  assert.throws(() => prepareEpochSkyEvidence(impossible.readings, impossible.query), /unresolved existing observation/);
});

test('derived results, wrong model, distinct forcing and invented split boundaries cannot enter source admission', () => {
  for (const [mutate, reason] of [
    [r => { r.report = {}; }, /saved results/], [r => { r.model.version = 2; }, /Unsupported/],
    [r => { r.query.splitAfterInterval = 1.5; }, /integer original/],
    [r => { r.query.splitAfterInterval = 0; }, /integer original/],
    [r => { r.query.splitAfterInterval = 16; }, /original interval boundary/],
    [r => { r.query.bins = 8; }, /four common bins/], [r => { r.query.sharingSource = ' '; }, /shared conditions/],
    [r => { r.readings[1] = r.readings[0]; }, /distinct original receiver/],
    [r => { r.readings[1].source.declaration.path.gridColumnBearingDeg += 1; }, /agree exactly/],
    [r => { r.readings[1].query.reading.target = 'proposal'; }, /original existing/],
    [r => { r.readings.forEach(p => { p.source.declaration.path.stepMinutes = 5; }); }, /at most 24 intervals/],
  ]) { const input = makeEpochSkyExample(); mutate(input); assert.throws(() => parseEpochSkyEvidence(JSON.stringify(input)), reason); }
  assert.equal(reference.report.work.basisCourses, EPOCH_SKY_LIMITS.maxBasisCourses);
  assert.equal(reference.report.work.reservedWitnessCourses, EPOCH_SKY_LIMITS.maxWitnessCourses);
  assert.equal(reference.report.work.courseIntervals, 2560);
  assert.throws(() => prepareEpochSkySource(raw.readings, { ...raw.query, splitUtc: reference.report.splitUtc }), /four common bins/);
});

test('the rational solver retains nonbinary coefficients and refuses malformed or over-capacity fractions', () => {
  const result = intersectTwoRationalProfileBands([[[0n,1n],[1n,3n],[0n,1n]], [[0n,1n],[0n,1n],[1n,5n]]],
    [{temperatureC:.125,halfWidthC:0},{temperatureC:.0625,halfWidthC:0}]);
  assert.equal(result.candidates.length, 1); assert.deepEqual(result.candidates[0].weights, [[5n,16n],[3n,8n],[5n,16n]]);
  for (const invalid of [[1n,0n], [1n,-1n], [1n], [1,3], [1n,1n << 4096n], [1n << 4096n,1n]]) {
    assert.throws(() => intersectTwoRationalProfileBands([[invalid,[0n,1n]], [[0n,1n],[1n,1n]]],
      [{temperatureC:0,halfWidthC:1},{temperatureC:0,halfWidthC:1}]), /bounded exact rational/);
  }
});
