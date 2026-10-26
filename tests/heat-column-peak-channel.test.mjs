import test from 'node:test';import assert from 'node:assert/strict';
import {project} from './heat-channel-question-fixture.mjs';
import {planHeatPeakQuestion,validateHeatPeakQuestion,serializeHeatPeakQuestion,parseHeatPeakQuestion,HEAT_PEAK_QUESTION_METHOD,HEAT_PEAK_CHANNEL_METHOD} from '../heat-column-peak-question.js';
import {searchHeatColumnParameters} from '../heat-column-search.js';
import {evaluateHeatColumnTarget} from '../heat-column.js';
import {finitePeakQuestion} from '../heat-column-peak-range.js';
export const query={capacity:{minimum:60000,maximum:500000},conductance:{minimum:10,maximum:40},source:'Authored original pulse domain, not inferred physical bounds'};
export const settings={fromMinute:0,toMinute:420,sampleCount:141,halfWidthC:2,acquisitionSource:'Hypothetical repeat-exposure opportunity for both sensors; no historical measurement inferred',includeLower:true,supportPolicy:'separate-channels',lowerHalfWidthC:2,lowerAssociationSource:'Hypothetical accessible sensor of the effective uniform lower store; no inferred depth'};
const surfaceSettings=()=>{const s={...settings};for(const key of ['includeLower','supportPolicy','lowerHalfWidthC','lowerAssociationSource'])delete s[key];return s;};
test('every distinct inferred proposal supports the lower-channel worst-peak improvement',()=>{
 const p=project(),before=structuredClone(p),r=planHeatPeakQuestion(p,query,settings);assert.equal(r.method,HEAT_PEAK_CHANNEL_METHOD);assert.equal(r.uniqueProposalCount,108);assert.equal(r.best.channel,'lower');assert.equal(r.best.minute,39);assert.ok(Math.abs(r.best.worstRemainingC-.5433980525344424)<1e-12);assert.ok(Math.abs(r.bestByChannel.surface.worstRemainingC-5.993418203137349)<1e-12);assert.equal(r.best.predictions.length,108);assert.deepEqual(p,before);
 const search=searchHeatColumnParameters(p,query);assert.deepEqual(new Set(r.best.predictions.map(p=>p.id)),new Set(search.compatibleIds));
});
test('tighter precision can prefer surface; broad bands retain no reduction',()=>{
 const p=project(),fine=planHeatPeakQuestion(p,query,{...settings,halfWidthC:.01,lowerHalfWidthC:.01});assert.equal(fine.best.channel,'surface');
 const broad=planHeatPeakQuestion(p,query,{...settings,halfWidthC:5,lowerHalfWidthC:5});assert.equal(broad.status,'no-peak-reduction');assert.equal(broad.best.reductionC,0);assert.equal(broad.best.channel,'surface');
});
test('original surface-only outputs and optimum remain unchanged inside the expanded comparison',()=>{
 const p=project(),old=planHeatPeakQuestion(p,query,surfaceSettings()),both=planHeatPeakQuestion(p,query,settings);assert.equal(old.method,HEAT_PEAK_QUESTION_METHOD);
 const surface=both.rows.filter(r=>r.channel==='surface').map(({channel,halfWidthC,...r})=>r);assert.deepEqual(surface,old.rows);const {channel,halfWidthC,...best}=both.bestByChannel.surface;assert.deepEqual(best,old.best);
 const {lowerHalfWidthC,lowerAssociationSource,supportPolicy,includeLower,...base}=settings;assert.deepEqual(planHeatPeakQuestion(p,query,base),old);
});
test('held-aside values never change proposal selection or either channel question',()=>{
 const p=project(),s={...settings,sampleCount:29},a=planHeatPeakQuestion(p,query,s);p.heatColumnEvidence.readings[1].temperatureC=100;p.heatColumnEvidence.readings[1].halfWidthC=99;assert.deepEqual(planHeatPeakQuestion(p,query,s),a);
});
test('interval means receive exact maintained lower operator and duplicate-insensitive objective',()=>{
 const p=project(),s={...settings,fromMinute:45,toMinute:135,sampleCount:7,aggregation:'interval-mean',averagingMinutes:45},r=planHeatPeakQuestion(p,query,s);assert.equal(r.rows.filter(r=>r.channel==='lower').length,7);assert.ok(r.rows.filter(r=>r.channel==='surface').length<7);
 for(const row of r.rows.filter(r=>r.channel==='lower')){for(const prediction of row.predictions.slice(0,3)){const study=structuredClone(p.heatColumnStudy);Object.assign(study.lowerLayers.existing,prediction.hypothesis);assert.equal(prediction.predictionC,evaluateHeatColumnTarget(study,'existing',[],[{fromMinute:row.fromMinute,minute:row.minute}]).averages[0].subsurfaceMeanC);}
 const original=finitePeakQuestion(row.predictions),duplicated=finitePeakQuestion([...row.predictions,...row.predictions.slice(0,100)]);assert.equal(duplicated.worstRemainingC,original.worstRemainingC);assert.equal(finitePeakQuestion([...row.predictions].reverse()).worstRemainingC,original.worstRemainingC);}
});
test('complete surface coverage leaves hypothetical lower available without inferring historical measurements',()=>{
 const p=project();p.heatColumnEvidence.readings.push({aggregation:'interval-mean',fromMinute:0,minute:420,temperatureC:20,halfWidthC:1,use:'challenge',source:'Authored surface support; value cannot choose question'});
 const old=planHeatPeakQuestion(p,query,surfaceSettings()),r=planHeatPeakQuestion(p,query,settings);assert.equal(old.status,'no-unrecorded-time');assert.equal(r.status,'question');assert.equal(r.bestByChannel.surface,undefined);assert.ok(r.rows.every(r=>r.channel==='lower'));assert.equal(r.excludedByChannel.surface,141);
});
test('v1 original recipes stay surface-only and cannot inject v2 interpretation',()=>{
 const p=project(),oldText=serializeHeatPeakQuestion(p,query,surfaceSettings()),old=parseHeatPeakQuestion(oldText);assert.equal(old.method,HEAT_PEAK_QUESTION_METHOD);assert.equal(old.settings.includeLower,undefined);
 assert.throws(()=>parseHeatPeakQuestion(JSON.stringify({...old,settings})),/v1/);
 const fresh=parseHeatPeakQuestion(serializeHeatPeakQuestion(p,query,settings));assert.equal(fresh.method,HEAT_PEAK_CHANNEL_METHOD);assert.deepEqual(planHeatPeakQuestion(fresh.project,fresh.query,fresh.settings),planHeatPeakQuestion(p,query,settings));
 assert.throws(()=>parseHeatPeakQuestion(JSON.stringify({...old,method:HEAT_PEAK_CHANNEL_METHOD})),/Version 2/);assert.throws(()=>parseHeatPeakQuestion(JSON.stringify({...fresh,best:{}})),/Expected/);
});
test('combined work and missing lower acquisition declarations refuse before prospective computation',()=>{
 const p=project();for(const s of [{...settings,lowerHalfWidthC:-1},{...settings,lowerAssociationSource:''},{...settings,supportPolicy:'shared'},{...settings,includeLower:false}])assert.throws(()=>validateHeatPeakQuestion(p,query,s));
 const schedule=Array.from({length:12},()=>({...p.surfaceHeatStudy.schedule[0],minutes:35}));p.surfaceHeatStudy.schedule=structuredClone(schedule);p.heatColumnStudy.heatStudy.schedule=structuredClone(schedule);p.heatColumnEvidence.columnStudy.heatStudy.schedule=structuredClone(schedule);
 assert.doesNotThrow(()=>validateHeatPeakQuestion(p,query,{...surfaceSettings(),sampleCount:241}));assert.throws(()=>validateHeatPeakQuestion(p,query,{...settings,sampleCount:241}),/2000000/);
});
