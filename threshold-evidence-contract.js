import {canonicalEvidence} from './outlet-evidence-contract.js';
export const THRESHOLD_SCHEMA='experimental-earth-threshold-evidence/1';
const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
const text=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
export function thresholdContext(project,target){
 if(!['existing','proposal'].includes(target))throw Error('Choose the observed scenario');
 const weather={...project.weather};delete weather.stepMinutes;
 return JSON.stringify(canonicalEvidence({target,width:project.width,height:project.height,cells:project[target],weather,source:project.source??''}));
}
export function validateThresholdEvidence(record){
 if(record===undefined)return;
 if(!record||record.schema!==THRESHOLD_SCHEMA||!['existing','proposal'].includes(record.target)||!text(record.contextJson,400000)||!text(record.eventRef,200)||!Number.isInteger(record.width)||record.width<2||record.width>24||!Number.isInteger(record.height)||record.height<2||record.height>24||record.cellCount!==record.width*record.height||!Number.isInteger(record.cellCount)||record.cellCount<4||record.cellCount>576||!finite(record.durationMinutes,5,720)||!Array.isArray(record.readings)||record.readings.length>80)throw Error('Threshold evidence needs a bounded source-bound event and reading list');
 let context;try{context=JSON.parse(record.contextJson);}catch{throw Error('Retained threshold context must be valid JSON');}
 if(!context||context.target!==record.target||context.width!==record.width||context.height!==record.height||context.weather?.durationMinutes!==record.durationMinutes||!Array.isArray(context.cells)||context.cells.length!==record.cellCount)throw Error('Threshold record dimensions, duration and scenario must match its retained context');
 for(const r of record.readings){
  if(!r||!Number.isInteger(r.cellIndex)||r.cellIndex<0||r.cellIndex>=record.cellCount||!finite(r.minute,0,record.durationMinutes)||!['at-least','at-most'].includes(r.relation)||!finite(r.thresholdMm,0,1000)||!finite(r.uncertaintyMm,0,1000)||!['calibration','challenge','unassigned'].includes(r.use)||!text(r.source,300))throw Error('Each bound needs a cell, time, inclusive relation, depth, uncertainty, role and source');
 }
 return record;
}
/** Inclusive consistency, expanded by the declared uncertainty of the bound. */
export function assessThreshold(depthMm,reading){
 const boundMm=reading.relation==='at-least'?Math.max(0,reading.thresholdMm-reading.uncertaintyMm):reading.thresholdMm+reading.uncertaintyMm;
 const guardMm=1e-9*Math.max(1,depthMm,boundMm);
 const marginMm=reading.relation==='at-least'?depthMm-boundMm:boundMm-depthMm;
 return {boundMm,guardMm,marginMm,compatible:marginMm>=-guardMm};
}
