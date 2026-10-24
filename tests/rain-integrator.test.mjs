import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import { makeExample, runRain } from '../core.js';
import { withInternalBarrier, withInternalCrest } from '../internal-barriers.js';
import { runSubstepped,compareNumericalMethods,MAX_METHOD_CELL_STEPS } from '../evaluation/rain-integrator.js';
const keys=['rainLiters','absorbedLiters','exitLiters','storedLiters','peakPondingLiters','maxDepthMm'];
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);

test('single-substep copy is identical to maintained solver for the fixed-rate envelope, including crests/walls',()=>{
  let p=makeExample();
  p=withInternalBarrier(p,'existing',0,'east',true,'authored model wall');
  p=withInternalCrest(p,'existing',1,'south',.09,'authored control crest');
  p=withInternalBarrier(p,'proposal',2,'south',true,'hypothetical changed passage');
  Object.assign(p.weather,{durationMinutes:75,stormMinutes:19,rainMmHr:67,stepMinutes:5,
    mobilityPerHour:2.79,boundaryExitPerHour:1.91});
  for(const target of ['existing','proposal']){
    const b=runRain(p[target],p.width,p.height,p.weather,
      {surfaceInfiltrationOverride:{surface:'turf',rateMmHr:9}});
    const c=runSubstepped(p[target],p.width,p.height,p.weather,
      {substeps:1,surface:'turf',rateMmHr:9});
    for(const k of keys) close(b[k],c[k],1e-9);
    assert.deepEqual(b.finalDepthMm,c.finalDepthMm);
    assert.deepEqual(b.peakDepthMm,c.peakDepthMm);
    close(c.massErrorLiters,0,1e-8);
  }
});

test('half-step method accounts for exactly the same rainfall, conserves water and remains positive',()=>{
  const p=makeExample();Object.assign(p.weather,{durationMinutes:60,stormMinutes:18.3,
    rainMmHr:136,stepMinutes:2.5,mobilityPerHour:7,boundaryExitPerHour:8});
  const source=structuredClone(p);
  for(const substeps of [2,4,8]){
    const r=runSubstepped(p.existing,p.width,p.height,p.weather,{substeps,surface:'turf',rateMmHr:3});
    close(r.rainLiters,136*18.3/60*p.weather.cellSizeM**2*p.existing.length,1e-7);
    close(r.massErrorLiters,0,1e-7);
    assert.ok(r.finalDepthMm.every(d=>Number.isFinite(d)&&d>=0));
    assert.ok(r.peakDepthMm.every(d=>Number.isFinite(d)&&d>=0));
    assert.ok(Number.isFinite(r.internalPeakStorageLiters));
  }
  assert.deepEqual(p,source);
});

test('full paired benchmark reports improved and adverse reference deviations, with all cases and costs',()=>{
  const p=makeExample();Object.assign(p.weather,{rainMmHr:67,stormMinutes:19,
    durationMinutes:75,mobilityPerHour:2.79,boundaryExitPerHour:1.91});
  const source=structuredClone(p);
  const r=compareNumericalMethods(p,{ratesMmHr:[3,9,24]});
  assert.equal(r.status,'compared');assert.ok(r.estimatedCellSteps<MAX_METHOD_CELL_STEPS);
  assert.deepEqual(r.ratesMmHr,[3,9,24]);assert.deepEqual(r.stepsMinutes,[5,2.5,1.25,1]);
  assert.equal(r.cases.length,3);
  assert.ok(r.cases.some(c=>c.referenceAgreementCounts.worse>0),'retain counterexamples');
  assert.ok(r.cases.some(c=>c.referenceAgreementCounts.closer>0),'retain improvements');
  for(const c of r.cases){
    assert.equal(c.runs.length,4);
    for(const step of c.runs)for(const method of ['incumbent','alternative']){
      const v=step[method];
      assert.ok(v.maxMassErrorLiters<1e-7);
      assert.ok(v.minDepthMm>=-1e-9,`negative raw depth ${v.minDepthMm}`);
      assert.ok(v.actualCellSteps>0&&v.runtimeMs>=0);
      for(const key of keys.slice(2))assert.ok(Number.isFinite(v.deltas[key]));
    }
  }
  assert.deepEqual(p,source);
});

test('negative controls and changed-input pairs distinguish actual sensitivity from an invented effect',()=>{
  const p=makeExample();p.proposal=structuredClone(p.existing);
  let r=compareNumericalMethods(p,{ratesMmHr:[9],stepsMinutes:[5,1]});
  for(const c of r.cases)for(const row of c.runs)
    for(const method of ['incumbent','alternative'])
      for(const x of Object.values(row[method].deltas)) close(x,0);
  p.proposal[27].surface='garden';
  r=compareNumericalMethods(p,{ratesMmHr:[9],stepsMinutes:[5,1]});
  assert.ok(r.cases[0].runs.some(row=>Math.abs(row.incumbent.deltas.absorbedLiters)>1e-5 ||
      Math.abs(row.incumbent.deltas.exitLiters)>1e-5));
  p.weather.rainMmHr=0;
  r=compareNumericalMethods(p,{ratesMmHr:[9],stepsMinutes:[5,1]});
  for(const row of r.cases[0].runs)for(const method of ['incumbent','alternative'])
    for(const x of Object.values(row[method].deltas)) close(x,0);
});

test('rejects malformed methods and refuses excessive workloads before simulation',()=>{
  const p=makeExample();
  assert.throws(()=>runSubstepped(p.existing,p.width,p.height,p.weather,{substeps:0}),/Substeps/);
  assert.throws(()=>runSubstepped(p.existing,p.width,p.height,p.weather,{substeps:2,rateMmHr:9}),/surface/);
  assert.throws(()=>compareNumericalMethods(p,{stepsMinutes:[5,5]}),/Invalid/);
  assert.throws(()=>compareNumericalMethods(p,{ratesMmHr:[-1]}),/Invalid/);
  assert.throws(()=>compareNumericalMethods(p,{substeps:1}),/Invalid/);
  p.width=p.height=24;p.existing=Array.from({length:576},()=>({...p.existing[0]}));
  p.proposal=structuredClone(p.existing);p.selectedIndex=0;
  p.weather.durationMinutes=720;p.weather.stormMinutes=720;
  const r=compareNumericalMethods(p,{stepsMinutes:[5,2.5,1.25,1],ratesMmHr:[1,3,9,15,22,40,90]});
  assert.equal(r.status,'work-limit');assert.deepEqual(r.cases,[]);
  assert.ok(r.estimatedCellSteps>MAX_METHOD_CELL_STEPS);
});


test('real CLI consumer reopens original exported project without mutating source bytes',()=>{
  const dir=mkdtempSync(join(tmpdir(),'earth-method-'));
  try {
    const p=makeExample();p.weather.durationMinutes=60;
    const source=JSON.stringify(p),file=join(dir,'site.json');
    writeFileSync(file,source);
    const run=spawnSync(process.execPath,['evaluation/numerical-methods.mjs',file],
      {cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:30000});
    assert.equal(run.status,0,run.stderr);
    const report=JSON.parse(run.stdout);
    assert.equal(report.result.status,'compared');
    assert.equal(report.input.sha256,createHash('sha256').update(source).digest('hex'));
    assert.deepEqual(report.result.stepsMinutes,[5,2.5,1.25,1]);
    assert.equal(readFileSync(file,'utf8'),source);
    const bad=join(dir,'invalid.json');
    writeFileSync(bad,'{"not":"a project"}');
    const refused=spawnSync(process.execPath,['evaluation/numerical-methods.mjs',bad],
      {cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:30000});
    assert.equal(refused.status,1);
    assert.match(refused.stderr,/refused/i);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
