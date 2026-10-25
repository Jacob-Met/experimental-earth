import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample, runRain, SURFACES} from '../core.js';
import {withInternalBarrier, withInternalCrest} from '../internal-barriers.js';
import {INFILTRATION_STORAGE_MODEL, validateInfiltrationStorage} from '../infiltration-storage.js';
import {
  compareInfiltrationStorage, serializeInfiltrationStorage, parseInfiltrationStorage,
  checkStorageFileBytes, STORAGE_FILE_LIMIT,
} from '../infiltration-storage-study.js';
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, a + ' != ' + b);
const store = (capacity = 5, surface = 'garden') => ({
  schema: INFILTRATION_STORAGE_MODEL, surface, remainingCapacityMm: capacity,
  source: 'Explicitly authored closed receiving layer; no physical measurement',
});
function flat(surface = 'garden') {
  const p = makeExample(); p.width = p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({length: 4}, () => ({elevationM: 0, surface, provenance: 'authored flat closed site'}));
  p.proposal = structuredClone(p.existing);
  Object.assign(p.weather, {rainMmHr: 36, stormMinutes: 60, durationMinutes: 240,
    cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0});
  return p;
}
const run = (p, storage, extra = {}) => runRain(p.existing, p.width, p.height, p.weather,
  {...extra, infiltrationStorage: storage});
const withoutStore = result => { const copy = structuredClone(result); delete copy.infiltrationStorage; return copy; };

test('independent closed-column supply/rate/space bounds over 192 changed inputs', () => {
  let checked = 0;
  for (const rate of [0, 1, 9, 24]) for (const rain of [0, 7, 36])
    for (const capacity of [0, 0.25, 5, 100]) for (const stepMinutes of [1, 2.5, 7, 30]) {
      const p = flat(); Object.assign(p.weather, {rainMmHr: rain, stepMinutes, stormMinutes: 43.2});
      const r = run(p, store(capacity), {surfaceInfiltrationOverride: {surface: 'garden', rateMmHr: rate}});
      const supply = rain * 43.2 / 60;
      const acceptedPerCell = Math.min(supply, rate * 4, capacity);
      close(r.rainLiters, supply * 4); close(r.absorbedLiters, acceptedPerCell * 4);
      close(r.storedLiters, (supply - acceptedPerCell) * 4); close(r.massErrorLiters, 0);
      r.infiltrationStorage.retainedMm.forEach(x => close(x, acceptedPerCell));
      assert.ok(r.finalDepthMm.every(x => x >= 0)); checked++;
    }
  assert.equal(checked, 192);
});

test('a filled shallow layer changes the actual proposal consequence while keeping rejected water above ground', () => {
  const p = flat('sealed'); p.proposal = p.existing.map(c => ({...c, surface: 'garden'}));
  const r = compareInfiltrationStorage(p, store());
  close(r.proposal.unlimited.absorbedLiters, 144);
  close(r.proposal.limited.absorbedLiters, 20);
  close(r.proposal.limited.storedLiters, 124);
  close(r.change.storedLiters.unlimited, -128);
  close(r.change.storedLiters.limited, -4);
  assert.equal(r.proposal.limited.infiltrationStorage.capacityAffectedCellCount, 4);
  assert.equal(r.affectedCellCount.existing, 0);
});

test('large unused receiving space retains every legacy flux and snapshot bit for bit', () => {
  const p = makeExample();
  for (const surface of Object.keys(SURFACES)) {
    const unlimited = runRain(p.existing, p.width, p.height, p.weather, {traceBudget: true, rainTrace: {sourceCells: [0, 3]}});
    const limited = run(p, store(10000, surface), {traceBudget: true, rainTrace: {sourceCells: [0, 3]}});
    assert.deepEqual(withoutStore(limited), unlimited);
    assert.equal(limited.infiltrationStorage.capacityAffectedCellCount, 0);
  }
});

test('zero remaining space matches an impermeable target without changing other surfaces', () => {
  const p = makeExample();
  const actual = run(p, store(0, 'turf'));
  const reference = runRain(p.existing, p.width, p.height, p.weather,
    {surfaceInfiltrationOverride: {surface: 'turf', rateMmHr: 0}});
  assert.deepEqual(withoutStore(actual), reference);
  assert.equal(actual.infiltrationStorage.retainedLiters, 0);
});

test('dry and absent-surface cases cannot claim an effect or silently apply a capacity to other surfaces', () => {
  const p = flat('sealed'), absent = compareInfiltrationStorage(p, store());
  assert.equal(absent.status, 'surface-absent');
  assert.deepEqual(withoutStore(absent.existing.limited), absent.existing.unlimited);
  assert.ok(absent.existing.limited.infiltrationStorage.retainedMm.every(x => x === null));
  p.weather.rainMmHr = 0;
  const dry = compareInfiltrationStorage(p, store(0, 'sealed'));
  close(dry.existing.limited.storedLiters, 0); close(dry.existing.limited.absorbedLiters, 0);
  assert.equal(dry.existing.limited.infiltrationStorage.capacityAffectedCellCount, 0);
});

test('wetting-front cumulative state advances only by accepted infiltration, including an exhausted store', () => {
  const p = flat('turf');
  const r = run(p, store(5, 'turf'), {
    surfaceWettingFront: {surface: 'turf', conductivityMmHr: 7, capillaryDriveMm: 30},
    traceBudget: true,
  });
  close(r.absorbedLiters, 20); close(r.storedLiters, 124);
  r.wettingFront.cumulativeInfiltrationMm.forEach(x => close(x, 5));
  r.waterBudget.cells.forEach(c => {close(c.absorbedLiters, 5); close(c.balanceErrorLiters, 0);});
  const high = run(p, store(10000, 'turf'), {surfaceWettingFront: {surface: 'turf', conductivityMmHr: 7, capillaryDriveMm: 30}});
  const old = runRain(p.existing, 2, 2, p.weather, {surfaceWettingFront: {surface: 'turf', conductivityMmHr: 7, capillaryDriveMm: 30}});
  assert.deepEqual(withoutStore(high), old);
});

test('routed capacity-limited water preserves global and local accounts, walls, finite crests and original source', () => {
  let p = makeExample();
  p = withInternalBarrier(p, 'existing', 0, 'east', true, 'authored wall');
  p = withInternalCrest(p, 'existing', 2, 'south', .04, 'authored finite crest');
  Object.assign(p.weather, {rainMmHr: 87, stormMinutes: 31.7, durationMinutes: 125,
    stepMinutes: 7, mobilityPerHour: 2, boundaryExitPerHour: .7});
  const before = structuredClone(p);
  const r = run(p, store(3, 'turf'), {traceBudget: true, rainTrace: {sourceCells: [0, 1, 10]}});
  close(r.massErrorLiters, 0, 1e-7);
  r.waterBudget.cells.forEach((c, i) => {
    close(c.balanceErrorLiters, 0, 1e-8);
    if (p.existing[i].surface === 'turf') {
      assert.ok(c.absorbedLiters <= 3 * p.weather.cellSizeM ** 2 + 1e-10);
      close(c.absorbedLiters, r.infiltrationStorage.retainedMm[i] * p.weather.cellSizeM ** 2);
    }
  });
  assert.ok(r.finalDepthMm.every(x => Number.isFinite(x) && x >= 0));
  close(r.rainTrace.massErrorLiters, 0, 1e-7);
  assert.deepEqual(p, before);
});

test('reverse origins and independent forward tags receive the same capacity-limited accepted water', () => {
  const p = flat('turf'); p.existing[0].elevationM = .2; p.existing[1].surface = 'garden';
  Object.assign(p.weather, {mobilityPerHour: 2, boundaryExitPerHour: .7, stepMinutes: 7, stormMinutes: 23.4});
  for (const [fate, key] of Object.entries({stored: 'storedByCellLiters', absorbed: 'absorbedByCellLiters', exit: 'exitByCellLiters'})) {
    const reverse = run(p, store(2, 'turf'), {rainOrigins: {targetCells: [1, 3], fate}}).rainOrigins;
    for (let source = 0; source < 4; source++) {
      const forward = run(p, store(2, 'turf'), {rainTrace: {sourceCells: [source]}}).rainTrace;
      close(reverse.bySourceLiters[source], forward[key][1] + forward[key][3], 1e-9);
    }
    close(reverse.balanceErrorLiters, 0, 1e-9);
  }
});

test('original input-only investigations replay exactly and changed capacity recomputes instead of importing a verdict', () => {
  const p = flat(), s = store();
  p.observations = [{cellIndex: 0, minute: 60, depthMm: 2, uncertaintyMm: 1,
    scenario: 'existing', use: 'challenge', source: 'Explicitly authored test-only reading'}];
  const original = structuredClone(p), text = serializeInfiltrationStorage(p, s);
  const input = parseInfiltrationStorage(text);
  assert.deepEqual(input.project, p); assert.deepEqual(input.storage, s);
  assert.deepEqual(compareInfiltrationStorage(input.project, input.storage), compareInfiltrationStorage(p, s));
  input.storage.remainingCapacityMm = 20;
  close(compareInfiltrationStorage(input.project, input.storage).existing.limited.absorbedLiters, 80);
  assert.deepEqual(p, original);
  const forged = JSON.parse(text); forged.results = {absorbedLiters: 1e10};
  assert.throws(() => parseInfiltrationStorage(JSON.stringify(forged)), /conclusions/);
});

test('malformed or hidden capacity declarations cannot enter the solver', () => {
  const p = flat();
  for (const value of [-1, NaN, Infinity, 10001, '5', null]) {
    assert.throws(() => run(p, {...store(), remainingCapacityMm: value}), /remaining closed-store/);
  }
  for (const model of [null, {}, {...store(), surface: '__proto__'}, {...store(), source: ' '},
    {...store(), rainMmHr: 0}, {...store(), schema: 'invented/1'}, Object.create(store())]) {
    assert.throws(() => validateInfiltrationStorage(model, SURFACES), /remaining closed-store/);
  }
  assert.throws(() => parseInfiltrationStorage('{}'), /Unsupported/);
  assert.throws(() => checkStorageFileBytes(STORAGE_FILE_LIMIT + 1), /5 MiB/);
  assert.throws(() => checkStorageFileBytes(-1), /5 MiB/);
});

test('complete work admission refuses large four-run comparisons before returning partial results', () => {
  const p = flat(); p.width = p.height = 24; p.selectedIndex = 0;
  p.existing = Array.from({length: 576}, () => ({...p.existing[0]})); p.proposal = structuredClone(p.existing);
  Object.assign(p.weather, {durationMinutes: 720, stormMinutes: 720, stepMinutes: 1});
  assert.throws(() => compareInfiltrationStorage(p, store()), /complete four-run work budget/);
  assert.throws(() => serializeInfiltrationStorage(p, store()), /complete four-run work budget/);
});
