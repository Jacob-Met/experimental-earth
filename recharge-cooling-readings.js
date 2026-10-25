import {COOLING_FILE_LIMIT} from './evaporative-cooling.js';
import {validateRechargeCooling,compareRechargeCooling,rechargeCoolingFractionVariant,evaluateRechargeCoolingTarget} from './recharge-cooling.js';
import {COOLING_FRACTION_SCHEMA,validateCoolingFractionEvidence,constrainCoolingFractionReading,coolingFractionArithmeticGuard,summarizeCoolingFractionRows} from './cooling-fraction-evidence.js';
export const RECHARGE_READINGS_SCHEMA='experimental-earth-recharge-cooling-readings/1';
export const RECHARGE_READINGS_FILE='experimental-earth-recharge-cooling-reading-investigation/1';
export const RECHARGE_READINGS_MEANING='Each timing needs one constant surface-latent fraction that explains all original readings under fixed rain, rooted water, demand, material and event-start clock declarations. Calibration and held-aside constraints stay separate. A surviving timing/fraction interval is conditional compatibility, not an adopted parameter, probability or established physical cause. Role labels do not establish independent acquisition; numeric guards are engineering allowances, not measurement uncertainty.';
const kinds=['interval','latePulse'],finite=(x,lo,hi)=>typeof x==='number'&&Number.isFinite(x)&&x>=lo&&x<=hi;
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
export function validateRechargeCoolingReadings(project,study,evidence){
 validateRechargeCooling(project,study);
 if(evidence?.schema!==RECHARGE_READINGS_SCHEMA)throw Error('Retain versioned original recharge-cooling readings');
 validateCoolingFractionEvidence(study.cooling,{...evidence,schema:COOLING_FRACTION_SCHEMA});return evidence;
}
export function compareRechargeCoolingReadings(project,study,evidence){
 validateRechargeCoolingReadings(project,study,evidence);
 const original=compareRechargeCooling(project,study),target=evidence.target;
 const variants=evidence.fractionRange.map(f=>rechargeCoolingFractionVariant(original,target,f));
 const minutes=evidence.readings.map(r=>r.minute),windows=evidence.readings.filter(r=>r.aggregation==='interval-mean').map(r=>({fromMinute:r.fromMinute,minute:r.minute}));
 const results={};
 for(const kind of kinds){
  const courses=variants.map(variant=>{
   const evaluated=evaluateRechargeCoolingTarget(variant,target,kind,minutes,windows);
   return {byTime:new Map(evaluated.trajectory.map(r=>[r.minute,r])),byWindow:new Map(evaluated.averages.map(r=>[JSON.stringify([r.fromMinute,r.minute]),r]))};
  });
  const rows=evidence.readings.map((reading,index)=>{
   const predictions=courses.map(c=>({end:c.byTime.get(reading.minute),value:reading.aggregation==='interval-mean'?
    c.byWindow.get(JSON.stringify([reading.fromMinute,reading.minute])).surfaceMeanC:c.byTime.get(reading.minute).surfaceC}));
   const values=predictions.map(p=>p.value);
   const guard=coolingFractionArithmeticGuard(study.cooling,target,predictions,reading,original[target][kind].segments.length);
   return {index,reading:structuredClone(reading),predictionsAtRangeEndsC:values,arithmeticGuardC:guard,
    compatibleFractionRange:constrainCoolingFractionReading(evidence.fractionRange,values[0],values[1],reading,guard),
    sensitivity:evidence.fractionRange[0]===evidence.fractionRange[1]?'fixed-range':values[0]===values[1]?'none':'varying'};
  });
  results[kind]={rows,...summarizeCoolingFractionRows(evidence,rows)};
 }
 return {schema:'experimental-earth-recharge-cooling-reading-result/1',evidence:structuredClone(evidence),durationMinutes:original.durationMinutes,
  model:original,variants,...results,meaning:RECHARGE_READINGS_MEANING};
}
export function inspectRechargeCoolingReadings(result,minute){
 if(result?.schema!=='experimental-earth-recharge-cooling-reading-result/1'||!finite(minute,0,result.durationMinutes))throw Error('Inspect a finite time in the retained recharge-reading exposure');
 const {target,fractionRange:domain}=result.evidence,output={minute};
 for(const kind of kinds){
  const endpoints=result.variants.map(variant=>evaluateRechargeCoolingTarget(variant,target,kind,[minute]).trajectory.find(row=>row.minute===minute).surfaceC);
  const prediction=range=>{
   if(!range)return null;
   const values=range.map(f=>domain[0]===domain[1]?endpoints[0]:endpoints[0]+(endpoints[1]-endpoints[0])*((f-domain[0])/(domain[1]-domain[0])));
   return [Math.min(...values),Math.max(...values)];
  };
  output[kind]={predictionsAtDeclaredEndsC:endpoints,calibrationPredictionRangeC:prediction(result[kind].calibrationRange),survivingPredictionRangeC:prediction(result[kind].survivingRange)};
 }
 return output;
}
export function authoredRechargeCoolingReadings(project,study,target='existing'){
 const original=compareRechargeCooling(project,study),truth=rechargeCoolingFractionVariant(original,target,.4),times=[original.durationMinutes/8,original.durationMinutes];
 const points=evaluateRechargeCoolingTarget(truth,target,'interval',times).trajectory;
 return {schema:RECHARGE_READINGS_SCHEMA,target,fractionRange:[0,1],rangeSource:'Authored complete0–1 fraction domain; no field restriction measured',
  associationSource:'Authored interval-arrival control at constant fraction0.4 under the retained water/heat/clock declarations. No sensor acquisition or independent field validation.',
  readings:times.map((minute,i)=>({minute,temperatureC:points.find(r=>r.minute===minute).surfaceC,halfWidthC:.05,use:i?'challenge':'calibration',
   source:'Authored exact interval-arrival temperature at fraction0.4; use label is illustrative and does not establish held-aside acquisition'}))};
}
export function serializeRechargeCoolingReadings(project,study,evidence){
 validateRechargeCoolingReadings(project,study,evidence);const text=JSON.stringify({schema:RECHARGE_READINGS_FILE,project,study,evidence},null,2);
 if(new TextEncoder().encode(text).byteLength>COOLING_FILE_LIMIT)throw Error('Recharge reading investigation exceeds5MiB');return text;
}
export function parseRechargeCoolingReadings(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>COOLING_FILE_LIMIT)throw Error('Recharge readings must be UTF-8 JSON up to5MiB');
 const value=JSON.parse(text);if(!exact(value,['schema','project','study','evidence'])||value.schema!==RECHARGE_READINGS_FILE)throw Error('Unsupported original recharge-reading file; saved conclusions are not accepted');
 validateRechargeCoolingReadings(value.project,value.study,value.evidence);return value;
}
