import {validateProject,runRain} from './core.js';
import {validateStudy,DEFAULT_STUDY} from './study-contract.js';
import {interpolateDepth} from './infiltration-study.js';
import {THRESHOLD_SCHEMA,thresholdContext,validateThresholdEvidence,assessThreshold} from './threshold-evidence-contract.js';
export function prepareThresholdEvidence(project,target,eventRef,readings){
 validateProject(project);
 const record={schema:THRESHOLD_SCHEMA,target,eventRef:eventRef.trim(),contextJson:thresholdContext(project,target),cellCount:project.width*project.height,durationMinutes:project.weather.durationMinutes,readings:structuredClone(readings)};
 return validateThresholdEvidence(record);
}
export function compareThresholdEvidence(project,study=project.infiltrationStudy??DEFAULT_STUDY){
 validateProject(project);validateStudy(study);
 const record=project.thresholdEvidence,empty={candidates:[],compatibleRatesMmHr:[],survivingRatesMmHr:[]};
 if(!record)return {...empty,status:'no-record'};
 if(record.target!==study.target||record.contextJson!==thresholdContext(project,record.target))return {...empty,status:'context-changed'};
 const counts={calibration:record.readings.filter(r=>r.use==='calibration').length,challenge:record.readings.filter(r=>r.use==='challenge').length,unassigned:record.readings.filter(r=>r.use==='unassigned').length};
 if(!project[study.target].some(c=>c.surface===study.surface))return {...empty,counts,status:'surface-absent'};
 const cellSteps=study.ratesMmHr.length*project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
 if(cellSteps>3_000_000)return {...empty,counts,status:'work-limit'};
 const candidates=study.ratesMmHr.map(rateMmHr=>{
  const model=runRain(project[study.target],project.width,project.height,project.weather,{surfaceInfiltrationOverride:{surface:study.surface,rateMmHr}});
  const readings=record.readings.map((r,index)=>{const prediction=interpolateDepth(model,r.cellIndex,r.minute);return {index,use:r.use,...prediction,...assessThreshold(prediction.depthMm,r)};});
  const group=role=>{const rows=readings.filter(r=>r.use===role);return {count:rows.length,compatible:rows.length?rows.every(r=>r.compatible):null};};
  return {rateMmHr,readings,calibration:group('calibration'),challenge:group('challenge'),massErrorLiters:model.massErrorLiters};
 });
 const compatible=candidates.filter(c=>c.calibration.compatible===true),surviving=compatible.filter(c=>c.challenge.compatible!==false);
 const status=!counts.calibration?'need-calibration':!compatible.length?'calibration-rejected':counts.challenge&&!surviving.length?'challenged':!counts.challenge?'needs-challenge':surviving.length===1?'one-survivor':'ambiguous';
 return {status,counts,cellSteps,candidates,compatibleRatesMmHr:compatible.map(c=>c.rateMmHr),survivingRatesMmHr:surviving.map(c=>c.rateMmHr),semantics:'Compatibility with inclusive one-sided bounds, not exact-depth fitting, probability, or physical identification. Numeric-depth notebook readings are not silently associated with this separate evidence record.'};
}
