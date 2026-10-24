import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {
 CLOCK_RECEIPT_KIND,CLOCK_RECEIPT_LIMITS,MAX_CLOCK_RECEIPT_BYTES,
 buildClockReceipt,serializeClockReceipt,parseClockReceipt,verifyClockReceipt
} from '../clock-receipt.js';

function fixture(){
 const p=makeExample();p.width=p.height=2;p.selectedIndex=0;
 p.existing=p.proposal=Array.from({length:4},()=>({elevationM:0,surface:'turf',provenance:'fictional authored example'}));
 Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:60,mobilityPerHour:0,boundaryExitPerHour:0});
 p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[10,20]};
 p.observations=[
  {cellIndex:0,minute:20,depthMm:10,uncertaintyMm:0,source:'fictional calibration',scenario:'existing',use:'calibration'},
  {cellIndex:0,minute:35,depthMm:15,uncertaintyMm:0,source:'fictional held-aside',scenario:'existing',use:'challenge'}
 ];
 return p;
}
function create(){return buildClockReceipt(fixture(),[0,10,30],'fictional recorder-clock alignment');}

test('download and independent reopening carry exact authored source and conclusions',()=>{
 const original=fixture(),before=JSON.stringify(original);
 const receipt=buildClockReceipt(original,[0,10,30],'fictional recorder-clock alignment');
 assert.equal(original.title,receipt.project.title);
 assert.notEqual(original,receipt.project);
 assert.equal(receipt.kind,CLOCK_RECEIPT_KIND);
 assert.equal(receipt.comparison.offsets[0].comparison.status,'calibration-rejected');
 assert.deepEqual(receipt.comparison.offsets[1].comparison.survivingRatesMmHr,[10]);
 assert.equal(receipt.comparison.offsets[2].status,'outside-modeled-window');
 assert.deepEqual(receipt.comparison.offsets[2].outsideReadingIndices,[1]);
 assert.equal(JSON.stringify(original),before);
 const decoded=parseClockReceipt(serializeClockReceipt(receipt));
 assert.deepEqual(decoded,receipt);
 assert.deepEqual(decoded.project.observations,original.observations);
 assert.match(decoded.limitations,/does not authenticate/);
 assert.match(decoded.limitations,/No clock hypothesis.*is adopted/);
});

test('download freezes source even after later workspace mutation',()=>{
 const p=fixture(),receipt=buildClockReceipt(p,[0,10],'clock check');
 p.observations[0].source='changed after download';p.weather.rainMmHr=20;
 const reopened=parseClockReceipt(serializeClockReceipt(receipt));
 assert.equal(reopened.project.observations[0].source,'fictional calibration');
 assert.equal(reopened.project.weather.rainMmHr,30);
});

test('falsified cached winners, statuses and extra keys are rejected',()=>{
 for(const mutate of [
  r=>r.comparison.offsets[1].comparison.survivingRatesMmHr.push(20),
  r=>r.comparison.offsets[2].status='compared',
  r=>{r.comparison.offsets[1].comparison.counts.challenge=0;},
  r=>{r.comparison.offsets[0].extra='forged';},
  r=>{r.kind='another-product/1';},
  r=>{r.limitations='verified physical evidence';}
 ]){
  const r=create();mutate(r);
  assert.throws(()=>parseClockReceipt(JSON.stringify(r)),/altered|do not match/);
 }
});

test('modified included physical readings cannot retain an older verdict',()=>{
 const r=create();r.project.observations[0].depthMm=99;
 assert.throws(()=>parseClockReceipt(JSON.stringify(r)),/do not match/);
});

test('self-consistent fabricated source still cannot become an authenticity claim',()=>{
 const p=fixture();p.observations[0].source='entirely fictional changed source';p.observations[0].depthMm=99;
 const r=buildClockReceipt(p,[0,10],'hypothetical offset');
 assert.deepEqual(parseClockReceipt(serializeClockReceipt(r)),r);
 assert.match(r.limitations,/does not authenticate/);
});

test('JSON object property order may change without altering verdicts',()=>{
 const r=create(),rotated=Object.fromEntries(Object.entries(r).reverse());
 assert.deepEqual(parseClockReceipt(JSON.stringify(rotated)),r);
});

test('unsupported, malformed and oversized receipts refuse before model adoption',()=>{
 for(const text of ['{}','[]','null','{','1','""'])assert.throws(()=>parseClockReceipt(text));
 assert.throws(()=>parseClockReceipt(' '.repeat(MAX_CLOCK_RECEIPT_BYTES+1)),/8 MiB/);
 assert.throws(()=>parseClockReceipt(123),/JSON text/);
 const r=create();delete r.project;assert.throws(()=>verifyClockReceipt(r));
});

test('valid reason and declared offsets are prerequisites to a portable result',()=>{
 for(const reason of ['', ' ', 'x'.repeat(201),null])assert.throws(()=>buildClockReceipt(fixture(),[0,10],reason));
 for(const offsets of [[0],[0,0],[1,2],[0,61],[0,NaN]])assert.throws(()=>buildClockReceipt(fixture(),offsets,'reason'));
 const p=fixture();p.observations=[];
 assert.throws(()=>buildClockReceipt(p,[0,10],'no evidence'),/Assign at least one/);
});

test('serializing edited in-memory receipt also independently revalidates',()=>{
 const r=create();r.comparison.offsets[1].comparison.survivingRatesMmHr=[20];
 assert.throws(()=>serializeClockReceipt(r),/do not match/);
});

test('reopening enforces the existing bounded solver work budget',()=>{
 const p=fixture();p.width=p.height=24;p.selectedIndex=0;
 p.existing=p.proposal=Array.from({length:576},()=>({...p.existing[0]}));
 p.weather.durationMinutes=720;p.weather.stepMinutes=1;
 p.infiltrationStudy.ratesMmHr=[1,2,3,4,5,6,7,8,9];
 assert.throws(()=>buildClockReceipt(p,[0,1,2,3,4,5,6],'big'),/budget/);
});

test('maximal source-rich survey roundtrips with all source descriptions within diagnostic bound',()=>{
 const p=makeExample();p.width=p.height=24;p.selectedIndex=0;
 const origin={kind:'supplied-elevation-table/1',fileName:'F'.repeat(200),line:2,datum:'D'.repeat(160),source:'S'.repeat(240),unit:'m',elevationValue:0,uncertaintyValue:0,cellSizeM:p.weather.cellSizeM};
 const cell={elevationM:0,surface:'turf',provenance:'P'.repeat(240),terrainSource:origin};
 p.existing=Array.from({length:576},(_,i)=>({...cell,terrainSource:{...origin,line:i+2}}));
 p.proposal=structuredClone(p.existing);
 p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[5,10]};
 p.observations=[{cellIndex:575,minute:20,depthMm:10,uncertaintyMm:1,source:'source-rich full survey reading',scenario:'existing',use:'calibration'}];
 const receipt=buildClockReceipt(p,[0,5],'declared source-rich timing alternative');
 const text=serializeClockReceipt(receipt),bytes=new Blob([text]).size;
 assert.ok(bytes>1_000_000&&bytes<MAX_CLOCK_RECEIPT_BYTES,bytes);
 const reopened=parseClockReceipt(text);
 assert.equal(reopened.project.proposal[575].terrainSource.line,577);
 assert.equal(reopened.project.proposal[575].terrainSource.source,'S'.repeat(240));
 assert.deepEqual(reopened.comparison,receipt.comparison);
});
