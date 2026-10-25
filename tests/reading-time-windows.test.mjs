import test from 'node:test';import assert from 'node:assert/strict';
import {makeExample} from '../core.js';import{compareReadingWindows}from'../reading-time-windows.js';
const make=()=>{const p=makeExample();p.width=p.height=2;p.selectedIndex=0;p.existing=Array.from({length:4},()=>({elevationM:0,surface:'turf',provenance:'authored'}));p.proposal=structuredClone(p.existing);Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:180,mobilityPerHour:0,boundaryExitPerHour:0});p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[3,9,22]};p.observations=[{cellIndex:0,minute:60,depthMm:21,uncertaintyMm:.01,source:'authored analytic control, not measured',scenario:'existing',use:'calibration'}];return p;};
const window={readingIndex:0,earliestMinute:30,latestMinute:90,source:'authored timestamp interval'};
test('whole-window extrema retain an interior storm peak missed by endpoints',()=>{const p=make(),before=structuredClone(p),r=compareReadingWindows(p,[window]),c=r.candidates.find(c=>c.rateMmHr===9),v=c.readings[0];assert.equal(v.maximumMm,21);assert.equal(v.maximumAtMinute,60);assert.equal(v.minimumMm,10.5);assert.equal(v.status,'some-time-compatible');assert.ok(v.endpointBrackets.every(x=>x.depthMm<21));assert.deepEqual(p,before);});
test('singleton is nominal and challenge changes cannot reorder original calibration',()=>{const p=make();p.observations.push({...p.observations[0],minute:120,depthMm:0,use:'challenge'});const w={...window,earliestMinute:60,latestMinute:60};const a=compareReadingWindows(p,[w]);for(const c of a.candidates)assert.equal(c.calibration.possible,c.nominalCalibration.compatible);p.observations[1].depthMm=100;const b=compareReadingWindows(p,[w]);assert.deepEqual(a.candidates.map(c=>c.rateMmHr),b.candidates.map(c=>c.rateMmHr));});
test('malformed, detached and outside-event windows refuse',()=>{const p=make();for(const w of [{...window,earliestMinute:61},{...window,latestMinute:59},{...window,source:''},{...window,readingIndex:1},{...window,latestMinute:181},{...window,earliestMinute:NaN}])assert.throws(()=>compareReadingWindows(p,[w]));assert.throws(()=>compareReadingWindows(p,[window,window]));});

test('input-only file roundtrip recomputes and rejects cached verdict envelopes',async()=>{
 const {buildReadingWindowReceipt,serializeReadingWindowReceipt,parseReadingWindowReceipt,checkReadingWindowBytes}=await import('../reading-time-window-receipt.js');
 const project=make(),before=structuredClone(project),built=buildReadingWindowReceipt(project,[window]);
 const text=serializeReadingWindowReceipt(built.receipt),parsed=parseReadingWindowReceipt(text);
 assert.deepEqual(parsed,built);assert.deepEqual(project,before);assert.ok(!Object.hasOwn(JSON.parse(text),'comparison'));
 assert.throws(()=>parseReadingWindowReceipt(JSON.stringify({...built.receipt,comparison:built.comparison})),/envelope/);
 assert.throws(()=>checkReadingWindowBytes(4*1024*1024+1),/4 MiB/);
 const changed=JSON.parse(text);changed.windows[0].latestMinute=61;assert.notDeepEqual(parseReadingWindowReceipt(JSON.stringify(changed)).comparison,built.comparison);
});
test('timing can explain nominal rejection but does not claim all-times support',()=>{
 const project=make();project.observations[0]={...project.observations[0],minute:120,depthMm:15};project.infiltrationStudy.ratesMmHr=[3,6,9,22];
 const result=compareReadingWindows(project,[{...window,earliestMinute:90,latestMinute:150}]);
 assert.ok(result.candidates.every(c=>!c.nominalCalibration.compatible));
 assert.deepEqual(result.candidates.filter(c=>c.calibration.possible).map(c=>c.rateMmHr).sort((a,b)=>a-b),[6,9]);
 assert.ok(result.candidates.every(c=>!c.calibration.allTimes));
});
test('large combined prediction or snapshot work is refused before simulation',()=>{
 const p=make();p.width=p.height=24;p.selectedIndex=0;p.existing=Array.from({length:576},()=>({...p.existing[0]}));p.proposal=structuredClone(p.existing);p.weather.durationMinutes=720;p.weather.stepMinutes=1;p.infiltrationStudy.ratesMmHr=[1,2,3,4,5,6,7,8,9];
 assert.equal(compareReadingWindows(p,[window]).status,'work-limit');
});

test('flat dry course is compatible throughout while incompatible rates remain visible',()=>{
 const p=make();p.observations[0]={...p.observations[0],minute:180,depthMm:0};
 const r=compareReadingWindows(p,[{...window,earliestMinute:170,latestMinute:180}]);
 assert.equal(r.candidates.find(c=>c.rateMmHr===22).readings[0].status,'all-times-compatible');
 assert.equal(r.candidates.find(c=>c.rateMmHr===3).readings[0].status,'incompatible-throughout');assert.equal(r.candidates.length,3);
});

test('off-snapshot endpoint brackets and fractional extrema retain original minute',()=>{
 const p=make();p.observations[0]={...p.observations[0],minute:60.5};
 const r=compareReadingWindows(p,[{...window,earliestMinute:30.5,latestMinute:89.5}]);
 const row=r.candidates.find(c=>c.rateMmHr===9).readings[0];
 assert.ok(Math.abs(row.minimumMm-10.675)<1e-12);assert.equal(row.maximumAtMinute,60);
 assert.deepEqual(row.endpointBrackets.map(x=>[x.beforeMinute,x.afterMinute]),[[30,35],[85,90]]);
 assert.equal(p.observations[0].minute,60.5);assert.equal(r.originalReadings[0].reading.minute,60.5);
});
test('snapshot-inspection bound refuses independently of the solver bound',()=>{
 const p=make();p.weather.durationMinutes=720;p.weather.stepMinutes=1;p.infiltrationStudy.ratesMmHr=[1,2,3,4,5,6,7,8,9];p.observations=Array.from({length:100},(_,i)=>({...p.observations[0],source:'authored row '+i}));
 const r=compareReadingWindows(p,[window]);assert.ok(r.cellSteps<3_000_000);assert.ok(r.sampleWork>500_000);assert.equal(r.status,'work-limit');assert.deepEqual(r.candidates,[]);
});
