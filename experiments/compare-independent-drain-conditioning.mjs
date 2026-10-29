import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fitReceivingAccountBands} from '../receiving-account-band-fit.js';
import {fitReceivingAccountPhases} from '../receiving-account-phase-fit.js';
import {evaluateReceivingAccountRows,receivingAccountVerdict} from '../receiving-account-evidence.js';
import {evaluateReadings} from '../infiltration-study.js';
import {drainIndependentCourses,drainIndependentTupleSha256} from '../tests/receiving-drain-independent-fixtures.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex'),root=new URL('../',import.meta.url),freeze=JSON.parse(readFileSync(new URL('./drain-independent-method-freeze.json',import.meta.url)));
assert.equal(drainIndependentTupleSha256,freeze.independentTuplesSha256);for(const [p,hash]of Object.entries(freeze.sourceHashes))assert.equal(sha(readFileSync(new URL(p,root))),hash,p);
const oldInverse=readFileSync(new URL('./pre-drain-phase-baseline/post-dry-receiving-inverse.js.txt',import.meta.url),'utf8'),oldPhase=readFileSync(new URL('./pre-drain-phase-baseline/receiving-account-phase-fit.js.txt',import.meta.url),'utf8');
assert.equal(sha(oldInverse),'5e3ccbc55aecd55e727bfe6b3b5444c3891efde1e671d0a0cb0134c2b7f5f504');assert.equal(sha(oldPhase),'dea344ede1243a7b268422e7c9be5def6cf289a3af37408cdf17fadeb61e865c');
const inverseUrl='data:text/javascript;base64,'+Buffer.from(oldInverse).toString('base64');
const relocated=oldPhase.replace(/from '(\.[^']+)';/g,(_,p)=>"from '"+(p==='./post-dry-receiving-inverse.js'?inverseUrl:new URL(p,root).href)+"';");
const baseline=await import('data:text/javascript;base64,'+Buffer.from(relocated).toString('base64'));
const receipt={schema:'experimental-earth-independent-drain-conditioning/1',freeze,startedUtc:new Date().toISOString(),baseline:{originalInverseSha256:sha(oldInverse),originalPhaseSha256:sha(oldPhase),relocation:'Exact predecessor sources loaded as modules; only import URLs relocated. All other maintained numerical dependencies match the frozen hashes.'},summary:{total:0,eligible:0,bandCalibration:0,bandHeld:0,oldPhaseCalibration:0,oldPhaseHeld:0,newPhaseCalibration:0,newPhaseHeld:0},excluded:[],records:[],meaning:'First fixed-method run on separately authored unreleased inputs after numerical freeze. No physical field, external-blind, selected-predictor, continuous-enclosure or parameter-identification claim.'};
const path=new URL('./independent-drain-comparison.json',import.meta.url),save=()=>writeFileSync(path,JSON.stringify(receipt,null,2)+'\n');save();
const courses=drainIndependentCourses();receipt.summary.total=courses.length;receipt.summary.eligible=courses.filter(c=>c.eligible).length;receipt.excluded=courses.filter(c=>!c.eligible).map(c=>({id:c.id,reasons:c.reasons,originals:{project:c.project,selection:c.selection,account:c.account},truth:c.truth}));save();
for(const c of courses.filter(c=>c.eligible)){
  const source=structuredClone({project:c.project,selection:c.selection,account:c.account}),originals=c.project.observations.map((reading,index)=>({reading,index})),rows=evaluateReceivingAccountRows(c.result,c.account.readings),truth={};
  for(const role of ['calibration','challenge']){truth[role]=receivingAccountVerdict(evaluateReadings(c.result,originals.filter(x=>x.reading.use===role)),rows.filter(x=>x.use===role));assert.equal(truth[role].compatible,true);}
  const record={id:c.id,source,truth,knownModel:c.truth,originalReportedPhase:c.originalReportedPhase,actualSnapshotPhase:c.truthSnapshotPhase};
  for(const [name,fn]of [['band',fitReceivingAccountBands],['oldPhase',baseline.fitReceivingAccountPhases],['newPhase',fitReceivingAccountPhases]]){
    const start=performance.now();try{const r=fn(c.project,c.selection,c.account);record[name]={status:r.status,compatibleIds:r.compatibleIds,survivingIds:r.survivingIds,counts:r.counts,reservation:r.reservation,candidates:r.candidates,unfilled:r.unfilled,milliseconds:performance.now()-start};receipt.summary[name+'Calibration']+=!!r.compatibleIds.length;receipt.summary[name+'Held']+=!!r.survivingIds.length;}
    catch(error){record[name]={status:'refused',error:String(error.message||error),milliseconds:performance.now()-start};}
  }
  assert.deepEqual({project:c.project,selection:c.selection,account:c.account},source);receipt.records.push(record);save();console.log(JSON.stringify({id:c.id,old:record.oldPhase.compatibleIds?.length??'refused',current:record.newPhase.compatibleIds?.length??'refused',oldHeld:record.oldPhase.survivingIds?.length??'refused',currentHeld:record.newPhase.survivingIds?.length??'refused'}));
}
receipt.completedUtc=new Date().toISOString();save();console.log(JSON.stringify(receipt.summary));
