import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain, validateProject, compare } from '../core.js';
import { compareRainOrigins, rainOriginSignature } from '../rain-origin-study.js';
import { createRainOriginTracer } from '../rain-origins.js';

const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const sum = values => values.reduce((a, b) => a + b, 0);
function fixture() {
  const p = makeExample();p.width = p.height = 2;p.selectedIndex = 0;
  p.existing = ['sealed', 'garden', 'turf', 'sealed'].map((surface, i) =>
    ({ surface, elevationM: i === 0 ? 0.8 : i === 2 ? -0.2 : 0, provenance: 'authored time-origin control' }));
  p.proposal = structuredClone(p.existing);
  Object.assign(p.weather, { rainMmHr: 113, stormMinutes: 13.2, durationMinutes: 30.7,
    stepMinutes: 7, cellSizeM: 2.3, mobilityPerHour: 10, boundaryExitPerHour: 3 });
  return p;
}
const run = (p, study, extra = {}) => runRain(p.existing, p.width, p.height, p.weather,
  { ...extra, rainOrigins: study });

test('every source and fate at exact times agrees with independently carried forward rain tags', () => {
  for (const p of [fixture(), makeExample()]) {
    const targetCells = [1, p.existing.length - 1], area = p.weather.cellSizeM ** 2;
    const forward = p.existing.map((_, source) => runRain(p.existing, p.width, p.height, p.weather,
      { rainTrace: { sourceCells: [source], captureSteps: true } }).rainTrace.snapshots);
    const times = forward[0].filter((_, i, a) => i === 0 || i === 1 ||
      i === Math.floor(a.length / 2) || i === a.length - 1).map(s => s.minute);
    for (const minute of times) for (const fate of ['stored', 'absorbed', 'exit']) {
      const reverse = run(p, { targetCells, fate, minute }).rainOrigins;
      for (let source = 0; source < p.existing.length; source++) {
        const s = forward[source].find(s => s.minute === minute);
        const values = fate === 'stored' ? s.depthsMm.map(d => d * area) :
          s[fate === 'absorbed' ? 'absorbedByCellLiters' : 'exitByCellLiters'];
        close(reverse.bySourceLiters[source], sum(targetCells.map(i => values[i])));
      }
      close(reverse.balanceErrorLiters, 0);
      close(reverse.targetTotalLiters, reverse.rainfallLiters);
      assert.equal(reverse.minute, minute);
    }
  }
});

test('each source closes across all destinations and fates at every fractional-course step', () => {
  const p = fixture(), targetCells = [0, 1, 2, 3];
  const times = runRain(p.existing, p.width, p.height, p.weather).snapshots.map(s => s.minute);
  for (const minute of times) {
    const results = ['stored', 'absorbed', 'exit'].map(fate => run(p, { targetCells, fate, minute }).rainOrigins);
    const entered = p.weather.rainMmHr * Math.min(minute, p.weather.stormMinutes) / 60 * p.weather.cellSizeM ** 2;
    for (let i = 0; i < 4; i++) close(sum(results.map(r => r.bySourceLiters[i])), entered);
  }
  assert.equal(times.at(-1), 30.7);
});

test('a timed query cannot depend on forcing or simulation duration after its boundary', () => {
  const a = fixture();a.weather.stormMinutes = 7;
  const b = structuredClone(a);b.weather.stormMinutes = 28;b.weather.durationMinutes = 70;
  assert.notEqual(runRain(a.existing, 2, 2, a.weather).rainLiters,
    runRain(b.existing, 2, 2, b.weather).rainLiters);
  for (const fate of ['stored', 'absorbed', 'exit']) {
    const study = { targetCells: [0, 3], fate, minute: 7 };
    assert.deepEqual(run(a, study).rainOrigins, run(b, study).rainOrigins);
  }
});

test('minute-zero and an earlier stored fate separate initial inventory from rainfall', () => {
  function recorded(minute, fate, targetCells) {
    const t = createRainOriginTracer(2, 1, { targetCells, fate, minute }, 3, [[0, 1]], [2, 0]);
    t.rain(1);t.absorb(0, 1, 3);t.absorb(1, 0, 1);t.transfer(0, 1, 1, 2, 0);t.endStep();
    t.rain(0);t.absorb(0, 0.25, 1);t.absorb(1, 0.5, 2);t.transfer(1, 0, 0.5, 1.5, 0);t.endStep();
    return t.finish([1.25, 1], [
      { minute: 0, depthsMm: [2, 0] }, { minute: 5, depthsMm: [1, 2] },
      { minute: 10, depthsMm: [1.25, 1] },
    ]);
  }
  const zero = recorded(0, 'stored', [0, 1]);
  assert.deepEqual(zero.bySourceLiters, [0, 0]);assert.equal(zero.initialWaterLiters, 2);
  assert.equal(zero.targetTotalLiters, 2);assert.equal(zero.balanceErrorLiters, 0);
  for (const fate of ['absorbed', 'exit']) assert.equal(recorded(0, fate, [0, 1]).targetTotalLiters, 0);
  const stored = recorded(5, 'stored', [1]);
  close(stored.initialWaterLiters, 2 / 3);close(stored.rainfallLiters, 4 / 3);
  close(stored.targetTotalLiters, 2);close(stored.balanceErrorLiters, 0);
  const absorbed = recorded(5, 'absorbed', [0, 1]);
  close(absorbed.initialWaterLiters, 2 / 3);close(absorbed.rainfallLiters, 1 / 3);
  close(absorbed.targetTotalLiters, 1);
});

test('explicit end time preserves every legacy final-origin value and all other solver outputs', () => {
  const p = fixture();
  for (const fate of ['stored', 'absorbed', 'exit']) {
    const plain = run(p, { targetCells: [0, 2], fate }).rainOrigins;
    const timed = run(p, { targetCells: [0, 2], fate, minute: 30.7 }).rainOrigins;
    delete timed.minute;assert.deepEqual(timed, plain);
  }
  const extra = { traceBudget: true, rainTrace: { sourceCells: [0, 2], captureSteps: true } };
  const plain = runRain(p.existing, 2, 2, p.weather, extra);
  const timed = run(p, { targetCells: [1], fate: 'stored', minute: 14 }, extra);
  delete timed.rainOrigins;assert.deepEqual(timed, plain);
});

test('timed paired queries preserve inputs, retain their clock and admit only actual step times', () => {
  const p = fixture();p.rainOriginStudy = { targetCells: [3, 1], fate: 'stored', minute: 14 };
  const before = JSON.stringify(p), signature = rainOriginSignature(p), r = compareRainOrigins(p);
  assert.equal(JSON.stringify(p), before);assert.equal(r.minute, 14);
  assert.deepEqual(r.availableMinutes, [0, 7, 14, 21, 28, 30.7]);
  assert.equal(r.existing.minute, r.proposal.minute);
  assert.deepEqual(JSON.parse(JSON.stringify(p)).rainOriginStudy, p.rainOriginStudy);
  p.rainOriginStudy.minute = 21;assert.notEqual(rainOriginSignature(p), signature);
  for (const minute of [-1, Infinity, NaN, '14']) {
    p.rainOriginStudy.minute = minute;assert.throws(() => validateProject(p), /origin time/);
  }
  p.rainOriginStudy.minute = 15;assert.throws(() => compareRainOrigins(p), /not interpolated/);
  p.rainOriginStudy.minute = 100;assert.throws(() => compareRainOrigins(p), /within the modeled event/);
});

test('stale query time leaves the site usable and can return to the modeled end', () => {
  const p = makeExample();p.rainOriginStudy = { targetCells: [29], fate: 'stored', minute: 60 };
  close(compareRainOrigins(p).existing.rainfallLiters, 173.38574948492663);
  p.weather.durationMinutes = 30;p.weather.stormMinutes = 30;
  assert.doesNotThrow(() => validateProject(p));assert.doesNotThrow(() => compare(p));
  assert.throws(() => compareRainOrigins(p), /within the modeled event/);
  delete p.rainOriginStudy.minute;
  assert.equal(compareRainOrigins(p).minute, 30);
});

test('roundoff-equivalent boundary queries report the actual solver clock without interpolation', () => {
  const p = fixture();Object.assign(p.weather, { stepMinutes: 1.1, durationMinutes: 7.7, stormMinutes: 5 });
  const r = run(p, { targetCells: [1], fate: 'absorbed', minute: 3.3 });
  assert.equal(r.rainOrigins.minute, r.snapshots[3].minute);
  close(r.rainOrigins.minute, 3.3, 1e-12);
  assert.throws(() => run(p, { targetCells: [1], fate: 'absorbed', minute: 3.4 }), /not interpolated/);
});
