import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {buildClockReceipt,serializeClockReceipt,parseClockReceipt} from '../clock-receipt.js';
import {originalClockReadings,clockOffsetReadingTrace} from '../clock-panel.js';

function authored(){
 const p=makeExample();p.width=p.height=2;p.selectedIndex=0;
 p.existing=p.proposal=Array.from({length:4},()=>({elevationM:0,surface:'turf',provenance:'fictional illustration'}));
 Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:60,mobilityPerHour:0,boundaryExitPerHour:0});
 p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[10,20]};
 p.observations=[
  {cellIndex:0,minute:20,depthMm:10,uncertaintyMm:1,source:'fictional calibration',scenario:'existing',use:'calibration'},
  {cellIndex:3,minute:35,depthMm:15,uncertaintyMm:0.25,source:'fictional held aside',scenario:'existing',use:'challenge'},
  {cellIndex:1,minute:21,depthMm:2,uncertaintyMm:0.2,source:'<img src=x onerror=alert(1)>',scenario:'proposal',use:'calibration'},
  {cellIndex:2,minute:15,depthMm:3,uncertaintyMm:0.5,source:'not assigned',scenario:'unassigned',use:'unassigned'}
 ];return p;
}
test('evidence view derives every ORIGINAL source reading without treating other roles as shifted',()=>{
 const project=authored(),before=structuredClone(project);
 const receipt=buildClockReceipt(project,[0,10,30],'fictional alternative');
 const rows=originalClockReadings(receipt);
 assert.equal(rows.length,4);
 assert.deepEqual(rows.map(r=>r.considered),[true,true,false,false]);
 assert.deepEqual(rows.map(r=>r.cell),['A1','B2','B1','A2']);
 assert.deepEqual(rows.map(r=>r.originalMinute),[20,35,21,15]);
 assert.equal(rows[1].uncertaintyMm,0.25);
 assert.equal(rows[1].role,'challenge');
 assert.equal(rows[2].scenario,'proposal');
 assert.equal(rows[2].source,'<img src=x onerror=alert(1)>');
 assert.deepEqual(project,before,'read-only source inspection');
 assert.deepEqual(originalClockReadings(parseClockReceipt(serializeClockReceipt(receipt))),rows);
 assert.deepEqual(receipt.comparison.offsets[2].outsideReadingIndices,[1]);
});
test('retained unassigned fields are displayed as unassigned, not silently counted as calibration',()=>{
 const p=authored();delete p.observations[3].scenario;delete p.observations[3].use;
 const receipt=buildClockReceipt(p,[0,10],'fictional alternative');
 const rows=originalClockReadings(receipt);
 assert.equal(rows[3].scenario,'unassigned');
 assert.equal(rows[3].role,'unassigned');
 assert.equal(rows[3].considered,false);
});

test('per-offset source trace preserves duplicate rows, negative and positive window refusals',()=>{
 const project=authored();
 project.observations.splice(1,0,{...project.observations[0],source:'independent duplicate source'});
 const before=structuredClone(project);
 const receipt=buildClockReceipt(project,[0,-30,30],'authored clock alternative');
 const trace=clockOffsetReadingTrace(receipt);
 assert.deepEqual(trace.map(x=>x.offsetMinutes),[0,-30,30]);
 assert.deepEqual(trace[0].readings.map(x=>x.number),[1,2,3]);
 assert.deepEqual(trace[0].readings.map(x=>x.originalMinute),[20,20,35]);
 assert.deepEqual(trace[0].readings.map(x=>x.sampleMinute),[20,20,35]);
 assert.deepEqual(trace[1].readings.map(x=>x.sampleMinute),[-10,-10,5]);
 assert.deepEqual(trace[1].readings.map(x=>x.outsideModeledWindow),[true,true,false]);
 assert.deepEqual(trace[2].readings.map(x=>x.sampleMinute),[50,50,65]);
 assert.deepEqual(trace[2].readings.map(x=>x.outsideModeledWindow),[false,false,true]);
 assert.equal(trace[1].status,'outside-modeled-window');
 assert.equal(trace[2].status,'outside-modeled-window');
 assert.deepEqual(receipt.comparison.offsets[1].outsideReadingIndices,[0,1]);
 assert.deepEqual(receipt.comparison.offsets[2].outsideReadingIndices,[2]);
 assert.deepEqual(clockOffsetReadingTrace(parseClockReceipt(serializeClockReceipt(receipt))),trace);
 assert.deepEqual(project,before,'inspection may not edit original observations');
});
