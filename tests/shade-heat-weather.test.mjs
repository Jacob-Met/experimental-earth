import test from 'node:test';
import assert from 'node:assert/strict';
import {authoredPowerWeather} from './weather-power-fixture.mjs';
import {makeShadeHeatExample} from '../shade-heat-example.js';
import {parsePowerHourly,POWER_HOURLY_FORMAT} from '../weather-power.js';
import {compareShadeHeat,serializeShadeHeatInvestigation,parseShadeHeatInvestigation} from '../shade-heat.js';
const rawText=JSON.stringify(authoredPowerWeather());
const received=parsePowerHourly(rawText);
const fixture=()=>{const {project,declaration}=makeShadeHeatExample(); return {project,declaration:{path:{...declaration.path,startUtc:received.startUtc,endUtc:received.endUtc,stepMinutes:60},weather:{format:POWER_HOURLY_FORMAT,rawText}}};};
const near=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,`${a} vs ${b}`);
test('authored original hourly weather drives every maintained thermal interval and ambient reservoir',()=>{
 const {project,declaration}=fixture(),original=structuredClone(project),r=compareShadeHeat(project,declaration);
 assert.equal(r.intervals.length,24);assert.deepEqual(project,original);
 for(let i=0;i<24;i++){
  const row=r.intervals[i];assert.equal(row.weather.sourceKey,received.intervals[i].sourceKey);
  assert.equal(row.fromUtc,received.intervals[i].fromUtc);assert.equal(row.toUtc,received.intervals[i].toUtc);
  assert.equal(row.weather.reservoirC,received.intervals[i].reservoirC);
 }
 assert.ok(r.summary.existing.surface.maximumRangeC[0]>r.summary.proposal.surface.maximumRangeC[0]);
 assert.ok(r.summary.existing.final.lower.subsurfaceC>r.summary.proposal.final.lower.subsurfaceC);
 assert.equal(r.intervals[0].existing.irradiance.lower,0);
 assert.ok(r.trajectory.find(r=>r.minute===60).existing.lower.surfaceC<20,'night ambient cooling is received');
});
test('independent first-order analytic recurrence agrees at all changing hourly boundaries',()=>{
 const {project,declaration}=fixture();for(const target of ['existing','proposal'])project.heatColumnStudy.lowerLayers[target].conductanceWm2K=0;
 const r=compareShadeHeat(project,declaration);
 for(const target of ['existing','proposal']){
  let temperature=20;const p=project.surfaceHeatStudy[target];
  for(const interval of r.intervals){
   const equilibrium=interval.weather.reservoirC+p.absorptivity*interval[target].irradiance.lower/p.exchangeWm2K;
   temperature=equilibrium+(temperature-equilibrium)*Math.exp(-p.exchangeWm2K*3600/p.capacityJm2K);
   const sample=r.trajectory.find(row=>row.minute===interval.toMinute);
   near(sample[target].lower.surfaceC,temperature);near(sample[target].lower.subsurfaceC,20);
  }
 }
});
test('location, UTC day and numerical interval cannot detach from original weather',()=>{
 const {project,declaration}=fixture();
 for(const patch of [{latitudeDeg:50},{longitudeDeg:0},{startUtc:'2025-06-21T01:00:00Z'},{endUtc:'2025-06-22T01:00:00Z'},{stepMinutes:120}]){
  assert.throws(()=>compareShadeHeat(project,{...declaration,path:{...declaration.path,...patch}}),/must match/);
 }
});
test('versioned hourly input-only replay keeps original JSON, rejects reports and keeps v1 working',()=>{
 const {project,declaration}=fixture();const text=serializeShadeHeatInvestigation(project,declaration),value=JSON.parse(text);
 assert.equal(value.kind,'experimental-earth/shade-heat-inputs/2');assert.equal(value.declaration.weather.rawText,rawText);assert.ok(!Object.hasOwn(value,'report'));
 assert.deepEqual(parseShadeHeatInvestigation(text).report,compareShadeHeat(project,declaration));
 value.report={invented:true};assert.throws(()=>parseShadeHeatInvestigation(JSON.stringify(value)),/envelope/);delete value.report;
 value.kind='experimental-earth/shade-heat-inputs/1';assert.throws(()=>parseShadeHeatInvestigation(JSON.stringify(value)),/envelope/);
 const old=makeShadeHeatExample();assert.equal(parseShadeHeatInvestigation(serializeShadeHeatInvestigation(old.project,old.declaration)).investigation.kind,'experimental-earth/shade-heat-inputs/1');
});
