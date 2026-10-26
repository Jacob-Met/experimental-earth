import test from 'node:test';import assert from 'node:assert/strict';
import {bandCase,query} from './heat-column-band-fixture.mjs';
import {planHeatPeakQuestion,serializeHeatPeakQuestion,parseHeatPeakQuestion,validateHeatPeakQuestion} from '../heat-column-peak-question.js';
import {HEAT_BAND_SEARCH_METHOD} from '../heat-column-band-search.js';
const settings={fromMinute:145,toMinute:420,sampleCount:56,halfWidthC:.25,aggregation:'instant',averagingMinutes:0,searchMethod:HEAT_BAND_SEARCH_METHOD,acquisitionSource:'Authored available future window and assumed precision; no acquisition'};
test('all inferred proposals support a future peak question without altering original readings or offered alternatives',()=>{
 const p=bandCase(),original=structuredClone(p),r=planHeatPeakQuestion(p,query,settings);assert.equal(r.status,'question');assert.equal(r.uniqueProposalCount,67);assert.equal(r.best.minute,145);assert.ok(r.best.beforeC>6);assert.ok(r.best.worstRemainingC<1.55);assert.equal(r.best.predictions.length,r.uniqueProposalCount);assert.equal(r.rows.length,56);assert.deepEqual(p,original);assert.ok(r.rows.every(x=>x.minute>143));
 for(const prediction of r.best.predictions){assert.ok(prediction.guardC>0);assert.equal(prediction.hypothesis.source,query.source);assert.ok(prediction.lowerC<=prediction.predictionC&&prediction.upperC>=prediction.predictionC);}
 const wide=planHeatPeakQuestion(p,query,{...settings,halfWidthC:100});assert.equal(wide.status,'no-peak-reduction');assert.equal(wide.best.reductionC,0);assert.equal(wide.best.minute,145);
});
test('held-aside values never steer peak questions; all original supports remain excluded',()=>{
 const p=bandCase();p.heatColumnEvidence.readings.push({minute:200,temperatureC:20,halfWidthC:.1,use:'challenge',source:'Authored held-aside control'});const r=planHeatPeakQuestion(p,query,settings);assert.equal(r.excludedCount,1);assert.ok(r.rows.every(x=>x.minute!==200));
 p.heatColumnEvidence.readings.at(-1).temperatureC=100;assert.deepEqual(planHeatPeakQuestion(p,query,settings),r);
 p.heatColumnEvidence.readings[p.heatColumnEvidence.readings.length-1]={...p.heatColumnEvidence.readings.at(-1),aggregation:'interval-mean',fromMinute:200,minute:220};const interval=planHeatPeakQuestion(p,query,settings);assert.equal(interval.excludedCount,5);assert.ok(interval.rows.every(x=>x.minute<200||x.minute>220));
});
test('prospective interval means use maintained operator and exclude whole overlapping supports',()=>{
 const p=bandCase();const r=planHeatPeakQuestion(p,query,{...settings,fromMinute:140,toMinute:220,sampleCount:17,aggregation:'interval-mean',averagingMinutes:10});assert.equal(r.excludedCount,2);assert.equal(r.status,'question');assert.ok(r.rows.every(x=>x.minute<143||x.fromMinute>143));assert.ok(r.best.predictions.every(x=>Number.isFinite(x.predictionC)));
 const points=planHeatPeakQuestion(p,query,{...settings,fromMinute:140,toMinute:220,sampleCount:17});assert.notEqual(r.best.predictions[0].predictionC,points.best.predictions[0].predictionC);
});
test('no calibration, contradictory originals and wholly recorded windows do not manufacture a question',()=>{
 const p=bandCase();p.heatColumnEvidence.readings=p.heatColumnEvidence.readings.map(r=>({...r,use:'challenge'}));assert.equal(planHeatPeakQuestion(p,query,settings).status,'need-calibration');
 const bad=bandCase();bad.heatColumnEvidence.readings[0].temperatureC=100;assert.equal(planHeatPeakQuestion(bad,query,settings).status,'no-compatible-proposals');
 const all=bandCase();all.heatColumnEvidence.readings.push({aggregation:'interval-mean',fromMinute:145,minute:420,temperatureC:20,halfWidthC:1,use:'challenge',source:'Authored support exclusion control'});assert.equal(planHeatPeakQuestion(all,query,settings).status,'no-unrecorded-time');
});
test('source replay preserves600-character provenance and refuses forged answers, invalid operators and excess work',()=>{
 const p=bandCase(),source='Source '.padEnd(569,'x')+'https://example.org/source-tail';const original={...settings,acquisitionSource:source};assert.equal(source.length,600);const parsed=parseHeatPeakQuestion(serializeHeatPeakQuestion(p,query,original));assert.deepEqual(parsed.settings,original);assert.deepEqual(planHeatPeakQuestion(parsed.project,parsed.query,parsed.settings),planHeatPeakQuestion(p,query,original));
 for(const extra of [{...parsed,best:{}},{...parsed,method:'claimed-optimum'}])assert.throws(()=>parseHeatPeakQuestion(JSON.stringify(extra)));
 for(const bad of [{acquisitionSource:''},{searchMethod:'unknown'},{aggregation:'interval-mean',averagingMinutes:0},{sampleCount:242},{fromMinute:421},{halfWidthC:-1}])assert.throws(()=>validateHeatPeakQuestion(p,query,{...settings,...bad}));
 const big=bandCase();const schedule=Array.from({length:24},()=>({...big.heatColumnStudy.heatStudy.schedule[0],minutes:10}));big.surfaceHeatStudy.schedule=structuredClone(schedule);big.heatColumnStudy.heatStudy.schedule=structuredClone(schedule);big.heatColumnEvidence.columnStudy.heatStudy.schedule=structuredClone(schedule);assert.throws(()=>validateHeatPeakQuestion(big,query,{...settings,fromMinute:145,toMinute:240,sampleCount:241}),/2000000/);
});
