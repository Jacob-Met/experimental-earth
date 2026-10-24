import assert from 'node:assert/strict';
import test from 'node:test';
import { makeExample, runRain } from '../core.js';
import { compareLocalWaterBudget, inspectLocalWaterBudget, localBudgetInputKey,
  MAX_LOCAL_BUDGET_CELL_STEPS } from '../local-water-budget.js';

function fixture() {
  const p = makeExample(); p.width = p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({ length: 4 }, () => ({ elevationM: 0, surface: 'sealed', provenance: 'authored analytic control' }));
  p.proposal = structuredClone(p.existing);
  Object.assign(p.weather, { rainMmHr: 30, stormMinutes: 60, durationMinutes: 60,
    stepMinutes: 5, cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0 });
  return p;
}
const close = (actual, expected, scale = 1) => assert.ok(
  Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected), scale),
  `${actual} differs from ${expected}`);
const run = (p, options = {}) => runRain(p.existing, p.width, p.height, p.weather, options);
const sum = (cells, key) => cells.reduce((s, c) => s + c[key], 0);

test('closed uncoupled cell accounting matches an independent rain-minus-infiltration integral', () => {
  const p = fixture(); p.weather.cellSizeM = 2;
  const result = run(p, { traceBudget: true });
  for (const c of result.waterBudget.cells) {
    close(c.rainLiters, 120); close(c.absorbedLiters, 4); close(c.storedLiters, 116);
    assert.equal(c.incomingLiters, 0); assert.equal(c.outgoingLiters, 0);
    assert.equal(c.boundaryExitLiters, 0); close(c.balanceErrorLiters, 0);
  }
  close(result.rainLiters, 480);
});

test('one-step slope records the actual directed transfer in liters with cell area', () => {
  const p = fixture(); Object.assign(p.weather, { rainMmHr: 60, stormMinutes: 5,
    durationMinutes: 5, stepMinutes: 5, mobilityPerHour: .5, cellSizeM: 2 });
  p.existing[0].elevationM = p.existing[2].elevationM = .02;
  const result = run(p, { traceBudget: true });
  const edge = result.waterBudget.edges.find(e => e.a === 0 && e.b === 1);
  const transferred = 20 * .5 * (5 / 60) * 4;
  close(edge.aToBLiters, transferred); assert.equal(edge.bToALiters, 0);
  close(result.waterBudget.cells[0].storedLiters, (5 - 1 / 12) * 4 - transferred);
  close(result.waterBudget.cells[1].storedLiters, (5 - 1 / 12) * 4 + transferred);
});

test('available-water capping is retained: ledger records accepted rather than requested flow', () => {
  const p = fixture(); Object.assign(p.weather, { rainMmHr: 12, stormMinutes: 5,
    durationMinutes: 5, stepMinutes: 5, mobilityPerHour: 10, boundaryExitPerHour: 10 });
  p.existing[0].elevationM = 10;
  const result = run(p, { traceBudget: true, surfaceInfiltrationOverride: { surface: 'sealed', rateMmHr: 0 } });
  const c = result.waterBudget.cells[0];
  close(c.outgoingLiters + c.boundaryExitLiters, 1);
  close(c.storedLiters, 0); close(c.balanceErrorLiters, 0);
  assert.ok(result.waterBudget.edges.every(e => e.aToBLiters >= 0 && e.bToALiters >= 0));
});

test('opposing transfers on one edge are retained separately rather than canceled', () => {
  const p = fixture(); Object.assign(p.weather, { rainMmHr: 120, stormMinutes: 30,
    durationMinutes: 60, stepMinutes: 30, mobilityPerHour: 10 });
  p.existing[0].elevationM = p.existing[2].elevationM = .001;
  const result = run(p, { traceBudget: true });
  const edge = result.waterBudget.edges.find(e => e.a === 0 && e.b === 1);
  close(edge.aToBLiters, 5); close(edge.bToALiters, 45);
  close(result.waterBudget.cells[0].outgoingLiters, 5);
  close(result.waterBudget.cells[0].incomingLiters, 45);
});

test('every local balance and global flux total close on a mixed coupled site', () => {
  const p = makeExample(), result = run(p, { traceBudget: true });
  const cells = result.waterBudget.cells;
  for (const c of cells) close(c.balanceErrorLiters, 0, c.rainLiters + c.incomingLiters);
  close(sum(cells, 'rainLiters'), result.rainLiters);
  close(sum(cells, 'absorbedLiters'), result.absorbedLiters);
  close(sum(cells, 'boundaryExitLiters'), result.exitLiters);
  close(sum(cells, 'storedLiters'), result.storedLiters);
  close(sum(cells, 'incomingLiters'), sum(cells, 'outgoingLiters'));
  const edgeTotal = result.waterBudget.edges.reduce((s, e) => s + e.aToBLiters + e.bToALiters, 0);
  close(edgeTotal, sum(cells, 'incomingLiters'));
  assert.ok(cells.some(c => c.incomingLiters > c.rainLiters), 'crossings are not unique parcel provenance');
});

test('optional trace preserves every ordinary result and existing override behavior exactly', () => {
  for (const p of [fixture(), makeExample()]) for (const override of [{},
    { infiltrationOverride: { cellIndex: 0, rateMmHr: 0 } },
    { surfaceInfiltrationOverride: { surface: 'turf', rateMmHr: 7.25 } }]) {
    const before = structuredClone(p);
    const ordinary = run(p, override);
    const { waterBudget, ...traced } = run(p, { ...override, traceBudget: true });
    assert.deepEqual(traced, ordinary); assert.deepEqual(p, before);
    assert.ok(waterBudget); assert.equal(ordinary.waterBudget, undefined);
    assert.deepEqual(run(p, { ...override, traceBudget: false }), ordinary);
  }
  assert.throws(() => run(fixture(), { traceBudget: 'yes' }), /explicitly/);
});

test('horizontal reflection preserves cell fluxes and reverses directed edge labels', () => {
  const p = makeExample(), mirror = structuredClone(p);
  const index = i => Math.floor(i / p.width) * p.width + p.width - 1 - i % p.width;
  mirror.existing = p.existing.map((_, i) => p.existing[index(i)]);
  const a = run(p, { traceBudget: true }).waterBudget;
  const b = run(mirror, { traceBudget: true }).waterBudget;
  for (const c of a.cells) for (const key of ['rainLiters', 'absorbedLiters', 'incomingLiters', 'outgoingLiters', 'boundaryExitLiters', 'storedLiters']) {
    close(c[key], b.cells[index(c.cellIndex)][key]);
  }
  for (const edge of a.edges) {
    const ia = index(edge.a), ib = index(edge.b);
    const other = b.edges.find(e => (e.a === ia && e.b === ib) || (e.a === ib && e.b === ia));
    close(edge.aToBLiters, other.a === ia ? other.aToBLiters : other.bToALiters);
    close(edge.bToALiters, other.a === ia ? other.bToALiters : other.aToBLiters);
  }
});

test('paired local components explain independently calculated surface-change storage effect', () => {
  const p = fixture(); p.existing.forEach(c => c.surface = 'turf');
  p.proposal.forEach(c => c.surface = 'garden');
  const original = structuredClone(p), comparison = compareLocalWaterBudget(p);
  assert.equal(comparison.status, 'computed');
  const cell = inspectLocalWaterBudget(comparison, 0);
  close(cell.existing.storedLiters, 21); close(cell.proposal.storedLiters, 6);
  close(cell.changes.absorbedLiters, 15); close(cell.changes.storedLiters, -15);
  close(cell.explainedStorageChangeLiters, -15); close(cell.changeBalanceErrorLiters, 0);
  assert.deepEqual(cell.neighbors.map(n => n.cellIndex), [1, 2]);
  assert.deepEqual(p, original);
  assert.deepEqual(compareLocalWaterBudget(JSON.parse(JSON.stringify(p))), comparison);
});

test('identical plans and a dry event retain honest zero change and zero routing', () => {
  const p = fixture();
  for (const value of Object.values(inspectLocalWaterBudget(compareLocalWaterBudget(p), 0).changes)) assert.equal(value, 0);
  p.weather.rainMmHr = 0; p.proposal[0].elevationM = 5;
  const report = compareLocalWaterBudget(p);
  for (const target of ['existing', 'proposal']) for (const c of report[target].cells) {
    for (const [key, value] of Object.entries(c)) if (key !== 'cellIndex') assert.equal(value, 0);
  }
});

test('neighbor views exactly reconcile local incoming and outgoing totals', () => {
  const comparison = compareLocalWaterBudget(makeExample());
  for (const i of [0, 7, 27, 47]) {
    const c = inspectLocalWaterBudget(comparison, i);
    for (const target of ['existing', 'proposal']) {
      close(c.neighbors.reduce((s, n) => s + n[target].incomingLiters, 0), c[target].incomingLiters);
      close(c.neighbors.reduce((s, n) => s + n[target].outgoingLiters, 0), c[target].outgoingLiters);
    }
    close(c.changeBalanceErrorLiters, 0, c.existing.incomingLiters + c.proposal.incomingLiters);
  }
});

test('oversized interactive request is uncomputed and malformed selection is refused', () => {
  const p = fixture(); p.width = p.height = 24;
  p.existing = Array.from({ length: 576 }, () => ({ ...p.existing[0] })); p.proposal = structuredClone(p.existing);
  Object.assign(p.weather, { durationMinutes: 720, stepMinutes: 1 });
  const result = compareLocalWaterBudget(p);
  assert.deepEqual(result, { status: 'work-limit', cellSteps: 829440, limit: MAX_LOCAL_BUDGET_CELL_STEPS });
  assert.throws(() => inspectLocalWaterBudget(result, 0), /computed/);
  const normal = compareLocalWaterBudget(fixture());
  for (const i of [-1, 4, .5, NaN]) assert.throws(() => inspectLocalWaterBudget(normal, i), /Select a cell/);
});

test('selection and notebook edits preserve the input identity; modeled assumptions invalidate it', () => {
  const p = fixture(), key = localBudgetInputKey(p);
  p.selectedIndex = 3; p.observations.push({ cellIndex: 0, minute: 1, depthMm: 2, uncertaintyMm: 1, source: 'authored notebook control' });
  assert.equal(localBudgetInputKey(p), key);
  p.weather.rainMmHr += 1; assert.notEqual(localBudgetInputKey(p), key);
  p.weather.rainMmHr -= 1; p.proposal[0].elevationM += .01; assert.notEqual(localBudgetInputKey(p), key);
});
