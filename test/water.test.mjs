import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATERIALS, makeDemoSite, initialSession, validateSession, paintCell,
  simulateStorm, compareSession, suggestMeasurement,
} from '../src/water.mjs';
function near(a, b, tolerance = 1e-6) { assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`); }
function site(cols = 2, rows = 2, materials = ['paving', 'paving', 'paving', 'paving']) {
  return { schemaVersion: 1, name: 'test', cols, rows, cellSizeM: 1,
    elevationMm: Array(cols * rows).fill(0), materials, outlets: [] };
}
const storm = { intensityMmPerHour: 60, durationMinutes: 60, stepMinutes: 1 };
test('uniform rain with no outlet preserves every liter in infiltration or surface', () => {
  const s = site(); const r = simulateStorm(s, storm);
  near(r.final.rainLiters, 240); near(r.final.infiltrationLiters, 8);
  near(r.final.storedLiters, 232); near(r.final.outletLiters, 0);
  near(r.final.balanceErrorLiters, 0, 1e-8);
  near(r.final.maxDepthMm, 58); near(r.final.wetAreaM2, 4);
  assert.equal(r.frames.length, 61);
});
test('all-zero rainfall produces all-zero storage, infiltration and discharge', () => {
  const s = site(); s.outlets = [{ index: 0, capacityMmPerHour: 200 }];
  const r = simulateStorm(s, { ...storm, intensityMmPerHour: 0 });
  for (const key of ['rainLiters', 'storedLiters', 'infiltrationLiters', 'outletLiters', 'balanceErrorLiters']) near(r.final[key], 0);
});
test('outlet only removes stored water and accounts for its volume', () => {
  const s = site(); s.outlets = [{ index: 0, capacityMmPerHour: 30 }];
  const r = simulateStorm(s, storm);
  assert.ok(r.final.outletLiters > 0);
  near(r.final.rainLiters, r.final.storedLiters + r.final.infiltrationLiters + r.final.outletLiters, 1e-8);
});
test('downhill routing moves water without making it or crossing closed boundaries', () => {
  const s = site(); s.elevationMm = [100, 0, 100, 100];
  s.materials = ['paving', 'paving', 'paving', 'paving'];
  const r = simulateStorm(s, { ...storm, intensityMmPerHour: 60, durationMinutes: 2 });
  assert.ok(r.final.depthsMm[1] > r.final.depthsMm[0], 'downhill cell receives water');
  near(r.final.balanceErrorLiters, 0, 1e-9);
});
test('low-rate planting change increases infiltration and decreases remaining+discharged water', () => {
  const s = initialSession();
  for (let i = 0; i < s.proposal.materials.length; i++) if (s.proposal.materials[i] === 'paving') s.proposal.materials[i] = 'planting';
  const { baseline, proposal, deltaInfiltrationLiters, deltaStoredLiters, deltaOutletLiters } = compareSession(s);
  assert.ok(deltaInfiltrationLiters > 0);
  assert.ok(deltaStoredLiters + deltaOutletLiters < 0);
  near(deltaInfiltrationLiters + deltaStoredLiters + deltaOutletLiters, 0, 1e-7);
  near(baseline.final.balanceErrorLiters, 0, 1e-7); near(proposal.final.balanceErrorLiters, 0, 1e-7);
});
test('painting proposal does not mutate baseline and survives JSON round-trip', () => {
  const s = initialSession(); const baseline = JSON.stringify(s.baseline);
  const next = paintCell(s, 10, 'gravel');
  assert.equal(JSON.stringify(s.baseline), baseline); assert.equal(JSON.stringify(s.proposal), baseline);
  assert.equal(next.proposal.materials[10], 'gravel');
  assert.equal(validateSession(JSON.parse(JSON.stringify(next))).proposal.materials[10], 'gravel');
});
test('resetting proposal yields zero deltas and preserves base', () => {
  const s = initialSession(); const baseline = JSON.stringify(s.baseline);
  const changed = paintCell(s, 10, 'planting');
  changed.proposal = JSON.parse(JSON.stringify(changed.baseline));
  const result = compareSession(changed);
  near(result.deltaStoredLiters, 0); near(result.deltaOutletLiters, 0); near(result.deltaInfiltrationLiters, 0);
  assert.deepEqual(changed.baseline, JSON.parse(baseline));
});
test('changing infiltration bound produces a reproducible informative sensitivity', () => {
  const s = makeDemoSite(), st = initialSession().storm;
  const m = suggestMeasurement(s, st);
  assert.ok(m && m.impactLiters > 0, 'some material uncertainty matters');
  assert.ok(MATERIALS[m.material].high > MATERIALS[m.material].low);
  near(m.impactLiters, Math.abs(m.lowUnabsorbedLiters - m.highUnabsorbedLiters));
  assert.deepEqual(suggestMeasurement(s, st), m);
});
test('invalid user import rejects nonfinite values, bad shapes, unsafe material and invalid outlet', () => {
  const original = initialSession();
  for (const mutate of [
    s => { s.proposal.elevationMm[0] = Infinity; },
    s => { s.proposal.materials.pop(); },
    s => { s.proposal.materials[0] = '__proto__'; },
    s => { s.baseline.outlets[0].index = 99999; },
    s => { s.storm.durationMinutes = 0; },
    s => { s.baseline.cols = 99; },
    s => { s.proposal.elevationMm[0]++; },
    s => { s.baseline.outlets.push(s.baseline.outlets[0]); },
  ]) {
    const s = structuredClone(original); mutate(s);
    assert.throws(() => validateSession(s));
  }
});
test('simulation refuses unbounded rates, invalid overrides and oversized grids', () => {
  const s = makeDemoSite();
  assert.throws(() => simulateStorm(s, { ...storm, intensityMmPerHour: 251 }));
  assert.throws(() => simulateStorm(s, storm, { infiltrationOverride: { index: -1, rate: 9 } }));
  assert.throws(() => simulateStorm(s, storm, { infiltrationOverride: { index: 1, rate: Number.NaN } }));
});
test('partial final step preserves exact requested event duration and water account', () => {
  const r = simulateStorm(site(), { intensityMmPerHour: 15, durationMinutes: 2.5, stepMinutes: 1 });
  near(r.final.minute, 2.5); near(r.final.rainLiters, 2.5); near(r.final.balanceErrorLiters, 0, 1e-9);
});
