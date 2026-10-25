import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {prepareSurfaceHeatStudy} from '../surface-heat.js';
import {prepareHeatColumnStudy, evaluateHeatColumnTarget} from '../heat-column.js';
import {prepareHeatColumnEvidence, authoredHeatColumnEvidenceExample} from '../heat-column-evidence.js';
import {planHeatColumnQuestion} from '../heat-column-question.js';
function project() {
  const p = makeExample();
  const top = { capacityJm2K: 20000, exchangeWm2K: 10, absorptivity: .8, initialC: 20, source: 'Authored surface reference' };
  p.surfaceHeatStudy = prepareSurfaceHeatStudy(p, { cellIndex: 0, existing: top, proposal: { ...top, absorptivity: .4 },
    schedule: [{ minutes: 60, incidentWm2: 700, reservoirC: 20, source: 'Authored pulse' },
      { minutes: 360, incidentWm2: 0, reservoirC: 20, source: 'Authored dark interval' }] });
  const lower = { capacityJm2K: 80000, conductanceWm2K: 20, initialC: 20, source: 'Authored lower reference' };
  p.heatColumnStudy = prepareHeatColumnStudy(p, { existing: lower, proposal: lower });
  p.heatColumnEvidence = prepareHeatColumnEvidence(p, authoredHeatColumnEvidenceExample(p));
  return p;
}



const settings={fromMinute:60,toMinute:420,sampleCount:121,halfWidthC:.6,aggregation:'interval-mean',averagingMinutes:60};
test('sensor averaging changes the supported question and retains its complete time support',()=>{
 const p=project(),before=structuredClone(p),r=planHeatColumnQuestion(p,settings);
 assert.equal(r.status,'question');assert.equal(r.best.fromMinute,123);assert.equal(r.best.minute,183);assert.equal(r.best.separatedCount,10);assert.equal(r.excludedCount,41);
 assert.ok(Math.abs(r.best.predictions[1].temperatureC-26.410758883125453)<1e-10);assert.deepEqual(p,before);
 const instant=planHeatColumnQuestion(p,{fromMinute:0,toMinute:420,sampleCount:141,halfWidthC:.6});assert.equal(instant.best.minute,132);
});
test('averaging never silently invokes an endpoint; changed challenge values remain excluded',()=>{
 const p=project(),r=planHeatColumnQuestion(p,settings);p.heatColumnEvidence.readings[1].temperatureC=499;assert.deepEqual(planHeatColumnQuestion(p,settings),r);
 assert.throws(()=>planHeatColumnQuestion(p,{...settings,averagingMinutes:0}),/positive/);assert.throws(()=>planHeatColumnQuestion(p,{...settings,aggregation:'instant'}),/instantaneous/);assert.throws(()=>planHeatColumnQuestion(p,{...settings,fromMinute:30}),/window/);
});
test('a recorded averaging support excludes all overlapping prospective windows, regardless of its value',()=>{
 const p=project();p.heatColumnEvidence.readings[1]={...p.heatColumnEvidence.readings[1],aggregation:'interval-mean',fromMinute:120,minute:180};
 const r=planHeatColumnQuestion(p,settings);assert.ok(r.best.fromMinute>180);assert.ok(r.excludedCount>41);
});
test('averaged calibration is screened through the maintained averaging observation operator',()=>{
 const p=project();p.heatColumnEvidence.readings=[{minute:60,fromMinute:0,aggregation:'interval-mean',temperatureC:37.479204630000,halfWidthC:100,use:'calibration',source:'Authored broad averaged control'}];
 const r=planHeatColumnQuestion(p,settings);assert.equal(r.labels.length,5);assert.equal(r.status,'question');
});
test('very long averaging can leave pairs unresolved even when an instantaneous question separates all',()=>{
 const p=project(),r=planHeatColumnQuestion(p,{...settings,averagingMinutes:120,fromMinute:120,sampleCount:101});assert.equal(r.best.separatedCount,8);assert.equal(r.best.pairs.length,10);
});
test('an averaged calibration can resolve what an instantaneous endpoint could not',()=>{
 const p=project();p.heatColumnEvidence.readings=[{minute:60,fromMinute:0,aggregation:'interval-mean',temperatureC:37.479207672856035,halfWidthC:.01,use:'calibration',source:'Authored exact interval-mean control'}];
 const averaged=planHeatColumnQuestion(p,settings);assert.equal(averaged.status,'one-alternative');assert.deepEqual(averaged.labels,['B · reference lower store']);
 delete p.heatColumnEvidence.readings[0].aggregation;delete p.heatColumnEvidence.readings[0].fromMinute;
 assert.equal(planHeatColumnQuestion(p,settings).status,'calibration-rejected');
});
test('closed-support policy explicitly excludes touching endpoints without changing records',()=>{
 const p=project(),before=structuredClone(p);const r=planHeatColumnQuestion(p,{...settings,fromMinute:120,toMinute:180,sampleCount:2});
 assert.equal(r.status,'no-unrecorded-time');assert.equal(r.excludedCount,2);assert.deepEqual(p,before);
});
test('coincident floating-point grid times refuse instead of blaming the averaging operator',()=>{
 const p=project();assert.throws(()=>planHeatColumnQuestion(p,{...settings,fromMinute:180,toMinute:180+Number.EPSILON*128,sampleCount:241}),/precision/);
});
