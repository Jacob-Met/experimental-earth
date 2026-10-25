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


const settings = {fromMinute:0,toMinute:420,sampleCount:141,halfWidthC:.25};
test('authored ambiguous stores yield an unrecorded discriminating question without modifying sources',()=>{
 const p=project(), before=structuredClone(p), r=planHeatColumnQuestion(p,settings);
 assert.equal(r.status,'question');assert.equal(r.labels.length,5);assert.ok(r.best.separatedCount>0);
 assert.equal(r.best.pairs.length,10);assert.ok(!p.heatColumnEvidence.readings.some(x=>x.minute===r.best.minute));
 for(const prediction of r.best.predictions){const h=p.heatColumnEvidence.hypotheses.find(h=>h.label===prediction.label);const study=structuredClone(p.heatColumnStudy);Object.assign(study.lowerLayers.existing,h);const row=evaluateHeatColumnTarget(study,'existing',[r.best.minute]).trajectory.find(x=>x.minute===r.best.minute);assert.equal(prediction.temperatureC,row.surfaceC);}
 assert.deepEqual(p,before);
});
test('challenge values and widths cannot alter selected support or question',()=>{
 const p=project(), a=planHeatColumnQuestion(p,settings);p.heatColumnEvidence.readings[1].temperatureC=499;p.heatColumnEvidence.readings[1].halfWidthC=99;
 assert.deepEqual(planHeatColumnQuestion(p,settings),a);
});
test('uncoupled stores share the independent one-store closed-form response and do not separate',()=>{
 const p=project();for(const h of p.heatColumnEvidence.hypotheses)h.conductanceWm2K=0;
 p.heatColumnEvidence.readings=[{minute:0,temperatureC:20,halfWidthC:0,use:'calibration',source:'Authored initial control'}];
 const r=planHeatColumnQuestion(p,{...settings,toMinute:60,sampleCount:3});assert.equal(r.status,'no-separating-time');
 for(const x of r.best.predictions){const expected=20+56*(1-Math.exp(-10*r.best.minute*60/20000));assert.ok(Math.abs(x.temperatureC-expected)<1e-10);}
 assert.equal(r.best.separatedCount,0);assert.equal(r.best.pairs.length,10);
});
test('missing support, stale place and malformed windows remain explicit',()=>{
 const p=project();assert.throws(()=>planHeatColumnQuestion(p,{...settings,sampleCount:242}),/241/);assert.throws(()=>planHeatColumnQuestion(p,{...settings,fromMinute:420}),/window/);
 p.heatColumnEvidence.readings=[];assert.equal(planHeatColumnQuestion(p,settings).status,'need-calibration');
 p.existing[0].provenance+=' changed';assert.equal(planHeatColumnQuestion(p,settings).status,'context-changed');
});
test('all requested observed times refuse; a wide prospective band does not invent separation',()=>{
 const p=project();assert.equal(planHeatColumnQuestion(p,{...settings,fromMinute:60,toMinute:120,sampleCount:2}).status,'no-unrecorded-time');
 assert.equal(planHeatColumnQuestion(p,{...settings,halfWidthC:100}).status,'no-separating-time');
});
test('every sampled time is scored by an independently enumerated pair oracle',()=>{
 const p=project(), opts={...settings,sampleCount:29}, result=planHeatColumnQuestion(p,opts), rows=[];
 for(let i=0;i<opts.sampleCount;i++){
  const minute=i===opts.sampleCount-1?opts.toMinute:opts.fromMinute+(opts.toMinute-opts.fromMinute)*i/(opts.sampleCount-1);
  if(p.heatColumnEvidence.readings.some(r=>r.minute===minute))continue;
  const values=p.heatColumnEvidence.hypotheses.map(h=>{const study=structuredClone(p.heatColumnStudy);Object.assign(study.lowerLayers.existing,h);return evaluateHeatColumnTarget(study,'existing',[minute]).trajectory.find(r=>r.minute===minute).surfaceC;});
  let count=0,min=Infinity;for(let a=0;a<values.length;a++)for(let b=a+1;b<values.length;b++){const gap=Math.abs(values[a]-values[b]);if(gap>2*opts.halfWidthC)count++;min=Math.min(min,gap);}
  rows.push({minute,count,min});
 }
 rows.sort((a,b)=>b.count-a.count||b.min-a.min||a.minute-b.minute);
 assert.equal(result.best.minute,rows[0].minute);assert.equal(result.best.separatedCount,rows[0].count);
 const permuted=structuredClone(p);permuted.heatColumnEvidence.hypotheses.reverse();const again=planHeatColumnQuestion(permuted,opts);assert.equal(again.best.minute,result.best.minute);assert.equal(again.best.separatedCount,result.best.separatedCount);
});
test('finite capacity can remain unobservable under zero coupling even with zero reading width',()=>{
 const p=project();for(const h of p.heatColumnEvidence.hypotheses)h.conductanceWm2K=0;
 p.heatColumnEvidence.readings=[{minute:0,temperatureC:20,halfWidthC:0,use:'calibration',source:'Authored'}];
 assert.equal(planHeatColumnQuestion(p,{...settings,halfWidthC:0}).status,'no-separating-time');
});
test('touching prospective bands stay unresolved and a genuine positive gap separates',()=>{
 const p=project();p.heatColumnEvidence.hypotheses=p.heatColumnEvidence.hypotheses.slice(0,2);
 p.heatColumnEvidence.readings=[{minute:0,temperatureC:20,halfWidthC:0,use:'calibration',source:'Authored initial'}];
 const opts={fromMinute:0,toMinute:40,sampleCount:2,halfWidthC:0};const gap=planHeatColumnQuestion(p,opts).best.pairs[0].gapC;
 assert.ok(gap>0);assert.equal(planHeatColumnQuestion(p,{...opts,halfWidthC:gap/2}).status,'no-separating-time');
 assert.equal(planHeatColumnQuestion(p,{...opts,halfWidthC:gap/4}).status,'question');
});
test('rejected calibration sets do not fall back to a closest alternative',()=>{
 const p=project();p.heatColumnEvidence.readings[0].temperatureC=499;
 assert.equal(planHeatColumnQuestion(p,settings).status,'calibration-rejected');
 delete p.heatColumnEvidence;assert.equal(planHeatColumnQuestion(p,settings).status,'no-evidence');
});
test('one calibration-supported alternative creates no two-model question',()=>{
 const p=project();p.heatColumnEvidence.readings[1].use='calibration';
 const r=planHeatColumnQuestion(p,settings);assert.equal(r.status,'one-alternative');assert.equal(r.labels.length,1);
});
test('new upstream mean calibration is screened by its actual averaging operator',()=>{
 const p=project();p.heatColumnEvidence.readings=[{minute:60,fromMinute:0,aggregation:'interval-mean',temperatureC:37.479207672856035,halfWidthC:.01,use:'calibration',source:'Authored interval-mean compatibility control'}];
 const r=planHeatColumnQuestion(p,settings);assert.equal(r.status,'one-alternative');assert.deepEqual(r.labels,['B · reference lower store']);
});
test('mean challenge support is excluded without letting its value choose the question',()=>{
 const p=project();p.heatColumnEvidence.readings[1]={...p.heatColumnEvidence.readings[1],fromMinute:80,minute:160,aggregation:'interval-mean'};
 const r=planHeatColumnQuestion(p,settings);assert.ok(r.best.minute<80||r.best.minute>160);assert.equal(r.excludedCount,28);
 p.heatColumnEvidence.readings[1].temperatureC=499;p.heatColumnEvidence.readings[1].halfWidthC=100;
 assert.deepEqual(planHeatColumnQuestion(p,settings),r);
});
