import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { authoredPowerWeather } from './weather-power-fixture.mjs';
import { parsePowerHourly, POWER_HOURLY_FORMAT } from '../weather-power.js';
import { compareShadeHeat, normalizeShadeHeat, serializeShadeHeatInvestigation,
  parseShadeHeatInvestigation, sampleShadeHeatForcing } from '../shade-heat.js';

const sky = { method: 'weighted-continuous-columns', azimuthWeights: [1, 0, 0, 0, 0, 0, 0, 1] };
const close = (a, b, tolerance = 2e-7) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
function hourly() {
  const { project, declaration } = makeShadeHeatExample(), rawText = JSON.stringify(authoredPowerWeather());
  const weather = parsePowerHourly(rawText);
  return { project, declaration: { path: { ...declaration.path, startUtc: weather.startUtc,
    endUtc: weather.endUtc, stepMinutes: 60 }, weather: { format: POWER_HOURLY_FORMAT, rawText } } };
}

test('authored directional light reaches the existing thermal solver with independently scaled DHI', () => {
  const { project, declaration } = makeShadeHeatExample(), before = JSON.stringify(project);
  const input = { ...declaration, directNormalWm2: 0, diffuseSky: sky };
  const weighted = compareShadeHeat(project, input);
  const isotropic = compareShadeHeat(project, { ...input, diffuseSky: { method: 'continuous-columns' } });
  close(weighted.diffuseSky.proposal.transmission[0], .12331758940595662, 3e-14);
  assert.ok(weighted.summary.proposal.final.upper.surfaceC < isotropic.summary.proposal.final.upper.surfaceC);
  for (const target of ['existing', 'proposal']) {
    const transmission = weighted.diffuseSky[target].transmission[0];
    const independent = compareShadeHeat(project, { ...declaration, directNormalWm2: 0,
      diffuseHorizontalWm2: declaration.diffuseHorizontalWm2 * transmission });
    for (let i = 0; i < weighted.trajectory.length; i++)
      for (const field of ['surfaceC', 'subsurfaceC', 'inputJm2', 'exchangeOutJm2', 'surfaceStoredJm2', 'subsurfaceStoredJm2'])
        close(weighted.trajectory[i][target].lower[field], independent.trajectory[i][target].lower[field]);
  }
  assert.equal(JSON.stringify(project), before);
});

test('zero diffuse light preserves beam-only results and uniform weights preserve isotropic courses exactly', () => {
  const { project, declaration } = makeShadeHeatExample();
  const beam = compareShadeHeat(project, { ...declaration, diffuseHorizontalWm2: 0 });
  const weighted = compareShadeHeat(project, { ...declaration, diffuseHorizontalWm2: 0, diffuseSky: sky });
  assert.deepEqual(weighted.trajectory, beam.trajectory); assert.deepEqual(weighted.summary, beam.summary);
  assert.equal(weighted.estimatedRayTests, beam.estimatedRayTests);
  const continuous = compareShadeHeat(project, { ...declaration, diffuseSky: { method: 'continuous-columns' } });
  for (const n of [4, 8, 16]) {
    const equal = compareShadeHeat(project, { ...declaration,
      diffuseSky: { method: sky.method, azimuthWeights: Array(n).fill(2) } });
    assert.deepEqual(equal.trajectory, continuous.trajectory); assert.deepEqual(equal.summary, continuous.summary);
    assert.deepEqual(equal.intervals, continuous.intervals);
  }
});

test('typed v5 constant and original-hourly sources retain raw weights and recompute on reopening', () => {
  for (const { project, declaration } of [makeShadeHeatExample(), hourly()]) {
    const input = { ...declaration, diffuseSky: sky }, text = serializeShadeHeatInvestigation(project, input);
    const raw = JSON.parse(text), reopened = parseShadeHeatInvestigation(text);
    assert.equal(raw.kind, 'experimental-earth/shade-heat-inputs/5'); assert.equal(raw.model.version, 5);
    assert.deepEqual(Object.keys(raw), ['kind', 'model', 'project', 'declaration']);
    assert.deepEqual(raw.declaration.diffuseSky, sky);
    assert.deepEqual(reopened.report, compareShadeHeat(project, input));
    assert.equal(serializeShadeHeatInvestigation(reopened.investigation.project, reopened.investigation.declaration), text);
    if (declaration.weather) assert.equal(raw.declaration.weather.rawText, declaration.weather.rawText);
  }
});

test('v5 rejects forged results, different model envelopes and malformed profiles without fallback', () => {
  const { project, declaration } = makeShadeHeatExample();
  const text = serializeShadeHeatInvestigation(project, { ...declaration, diffuseSky: sky });
  for (const mutate of [r => r.report = {}, r => r.model.version = 4,
    r => r.kind = 'experimental-earth/shade-heat-inputs/4', r => r.model.sky = 'invented',
    r => r.declaration.diffuseSky.method = 'continuous-columns',
    r => r.declaration.diffuseSky.transmission = [0, 1],
    r => r.declaration.diffuseSky.azimuthWeights = [0, 0, 0, 0],
    r => r.declaration.diffuseSky.azimuthWeights = [1, null, 0, 0],
    r => r.declaration.diffuseSky.azimuthSamples = 32]) {
    const raw = JSON.parse(text); mutate(raw); assert.throws(() => parseShadeHeatInvestigation(JSON.stringify(raw)));
  }
  assert.throws(() => normalizeShadeHeat({ ...declaration, diffuseSky: { method: sky.method, azimuthWeights: Array(4) } }));
  const old = JSON.parse(serializeShadeHeatInvestigation(project, { ...declaration, diffuseSky: { method: 'continuous-columns' } }));
  old.declaration.diffuseSky = sky; assert.throws(() => parseShadeHeatInvestigation(JSON.stringify(old)));
});

test('one authored profile applies to coherent roof endpoints and preserves the separate solar-grid refusal', () => {
  const { project, declaration } = makeShadeHeatExample(); project.solarStudy.proposal[0].heightMinM = 0;
  const input = { ...declaration, directNormalWm2: 0, diffuseSky: sky }, envelope = compareShadeHeat(project, input);
  for (const height of [.2, 1.1, 2.7]) {
    const source = structuredClone(project); source.solarStudy.proposal[0].heightMinM = height;
    source.solarStudy.proposal[0].heightMaxM = height;
    const actual = compareShadeHeat(source, input);
    for (let i = 0; i < actual.trajectory.length; i++) for (const field of ['surfaceC', 'subsurfaceC']) {
      assert.ok(actual.trajectory[i].proposal.lower[field] >= envelope.trajectory[i].proposal.lower[field] - 1e-8);
      assert.ok(actual.trajectory[i].proposal.upper[field] <= envelope.trajectory[i].proposal.upper[field] + 1e-8);
    }
  }
  const originalHourly = hourly();
  assert.throws(() => sampleShadeHeatForcing(originalHourly.project,
    { ...originalHourly.declaration, diffuseSky: sky }, 30), /uniform diffuse/);
  const cells = project.width * project.height;
  assert.ok(envelope.estimatedSkyFaceTests <= 4 * (4 * (cells - 1) + 4 + sky.azimuthWeights.length - 4) * (cells - 1));
});
