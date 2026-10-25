import {inspectObservedConnectivity} from './observed-connectivity.js';
import {minimumPondingConnection,pondingConnectionBoundary} from './ponding-connectivity.js';
import {checkProjectFileBytes} from './project-portability.js';

/** Numeric notebook bands at selected exact times, with no temporal fill-in. */
export function inspectSharedObservedConnection(project,query){
 const minutes=query?.minutes;
 if(!Array.isArray(minutes)||minutes.length<2||minutes.length>16||Array.from(minutes).some(t=>!Number.isFinite(t))||new Set(minutes).size!==minutes.length)throw Error('Select 2–16 distinct exact notebook times.');
 const times=[...minutes].sort((a,b)=>a-b);
 // Reuse complete original admission/intersection at EVERY selected time.
 const ledgers=times.map(minute=>inspectObservedConnectivity(project,{...query,minute}));
 const {minute,...question}=ledgers[0].query;
 const base={query:{...question,minutes:times},ledgers,path:[],boundary:[],
  usedReadingIndices:[...new Set(ledgers.flatMap(l=>l.usedReadingIndices))].sort((a,b)=>a-b),
  basis:'One common grid connection at every selected exact numeric-observation time. No interpolation, between-visit continuity, physical access or source accuracy is established.'};
 if(ledgers.some(l=>l.status==='conflicting-bands'))return {...base,status:'conflicting-bands',cells:[]};
 if(ledgers.some(l=>l.status==='roundoff-contact'))return {...base,status:'roundoff-contact',cells:[]};
 if(ledgers[0].status==='disconnected-footprint')return {...base,status:'disconnected-footprint',cells:[]};
 const allowed=new Set(question.allowedIndices),n=project.width*project.height;
 const cells=Array.from({length:n},(_,cellIndex)=>{
  if(!allowed.has(cellIndex))return {cellIndex,status:'outside',visits:[]};
  const visits=ledgers.map((ledger,index)=>({minute:times[index],...ledger.cells[cellIndex]}));
  const excluded=visits.some(v=>v.status==='above'),supported=visits.every(v=>v.status==='at-or-below');
  return {cellIndex,status:excluded?'above-at-a-visit':supported?'at-or-below-every-visit':'unresolved',visits,
   unresolvedMinutes:visits.filter(v=>['unmeasured','straddling'].includes(v.status)).map(v=>v.minute)};
 });
 const certain=minimumPondingConnection(cells.map(c=>c.status==='at-or-below-every-visit'?0:1),project.width,project.height,question);
 if(certain.bottleneckMm===0)return {...base,cells,status:'band-supported',path:certain.path};
 const possibleDepths=cells.map(c=>c.status==='above-at-a-visit'?1:0);
 const possible=minimumPondingConnection(possibleDepths,project.width,project.height,question);
 if(possible.bottleneckMm===0)return {...base,cells,status:'unresolved',path:possible.path,unresolvedPairs:possible.path.flatMap(cellIndex=>cells[cellIndex].unresolvedMinutes.map(minute=>({cellIndex,minute})))};
 const cut=pondingConnectionBoundary(possibleDepths,project.width,project.height,question,0);
 return {...base,cells,status:'band-excluded',...cut};
}

export const SHARED_OBSERVED_CONNECTION_SCHEMA='experimental-earth-shared-observed-connection/1';
export function exportSharedObservedConnection(project,query){
 const report=inspectSharedObservedConnection(project,query);
 const text=JSON.stringify({schema:SHARED_OBSERVED_CONNECTION_SCHEMA,project,query:report.query},null,2);
 checkProjectFileBytes(new TextEncoder().encode(text).length);return text;
}
export function reopenSharedObservedConnection(text){
 if(typeof text!=='string')throw Error('Original investigation JSON is required.');
 checkProjectFileBytes(new TextEncoder().encode(text).length);
 const input=JSON.parse(text);
 if(input?.schema!==SHARED_OBSERVED_CONNECTION_SCHEMA)throw Error('Unsupported shared observed-connection investigation.');
 return {project:input.project,report:inspectSharedObservedConnection(input.project,input.query)};
}
