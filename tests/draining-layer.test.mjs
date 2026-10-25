import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceDrainingLayer, DRAINING_LAYER_SCHEMA, validateDrainingLayer} from '../draining-infiltration.js';
import {makeExample, runRain, SURFACES} from '../core.js';
import {INFILTRATION_STORAGE_MODEL} from '../infiltration-storage.js';
import {makeDrainingExample, compareDrainingLayer, serializeDrainingLayer,
  parseDrainingLayer, checkDrainingFileBytes} from '../draining-layer-study.js';
const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance,
  `${a} differs from ${b} by ${Math.abs(a - b)} (limit ${tolerance})`);
const base = {surfaceMm: 0, storedMm: 0, capacityMm: 5,
  infiltrationMmHr: 24, drainagePerHour: 1, rainMmHr: 36, hours: 1};

test('independent filling time and steady saturated drainage retain every water component', () => {
  const fill = Math.log(24 / 19), infiltrated = 24 * fill + 5 * (1 - fill);
  const wet = advanceDrainingLayer(base);
  near(wet.storedMm, 5); near(wet.infiltratedMm, infiltrated);
  near(wet.drainedMm, infiltrated - 5); near(wet.surfaceMm, 36 - infiltrated);
  assert.equal(wet.limited, true);
  const dry = advanceDrainingLayer({...base, surfaceMm: wet.surfaceMm,
    storedMm: wet.storedMm, rainMmHr: 0, hours: 3});
  near(dry.infiltratedMm, 15); near(dry.drainedMm, 15); near(dry.storedMm, 5);
  near(dry.surfaceMm, 21 - infiltrated);
});

test('initial below-ground water drains without creating rain or surface infiltration', () => {
  const result = advanceDrainingLayer({...base, rainMmHr: 0, storedMm: 4, hours: 2});
  near(result.storedMm, 4 * Math.exp(-2)); near(result.drainedMm, 4 * (1 - Math.exp(-2)));
  assert.equal(result.infiltratedMm, 0); assert.equal(result.surfaceMm, 0);
  near(result.receiverBalanceErrorMm, 0);
});

test('independent supply, rate and capacity controls cover zero drainage and empty capacity', () => {
  for (const surfaceMm of [0, 0.01, 8, 60]) for (const rainMmHr of [0, 2, 36])
    for (const infiltrationMmHr of [0, 1, 24, 100]) for (const capacityMm of [0, 5, 100]) {
      const storedMm = capacityMm / 3, hours = 2;
      const result = advanceDrainingLayer({...base, surfaceMm, rainMmHr,
        infiltrationMmHr, capacityMm, storedMm, hours, drainagePerHour: 0});
      const expected = Math.min(surfaceMm + rainMmHr * hours,
        infiltrationMmHr * hours, capacityMm - storedMm);
      near(result.infiltratedMm, expected); near(result.storedMm, storedMm + expected);
      near(result.surfaceMm, surfaceMm + rainMmHr * hours - expected);
      assert.equal(result.drainedMm, 0);
    }
});

test('emptying followed by unsaturated exponential recovery has analytic timing', () => {
  const result = advanceDrainingLayer({...base, surfaceMm: 5, storedMm: 5,
    rainMmHr: 0, hours: 3});
  // The full layer accepts 5 mm/hour for one hour, then drains alone for two.
  near(result.infiltratedMm, 5); near(result.surfaceMm, 0);
  near(result.storedMm, 5 * Math.exp(-2)); near(result.drainedMm, 10 - 5 * Math.exp(-2));
  const noFill = advanceDrainingLayer({...base, capacityMm: 100, rainMmHr: 2, hours: 3});
  near(noFill.infiltratedMm, 6); near(noFill.storedMm, 2 * (1 - Math.exp(-3)));
  near(noFill.surfaceMm, 0);
});

test('tiny positive drainage survives cancellation and zero duration preserves the state', () => {
  const tiny = advanceDrainingLayer({...base, capacityMm: 100, rainMmHr: 2,
    drainagePerHour: 1e-12});
  near(tiny.drainedMm, 1e-12, 1e-23); assert.ok(tiny.drainedMm > 0);
  const zero = advanceDrainingLayer({...base, surfaceMm: 7, storedMm: 2, hours: 0});
  assert.equal(zero.surfaceMm, 7); assert.equal(zero.storedMm, 2);
  assert.equal(zero.infiltratedMm, 0); assert.equal(zero.drainedMm, 0);
});

test('subnormal drainage cannot fill a receiver without transferring surface water', () => {
  for (const drainagePerHour of [Number.MIN_VALUE, 1e-323, 1e-320, 1e-310, 1e-300]) {
    const input = {...base, surfaceMm: 1, storedMm: 0, capacityMm: 0.1,
      infiltrationMmHr: 1, drainagePerHour, rainMmHr: 0, hours: 1};
    const result = advanceDrainingLayer(input);
    near(result.surfaceMm, 0.9); near(result.storedMm, 0.1);
    near(result.infiltratedMm, 0.1); near(result.receiverBalanceErrorMm, 0);
    near(result.surfaceBalanceErrorMm, 0);
    const beforeFilling = advanceDrainingLayer({...input, hours: 0.05});
    near(beforeFilling.storedMm, 0.05); near(beforeFilling.infiltratedMm, 0.05);
    near(beforeFilling.surfaceMm, 0.95);
    assert.equal(beforeFilling.limited, false);
  }
});

let seed = 252;
const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32);
function generated() {
  const capacityMm = random() * 60;
  return {surfaceMm: random() * 25, storedMm: random() * capacityMm, capacityMm,
    infiltrationMmHr: random() * 60, drainagePerHour: random() * 6,
    rainMmHr: random() * 60, hours: 0.02 + random() * 5};
}

test('constant-forcing subdivision agrees across held-back transition cases', () => {
  for (let trial = 0; trial < 150; trial++) {
    const input = generated(), whole = advanceDrainingLayer(input), split = random() * input.hours;
    const first = advanceDrainingLayer({...input, hours: split});
    const second = advanceDrainingLayer({...input, surfaceMm: first.surfaceMm,
      storedMm: first.storedMm, hours: input.hours - split});
    near(second.surfaceMm, whole.surfaceMm, 2e-10); near(second.storedMm, whole.storedMm, 2e-10);
    near(first.infiltratedMm + second.infiltratedMm, whole.infiltratedMm, 2e-10);
    near(first.drainedMm + second.drainedMm, whole.drainedMm, 2e-10);
    near(whole.receiverBalanceErrorMm, 0, 2e-10); near(whole.surfaceBalanceErrorMm, 0, 2e-10);
  }
});

// Independently stepped conservative flux reference. It uses no event times,
// logarithms, exponential state solutions or production helper functions.
function reference(input, steps = 80000) {
  let h = input.surfaceMm, s = input.storedMm, infiltrated = 0, drained = 0;
  const dt = input.hours / steps;
  for (let j = 0; j < steps; j++) {
    const out = input.drainagePerHour * s * dt;
    const accepted = Math.min(input.infiltrationMmHr * dt, h + input.rainMmHr * dt,
      Math.max(0, input.capacityMm - s + out));
    h += input.rainMmHr * dt - accepted; s += accepted - out;
    infiltrated += accepted; drained += out;
  }
  return {surfaceMm: h, storedMm: s, infiltratedMm: infiltrated, drainedMm: drained};
}
test('independent conservative ODE reference agrees on unfamiliar bounded parameters', () => {
  for (let trial = 0; trial < 48; trial++) {
    const input = generated(), actual = advanceDrainingLayer(input), expected = reference(input);
    for (const key of ['surfaceMm', 'storedMm', 'infiltratedMm', 'drainedMm'])
      near(actual[key], expected[key], 0.006);
  }
});

test('maintained example changes surface consequences and zero drain matches closed model', () => {
  const {project, layer} = makeDrainingExample(), before = JSON.stringify({project, layer});
  const report = compareDrainingLayer(project, layer);
  const perCellInfiltration = 20 + 19 * Math.log(24 / 19);
  near(report.proposal.draining.absorbedLiters, 4 * perCellInfiltration);
  near(report.proposal.draining.storedLiters, 144 - 4 * perCellInfiltration);
  near(report.proposal.draining.drainingLayer.retainedLiters, 20);
  near(report.proposal.draining.drainingLayer.drainedLiters, 4 * perCellInfiltration - 20);
  near(report.proposal.closed.storedLiters, 124); near(report.proposal.unlimited.storedLiters, 0);
  assert.equal(JSON.stringify({project, layer}), before);
  const zero = compareDrainingLayer(project, {...layer, drainagePerHour: 0, initialStoredMm: 2});
  for (const side of ['existing', 'proposal']) for (const key of ['absorbedLiters', 'storedLiters', 'exitLiters'])
    near(zero[side].closed[key], zero[side].draining[key]);
});

test('routed budgets, cell inventories and passive rain provenance share accepted fluxes', () => {
  const project = makeExample(), {layer} = makeDrainingExample();
  const args = [project.proposal, project.width, project.height, project.weather];
  const result = runRain(...args, {drainingLayer: {...layer, initialStoredMm: 2}, traceBudget: true,
    rainTrace: {sourceCells: project.proposal.map((_, i) => i)}, rainOrigins: {targetCells: [27], fate: 'absorbed'}});
  near(result.massErrorLiters, 0, 1e-8); near(result.drainingLayer.balanceErrorLiters, 0, 1e-8);
  for (const cell of result.waterBudget.cells) near(cell.balanceErrorLiters, 0, 1e-8);
  for (const residual of result.drainingLayer.balanceErrorMm) if (residual !== null) near(residual, 0, 1e-9);
  for (let i = 0; i < project.proposal.length; i++) {
    if (project.proposal[i].surface === layer.surface)
      near(result.drainingLayer.infiltratedMm[i] * project.weather.cellSizeM ** 2,
        result.waterBudget.cells[i].absorbedLiters, 1e-9);
  }
  near(result.rainTrace.absorbedLiters, result.absorbedLiters, 1e-8);
  // Use a map without the offered surface to check unchanged legacy behavior.
  const turf = project.proposal.map(cell => ({...cell, surface: 'turf'}));
  const noLayer = runRain(turf, project.width, project.height, project.weather);
  const noSurface = runRain(turf, project.width, project.height, project.weather, {drainingLayer: layer});
  for (const key of ['absorbedLiters', 'storedLiters', 'exitLiters', 'snapshots'])
    assert.deepEqual(noSurface[key], noLayer[key]);
  assert.equal(noSurface.drainingLayer.affectedCellCount, 0);
});

test('storm ending inside a routing step is integrated without inventing later rainfall', () => {
  const {project, layer} = makeDrainingExample();
  Object.assign(project.weather, {stormMinutes: 17, durationMinutes: 185, stepMinutes: 30});
  const args = [project.proposal, project.width, project.height];
  const coarse = runRain(...args, project.weather, {drainingLayer: layer});
  const fine = runRain(...args, {...project.weather, stepMinutes: 1}, {drainingLayer: layer});
  for (const key of ['storedLiters', 'absorbedLiters']) near(coarse[key], fine[key], 1e-9);
  near(coarse.drainingLayer.drainedLiters, fine.drainingLayer.drainedLiters, 1e-9);
  near(coarse.massErrorLiters, 0, 1e-9);
});

test('reverse rainfall sources agree with separate forward tracers for all surface fates', () => {
  const {project: p, layer} = makeDrainingExample();
  p.proposal[0].elevationM = 0.2; p.proposal[1].surface = 'turf';
  Object.assign(p.weather, {mobilityPerHour: 2, boundaryExitPerHour: 0.7,
    stepMinutes: 7, stormMinutes: 23.4});
  const args = [p.proposal, p.width, p.height, p.weather];
  for (const [fate, key] of Object.entries({stored: 'storedByCellLiters', absorbed: 'absorbedByCellLiters', exit: 'exitByCellLiters'})) {
    const reverse = runRain(...args, {drainingLayer: layer, rainOrigins: {targetCells: [1, 3], fate}}).rainOrigins;
    for (let source = 0; source < 4; source++) {
      const forward = runRain(...args, {drainingLayer: layer, rainTrace: {sourceCells: [source]}}).rainTrace;
      near(reverse.bySourceLiters[source], forward[key][1] + forward[key][3], 1e-8);
    }
    near(reverse.balanceErrorLiters, 0, 1e-8);
    assert.equal(reverse.initialWaterLiters, 0);
  }
});

test('actual dry source retains a separate initial receiver inventory and no rainfall', () => {
  const {project: p, layer} = makeDrainingExample();
  p.weather.rainMmHr = 0;
  const result = runRain(p.proposal, p.width, p.height, p.weather,
    {drainingLayer: {...layer, initialStoredMm: 4}, rainTrace: {sourceCells: [0, 1, 2, 3]}});
  assert.equal(result.rainLiters, 0); assert.equal(result.absorbedLiters, 0);
  assert.equal(result.storedLiters, 0); assert.equal(result.exitLiters, 0);
  assert.equal(result.drainingLayer.initialLiters, 16);
  near(result.drainingLayer.retainedLiters, 16 * Math.exp(-4));
  near(result.drainingLayer.drainedLiters, 16 * (1 - Math.exp(-4)));
  assert.equal(result.rainTrace.rainLiters, 0); assert.equal(result.rainTrace.absorbedLiters, 0);
});

test('original-only replay, bounded work and incompatible-model refusals preserve source', () => {
  const {project, layer} = makeDrainingExample(), text = serializeDrainingLayer(project, layer);
  const reopened = parseDrainingLayer(text);
  assert.deepEqual(reopened, {schema: 'experimental-earth-draining-layer-investigation/1', project, layer});
  assert.deepEqual(compareDrainingLayer(reopened.project, reopened.layer), compareDrainingLayer(project, layer));
  assert.throws(() => parseDrainingLayer(JSON.stringify({...reopened, results: {success: true}})), /saved conclusions/);
  for (const bad of [{capacityMm: -1}, {initialStoredMm: 6}, {drainagePerHour: Infinity},
    {drainagePerHour: '1'}, {surface: 'constructor'}, {source: ''}, {extra: true}])
    assert.throws(() => validateDrainingLayer({...layer, ...bad}, SURFACES));
  assert.throws(() => checkDrainingFileBytes(5 * 1024 * 1024 + 1));
  assert.throws(() => advanceDrainingLayer({...base, storedMm: 6}));
  const args = [project.proposal, project.width, project.height, project.weather];
  assert.throws(() => runRain(...args, {drainingLayer: layer, surfaceWettingFront:
    {surface: 'garden', conductivityMmHr: 10, capillaryDriveMm: 20}}), /separately/);
  assert.throws(() => runRain(...args, {drainingLayer: layer, infiltrationStorage:
    {schema: INFILTRATION_STORAGE_MODEL, surface: 'garden', remainingCapacityMm: 5, source: 'authored'}}), /separately/);
  const big = {...project, width: 24, height: 24, existing: Array(576).fill(project.existing[0]),
    proposal: Array(576).fill(project.proposal[0]), weather: {...project.weather, stepMinutes: 1, durationMinutes: 720}};
  assert.throws(() => compareDrainingLayer(big, layer), /six-run work budget/);
});
