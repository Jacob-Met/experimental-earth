import test from 'node:test';
import assert from 'node:assert/strict';
import {project} from './heat-channel-question-fixture.mjs';
import {planHeatChannelQuestion,serializeHeatChannelQuestion,parseHeatChannelQuestion} from '../heat-channel-question.js';
import {evaluateHeatColumnTarget} from '../heat-column.js';
const settings={fromMinute:0,toMinute:420,sampleCount:141,aggregation:'instant',averagingMinutes:0,surfaceHalfWidthC:1,lowerHalfWidthC:1,lowerAssociationSource:'Authored proposed sensor represents the uniform lower store; no inferred depth.'};
test('lower channel resolves the pair left unresolved by the best surface question',()=>{
 const p=project(),before=structuredClone(p),r=planHeatChannelQuestion(p,settings);
 assert.equal(r.bestByChannel.surface.separatedCount,9);assert.equal(r.bestByChannel.lower.separatedCount,10);assert.equal(r.best.channel,'lower');assert.equal(r.best.minute,87);assert.deepEqual(p,before);
 assert.equal(r.candidates.length,2*r.requestedCount-2*r.excludedCount);
});
test('every channel/time prediction and separation receives the exact maintained analytic course',()=>{
 const p=project(),r=planHeatChannelQuestion(p,{...settings,sampleCount:15});
 for(const c of r.candidates){for(const prediction of c.predictions){const h=p.heatColumnEvidence.hypotheses.find(h=>h.label===prediction.label),s=structuredClone(p.heatColumnEvidence.columnStudy);Object.assign(s.lowerLayers.existing,h);const value=evaluateHeatColumnTarget(s,'existing',[c.minute]).trajectory.find(x=>x.minute===c.minute);assert.equal(prediction.temperatureC,value[c.channel==='surface'?'surfaceC':'subsurfaceC']);}
 for(const pair of c.pairs){const [a,b]=pair.labels.map(l=>c.predictions.find(p=>p.label===l));assert.equal(pair.separated,Math.abs(a.temperatureC-b.temperatureC)>2*c.halfWidthC+a.guardC+b.guardC);}}
 const ranked=[...r.candidates].sort((a,b)=>b.separatedCount-a.separatedCount||b.minimumMarginC-a.minimumMarginC||Number(a.channel==='lower')-Number(b.channel==='lower')||a.minute-b.minute);assert.deepEqual(r.best,ranked[0]);
});
test('complete mean windows across forcing boundaries use both integrated channels',()=>{
 const p=project(),query={...settings,fromMinute:50,toMinute:200,sampleCount:16,aggregation:'interval-mean',averagingMinutes:45};
 p.heatColumnEvidence.readings=[{minute:0,temperatureC:20,halfWidthC:0,use:'calibration',source:'Authored common initial state'}];
 const r=planHeatChannelQuestion(p,query);assert.ok(r.candidates.some(c=>c.fromMinute<60&&c.minute>60));
 for(const c of r.candidates)for(const prediction of c.predictions){const h=p.heatColumnEvidence.hypotheses.find(h=>h.label===prediction.label),s=structuredClone(p.heatColumnStudy);Object.assign(s.lowerLayers.existing,h);const v=evaluateHeatColumnTarget(s,'existing',[],[{fromMinute:c.fromMinute,minute:c.minute}]).averages[0];assert.equal(prediction.temperatureC,v[c.channel==='surface'?'surfaceMeanC':'subsurfaceMeanC']);}
});
test('challenge values do not choose the question; unchanged supports still exclude both channels',()=>{
 const p=project(),a=planHeatChannelQuestion(p,settings);p.heatColumnEvidence.readings[1].temperatureC=499;p.heatColumnEvidence.readings[1].halfWidthC=100;assert.deepEqual(planHeatChannelQuestion(p,settings),a);
 for(const c of a.candidates)assert.ok(!p.heatColumnEvidence.readings.some(r=>r.minute===c.minute));
});
test('separate sensor precision changes the winning modality without changing the offered family',()=>{
 const p=project(),r=planHeatChannelQuestion(p,{...settings,lowerHalfWidthC:100});assert.equal(r.best.channel,'surface');assert.equal(r.bestByChannel.lower.separatedCount,0);assert.equal(r.labels.length,5);
});
test('zero coupling and wide-band negatives do not imply an informative lower sensor',()=>{
 const p=project();p.heatColumnEvidence.readings=[{minute:0,temperatureC:20,halfWidthC:0,use:'calibration',source:'Authored common state'}];for(const h of p.heatColumnEvidence.hypotheses)h.conductanceWm2K=0;
 const r=planHeatChannelQuestion(p,{...settings,surfaceHalfWidthC:0,lowerHalfWidthC:0});assert.equal(r.status,'no-separating-question');assert.equal(r.best.channel,'surface');assert.ok(r.candidates.every(c=>c.separatedCount===0));
 assert.equal(planHeatChannelQuestion(project(),{...settings,surfaceHalfWidthC:100,lowerHalfWidthC:100}).status,'no-separating-question');
});
test('source-only reopening recomputes and refuses injected cached answers',()=>{
 const p=project(),raw=serializeHeatChannelQuestion(p,settings),input=parseHeatChannelQuestion(raw);assert.deepEqual(planHeatChannelQuestion(input.project,input.settings),planHeatChannelQuestion(p,settings));
 assert.throws(()=>parseHeatChannelQuestion(JSON.stringify({...input,best:{channel:'lower'}})),/original/);
 input.project.heatColumnEvidence.readings[0].temperatureC=499;assert.equal(planHeatChannelQuestion(input.project,input.settings).status,'calibration-rejected');
});
test('invalid bounds and missing association refuse; missing or stale evidence has explicit status',()=>{
 for(const query of [{...settings,sampleCount:242},{...settings,lowerHalfWidthC:NaN},{...settings,lowerAssociationSource:''},{...settings,aggregation:'interval-mean',averagingMinutes:0}])assert.throws(()=>planHeatChannelQuestion(project(),query));
 const p=project();p.heatColumnEvidence.readings=[];assert.equal(planHeatChannelQuestion(p,settings).status,'need-calibration');p.existing[0].provenance+=' changed';assert.equal(planHeatChannelQuestion(p,settings).status,'context-changed');delete p.heatColumnEvidence;assert.equal(planHeatChannelQuestion(p,settings).status,'no-evidence');
});
test('touching prospective lower bands remain unresolved under the maintained guarded rule',()=>{
 const p=project();p.heatColumnEvidence.hypotheses=p.heatColumnEvidence.hypotheses.slice(0,2);p.heatColumnEvidence.readings=[{minute:0,temperatureC:20,halfWidthC:0,use:'calibration',source:'Authored shared initial state'}];
 const query={...settings,fromMinute:0,toMinute:87,sampleCount:2,surfaceHalfWidthC:100,lowerHalfWidthC:0};const first=planHeatChannelQuestion(p,query),pair=first.bestByChannel.lower.pairs[0];
 const touch=planHeatChannelQuestion(p,{...query,lowerHalfWidthC:pair.gapC/2});assert.equal(touch.bestByChannel.lower.separatedCount,0);
 const apart=planHeatChannelQuestion(p,{...query,lowerHalfWidthC:pair.gapC/4});assert.equal(apart.bestByChannel.lower.separatedCount,1);
});
