import {validateProject,runRain} from './core.js';
import {validateStudy,DEFAULT_STUDY} from './study-contract.js';
import {compareDepthOffset,prepareDepthOffset,DEPTH_OFFSET_KIND} from './depth-offset-evidence.js';
import {validateDepthAvailability} from './complementary-depth-plan.js';

export const OFFSET_QUESTION_MODEL_LIMIT=1_000_000;
export const OFFSET_QUESTION_PAIR_LIMIT=2_000_000;
export const OFFSET_QUESTION_KIND='experimental-earth/depth-offset-question/1';
function optionsFor(raw,cellCount,duration){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(key=>!['halfWidthMm','sameSensorBasis','availability'].includes(key))||!Number.isFinite(raw.halfWidthMm)||raw.halfWidthMm<0||raw.halfWidthMm>1000)throw Error('Declare only acquisition options and a prospective reading half-width from 0 to 1000 mm.');
 if(typeof raw.sameSensorBasis!=='string'||!raw.sameSensorBasis.trim()||raw.sameSensorBasis.length>500)throw Error('Explain why the prospective reading would share the same sensor zero.');
 const availability=validateDepthAvailability(raw.availability,cellCount,duration);
 if(!availability)throw Error('Explicitly offer cells and a time window for the prospective reading.');
 return {halfWidthMm:raw.halfWidthMm,sameSensorBasis:raw.sameSensorBasis.trim(),availability};
}

/** Single finite-grid question; every calibration offset remains possible. */
export function selectOffsetQuestion(runs,raw,recorded=[]){
 if(!Array.isArray(runs)||runs.length<2||runs.length>9)throw Error('Supply 2–9 calibration-compatible trajectories.');
 const snapshots=runs[0]?.snapshots,count=snapshots?.[0]?.depthsMm?.length;
 if(!Array.isArray(snapshots)||snapshots.length<2||snapshots.length>721||!Number.isInteger(count)||count<1||count>576)throw Error('Supply bounded original solver trajectories.');
 const query=optionsFor(raw,count,snapshots.at(-1).minute);
 const rates=new Set();
 for(const run of runs){
  if(!Number.isFinite(run.rateMmHr)||run.rateMmHr<0||run.rateMmHr>2000||rates.has(run.rateMmHr))throw Error('Supply distinct supported rate identities.');rates.add(run.rateMmHr);
  const b=run.calibrationInterval;
  if(!Array.isArray(b)||b.length!==2||![b[0],b[1]].every(Number.isFinite)||b[0]>b[1]||b[0]<-1000||b[1]>1000)throw Error('Supply each complete closed calibration offset interval.');
  if(!Array.isArray(run.snapshots)||run.snapshots.length!==snapshots.length)throw Error('Trajectories must share original times and cells.');
  for(let i=0;i<snapshots.length;i++){
   const s=run.snapshots[i];if(!Number.isFinite(s.minute)||s.minute<0||s.minute>720||s.minute!==snapshots[i].minute||(i&&s.minute<=run.snapshots[i-1].minute)||!Array.isArray(s.depthsMm)||s.depthsMm.length!==count||Array.from({length:count},(_,j)=>!Object.hasOwn(s.depthsMm,j)||!Number.isFinite(s.depthsMm[j])||s.depthsMm[j]<0).some(Boolean))throw Error('Trajectories must retain finite depths on a common ordered grid.');
  }
 }
 const pairCount=runs.length*(runs.length-1)/2,estimatedPairChecks=pairCount*snapshots.length*query.availability.cellIndices.length;
 if(estimatedPairChecks>OFFSET_QUESTION_PAIR_LIMIT)return {status:'work-limit',question:null,estimatedPairChecks,query};
 const pairs=[];for(let a=0;a<runs.length;a++)for(let b=a+1;b<runs.length;b++)pairs.push({firstRateMmHr:runs[a].rateMmHr,secondRateMmHr:runs[b].rateMmHr,first:a,second:b});
 if(!Array.isArray(recorded)||Array.from({length:recorded.length},(_,i)=>recorded[i]).some(r=>!r||!Number.isInteger(r.cellIndex)||r.cellIndex<0||r.cellIndex>=count||!Number.isFinite(r.minute)||r.minute<0||r.minute>snapshots.at(-1).minute))throw Error('Recorded coordinates must belong to the original event.');
 const key=(cell,minute)=>cell+':'+Math.round(minute*1e7),occupied=new Set(recorded.map(r=>key(r.cellIndex,r.minute)));
 let question=null,offeredCount=0,recordedCount=0,outsideDomainCount=0,evaluatedCount=0;
 for(let step=0;step<snapshots.length;step++){
  const minute=snapshots[step].minute;if(minute<query.availability.startMinute||minute>query.availability.endMinute)continue;
  for(const cellIndex of query.availability.cellIndices){
   offeredCount++;if(occupied.has(key(cellIndex,minute))){recordedCount++;continue;}
   const predictions=runs.map(run=>{const depthMm=run.snapshots[step].depthsMm[cellIndex];return {rateMmHr:run.rateMmHr,depthMm,calibrationInterval:[...run.calibrationInterval],minimumReportedMm:depthMm+run.calibrationInterval[0]-query.halfWidthMm,maximumReportedMm:depthMm+run.calibrationInterval[1]+query.halfWidthMm};});
   // The current original-reading contract admits reported values in 0..1000.
   // Do not silently clip/censor predicted signed or over-range observations.
   if(predictions.some(p=>p.minimumReportedMm<0||p.maximumReportedMm>1000)){outsideDomainCount++;continue;}
   evaluatedCount++;
   const separatedPairs=pairs.flatMap((pair,index)=>{const a=predictions[pair.first],b=predictions[pair.second];const gapMm=Math.max(a.minimumReportedMm-b.maximumReportedMm,b.minimumReportedMm-a.maximumReportedMm),guardMm=1e-9*Math.max(1,a.maximumReportedMm,b.maximumReportedMm,query.halfWidthMm);return gapMm>guardMm?[{index,...pair,gapMm,guardMm}]:[];});
   if(separatedPairs.length&&(!question||separatedPairs.length>question.separatedPairs.length))question={cellIndex,minute,predictions,separatedPairs};
  }
 }
 const selected=new Set(question?.separatedPairs.map(p=>p.index)??[]);
 return {status:question?'question':!offeredCount?'unavailable':!evaluatedCount?(outsideDomainCount?'outside-reading-domain':'all-recorded'):'indistinguishable',query,question,pairs,unresolvedPairs:pairs.filter((_,i)=>!selected.has(i)),offeredCount,recordedCount,outsideDomainCount,evaluatedCount,estimatedPairChecks};
}

export function chooseDepthOffsetQuestion(project,declaration,raw){
 validateProject(project);const study=project.infiltrationStudy??DEFAULT_STUDY;validateStudy(study);
 const query=optionsFor(raw,project.width*project.height,project.weather.durationMinutes);
 if(!declaration||declaration.kind!==DEPTH_OFFSET_KIND||!Array.isArray(declaration.references))throw Error('Use a valid original sensor association.');
 // Reuse the maintained pure association validator before the aggregate work
 // gate. It performs no solve, including when the complete planner is refused.
 const canonical=prepareDepthOffset(project,{minimumMm:declaration.minimumMm,maximumMm:declaration.maximumMm,association:declaration.association,indices:declaration.references.map(r=>r?.index)},study);
 if(canonical.contextJson!==declaration.contextJson)return {status:'context-changed',question:null,query};
 if(canonical.references.some((r,i)=>r.readingJson!==declaration.references[i].readingJson))return {status:'reading-changed',question:null,query};
 const steps=Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
 const estimatedModelCellSteps=2*study.ratesMmHr.length*project.width*project.height*steps;
 const estimatedPairChecks=study.ratesMmHr.length*(study.ratesMmHr.length-1)/2*(steps+1)*query.availability.cellIndices.length;
 if(estimatedModelCellSteps>OFFSET_QUESTION_MODEL_LIMIT||estimatedPairChecks>OFFSET_QUESTION_PAIR_LIMIT)return {status:'work-limit',question:null,query,estimatedModelCellSteps,estimatedPairChecks};
 const source=compareDepthOffset(project,declaration,study);
 if(!source.candidates.length)return {status:source.status,question:null,query,source};
 const compatible=source.candidates.filter(c=>c.calibrationInterval);
 if(compatible.length<2)return {status:'insufficient-alternatives',question:null,query,source};
 const runs=compatible.map(c=>({...c,snapshots:runRain(project[study.target],project.width,project.height,project.weather,{surfaceInfiltrationOverride:{surface:study.surface,rateMmHr:c.rateMmHr}}).snapshots}));
 const recorded=declaration.references.map(ref=>project.observations[ref.index]);
 return {...selectOffsetQuestion(runs,query,recorded),source,estimatedModelCellSteps,sourceSignature:JSON.stringify(project),declaration:structuredClone(declaration)};
}

export function depthOffsetQuestionReceipt(original,query){
 if(!original||original.kind!==DEPTH_OFFSET_KIND||Object.keys(original).sort().join(',')!=='declaration,kind,project')throw Error('Use an original depth-offset investigation, without supplied results.');
 const input={kind:OFFSET_QUESTION_KIND,original:structuredClone(original),query:structuredClone(query)};
 return {input,report:chooseDepthOffsetQuestion(input.original.project,input.original.declaration,input.query)};
}
export function parseDepthOffsetQuestionReceipt(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>4*1024*1024)throw Error('Question input must be JSON no larger than 4 MiB.');
 const input=JSON.parse(text);
 if(!input||input.kind!==OFFSET_QUESTION_KIND||Object.keys(input).sort().join(',')!=='kind,original,query')throw Error('Unsupported original question envelope.');
 return depthOffsetQuestionReceipt(input.original,input.query);
}
