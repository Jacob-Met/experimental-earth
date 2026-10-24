import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain, validateProject } from '../core.js';
import { compareRainTrace, rainTraceSignature } from '../rain-trace-study.js';
const close = (a, b, tol = 1e-8) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const vectorClose = (a, b, tol = 1e-8) => { assert.equal(a.length, b.length); a.forEach((v, i) => close(v, b[i], tol)); };
function fixture() {
  const p = makeExample(); p.width = p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({ length: 4 }, () => ({ surface: 'sealed', elevationM: 0, provenance: 'authored analytic control' }));
  p.proposal = structuredClone(p.existing);
  Object.assign(p.weather, { rainMmHr: 60, stormMinutes: 5, durationMinutes: 5, stepMinutes: 5, cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0 });
  return p;
}
function trace(p, sourceCells, options = {}) {
  return runRain(p.existing, p.width, p.height, p.weather, { ...options, rainTrace: { sourceCells } });
}
const noInfiltration = { surfaceInfiltrationOverride: { surface: 'sealed', rateMmHr: 0 } };

test('no-flow source rainfall stays local with analytic absorption and cell area', () => {
  const p = fixture(); p.weather.cellSizeM = 2;
  const { rainTrace: t } = trace(p, [0]);
  close(t.rainLiters, 20); close(t.absorbedLiters, 1 / 3); close(t.exitLiters, 0);
  vectorClose(t.storedByCellLiters, [20 - 1 / 3, 0, 0, 0]);
  vectorClose(t.absorbedByCellLiters, [1 / 3, 0, 0, 0]); close(t.massErrorLiters, 0);
});
test('supply-limited infiltration absorbs all tagged water without inventing flow', () => {
  const p = fixture(); p.weather.rainMmHr = 0.5;
  const { rainTrace: t } = trace(p, [2]);
  close(t.rainLiters, 1 / 24); close(t.absorbedLiters, t.rainLiters);
  close(t.storedLiters, 0); close(t.exitLiters, 0);
});
test('capped simultaneous split moves half the tag to each neighbor with no same-step second hop', () => {
  const p = fixture(); p.existing[0].elevationM = 1; p.weather.mobilityPerHour = 1;
  const r = trace(p, [0], noInfiltration), t = r.rainTrace;
  vectorClose(t.finalDepthMm, [0, 2.5, 2.5, 0]);
  vectorClose(r.finalDepthMm, [0, 7.5, 7.5, 5]); close(t.massErrorLiters, 0);
});
test('uncapped gradient carries the tagged concentration on actual maintained flux', () => {
  const p = fixture(); p.existing[0].elevationM = 0.02; p.weather.mobilityPerHour = 1;
  const t = trace(p, [0], noInfiltration).rainTrace;
  vectorClose(t.finalDepthMm, [5 / 3, 5 / 3, 5 / 3, 0]);
});
test('second-step mixing uses upstream tag fractions and preserves simultaneous update order', () => {
  const p = fixture(); p.existing[0].elevationM = 1; p.weather.mobilityPerHour = 1; p.weather.durationMinutes = 10;
  const t = trace(p, [0], noInfiltration).rainTrace;
  vectorClose(t.finalDepthMm, [0, 2.5 - 5 / 72, 2.5 - 5 / 72, 5 / 36]);
  close(t.storedLiters, 5); close(t.massErrorLiters, 0);
});
test('mixed water infiltrates in proportion to its source contribution', () => {
  const p = fixture(); p.existing.forEach(c => { c.surface = 'garden'; });
  p.existing[0].elevationM = 1; p.weather.mobilityPerHour = 1; p.weather.durationMinutes = 10;
  const t = trace(p, [0], { infiltrationOverride: { cellIndex: 0, rateMmHr: 0 } }).rainTrace;
  close(t.absorbedByCellLiters[1], 10 / 11); close(t.absorbedByCellLiters[2], 10 / 11);
  close(t.absorbedByCellLiters[0], 0); close(t.absorbedByCellLiters[3], 0); close(t.massErrorLiters, 0);
});
test('boundary losses are attributed at the actual exit cell and conserve partial outflow', () => {
  const p = fixture(); p.weather.boundaryExitPerHour = 1;
  const t = trace(p, [0], noInfiltration).rainTrace;
  vectorClose(t.exitByCellLiters, [2.5, 0, 0, 0]); vectorClose(t.storedByCellLiters, [2.5, 0, 0, 0]);
  close(t.massErrorLiters, 0);
  p.weather.boundaryExitPerHour = 10;
  const capped = trace(p, [0], noInfiltration).rainTrace;
  close(capped.exitLiters, 5); close(capped.storedLiters, 0); close(capped.massErrorLiters, 0);
});
test('optional tracing leaves every ordinary water output exactly unchanged', () => {
  const p = makeExample();
  for (const options of [{}, { infiltrationOverride: { cellIndex: 27, rateMmHr: 3 } }, { surfaceInfiltrationOverride: { surface: 'garden', rateMmHr: 40 } }]) {
    const ordinary = runRain(p.existing, p.width, p.height, p.weather, options);
    const { rainTrace, ...traced } = trace(p, [0, 12, 27], options);
    assert.deepEqual(traced, ordinary); assert.ok(rainTrace.rainLiters > 0);
  }
});
test('all-source tag reproduces total water fate and final depth', () => {
  const p = makeExample(); const r = trace(p, p.existing.map((_, i) => i));
  for (const key of ['rainLiters', 'absorbedLiters', 'exitLiters', 'storedLiters']) close(r.rainTrace[key], r[key], 1e-6);
  vectorClose(r.rainTrace.finalDepthMm, r.finalDepthMm); close(r.rainTrace.massErrorLiters, 0, 1e-6);
});
test('disjoint origin regions add to their union without double counting or field changes', () => {
  const p = makeExample(), a = trace(p, [0, 7, 16]).rainTrace, b = trace(p, [12, 27]).rainTrace;
  const union = trace(p, [27, 0, 12, 7, 16]).rainTrace;
  for (const key of ['rainLiters', 'absorbedLiters', 'exitLiters', 'storedLiters']) close(a[key] + b[key], union[key], 1e-6);
  for (const key of ['absorbedByCellLiters', 'exitByCellLiters', 'storedByCellLiters']) vectorClose(a[key].map((v, i) => v + b[key][i]), union[key], 1e-6);
  assert.deepEqual(union.sourceCells, [0, 7, 12, 16, 27]);
});
test('dry and fractional rain periods conserve the selected area supply', () => {
  const p = makeExample(); p.weather.rainMmHr = 0;
  const dry = trace(p, [0, 3]).rainTrace;
  for (const key of ['rainLiters', 'absorbedLiters', 'exitLiters', 'storedLiters', 'massErrorLiters']) assert.equal(dry[key], 0);
  p.weather.rainMmHr = 37; p.weather.stormMinutes = 17.3; p.weather.durationMinutes = 30.7;
  const t = trace(p, [0, 3]).rainTrace;
  close(t.rainLiters, 37 * 17.3 / 60 * 4 * 2); close(t.massErrorLiters, 0, 1e-6);
});
test('invalid origin sets reject both solver options and saved projects', () => {
  const p = fixture();
  for (const sourceCells of [[], [0, 0], [-1], [4], [0.2], ['0'], [NaN], [Infinity], null, 'A1']) {
    assert.throws(() => trace(p, sourceCells), /source cells/);
    assert.throws(() => validateProject({ ...p, rainTraceStudy: { sourceCells } }), /source cells/);
  }
  for (const rainTrace of [null, false, [], {}]) assert.throws(() => runRain(p.existing, 2, 2, p.weather, { rainTrace }), /source cells/);
  assert.throws(() => compareRainTrace(p), /Choose a source/);
});
test('paired consumer keeps sources/weather matched, exposes changed destinations and does not mutate the site', () => {
  const p = fixture(); p.rainTraceStudy = { sourceCells: [0] }; p.weather.mobilityPerHour = 1;
  p.proposal[0].elevationM = 1;
  const before = JSON.stringify(p), result = compareRainTrace(p);
  close(result.delta.rainLiters, 0); close(result.existing.rainLiters, 5);
  assert.ok(result.proposal.storedByCellLiters[1] > result.existing.storedByCellLiters[1]);
  assert.equal(JSON.stringify(p), before);
  p.proposal = structuredClone(p.existing);
  assert.deepEqual(compareRainTrace(p).existing, compareRainTrace(p).proposal);
});
test('source inputs roundtrip without persisting derived outputs and changed inputs change the signature', () => {
  const p = makeExample(); p.rainTraceStudy = { sourceCells: [27, 28] };
  const restored = validateProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(compareRainTrace(restored), compareRainTrace(p));
  const signature = rainTraceSignature(p); p.selectedIndex = 0; p.title = 'Renamed investigation';
  assert.equal(rainTraceSignature(p), signature);
  p.weather.rainMmHr += 1; assert.notEqual(rainTraceSignature(p), signature);
});
test('mixed-source amounts stay nonnegative and bounded by bulk water across varied admissible regimes', () => {
  for (const [mobility, outlet, step, rain] of [[0, 0, 1, 0], [0.1, 0.3, 1, 3], [10, 10, 30, 250], [1.5, 0.1, 7, 67]]) {
    const p = makeExample(); Object.assign(p.weather, { mobilityPerHour: mobility, boundaryExitPerHour: outlet, stepMinutes: step, rainMmHr: rain });
    const r = trace(p, [0, 11, 27, 39]);
    r.rainTrace.finalDepthMm.forEach((d, i) => assert.ok(d >= 0 && d <= r.finalDepthMm[i] + 1e-8));
    for (const key of ['absorbedByCellLiters', 'exitByCellLiters', 'storedByCellLiters']) assert.ok(r.rainTrace[key].every(v => Number.isFinite(v) && v >= 0));
    close(r.rainTrace.massErrorLiters, 0, 1e-6);
  }
});
