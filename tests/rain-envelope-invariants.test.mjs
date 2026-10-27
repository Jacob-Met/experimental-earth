import test from 'node:test';
import assert from 'node:assert/strict';
import { runRain, SURFACES } from '../core.js';

// Deterministic envelope, not a claim of field calibration. It checks the
// maintained rain engine's internal conservation on varied admitted site
// shapes, storm clocks, surfaces, relief and routing/boundary rates.
test('bounded mixed-site rain courses conserve water at every retained time', () => {
  let state = 0x20261027;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const surfaces = Object.keys(SURFACES);
  for (let caseIndex = 0; caseIndex < 240; caseIndex++) {
    const width = 2 + Math.floor(random() * 7);
    const height = 2 + Math.floor(random() * 6);
    const cells = Array.from({ length: width * height }, () => ({
      elevationM: Math.round((random() - 0.5) * 1000) / 1000,
      surface: surfaces[Math.floor(random() * surfaces.length)],
      provenance: 'controlled synthetic source'
    }));
    // Mix source-declared closed edges and overflow crests into ordinary open
    // links. Never replace the exterior outlet with an internal declaration.
    for (let i = 0; i < cells.length; i++) {
      for (const [direction, valid, neighbor] of [
        ['east', i % width < width - 1, i + 1],
        ['south', Math.floor(i / width) < height - 1, i + width]
      ]) {
        if (!valid) continue;
        const draw = random();
        if (draw < 0.10) {
          (cells[i].internalBarriers ??= {})[direction] = {
            closed: true, source: 'controlled closed link'
          };
        } else if (draw < 0.30) {
          (cells[i].internalBarriers ??= {})[direction] = {
            crestElevationM: Math.max(cells[i].elevationM, cells[neighbor].elevationM) + 0.001 + random() * 0.4,
            source: 'controlled overflow crest'
          };
        }
      }
    }
    const stormMinutes = caseIndex % 19 === 0 ? 0 : random() * 720;
    const weather = {
      rainMmHr: caseIndex % 23 === 0 ? 0 : caseIndex % 29 === 0 ? 250 : random() * 250,
      stormMinutes,
      durationMinutes: 720,
      stepMinutes: 1 + Math.floor(random() * 30),
      cellSizeM: 0.25 + random() * 14.75,
      mobilityPerHour: random() * 10,
      boundaryExitPerHour: random() * 10
    };
    const source = JSON.stringify(cells);
    const result = runRain(cells, width, height, weather);
    const cellArea = weather.cellSizeM ** 2;
    const initial = result.snapshots[0];
    assert.equal(initial.minute, 0, `control ${caseIndex}: starts at time zero`);
    let lastMinute = -1;
    for (const snapshot of result.snapshots) {
      assert.ok(snapshot.minute > lastMinute, `control ${caseIndex}: monotone snapshot times`);
      lastMinute = snapshot.minute;
      const retainedVolume = snapshot.depthsMm.reduce((total, depth) => {
        assert.ok(Number.isFinite(depth) && depth >= 0, `control ${caseIndex}: finite nonnegative water`);
        return total + depth * cellArea;
      }, 0);
      const declaredInput = weather.rainMmHr * Math.min(snapshot.minute, stormMinutes) / 60 * cellArea * cells.length;
      const accounted = snapshot.absorbedLiters + snapshot.exitLiters + snapshot.storedLiters;
      const tolerance = 1e-10 * Math.max(1, declaredInput);
      assert.ok(Math.abs(retainedVolume - snapshot.storedLiters) <= tolerance,
        `control ${caseIndex} at ${snapshot.minute}: snapshot depths equal volume`);
      assert.ok(Math.abs(accounted - declaredInput) <= tolerance,
        `control ${caseIndex} at ${snapshot.minute}: intermediate water conservation`);
    }
    assert.equal(lastMinute, weather.durationMinutes, `control ${caseIndex}: complete duration`);
    assert.deepEqual(result.finalDepthMm, result.snapshots.at(-1).depthsMm,
      `control ${caseIndex}: final volume is last snapshot`);
    for (let index = 0; index < cells.length; index++) {
      assert.ok(Number.isFinite(result.peakDepthMm[index]) && result.peakDepthMm[index] >= 0,
        `control ${caseIndex}: valid peak`);
      assert.ok(result.snapshots.every(s => s.depthsMm[index] <= result.peakDepthMm[index] + 1e-10),
        `control ${caseIndex}: peaks include every retained frame`);
    }
    assert.equal(JSON.stringify(cells), source, `control ${caseIndex}: original cells unchanged`);
    assert.ok(Math.abs(result.massErrorLiters) <= 1e-10 * Math.max(1, result.rainLiters),
      `control ${caseIndex}: final water conservation`);
    if (caseIndex < 10) assert.deepEqual(runRain(cells, width, height, weather), result,
      `control ${caseIndex}: deterministic replay`);
  }
});
