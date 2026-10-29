import {validateProject} from './core.js';
import {DEPTH_UNITS} from './observation-units.js';
import {compareRainSoil} from './rain-soil-evidence.js';
export const RAIN_GAUGE_SCHEMA='experimental-earth-interval-rain-gauge/1';
export const RAIN_GAUGE_BUNDLE_SCHEMA='experimental-earth-rain-soil-gauge/1';
const LIMIT=4*1024*1024;
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const text=s=>typeof s==='string'&&s.trim()&&s.length<=600;
export function validateRainGauge(project,gauge){
 validateProject(project);
 if(!exact(gauge,['schema','eventRef','sameEventBasis','siteCoverageBasis','intervalBasis','readings'])||gauge.schema!==RAIN_GAUGE_SCHEMA)throw Error('Retain original interval rainfall observations and association declarations.');
 for(const key of ['eventRef','sameEventBasis','siteCoverageBasis','intervalBasis'])if(!text(gauge[key]))throw Error('Supply a nonempty original declaration: '+key);
 if(!Array.isArray(gauge.readings)||gauge.readings.length<1||gauge.readings.length>64)throw Error('Supply 1–64 original interval rainfall readings.');
 const ids=new Set();
 for(const r of Array.from(gauge.readings)){
  if(!exact(r,['id','startMinute','endMinute','depth','uncertainty','unit','source','use'])||!text(r.id)||ids.has(r.id)||!text(r.source)||!['calibration','challenge','unassigned'].includes(r.use)||!Object.hasOwn(DEPTH_UNITS,r.unit))throw Error('Each distinct original rainfall reading needs source, unit and explicit evidence role.');
  ids.add(r.id);
  if(!Number.isFinite(r.startMinute)||!Number.isFinite(r.endMinute)||r.startMinute<0||r.endMinute<=r.startMinute||r.endMinute>project.weather.durationMinutes)throw Error('Rainfall interval must be positive and inside the original event time window.');
  if(![r.depth,r.uncertainty].every(v=>Number.isFinite(v)&&v>=0&&v*DEPTH_UNITS[r.unit]<=10000))throw Error('Supply finite nonnegative rainfall depth and uncertainty within 10000 mm.');
 }
 if(!gauge.readings.some(r=>r.use!=='unassigned'))throw Error('Assign at least one rainfall reading explicitly to calibration or challenge.');
 return structuredClone(gauge);
}
/** Same [0,stormMinutes] constant-forcing overlap used by runRain. No soil model or inferred rainfall averaging. */
function scoreRain(rainMmHr,stormMinutes,entries){
 const errors=entries.map(({reading:r,index})=>{
  const rainyMinutes=Math.max(0,Math.min(r.endMinute,stormMinutes)-Math.min(r.startMinute,stormMinutes));
  const predictedMm=rainMmHr*rainyMinutes/60,observedMm=r.depth*DEPTH_UNITS[r.unit],uncertaintyMm=r.uncertainty*DEPTH_UNITS[r.unit],residualMm=observedMm-predictedMm;
  const numericalGuardMm=64*Number.EPSILON*Math.max(1,predictedMm,observedMm,uncertaintyMm);
  return {index,id:r.id,rainyMinutes,predictedMm,observedMm,uncertaintyMm,residualMm,numericalGuardMm,withinBand:Math.abs(residualMm)<=uncertaintyMm+numericalGuardMm};
 });
 return {count:errors.length,compatible:errors.length?errors.every(e=>e.withinBand):null,errors};
}
export function scoreOriginalRainGauge(project,gauge,rainMmHr,stormMinutes){
 const original=validateRainGauge(project,gauge);
 if(!Number.isFinite(rainMmHr)||rainMmHr<0||rainMmHr>250||!Number.isFinite(stormMinutes)||stormMinutes<0||stormMinutes>project.weather.durationMinutes)throw Error('Admit constant forcing within original event bounds.');
 const entries=original.readings.map((reading,index)=>({reading,index}));
 return {calibration:scoreRain(rainMmHr,stormMinutes,entries.filter(e=>e.reading.use==='calibration')),challenge:scoreRain(rainMmHr,stormMinutes,entries.filter(e=>e.reading.use==='challenge'))};
}
export function compareRainGauge(project,request,gauge){
 const original=validateRainGauge(project,gauge),base=compareRainSoil(project,request);
 const entries=original.readings.map((reading,index)=>({reading,index}));
 const assigned=role=>entries.filter(e=>e.reading.use===role),byRain=new Map();
 for(const rain of request.rainRatesMmHr)byRain.set(rain,{calibration:scoreRain(rain,project.weather.stormMinutes,assigned('calibration')),challenge:scoreRain(rain,project.weather.stormMinutes,assigned('challenge'))});
 const candidates=base.candidates.map(c=>{const rainfall=byRain.get(c.rainMmHr);return {...c,rainfall,compatible:c.compatible&&rainfall.calibration.compatible!==false,surviving:c.surviving&&rainfall.calibration.compatible!==false&&rainfall.challenge.compatible!==false};});
 const pair=({rainMmHr,rateMmHr})=>({rainMmHr,rateMmHr});
 const compatiblePairs=candidates.filter(c=>c.compatible).map(pair),survivingPairs=candidates.filter(c=>c.surviving).map(pair);
 const hasChallenge=base.counts.challenge>0||assigned('challenge').length>0;
 const status=['surface-absent','need-calibration'].includes(base.status)?base.status:!compatiblePairs.length?'calibration-rejected':!hasChallenge?'needs-challenge':!survivingPairs.length?'challenged':survivingPairs.length===1?'one-survivor':'ambiguous';
 return {status,baseStatus:base.status,counts:{...base.counts,gaugeCalibration:assigned('calibration').length,gaugeChallenge:assigned('challenge').length,gaugeIgnored:assigned('unassigned').length},candidates,compatiblePairs,survivingPairs,gauge:original,cellSteps:base.cellSteps,
  meaning:'Original interval rainfall totals test the offered constant forcing over its declared storm support. Calibration filters without reordering the original depth fit; held-aside rain only challenges. Contradiction may concern forcing, association, uncertainty or model assumptions and does not uniquely identify a soil property. Event identity, interval totals and site representativeness are declarations, not verified acquisition.'};
}
export function exportRainGauge(project,request,gauge){
 const report=compareRainGauge(project,request,gauge);const text=JSON.stringify({schema:RAIN_GAUGE_BUNDLE_SCHEMA,project,request,gauge:report.gauge},null,2);if(new TextEncoder().encode(text).length>LIMIT)throw Error('Original rain-gauge investigation exceeds 4 MiB.');return text;
}
export function importRainGauge(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>LIMIT)throw Error('Open at most 4 MiB of original inputs.');const raw=JSON.parse(text);
 if(!exact(raw,['schema','project','request','gauge'])||raw.schema!==RAIN_GAUGE_BUNDLE_SCHEMA)throw Error('Open original rain-gauge investigation inputs, not a saved result.');
 return {...raw,report:compareRainGauge(raw.project,raw.request,raw.gauge)};
}
