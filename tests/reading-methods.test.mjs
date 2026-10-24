import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {makeExample} from '../core.js';
import {compareInfiltration} from '../infiltration-study.js';
import {runSubstepped} from '../evaluation/rain-integrator.js';
import {compareReadingMethods,MAX_READING_METHOD_CELL_STEPS} from '../evaluation/reading-methods.js';
const fixture=()=>JSON.parse(readFileSync(new URL('../evaluation/fixtures/method-readings.json',import.meta.url),'utf8'));
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,a+' != '+b);

test('saved fixed-source reading roles and calibrated incumbent order match maintained reader',()=>{
 const p=fixture(),source=structuredClone(p);
 const actual=compareReadingMethods(p),native=compareInfiltration(p,p.infiltrationStudy);
 assert.equal(actual.status,'compared');
 assert.deepEqual(actual.incumbent.orderedRatesMmHr,native.candidates.map(c=>c.rateMmHr));
 assert.deepEqual(actual.incumbent.compatibleRatesMmHr,native.compatibleRatesMmHr);
 assert.deepEqual(actual.incumbent.survivingRatesMmHr,native.survivingRatesMmHr);
 assert.deepEqual(actual.incumbent.closestCalibrationRatesMmHr,native.closestCalibrationRatesMmHr);
 for(const c of native.candidates){
   const x=actual.incumbent.candidates.find(a=>a.rateMmHr===c.rateMmHr);
   assert.deepEqual(x.calibration.errors.map(a=>a.residualMm),c.calibration.errors.map(a=>a.residualMm));
   assert.deepEqual(x.challenge.errors.map(a=>a.withinBand),c.challenge.errors.map(a=>a.withinBand));
 }
 assert.equal(actual.counts.ignored,1);
 assert.deepEqual(actual.readings.map(e=>e.reading),p.observations);
 assert.deepEqual(p,source);
});

test('real authored changed-step source exposes method-dependent reading acceptances without reselecting rates',()=>{
 const p=fixture(),r=compareReadingMethods(p);
 assert.deepEqual(r.study.ratesMmHr,[1,9,24]);
 const c=r.comparison.find(c=>c.rateMmHr===24);
 const first=c.witnesses.find(w=>w.index===0);
 assert.equal(first.source,p.observations[0].source);
 assert.equal(first.role,'calibration');
 assert.equal(first.incumbentWithinBand,true);
 assert.equal(first.alternativeWithinBand,false);
 assert.equal(first.changedBand,true);
 assert.ok(Math.abs(first.signedPredictionDifferenceMm)>1);
 assert.equal(r.incumbent.candidates.find(c=>c.rateMmHr===24).calibration.compatible,true);
 assert.equal(r.alternative.candidates.find(c=>c.rateMmHr===24).calibration.compatible,false);
 assert.ok(r.comparison.every(c=>c.witnesses.every(w=>w.source===p.observations[w.index].source)));
 for(const method of ['incumbent','alternative'])for(const candidate of r[method].candidates)
   close(candidate.balanceErrorLiters,0,1e-8);
});

test('negative control no rain, identical method readings and no reinterpreted records',()=>{
 const p=fixture();p.weather.rainMmHr=0;
 const r=compareReadingMethods(p);
 for(const c of r.comparison)for(const w of c.witnesses){
   close(w.signedPredictionDifferenceMm,0);
   assert.equal(w.changedBand,false);
 }
 assert.equal(r.incumbent.status,r.alternative.status);
});

test('changed observations affect only interpretations; candidate population and original source preserved',()=>{
 const p=fixture(),r=compareReadingMethods(p);
 p.observations[0].depthMm+=3;
 const altered=compareReadingMethods(p);
 assert.deepEqual(r.study,altered.study);
 assert.equal(altered.readings[0].reading.depthMm,r.readings[0].reading.depthMm+3);
 const sample=altered.comparison.find(c=>c.rateMmHr===24).witnesses[0];
 close(sample.signedPredictionDifferenceMm,r.comparison.find(c=>c.rateMmHr===24).witnesses[0].signedPredictionDifferenceMm);
 assert.equal(sample.source,r.comparison.find(c=>c.rateMmHr===24).witnesses[0].source);
 assert.equal(sample.incumbentWithinBand,false);
});

test('substep captured true outer snapshots are read-only optional, with unchanged default behavior',()=>{
 const p=fixture(),args=[p.existing,p.width,p.height,p.weather];
 const defaultRun=runSubstepped(...args,{substeps:2,surface:'turf',rateMmHr:24});
 const captured=runSubstepped(...args,{substeps:2,surface:'turf',rateMmHr:24,captureDepths:true});
 assert.equal(defaultRun.snapshots[0].depthsMm,undefined);
 assert.equal(captured.snapshots[0].depthsMm.length,p.existing.length);
 assert.ok(captured.snapshots.every(s=>s.depthsMm.length===p.existing.length));
 for(const k of ['storedLiters','exitLiters','absorbedLiters','maxDepthMm','rainLiters'])
   assert.equal(defaultRun[k],captured[k]);
 assert.throws(()=>runSubstepped(...args,{captureDepths:'yes'}),/boolean/);
});

test('refuse before simulation when evidence missing or declared work exceeds bounded budget',()=>{
 const p=fixture();
 p.observations=p.observations.filter(r=>r.use!=='calibration');
 assert.equal(compareReadingMethods(p).status,'need-calibration');
 p.observations=fixture().observations;
 p.infiltrationStudy.surface='turf';p.existing=p.existing.map(c=>({...c,surface:'sealed'}));
 assert.equal(compareReadingMethods(p).status,'surface-absent');
 const large=makeExample();
 large.width=large.height=24;large.selectedIndex=0;
 large.existing=Array.from({length:576},()=>({...large.existing[0]}));
 large.proposal=structuredClone(large.existing);
 large.weather.durationMinutes=720;large.weather.stormMinutes=720;large.weather.stepMinutes=1;
 large.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[1,2,3,4,5,6,7,8,9]};
 large.observations=[{cellIndex:0,minute:1,depthMm:0,uncertaintyMm:1,scenario:'existing',use:'calibration',source:'authored budget test'}];
 const refused=compareReadingMethods(large);
 assert.equal(refused.status,'work-limit');assert.ok(refused.estimatedCellSteps>MAX_READING_METHOD_CELL_STEPS);
 assert.throws(()=>compareReadingMethods(fixture(),undefined,{substeps:1}),/substep/);
});

test('real exported original-file CLI receives exact source hash and refuses forged source',()=>{
 const dir=mkdtempSync(join(tmpdir(),'rain-reading-'));
 try{
   const p=fixture(),input=join(dir,'readings.json'),source=JSON.stringify(p);
   writeFileSync(input,source);
   const run=spawnSync(process.execPath,['evaluation/reading-methods.mjs',input],
    {cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:20000});
   assert.equal(run.status,0,run.stderr);
   const receipt=JSON.parse(run.stdout);
   assert.equal(receipt.result.status,'compared');
   assert.equal(receipt.input.sha256,createHash('sha256').update(source).digest('hex'));
   assert.equal(readFileSync(input,'utf8'),source);
   const bad=join(dir,'invalid.json');
   writeFileSync(bad,JSON.stringify({...p,schema:'forged'}));
   const rejected=spawnSync(process.execPath,['evaluation/reading-methods.mjs',bad],
    {cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:20000});
   assert.equal(rejected.status,1);assert.match(rejected.stderr,/refused/i);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
