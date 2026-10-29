import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain } from '../core.js';

const near = (actual, expected) => assert.ok(Number.isFinite(actual) &&
  Math.abs(actual - expected) < 1e-7, `${actual} differs from ${expected}`);

test('18 mixed-surface routing courses preserve accepted front, barrier, store and tracer custody', () => {
  let cases = 0, routed = 0, exited = 0;
  for (const moistureDeficit of [0, .3, 1]) for (const capacity of [null, 0, .4])
    for (const boundaryExitPerHour of [0, 2]) {
      const project = makeExample(); project.width = project.height = 3;
      project.existing = Array.from({ length: 9 }, (_, i) => ({
        elevationM: (8 - i) * .012, surface: ['sealed', 'turf', 'garden'][i % 3],
        provenance: 'Independent authored slope; not field data' }));
      project.existing[0].internalBarriers = { east: { closed: true, source: 'Authored closed edge' } };
      project.existing[4].internalBarriers = { south: { crestElevationM: .07, source: 'Authored crest' } };
      Object.assign(project.weather, { rainMmHr: 60, stormMinutes: 17.5, durationMinutes: 60,
        stepMinutes: 7, cellSizeM: 2, mobilityPerHour: .8, boundaryExitPerHour });
      const options = { surfacePressureHead: { schema: 'experimental-earth-pressure-head-model/1',
        surface: 'turf', conductivityMmHr: 10, capillaryDriveMm: 20, moistureDeficit } };
      if (capacity !== null) options.infiltrationStorage = {
        schema: 'experimental-earth-closed-infiltration-store/1', surface: 'turf',
        remainingCapacityMm: capacity, source: 'Authored finite receiving capacity' };
      const before = JSON.stringify({ project, options });
      const plain = runRain(project.existing, 3, 3, project.weather, options);
      const tracked = runRain(project.existing, 3, 3, project.weather, { ...options,
        traceBudget: true, rainTrace: { sourceCells: [0, 1, 2, 3, 4, 5, 6, 7, 8], captureSteps: true } });
      const { waterBudget, rainTrace, ...physical } = tracked;
      assert.deepEqual(physical, plain); assert.equal(JSON.stringify({ project, options }), before);
      near(tracked.massErrorLiters, 0);
      for (const cell of waterBudget.cells) {
        near(cell.balanceErrorLiters, 0);
        const F = tracked.pressureHead.cumulativeInfiltrationMm[cell.cellIndex];
        if (project.existing[cell.cellIndex].surface === 'turf') {
          near(F * 4, cell.absorbedLiters);
          if (capacity !== null) {
            assert.ok(F <= capacity + 1e-12);
            near(F, tracked.infiltrationStorage.retainedMm[cell.cellIndex]);
          }
        } else assert.equal(F, null);
      }
      for (const key of ['rainLiters', 'absorbedLiters', 'exitLiters', 'storedLiters'])
        near(rainTrace[key], tracked[key]);
      const closedEdge = waterBudget.edges.find(edge => edge.a === 0 && edge.b === 1);
      if (closedEdge) { near(closedEdge.aToBLiters, 0); near(closedEdge.bToALiters, 0); }
      routed += Number(waterBudget.edges.some(edge => edge.aToBLiters + edge.bToALiters > 0));
      exited += Number(tracked.exitLiters > 0); cases++;
    }
  assert.equal(cases, 18); assert.equal(routed, 18); assert.equal(exited, 9);
});
