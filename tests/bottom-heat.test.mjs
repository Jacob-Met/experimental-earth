import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceHeatColumn, advanceHeatColumnWithBottom } from '../heat-column-step.js';
import { makeExample } from '../core.js';
import { prepareSurfaceHeatStudy, advanceSurfaceHeat } from '../surface-heat.js';
import { prepareHeatColumnStudy } from '../heat-column.js';
import { prepareBottomHeatStudy, canonicalBottomHeatStudy, compareBottomHeatStudy,
  inspectBottomHeatStudy, validateBottomHeatStudy } from '../bottom-heat-study.js';

const surface = { absorptivity: .8, capacityJm2K: 20000, exchangeWm2K: 10, initialC: 20, source: 'Authored surface control' };
const lower = { capacityJm2K: 80000, conductanceWm2K: 20, initialC: 20, source: 'Authored lower control' };
const light = { minutes: 60, incidentWm2: 700, reservoirC: 20, source: 'Authored light' };
const dark = { minutes: 360, incidentWm2: 0, reservoirC: 20, source: 'Authored dark' };
const bottom = { conductanceWm2K: 10, reservoirC: 20, source: 'Authored boundary' };
const close = (a, b, t = 1e-7) => assert.ok(Math.abs(a - b) <= t, a + ' != ' + b);
function project() {
  const p = makeExample();
  p.surfaceHeatStudy = prepareSurfaceHeatStudy(p, { cellIndex: 0, existing: surface, proposal: surface, schedule: [light, dark] });
  p.heatColumnStudy = prepareHeatColumnStudy(p, { existing: lower, proposal: lower }); return p;
}
function study() { return prepareBottomHeatStudy(project(), { existing: bottom, proposal: { ...bottom, conductanceWm2K: 0 } }); }

test('independent frozen pulse and warm-reservoir reference', () => {
  const r = advanceHeatColumnWithBottom(surface, lower, light, { surfaceC: 20, subsurfaceC: 20 }, 3600, bottom);
  close(r.surfaceC, 43.73770625579907); close(r.subsurfaceC, 29.479737314333057);
  close(r.bottomOutJm2, 161470.9588656207, 1e-5);
  const w = advanceHeatColumnWithBottom(surface, lower, dark, { surfaceC: 20, subsurfaceC: 20 }, 3600,
    { ...bottom, conductanceWm2K: 20, reservoirC: 50 });
  close(w.surfaceC, 28.69839005473928); close(w.subsurfaceC, 34.88386918768596);
  close(w.bottomOutJm2, -1520016.0518085505, 1e-5);
  for (const x of [r, w]) for (const key of ['balanceResidualJm2', 'surfaceBalanceResidualJm2', 'subsurfaceBalanceResidualJm2']) close(x[key], 0, 1e-5);
});

test('zero-bottom preserves every inherited result exactly', () => {
  for (const g of [0, 1e-12, 20, 1000]) for (const seconds of [0, .001, 60, 3600]) {
    const l = { ...lower, conductanceWm2K: g };
    const a = advanceHeatColumn(surface, l, light, { surfaceC: 20, subsurfaceC: 35 }, seconds);
    const b = advanceHeatColumnWithBottom(surface, l, light, { surfaceC: 20, subsurfaceC: 35 }, seconds,
      { ...bottom, conductanceWm2K: 0 });
    assert.equal(b.bottomOutJm2, 0); delete b.bottomOutJm2; assert.deepEqual(b, a);
  }
});

test('decoupled lower store follows scalar relaxation including equal rates', () => {
  for (const b of [1e-12, 10, 40, 1000]) {
    const seconds = 1300, initial = { surfaceC: 20, subsurfaceC: 60 }, l = { ...lower, conductanceWm2K: 0 }, deep = 10;
    const r = advanceHeatColumnWithBottom(surface, l, dark, initial, seconds, { conductanceWm2K: b, reservoirC: deep });
    const expected = deep + (initial.subsurfaceC - deep) * Math.exp(-b * seconds / l.capacityJm2K);
    close(r.subsurfaceC, expected); close(r.surfaceC, advanceSurfaceHeat(surface, dark, initial.surfaceC, seconds).temperatureC);
    close(r.bottomOutJm2, l.capacityJm2K * (initial.subsurfaceC - expected), 1e-5); close(r.transferDownJm2, 0, 0);
    const z = b * seconds / l.capacityJm2K;
    close(r.subsurfaceMeanC, deep + (initial.subsurfaceC - deep) * (-Math.expm1(-z) / z));
  }
});

test('course continuity, source nonmutation, extrema and baseline correspondence', () => {
  const s = study(), before = structuredClone(s), r = compareBottomHeatStudy(s); assert.deepEqual(s, before);
  const boundary = inspectBottomHeatStudy(s, 60).existing, after = inspectBottomHeatStudy(s, 60 + 1e-8).existing;
  close(boundary.surfaceC, after.surfaceC, 1e-7); close(boundary.subsurfaceC, after.subsurfaceC, 1e-7);
  close(boundary.bottomOutJm2, after.bottomOutJm2, 1e-3);
  for (const row of r.trajectory) {
    assert.equal(row.minute, row.existing.insulated.minute); assert.equal(row.minute, row.proposal.insulated.minute);
    close(row.proposal.exchanging.surfaceC, row.proposal.insulated.surfaceC, 0);
    close(row.proposal.exchanging.subsurfaceC, row.proposal.insulated.subsurfaceC, 0);
    for (const target of ['existing', 'proposal']) for (const key of ['balanceResidualJm2', 'surfaceBalanceResidualJm2', 'subsurfaceBalanceResidualJm2'])
      close(row[target].exchanging[key], 0, 1e-5);
  }
  for (const name of ['surface', 'subsurface']) {
    const summary = r.summary.existing[name], key = name === 'surface' ? 'surfaceC' : 'subsurfaceC';
    assert.ok(r.trajectory.some(row => row.minute === summary.maximumMinute));
    for (const row of r.trajectory) assert.ok(row.existing.exchanging[key] <= summary.maximumC + 1e-9);
  }
  assert.ok(r.summary.existing.final.bottomOutJm2 > 0);
});

test('raw-source replay ignores derived results and refuses stale association', () => {
  const p = project(), s = prepareBottomHeatStudy(p, { existing: bottom, proposal: bottom });
  const expected = compareBottomHeatStudy(s), reopened = JSON.parse(JSON.stringify(s));
  reopened.report = { surfaceC: -999 }; reopened.heatColumnStudy.report = { maximumC: -999 };
  reopened.heatColumnStudy.heatStudy.existing.trajectory = [999];
  assert.deepEqual(canonicalBottomHeatStudy(reopened), s);
  assert.deepEqual(compareBottomHeatStudy(reopened), expected);
  p.surfaceHeatStudy.schedule[0].incidentWm2++;
  assert.throws(() => prepareBottomHeatStudy(p, s.bottoms), /current/);
  assert.deepEqual(compareBottomHeatStudy(reopened), expected);
  for (const bad of [-1, NaN, Infinity, 1001]) {
    const changed = structuredClone(s); changed.bottoms.existing.conductanceWm2K = bad;
    assert.throws(() => validateBottomHeatStudy(changed));
  }
  const missing = structuredClone(s); missing.bottoms.existing.source = ' '; assert.throws(() => validateBottomHeatStudy(missing));
  assert.throws(() => inspectBottomHeatStudy(s, -1)); assert.throws(() => inspectBottomHeatStudy(s, 421));
});

test('stationary common-reservoir equilibrium has zero signed energy exchange', () => {
  const r = advanceHeatColumnWithBottom(surface, lower, dark, { surfaceC: 20, subsurfaceC: 20 }, 86400, bottom);
  assert.equal(r.surfaceC, 20); assert.equal(r.subsurfaceC, 20);
  for (const key of ['inputJm2', 'exchangeOutJm2', 'transferDownJm2', 'bottomOutJm2', 'totalStoredJm2']) assert.equal(r[key], 0);
});


test('constant-forcing subdivision preserves state, mean integral and signed exchanges', () => {
  const initial = { surfaceC: 15, subsurfaceC: 42 }, boundary = { conductanceWm2K: 17, reservoirC: 9 };
  const whole = advanceHeatColumnWithBottom(surface, lower, light, initial, 2700, boundary);
  const first = advanceHeatColumnWithBottom(surface, lower, light, initial, 713, boundary);
  const second = advanceHeatColumnWithBottom(surface, lower, light, first, 1987, boundary);
  close(second.surfaceC, whole.surfaceC); close(second.subsurfaceC, whole.subsurfaceC);
  for (const key of ['inputJm2', 'exchangeOutJm2', 'transferDownJm2', 'bottomOutJm2', 'surfaceDegreeSeconds', 'subsurfaceDegreeSeconds']) {
    close(first[key] + second[key], whole[key], 1e-5);
  }
});
