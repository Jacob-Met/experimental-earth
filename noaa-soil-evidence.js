import {compareHourlyInvestigation,serializeHourlyRecipe} from './noaa-hourly-investigation.js';
import {evaluateHeatColumnTarget} from './heat-column.js';
import {screenHeatReadings} from './surface-heat-evidence.js';
export const NOAA_SOIL_SCHEMA='experimental-earth-noaa-soil-evidence/1';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=600;
export function validateSoilRecipe(input){
 if(!exact(input,['schema','original','soil'])||input.schema!==NOAA_SOIL_SCHEMA)throw Error('Retain only versioned original dual-channel inputs');
 serializeHourlyRecipe(input.original);
 const s=input.soil;
 if(!exact(s,['depthCm','associationSource','halfWidthC','bandSource','calibrationCount'])||![5,10,20,50,100].includes(s.depthCm)||!text(s.associationSource)||!text(s.bandSource)||!Number.isFinite(s.halfWidthC)||s.halfWidthC<0||s.halfWidthC>100||!Number.isInteger(s.calibrationCount)||s.calibrationCount<0||s.calibrationCount>input.original.selection.count)throw Error('Declare one original soil depth, its association with the lumped lower store, comparison band and calibration count');
 return input;
}
export function serializeSoilRecipe(input){validateSoilRecipe(input);const text=JSON.stringify(input,null,2);if(new TextEncoder().encode(text).length>5*1024*1024)throw Error('Dual-channel input exceeds 5 MiB');return text;}
export function parseSoilRecipe(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>5*1024*1024)throw Error('Dual-channel input exceeds 5 MiB');return validateSoilRecipe(JSON.parse(text));}
function outcome(candidates,calibrationCount,challengeCount){
 const calibration=candidates.filter(c=>c.calibration.compatible===true),survivors=calibration.filter(c=>c.challenge.compatible!==false);
 const status=!calibrationCount?'need-calibration':!calibration.length?'calibration-rejected':challengeCount&&!survivors.length?'challenged':!challengeCount?'needs-challenge':survivors.length===1?'one-survivor':'ambiguous';
 return {status,calibrationLabels:calibration.map(c=>c.label),survivingLabels:survivors.map(c=>c.label)};
}
/** Original hourly means at a declared sensor depth are compared with a lumped
 * lower-store mean only under the retained representativeness assumption. */
export async function compareSoilEvidence(input){
 input=structuredClone(input);serializeSoilRecipe(input);
 const base=await compareHourlyInvestigation(input.original),{soil}=input,field='SOIL_TEMP_'+soil.depthCm;
 const readings=base.course.rows.map((row,index)=>{
  const value=row.numbers[field];if(value.missing)throw Error(`Original supplied line ${input.original.selection.firstLine+index}: ${field} is missing; no depth substitution`);
  if(!Number.isFinite(value.value)||value.value<-100||value.value>200)throw Error('Original soil temperature is outside supported comparison range');
  return {index,channel:'soil',depthCm:soil.depthCm,aggregation:'interval-mean',fromMinute:index*60,minute:(index+1)*60,temperatureC:value.value,raw:value.raw,halfWidthC:soil.halfWidthC,use:index<soil.calibrationCount?'calibration':'challenge',sourceLine:row.line,fromUtc:row.intervalStartUtc,toUtc:row.intervalEndUtc};
 });
 const candidates=input.original.hypotheses.map((h,i)=>{
  const study=structuredClone(base.project.heatColumnStudy);Object.assign(study.lowerLayers.existing,{capacityJm2K:h.capacityJm2K,conductanceWm2K:h.conductanceWm2K,source:h.source});
  const course=evaluateHeatColumnTarget(study,'existing',readings.map(r=>r.minute),readings.map(({fromMinute,minute})=>({fromMinute,minute})));
  const top=study.heatStudy.existing,lower=study.lowerLayers.existing;
  const rows=readings.map((r,j)=>{
   const p=course.trajectory.find(p=>p.minute===r.minute),m=course.averages[j],predictionC=m.subsurfaceMeanC,residualC=r.temperatureC-predictionC;
   const scale=(Math.abs(p.inputJm2)+Math.abs(p.exchangeOutJm2)+Math.abs(p.transferDownJm2))/top.capacityJm2K+Math.abs(p.transferDownJm2)/lower.capacityJm2K;
   const arithmeticGuardC=Number.EPSILON*2048*study.heatStudy.schedule.length*Math.max(1,Math.abs(r.temperatureC),Math.abs(m.surfaceMeanC),Math.abs(predictionC),Math.abs(top.initialC),Math.abs(lower.initialC),scale);
   return {...r,predictionC,residualC,arithmeticGuardC,withinBand:Math.abs(residualC)<=r.halfWidthC+arithmeticGuardC};
  });
  const surface=base.report.candidates[i],surfaceRows=[...surface.calibration.rows,...surface.challenge.rows].map(r=>({...r,channel:'surface'}));
  const all=[...surfaceRows,...rows],screen=(list,use)=>screenHeatReadings(list.filter(r=>r.use===use));
  return {label:h.label,surface:{calibration:surface.calibration,challenge:surface.challenge},soil:{calibration:screen(rows,'calibration'),challenge:screen(rows,'challenge')},calibration:screen(all,'calibration'),challenge:screen(all,'challenge')};
 });
 const count=readings.length,calibration=input.original.calibrationCount+soil.calibrationCount,challenge=2*count-calibration;
 return {...outcome(candidates,calibration,challenge),input,course:base.course,readings,candidates,surfaceReport:base.report,soilReport:outcome(candidates.map(c=>({label:c.label,...c.soil})),soil.calibrationCount,count-soil.calibrationCount),counts:{calibration,challenge},semantics:'Joint screening of unchanged offered alternatives, not fitting. Original soil means average co-located measurements at the selected depth; their representation of a lumped store is a declared assumption. No per-probe QC, precision, spatial representativeness or independence is inferred. Arithmetic guards are separate from declared bands.'};
}
