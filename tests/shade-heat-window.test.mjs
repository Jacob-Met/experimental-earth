import assert from'node:assert/strict';import{checkCoolingWindow,parseCoolingWindow,serializeCoolingWindow}from'../shade-heat-window.js';import{prepareShadeHeatSampling}from'../shade-heat-sampling.js';
import{makeShadeHeatExample}from'../shade-heat-example.js';import{parsePowerHourly}from'../weather-power.js';import{authoredPowerWeather}from'./weather-power-fixture.mjs';
const q={fromMinute:0,toMinute:1,thresholdC:6,store:'surfaceC'};
const report=(lo,hi)=>({courses:[60,30,15].map(solarStepMinutes=>({solarStepMinutes,targets:Object.fromEntries(['existing','proposal'].map(t=>[t,Object.fromEntries(['lower','upper'].map(b=>[b,{trajectory:[0,1].map(minute=>({minute,surfaceC:t==='proposal'?0:(b==='lower'?lo:hi)[minute]}))}]))]))}))});
assert.equal(checkCoolingWindow(report([6,7],[8,9]),q).courses[0].state,'supported');
assert.equal(checkCoolingWindow(report([5,7],[6,9]),q).courses[0].state,'ambiguous');
assert.equal(checkCoolingWindow(report([5,2],[6,3]),q).courses[0].state,'failed');
assert.equal(checkCoolingWindow(report([5,2],[6,3]),q).courses[0].firstFailure.minute,1);
for(const alter of[x=>x.pop(),x=>x.push(x[0]),x=>x[0].surfaceC=Infinity]){const r=report([6,7],[8,9]);alter(r.courses[2].targets.existing.lower.trajectory);assert.throws(()=>checkCoolingWindow(r,q));}
const raw=JSON.stringify(authoredPowerWeather()),weather=parsePowerHourly(raw),example=makeShadeHeatExample();
const accepted=prepareShadeHeatSampling(example.project,{path:{...example.declaration.path,latitudeDeg:weather.latitudeDeg,longitudeDeg:weather.longitudeDeg,startUtc:weather.startUtc,endUtc:weather.endUtc,stepMinutes:60},weather:{format:weather.format,rawText:raw}});
const actual={...q,fromMinute:600,toMinute:780};const r=checkCoolingWindow(accepted.report,actual);assert.deepEqual(r.courses.map(c=>c.counts.supported),[83,176,133]);assert(r.courses.every(c=>c.state==='failed'));
const text=serializeCoolingWindow(accepted.investigation,actual);assert.deepEqual(parseCoolingWindow(text).report,r);const dirty=JSON.parse(text);dirty.report=r;assert.throws(()=>parseCoolingWindow(JSON.stringify(dirty)));
console.log('Window classification, equality, ambiguity, earliest definite failure, complete coverage and actual original-source replay PASS');
