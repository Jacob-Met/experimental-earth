import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain, validateProject } from '../core.js';
import { STORM_INTENSITY_METRICS } from '../storm-intensity.js';
import { compareStormResolution, prepareStormResolution } from '../storm-resolution.js';

const approx = (actual,expected,tolerance=1e-7) =>
  assert.ok(Math.abs(actual-expected) <= tolerance,`${actual} != ${expected}`);

test('actual authored grade change reverses peak-storage direction between supported steps',()=>{
  const project=makeExample();
  project.proposal=structuredClone(project.existing);
  project.proposal[1].elevationM-=0.025;
  const original=JSON.stringify(project);
  const report=compareStormResolution(project,[6,24,60,120]);
  assert.deepEqual(report.stepsMinutes,[5,2.5,1.25]);
  assert.deepEqual(report.ratesMmHr,[6,24,60,120]);
  const row=report.rows.find(row=>row.rateMmHr===24);
  assert.equal(row.metrics.peakPondingLiters.signs[0],1);
  assert.equal(row.metrics.peakPondingLiters.signs[2],-1);
  assert.equal(row.metrics.peakPondingLiters.opposed,true);
  approx(row.metrics.peakPondingLiters.deltas[0],0.36106789355653746,1e-6);
  approx(row.metrics.peakPondingLiters.deltas[2],-0.4791022007243555,1e-6);
  assert.ok(report.issues.some(issue=>issue.rateMmHr===24&&issue.metric==='peakPondingLiters'));
  assert.equal(JSON.stringify(project),original);
});

test('all step-specific differences are independently reproducible from original solver',()=>{
  const project=makeExample();
  const report=compareStormResolution(project,[12,36,72]);
  for(let s=0;s<report.stepsMinutes.length;s++){
    const stepMinutes=report.stepsMinutes[s];
    for(const row of report.rows){
      const weather={...project.weather,stepMinutes,rainMmHr:row.rateMmHr};
      const a=runRain(project.existing,project.width,project.height,weather);
      const b=runRain(project.proposal,project.width,project.height,weather);
      approx(a.rainLiters,b.rainLiters);
      for(const [key] of STORM_INTENSITY_METRICS){
        approx(row.metrics[key].deltas[s],b[key]-a[key]);
      }
    }
  }
});

test('identical source and proposal never acquire a fake numerical conflict',()=>{
  const project=makeExample();
  project.proposal=structuredClone(project.existing);
  const result=compareStormResolution(project,[0,24,36]);
  assert.equal(result.sameTestedDirections,true);
  assert.deepEqual(result.issues,[]);
  for(const row of result.rows) for(const [key] of STORM_INTENSITY_METRICS){
    assert.deepEqual(row.metrics[key].signs,[0,0,0]);
    assert.equal(row.metrics[key].opposed,false);
  }
});

test('one finer interval is admitted without claiming an untested third',()=>{
  const project=makeExample();project.weather.stepMinutes=2;
  const report=compareStormResolution(project,[12,36]);
  assert.deepEqual(report.stepsMinutes,[2,1]);
  assert.ok(report.rows.every(row=>Object.values(row.metrics).every(m=>m.deltas.length===2)));
});

test('at or too near lower step boundary refuses rather than fabricates refinement',()=>{
  for(const base of [1,1.1,1.9]){
    const project=makeExample();project.weather.stepMinutes=base;
    assert.throws(()=>prepareStormResolution(project,[12,36]),/minimum supported/);
  }
});

test('joint work budget refuses expensive refinement before any model run',()=>{
  const project=makeExample();
  project.width=24;project.height=24;project.selectedIndex=0;
  project.existing=Array.from({length:576},()=>({elevationM:0,surface:'turf',provenance:'authored'}));
  project.proposal=structuredClone(project.existing);
  project.weather={...project.weather,stepMinutes:5,durationMinutes:720};
  validateProject(project);
  assert.throws(()=>prepareStormResolution(project,[0,12,24,36,60,120,240]),/budget/);
});

test('invalid input and future timelines are refused by maintained validation',()=>{
  const p=makeExample();
  for(const bad of [[36], [36,36], [0,-3], [12,Infinity], ['36',72]]){
    assert.throws(()=>compareStormResolution(p,bad));
  }
  p.weather.rainTimeline=[{minute:0,rainMmHr:22}];
  assert.throws(()=>compareStormResolution(p,[12,36]),/constant-intensity storms only/);
});

test('changed source invalidates source signature; retained observation stays untouched',()=>{
  const p=makeExample();
  p.observations.push({cellIndex:4,minute:30,depthMm:1,uncertaintyMm:1,
    source:'authored same-event gauge',scenario:'existing',use:'challenge'});
  const old=JSON.stringify(p);
  const first=compareStormResolution(p,[12,36]);
  assert.equal(JSON.stringify(p),old);
  p.weather.mobilityPerHour=0.12;
  const second=compareStormResolution(p,[12,36]);
  assert.notEqual(first.sourceSignature,second.sourceSignature);
  assert.equal(p.observations[0].source,'authored same-event gauge');
});
