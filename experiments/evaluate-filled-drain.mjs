import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {proposeFilledDrainBandWitnesses} from './filled-drain-prototype.mjs';
import {runRain,SURFACES} from '../core.js';
import {hypothesisLayer} from '../draining-layer-evidence.js';
import {evaluateReadings} from '../infiltration-study.js';
import {evaluateReceivingAccountRows,receivingAccountVerdict} from '../receiving-account-evidence.js';
const baseline=JSON.parse(readFileSync(new URL('./independent-drain-comparison.json',import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const receipt={schema:'experimental-earth-filled-drain-development/1',recordedUtc:new Date().toISOString(),methodSha256:sha(readFileSync(new URL('./filled-drain-prototype.mjs',import.meta.url))),meaning:'First filled prototype on already consumed independently authored inputs, not fresh qualification; held values only challenge frozen proposals.',summary:{courses:0,oldCalibration:0,oldHeld:0,combinedCalibration:0,combinedHeld:0},records:[]};
writeFileSync(new URL('./filled-drain-first-method-freeze.json',import.meta.url),JSON.stringify({...receipt,records:undefined},null,2)+'\n');
for(const c of baseline.records){
 const original=structuredClone(c.source),{project,selection,account}=c.source,w=project.weather;
 const rows=project.observations.map((reading,index)=>({reading,index})),cal=rows.filter(r=>r.reading.use==='calibration'),held=rows.filter(r=>r.reading.use==='challenge');
 const storm=cal.find(r=>r.reading.minute===w.stormMinutes),start=performance.now();
 const input={rainMmHr:w.rainMmHr,infiltrationMmHr:SURFACES[selection.surface].infiltrationMmHr,stormMinutes:w.stormMinutes,stormEndDepthMm:storm.reading.depthMm,areaM2:project[selection.target].filter(c=>c.surface===selection.surface).length*w.cellSizeM*w.cellSizeM,
  readings:account.readings.filter(r=>r.channel==='retained'&&r.use==='calibration'),drainedReadings:account.readings.filter(r=>r.channel==='drained'&&r.use==='calibration')};
 const proposals=proposeFilledDrainBandWitnesses(input),results=[];
 for(const h of proposals.proposals){
  const result=runRain(project[selection.target],project.width,project.height,w,{drainingLayer:hypothesisLayer(selection,{...h,id:'filled-experimental',label:'Experimental filled model',source:'Original-calibration conditional prototype'})});
  const observed=evaluateReceivingAccountRows(result,account.readings);
  results.push({hypothesis:h,calibration:receivingAccountVerdict(evaluateReadings(result,cal),observed.filter(r=>r.use==='calibration')),challenge:receivingAccountVerdict(evaluateReadings(result,held),observed.filter(r=>r.use==='challenge')),originalAccountRows:observed});
 }
 assert.deepEqual(c.source,original);
 const compatible=results.filter(x=>x.calibration.compatible),surviving=compatible.filter(x=>x.challenge.compatible),oldCal=c.newPhase.compatibleIds.length>0,oldHeld=c.newPhase.survivingIds.length>0;
 const record={id:c.id,original,knownModelForEvaluationOnly:c.knownModel,old:{calibration:oldCal,held:oldHeld},prototype:proposals,results,milliseconds:performance.now()-start,combined:{calibration:oldCal||compatible.length>0,held:oldHeld||surviving.length>0}};
 receipt.records.push(record);receipt.summary.courses++;receipt.summary.oldCalibration+=oldCal;receipt.summary.oldHeld+=oldHeld;receipt.summary.combinedCalibration+=record.combined.calibration;receipt.summary.combinedHeld+=record.combined.held;
 console.log(JSON.stringify({id:c.id,old:[oldCal,oldHeld],new:[compatible.length,surviving.length],status:proposals.reason??proposals.status,counts:proposals.counts}));
}
receipt.completedUtc=new Date().toISOString();writeFileSync(new URL('./filled-drain-first-result.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt.summary));
