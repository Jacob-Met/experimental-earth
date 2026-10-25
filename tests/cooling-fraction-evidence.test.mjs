import test from 'node:test';
import assert from 'node:assert/strict';
import {coolingExample} from '../evaporative-cooling-example.js';
import {prepareCooling,evaluateCoolingTarget,inspectCooling} from '../evaporative-cooling.js';
import {COOLING_FRACTION_SCHEMA,compareCoolingFractions,serializeCoolingFraction,parseCoolingFraction} from '../cooling-fraction-evidence.js';
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}: ${a-b}`);
const evidence=readings=>({schema:COOLING_FRACTION_SCHEMA,target:'proposal',fractionRange:[0,1],rangeSource:'Authored full admissible range',associationSource:'Authored effective surface comparison; no sensor acquisition',readings});
const reading=(minute,temperatureC,use='calibration',extra={})=>({minute,temperatureC,halfWidthC:.2,use,source:'Authored calculation, not a measured temperature',...extra});
const variant=(original,fraction)=>({...original,study:{...original.study,surfaceLatentFraction:{...original.study.surfaceLatentFraction,proposal:fraction}}});
function prediction(original,fraction,r){const v=evaluateCoolingTarget(variant(original,fraction),'proposal',[r.minute],r.fromMinute===undefined?[]:[r]);return r.fromMinute===undefined?v.trajectory.find(x=>x.minute===r.minute).surfaceC:v.averages[0].surfaceMeanC;}

test('direct intermediate fractions agree with affine point and mean predictions across stress/forcing switches',()=>{
  const x=coolingExample(),original=prepareCooling(x.project,x.study);
  const readings=[reading(60,0),reading(240,0),reading(480,0),reading(170,0,'calibration',{aggregation:'interval-mean',fromMinute:70}),reading(241,0,'challenge',{aggregation:'interval-mean',fromMinute:239}),reading(400,0,'challenge',{aggregation:'interval-mean',fromMinute:170})];
  for(const r of readings){const a=prediction(original,0,r),b=prediction(original,1,r);for(const f of [.02,.4,.73,.99])near(prediction(original,f,r),a+(b-a)*f,2e-12);}
});
test('direct-window means agree with independent numerical quadrature, partition and tiny-window limits',()=>{
  const x=coolingExample(),original=prepareCooling(x.project,x.study);
  for(const [fromMinute,minute] of [[20,130],[70,170],[170,400],[239,241]]){
    const actual=evaluateCoolingTarget(original,'proposal',[],[{fromMinute,minute}]).averages[0].surfaceMeanC;
    const cuts=[fromMinute,...[160,240].filter(t=>t>fromMinute&&t<minute),minute];
    let integral=0;
    for(let segment=1;segment<cuts.length;segment++){
      const n=1200,h=(cuts[segment]-cuts[segment-1])/n;let sum=0;
      for(let i=0;i<=n;i++)sum+=(i===0||i===n?1:i%2?4:2)*inspectCooling(original,cuts[segment-1]+i*h).proposal.surfaceC;
      integral+=sum*h/3;
    }
    near(actual,integral/(minute-fromMinute),2e-9);
    const mid=(fromMinute+minute)/2,parts=evaluateCoolingTarget(original,'proposal',[],[{fromMinute,minute:mid},{fromMinute:mid,minute}]).averages;
    near(actual,(parts[0].surfaceMeanC+parts[1].surfaceMeanC)/2,2e-12);
  }
  for(const t of [0,70,160,240,400]){
    const to=t===0?Number.MIN_VALUE:t+Number.EPSILON*Math.max(1,t);
    const avg=evaluateCoolingTarget(original,'proposal',[],[{fromMinute:t,minute:to}]).averages[0];
    near(avg.surfaceMeanC,inspectCooling(original,t).proposal.surfaceC,2e-12);
  }
});
test('calibration interval is retained unchanged when held-aside evidence challenges one common fraction',()=>{
  const x=coolingExample(),original=prepareCooling(x.project,x.study);
  const r1=reading(60,prediction(original,.4,{minute:60})),r2=reading(480,prediction(original,.4,{minute:480}),'challenge');
  const ev=evidence([r1,r2]),before=structuredClone({x,ev}),a=compareCoolingFractions(x.project,x.study,ev);
  assert.equal(a.status,'compatible-range');assert.ok(a.calibrationRange[0]<.4&&a.calibrationRange[1]>.4);assert.ok(a.calibrationRange[1]-a.calibrationRange[0]<.023);
  ev.readings[1].temperatureC=prediction(original,.8,r2);
  const b=compareCoolingFractions(x.project,x.study,ev);assert.equal(b.status,'challenged');assert.deepEqual(b.calibrationRange,a.calibrationRange);assert.equal(b.survivingRange,null);
  assert.deepEqual(x,before.x);assert.deepEqual(ev.readings[0],before.ev.readings[0]);
});
test('two individually compatible held-aside readings require the same fraction',()=>{
  const x=coolingExample(),original=prepareCooling(x.project,x.study);
  const ev=evidence([reading(0,28),reading(60,prediction(original,.2,{minute:60}),'challenge'),reading(480,prediction(original,.8,{minute:480}),'challenge')]);
  const r=compareCoolingFractions(x.project,x.study,ev);assert.deepEqual(r.calibrationRange,[0,1]);assert.ok(r.rows.slice(1).every(x=>x.compatibleFractionRange));assert.equal(r.challengeRange,null);assert.equal(r.status,'challenged');
});
test('dry, zero-demand and zero-latent controls preserve every fraction or reject every fraction',()=>{
  for(const mode of ['dry','demand','latent']){
    const x=coolingExample();if(mode==='dry')x.project.weather.rainMmHr=0;
    if(mode==='demand')x.study.demands.forEach(d=>d.potentialTranspirationMmPerDay=0);
    if(mode==='latent')x.study.latentHeatJkg=0;
    const original=prepareCooling(x.project,x.study),temp=prediction(original,.4,{minute:480}),ev=evidence([reading(480,temp)]);
    const r=compareCoolingFractions(x.project,x.study,ev);assert.deepEqual(r.calibrationRange,[0,1]);assert.equal(r.rows[0].sensitivity,'none');
    ev.readings[0].temperatureC+=1;assert.equal(compareCoolingFractions(x.project,x.study,ev).calibrationRange,null);
  }
});
test('point ranges, restricted ranges, zero-width bands and absent calibration remain explicit',()=>{
  const x=coolingExample(),original=prepareCooling(x.project,x.study),temp=prediction(original,.4,{minute:60});
  const ev=evidence([reading(60,temp,'calibration',{halfWidthC:0})]);ev.fractionRange=[.4,.4];
  const point=compareCoolingFractions(x.project,x.study,ev);assert.deepEqual(point.calibrationRange,[.4,.4]);assert.equal(point.rows[0].sensitivity,'fixed-range');
  ev.fractionRange=[.1,.2];assert.equal(compareCoolingFractions(x.project,x.study,ev).status,'calibration-rejected');
  ev.fractionRange=[0,1];const zero=compareCoolingFractions(x.project,x.study,ev);assert.ok(zero.calibrationRange[0]<=.4&&zero.calibrationRange[1]>=.4);
  ev.readings[0].use='challenge';assert.equal(compareCoolingFractions(x.project,x.study,ev).status,'need-calibration');
});
test('interval evidence uses complete means rather than endpoint temperatures',()=>{
  const x=coolingExample(),original=prepareCooling(x.project,x.study),r=reading(300,0,'calibration',{aggregation:'interval-mean',fromMinute:30,halfWidthC:0});
  r.temperatureC=prediction(original,.4,r);const result=compareCoolingFractions(x.project,x.study,evidence([r]));
  assert.ok(result.calibrationRange[0]<=.4&&result.calibrationRange[1]>=.4);
  assert.ok(Math.abs(r.temperatureC-prediction(original,.4,{minute:300}))>1);
});
test('source-only files reproduce inference and reject stale heat, forged outputs and invalid readings',()=>{
  const x=coolingExample(),ev=evidence([reading(60,36.46)]),text=serializeCoolingFraction(x.project,x.study,ev),opened=parseCoolingFraction(text);
  assert.deepEqual(compareCoolingFractions(opened.project,opened.study,opened.evidence),compareCoolingFractions(x.project,x.study,ev));
  assert.throws(()=>parseCoolingFraction(JSON.stringify({...opened,result:{status:'compatible-range'}})),/fields/);
  opened.project.heatColumnStudy.lowerLayers.proposal.capacityJm2K+=1;assert.throws(()=>parseCoolingFraction(JSON.stringify(opened)),/original current/);
  for(const change of [r=>r.fromMinute=1,r=>r.aggregation='minimum',r=>r.minute=481,r=>r.halfWidthC=-1,r=>r.source='',r=>r.temperatureC=Infinity]){const v=structuredClone(ev);change(v.readings[0]);assert.throws(()=>compareCoolingFractions(x.project,x.study,v));}
  const duplicate=structuredClone(ev);duplicate.readings.push(structuredClone(duplicate.readings[0]));assert.throws(()=>compareCoolingFractions(x.project,x.study,duplicate));
});
