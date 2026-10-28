import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeWeightedContinuousSky, integrateWeightedContinuousColumns as weighted,
  integrateContinuousColumns as uniform, compareWeightedContinuousSkyAt,
  compareContinuousSkyAt,
} from '../continuous-sky.js';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { prepareSolarStudy } from '../solar-occlusion.js';

const point = [0, 0, 0];
const east = { lo: [1, -1, -1], hi: [2, 1, 3], minTop: 1, maxTop: 3,
  cellIndex: 1, source: 'Authored rectangle', kind: 'declared column' };
const north = { lo: [-3, 2, -1], hi: [-1, 4, 5], minTop: 2, maxTop: 5,
  cellIndex: 2, source: 'Authored rectangle', kind: 'declared column' };
const close = (a, b, tolerance = 3e-14) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const input = azimuthWeights => ({ method: 'weighted-continuous-columns', azimuthWeights });
const rotate = c => ({ ...c, lo: [-c.hi[1], c.lo[0], c.lo[2]], hi: [-c.lo[1], c.hi[0], c.hi[2]] });

test('authored profiles are dense, finite, positive-mass declarations and reject numerical loss', () => {
  for (const weights of [Array(4), [], [1, 1], [0, 0, 0, 0], [1, -1, 0, 0],
    [1, NaN, 0, 0], [1, Infinity, 0, 0], ['1', 1, 0, 0], [Number.MIN_VALUE, Number.MAX_VALUE, 0, 0]])
    assert.throws(() => normalizeWeightedContinuousSky(input(weights)));
  for (const declaration of [null, {}, { method: 'continuous-columns', azimuthWeights: [1, 1, 1, 1] },
    { ...input([1, 1, 1, 1]), transmission: 1 }]) assert.throws(() => normalizeWeightedContinuousSky(declaration));
  const original = input([0, 1, 2, 3]), normalized = normalizeWeightedContinuousSky(original);
  assert.deepEqual(normalized, original); normalized.azimuthWeights[1] = 100;
  assert.equal(original.azimuthWeights[1], 1);
});

test('uniform 4/8/16-bin profiles preserve exact isotropic transmission at extreme finite scales', () => {
  for (const columns of [[], [east], [east, north]]) for (const topKey of ['minTop', 'maxTop']) {
    const prior = uniform(point, columns, topKey);
    for (const n of [4, 8, 16]) for (const scale of [Number.MIN_VALUE, 1, Number.MAX_VALUE]) {
      const result = weighted(point, columns, Array(n).fill(scale), topKey);
      assert.equal(result.transmission, prior.transmission);
      assert.equal(result.rawTransmission, prior.rawTransmission);
      assert.equal(result.angularSectors, prior.angularSectors);
      assert.equal(result.estimatedFaceTests, prior.estimatedFaceTests);
      assert.deepEqual(result.arcs.map(({ relativeRadianceWeight, weightedProjectedIntegral, ...arc }) => arc), prior.arcs);
    }
  }
});

test('authored brightness toward a finite wall agrees with an independent vertical-plane integral', () => {
  for (const height of [.01, .25, 1, 3, 50]) {
    const wall = { ...east, minTop: height, maxTop: height }, g = Math.hypot(1, height);
    const expected = 4 / Math.PI * Math.atan(1 / g) / g;
    close(weighted(point, [wall], [1, 0, 0, 0, 0, 0, 0, 1]).transmission, expected);
    close(weighted(point, [wall], [0, 1, 1, 1, 1, 1, 1, 0]).transmission, 1);
  }
  close(weighted(point, [east], [1, 0, 0, 0, 0, 0, 0, 1]).transmission, .12331758940595662);
});

test('nonuniform profiles preserve clear sky and positive scaling without sum overflow', () => {
  for (const n of [4, 8, 16]) {
    const weights = Array.from({ length: n }, (_, i) => i % 3 === 0 ? 0 : i + 1);
    const a = weighted(point, [east, north], weights);
    close(weighted(point, [], weights).transmission, 1);
    for (const factor of [1e-100, 7, 1e100])
      close(weighted(point, [east, north], weights.map(w => factor * w)).transmission, a.transmission);
    assert.ok(a.relativeWeightIntegral > 0 && Number.isFinite(a.relativeWeightIntegral));
    assert.ok(a.omittedNormalizedWeightMass >= 0);
  }
});

test('profile refinement and joint quarter-turn rotation preserve the authored integral', () => {
  const columns = [east, north], weights = [0, 2, 7, 1];
  const expected = weighted(point, columns, weights).transmission;
  let profile = weights;
  for (const n of [4, 8, 16]) {
    assert.equal(profile.length, n);
    close(weighted(point, columns, profile).transmission, expected);
    const shifted = profile.map((_, j) => profile[(j - n / 4 + n) % n]);
    close(weighted(point, columns.map(rotate), shifted).transmission, expected);
    profile = profile.flatMap(w => [w, w]);
  }
});

test('roof height and added opaque columns only reduce weighted transmission', () => {
  for (const n of [4, 8, 16]) {
    const weights = Array.from({ length: n }, (_, i) => i % 4);
    const high = weighted(point, [east, north], weights, 'maxTop');
    const low = weighted(point, [east, north], weights, 'minTop');
    assert.ok(high.transmission <= low.transmission);
    assert.ok(high.transmission <= weighted(point, [east], weights, 'maxTop').transmission);
    close(high.arcs.reduce((sum, arc) => sum + arc.weightedProjectedIntegral, 0) /
      high.relativeWeightIntegral, high.transmission);
    assert.ok(high.estimatedFaceTests >= uniform(point, [east, north]).estimatedFaceTests);
  }
});

test('a sector immediately below an authored bin edge retains the preceding weight', () => {
  const columns = [{ ...east, lo: [1, .4142135623730949, -1], hi: [2, .5142135623730949, 3] }];
  const result = weighted(point, columns, [1, ...Array(15).fill(0)]);
  const boundary = Math.PI / 8;
  const narrow = result.arcs.find(arc => arc.headingStartRad < boundary &&
    arc.headingEndRad === boundary && boundary - arc.headingStartRad < 1e-15);
  assert.ok(narrow); assert.equal(narrow.relativeRadianceWeight, 1);
  assert.equal(narrow.weightedProjectedIntegral, narrow.projectedIntegral);
  for (const arc of result.arcs) {
    assert.equal(arc.relativeRadianceWeight, arc.headingStartRad < boundary ? 1 : 0);
    assert.ok(!(arc.headingStartRad < boundary && arc.headingEndRad > boundary));
  }
});

test('weighted consumer geometry retains source binding, coherent roofs, and input isolation', () => {
  const { project } = makeShadeHeatExample();
  delete project.heatColumnStudy; delete project.surfaceHeatStudy; delete project.solarStudy;
  project.width = 3; project.height = 3; project.selectedIndex = 4; project.weather.cellSizeM = 2;
  project.existing = Array.from({ length: 9 }, () => ({ surface: 'sealed', elevationM: 0, provenance: 'Authored profile control' }));
  project.proposal = structuredClone(project.existing); project.observations = [];
  project.solarStudy = prepareSolarStudy(project, { headingDeg: 0, elevationDeg: 45,
    sunSource: 'Authored profile control', existing: [], proposal: [
      { cellIndex: 5, heightMinM: 1, heightMaxM: 3, source: 'Authored eastern column' },
    ] });
  const source = JSON.stringify(project), profile = input([1, 0, 0, 0, 0, 0, 0, 1]);
  const r = compareWeightedContinuousSkyAt(project, 4, profile);
  assert.equal(r.model.kind, 'experimental-earth/azimuth-weighted-continuous-column-sky/1');
  assert.deepEqual(r.existing.transmission, [1, 1]);
  close(r.proposal.transmission[0], weighted(point, [east], profile.azimuthWeights, 'maxTop').transmission);
  assert.ok(r.proposal.transmission[0] <= r.proposal.transmission[1]);
  const isotropic = compareContinuousSkyAt(project, 4);
  const matched = compareWeightedContinuousSkyAt(project, 4, input([1, 1, 1, 1]));
  assert.deepEqual(matched.proposal.transmission, isotropic.proposal.transmission);
  r.azimuthWeights[0] = 9; r.proposal.maximumRoofs.arcs[0].controller && (r.proposal.maximumRoofs.arcs[0].controller.source = 'Changed witness');
  assert.equal(JSON.stringify(project), source); assert.equal(profile.azimuthWeights[0], 1);
  const changed = structuredClone(project); changed.existing[0].provenance += ' changed';
  assert.deepEqual(compareWeightedContinuousSkyAt(changed, 4, profile), { status: 'context-changed' });
});
