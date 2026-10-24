import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceHeatColumn } from '../heat-column-step.js';
import { makeExample, validateProject } from '../core.js';
import { prepareSurfaceHeatStudy, advanceSurfaceHeat } from '../surface-heat.js';
import { prepareHeatColumnStudy, compareHeatColumn, inspectHeatColumn } from '../heat-column.js';
import { serializePortableProject, parsePortableProject } from '../project-portability.js';

const surface = { absorptivity: .8, capacityJm2K: 20000, exchangeWm2K: 10, initialC: 20, source: 'Authored independent heat control' };
const lower = { capacityJm2K: 80000, conductanceWm2K: 20, initialC: 20, source: 'Authored lower heat store, not a measured depth' };
const light = { minutes: 60, incidentWm2: 700, reservoirC: 20, source: 'Authored constant pulse' };
const dark = { minutes: 360, incidentWm2: 0, reservoirC: 20, source: 'Authored dark interval' };
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, a + ' differs from ' + b);
function project() {
  const p = makeExample();
  p.surfaceHeatStudy = prepareSurfaceHeatStudy(p, { cellIndex: 0, existing: surface, proposal: surface, schedule: [light, dark] });
  p.heatColumnStudy = prepareHeatColumnStudy(p, { existing: lower, proposal: { ...lower, conductanceWm2K: 0 } });
  return p;
}

test('independent augmented matrix-exponential pulse and delayed interior peak', () => {
  const pulse = advanceHeatColumn(surface, lower, light, { surfaceC: 20, subsurfaceC: 20 }, 3600);
  close(pulse.surfaceC, 44.53099896635505); close(pulse.subsurfaceC, 31.201606805625975);
  const cool = advanceHeatColumn(surface, lower, dark, pulse, 21600);
  close(cool.subsurfaceC, 22.755213296347225);
  assert.equal(cool.stationarySeconds.subsurface.length, 1);
  close(cool.stationarySeconds.subsurface[0], 901.7109966239643, 1e-6);
  const peak = advanceHeatColumn(surface, lower, dark, pulse, cool.stationarySeconds.subsurface[0]);
  close(peak.subsurfaceC, 32.33238368285359); close(peak.surfaceC, peak.subsurfaceC);
  assert.ok(peak.subsurfaceC > pulse.subsurfaceC && peak.subsurfaceC > cool.subsurfaceC);
  for (const value of [pulse, cool, peak]) {
    close(value.balanceResidualJm2, 0, 1e-5); close(value.surfaceBalanceResidualJm2, 0, 1e-5); close(value.subsurfaceBalanceResidualJm2, 0, 1e-5);
  }
});

test('unequal insulated stores agree with independent weighted-equilibrium decay', () => {
  for (const [c1, c2] of [[1000, 1e7], [1e7, 1000], [20000, 80000]]) {
    const g = 13, seconds = 1700, first = 90, second = 10;
    const got = advanceHeatColumn({ ...surface, capacityJm2K: c1, exchangeWm2K: 0 }, { ...lower, capacityJm2K: c2, conductanceWm2K: g },
      { ...dark, reservoirC: -20 }, { surfaceC: first, subsurfaceC: second }, seconds);
    const mean = (c1 * first + c2 * second) / (c1 + c2), delta = (first - second) * Math.exp(-g * (1 / c1 + 1 / c2) * seconds);
    close(got.surfaceC, mean + c2 / (c1 + c2) * delta); close(got.subsurfaceC, mean - c1 / (c1 + c2) * delta);
    close(got.exchangeOutJm2, 0); close(got.totalStoredJm2, 0, 1e-5);
  }
});

test('zero conductance preserves maintained surface law and independent lower temperature', () => {
  for (const exchangeWm2K of [0, 1e-12, 10, 1000]) {
    const top = { ...surface, exchangeWm2K }, row = { ...light, reservoirC: 35 };
    const two = advanceHeatColumn(top, { ...lower, conductanceWm2K: 0 }, row, { surfaceC: 20, subsurfaceC: -40 }, 100);
    const one = advanceSurfaceHeat(top, row, 20, 100);
    assert.equal(two.surfaceC, one.temperatureC); assert.equal(two.exchangeOutJm2, one.exchangedJm2);
    assert.equal(two.subsurfaceC, -40); assert.equal(two.transferDownJm2, 0);
  }
});

test('signed transfer and ambient supply remain distinct from absorbed input', () => {
  const got = advanceHeatColumn(surface, lower, { ...dark, reservoirC: 50 }, { surfaceC: 20, subsurfaceC: 40 }, 120);
  assert.equal(got.inputJm2, 0); assert.ok(got.exchangeOutJm2 < 0); assert.ok(got.transferDownJm2 < 0);
  close(got.balanceResidualJm2, 0, 1e-6);
  const tiny = advanceHeatColumn(surface, lower, light, { surfaceC: 20, subsurfaceC: 20 }, .001);
  close(tiny.transferDownJm2, 2.8e-7, 1e-12);
  assert.throws(() => advanceHeatColumn(surface, { ...lower, capacityJm2K: 0 }, light, got, 1), /supported finite/);
});

test('whole exposure includes the delayed depth maximum and returns energy at selected time', () => {
  const p = project(), r = compareHeatColumn(p);
  assert.equal(r.status, 'compared'); close(r.summary.existing.subsurface.maximumMinute, 75.0285166103994, 1e-6);
  close(r.summary.existing.subsurface.maximumC, 32.33238368285359);
  assert.ok(r.trajectory.some(row => row.minute === r.summary.existing.subsurface.maximumMinute));
  close(inspectHeatColumn(p.heatColumnStudy, 60).existing.surfaceC, 44.53099896635505);
  assert.equal(r.summary.proposal.subsurface.minimumC, 20); assert.equal(r.summary.proposal.subsurface.maximumC, 20);
  assert.equal(r.uniform.status, 'available'); close(r.trajectory.find(row => row.minute === 60).uniformExistingC, 66.74326225959115);
});

test('raw project replay recomputes while changed exposure refuses reassociation', () => {
  const p = project(), before = structuredClone(p), reopened = parsePortableProject(serializePortableProject(p));
  reopened.heatColumnStudy.report = { maximumC: -999 };
  assert.deepEqual(compareHeatColumn(reopened), compareHeatColumn(p)); assert.deepEqual(p, before);
  reopened.surfaceHeatStudy.schedule[0].incidentWm2 += 1;
  assert.equal(compareHeatColumn(reopened).status, 'context-changed');
  assert.throws(() => prepareHeatColumnStudy(reopened, p.heatColumnStudy.lowerLayers), /another heat declaration/);
  const invalid = structuredClone(p); invalid.heatColumnStudy.lowerLayers.existing.source = '';
  assert.throws(() => validateProject(invalid), /source/);
  assert.throws(() => inspectHeatColumn(p.heatColumnStudy, -1), /within/);
});
