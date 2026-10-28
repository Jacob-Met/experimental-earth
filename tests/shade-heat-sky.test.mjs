import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { authoredPowerWeather } from './weather-power-fixture.mjs';
import { parsePowerHourly, POWER_HOURLY_FORMAT } from '../weather-power.js';
import { compareShadeHeat, mappedSkyHorizontalIrradiance, normalizeShadeHeat,
 serializeShadeHeatInvestigation, parseShadeHeatInvestigation } from '../shade-heat.js';
const sky={azimuthSamples:32,elevationBands:16};
const close=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<=epsilon,a+' differs from '+b);
function hourly(){const {project,declaration}=makeShadeHeatExample(),rawText=JSON.stringify(authoredPowerWeather()),weather=parsePowerHourly(rawText);
 return {project,declaration:{path:{...declaration.path,startUtc:weather.startUtc,endUtc:weather.endUtc,stepMinutes:60},weather:{format:POWER_HOURLY_FORMAT,rawText},diffuseSky:sky}};}

test('optional mapped diffuse light changes the actual heat course with no direct beam',()=>{
 const {project,declaration}=makeShadeHeatExample(),before=JSON.stringify(project);
 const ordinary=compareShadeHeat(project,{...declaration,directNormalWm2:0});
 assert.deepEqual(ordinary.summary.existing,ordinary.summary.proposal);
 const next=compareShadeHeat(project,{...declaration,directNormalWm2:0,diffuseSky:sky});
 assert.ok(next.summary.proposal.final.upper.surfaceC<next.summary.existing.final.lower.surfaceC-1);
 assert.deepEqual(next.summary.existing,ordinary.summary.existing);
 assert.equal(next.estimatedRayTests,6*15*(512+16));assert.equal(JSON.stringify(project),before);
 assert.equal(next.intervals[0].proposal.irradiance.fullDiffuseHorizontalWm2,80);
 close(next.intervals[0].proposal.irradiance.lower,80*next.diffuseSky.proposal.transmission[0]);
});

test('zero diffuse input leaves thermal trajectories and energy unchanged',()=>{
 const {project,declaration}=makeShadeHeatExample();
 const ordinary=compareShadeHeat(project,{...declaration,diffuseHorizontalWm2:0});
 const next=compareShadeHeat(project,{...declaration,diffuseHorizontalWm2:0,diffuseSky:sky});
 assert.deepEqual(next.trajectory,ordinary.trajectory);assert.deepEqual(next.summary,ordinary.summary);
 assert.ok(next.diffuseSky.proposal.transmission[0]<1);
});

test('diffuse forcing agrees with independent first-order thermal response at all requested times',()=>{
 const {project,declaration}=makeShadeHeatExample();
 for(const target of ['existing','proposal'])project.heatColumnStudy.lowerLayers[target].conductanceWm2K=0;
 const report=compareShadeHeat(project,{...declaration,directNormalWm2:0,diffuseSky:sky});
 for(const target of ['existing','proposal'])for(const bound of ['lower','upper']){
  const p=project.surfaceHeatStudy[target],incident=report.intervals[0][target].irradiance[bound];
  const equilibrium=declaration.reservoirC+p.absorptivity*incident/p.exchangeWm2K;
  for(const row of report.trajectory){
   const exact=equilibrium+(p.initialC-equilibrium)*Math.exp(-p.exchangeWm2K*row.minute*60/p.capacityJm2K);
   close(row[target][bound].surfaceC,exact);close(row[target][bound].subsurfaceC,20);
   close(row[target][bound].inputJm2-row[target][bound].exchangeOutJm2,
    row[target][bound].surfaceStoredJm2+row[target][bound].subsurfaceStoredJm2,2e-6);
  }
 }
});

test('uncertain diffuse heights contain tested physical heights in the declared sampled thermal model',()=>{
 const {project,declaration}=makeShadeHeatExample();project.solarStudy.proposal[0].heightMinM=0;
 const input={...declaration,directNormalWm2:0,diffuseSky:sky},envelope=compareShadeHeat(project,input);
 const e=new Map(envelope.trajectory.map(r=>[r.minute,r.proposal]));
 assert.ok(envelope.summary.proposal.ambiguousIntervals>0);
 for(const h of [.01,.5,1.5,3]){
  const p=structuredClone(project);p.solarStudy.proposal[0].heightMinM=h;p.solarStudy.proposal[0].heightMaxM=h;
  for(const row of compareShadeHeat(p,input).trajectory.filter(r=>Number.isInteger(r.minute))){
   for(const field of ['surfaceC','subsurfaceC']){
    assert.ok(row.proposal.lower[field]>=e.get(row.minute).lower[field]-1e-8);
    assert.ok(row.proposal.upper[field]<=e.get(row.minute).upper[field]+1e-8);
   }
  }
 }
});

test('both declared and original-hourly sky investigations reopen from typed input-only files',()=>{
 const constant=makeShadeHeatExample();constant.declaration.diffuseSky=sky;
 for(const {project,declaration} of [constant,hourly()]){
  const text=serializeShadeHeatInvestigation(project,declaration),value=JSON.parse(text),reopened=parseShadeHeatInvestigation(text);
  assert.equal(value.kind,'experimental-earth/shade-heat-inputs/3');assert.ok(!Object.hasOwn(value,'report'));
  assert.deepEqual(reopened.report,compareShadeHeat(project,declaration));
  if(declaration.weather){
   assert.equal(value.declaration.weather.rawText,declaration.weather.rawText);
   assert.match(reopened.report.semantics,/Hourly weather uses source point data/);
  }
  value.report={fabricated:true};assert.throws(()=>parseShadeHeatInvestigation(JSON.stringify(value)),/envelope/);delete value.report;
  value.kind='experimental-earth/shade-heat-inputs/1';assert.throws(()=>parseShadeHeatInvestigation(JSON.stringify(value)),/envelope/);
 }
});

test('diffuse admission rejects invented transmissions and missing declarations without silent fallback',()=>{
 const {declaration}=makeShadeHeatExample();
 for(const pair of [[-1,1],[0,2],[.8,.2],[NaN,1],[0],[],null]){
  assert.throws(()=>mappedSkyHorizontalIrradiance('no-mapped-blocker',30,700,80,pair));
 }
 assert.throws(()=>normalizeShadeHeat({...declaration,diffuseSky:undefined}));
 assert.throws(()=>normalizeShadeHeat({...declaration,diffuseSky:{...sky,report:1}}));
 const r=mappedSkyHorizontalIrradiance('height-dependent',30,700,80,[.3,.7]);
 close(r.lower,24);close(r.upper,406);assert.deepEqual(r.transmission,[0,1]);
});
