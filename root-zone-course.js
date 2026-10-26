import {validateProject,runRain} from './core.js';
import {assertMatchingEventSite} from './event-challenge.js';
import {validateRootZone,validateDrySchedule} from './root-zone.js';
import {advanceRootZoneForced} from './root-zone-forced.js';
import {originalRechargeIntervals,validateEventDemand} from './root-zone-timing.js';
import {MAX_TRACE_CELL_STEPS} from './rain-tracer.js';
export const ROOT_COURSE_SCHEMA='experimental-earth-rooted-event-course/1';
export const ROOT_COURSE_FILE_LIMIT=16*1024*1024;
export const ROOT_COURSE_WORK_LIMIT=1000000;
export const ROOT_COURSE_MEANING='Rooted water persists across the complete declared course. Each retained surface event starts dry and runs independently with its original constant infiltration assumptions; surface water, soil hydraulic state and runoff are not carried between events. Native infiltration is uniform within each numerical interval and wholly enters the rooted store. No soil evaporation, capillary rise, growth or feedback into infiltration is modeled. This is a conditional model comparison, not measured seasonal prediction or irrigation advice.';
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const finite=(n,a,b)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
const source=s=>typeof s==='string'&&s.trim()&&s.length<=500;
const metrics=['rechargeMm','drainageMm','suppliedMm','unmetMm','potentialMm'];
export function validateRootCourse(input){
 if(!exact(input,['schema','cellIndex','associationSource','existing','proposal','events','schedule'])||input.schema!==ROOT_COURSE_SCHEMA||!source(input.associationSource))throw Error('Supply only original rooted course inputs and an explicit event-to-store association');
 validateRootZone(input.existing);validateRootZone(input.proposal);let days=validateDrySchedule(input.schedule),work=0;
 if(!Array.isArray(input.events)||input.events.length<1||input.events.length>12)throw Error('Retain 1–12 complete original events');
 const refs=new Set();
 for(const [index,event] of input.events.entries()){
  if(!exact(event,['reference','project','gapDays','gapDemand','eventDemand','surfaceResetSource'])||!source(event.reference)||!source(event.surfaceResetSource)||refs.has(event.reference.trim()))throw Error('Every event needs a distinct course reference and an explicit initially-dry surface basis');
  refs.add(event.reference.trim());validateProject(event.project);validateEventDemand(event.gapDemand);validateEventDemand(event.eventDemand);
  if(!finite(event.gapDays,0,366))throw Error('Declare a finite preceding dry gap from 0 to 366 days');
  const p=event.project,n=p.width*p.height;
  if(!Number.isInteger(input.cellIndex)||input.cellIndex<0||input.cellIndex>=n)throw Error('Choose a cell in every original event');
  if(index)for(const side of ['existing','proposal'])assertMatchingEventSite(input.events[0].project,p,side);
  const retained=2*n*(Math.ceil(p.weather.durationMinutes/p.weather.stepMinutes)+1);
  if(retained>MAX_TRACE_CELL_STEPS)throw Error('One original event exceeds the retained infiltration trace budget');
  work+=retained;days+=event.gapDays+p.weather.durationMinutes/1440;
 }
 if(work>ROOT_COURSE_WORK_LIMIT)throw Error('Complete course exceeds the '+ROOT_COURSE_WORK_LIMIT+' cell-step work budget');
 if(days>366)throw Error('The complete event and dry course is limited to 366 days');
 return {totalDays:days,cellSteps:work};
}
function initial(root){return {day:0,availableMm:Math.min(root.initialAvailableMm,validateRootZone(root).capacityMm),...Object.fromEntries(metrics.map(k=>[k,0])),balanceErrorMm:0};}
function advance(root,capacity,before,rechargeMmPerDay,demandMmPerDay,days){
 const next=advanceRootZoneForced({availableMm:before.availableMm,capacityMm:capacity,depletionFraction:root.depletionFraction,rechargeMmPerDay,demandMmPerDay,days});
 const row={day:before.day+days,availableMm:next.availableMm};
 for(const k of metrics)row[k]=before[k]+next[k];
 row.balanceErrorMm=Math.min(root.initialAvailableMm,capacity)+row.rechargeMm-row.drainageMm-row.suppliedMm-row.availableMm;
 return row;
}
export function compareRootCourse(input){
 const work=validateRootCourse(input),sides={};
 for(const side of ['existing','proposal']){
  const root=input[side],capacity=validateRootZone(root).capacityMm,segments=[],events=[];let state=initial(root);
  const append=(days,recharge,demand,phase,eventIndex)=>{
   if(days===0)return;
   const before=structuredClone(state);state=advance(root,capacity,before,recharge,demand,days);
   segments.push({startDay:before.day,endDay:state.day,rechargeMmPerDay:recharge,demandMmPerDay:demand,phase,eventIndex,before,after:structuredClone(state)});
  };
  for(const [eventIndex,event]of input.events.entries()){
   append(event.gapDays,0,event.gapDemand.potentialTranspirationMmPerDay,'gap',eventIndex);
   const p=event.project,n=p.width*p.height;
   const run=runRain(p[side],p.width,p.height,p.weather,{traceBudget:true,rainTrace:{sourceCells:Array.from({length:n},(_,i)=>i),captureSteps:true}});
   const original=originalRechargeIntervals(run,p,input.cellIndex),before=structuredClone(state);
   for(const row of original.intervals){const days=(row.endMinute-row.startMinute)/1440;append(days,row.rechargeMm/days,event.eventDemand.potentialTranspirationMmPerDay,'event',eventIndex);}
   events.push({reference:event.reference,startDay:before.day,endDay:state.day,before,after:structuredClone(state),original,originalFinalSurfaceLiters:run.snapshots.at(-1).storedLiters});
  }
  for(const row of input.schedule)append(row.durationDays,0,row.potentialTranspirationMmPerDay,'tail',null);
  sides[side]={root:structuredClone(root),capacityMm:capacity,segments,events,final:state};
 }
 return {schema:ROOT_COURSE_SCHEMA,...work,totalDays:sides.existing.final.day,...sides,meaning:ROOT_COURSE_MEANING};
}
export function rootCourseAtDay(profile,day){
 if(!profile?.segments?.length||!finite(day,0,profile.final.day))throw Error('Day is outside this computed rooted course');
 if(day===0)return initial(profile.root);
 if(day===profile.final.day)return structuredClone(profile.final);
 const row=profile.segments.find(r=>day<=r.endDay);
 return advance(profile.root,profile.capacityMm,row.before,row.rechargeMmPerDay,row.demandMmPerDay,Math.max(0,day-row.startDay));
}
export function serializeRootCourse(input){validateRootCourse(input);const text=JSON.stringify(input,null,2);if(new TextEncoder().encode(text).length>ROOT_COURSE_FILE_LIMIT)throw Error('Original course exceeds its 16 MiB reopen bound');return text;}
export function parseRootCourse(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>ROOT_COURSE_FILE_LIMIT)throw Error('Original course exceeds its 16 MiB reopen bound');const input=JSON.parse(text);validateRootCourse(input);return input;}
