import {runRain} from './core.js';
import {MAX_TRACE_CELL_STEPS} from './rain-tracer.js';
import {validateRootZoneStudy,checkRootZoneFileBytes} from './root-zone-study.js';
import {validateRootZone,validateDrySchedule,runRootZone,rootZoneAtDay} from './root-zone.js';
import {advanceRootZoneForced} from './root-zone-forced.js';
export const ROOT_ZONE_TIMING_SCHEMA='experimental-earth-root-zone-timing/1';
export const ROOT_ZONE_TIMING_FILE='experimental-earth-root-zone-timing-investigation/1';
const finite=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const tolerance=(a,b)=>1e-9*Math.max(1,Math.abs(a),Math.abs(b));
const zero=availableMm=>({availableMm,suppliedMm:0,unmetMm:0,potentialMm:0,rechargeMm:0,drainageMm:0,balanceErrorMm:0});
function accumulate(prior,step,initial){
 const row={availableMm:step.availableMm};
 for(const key of ['suppliedMm','unmetMm','potentialMm','rechargeMm','drainageMm'])row[key]=prior[key]+step[key];
 row.balanceErrorMm=initial+row.rechargeMm-row.drainageMm-row.suppliedMm-row.availableMm;
 return row;
}
export function validateEventDemand(demand){
 if(!exact(demand,['potentialTranspirationMmPerDay','source'])||
 !finite(demand.potentialTranspirationMmPerDay,0,30)||typeof demand.source!=='string'||!demand.source.trim()||demand.source.length>500)
  throw Error('Declare event transpiration from 0 to 30 mm/day and its source or hypothetical basis');
}
export function validateRootZoneTiming(project,study,demand){
 const work=validateRootZoneStudy(project,study);validateEventDemand(demand);
 const retainedCellSteps=2*project.width*project.height*(Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes)+1);
 if(retainedCellSteps>MAX_TRACE_CELL_STEPS)throw Error('Paired recharge timing exceeds the '+MAX_TRACE_CELL_STEPS+' retained cell-step budget');
 return {...work,retainedCellSteps};
}
/** Reuse accepted native fluxes, with all rainfall tagged on an initially dry surface.
 * Never relabel untagged initial water as rainfall-derived recharge.
 */
export function originalRechargeIntervals(run,project,cellIndex){
 const n=project.width*project.height,area=project.weather.cellSizeM**2;
 const first=run?.snapshots?.[0],trace=run?.rainTrace,rows=trace?.snapshots,budget=run?.waterBudget?.cells;
 if(!first||first.minute!==0||first.storedLiters!==0||!Array.isArray(first.depthsMm)||first.depthsMm.length!==n||first.depthsMm.some(v=>v!==0))
  throw Error('Timing requires a native initially dry surface; untagged initial surface inventory is unsupported');
 if(!trace||!Array.isArray(trace.sourceCells)||trace.sourceCells.length!==n||new Set(trace.sourceCells).size!==n||
  trace.sourceCells.some(i=>!Number.isInteger(i)||i<0||i>=n)||!Array.isArray(rows)||rows.length<2||
  rows.length>Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes)+1||!Array.isArray(budget)||budget.length!==n)
  throw Error('Complete original infiltration trace and local budget are required');
 const final=rows.at(-1);
 if(rows[0].minute!==0||final.minute!==project.weather.durationMinutes||
  rows[0].absorbedByCellLiters?.length!==n||rows[0].absorbedByCellLiters.some(v=>v!==0)||final.absorbedByCellLiters?.length!==n)
  throw Error('Original recharge trace does not span the whole event');
 for(let i=0;i<n;i++){
  const a=final.absorbedByCellLiters[i],b=budget[i]?.absorbedLiters;
  if(!finite(a,0,1e15)||!finite(b,0,1e15)||Math.abs(a-b)>tolerance(a,b))
   throw Error('Rain attribution does not account for the complete original infiltration');
 }
 const intervals=[];
 for(let k=1;k<rows.length;k++){
  const a=rows[k-1],b=rows[k],start=a.minute,end=b.minute;
  if(!finite(start,0,project.weather.durationMinutes)||!finite(end,start,project.weather.durationMinutes)||end<=start||
   Math.abs(end-Math.min(project.weather.durationMinutes,start+project.weather.stepMinutes))>1e-8||
   a.absorbedByCellLiters?.length!==n||b.absorbedByCellLiters?.length!==n)
   throw Error('Invalid original infiltration interval');
  const before=a.absorbedByCellLiters[cellIndex],after=b.absorbedByCellLiters[cellIndex];
  if(!finite(before,0,1e15)||!finite(after,before,1e15))throw Error('Original cumulative infiltration must be finite and nondecreasing');
  intervals.push({startMinute:start,endMinute:end,rechargeMm:(after-before)/area});
 }
 return {intervals,rechargeMm:final.absorbedByCellLiters[cellIndex]/area,originalBudget:structuredClone(budget[cellIndex])};
}
function boundaryRoot(root,availableMm){
 return {...root,initialAvailableMm:availableMm,source:'Computed event-end boundary from the original declared rooted store: '+root.source.slice(0,420)};
}
export function runRootZoneTiming(root,intervals,demand,schedule){
 const capacity=validateRootZone(root);validateEventDemand(demand);validateDrySchedule(schedule);
 if(!Array.isArray(intervals)||intervals.length<1||intervals.length>720)throw Error('Supply 1–720 original infiltration intervals');
 let minute=0,rechargeMm=0;
 for(const row of intervals){
  if(!exact(row,['startMinute','endMinute','rechargeMm'])||row.startMinute!==minute||
   !finite(row.endMinute,minute,720)||row.endMinute<=minute||!finite(row.rechargeMm,0,1000000))
   throw Error('Recharge intervals must be finite, complete and contiguous');
  minute=row.endMinute;rechargeMm+=row.rechargeMm;
 }
 if(rechargeMm>1000000)throw Error('Whole-event recharge exceeds the admitted range');
 const initial=Math.min(root.initialAvailableMm,capacity.capacityMm),eventDays=minute/1440;
 const base={schema:ROOT_ZONE_TIMING_SCHEMA,root:structuredClone(root),...capacity,eventDays,totalDays:eventDays+validateDrySchedule(schedule),
  initialAvailableMm:initial,demand:structuredClone(demand)};
 const E=demand.potentialTranspirationMmPerDay,force=(S,r,days)=>advanceRootZoneForced({availableMm:S,capacityMm:capacity.capacityMm,
  depletionFraction:root.depletionFraction,rechargeMmPerDay:r,demandMmPerDay:E,days});
 let state=zero(initial);const retained=[];
 for(const row of intervals){
  const days=(row.endMinute-row.startMinute)/1440,rate=row.rechargeMm/days;
  const step=force(state.availableMm,rate,days);
  retained.push({...row,rechargeMmPerDay:rate,initial:structuredClone(state)});
  state=accumulate(state,step,initial);
 }
 const timed={...base,kind:'interval',intervals:retained,event:state,dry:runRootZone(boundaryRoot(root,state.availableMm),0,schedule)};
 const beforePulse=force(initial,0,eventDays),retainedPulse=Math.min(rechargeMm,capacity.capacityMm-beforePulse.availableMm);
 const pulseEvent={...beforePulse,rechargeMm,drainageMm:rechargeMm-retainedPulse,availableMm:beforePulse.availableMm+retainedPulse};
 pulseEvent.balanceErrorMm=initial+rechargeMm-pulseEvent.drainageMm-pulseEvent.suppliedMm-pulseEvent.availableMm;
 const latePulse={...base,kind:'latePulse',intervals:[],eventBeforePulse:beforePulse,event:pulseEvent,dry:runRootZone(boundaryRoot(root,pulseEvent.availableMm),0,schedule)};
 return {interval:timed,latePulse};
}
/** Exact within the declared piecewise forcing; no interpolation of graph samples. */
export function rootZoneTimingAtDay(profile,day){
 if(profile?.schema!==ROOT_ZONE_TIMING_SCHEMA||!finite(day,0,profile.totalDays))throw Error('Day is outside the timing comparison');
 const initial=profile.initialAvailableMm;
 if(day>=profile.eventDays){
  const dry=rootZoneAtDay(profile.dry,Math.max(0,Math.min(profile.dry.totalDays,day-profile.eventDays)));
  const row={...profile.event,day,phase:'dry',availableMm:dry.availableMm,
   suppliedMm:profile.event.suppliedMm+dry.suppliedMm,unmetMm:profile.event.unmetMm+dry.unmetMm,
   potentialMm:profile.event.potentialMm+dry.suppliedMm+dry.unmetMm};
  row.balanceErrorMm=initial+row.rechargeMm-row.drainageMm-row.suppliedMm-row.availableMm;return row;
 }
 const minute=day*1440;
 if(profile.kind==='latePulse'){
  return {day,phase:'event',...advanceRootZoneForced({availableMm:initial,capacityMm:profile.capacityMm,depletionFraction:profile.root.depletionFraction,
   rechargeMmPerDay:0,demandMmPerDay:profile.demand.potentialTranspirationMmPerDay,days:day})};
 }
 const row=profile.intervals.find(r=>minute<=r.endMinute);
 const step=advanceRootZoneForced({availableMm:row.initial.availableMm,capacityMm:profile.capacityMm,depletionFraction:profile.root.depletionFraction,
  rechargeMmPerDay:row.rechargeMmPerDay,demandMmPerDay:profile.demand.potentialTranspirationMmPerDay,days:Math.max(0,(minute-row.startMinute)/1440)});
 return {day,phase:'event',...accumulate(row.initial,step,initial)};
}
export function compareRootZoneTiming(project,study,demand){
 const work=validateRootZoneTiming(project,study,demand),cellAreaM2=project.weather.cellSizeM**2,n=project.width*project.height;
 const sides={};
 for(const side of ['existing','proposal']){
  const run=runRain(project[side],project.width,project.height,project.weather,{traceBudget:true,rainTrace:{sourceCells:Array.from({length:n},(_,i)=>i),captureSteps:true}});
  const original=originalRechargeIntervals(run,project,study.cellIndex);
  sides[side]={...runRootZoneTiming(study[side],original.intervals,demand,study.schedule),originalBudget:original.originalBudget,
   originalCell:structuredClone(project[side][study.cellIndex]),originalRechargeMm:original.rechargeMm};
 }
 return {schema:ROOT_ZONE_TIMING_SCHEMA,project:structuredClone(project),study:structuredClone(study),demand:structuredClone(demand),...work,cellAreaM2,...sides};
}
export function serializeRootZoneTiming(project,study,demand){
 validateRootZoneTiming(project,study,demand);
 const text=JSON.stringify({schema:ROOT_ZONE_TIMING_FILE,project,study,demand},null,2);
 checkRootZoneFileBytes(new TextEncoder().encode(text).byteLength);return text;
}
export function parseRootZoneTiming(text){
 if(typeof text!=='string')throw Error('Timing investigation must be UTF-8 JSON text');
 checkRootZoneFileBytes(new TextEncoder().encode(text).byteLength);
 const value=JSON.parse(text);
 if(!exact(value,['schema','project','study','demand'])||value.schema!==ROOT_ZONE_TIMING_FILE)
  throw Error('Unsupported timing investigation; saved conclusions are not accepted');
 validateRootZoneTiming(value.project,value.study,value.demand);return value;
}
