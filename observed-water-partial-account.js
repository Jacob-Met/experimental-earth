import {inspectObservedWaterAccount} from './observed-water-account.js';
import {DEPTH_UNITS} from './observation-units.js';
import {OUTLET_UNITS} from './outlet-evidence-contract.js';
import {thresholdContext,assessThreshold} from './threshold-evidence-contract.js';

export const PARTIAL_ACCOUNT_SCHEMA='experimental-earth-observed-water-account/2';
const MODE='partial-endpoint-bands';
function sum(values){let total=0,correction=0;for(const value of values){const y=value-correction,next=total+y;correction=(next-total)-y;total=next;}return total;}
/** Unknown depth has a nonnegative lower bound and no finite upper bound.
 * This is a domain bound, never a fabricated zero-depth observation.
 */
export function inspectPartialWaterAccount(project,input){
 if(input?.coverageMode!==MODE)throw Error('Explicitly choose partial-endpoint-bands for this account.');
 if(input.useThresholdEvidence!==undefined&&typeof input.useThresholdEvidence!=='boolean')throw Error('Choose whether to associate original threshold evidence explicitly.');
 const original=inspectObservedWaterAccount(project,input),useThresholdEvidence=input.useThresholdEvidence===true;
 const query={...original.query,coverageMode:MODE,useThresholdEvidence};
 const record=project.thresholdEvidence;
 if(useThresholdEvidence){
  if(!record||record.target!==original.scenario||record.contextJson!==thresholdContext(project,record.target))throw Error('Original threshold evidence must match this site and observed scenario.');
  if(typeof input.thresholdAssociationBasis!=='string'||!input.thresholdAssociationBasis.trim()||input.thresholdAssociationBasis.length>600)throw Error('Declare why the original threshold event and collection event are the same interval and clock.');
  query.thresholdAssociationBasis=input.thresholdAssociationBasis.trim();
 }
 const endpoints=structuredClone(original.endpoints);
 for(const endpoint of endpoints)for(const cell of endpoint.cells){
  cell.thresholdReadings=useThresholdEvidence?record.readings.flatMap((reading,index)=>reading.minute===endpoint.minute&&reading.cellIndex===cell.cellIndex?[{index,reading:structuredClone(reading),boundMm:assessThreshold(0,reading).boundMm}]:[]):[];
  if(!cell.thresholdReadings.length||['disjoint','roundoff-contact'].includes(cell.status))continue;
  let lower=cell.bandMm?.[0]??0,upper=cell.bandMm?.[1]??null;
  for(const row of cell.thresholdReadings){if(row.reading.relation==='at-least')lower=Math.max(lower,row.boundMm);else upper=upper===null?row.boundMm:Math.min(upper,row.boundMm);}
  const gap=upper===null?0:Math.max(0,lower-upper),guard=Number.EPSILON*32*Math.max(1,lower,upper??0);
  cell.status=gap>guard?'disjoint':gap>0?'roundoff-contact':upper===null?'lower-bounded':'bounded';
  cell.bandMm=gap>0?null:[lower,upper];
  if(gap>0)cell.combinedDiagnostic={gapMm:gap,numericalGuardMm:guard};
 }
 const unknownEndpointCells=endpoints.map(e=>e.cells.filter(c=>c.status==='unmeasured').map(c=>c.cellIndex));
 const unboundedEndpointCells=endpoints.map(e=>e.cells.filter(c=>c.bandMm?.[1]==null).map(c=>c.cellIndex));
 const base={...original,query,endpoints,unknownEndpointCells,unboundedEndpointCells,thresholdEventRef:useThresholdEvidence?record.eventRef:null,account:null};
 if(endpoints.some(e=>e.cells.some(c=>c.status==='disjoint')))return {...base,status:'conflicting-bands'};
 if(endpoints.some(e=>e.cells.some(c=>c.status==='roundoff-contact')))return {...base,status:'roundoff-contact'};
 const count=project.width*project.height,area=project.weather.cellSizeM**2,totalArea=count*area;
 const storage=endpoints.map((e,i)=>[sum(e.cells.map(c=>(c.bandMm?.[0]??0)*area)),unboundedEndpointCells[i].length?null:sum(e.cells.map(c=>c.bandMm[1]*area))]);
 const rainfall=query.rainfall,factor=DEPTH_UNITS[rainfall.unit],rain=[Math.max(0,rainfall.depth-rainfall.uncertainty)*factor*totalArea,(rainfall.depth+rainfall.uncertainty)*factor*totalArea];
 const collection=original.collection,unit=OUTLET_UNITS[collection.unit],outflow=[Math.max(0,collection.volume-collection.uncertainty)*unit,(collection.volume+collection.uncertainty)*unit];
 const storageChange=[storage[0][1]===null?null:storage[1][0]-storage[0][1],storage[1][1]===null?null:storage[1][1]-storage[0][0]];
 const residual=[storageChange[1]===null?null:rain[0]-outflow[1]-storageChange[1],storageChange[0]===null?null:rain[1]-outflow[0]-storageChange[0]];
 const numericalGuardLiters=Number.EPSILON*64*Math.max(1,...rain,...outflow,...storage.flat().filter(Number.isFinite));
 const status=residual[0]!==null&&residual[0]>numericalGuardLiters?'positive-residual':residual[1]!==null&&residual[1]<-numericalGuardLiters?'negative-residual':residual.every(v=>v===null)?'unbounded-residual':'unresolved-residual';
 return {...base,status,account:{areaM2:totalArea,initialStorageLiters:storage[0],finalStorageLiters:storage[1],rainfallLiters:rain,collectedLiters:outflow,storageChangeLiters:storageChange,residualLiters:residual,numericalGuardLiters}};
}
export function exportPartialWaterAccount(project,input){const report=inspectPartialWaterAccount(project,input),text=JSON.stringify({schema:PARTIAL_ACCOUNT_SCHEMA,project,input:report.query},null,2);if(new TextEncoder().encode(text).length>4*1024*1024)throw Error('Account exceeds the 4 MiB transfer limit.');return text;}
export function reopenPartialWaterAccount(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>4*1024*1024)throw Error('Account exceeds the 4 MiB transfer limit.');const raw=JSON.parse(text);if(raw?.schema!==PARTIAL_ACCOUNT_SCHEMA)throw Error('Unsupported partial water account.');return {project:raw.project,report:inspectPartialWaterAccount(raw.project,raw.input)};}
