import {validateProject, runRain} from './core.js';
import {validateStudy} from './study-contract.js';
import {evaluateReadings} from './infiltration-study.js';
export const RAIN_SOIL_WORK_LIMIT = 3000000;
/** Finite conditional explanations, not parameter estimates or probabilities. */
export function compareRainSoil(project, request) {
  validateProject(project);
  validateStudy(request);
  const {target,surface,ratesMmHr,rainRatesMmHr,gauge=null}=request;
  if(Object.keys(project.weather).some(k=>/^rain(?:Timeline|Series|Segments|Schedule)$/i.test(k)&&project.weather[k]!=null))throw Error('Joint comparison requires constant rainfall; preserve the original timeline.');
  if(!Array.isArray(rainRatesMmHr)||!rainRatesMmHr.length||rainRatesMmHr.length>9||new Set(rainRatesMmHr).size!==rainRatesMmHr.length||rainRatesMmHr.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>250))throw Error('Supply 1–9 distinct rainfall intensities from 0 to 250 mm/h.');
  if(gauge!==null&&(!Number.isFinite(gauge.lowerMmHr)||!Number.isFinite(gauge.upperMmHr)||gauge.lowerMmHr<0||gauge.upperMmHr>250||gauge.upperMmHr<gauge.lowerMmHr||typeof gauge.source!=='string'||!gauge.source.trim()||gauge.source.length>1000))throw Error('Rainfall bounds need ordered finite limits and an original source.');
  const cellSteps=ratesMmHr.length*rainRatesMmHr.length*project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
  if(cellSteps>RAIN_SOIL_WORK_LIMIT)throw Error('Complete comparison exceeds 3,000,000 cell steps.');
  const readings=project.observations.map((reading,index)=>({reading,index}));
  const calibration=readings.filter(x=>x.reading.scenario===target&&x.reading.use==='calibration');
  const challenge=readings.filter(x=>x.reading.scenario===target&&x.reading.use==='challenge');
  const counts={calibration:calibration.length,challenge:challenge.length,ignored:readings.length-calibration.length-challenge.length};
  if(!project[target].some(c=>c.surface===surface))return {status:'surface-absent',counts,cellSteps,candidates:[]};
  const candidates=[];
  for(const rainMmHr of rainRatesMmHr)for(const rateMmHr of ratesMmHr){
    const result=runRain(project[target],project.width,project.height,{...project.weather,rainMmHr},{surfaceInfiltrationOverride:{surface,rateMmHr}});
    const gaugeCompatible=gauge===null?null:rainMmHr>=gauge.lowerMmHr&&rainMmHr<=gauge.upperMmHr;
    const fit=evaluateReadings(result,calibration),check=evaluateReadings(result,challenge);
    candidates.push({rainMmHr,rateMmHr,gaugeCompatible,calibration:fit,challenge:check,compatible:fit.compatible===true&&gaugeCompatible!==false,surviving:fit.compatible===true&&gaugeCompatible!==false&&check.compatible!==false,rainLiters:result.rainLiters,massErrorLiters:result.massErrorLiters});
  }
  candidates.sort((a,b)=>(a.calibration.rmseMm??0)-(b.calibration.rmseMm??0)||a.rainMmHr-b.rainMmHr||a.rateMmHr-b.rateMmHr);
  const compatible=candidates.filter(c=>c.compatible),surviving=compatible.filter(c=>c.surviving);
  return {status:!calibration.length?'need-calibration':!compatible.length?'calibration-rejected':!challenge.length?'needs-challenge':!surviving.length?'challenged':surviving.length===1?'one-survivor':'ambiguous',counts,cellSteps,candidates,compatiblePairs:compatible.map(({rainMmHr,rateMmHr})=>({rainMmHr,rateMmHr})),survivingPairs:surviving.map(({rainMmHr,rateMmHr})=>({rainMmHr,rateMmHr}))};
}

const TRANSFER_LIMIT=4*1024*1024;
export function exportRainSoil(project,request){
  compareRainSoil(project,request);
  const text=JSON.stringify({kind:'experimental-earth-rain-soil',version:1,project,request},null,2);
  if(new TextEncoder().encode(text).length>TRANSFER_LIMIT)throw Error('Original input transfer exceeds 4 MiB.');
  return text;
}
export function importRainSoil(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>TRANSFER_LIMIT)throw Error('Original input transfer exceeds 4 MiB.');
  const data=JSON.parse(text);
  if(data?.kind!=='experimental-earth-rain-soil'||data.version!==1)throw Error('Expected original rain–soil investigation inputs.');
  return {project:data.project,request:data.request,result:compareRainSoil(data.project,data.request)};
}
