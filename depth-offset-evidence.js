import {validateProject} from './core.js';
import {compareInfiltration} from './infiltration-study.js';
import {validateStudy,DEFAULT_STUDY} from './study-contract.js';

export const DEPTH_OFFSET_KIND='experimental-earth/depth-offset/1';
export const DEPTH_OFFSET_WORK_LIMIT=1_000_000;
const identity=reading=>JSON.stringify(reading);
const context=(p,s)=>JSON.stringify({width:p.width,height:p.height,site:p[s.target],weather:p.weather,study:s});
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
function checkDomain(d){
 if(!d||!Number.isFinite(d.minimumMm)||!Number.isFinite(d.maximumMm)||d.minimumMm< -1000||d.maximumMm>1000||d.minimumMm>d.maximumMm)throw Error('Declare an ordered depth-offset range within -1000 to 1000 mm.');
 if(typeof d.association!=='string'||!d.association.trim()||d.association.length>500)throw Error('Explain why these original readings share one sensor zero (at most 500 characters).');
}
export function prepareDepthOffset(project,input,study=project.infiltrationStudy??DEFAULT_STUDY){
 validateProject(project);validateStudy(study);checkDomain(input);
 if(!dense(input.indices)||!input.indices.length||new Set(input.indices).size!==input.indices.length)throw Error('Select distinct original readings explicitly.');
 const references=input.indices.map(index=>{
  const reading=project.observations[index];
  if(!Number.isInteger(index)||!reading||reading.scenario!==study.target||!['calibration','challenge'].includes(reading.use))throw Error('Select assigned readings of the study scenario.');
  return {index,readingJson:identity(reading)};
 });
 return {kind:DEPTH_OFFSET_KIND,minimumMm:input.minimumMm,maximumMm:input.maximumMm,association:input.association.trim(),references,contextJson:context(project,study)};
}
function intersect(domain,constraints){
 let lower=domain[0],upper=domain[1];
 for(const c of constraints){lower=Math.max(lower,c.minimumMm);upper=Math.min(upper,c.maximumMm);}
 return lower<=upper?[lower,upper]:null;
}
/** reported depth = modeled depth + one shared offset, for the explicitly associated rows. */
export function compareDepthOffset(project,declaration,study=project.infiltrationStudy??DEFAULT_STUDY){
 validateProject(project);validateStudy(study);checkDomain(declaration);
 if(declaration.kind!==DEPTH_OFFSET_KIND||!dense(declaration.references)||!declaration.references.length||new Set(declaration.references.map(r=>r?.index)).size!==declaration.references.length)throw Error('Invalid original depth-offset association.');
 const empty={candidates:[],compatibleRatesMmHr:[],survivingRatesMmHr:[]};
 if(declaration.contextJson!==context(project,study))return {...empty,status:'context-changed'};
 const selected=[];
 for(const ref of declaration.references){
  const reading=project.observations[ref?.index];
  if(!Number.isInteger(ref?.index)||!reading||ref.readingJson!==identity(reading)||reading.scenario!==study.target||!['calibration','challenge'].includes(reading.use))return {...empty,status:'reading-changed'};
  selected.push({index:ref.index,reading});
 }
 const counts={calibration:selected.filter(x=>x.reading.use==='calibration').length,challenge:selected.filter(x=>x.reading.use==='challenge').length,excluded:project.observations.length-selected.length};
 const cellSteps=project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes)*study.ratesMmHr.length;
 if(cellSteps>DEPTH_OFFSET_WORK_LIMIT)return {...empty,status:'work-limit',counts,cellSteps};
 const original=compareInfiltration(project,study);
 if(original.status==='surface-absent')return {...empty,status:'surface-absent',counts,cellSteps};
 const domain=[declaration.minimumMm,declaration.maximumMm];
 const candidates=study.ratesMmHr.map(rateMmHr=>{
  const candidate=original.candidates.find(c=>c.rateMmHr===rateMmHr);
  const predictions=new Map([...candidate.calibration.errors,...candidate.challenge.errors].map(e=>[e.index,e]));
  const constraints=selected.map(({index,reading})=>{
   const prediction=predictions.get(index),residual=reading.depthMm-prediction.depthMm;
   return {index,role:reading.use,predictedMm:prediction.depthMm,reportedMm:reading.depthMm,uncertaintyMm:reading.uncertaintyMm,minimumMm:residual-reading.uncertaintyMm,maximumMm:residual+reading.uncertaintyMm,method:prediction.method,beforeMinute:prediction.beforeMinute,afterMinute:prediction.afterMinute};
  });
  const calibration=constraints.filter(c=>c.role==='calibration'),challenge=constraints.filter(c=>c.role==='challenge');
  const calibrationInterval=counts.calibration?intersect(domain,calibration):null;
  const challengeInterval=counts.challenge?intersect(domain,challenge):null;
  const survivingInterval=calibrationInterval?intersect(calibrationInterval,challenge):null;
  return {rateMmHr,calibrationInterval,challengeInterval,survivingInterval,constraints,massErrorLiters:candidate.massErrorLiters};
 });
 const compatibleRatesMmHr=candidates.filter(c=>c.calibrationInterval).map(c=>c.rateMmHr);
 const survivingRatesMmHr=candidates.filter(c=>c.survivingInterval).map(c=>c.rateMmHr);
 const status=!counts.calibration?'need-calibration':!compatibleRatesMmHr.length?'calibration-rejected':!counts.challenge?'needs-challenge':!survivingRatesMmHr.length?'challenged':survivingRatesMmHr.length===1?'one-survivor':'ambiguous';
 return {status,counts,cellSteps,domain,candidates,compatibleRatesMmHr,survivingRatesMmHr,association:declaration.association};
}
export function depthOffsetReceipt(project,declaration){
 const input={kind:DEPTH_OFFSET_KIND,project:structuredClone(project),declaration:structuredClone(declaration)};
 return {input,report:compareDepthOffset(input.project,input.declaration)};
}
export function parseDepthOffsetReceipt(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>4*1024*1024)throw Error('Depth-offset input must be JSON no larger than 4 MiB.');
 const input=JSON.parse(text);
 if(!input||input.kind!==DEPTH_OFFSET_KIND||Object.keys(input).sort().join(',')!=='declaration,kind,project')throw Error('Unsupported depth-offset input envelope.');
 return depthOffsetReceipt(input.project,input.declaration);
}
