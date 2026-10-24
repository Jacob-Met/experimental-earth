import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, validateProject, compare } from '../core.js';
import { prepareSurfaceHeatStudy, compareSurfaceHeat, inspectSurfaceHeat } from '../surface-heat.js';
import { parseHeatSchedule, formatHeatSchedule } from '../surface-heat-table.js';
import { serializePortableProject, parsePortableProject } from '../project-portability.js';

const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b} by ${Math.abs(a - b)}`);
const layer = { absorptivity: .8, capacityJm2K: 60000, exchangeWm2K: 10, initialC: 25, source: 'Authored analytic control' };
function project(overrides = {}) {
  const p = makeExample();
  p.surfaceHeatStudy = prepareSurfaceHeatStudy(p, { cellIndex: 0, existing: { ...layer }, proposal: { ...layer },
    schedule: [{ minutes: 100, incidentWm2: 500, reservoirC: 25, source: 'Authored forcing' }], ...overrides });
  return p;
}

test('one time constant gives the closed-form forced response and independently integrated exchange', () => {
  const p = project(), result = compareSurfaceHeat(p), row = result.summary.existing.final;
  close(row.temperatureC, 25 + 40 * (1 - Math.exp(-1)));
  close(row.inputJm2, 2400000);
  close(row.exchangedJm2, 2400000 * Math.exp(-1));
  close(row.storedJm2, 2400000 * (1 - Math.exp(-1)), 1e-7);
  close(row.balanceResidualJm2, 0, 1e-7);
});

test('pure exchange matches the engine convection reduction after area normalization', () => {
  // Engine #405 companion's isothermal pure-convection law: C/A=4000 J/(m² K).
  const p = project({ existing: { ...layer, capacityJm2K: 4000, initialC: 56.85 },
    schedule: [{ minutes: 50 / 3, incidentWm2: 0, reservoirC: 26.85, source: 'Unforced common-reservoir control' }] });
  const row = compareSurfaceHeat(p).summary.existing.final;
  close(row.temperatureC, 26.85 + 30 * Math.exp(-2.5));
  close(row.exchangedJm2, 120000 * (1 - Math.exp(-2.5)), 1e-8);
});

test('zero exchange retains incident energy and zero absorption stays constant', () => {
  const p = project({ existing: { ...layer, exchangeWm2K: 0 }, proposal: { ...layer, absorptivity: 0, exchangeWm2K: 0 } });
  const r = compareSurfaceHeat(p);
  close(r.summary.existing.final.temperatureC, 65);
  assert.equal(r.summary.existing.final.exchangedJm2, 0);
  assert.equal(r.summary.existing.timeConstantMinutes, null);
  assert.equal(r.summary.proposal.final.temperatureC, 25);
});

test('a hotter reservoir adds signed exchange heat even with no incident input', () => {
  const p = project({ schedule: [{ minutes: 100, incidentWm2: 0, reservoirC: 50, source: 'Authored hot reservoir' }] });
  const row = compareSurfaceHeat(p).summary.existing.final;
  close(row.temperatureC, 50 - 25 * Math.exp(-1));
  assert.ok(row.exchangedJm2 < 0); assert.ok(row.storedJm2 > 0); close(row.balanceResidualJm2, 0, 1e-7);
});

test('same exposure split into fractional intervals preserves the physical trajectory and energy', () => {
  const unsplit = project(), split = project({ schedule: [0.3, 12.7, 20, 67].map(minutes => ({ minutes, incidentWm2: 500, reservoirC: 25, source: 'Split of same forcing' })) });
  for (const t of [0, .3, 1.375, 13, 37.2, 100]) {
    const a = inspectSurfaceHeat(unsplit.surfaceHeatStudy, t).existing, b = inspectSurfaceHeat(split.surfaceHeatStudy, t).existing;
    close(a.temperatureC, b.temperatureC); close(a.exchangedJm2, b.exchangedJm2, 1e-7);
  }
});

test('high capacity and lower absorption can be cooler during heating but warmer later', () => {
  const p = project({ existing: { ...layer, absorptivity: .85, capacityJm2K: 40000, exchangeWm2K: 12 },
    proposal: { ...layer, absorptivity: .45, capacityJm2K: 160000, exchangeWm2K: 12 },
    schedule: [{ minutes: 60, incidentWm2: 600, reservoirC: 25, source: 'Fictional heating' },
      { minutes: 360, incidentWm2: 0, reservoirC: 25, source: 'Fictional cooling' }] });
  assert.ok(inspectSurfaceHeat(p.surfaceHeatStudy, 60).differenceC < -20);
  assert.ok(inspectSurfaceHeat(p.surfaceHeatStudy, 420).differenceC > 1);
  const r = compareSurfaceHeat(p); assert.ok(r.summary.proposal.maximumC < r.summary.existing.maximumC);
  close(r.summary.existing.maximumC, inspectSurfaceHeat(p.surfaceHeatStudy, 60).existing.temperatureC);
});

// A separate fourth-order time integrator is a test oracle, never the product path.
function reference(study, target, stepsPerMinute = 60) {
  const p = study[target]; let T = p.initialC, E = 0, Q = 0;
  for (const r of study.schedule) {
    const n = Math.ceil(r.minutes * stepsPerMinute), dt = r.minutes * 60 / n, q = p.absorptivity * r.incidentWm2;
    const rhs = temp => [(q - p.exchangeWm2K * (temp - r.reservoirC)) / p.capacityJm2K,
      p.exchangeWm2K * (temp - r.reservoirC)];
    for (let i = 0; i < n; i++) {
      const a = rhs(T), b = rhs(T + dt * a[0] / 2), c = rhs(T + dt * b[0] / 2), d = rhs(T + dt * c[0]);
      T += dt * (a[0] + 2 * b[0] + 2 * c[0] + d[0]) / 6;
      E += dt * (a[1] + 2 * b[1] + 2 * c[1] + d[1]) / 6; Q += q * dt;
    }
  }
  return { T, E, Q };
}
test('piecewise changing reservoirs and incident flux agree with independent temperature/flux integration', () => {
  for (const h of [0, .001, 7, 83]) {
    const p = project({ existing: { ...layer, exchangeWm2K: h, initialC: 12 },
      schedule: [{ minutes: 7.3, incidentWm2: 670, reservoirC: 21, source: 'a' },
        { minutes: 13.9, incidentWm2: 0, reservoirC: -3, source: 'b' },
        { minutes: 21.2, incidentWm2: 200, reservoirC: 38, source: 'c' }] });
    const expected = reference(p.surfaceHeatStudy, 'existing'), actual = compareSurfaceHeat(p).summary.existing.final;
    close(actual.temperatureC, expected.T, 2e-8); close(actual.exchangedJm2, expected.E, .00003); close(actual.inputJm2, expected.Q, .00003);
  }
});

test('small exchange approaches the zero-exchange limit without cancellation', () => {
  const p = project({ existing: { ...layer, exchangeWm2K: 1e-13 }, proposal: { ...layer, exchangeWm2K: 0 } });
  const r = compareSurfaceHeat(p); close(r.summary.existing.final.temperatureC, r.summary.proposal.final.temperatureC, 1e-10);
  assert.ok(r.summary.existing.final.exchangedJm2 > 0);
  close(r.summary.existing.final.balanceResidualJm2, 0, 1e-7);
});

test('large exchange settles to forced equilibrium and includes interval-boundary extrema', () => {
  const p = project({ existing: { ...layer, capacityJm2K: 1000, exchangeWm2K: 1000 },
    schedule: [{ minutes: .1, incidentWm2: 500, reservoirC: 25, source: 'Short forced interval' },
      { minutes: .1, incidentWm2: 0, reservoirC: 25, source: 'Short cooling interval' }] });
  const r = compareSurfaceHeat(p);
  close(r.summary.existing.maximumC, 25.4 * 1 - .4 * Math.exp(-6));
  assert.ok(r.trajectory.some(row => row.minute === .1));
});

test('study is attached to the original selected cell and source without mutating rain state', () => {
  const p = makeExample(), rain = compare(p), original = structuredClone(p);
  p.surfaceHeatStudy = project().surfaceHeatStudy;
  assert.deepEqual(compare(p), rain); compareSurfaceHeat(p); assert.deepEqual(p.existing, original.existing);
  p.proposal[0].surface = 'garden'; assert.equal(compareSurfaceHeat(p).status, 'context-changed');
  p.proposal[0] = structuredClone(original.proposal[0]); p.source = 'A different survey'; assert.equal(compareSurfaceHeat(p).status, 'context-changed');
});

test('unrelated observation or cell selection preserves the declared place while title remains editable', () => {
  const p = project(); p.selectedIndex = 12; p.title = 'Renamed';
  p.observations.push({ cellIndex: 1, minute: 5, depthMm: 2, uncertaintyMm: 1, source: 'Water reading' });
  assert.equal(compareSurfaceHeat(p).status, 'compared');
});

test('portable project retains literal source text and independently recomputes the same heat response', () => {
  const p = project(); p.surfaceHeatStudy.proposal.source = '<img src=x onerror=alert(1)> source, with accents é and a new\nline';
  const restored = parsePortableProject(serializePortableProject(p));
  assert.deepEqual(restored.surfaceHeatStudy, p.surfaceHeatStudy); assert.deepEqual(compareSurfaceHeat(restored), compareSurfaceHeat(p));
});

test('retained invalid properties and unsupported horizons are refused by ordinary project import', () => {
  for (const [key, value] of [['capacityJm2K', 0], ['exchangeWm2K', -1], ['absorptivity', 1.1], ['initialC', true], ['source', '']]) {
    const p = project(); p.surfaceHeatStudy.existing[key] = value; assert.throws(() => validateProject(p), /layer/);
  }
  const p = project(); p.surfaceHeatStudy.schedule[0].source = ''; assert.throws(() => validateProject(p), /interval/);
  p.surfaceHeatStudy.schedule = Array.from({ length: 3 }, () => ({ minutes: 720, incidentWm2: 0, reservoirC: 20, source: 'long' }));
  assert.throws(() => validateProject(p), /horizon/);
});

test('unsupported predicted temperatures refuse the comparison and leave the supplied project intact', () => {
  const p = project({ existing: { ...layer, capacityJm2K: 1000, exchangeWm2K: 0 } }), before = JSON.stringify(p);
  assert.throws(() => compareSurfaceHeat(p), /calculation range/); assert.equal(JSON.stringify(p), before);
});

test('exposure CSV reuses quoted record parsing, preserves sources, and refuses blank numeric cells', () => {
  const rows = [{ minutes: 60, incidentWm2: 600, reservoirC: 25, source: 'sensor, "north"\nmanual check' }];
  assert.deepEqual(parseHeatSchedule(formatHeatSchedule(rows)), rows);
  assert.throws(() => parseHeatSchedule('minutes,incident_w_m2,reservoir_c,source\n60,,25,test'), /decimal|numeric|number/i);
  assert.throws(() => parseHeatSchedule('minutes,minutes,reservoir_c,source\n60,1,25,test'), /columns/);
});

test('inspection refuses times outside the retained schedule', () => {
  const study = project().surfaceHeatStudy;
  for (const t of [-1, 101, Infinity, NaN, '60']) assert.throws(() => inspectSurfaceHeat(study, t), /Inspection time/);
});
