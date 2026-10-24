import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { compareShadeHeat, mappedHorizontalIrradiance, normalizeShadeHeat,
  serializeShadeHeatInvestigation, parseShadeHeatInvestigation, checkShadeHeatBytes } from '../shade-heat.js';
import { prepareSolarStudy } from '../solar-occlusion.js';
import { prepareSurfaceHeatStudy } from '../surface-heat.js';
import { prepareHeatColumnStudy } from '../heat-column.js';

const close = (a, b, eps = 1e-7) => assert.ok(Math.abs(a - b) <= eps, `${a} differs from ${b}`);
const freeze = v => { if (v && typeof v === 'object') { Object.freeze(v); Object.values(v).forEach(freeze); } return v; };

test('horizontal projection keeps direct and diffuse independent, including ambiguous and night states', () => {
  close(mappedHorizontalIrradiance('no-mapped-blocker', 30, 700, 80).lower, 430);
  assert.deepEqual(mappedHorizontalIrradiance('blocked', 30, 700, 80).transmission, [0, 0]);
  close(mappedHorizontalIrradiance('blocked', 30, 700, 80).upper, 80);
  for (const status of ['height-dependent', 'grazing', 'low-elevation']) {
    const r = mappedHorizontalIrradiance(status, 30, 700, 80);
    close(r.lower, 80); close(r.upper, 430);
  }
  close(mappedHorizontalIrradiance('below-horizon', -10, 700, 80).upper, 80);
  assert.throws(() => mappedHorizontalIrradiance('footprint', 30, 700, 80), /footprint/);
  assert.throws(() => mappedHorizontalIrradiance('guessed sunny', 30, 700, 80), /Unsupported/);
  assert.throws(() => mappedHorizontalIrradiance('blocked', 30, 1900, 200), /supported finite/);
});

test('actual mapped column changes a dated thermal course and preserves energy accounting and sources', () => {
  const { project, declaration } = makeShadeHeatExample(), before = structuredClone(project);
  const r = compareShadeHeat(freeze(project), freeze(declaration));
  assert.equal(r.intervals.length, 16);
  assert.ok(r.intervals.some(row => row.proposal.status === 'blocked'));
  assert.ok(r.intervals.some(row => row.proposal.status === 'no-mapped-blocker'));
  for (const row of r.intervals.filter(row => row.proposal.status === 'blocked')) {
    assert.equal(row.proposal.witness.cellIndex, 6);
    assert.equal(row.proposal.witness.source, project.solarStudy.proposal[0].source);
    assert.equal(row.proposal.irradiance.lower, 80);
  }
  assert.ok(r.summary.proposal.final.upper.surfaceC < r.summary.existing.final.lower.surfaceC - 10);
  assert.ok(r.summary.proposal.final.upper.subsurfaceC < r.summary.existing.final.lower.subsurfaceC - 10);
  assert.equal(r.summary.proposal.ambiguousIntervals, 0);
  for (const row of r.trajectory) for (const target of ['existing', 'proposal']) for (const bound of ['lower', 'upper']) {
    const state = row[target][bound];
    close(state.inputJm2 - state.exchangeOutJm2, state.surfaceStoredJm2 + state.subsurfaceStoredJm2, 2e-6);
    close(state.transferDownJm2, state.subsurfaceStoredJm2, 2e-6);
  }
  assert.deepEqual(project, before);
});

test('identical geometry and properties give equal courses; zero beam removes the shade effect', () => {
  const { project, declaration } = makeShadeHeatExample();
  project.solarStudy.proposal = [];
  let r = compareShadeHeat(project, declaration);
  assert.deepEqual(r.summary.existing, r.summary.proposal);
  for (const row of r.trajectory) assert.deepEqual(row.difference.surfaceC, [0, 0]);
  const example = makeShadeHeatExample();
  r = compareShadeHeat(example.project, { ...example.declaration, directNormalWm2: 0 });
  assert.deepEqual(r.summary.existing, r.summary.proposal);
  assert.ok(r.summary.proposal.final.lower.surfaceC > 20, 'declared diffuse input still heats a shaded surface');
});

test('independent first-order analytic solution receives the actual first projected irradiance', () => {
  const { project, declaration } = makeShadeHeatExample();
  for (const target of ['existing', 'proposal']) project.heatColumnStudy.lowerLayers[target].conductanceWm2K = 0;
  const r = compareShadeHeat(project, declaration), end = r.intervals[0].toMinute;
  const got = r.trajectory.find(x => x.minute === end);
  for (const target of ['existing', 'proposal']) {
    const p = project.surfaceHeatStudy[target], q = p.absorptivity * r.intervals[0][target].irradiance.lower;
    const equilibrium = declaration.reservoirC + q / p.exchangeWm2K;
    const exact = equilibrium + (p.initialC - equilibrium) * Math.exp(-p.exchangeWm2K * end * 60 / p.capacityJm2K);
    close(got[target].lower.surfaceC, exact);
    assert.equal(got[target].lower.subsurfaceC, 20);
  }
});

test('uncertain mapped heights keep conservative courses containing intermediate physical declarations', () => {
  const { project, declaration } = makeShadeHeatExample();
  project.solarStudy.proposal[0].heightMinM = 0;
  const envelope = compareShadeHeat(project, declaration);
  assert.ok(envelope.summary.proposal.ambiguousIntervals > 0);
  assert.ok(envelope.summary.proposal.final.lower.surfaceC < envelope.summary.proposal.final.upper.surfaceC);
  const expected = new Map(envelope.trajectory.map(r => [r.minute, r.proposal]));
  for (const height of [.01, .4, 1, 1.7, 2.4, 3]) {
    const p = structuredClone(project); p.solarStudy.proposal[0].heightMinM = height; p.solarStudy.proposal[0].heightMaxM = height;
    const r = compareShadeHeat(p, declaration);
    for (const row of r.trajectory) {
      if (!Number.isInteger(row.minute)) continue;
      const e = expected.get(row.minute);
      for (const field of ['surfaceC', 'subsurfaceC']) {
        assert.ok(row.proposal.lower[field] >= e.lower[field] - 1e-8);
        assert.ok(row.proposal.upper[field] <= e.upper[field] + 1e-8);
      }
    }
  }
});

test('night and sub-degree sun retain explicit direct-beam semantics rather than pretending mapped clarity', () => {
  const { project, declaration } = makeShadeHeatExample();
  const night = compareShadeHeat(project, { ...declaration, path: { ...declaration.path,
    startUtc: '2026-12-21T00:00:00Z', endUtc: '2026-12-21T04:00:00Z' } });
  assert.ok(night.intervals.every(row => row.existing.status === 'below-horizon'));
  assert.deepEqual(night.summary.existing, night.summary.proposal);
  const low = compareShadeHeat(project, { ...declaration, path: { ...declaration.path,
    startUtc: '2026-03-20T05:56:00Z', endUtc: '2026-03-20T06:16:00Z', stepMinutes: 1 } });
  assert.ok(low.intervals.some(row => row.existing.status === 'low-elevation'));
  for (const row of low.intervals.filter(r => r.existing.status === 'low-elevation')) {
    assert.equal(row.existing.irradiance.lower, 80);
    assert.ok(row.existing.irradiance.upper > 80);
  }
});

test('changed discretization can change the prediction and is not claimed to enclose continuous sun', () => {
  const { project, declaration } = makeShadeHeatExample();
  const coarse = compareShadeHeat(project, declaration);
  const fine = compareShadeHeat(project, { ...declaration, path: { ...declaration.path, stepMinutes: 20 } });
  assert.equal(fine.intervals.length, 24);
  assert.notEqual(coarse.summary.proposal.final.lower.surfaceC, fine.summary.proposal.final.lower.surfaceC);
  assert.match(fine.semantics, /not sunlight between samples/);
  const odd = compareShadeHeat(project, { ...declaration, path: { ...declaration.path, endUtc: '2026-06-21T04:30:07Z' } });
  assert.equal(odd.intervals.at(-1).sampleOffsetSeconds, -.5);
  close(odd.intervals.at(-1).toMinute, 30 + 7 / 60);
});

test('changed retained source, absent declarations and footprints refuse without guessing a heat point', () => {
  const { project, declaration } = makeShadeHeatExample();
  for (const change of [p => delete p.solarStudy, p => p.existing[0].elevationM += .1,
    p => delete p.heatColumnStudy, p => p.surfaceHeatStudy.existing.initialC += 1,
    p => p.solarStudy.proposal[0].cellIndex = 5]) {
    const p = structuredClone(project); change(p); const before = structuredClone(p);
    assert.throws(() => compareShadeHeat(p, declaration)); assert.deepEqual(p, before);
  }
});

test('full-source input-only export recomputes and refuses derived verdicts or model replacement', () => {
  const { project, declaration } = makeShadeHeatExample();
  project.heatColumnStudy.lowerLayers.existing.source = '<img onerror=bad()> literal authored basis';
  const text = serializeShadeHeatInvestigation(project, declaration), value = JSON.parse(text);
  const reopened = parseShadeHeatInvestigation(text);
  assert.deepEqual(reopened.investigation.project, project);
  assert.deepEqual(reopened.report, compareShadeHeat(project, declaration));
  assert.equal(Object.hasOwn(value, 'report'), false);
  value.report = { temperature: -999 }; assert.throws(() => parseShadeHeatInvestigation(JSON.stringify(value)), /envelope/);
  delete value.report; value.model.version = 999; assert.throws(() => parseShadeHeatInvestigation(JSON.stringify(value)), /model/);
  assert.throws(() => parseShadeHeatInvestigation('['), /Invalid/);
  assert.throws(() => checkShadeHeatBytes(5 * 1024 * 1024 + 1), /limit/);
});

test('complete-work and input limits reject before producing partial courses', () => {
  const { project, declaration } = makeShadeHeatExample();
  for (const input of [{ ...declaration, directNormalWm2: NaN }, { ...declaration, diffuseHorizontalWm2: -1 },
    { ...declaration, weatherSource: ' ' }, { ...declaration, surprise: 5 },
    { ...declaration, path: { ...declaration.path, stepMinutes: 1 } },
    { ...declaration, path: { ...declaration.path, endUtc: '2026-06-21T04:30:01Z' } }]) assert.throws(() => normalizeShadeHeat(input));
  const p = structuredClone(project); p.width = p.height = 24;
  p.existing = Array.from({ length: 576 }, () => ({ ...p.existing[0] })); p.proposal = structuredClone(p.existing);
  p.solarStudy = prepareSolarStudy(p, { ...p.solarStudy });
  delete p.heatColumnStudy; p.surfaceHeatStudy = prepareSurfaceHeatStudy(p, { ...project.surfaceHeatStudy });
  p.heatColumnStudy = prepareHeatColumnStudy(p, structuredClone(project.heatColumnStudy.lowerLayers));
  assert.throws(() => compareShadeHeat(p, declaration), /ray-check budget/);
});
