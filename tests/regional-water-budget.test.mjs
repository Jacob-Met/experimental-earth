import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample } from '../core.js';
import { compareLocalWaterBudget, inspectLocalWaterBudget, inspectRegionalWaterBudget,
  localBudgetRegion } from '../local-water-budget.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
function slope() {
  const p = makeExample(); p.width = p.height = 2; p.selectedIndex = 0;
  p.existing = [0, 1, 2, 3].map(i => ({ elevationM: i % 2 ? 0 : .02, surface: 'sealed', provenance: 'analytic region control' }));
  p.proposal = structuredClone(p.existing);
  Object.assign(p.weather, { rainMmHr: 60, stormMinutes: 5, durationMinutes: 5,
    stepMinutes: 5, cellSizeM: 1, mobilityPerHour: .5, boundaryExitPerHour: 0 });
  return p;
}

test('internal one-step transfer cancels from the selected region boundary', () => {
  const c = compareLocalWaterBudget(slope());
  const region = inspectRegionalWaterBudget(c, [1, 0]);
  assert.deepEqual(region.cellIndices, [0, 1]);
  for (const target of ['existing', 'proposal']) {
    close(region[target].rainLiters, 10); close(region[target].absorbedLiters, 1 / 6);
    close(region[target].storedLiters, 10 - 1 / 6);
    close(region[target].internalCrossingLiters, 5 / 6);
    assert.equal(region[target].incomingLiters, 0); assert.equal(region[target].outgoingLiters, 0);
    close(region[target].balanceErrorLiters, 0);
  }
});

test('cutting the same slope at the region boundary retains exactly its external flow', () => {
  const c = compareLocalWaterBudget(slope());
  const upstream = inspectRegionalWaterBudget(c, [0, 2]);
  const downstream = inspectRegionalWaterBudget(c, [1, 3]);
  close(upstream.existing.outgoingLiters, 5 / 3); assert.equal(upstream.existing.incomingLiters, 0);
  close(downstream.existing.incomingLiters, 5 / 3); assert.equal(downstream.existing.outgoingLiters, 0);
  close(upstream.existing.storedLiters, 10 - 1 / 6 - 5 / 3);
  close(downstream.existing.storedLiters, 10 - 1 / 6 + 5 / 3);
  assert.deepEqual(upstream.neighbors.map(n => n.cellIndex), [1, 3]);
});

test('disconnected selections account for each boundary without inventing an interior', () => {
  const c = compareLocalWaterBudget(slope()), region = inspectRegionalWaterBudget(c, [0, 3]);
  close(region.existing.incomingLiters, 5 / 6); close(region.existing.outgoingLiters, 5 / 6);
  assert.equal(region.existing.internalCrossingLiters, 0);
  close(region.existing.storedLiters, 10 - 1 / 6);
  assert.deepEqual(region.neighbors.map(n => n.cellIndex), [1, 2]);
});

test('whole-site region reduces to maintained global accounting with no external neighbor flow', () => {
  const p = makeExample(), c = compareLocalWaterBudget(p);
  const region = inspectRegionalWaterBudget(c, localBudgetRegion(p, 'site'));
  assert.equal(region.neighbors.length, 0);
  for (const target of ['existing', 'proposal']) {
    assert.equal(region[target].incomingLiters, 0); assert.equal(region[target].outgoingLiters, 0);
    close(region[target].rainLiters, c.global[target].rainLiters);
    close(region[target].absorbedLiters, c.global[target].absorbedLiters);
    close(region[target].storedLiters, c.global[target].storedLiters);
    close(region[target].boundaryExitLiters, c.global[target].exitLiters);
    close(region[target].balanceErrorLiters, 0);
    assert.ok(region[target].internalCrossingLiters > 0);
  }
});

test('single-cell regional result preserves existing inspected components and neighbors', () => {
  const c = compareLocalWaterBudget(makeExample());
  for (const i of [0, 7, 27, 47]) {
    const local = inspectLocalWaterBudget(c, i), regional = inspectRegionalWaterBudget(c, [i]);
    assert.deepEqual(regional.changes, local.changes); assert.deepEqual(regional.neighbors, local.neighbors);
    for (const target of ['existing', 'proposal']) for (const key of Object.keys(local.changes)) close(regional[target][key], local[target][key]);
  }
});

test('complement regions have opposite accepted boundary crossings in both scenarios', () => {
  const p = makeExample(), c = compareLocalWaterBudget(p);
  const a = localBudgetRegion(p, 'edited'), selected = new Set(a);
  const b = localBudgetRegion(p, 'site').filter(i => !selected.has(i));
  const ra = inspectRegionalWaterBudget(c, a), rb = inspectRegionalWaterBudget(c, b);
  for (const target of ['existing', 'proposal']) {
    close(ra[target].incomingLiters, rb[target].outgoingLiters);
    close(ra[target].outgoingLiters, rb[target].incomingLiters);
    close(ra[target].balanceErrorLiters, 0); close(rb[target].balanceErrorLiters, 0);
    close(ra.neighbors.reduce((n, x) => n + x[target].incomingLiters, 0), ra[target].incomingLiters);
  }
  close(ra.changeBalanceErrorLiters, 0);
});

test('footprint means direct modeled edits, independent of metadata, selection and downstream effects', () => {
  const p = slope(); assert.deepEqual(localBudgetRegion(p, 'edited'), []);
  p.proposal[0].provenance = 'new note'; assert.deepEqual(localBudgetRegion(p, 'edited'), []);
  p.proposal[1].elevationM += .01; p.proposal[3].surface = 'garden'; p.selectedIndex = 2;
  assert.deepEqual(localBudgetRegion(p, 'edited'), [1, 3]);
  assert.deepEqual(localBudgetRegion(p, 'cell'), [2]);
  assert.deepEqual(localBudgetRegion(p, 'site'), [0, 1, 2, 3]);
  assert.throws(() => localBudgetRegion(p, 'influence'), /Choose/);
});

test('regional inspection is immutable and rejects empty, repeated or invalid membership', () => {
  const c = compareLocalWaterBudget(slope()), before = structuredClone(c), members = [2, 0];
  const region = inspectRegionalWaterBudget(c, members);
  assert.deepEqual(members, [2, 0]); assert.deepEqual(c, before);
  region.existing.rainLiters = -1; region.neighbors[0].existing.incomingLiters = -1;
  assert.deepEqual(c, before);
  for (const bad of [[], [0, 0], [-1], [4], [.5], [NaN], '0']) {
    assert.throws(() => inspectRegionalWaterBudget(c, bad), /distinct cells/);
  }
});
