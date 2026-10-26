import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNoaaExample} from '../examples/noaa-tucson-hourly/build.mjs';
import {receiveHourlyBytes,replayHourlyReceipt} from '../noaa-hourly.js';
import {compareHourlyInvestigation,serializeHourlyRecipe,parseHourlyRecipe} from '../noaa-hourly-investigation.js';
export function originalRecipe(){
 const baseline=buildNoaaExample();return {baseline,input:{schema:'experimental-earth-noaa-input/1',sourceUrl:baseline.intake.sourceUrl,sha256:baseline.intake.sha256,rawText:baseline.intake.rawText,selection:{firstLine:1,count:9,correctionType:'C',initialState:baseline.course.initialState},surface:{capacityJm2K:20000,exchangeWm2K:10,absorptivity:.8,source:'Authored unfitted surface properties'},hypotheses:baseline.project.heatColumnEvidence.hypotheses,band:{halfWidthC:.5,source:'Authored comparison band, not NOAA instrument uncertainty'},calibrationCount:3,associationSource:'Declared association of original infrared surface mean with modeled uniform surface; not measured column properties'}};
}
test('original nine-row NOAA bytes reach unchanged maintained rejected-family predictions',async()=>{
 const {baseline,input}=originalRecipe(),before=structuredClone(input);
 const intake=await receiveHourlyBytes(new TextEncoder().encode(input.rawText),{sourceUrl:input.sourceUrl,expectedSha256:input.sha256});assert.deepEqual(intake,baseline.intake);
 const received=await compareHourlyInvestigation(input);assert.deepEqual(received.report,baseline.report);assert.equal(received.report.status,'calibration-rejected');
 assert.deepEqual(input,before);assert.equal(received.course.rows.length,9);assert.equal(received.project.heatColumnEvidence.readings[0].aggregation,'interval-mean');
 assert.notEqual(received.project,baseline.project);
});
test('input-only serialized original bytes replay; missing/wrong identity and added answer refuse',async()=>{
 const {input}=originalRecipe();const received=await compareHourlyInvestigation(parseHourlyRecipe(serializeHourlyRecipe(input)));
 assert.equal(received.report.status,'calibration-rejected');
 for(const sha256 of [undefined,'bad','0'.repeat(64)])await assert.rejects(compareHourlyInvestigation({...input,sha256}));
 await assert.rejects(compareHourlyInvestigation({...input,rawText:input.rawText.replace('4.5','4.6')}),/SHA/);
 assert.throws(()=>parseHourlyRecipe(JSON.stringify({...input,report:{status:'one-survivor'}})),/versioned/);
});
test('new original contiguous subset changes course without refitting offered declarations',async()=>{
 const {input}=originalRecipe(),original=await compareHourlyInvestigation(input);
 const next=structuredClone(input);next.selection.firstLine=4;next.selection.count=6;next.selection.initialState.timeUtc='2025-01-01T18:00:00.000Z';next.calibrationCount=2;
 const changed=await compareHourlyInvestigation(next);assert.equal(changed.course.rows.length,6);assert.equal(changed.project.heatColumnEvidence.readings[0].temperatureC,24.4);
 assert.deepEqual(changed.project.heatColumnEvidence.hypotheses,original.project.heatColumnEvidence.hypotheses);assert.notDeepEqual(changed.report,original.report);
});
test('missing source, unsupported count and mismatched initial instant refuse before a course',async()=>{
 const {input}=originalRecipe();for(const edit of [x=>x.selection.count=25,x=>x.selection.initialState.timeUtc='2025-01-01T16:00:00.000Z',x=>x.band.source='',x=>x.surface.source='',x=>x.selection.initialState.assumption='',x=>x.calibrationCount=10,x=>x.hypotheses[0].capacityJm2K=0]){
  const bad=structuredClone(input);edit(bad);await assert.rejects(compareHourlyInvestigation(bad));
 }
 const noHash=structuredClone(input);delete noHash.sha256;await assert.rejects(replayHourlyReceipt(noHash),/Unsupported/);
});

test('asynchronous hashing and comparison retain their original input snapshot',async()=>{
 const {baseline,input}=originalRecipe(),bytes=new TextEncoder().encode(input.rawText);
 const receiving=receiveHourlyBytes(bytes,{sourceUrl:input.sourceUrl});bytes.fill(0);
 assert.deepEqual(await receiving,baseline.intake);
 const comparing=compareHourlyInvestigation(input);input.hypotheses[0].capacityJm2K=0;input.sha256='0'.repeat(64);input.selection.firstLine=999;
 assert.deepEqual((await comparing).report,baseline.report);
});
