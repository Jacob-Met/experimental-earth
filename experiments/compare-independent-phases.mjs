import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fitReceivingAccountBands} from '../receiving-account-band-fit.js';
import {fitReceivingAccountPhases} from '../receiving-account-phase-fit.js';
import {evaluateReadings} from '../infiltration-study.js';
import {evaluateReceivingAccountRows,receivingAccountVerdict} from '../receiving-account-evidence.js';
import {phaseIndependentCourses,phaseIndependentTupleSha256} from '../tests/receiving-phase-independent-fixtures.mjs';

const freeze=JSON.parse(readFileSync(process.env.RECEIVING_PHASE_METHOD_FREEZE??new URL('./phase-independent-method-freeze.json',import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(phaseIndependentTupleSha256,freeze.independentTuplesSha256);
for(const [path,expected]of Object.entries(freeze.sourceHashes))assert.equal(sha(readFileSync(new URL('../'+path,import.meta.url))),expected,path);
const receipt={schema:freeze.evidenceStatus==='consumed-replay'?'experimental-earth-consumed-phase-comparison/1':'experimental-earth-independent-phase-comparison/1',freeze,startedAtUtc:new Date().toISOString(),summary:{total:0,eligible:0,baselineCalibration:0,phaseCalibration:0,baselineHeld:0,phaseHeld:0,baselineRefused:0,phaseRefused:0},excluded:[],records:[],
  limitations:freeze.evidenceStatus==='consumed-replay'?'Previously consumed16 inputs replayed after an explicit numerical method correction. This is regression/development evidence, not a new independent qualification. The original v1 first result and browser failure remain preserved. Any-held-support counts belong to a finite growing candidate family, not a selected predictor. Capacity alternatives are not identified values. All failures remain.':'Separately authored inputs received after method freeze, not physical field validation or external blind experimentation. Any-held-support counts belong to a finite growing candidate family, not a selected predictor. Capacity alternatives are not identified values. All failures remain.'};
const path=process.env.RECEIVING_PHASE_COMPARISON??new URL('./independent-phase-comparison.json',import.meta.url),save=()=>writeFileSync(path,JSON.stringify(receipt,null,2)+'\n');save();
const all=phaseIndependentCourses();receipt.summary.total=all.length;receipt.summary.eligible=all.filter(c=>c.eligible).length;receipt.excluded=all.filter(c=>!c.eligible).map(c=>({id:c.id,reasons:c.reasons}));
function compact(r){return {status:r.status,compatibleIds:r.compatibleIds,survivingIds:r.survivingIds,counts:r.counts,reservation:r.reservation,question:r.question,
  candidates:r.candidates.map(row=>({hypothesis:row.hypothesis,phaseOrigins:row.phaseOrigins,calibration:row.calibration,challenge:row.challenge,surfaceCalibration:row.surfaceCalibration,surfaceChallenge:row.surfaceChallenge,accountReadings:row.accountReadings}))};}
for(const c of all.filter(c=>c.eligible)){
  const before=JSON.stringify({project:c.project,selection:c.selection,account:c.account}),originals=c.project.observations.map((reading,index)=>({reading,index})),rows=evaluateReceivingAccountRows(c.result,c.account.readings);
  const truth=Object.fromEntries(['calibration','challenge'].map(use=>[use,receivingAccountVerdict(evaluateReadings(c.result,originals.filter(row=>row.reading.use===use)),rows.filter(row=>row.use===use))]));
  assert.equal(truth.calibration.compatible,true);assert.equal(truth.challenge.compatible,true);
  const record={id:c.id,source:JSON.parse(before),knownModel:c.truth,truth,originalReportedPhase:c.originalReportedPhase,truthSnapshotPhase:c.truthSnapshotPhase,maximumDuringStormMm:c.maximumDuringStormMm,maximumDuringCourseMm:c.maximumDuringCourseMm};
  for(const [name,fn]of [['baseline',fitReceivingAccountBands],['phase',fitReceivingAccountPhases]]){
    const started=performance.now();try{const r=fn(c.project,c.selection,c.account);record[name]={...compact(r),milliseconds:performance.now()-started};if(r.compatibleIds.length)receipt.summary[name+'Calibration']++;if(r.survivingIds.length)receipt.summary[name+'Held']++;}
    catch(error){record[name]={status:'refused',error:String(error.message||error),milliseconds:performance.now()-started};receipt.summary[name+'Refused']++;}
  }
  assert.equal(JSON.stringify({project:c.project,selection:c.selection,account:c.account}),before);
  if(record.baseline.compatibleIds&&record.phase.compatibleIds)for(const id of record.baseline.compatibleIds)assert.ok(record.phase.compatibleIds.includes(id));
  receipt.records.push(record);save();console.log(JSON.stringify({id:c.id,phase:c.truthSnapshotPhase,baseline:record.baseline.compatibleIds?.length??'refused',current:record.phase.compatibleIds?.length??'refused',held:record.phase.survivingIds?.length??'refused',ms:Math.round(record.phase.milliseconds)}));
}
receipt.completedAtUtc=new Date().toISOString();save();console.log(JSON.stringify(receipt.summary));
