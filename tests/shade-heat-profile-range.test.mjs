import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { prepareSolarStudy } from '../solar-occlusion.js';
import { compareShadeHeat, prepareShadeHeatSource, serializeShadeHeatInvestigation } from '../shade-heat.js';
import { authoredPowerWeather } from './weather-power-fixture.mjs';
import { parsePowerHourly, POWER_HOURLY_FORMAT } from '../weather-power.js';
import { normalizeProfileRangeQuery, compareShadeHeatProfileRange, prepareShadeHeatProfileRange,
  serializeShadeHeatProfileRange, parseShadeHeatProfileRange } from '../shade-heat-profile-range.js';

const targets = ['existing', 'proposal'], bounds = ['lower', 'upper'], stores = ['surfaceC', 'subsurfaceC'];
const close = (a, b, tolerance = 3e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const sky = weights => ({ method: 'weighted-continuous-columns', azimuthWeights: weights });
function opposite() {
  const f = makeShadeHeatExample(); f.declaration.directNormalWm2 = 0;
  f.project.solarStudy = prepareSolarStudy(f.project, { ...f.project.solarStudy,
    existing: [{ cellIndex: 4, heightMinM: 3, heightMaxM: 3, source: 'Authored west column' }],
    proposal: [{ cellIndex: 6, heightMinM: 3, heightMaxM: 3, source: 'Authored east column' }] });
  return f;
}
function hourly(f) {
  const rawText = JSON.stringify(authoredPowerWeather()), w = parsePowerHourly(rawText);
  return { project: f.project, declaration: { path: { ...f.declaration.path, startUtc: w.startUtc,
    endUtc: w.endUtc, stepMinutes: 60 }, weather: { format: POWER_HOURLY_FORMAT, rawText } } };
}

test('one geometry basis matches every full one-hot course at 4, 8 and 16 bins', () => {
  for (const f of [opposite(), hourly(opposite())]) for (const bins of [4, 8, 16]) {
    const before = JSON.stringify(f), r = compareShadeHeatProfileRange(f.project, f.declaration, { bins });
    for (const vertex of r.vertices) {
      const independent = compareShadeHeat(f.project, { ...f.declaration, diffuseSky: sky(vertex.profile) });
      for (const target of targets) for (const bound of bounds) for (const field of stores)
        close(vertex.targets[target].final[bound][field], independent.summary[target].final[bound][field]);
    }
    assert.equal(r.work.geometryPasses, 1); assert.equal(r.work.executedThermalCourses, 4 * bins);
    assert.equal(r.work.courseIntervals, 4 * bins * (f.declaration.weather ? 24 : 16));
    assert.ok(r.work.actualSkyFaceTests <= r.work.estimatedSkyFaceTests);
    assert.equal(JSON.stringify(f), before);
  }
});

test('shared profiles reveal opposite signs while isotropic brightness cancels', () => {
  const f = opposite(), r = compareShadeHeatProfileRange(f.project, f.declaration, { bins: 8 });
  const uniform = compareShadeHeat(f.project, { ...f.declaration, diffuseSky: sky(Array(8).fill(1)) });
  for (const field of stores) {
    close(uniform.summary.proposal.final.lower[field] - uniform.summary.existing.final.upper[field], 0);
    assert.ok(r.ranges[field].lower.differenceC < -4); assert.ok(r.ranges[field].upper.differenceC > 4);
    close(r.ranges[field].lower.differenceC, -r.ranges[field].upper.differenceC);
    for (const bound of bounds) {
      const w = r.ranges[field][bound], v = r.vertices[w.bin];
      assert.deepEqual(w.profile, v.profile);
      close(w.differenceC, w.proposalC - w.existingC);
      assert.equal(w.bin, r.vertices.findIndex(x => x.difference[field][bound === 'lower' ? 0 : 1] === w.differenceC));
    }
  }
});

test('identical scenarios remain zero instead of combining different sky profiles', () => {
  const f = makeShadeHeatExample(); f.declaration.directNormalWm2 = 0;
  f.project.solarStudy.existing = structuredClone(f.project.solarStudy.proposal);
  const r = compareShadeHeatProfileRange(f.project, f.declaration, { bins: 8 });
  for (const field of stores) {
    assert.equal(r.ranges[field].lower.differenceC, 0); assert.equal(r.ranges[field].upper.differenceC, 0);
    const wrong = Math.min(...r.vertices.map(v => v.targets.proposal.final.lower[field]))
      - Math.max(...r.vertices.map(v => v.targets.existing.final.upper[field]));
    assert.ok(wrong < -4, 'Negative control would detect independent scenario optimization');
  }
});

test('mixed profiles with fixed unequal materials and coherent roof choices stay in the paired endpoint range', () => {
  const f = opposite(); f.declaration.directNormalWm2 = 700;
  for (const study of [f.project.surfaceHeatStudy, f.project.heatColumnStudy.heatStudy])
    Object.assign(study.proposal, { absorptivity: .35, capacityJm2K: 65000, exchangeWm2K: 7, initialC: 27 });
  Object.assign(f.project.heatColumnStudy.lowerLayers.proposal, { capacityJm2K: 95000, conductanceWm2K: 12, initialC: 18 });
  for (const target of targets) Object.assign(f.project.solarStudy[target][0], { heightMinM: 1, heightMaxM: 4 });
  const r = compareShadeHeatProfileRange(f.project, f.declaration, { bins: 8 }), weights = [0, 1, 2, 3, 4, 0, 2, 1];
  const mixed = compareShadeHeat(f.project, { ...f.declaration, diffuseSky: sky(weights) });
  for (const target of targets) for (const bound of bounds) for (const field of stores)
    close(mixed.summary[target].final[bound][field], r.vertices.reduce((sum, v, i) =>
      sum + weights[i] / 13 * v.targets[target].final[bound][field], 0));
  for (const heights of [[1, 1], [1, 4], [4, 1], [4, 4], [2.1, 3.2]]) {
    const p = structuredClone(f.project);
    targets.forEach((target, i) => Object.assign(p.solarStudy[target][0], { heightMinM: heights[i], heightMaxM: heights[i] }));
    const exact = compareShadeHeat(p, { ...f.declaration, diffuseSky: sky(weights) });
    for (const field of stores) for (const bound of bounds) {
      const difference = exact.summary.proposal.final[bound][field] - exact.summary.existing.final[bound][field];
      assert.ok(difference >= r.ranges[field].lower.differenceC - 1e-8 && difference <= r.ranges[field].upper.differenceC + 1e-8);
    }
  }
});

test('a refused vertex refuses the whole inquiry even when shaded and mixed courses work', () => {
  const f = makeShadeHeatExample(); f.declaration.directNormalWm2 = 0;
  f.project.solarStudy.existing = structuredClone(f.project.solarStudy.proposal);
  for (const target of targets) {
    for (const study of [f.project.surfaceHeatStudy, f.project.heatColumnStudy.heatStudy])
      Object.assign(study[target], { capacityJm2K: 1000, exchangeWm2K: 0, absorptivity: 1 });
    f.project.heatColumnStudy.lowerLayers[target].conductanceWm2K = 0;
  }
  assert.equal(compareShadeHeat(f.project, { ...f.declaration, diffuseSky: sky([1, 0, 0, 0, 0, 0, 0, 0]) }).status, 'compared');
  assert.equal(compareShadeHeat(f.project, { ...f.declaration, diffuseSky: sky([99, 0, 0, 1, 0, 0, 0, 0]) }).status, 'compared');
  assert.throws(() => compareShadeHeatProfileRange(f.project, f.declaration, { bins: 8 }), /Complete shared-profile inquiry refused.*No partial profile range/);
});

test('strict child sources retain every parent format, original weather and authored profile without derived fields', () => {
  for (const f of [makeShadeHeatExample(), hourly(makeShadeHeatExample())]) for (const diffuseSky of [undefined,
    { azimuthSamples: 8, elevationBands: 4 }, { method: 'continuous-columns' }, sky([1, 0, 0, 0, 0, 0, 0, 1])]) {
    const declaration = diffuseSky ? { ...f.declaration, diffuseSky } : f.declaration;
    const before = serializeShadeHeatInvestigation(f.project, declaration), text = serializeShadeHeatProfileRange(f.project, declaration, { bins: 4 });
    const raw = JSON.parse(text), replay = parseShadeHeatProfileRange(text);
    assert.deepEqual(Object.keys(raw), ['kind', 'model', 'source', 'query']);
    assert.deepEqual(raw.source, prepareShadeHeatSource(f.project, declaration));
    assert.deepEqual(replay, prepareShadeHeatProfileRange(f.project, declaration, { bins: 4 }));
    assert.equal(serializeShadeHeatInvestigation(f.project, declaration), before);
    if (declaration.weather) assert.equal(raw.source.declaration.weather.rawText, declaration.weather.rawText);
  }
});

test('forged results, unsupported queries, stale sources and mixed formats refuse without fallback', () => {
  const f = makeShadeHeatExample(), original = prepareShadeHeatProfileRange(f.project, f.declaration, { bins: 8 }).investigation;
  for (const query of [null, {}, { bins: 0 }, { bins: 12 }, { bins: 4.5 }, { bins: '8' }, { bins: 8, weights: [1] }, { bins: NaN }])
    assert.throws(() => normalizeProfileRangeQuery(query));
  for (const mutate of [r => r.report = {}, r => r.ranges = {}, r => r.query.result = {}, r => r.query.bins = 12,
    r => r.model.version = 2, r => r.model.observable = 'daily peak', r => r.kind = r.source.kind,
    r => r.source.report = {}, r => r.source.project.existing[0].provenance += ' edited']) {
    const raw = structuredClone(original); mutate(raw); assert.throws(() => parseShadeHeatProfileRange(JSON.stringify(raw)));
  }
  assert.throws(() => parseShadeHeatProfileRange('{}')); assert.throws(() => parseShadeHeatProfileRange('x'.repeat(5 * 1024 * 1024 + 1)));
});
