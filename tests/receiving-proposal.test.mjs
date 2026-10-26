import test from 'node:test';
import assert from 'node:assert/strict';
import {inferReceivingProposal,proposeReceivingLayers} from '../receiving-proposal.js';
import {advanceDrainingLayer} from '../draining-infiltration.js';
import {makeDrainingEvidenceExample,serializeDrainingEvidence,parseDrainingEvidence} from '../draining-layer-evidence.js';
const settings={rainMmHr:36,infiltrationMmHr:24,stormMinutes:60,laterMinute:180};
function input(capacityMm=8,drainagePerHour=.5){
 const {project,study}=makeDrainingEvidenceExample();project.weather.stepMinutes=5;
 const options={capacityMm,drainagePerHour,infiltrationMmHr:24};
 const first=advanceDrainingLayer({...options,surfaceMm:0,storedMm:0,rainMmHr:36,hours:1});
 const later=advanceDrainingLayer({...options,surfaceMm:first.surfaceMm,storedMm:first.storedMm,rainMmHr:0,hours:2});
 const end=advanceDrainingLayer({...options,surfaceMm:later.surfaceMm,storedMm:later.storedMm,rainMmHr:0,hours:1});
 project.observations=[{cellIndex:0,minute:60,depthMm:first.surfaceMm,uncertaintyMm:.01,scenario:'proposal',use:'calibration',source:'Authored original storm-end depth'},
 {cellIndex:0,minute:180,depthMm:later.surfaceMm,uncertaintyMm:.01,scenario:'proposal',use:'calibration',source:'Authored original dry-period depth'},
 {cellIndex:0,minute:240,depthMm:end.surfaceMm,uncertaintyMm:.01,scenario:'proposal',use:'challenge',source:'Independent authored later check'}];
 return {project,study};
}
const options={target:'proposal',surface:'garden',initialStoredMm:0,basis:'Explicit authored initially empty isolated receiver'};
test('known declarations invert through the maintained forward kernel',()=>{
 for(const [C,k]of [[5,1],[8,.5],[5,0],[20,.1],[1,4]]){
  const {project}=input(C,k),a=project.observations;
  const p=inferReceivingProposal({...settings,stormEndDepthMm:a[0].depthMm,laterDepthMm:a[1].depthMm});
  assert.equal(p.status,'proposal');assert(Math.abs(p.capacityMm-C)<1e-10);assert(Math.abs(p.drainagePerHour-k)<1e-10);
 }
});
test('dryout, unsupported recession and missing transition do not invent a proposal',()=>{
 for(const [H,L]of [[5,0],[20,21],[12,12],[60,30],[36,36]])assert.equal(inferReceivingProposal({...settings,stormEndDepthMm:H,laterDepthMm:L}).status,'refused');
 assert.equal(inferReceivingProposal({...settings,stormEndDepthMm:NaN,laterDepthMm:1}).status,'refused');
});
test('source-bound proposal uses calibration only and forwards every original band',()=>{
 const {project,study}=input(),before=JSON.stringify(project),report=proposeReceivingLayers(project,options);
 assert.equal(report.status,'proposals');assert.equal(report.pairCount,1);assert.equal(report.candidates.length,1);
 const c=report.candidates[0];assert(Math.abs(c.hypothesis.capacityMm-8)<1e-10);assert(Math.abs(c.hypothesis.drainagePerHour-.5)<1e-10);
 assert.equal(c.calibration.compatible,true);assert.equal(c.challenge.compatible,true);assert.equal(JSON.stringify(project),before);
 const changed=structuredClone(project);changed.observations[2].depthMm=100;
 const after=proposeReceivingLayers(changed,options);
 assert.deepEqual(after.candidates.map(c=>c.hypothesis),report.candidates.map(c=>c.hypothesis));assert.equal(after.candidates[0].challenge.compatible,false);
 const conflicting=structuredClone(project);conflicting.observations.push({...project.observations[2],minute:120,use:'calibration',depthMm:100});
 const rejected=proposeReceivingLayers(conflicting,options);assert.equal(rejected.status,'calibration-conflict');assert.ok(rejected.candidates.every(c=>!c.calibration.compatible));
 const savedStudy=structuredClone(study);savedStudy.hypotheses.push({...c.hypothesis,id:'new-proposal'});
 const reopened=parseDrainingEvidence(serializeDrainingEvidence(project,savedStudy));
 assert.deepEqual(reopened.study.hypotheses.at(-1),savedStudy.hypotheses.at(-1));
 assert.deepEqual(proposeReceivingLayers(reopened.project,options),report);
});
test('role, initial-state, isolation and endpoint admission are explicit',()=>{
 const original=makeDrainingEvidenceExample();assert.equal(proposeReceivingLayers(original.project,options).status,'need-calibration-pair');
 const {project}=input();assert.throws(()=>proposeReceivingLayers(project,{...options,initialStoredMm:1}));
 assert.throws(()=>proposeReceivingLayers(project,{...options,basis:''}));
 const routed=structuredClone(project);routed.weather.mobilityPerHour=.1;assert.throws(()=>proposeReceivingLayers(routed,options));
 const outlet=structuredClone(project);outlet.weather.boundaryExitPerHour=.1;assert.throws(()=>proposeReceivingLayers(outlet,options));
 const offGrid=structuredClone(project);offGrid.observations[1].minute=181;assert.equal(proposeReceivingLayers(offGrid,options).status,'need-calibration-pair');
});
test('complete pair-family bound refuses before partial proposals',()=>{
 const {project}=input();const first=project.observations[0],last=project.observations[1];
 project.observations=[...Array.from({length:12},()=>structuredClone(first)),...Array.from({length:12},()=>structuredClone(last))];
 assert.throws(()=>proposeReceivingLayers(project,options),/complete calibration-pair family/);
});
test('complete source cell-step bound refuses a small pair family before simulation',()=>{
 const {project}=input();project.width=24;project.height=24;project.selectedIndex=0;
 for(const target of ['existing','proposal'])project[target]=Array.from({length:576},()=>structuredClone(project[target][0]));
 project.weather.stepMinutes=1;project.weather.durationMinutes=720;
 project.observations.push({...project.observations[1],minute:240},{...project.observations[1],minute:300});
 assert.throws(()=>proposeReceivingLayers(project,options),/complete calibration-pair family/);
});
