import {runRain} from './core.js';
import {MAX_TRACE_CELL_STEPS} from './rain-tracer.js';
import {originalRechargeIntervals} from './root-zone-timing.js';
import {validateRootZone} from './root-zone.js';
import {advanceRootZoneForcedWithSupply} from './root-zone-forced.js';
import {validateCoolingStudy,COOLING_FILE_LIMIT} from './evaporative-cooling.js';
import {advanceHeatColumnWithDrivenLoss} from './heat-column-step.js';
export const RECHARGE_COOLING_SCHEMA='experimental-earth-recharge-cooling/1';
export const RECHARGE_COOLING_FILE='experimental-earth-recharge-cooling-investigation/1';
export const RECHARGE_COOLING_MEANING='Thermal minute zero is explicitly associated with the start of the retained rain event. Original native infiltration is uniform within each native interval. The declared rooted store supplies prescribed plant demand while rain arrives. A comparison holds the same whole-event water until the event ends, under the same thermal clock. Only the declared fraction of latent heat leaves the effective surface; the remaining energy source is unresolved. No temperature-dependent demand, soil evaporation, inferred field cooling or comfort estimate is supplied.';
const sides=['existing','proposal'],kinds=['interval','latePulse'];
const finite=(x,lo,hi)=>typeof x==='number'&&Number.isFinite(x)&&x>=lo&&x<=hi;
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const accountKeys=['suppliedMm','potentialMm','rechargeMm','drainageMm','inputJm2','exchangeOutJm2','transferDownJm2','surfaceLossJm2','surfaceIntegralCSeconds','subsurfaceIntegralCSeconds'];
export function validateRechargeCooling(project,study){
 if(!exact(study,['schema','cooling','clockSource'])||study.schema!==RECHARGE_COOLING_SCHEMA||
  typeof study.clockSource!=='string'||!study.clockSource.trim()||study.clockSource.length>600)
  throw Error('Declare the association of thermal minute zero with original rain-event start and its source');
 const work=validateCoolingStudy(project,study.cooling);
 const durationMinutes=study.cooling.heatColumn.heatStudy.schedule.reduce((sum,row)=>sum+row.minutes,0);
 if(durationMinutes<project.weather.durationMinutes)throw Error('The retained thermal exposure must include the complete rain event for the event-end pulse comparison');
 const retainedCellSteps=2*project.width*project.height*(Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes)+1);
 if(retainedCellSteps>MAX_TRACE_CELL_STEPS)throw Error('Recharge cooling exceeds the maintained original rain-trace work limit');
 return {...work,durationMinutes,retainedCellSteps,eventMinutes:project.weather.durationMinutes};
}
function coupled(cooling,side,capacityMm,forcingIndex,rechargeMmPerDay,initial,seconds){
 const heat=cooling.heatColumn,surface=heat.heatStudy[side],lower=heat.lowerLayers[side],root=cooling.roots[side];
 const water=advanceRootZoneForcedWithSupply({availableMm:initial.availableMm,capacityMm,depletionFraction:root.depletionFraction,
  rechargeMmPerDay,demandMmPerDay:cooling.demands[forcingIndex].potentialTranspirationMmPerDay,days:seconds/86400});
 const latent=cooling.latentHeatJkg*cooling.surfaceLatentFraction[side];
 let state={surfaceC:initial.surfaceC,subsurfaceC:initial.subsurfaceC};
 const thermal={inputJm2:0,exchangeOutJm2:0,transferDownJm2:0,surfaceLossJm2:0,surfaceIntegralCSeconds:0,subsurfaceIntegralCSeconds:0};
 for(const segment of water.supplySegments){
  const dt=segment.days*86400;
  const step=advanceHeatColumnWithDrivenLoss(surface,lower,heat.heatStudy.schedule[forcingIndex],state,dt,
   {initialWm2:segment.initialMmPerDay*latent/86400,equilibriumWm2:segment.equilibriumMmPerDay*latent/86400,decayPerSecond:segment.decayPerDay/86400});
  for(const key of ['inputJm2','exchangeOutJm2','transferDownJm2','surfaceLossJm2'])thermal[key]+=step[key];
  thermal.surfaceIntegralCSeconds+=step.surfaceMeanC*dt;thermal.subsurfaceIntegralCSeconds+=step.subsurfaceMeanC*dt;
  state={surfaceC:step.surfaceC,subsurfaceC:step.subsurfaceC};
 }
 const next={...state,availableMm:water.availableMm};
 for(const key of accountKeys)next[key]=initial[key]+(key in thermal?thermal[key]:water[key]);
 return next;
}
function pulse(state,rechargeMm,capacityMm){
 const retained=Math.min(rechargeMm,Math.max(0,capacityMm-state.availableMm));
 return {...state,availableMm:state.availableMm+retained,rechargeMm:state.rechargeMm+rechargeMm,
  drainageMm:state.drainageMm+rechargeMm-retained};
}
function profile(cooling,side,original,kind,durationMinutes,eventMinutes){
 const surface=cooling.heatColumn.heatStudy[side],lower=cooling.heatColumn.lowerLayers[side],root=cooling.roots[side];
 const {capacityMm,stressThresholdMm}=validateRootZone(root),initialAvailableMm=Math.min(capacityMm,root.initialAvailableMm);
 const initial={surfaceC:surface.initialC,subsurfaceC:lower.initialC,availableMm:initialAvailableMm,...Object.fromEntries(accountKeys.map(k=>[k,0]))};
 const heatEnds=[];let elapsed=0;for(const row of cooling.heatColumn.heatStudy.schedule){elapsed+=row.minutes;heatEnds.push(elapsed);}
 const boundaries=[...new Set([0,eventMinutes,durationMinutes,...heatEnds,...original.intervals.map(row=>row.endMinute)])].sort((a,b)=>a-b);
 let state={...initial},beforePulse=null;const segments=[];
 for(let i=1;i<boundaries.length;i++){
  const startMinute=boundaries[i-1],endMinute=boundaries[i];
  if(kind==='latePulse'&&startMinute===eventMinutes){beforePulse={...state};state=pulse(state,original.rechargeMm,capacityMm);}
  const forcingIndex=heatEnds.findIndex(end=>startMinute<end);
  const rain=kind==='interval'?original.intervals.find(row=>startMinute>=row.startMinute&&startMinute<row.endMinute):null;
  const rechargeMmPerDay=rain?rain.rechargeMm/((rain.endMinute-rain.startMinute)/1440):0;
  segments.push({startMinute,endMinute,forcingIndex,rechargeMmPerDay,initial:{...state}});
  state=coupled(cooling,side,capacityMm,forcingIndex,rechargeMmPerDay,state,(endMinute-startMinute)*60);
 }
 if(kind==='latePulse'&&durationMinutes===eventMinutes){beforePulse={...state};state=pulse(state,original.rechargeMm,capacityMm);}
 return {kind,capacityMm,stressThresholdMm,initialAvailableMm,initial,segments,beforePulse,final:state};
}
function account(cooling,side,profile,state,minute){
 const surface=cooling.heatColumn.heatStudy[side],lower=cooling.heatColumn.lowerLayers[side];
 const surfaceStoredJm2=surface.capacityJm2K*(state.surfaceC-surface.initialC);
 const subsurfaceStoredJm2=lower.capacityJm2K*(state.subsurfaceC-lower.initialC),totalStoredJm2=surfaceStoredJm2+subsurfaceStoredJm2;
 const latentJm2=state.suppliedMm*cooling.latentHeatJkg;
 return {minute,...state,surfaceStoredJm2,subsurfaceStoredJm2,totalStoredJm2,latentJm2,
  surfaceMeanC:minute>0?state.surfaceIntegralCSeconds/(minute*60):surface.initialC,
  subsurfaceMeanC:minute>0?state.subsurfaceIntegralCSeconds/(minute*60):lower.initialC,
  unmetMm:Math.max(0,state.potentialMm-state.suppliedMm),unmodeledLatentSupplyJm2:latentJm2-state.surfaceLossJm2,
  waterResidualMm:profile.initialAvailableMm+state.rechargeMm-state.drainageMm-state.suppliedMm-state.availableMm,
  latentResidualJm2:latentJm2*cooling.surfaceLatentFraction[side]-state.surfaceLossJm2,
  energyResidualJm2:state.inputJm2-state.surfaceLossJm2-state.exchangeOutJm2-totalStoredJm2};
}
function at(result,side,kind,minute){
 const p=result[side][kind];let state;
 if(minute===result.durationMinutes)state=p.final;
 else if(minute===0)state=p.initial;
 else{
  const row=p.segments.find(row=>minute>=row.startMinute&&minute<row.endMinute);
  if(!row)throw Error('The requested thermal time has no retained forcing interval');
  state=coupled(result.study.cooling,side,p.capacityMm,row.forcingIndex,row.rechargeMmPerDay,row.initial,(minute-row.startMinute)*60);
 }
 return account(result.study.cooling,side,p,state,minute);
}
export function inspectRechargeCooling(result,minute){
 if(result?.schema!=='experimental-earth-recharge-cooling-result/1'||!finite(minute,0,result.durationMinutes))throw Error('Inspect a finite time in the retained rain and heat exposure');
 const row={minute};
 for(const side of sides){row[side]=Object.fromEntries(kinds.map(kind=>[kind,at(result,side,kind,minute)]));row[side].differenceC=row[side].interval.surfaceC-row[side].latePulse.surfaceC;}
 return row;
}
export function compareRechargeCooling(project,study){
 const work=validateRechargeCooling(project,study),n=project.width*project.height;
 const result={schema:'experimental-earth-recharge-cooling-result/1',project:structuredClone(project),study:structuredClone(study),...work,meaning:RECHARGE_COOLING_MEANING};
 for(const side of sides){
  const run=runRain(project[side],project.width,project.height,project.weather,{traceBudget:true,rainTrace:{sourceCells:Array.from({length:n},(_,i)=>i),captureSteps:true}});
  const original=originalRechargeIntervals(run,project,work.cellIndex);
  result[side]={originalBudget:original.originalBudget,originalIntervals:original.intervals,originalRechargeMm:original.rechargeMm,
   ...Object.fromEntries(kinds.map(kind=>[kind,profile(study.cooling,side,original,kind,work.durationMinutes,work.eventMinutes)]))};
 }
 const times=[...new Set([0,work.durationMinutes,...result.existing.interval.segments.map(row=>row.endMinute),...Array.from({length:Math.ceil(work.durationMinutes)},(_,i)=>i)])].sort((a,b)=>a-b);
 result.trajectory=times.map(minute=>inspectRechargeCooling(result,minute));result.final=result.trajectory.at(-1);return result;
}
export function serializeRechargeCooling(project,study){
 validateRechargeCooling(project,study);const text=JSON.stringify({schema:RECHARGE_COOLING_FILE,project,study},null,2);
 if(new TextEncoder().encode(text).byteLength>COOLING_FILE_LIMIT)throw Error('Recharge cooling investigation exceeds 5 MiB');return text;
}
export function parseRechargeCooling(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>COOLING_FILE_LIMIT)throw Error('Recharge cooling investigation must be UTF-8 JSON up to 5 MiB');
 const value=JSON.parse(text);if(!exact(value,['schema','project','study'])||value.schema!==RECHARGE_COOLING_FILE)throw Error('Unsupported recharge cooling source file; derived conclusions are not accepted');
 validateRechargeCooling(value.project,value.study);return value;
}
