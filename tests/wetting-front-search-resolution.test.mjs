import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {compareSoilSearchResolution} from '../wetting-front-search-resolution.js';
const query=()=>({target:'existing',surface:'turf',basis:'Authored finite-grid sensitivity control',conductivity:{min:5,max:15,count:3},drive:{min:0,max:40,count:3}});
function source(){const p=makeExample();p.observations=[{cellIndex:37,minute:120,depthMm:27.128813082303168,uncertaintyMm:.1,source:'Authored one-minute model control, not a field observation',scenario:'existing',use:'calibration'}];return p;}
test('actual routed soil inverse has a compatibility reversal while preserving each grid point',()=>{const p=source(),before=JSON.stringify(p),r=compareSoilSearchResolution(p,query());assert.equal(r.status,'step-sensitive');assert.deepEqual(r.stepsMinutes,[5,2.5,1.25]);assert.deepEqual(r.runs.map(x=>x.compatibleIds),[[],[],[5]]);assert.equal(r.changes.closest,false);const truth=r.candidates.find(x=>x.id===5);assert.ok(Math.abs(truth.readings[0].predictions[0].residualMm-.5401655947738)<1e-9);assert.equal(truth.readings[0].bandChanged,true);assert.equal(r.candidates.length,9);assert.equal(JSON.stringify(p),before);});
test('dry all-compatible grid remains unchanged with exact zero prediction spreads',()=>{const p=source();p.weather.rainMmHr=0;p.observations[0].depthMm=0;const r=compareSoilSearchResolution(p,query());assert.equal(r.status,'no-decision-change');assert.ok(r.runs.every(x=>x.compatibleIds.length===9));assert.ok(r.candidates.every(x=>x.readings.every(y=>y.spreadMm===0)));});
test('held-aside values never change the closest or calibration-compatible sets at any step',()=>{const p=source();p.observations.push({...p.observations[0],minute:90,use:'challenge',depthMm:0});const a=compareSoilSearchResolution(p,query());p.observations[1].depthMm=100;const b=compareSoilSearchResolution(p,query());assert.deepEqual(a.runs.map(x=>[x.compatibleIds,x.closestIds]),b.runs.map(x=>[x.compatibleIds,x.closestIds]));assert.notDeepEqual(a.candidates,b.candidates);});
test('one-minute floor, deduplicated steps and aggregate budget are explicit',()=>{const p=source();p.weather.stepMinutes=1;assert.equal(compareSoilSearchResolution(p,query()).status,'minimum-step');p.weather.stepMinutes=2;assert.deepEqual(compareSoilSearchResolution(p,query()).stepsMinutes,[2,1]);p.weather.stepMinutes=5;p.weather.durationMinutes=720;const q=query();q.conductivity.count=q.drive.count=9;const r=compareSoilSearchResolution(p,q);assert.equal(r.status,'work-limit');assert.deepEqual(r.runs,[]);});

test('independent constant-rate closed-column oracle remains exact at an off-step reading',()=>{
 const p=source();p.width=p.height=2;p.selectedIndex=0;p.existing=Array.from({length:4},()=>({surface:'turf',elevationM:0,provenance:'Authored closed uniform mathematical control'}));p.proposal=structuredClone(p.existing);
 Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:60,stepMinutes:7,cellSizeM:1,mobilityPerHour:0,boundaryExitPerHour:0});
 p.observations=[{cellIndex:0,minute:37,depthMm:(30-20)*37/60,uncertaintyMm:1e-10,scenario:'existing',use:'calibration',source:'Independent rain-minus-constant-infiltration formula'}];
 const q=query();q.conductivity={min:10,max:20,count:2};q.drive={min:0,max:20,count:2};
 const r=compareSoilSearchResolution(p,q);const constant=r.candidates.find(x=>x.conductivityMmHr===20&&x.capillaryDriveMm===0);
 for(const prediction of constant.readings[0].predictions){assert.ok(Math.abs(prediction.depthMm-10*37/60)<1e-12);assert.equal(prediction.withinBand,true);assert.equal(prediction.method,'linear interpolation');}
 assert.equal(constant.readings[0].bandChanged,false);
});

test('same rates at changed calculations do not replace observed source or mutate original step',()=>{
 const p=source(),q=query(),before=JSON.stringify({p,q});p.observations.push({...p.observations[0],minute:87.3,use:'challenge',source:'Authored distinct held-aside timing'});const exact=JSON.stringify({p,q});
 const r=compareSoilSearchResolution(p,q);assert.equal(JSON.stringify({p,q}),exact);
 const population=r.runs[0].candidates.map(x=>[x.id,x.conductivityMmHr,x.capillaryDriveMm]).sort((a,b)=>a[0]-b[0]);
 for(const run of r.runs){assert.deepEqual(run.query,q);assert.deepEqual(run.candidates.map(x=>[x.id,x.conductivityMmHr,x.capillaryDriveMm]).sort((a,b)=>a[0]-b[0]),population);const source=JSON.parse(run.sourceSignature);assert.deepEqual(source.observations,p.observations);assert.deepEqual(source.existing,p.existing);assert.equal(source.weather.stepMinutes,run.stepMinutes);}
 assert.equal(p.weather.stepMinutes,5);assert.notEqual(before,exact);
});

test('a finer individual request is refused even when the aggregate fits its separate ceiling',()=>{
 const p=source();p.weather.durationMinutes=360;p.weather.stepMinutes=5;
 const q=query();q.conductivity.count=q.drive.count=9;
 // Base279936, half559872, quarter1119744: total1959552, fine alone exceeds1M.
 const r=compareSoilSearchResolution(p,q);assert.equal(r.cellSteps,1959552);assert.equal(r.status,'work-limit');assert.deepEqual(r.runs,[]);
});
