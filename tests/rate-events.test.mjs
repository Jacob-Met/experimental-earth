import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readRateEvent,compareRateEvents,exportRateComparison,importRateComparison} from '../rate-events.js';
const header='minute,rain_mm_hr,runon_mm_hr,runoff_mm_hr,source_line\n';
const source={event:'Original run',source:'Original field sheet; rates in mm/h',fileName:'event.csv'};
const read=csv=>readRateEvent(header+csv,source);
test('acquired USDA original DRY samples retain source and descriptive sample facts',()=>{
  const acquired=JSON.parse(readFileSync(new URL('../research/usda-er2-dry.json',import.meta.url)));
  const csv=header+acquired.rows.map(({raw:r,sourceLine})=>[r.Time,r.Precipitation,r['Run-on'],r.Runoff,sourceLine].join(',')).join('\n');
  const event=readRateEvent(csv,{...source,event:'ER2/N/1/2013-07-30 DRY',source:acquired.source.doi});
  const comparison=compareRateEvents(event,event);
  assert.equal(event.samples.length,13);
  assert.deepEqual(event.samples.map(s=>s.raw.runoff_mm_hr),acquired.rows.map(s=>s.raw.Runoff));
  assert.deepEqual(comparison.leftSummary,{sampleCount:13,missingRunoffCount:0,peakSampleRateMmHr:14,peakSampleMinutes:[15,20,25],firstPositiveSampleMinute:7,largestSampleGapMinutes:10,firstMinute:0,lastMinute:46.33});
  assert.equal(comparison.coincident.length,13);
  assert.ok(comparison.coincident.every(p=>Object.values(p.rightMinusLeftMmHr).every(x=>x===0)));
});
test('exact declared time resolution; differing times never interpolate and forcing remains separate',()=>{
  const a=read('0,10,0,0,2\n1.2,10,0,3,3\n2,10,0,4,4');
  const b=read('0.000000,20,rate1,NA,7\n1.200000,20,0,5,8\n2.000001,0,0,8,9');
  const result=compareRateEvents(a,b);
  assert.equal(result.coincident.length,2);
  assert.deepEqual(result.coincident[0].rightMinusLeftMmHr,{rain:10,runon:null,runoff:null});
  assert.deepEqual(result.coincident[1].rightMinusLeftMmHr,{rain:10,runon:0,runoff:2});
  assert.equal(result.right.samples[0].runon.kind,'unknown-nonzero');
  assert.equal(result.rightSummary.missingRunoffCount,1);
});
test('original-only export/reopen ignores no original source and recomputes derived fields',()=>{
  const a=read('0,10,0,0,2\n1,10,0,2,3');
  const b=read('0,10,0,0,4\n1,10,0,3,5');
  const before=JSON.stringify([a,b]);
  a.samples[1].runoff.value=999;
  const saved=exportRateComparison(a,b);
  assert.ok(!saved.includes('999'));
  const replay=importRateComparison(saved);
  assert.equal(replay.left.samples[1].runoff.value,2);
  assert.equal(replay.coincident[1].rightMinusLeftMmHr.runoff,1);
  assert.equal(replay.left.text,a.text);
  assert.equal(JSON.stringify([replay.left,replay.right]),before);
});
test('malformed, rounded-time, underflow, duplicate and capacity controls refuse whole event',()=>{
  for(const csv of ['0,10,0,0,2\n0,10,0,1,3','0,10,0,0,2\n1.0000001,10,0,1,3','0,10,0,0,2\n1,10,0,1,2','0,10,0,0,2\n1,10,0,-1e-400,3','0,10,0,0,2\n1,10,0,1e-400,3','0,10,rate6,0,2\n1,10,0,1,3'])assert.throws(()=>read(csv));
  assert.throws(()=>read(Array.from({length:513},(_,i)=>`${i},10,0,1,${i+2}`).join('\n')));
  assert.throws(()=>read('0,10,0,0,2'));
  assert.throws(()=>importRateComparison(JSON.stringify({kind:'experimental-earth-original-rate-events',version:1,events:[null,null]})));
});
test('all acquired DRY/WET source rows survive and independent exact-time oracle agrees',()=>{
  const pair=JSON.parse(readFileSync(new URL('../research/usda-er2-original-pair.json',import.meta.url)));
  const result=importRateComparison(readFileSync(new URL('../research/usda-er2-rate-comparison.json',import.meta.url),'utf8'));
  for(const [kind,event] of [['DRY',result.left],['WET',result.right]]){
    assert.equal(event.samples.length,pair.events[kind].length);
    event.samples.forEach((s,i)=>{const original=pair.events[kind][i];assert.deepEqual([s.raw.minute,s.raw.rain_mm_hr,s.raw.runon_mm_hr,s.raw.runoff_mm_hr,s.sourceLine],[original.raw.Time,original.raw.Precipitation,original.raw['Run-on'],original.raw.Runoff,original.sourceLine]);});
  }
  assert.deepEqual(result.coincident.map(p=>[p.minute,p.rightMinusLeftMmHr.runoff,p.rightMinusLeftMmHr.rain]),[[0,0,0],[9,7,0],[25,39,20],[35,64,45]]);
  assert.equal(result.rightSummary.peakSampleRateMmHr,125);
  assert.deepEqual(result.rightSummary.peakSampleMinutes,[54,56,58,59.5,61,63]);
  assert.equal(result.rightSummary.largestSampleGapMinutes,5);
  assert.equal(result.rightSummary.lastMinute,65.5);
});
test('aggregate original serialization refuses before emitting an unreopenable pair',()=>{
  const event=read('0,10,0,0,2\n1,10,0,2,3'+'\n'.repeat(80000)),before=JSON.stringify(event);
  assert.throws(()=>compareRateEvents(event,event),/complete original pair exceeds/);
  assert.throws(()=>exportRateComparison(event,event),/complete original pair exceeds/);
  assert.equal(JSON.stringify(event),before);
});
