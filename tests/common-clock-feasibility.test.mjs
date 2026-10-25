import test from 'node:test';import assert from 'node:assert/strict';
import{makeExample}from'../core.js';
import{compareCommonClock}from'../common-clock-feasibility.js';
import{feasibleReadingTimes,intersectIntervals}from'../clock-offset-intervals.js';
const fixture=()=>{const p=makeExample();p.width=p.height=2;p.selectedIndex=0;p.existing=Array.from({length:4},()=>({elevationM:0,surface:'turf',provenance:'authored'}));p.proposal=structuredClone(p.existing);Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:180,mobilityPerHour:0,boundaryExitPerHour:0});p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[3,9,22]};p.observations=[{cellIndex:0,minute:60,depthMm:21,uncertaintyMm:.01,source:'authored first',scenario:'existing',use:'calibration'},{cellIndex:0,minute:120,depthMm:15,uncertaintyMm:.01,source:'authored held aside',scenario:'existing',use:'challenge'}];return p;};
const declaration={minimumOffsetMinutes:-30,maximumOffsetMinutes:30,source:'authored common-clock hypothesis'};
test('individually possible readings can exclude every common clock offset',()=>{
 const p=fixture(),before=structuredClone(p),r=compareCommonClock(p,declaration),c=r.candidates.find(c=>c.rateMmHr===9);
 assert.ok(c.readings.every(r=>r.offsetIntervals.length));assert.equal(c.calibrationOffsets.length,1);assert.equal(c.challengeOffsets.length,1);assert.deepEqual(c.survivingOffsets,[]);assert.deepEqual(p,before);
 assert.ok(Math.abs(c.calibrationOffsets[0][0]+.028571428571)<1e-5);assert.ok(Math.abs(c.challengeOffsets[0][1]+19.933333333)<1e-5);
});
test('one observed depth has disconnected rising and falling common-offset components',()=>{
 const p=fixture();p.observations=[{...p.observations[0],depthMm:15}];
 const r=compareCommonClock(p,{...declaration,minimumOffsetMinutes:-60,maximumOffsetMinutes:60}),c=r.candidates.find(c=>c.rateMmHr===9);
 assert.equal(c.survivingOffsets.length,2);assert.ok(c.survivingOffsets[0][1]< -17);assert.ok(c.survivingOffsets[1][0]>39);
});
test('exact touching, flat, disconnected and single-point interval algebra',()=>{
 const s=[0,10,0,10,0].map((x,i)=>({minute:i*10,depthsMm:[x]}));
 assert.deepEqual(feasibleReadingTimes(s,0,4,6,0,40),[[4,6],[14,16],[24,26],[34,36]]);
 assert.deepEqual(intersectIntervals([[4,6],[14,16]],[[6,14]]),[[6,6],[14,14]]);
 assert.deepEqual(feasibleReadingTimes([{minute:0,depthsMm:[4]},{minute:10,depthsMm:[4]}],0,4,4,5,5),[[5,5]]);
 assert.deepEqual(feasibleReadingTimes(s,0,10,10,0,40),[[10,10],[30,30]]);
});
test('held-aside values do not alter nominal calibration order or calibration feasible sets',()=>{
 const p=fixture(),a=compareCommonClock(p,declaration);p.observations[1].depthMm=100;const b=compareCommonClock(p,declaration);
 assert.deepEqual(a.candidates.map(c=>[c.rateMmHr,c.calibrationOffsets]),b.candidates.map(c=>[c.rateMmHr,c.calibrationOffsets]));
});
test('shared event admission excludes offsets for every reading together and refuses invalid declarations',()=>{
 const p=fixture();p.observations[0].minute=5;p.observations[1].minute=175;const r=compareCommonClock(p,declaration);assert.deepEqual(r.admittedDomain,[-5,5]);assert.deepEqual(r.declaredDomain,[-30,30]);
 for(const d of [{...declaration,minimumOffsetMinutes:-61},{...declaration,source:''},{...declaration,maximumOffsetMinutes:NaN}])assert.throws(()=>compareCommonClock(p,d));
});

test('compatible common zero offset survives while isolated exact point remains closed',()=>{
 const p=fixture();p.observations[1].depthMm=12;
 const r=compareCommonClock(p,{...declaration,minimumOffsetMinutes:0,maximumOffsetMinutes:0});
 assert.deepEqual(r.candidates.find(c=>c.rateMmHr===9).survivingOffsets,[[0,0]]);
});
test('bounded interval-intersection work refuses before expensive candidate simulation',()=>{
 const p=fixture();p.weather.durationMinutes=720;p.weather.stepMinutes=1;p.infiltrationStudy.ratesMmHr=[1,2,3,4,5,6,7,8,9];p.observations=Array.from({length:20},(_,i)=>({...p.observations[0],source:'authored row '+i}));
 const r=compareCommonClock(p,declaration);assert.ok(r.cellSteps<3_000_000);assert.ok(r.scanWork<500_000);assert.ok(r.intervalWork>2_000_000);assert.equal(r.status,'work-limit');
});

test('held-aside event coverage remains separate from calibration feasibility',()=>{
 const p=fixture(),a=compareCommonClock(p,declaration);p.observations[1].minute=180;const b=compareCommonClock(p,declaration);
 assert.deepEqual(a.candidates.map(c=>c.calibrationOffsets),b.candidates.map(c=>c.calibrationOffsets));assert.deepEqual(b.admittedDomain,[-30,0]);
 const outside=compareCommonClock(p,{...declaration,minimumOffsetMinutes:10,maximumOffsetMinutes:20});assert.equal(outside.admittedDomain,null);for(const c of outside.candidates){assert.equal(c.readings[1].status,'outside-modeled-window');assert.deepEqual(c.survivingOffsets,[]);}
});
test('input-only receipt recomputes interval sets and preserves exact original readings',async()=>{
 const{buildCommonClockReceipt,serializeCommonClockReceipt,parseCommonClockReceipt}=await import('../common-clock-receipt.js');
 const p=fixture(),before=structuredClone(p),built=buildCommonClockReceipt(p,declaration);const text=serializeCommonClockReceipt(built.receipt),restored=parseCommonClockReceipt(text);
 assert.deepEqual(restored,built);assert.deepEqual(p,before);assert.deepEqual(Object.keys(JSON.parse(text)).sort(),['declaration','kind','project']);
 assert.throws(()=>parseCommonClockReceipt(JSON.stringify({...built.receipt,comparison:built.comparison})),/envelope/);
});
test('irregular piecewise-linear trajectory agrees with independent dense membership control',()=>{
 const times=[0,.3,1.1,2.5,3,4.2,6],values=[1,4,2,8,0,3,7],snapshots=times.map((minute,i)=>({minute,depthsMm:[values[i]]})),bands=feasibleReadingTimes(snapshots,0,2,3,.1,5.5);
 for(let i=0;i<1001;i++){
  const t=.1+5.4*i/1000;let k=1;while(times[k]<t)k++;const y=values[k-1]+(values[k]-values[k-1])*(t-times[k-1])/(times[k]-times[k-1]);
  if(Math.abs(y-2)<1e-10||Math.abs(y-3)<1e-10)continue;
  assert.equal(bands.some(([a,b])=>t>=a&&t<=b),y>=2&&y<=3);
 }
});
