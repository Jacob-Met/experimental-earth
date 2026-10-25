import {validateProject} from './core.js';
import {observationConsistency} from './observation-consistency.js';
import {OUTLET_UNITS,outletContext} from './outlet-evidence-contract.js';
import {DEPTH_UNITS} from './observation-units.js';

export const OBSERVED_WATER_ACCOUNT_SCHEMA='experimental-earth-observed-water-account/1';
const basis=value=>typeof value==='string'&&value.trim().length>0&&value.length<=600;
function sum(values){let total=0,correction=0;for(const value of values){const y=value-correction,next=total+y;correction=(next-total)-y;total=next;}return total;}
export function inspectObservedWaterAccount(project,input){
 validateProject(project);
 const record=project.outletEvidence;
 if(!record)throw Error('Retain an original full-boundary collection first.');
 if(record.contextJson!==outletContext(project,record.target)||record.durationMinutes!==project.weather.durationMinutes)throw Error('The collection belongs to a changed site or event context.');
 if(!Number.isInteger(input?.collectionIndex)||input.collectionIndex<0||input.collectionIndex>=record.readings.length)throw Error('Select one original collection interval.');
 for(const key of ['uniformDepthBasis','rainfallCoverageBasis','sameEventBasis','noOtherFlowBasis'])if(!basis(input[key]))throw Error('Retain explicit sourced association and coverage declarations: '+key+'.');
 const rainfall=input.rainfall;
 if(!rainfall||!Object.hasOwn(DEPTH_UNITS,rainfall.unit)||!basis(rainfall.source)||![rainfall.depth,rainfall.uncertainty].every(v=>Number.isFinite(v)&&v>=0&&v*DEPTH_UNITS[rainfall.unit]<=1000))throw Error('Supply sourced rainfall depth and uncertainty within 1000 mm, with explicit units.');
 const query={collectionIndex:input.collectionIndex,rainfall:structuredClone(rainfall),...Object.fromEntries(['uniformDepthBasis','rainfallCoverageBasis','sameEventBasis','noOtherFlowBasis'].map(k=>[k,input[k].trim()]))};
 const collection=record.readings[query.collectionIndex],count=project.width*project.height;
 const diagnostics=observationConsistency(project.observations);
 const endpoints=[collection.startMinute,collection.endMinute].map(minute=>{
  const rows=project.observations.flatMap((reading,index)=>reading.scenario===record.target&&reading.minute===minute?[{index,reading:structuredClone(reading)}]:[]);
  const repeats=new Map(diagnostics.groups.filter(g=>g.scenario===record.target&&g.minute===minute).map(g=>[g.cellIndex,g]));
  const cells=Array.from({length:count},(_,cellIndex)=>{
   const readings=rows.filter(r=>r.reading.cellIndex===cellIndex),repeat=repeats.get(cellIndex);
   if(!readings.length)return {cellIndex,status:'unmeasured',readings};
   if(repeat&&repeat.status!=='overlap')return {cellIndex,status:repeat.status,readings,diagnostic:structuredClone(repeat)};
   const bandMm=repeat?repeat.commonBandMm:[Math.max(0,readings[0].reading.depthMm-readings[0].reading.uncertaintyMm),readings[0].reading.depthMm+readings[0].reading.uncertaintyMm];
   return {cellIndex,status:'bounded',bandMm,readings};
  });
  return {minute,cells};
 });
 const base={query,scenario:record.target,eventRef:record.eventRef,collectionSource:record.collectionSource,collection:structuredClone(collection),endpoints,account:null};
 if(endpoints.some(e=>e.cells.some(c=>c.status==='disjoint')))return {...base,status:'conflicting-bands'};
 if(endpoints.some(e=>e.cells.some(c=>c.status==='roundoff-contact')))return {...base,status:'roundoff-contact'};
 if(endpoints.some(e=>e.cells.some(c=>c.status==='unmeasured')))return {...base,status:'incomplete-endpoints'};
 // One millimetre over one square metre is one litre. The explicit
 // representativeness declaration is essential: a point probe is not an area mean.
 const area=project.weather.cellSizeM**2,totalArea=area*count;
 const storage=endpoints.map(e=>[0,1].map(k=>sum(e.cells.map(c=>c.bandMm[k]*area))));
 const factor=DEPTH_UNITS[rainfall.unit],rain=[Math.max(0,rainfall.depth-rainfall.uncertainty)*factor*totalArea,(rainfall.depth+rainfall.uncertainty)*factor*totalArea];
 const unit=OUTLET_UNITS[collection.unit],outflow=[Math.max(0,collection.volume-collection.uncertainty)*unit,(collection.volume+collection.uncertainty)*unit];
 const storageChange=[storage[1][0]-storage[0][1],storage[1][1]-storage[0][0]];
 const residual=[rain[0]-outflow[1]-storageChange[1],rain[1]-outflow[0]-storageChange[0]];
 const numericalGuardLiters=Number.EPSILON*64*Math.max(1,...rain,...outflow,...storage.flat());
 const status=residual[1]<-numericalGuardLiters?'negative-residual':residual[0]>numericalGuardLiters?'positive-residual':'unresolved-residual';
 return {...base,status,account:{areaM2:totalArea,initialStorageLiters:storage[0],finalStorageLiters:storage[1],rainfallLiters:rain,collectedLiters:outflow,storageChangeLiters:storageChange,residualLiters:residual,numericalGuardLiters}};
}
export function exportObservedWaterAccount(project,input){const report=inspectObservedWaterAccount(project,input),text=JSON.stringify({schema:OBSERVED_WATER_ACCOUNT_SCHEMA,project,input:report.query},null,2);if(new TextEncoder().encode(text).length>4*1024*1024)throw Error('Account exceeds the 4 MiB transfer limit.');return text;}
export function reopenObservedWaterAccount(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>4*1024*1024)throw Error('Account exceeds the 4 MiB transfer limit.');const raw=JSON.parse(text);if(raw?.schema!==OBSERVED_WATER_ACCOUNT_SCHEMA)throw Error('Unsupported observed water account.');return {project:raw.project,report:inspectObservedWaterAccount(raw.project,raw.input)};}
