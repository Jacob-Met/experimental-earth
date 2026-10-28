import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { authoredPowerWeather } from './weather-power-fixture.mjs';
import { parsePowerHourly } from '../weather-power.js';
import { prepareShadeHeatSource, parseShadeHeatSource, prepareShadeHeatInvestigation,
  sampleShadeHeatForcing } from '../shade-heat.js';
import { compareShadeHeatSampling, prepareShadeHeatSampling } from '../shade-heat-sampling.js';

function inputs() {
  const { project, declaration } = makeShadeHeatExample();
  const rawText = JSON.stringify(authoredPowerWeather()), weather = parsePowerHourly(rawText);
  const hourly = { path: { ...declaration.path, latitudeDeg: weather.latitudeDeg,
    longitudeDeg: weather.longitudeDeg, startUtc: weather.startUtc, endUtc: weather.endUtc, stepMinutes: 60 },
    weather: { format: weather.format, rawText } };
  return { project, declaration, hourly };
}

test('extracted source admission preserves all four original input models across the sampling integration', () => {
  const { project, declaration, hourly } = inputs();
  for (const [input, version] of [[declaration, 1], [hourly, 2],
    [{ ...hourly, diffuseSky: { azimuthSamples: 32, elevationBands: 16 } }, 3],
    [{ ...hourly, diffuseSky: { method: 'continuous-columns' } }, 4]]) {
    const before = JSON.stringify({ project, input });
    const source = prepareShadeHeatSource(project, input);
    assert.equal(source.kind, 'experimental-earth/shade-heat-inputs/' + version);
    assert.equal(source.model.version, version);
    assert.deepEqual(Object.keys(source).sort(), ['declaration', 'kind', 'model', 'project']);
    assert.deepEqual(parseShadeHeatSource(JSON.stringify(source)), source);
    assert.deepEqual(prepareShadeHeatInvestigation(project, input).investigation, source);
    if (input.weather) assert.equal(source.declaration.weather.rawText, hourly.weather.rawText);
    assert.throws(() => parseShadeHeatSource(JSON.stringify({ ...source, report: { status: 'compared' } })));
    assert.equal(JSON.stringify({ project, input }), before);
  }
});

test('solar-grid comparison refuses either mapped-sky model instead of silently changing its retained uniform model', () => {
  const { project, hourly } = inputs();
  const ordinary = prepareShadeHeatSampling(project, hourly);
  assert.equal(ordinary.investigation.source.kind, 'experimental-earth/shade-heat-inputs/2');
  assert.deepEqual(ordinary.report.courses.map(row => row.solarStepMinutes), [60, 30, 15]);
  for (const diffuseSky of [{ azimuthSamples: 32, elevationBands: 16 }, { method: 'continuous-columns' }]) {
    const input = { ...hourly, diffuseSky }, before = JSON.stringify({ project, input });
    for (const step of [60, 30, 15]) assert.throws(() => sampleShadeHeatForcing(project, input, step), /uniform diffuse input/);
    assert.throws(() => compareShadeHeatSampling(project, input), /uniform diffuse input/);
    assert.throws(() => prepareShadeHeatSampling(project, input));
    assert.equal(prepareShadeHeatInvestigation(project, input).report.status, 'compared');
    assert.equal(JSON.stringify({ project, input }), before);
  }
  assert.deepEqual(prepareShadeHeatSampling(project, hourly), ordinary);
});
