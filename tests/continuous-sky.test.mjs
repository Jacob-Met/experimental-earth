import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { prepareSolarStudy, prepareSolarReceiverGeometryAt } from '../solar-occlusion.js';
import { compareDiffuseSkyAt } from '../diffuse-sky.js';
import { compareContinuousSkyAt, integrateContinuousColumns } from '../continuous-sky.js';

function flat(width = 5, height = width, side = 2) {
  const { project } = makeShadeHeatExample();
  delete project.heatColumnStudy; delete project.surfaceHeatStudy; delete project.solarStudy;
  project.width = width; project.height = height;
  project.selectedIndex = Math.floor(height / 2) * width + Math.floor(width / 2);
  project.weather.cellSizeM = side;
  project.existing = Array.from({ length: width * height }, () => ({ surface: 'sealed', elevationM: 0, provenance: 'Authored continuous-sky control' }));
  project.proposal = structuredClone(project.existing); project.observations = [];
  project.solarStudy = prepareSolarStudy(project, { headingDeg: 0, elevationDeg: 45, sunSource: 'Authored control', existing: [], proposal: [] });
  return project;
}
const feature = (cellIndex, low, high = low) => ({ cellIndex, heightMinM: low, heightMaxM: high, source: 'Declared finite control wall' });
function wall(low, high = low) {
  const p = flat();
  p.solarStudy.proposal = [3, 8, 13, 18, 23].map(i => feature(i, low, high));
  return p;
}
function close(actual, expected, tolerance = 2e-14) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

test('continuous finite wall agrees with an independent vertical-plane integral', () => {
  for (const height of [.01, .25, 1, 2, 6, 100]) {
    const p = wall(height), source = JSON.stringify(p), report = compareContinuousSkyAt(p, 12);
    const distance = 1, halfWidth = 5, alpha = Math.atan(halfWidth / distance), scale = Math.hypot(distance, height);
    const expected = 1 - (alpha - distance / scale * Math.atan(distance * Math.tan(alpha) / scale)) / Math.PI;
    close(report.proposal.transmission[0], expected);
    assert.deepEqual(report.proposal.transmission, [report.proposal.transmission[0], report.proposal.transmission[0]]);
    assert.deepEqual(report.existing.transmission, [1, 1]);
    assert.equal(JSON.stringify(p), source);
  }
});

test('a finite surrounding square retains its positive zenith region even when midpoint samples miss it', () => {
  const p = flat(3), centre = 4, height = 50;
  p.solarStudy.proposal = Array.from({ length: 9 }, (_, i) => i).filter(i => i !== centre).map(i => feature(i, height));
  const sampled = compareDiffuseSkyAt(p, centre), continuous = compareContinuousSkyAt(p, centre);
  const g = Math.hypot(1, height), expected = 4 / Math.PI * Math.atan(1 / g) / g;
  assert.deepEqual(sampled.proposal.transmission, [0, 0]);
  assert.ok(continuous.proposal.transmission[0] > 0);
  close(continuous.proposal.transmission[0], expected);
});

test('declared minimum and maximum roofs enclose the tested coherent exact-height geometries', () => {
  const report = compareContinuousSkyAt(wall(.5, 4), 12);
  close(report.proposal.transmission[0], compareContinuousSkyAt(wall(4), 12).proposal.transmission[0]);
  close(report.proposal.transmission[1], compareContinuousSkyAt(wall(.5), 12).proposal.transmission[1]);
  for (const height of [.5, .7, 1.4, 2.1, 4]) {
    const t = compareContinuousSkyAt(wall(height), 12).proposal.transmission[0];
    assert.ok(t >= report.proposal.transmission[0] && t <= report.proposal.transmission[1]);
  }
});

test('shared receiver geometry preserves source binding, footprints and frozen-input isolation', () => {
  const p = freeze(wall(2)), before = structuredClone(p);
  const geometry = prepareSolarReceiverGeometryAt(p, 12);
  geometry.proposal.columns[0].hi[2] = 999;
  const r = compareContinuousSkyAt(p, 12);
  const witness = r.proposal.maximumRoofs.arcs.find(arc => arc.controller)?.controller;
  assert.ok(witness); witness.source = 'Returned witness edit';
  assert.deepEqual(p, before);
  const changed = structuredClone(p); changed.existing[0].provenance += ' altered';
  assert.deepEqual(compareContinuousSkyAt(changed, 12), { status: 'context-changed' });
  const missing = structuredClone(p); delete missing.solarStudy;
  assert.deepEqual(compareContinuousSkyAt(missing, 12), { status: 'no-study' });
  const footprint = structuredClone(p); footprint.solarStudy.proposal.push(feature(12, 1));
  assert.throws(() => compareContinuousSkyAt(footprint, 12), /footprint/);
  assert.throws(() => compareContinuousSkyAt(p, -1));
});

test('bounded continuous kernel refuses sparse and unsupported geometry instead of returning clear sky', () => {
  const c = { lo: [1, -1, -1], hi: [2, 1, 0], minTop: 2, maxTop: 2, cellIndex: 1, source: 'Test wall', kind: 'declared column' };
  for (const [point, columns] of [
    [new Array(3), []], [[0, 0, 0], new Array(1)],
    [[0, 0, 0], [{ ...c, lo: new Array(3) }]],
    [[0, 0, 0], [{ ...c, hi: new Array(3) }]],
    [[0, 0, 0], [{ ...c, maxTop: NaN }]],
    [[0, 0, 0], [{ ...c, lo: [-1, -1, -1] }]],
    [[0, 0, 0], Array.from({ length: 576 }, () => c)],
  ]) assert.throws(() => integrateContinuousColumns(point, columns));
});

test('full admitted grids and nonbinary cell scales retain complete angular coverage and bounded work', () => {
  for (const side of [.25, .3, 2, 100]) {
    const p = flat(24, 24, side), cell = p.selectedIndex;
    p.existing.forEach((c, i) => { c.elevationM = i === cell ? -9.5 : ((i * 17) % 160) / 8 - 10; });
    p.proposal = structuredClone(p.existing);
    p.solarStudy = prepareSolarStudy(p, { ...p.solarStudy, proposal: [feature(0, 30, 100), feature(575, .5, 12)] });
    const r = compareContinuousSkyAt(p, cell);
    assert.ok(r.estimatedFaceTests <= 16000000);
    for (const target of ['existing', 'proposal']) for (const roofs of ['minimumRoofs', 'maximumRoofs']) {
      const q = r[target][roofs];
      assert.ok(q.transmission > 0 && q.transmission <= 1);
      close(q.arcs.reduce((sum, arc) => sum + arc.headingEndDeg - arc.headingStartDeg, 0), 360, 2e-11);
      assert.ok(q.arcs.every(arc => arc.headingEndRad > arc.headingStartRad && arc.angularWidthRad > 0));
      assert.ok(q.omittedAngularWidthRad >= 0 && q.omittedAngularWidthRad < 1e-12);
    }
    assert.ok(r.proposal.transmission[0] <= r.proposal.transmission[1]);
  }
});
