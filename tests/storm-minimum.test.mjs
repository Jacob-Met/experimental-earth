import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample,runRain,validateProject} from '../core.js';
import {compareStormResolution,prepareStormResolution} from '../storm-resolution.js';
import {STORM_INTENSITY_METRICS} from '../storm-intensity.js';

const approx=(actual,expected,tol=1e-7)=>assert.ok(
  Math.abs(actual-expected)<=tol,String(actual)+' != '+String(expected));

test('minimum supported boundary is separately opted in, with unchanged baseline',()=>{
  const project=makeExample(), original=JSON.stringify(project);
  project.proposal=structuredClone(project.existing);
  project.proposal[35].elevationM+=0.025;
  const source=JSON.stringify(project);
  const plain=compareStormResolution(project,[6,24,60,120]);
  const boundary=compareStormResolution(project,[6,24,60,120],{includeMinimumStep:true});
  assert.deepEqual(plain.stepsMinutes,[5,2.5,1.25]);
  assert.deepEqual(boundary.stepsMinutes,[5,2.5,1.25,1]);
  assert.equal(plain.minimumIncluded,false);
  assert.equal(boundary.minimumIncluded,true);
  assert.equal(boundary.sourceSignature,source);
  assert.equal(JSON.stringify(project),source);
  const a=plain.rows.find(r=>r.rateMmHr===24).metrics.storedLiters;
  const b=boundary.rows.find(r=>r.rateMmHr===24).metrics.storedLiters;
  assert.deepEqual(b.deltas.slice(0,3),a.deltas);
  assert.deepEqual(a.signs,[1,1,1]);
  assert.deepEqual(b.signs,[1,1,1,-1]);
  assert.equal(a.opposed,false);assert.equal(b.opposed,true);
  approx(b.deltas[2],0.15654808357862748);
  approx(b.deltas[3],-0.07644923525640479);
  assert.ok(boundary.cellSteps>plain.cellSteps);
  assert.notEqual(source,original);
});

test('small maximum-depth reversal at final boundary remains source-reproducible',()=>{
  const project=makeExample();
  project.proposal=structuredClone(project.existing);
  project.proposal[8].elevationM-=0.05;
  const report=compareStormResolution(project,[24,60],{includeMinimumStep:true});
  const a=report.rows.find(r=>r.rateMmHr===60).metrics.maxDepthMm;
  assert.deepEqual(a.signs,[1,1,1,-1]);
  approx(a.deltas[2],0.022553491790077373);
  approx(a.deltas[3],-0.0003178614131655877);
  const weather={...project.weather,stepMinutes:1,rainMmHr:60};
  const old=runRain(project.existing,project.width,project.height,weather);
  const next=runRain(project.proposal,project.width,project.height,weather);
  approx(a.deltas[3],next.maxDepthMm-old.maxDepthMm);
});

test('identical paired sites remain without false conflict at minimum',()=>{
  const project=makeExample();project.proposal=structuredClone(project.existing);
  const report=compareStormResolution(project,[6,36],{includeMinimumStep:true});
  assert.equal(report.sameTestedDirections,true);
  assert.deepEqual(report.issues,[]);
  for(const row of report.rows)for(const [key] of STORM_INTENSITY_METRICS){
    assert.deepEqual(row.metrics[key].signs,[0,0,0,0]);
  }
});

test('minimum step is not duplicated or invented when already reached',()=>{
  for(const stepMinutes of [2,4]){
    const project=makeExample();project.weather.stepMinutes=stepMinutes;
    assert.equal(prepareStormResolution(project,[6,36]).stepsMinutes.at(-1),1);
    assert.throws(()=>prepareStormResolution(project,[6,36],{includeMinimumStep:true}),/already includes/);
  }
  const project=makeExample();project.weather.stepMinutes=1.9;
  assert.throws(()=>prepareStormResolution(project,[6,36],{includeMinimumStep:true}),/minimum supported/);
});

test('extra full-step work is bounded jointly before solver execution',()=>{
  const project=makeExample();
  project.width=16;project.height=16;project.selectedIndex=0;
  project.existing=Array.from({length:256},()=>({elevationM:0,surface:'turf',provenance:'authored'}));
  project.proposal=structuredClone(project.existing);
  project.weather={...project.weather,stepMinutes:5,durationMinutes:200};
  validateProject(project);
  const rates=[6,24,60,120];
  const regular=prepareStormResolution(project,rates);
  assert.ok(regular.cellSteps<900_000);
  assert.throws(()=>prepareStormResolution(project,rates,{includeMinimumStep:true}),/joint 900,000 cell-step/);
});

test('option input and source-invalidating assumptions are not silently accepted',()=>{
  const p=makeExample();
  for(const invalid of [null,[],{includeMinimumStep:'true'},{includeMinimumStep:1}]){
    assert.throws(()=>prepareStormResolution(p,[12,36],invalid),/Resolution options/);
  }
  p.weather.rainTimeline=[{minute:0,rainMmHr:24}];
  assert.throws(()=>compareStormResolution(p,[12,36],{includeMinimumStep:true}),/constant-intensity storms only/);
});
