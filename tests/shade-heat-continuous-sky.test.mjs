import test from 'node:test';
import assert from 'node:assert/strict';
import {makeShadeHeatExample} from '../shade-heat-example.js';
import {authoredPowerWeather} from './weather-power-fixture.mjs';
import {parsePowerHourly,POWER_HOURLY_FORMAT} from '../weather-power.js';
import {compareShadeHeat,normalizeShadeHeat,serializeShadeHeatInvestigation,parseShadeHeatInvestigation} from '../shade-heat.js';
const sky={method:'continuous-columns'};
function hourly(){const {project,declaration}=makeShadeHeatExample(),rawText=JSON.stringify(authoredPowerWeather()),weather=parsePowerHourly(rawText);return {project,declaration:{path:{...declaration.path,startUtc:weather.startUtc,endUtc:weather.endUtc,stepMinutes:60},weather:{format:POWER_HOURLY_FORMAT,rawText}}};}
const close=(a,b,tolerance=2e-7)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);

test('continuous sky forcing equals independently scaled uniform DHI through the retained two-store solver',()=>{
 const {project,declaration}=makeShadeHeatExample(),before=JSON.stringify(project);
 project.solarStudy.proposal[0].heightMinM=.4;
 const input={...declaration,directNormalWm2:0,diffuseSky:sky},continuous=compareShadeHeat(project,input);
 assert.equal(continuous.model.version,4);
 for(const target of ['existing','proposal'])for(const [index,bound]of [[0,'lower'],[1,'upper']]){
  const transmission=continuous.diffuseSky[target].transmission[index];
  const uniform=compareShadeHeat(project,{...declaration,directNormalWm2:0,diffuseHorizontalWm2:declaration.diffuseHorizontalWm2*transmission});
  assert.equal(continuous.trajectory.length,uniform.trajectory.length);
  for(let i=0;i<continuous.trajectory.length;i++){
   assert.equal(continuous.trajectory[i].minute,uniform.trajectory[i].minute);
   for(const field of ['surfaceC','subsurfaceC','inputJm2','exchangeOutJm2','surfaceStoredJm2','subsurfaceStoredJm2'])close(continuous.trajectory[i][target][bound][field],uniform.trajectory[i][target].lower[field]);
  }
  for(const row of continuous.intervals)close(row[target].irradiance[bound],declaration.diffuseHorizontalWm2*transmission,1e-10);
 }
 const repeated=compareShadeHeat(project,input);assert.deepEqual(repeated,continuous);
 const after=JSON.parse(before);after.solarStudy.proposal[0].heightMinM=.4;assert.equal(JSON.stringify(project),JSON.stringify(after));
});

test('zero DHI preserves original direct-beam thermal trajectories and energy exactly',()=>{
 const {project,declaration}=makeShadeHeatExample(),input={...declaration,diffuseHorizontalWm2:0};
 const ordinary=compareShadeHeat(project,input),continuous=compareShadeHeat(project,{...input,diffuseSky:sky});
 assert.deepEqual(continuous.trajectory,ordinary.trajectory);assert.deepEqual(continuous.summary,ordinary.summary);
 assert.ok(continuous.diffuseSky.proposal.transmission[0]<1);
 const cells=project.width*project.height;
 assert.ok(continuous.estimatedSkyFaceTests<=4*(4*(cells-1)+4)*(cells-1));
 assert.equal(continuous.estimatedRayTests,ordinary.estimatedRayTests);
});

test('continuous height endpoints bracket independently executed intermediate roofs in the heat course',()=>{
 const {project,declaration}=makeShadeHeatExample();project.solarStudy.proposal[0].heightMinM=0;
 const input={...declaration,directNormalWm2:0,diffuseSky:sky},envelope=compareShadeHeat(project,input);
 for(const height of [.2,1.1,2.7]){
  const source=structuredClone(project);source.solarStudy.proposal[0].heightMinM=height;source.solarStudy.proposal[0].heightMaxM=height;
  const actual=compareShadeHeat(source,input);
  for(let i=0;i<actual.trajectory.length;i++)for(const field of ['surfaceC','subsurfaceC']){
   assert.ok(actual.trajectory[i].proposal.lower[field]>=envelope.trajectory[i].proposal.lower[field]-1e-8);
   assert.ok(actual.trajectory[i].proposal.upper[field]<=envelope.trajectory[i].proposal.upper[field]+1e-8);
  }
 }
});

test('constant and original-hourly continuous investigations reopen typed input-only v4 and retain raw weather',()=>{
 for(const {project,declaration}of [makeShadeHeatExample(),hourly()]){
  const input={...declaration,diffuseSky:sky},text=serializeShadeHeatInvestigation(project,input),raw=JSON.parse(text),reopened=parseShadeHeatInvestigation(text);
  assert.equal(raw.kind,'experimental-earth/shade-heat-inputs/4');assert.equal(raw.model.version,4);
  assert.deepEqual(Object.keys(raw).sort(),['declaration','kind','model','project']);assert.deepEqual(raw.declaration.diffuseSky,sky);
  assert.deepEqual(reopened.report,compareShadeHeat(project,input));
  assert.equal(serializeShadeHeatInvestigation(reopened.investigation.project,reopened.investigation.declaration),text);
  if(declaration.weather)assert.equal(raw.declaration.weather.rawText,declaration.weather.rawText);
 }
});

test('forged v4 result/model/method and sampled controls refuse without fallback',()=>{
 const {project,declaration}=makeShadeHeatExample(),input={...declaration,diffuseSky:sky},text=serializeShadeHeatInvestigation(project,input);
 for(const mutate of [r=>r.report={transmission:1},r=>r.model.version=3,r=>r.model.sky='invented',r=>r.kind='experimental-earth/shade-heat-inputs/3',r=>r.declaration.diffuseSky.method='sampled',r=>r.declaration.diffuseSky.azimuthSamples=32,r=>r.declaration.diffuseSky.transmission=[0,1]]){
  const raw=JSON.parse(text);mutate(raw);assert.throws(()=>parseShadeHeatInvestigation(JSON.stringify(raw)));
 }
 for(const diffuseSky of [{method:'continuous-columns',elevationBands:16},{method:'unknown'},{method:undefined},undefined])assert.throws(()=>normalizeShadeHeat({...declaration,diffuseSky}));
 const stale=structuredClone(project);stale.existing[0].elevationM+=.1;assert.throws(()=>compareShadeHeat(stale,input));
 const footprint=structuredClone(project);footprint.solarStudy.proposal.push({cellIndex:footprint.heatColumnStudy.heatStudy.cellIndex,heightMinM:0,heightMaxM:1,source:'Independent footprint refusal'});assert.throws(()=>compareShadeHeat(footprint,input),/footprint/);
});

