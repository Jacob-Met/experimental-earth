import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {originalCourse} from '../tests/receiving-inverse-fixtures.mjs';
import {proposeReceivingAccountLayers} from '../receiving-account-proposals.js';
import {runRain} from '../core.js';
import {hypothesisLayer} from '../draining-layer-evidence.js';
import {evaluateReadings} from '../infiltration-study.js';
import {evaluateReceivingAccountRows,receivingAccountVerdict} from '../receiving-account-evidence.js';

export function noisyCourses(){
  const cases=[];let index=0;
  for(const R of [13,32,43])for(const C of [5.9,15.7,26.3])for(const k of [.19,.53,.82])for(const fraction of [0,.28,.61,1])for(const T of [45,85]){
    const c=originalCourse({rainMmHr:R,capacityMm:C,initialStoredMm:C*fraction,drainagePerHour:k,stormMinutes:T});
    const full=Math.abs(c.receiver(T).retainedLiters/c.areaM2-C)<1e-8*Math.max(1,C);
    const eligible=c.surface(T)>0&&full&&c.surface(410)===0;
    const tupleIndex=index++;if(!eligible){cases.push({tupleIndex,eligible:false,truth:c.truth,weather:c.project.weather});continue;}
    for(const pattern of [0,1]){
      const {project,selection,account}=structuredClone({project:c.project,selection:c.selection,account:c.account});
      project.observations=[c.surfaceRow(T),c.surfaceRow(410),c.surfaceRow(705,'challenge')];
      for(let i=0;i<project.observations.length;i++){
        const row=project.observations[i];row.uncertaintyMm=.002;
        if(row.use==='calibration')row.depthMm+=row.depthMm===0?.0008:.0016*Math.sin((tupleIndex+1)*1.731+(pattern+1)*2.117);
      }
      account.readings=[410,505,685].map((t,i)=>({...c.receiverRow(t,'drained'),uncertaintyLiters:.02,
        valueLiters:c.receiverRow(t,'drained').valueLiters+.016*Math.sin((tupleIndex+1)*1.217+(i+1)*2.931+(pattern+1)*1.477)}));
      account.readings.push({...c.receiverRow(590,'retained','challenge'),uncertaintyLiters:.02});
      cases.push({tupleIndex,pattern,eligible:true,truth:c.truth,weather:c.project.weather,project,selection,account});
    }
  }
  return cases;
}
export function evaluateCases(producer){
  const cases=noisyCourses(),records=[];let calibrationSupported=0,surviving=0,truthCalibrationCompatible=0,truthChallengeCompatible=0;
  for(const c of cases){
    if(!c.eligible)continue;
    const truthRun=runRain(c.project[c.selection.target],c.project.width,c.project.height,c.project.weather,{drainingLayer:hypothesisLayer(c.selection,c.truth)});
    const originalSurface=c.project.observations.map((reading,index)=>({reading,index})).filter(row=>row.reading.scenario===c.selection.target);
    const truthRows=evaluateReceivingAccountRows(truthRun,c.account.readings);
    const truthCalibration=receivingAccountVerdict(evaluateReadings(truthRun,originalSurface.filter(row=>row.reading.use==='calibration')),truthRows.filter(row=>row.use==='calibration'));
    const truthChallenge=receivingAccountVerdict(evaluateReadings(truthRun,originalSurface.filter(row=>row.reading.use==='challenge')),truthRows.filter(row=>row.use==='challenge'));
    if(truthCalibration.compatible===true)truthCalibrationCompatible++;
    if(truthChallenge.compatible===true)truthChallengeCompatible++;
    if(truthCalibration.compatible!==true||truthChallenge.compatible!==true)throw Error('The authored truth does not pass every original band for tuple '+c.tupleIndex+' pattern '+c.pattern);
    const report=producer(c.project,c.selection,c.account);
    const calibration=report.candidates.filter(row=>row.calibration.compatible===true);
    const passed=calibration.filter(row=>row.challenge.compatible===true);
    if(calibration.length)calibrationSupported++;if(passed.length)surviving++;
    records.push({tupleIndex:c.tupleIndex,pattern:c.pattern,truth:c.truth,weather:c.weather,truthCalibration,truthChallenge,status:report.status,calibrationWitnesses:calibration.length,survivingWitnesses:passed.length,
      candidates:report.candidates.map(row=>({parameters:row.hypothesis,calibration:row.calibration.compatible,challenge:row.challenge.compatible})),refused:report.refusedTrials.map(row=>({branch:row.branch,reason:row.reason})),...(!passed.length&&records.filter(r=>r.originals).length<3?{originals:{project:c.project,selection:c.selection,account:c.account}}:{})});
  }
  return {totalParameterTuples:216,eligibleParameterTuples:records.length/2,excludedParameterTuples:cases.filter(c=>!c.eligible).length,perturbedOriginalCourses:records.length,truthCalibrationCompatible,truthChallengeCompatible,calibrationSupported,surviving,records};
}
if(import.meta.url===new URL(process.argv[1],'file:').href){
  const result=evaluateCases(proposeReceivingAccountLayers);
  result.schema='experimental-earth-original-band-coverage/1';result.method='Qualified calibration-center and explicit-boundary producer';
  result.limit='Authored independent parameter grid and deterministic perturbations inside declared original bands; not field evidence, stochastic coverage or a parameter uncertainty enclosure.';
  result.sourceHashes={};for(const path of ['receiving-account-proposals.js','receiving-account-inverse.js','post-dry-receiving-inverse.js','draining-infiltration.js','core.js','tests/receiving-inverse-fixtures.mjs','experiments/noisy-original-bands.mjs'])result.sourceHashes[path]=createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex');
  const file=new URL('./noisy-baseline.json',import.meta.url);writeFileSync(file,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({path:file.pathname,...Object.fromEntries(['totalParameterTuples','eligibleParameterTuples','excludedParameterTuples','perturbedOriginalCourses','calibrationSupported','surviving'].map(key=>[key,result[key]]))}));
}

