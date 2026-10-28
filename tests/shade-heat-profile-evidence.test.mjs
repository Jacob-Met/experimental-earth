import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { prepareSolarStudy } from '../solar-occlusion.js';
import { compareShadeHeat, prepareShadeHeatSource } from '../shade-heat.js';
import { prepareShadeHeatProfileEvidence, serializeShadeHeatProfileEvidence, parseShadeHeatProfileEvidence } from '../shade-heat-profile-evidence.js';
import { intersectProfileBand, evaluateProfileMixture, profileFraction } from '../shade-heat-profile-band.js';
import { authoredPowerWeather } from './weather-power-fixture.mjs';
import { parsePowerHourly, POWER_HOURLY_FORMAT } from '../weather-power.js';

const close = (a,b,t=2e-11) => assert.ok(Math.abs(a-b) <= t, `${a} != ${b}`);
function fixture() {
  const f = makeShadeHeatExample(); f.declaration.directNormalWm2 = 0;
  f.project.solarStudy = prepareSolarStudy(f.project, { ...f.project.solarStudy,
    existing: [{ cellIndex: 4, heightMinM: 3, heightMaxM: 3, source: 'Authored west column' }],
    proposal: [{ cellIndex: 6, heightMinM: 3, heightMaxM: 3, source: 'Authored east column' }] });
  return f;
}
function query(f, temperatureC=22, halfWidthC=.1, bins=8) {
  return { bins, reading: { target: 'existing', store: 'surfaceC', aggregation: 'instant',
    cellIndex: f.project.heatColumnStudy.heatStudy.cellIndex, utc: new Date(f.declaration.path.endUtc).toISOString(),
    temperatureC, halfWidthC, source: 'Authored independent reading-band control; not a field measurement' } };
}

test('a temperature band admits mixtures when every one-bin profile is excluded and changes the paired conclusion', () => {
  const f=fixture(), before=JSON.stringify(f), {report:r}=prepareShadeHeatProfileEvidence(f.project,f.declaration,query(f));
  assert.equal(r.status,'compared'); assert.equal(r.compatibility,'compatible'); assert.equal(r.work.profileIntersection.admittedOriginalVertices,0);
  assert.equal(r.work.profileIntersection.mixedVertices,24);
  assert.ok(r.originalRanges.surfaceC.lower.differenceC < -5);
  assert.ok(r.ranges.surfaceC.lower.differenceC.lower > 2.3); assert.ok(r.ranges.surfaceC.upper.differenceC.upper < 4);
  for (const w of r.witnesses) {
    assert.equal(w.support.length,2);
    const weights=w.weights.map(x=>x.lower);
    const replay=compareShadeHeat(f.project,{...f.declaration,diffuseSky:{method:'weighted-continuous-columns',azimuthWeights:weights}});
    for(const target of ['existing','proposal'])for(const bound of ['lower','upper'])for(const store of ['surfaceC','subsurfaceC'])
      close(replay.summary[target].final[bound][store],w.targets[target][bound][store].lower);
    assert.ok(w.observedC.lower >= r.readingBandC.lower.lower && w.observedC.upper <= r.readingBandC.upper.upper);
  }
  assert.equal(JSON.stringify(f),before);
});

test('exact zero-width, wide and incompatible bands remain distinct without dropping mixed profiles', () => {
  const f=fixture();
  const zero=prepareShadeHeatProfileEvidence(f.project,f.declaration,query(f,22,0)).report;
  assert.equal(zero.compatibility,'compatible'); assert.equal(zero.work.profileIntersection.mixedVertices,12);
  for(const w of zero.witnesses)assert.deepEqual(w.observedC,{exact:{numerator:'22',denominator:'1'},lower:22,upper:22});
  const wide=prepareShadeHeatProfileEvidence(f.project,f.declaration,query(f,23,20)).report;
  assert.equal(wide.work.profileIntersection.mixedVertices,0);
  for(const store of ['surfaceC','subsurfaceC'])for(const bound of ['lower','upper'])
    close(wide.ranges[store][bound].differenceC[bound],wide.originalRanges[store][bound].differenceC);
  const none=prepareShadeHeatProfileEvidence(f.project,f.declaration,query(f,40,.1)).report;
  assert.equal(none.status,'compared'); assert.equal(none.compatibility,'incompatible'); assert.equal(none.ranges,null); assert.deepEqual(none.witnesses,[]);
  const coarse=prepareShadeHeatProfileEvidence(f.project,f.declaration,query(f,22,.1,4)).report;
  assert.equal(coarse.compatibility,'incompatible', 'A coarser static profile family need not admit the same observation');
});

test('exact fraction intersections retain tiny coefficients, closed boundaries, duplicates and sparse refusal', () => {
  const r=intersectProfileBand([0,1,2,3],{temperatureC:1,halfWidthC:0});
  assert.equal(r.work.admittedOriginalVertices,1); assert.equal(r.work.mixedVertices,2);
  for(const c of r.candidates)assert.deepEqual(profileFraction(evaluateProfileMixture(c,[0,1,2,3])).exact,{numerator:'1',denominator:'1'});
  const tiny=intersectProfileBand([0,Number.MIN_VALUE,2*Number.MIN_VALUE,3*Number.MIN_VALUE],{temperatureC:Number.MIN_VALUE,halfWidthC:0});
  assert.equal(tiny.work.mixedVertices,2);
  const same=intersectProfileBand([2,2,2,2],{temperatureC:2,halfWidthC:0});assert.equal(same.candidates.length,4);
  assert.equal(intersectProfileBand([2,2,2,2],{temperatureC:3,halfWidthC:0}).status,'incompatible');
  assert.throws(()=>intersectProfileBand(new Array(4),{temperatureC:2,halfWidthC:0}));
  assert.throws(()=>intersectProfileBand([0,1],{temperatureC:2,halfWidthC:-1}));
});

test('identical designs remain paired at zero and proposal uncertainty retains both endpoints', () => {
  const f=fixture(); f.project.solarStudy.proposal=structuredClone(f.project.solarStudy.existing);
  const same=prepareShadeHeatProfileEvidence(f.project,f.declaration,query(f)).report;
  for(const store of ['surfaceC','subsurfaceC'])for(const bound of ['lower','upper'])
    assert.equal(same.ranges[store][bound].differenceC[bound],0);
  const g=fixture();Object.assign(g.project.solarStudy.proposal[0],{heightMinM:1,heightMaxM:4});
  const uncertain=prepareShadeHeatProfileEvidence(g.project,g.declaration,query(g)).report;
  assert.equal(uncertain.compatibility,'compatible');
  assert.ok(uncertain.witnesses.some(w=>w.targets.proposal.lower.surfaceC.lower < w.targets.proposal.upper.surfaceC.upper));
});

test('unresolved observation endpoints and any unsupported basis vertex refuse the complete query', () => {
  const f=fixture();Object.assign(f.project.solarStudy.existing[0],{heightMinM:1,heightMaxM:4});
  assert.throws(()=>prepareShadeHeatProfileEvidence(f.project,f.declaration,query(f)),/unresolved forcing endpoints/);
  const g=fixture();
  for(const target of ['existing','proposal']) {
    for(const study of [g.project.surfaceHeatStudy,g.project.heatColumnStudy.heatStudy])
      Object.assign(study[target],{capacityJm2K:1000,exchangeWm2K:0,absorptivity:1});
    g.project.heatColumnStudy.lowerLayers[target].conductanceWm2K=0;
  }
  assert.throws(()=>prepareShadeHeatProfileEvidence(g.project,g.declaration,query(g)),/Complete shared-profile inquiry refused/);
});

test('input-only files preserve original parent formats, weather and attributed reading exactly', () => {
  const f=fixture(), hourly=fixture(),rawText=JSON.stringify(authoredPowerWeather()),weather=parsePowerHourly(rawText);
  hourly.declaration={path:{...hourly.declaration.path,startUtc:weather.startUtc,endUtc:weather.endUtc,stepMinutes:60},weather:{format:POWER_HOURLY_FORMAT,rawText}};
  for(const source of [f,hourly])for(const diffuseSky of [undefined,{azimuthSamples:8,elevationBands:4},{method:'continuous-columns'},
    {method:'weighted-continuous-columns',azimuthWeights:[1,0,0,2]}]) {
    const d=diffuseSky?{...source.declaration,diffuseSky}:source.declaration,q=query(source,23,20,4);
    const text=serializeShadeHeatProfileEvidence(source.project,d,q), raw=JSON.parse(text), restored=parseShadeHeatProfileEvidence(text);
    assert.deepEqual(Object.keys(raw),['kind','model','source','query']);
    assert.deepEqual(raw.source,prepareShadeHeatSource(source.project,d));assert.deepEqual(raw.query,q);
    assert.deepEqual(restored,prepareShadeHeatProfileEvidence(source.project,d,q));
    if(d.weather)assert.equal(restored.investigation.source.declaration.weather.rawText,rawText);
  }
});

test('wrong receiver/time/role and derived saved fields cannot be reinterpreted as original evidence', () => {
  const f=fixture(),raw=prepareShadeHeatProfileEvidence(f.project,f.declaration,query(f)).investigation;
  for(const mutate of [x=>x.report={},x=>x.query.vertices=[],x=>x.query.reading.result=22,
    x=>x.query.reading.target='proposal',x=>x.query.reading.store='subsurfaceC',x=>x.query.reading.aggregation='interval-mean',
    x=>x.query.reading.cellIndex++,x=>x.query.reading.utc='2026-06-21T11:00:00.000Z',x=>x.query.reading.source='',
    x=>x.query.reading.halfWidthC=-1,x=>x.model.version=2,x=>x.source.report={},x=>x.kind=x.source.kind]) {
    const forged=structuredClone(raw);mutate(forged);assert.throws(()=>parseShadeHeatProfileEvidence(JSON.stringify(forged)));
  }
  assert.throws(()=>parseShadeHeatProfileEvidence('[]'));assert.throws(()=>parseShadeHeatProfileEvidence('x'.repeat(5*1024*1024+1)));
});
