/** Read-only exact-time notebook-band connectivity, without simulated fill-in. */
import {validateProject} from './core.js';
import {observationConsistency} from './observation-consistency.js';
import {minimumPondingConnection,validateConnectivityQuestion,pondingConnectionBoundary} from './ponding-connectivity.js';

export function inspectObservedConnectivity(project,query){
 validateProject(project);
 const {scenario,minute,thresholdMm}=query??{};
 if(!['existing','proposal'].includes(scenario))throw Error('Choose an explicitly observed scenario.');
 if(!Number.isFinite(minute)||minute<0||minute>project.weather.durationMinutes)throw Error('Choose an exact time in the original notebook event.');
 if(!Number.isFinite(thresholdMm)||thresholdMm<=0||thresholdMm>1000)throw Error('Choose a positive depth threshold up to 1000 mm.');
 const question=validateConnectivityQuestion(query,project.width,project.height),allowed=new Set(question.allowedIndices),count=project.width*project.height;
 const diagnostic=observationConsistency(project.observations),rows=project.observations.flatMap((reading,index)=>reading.scenario===scenario&&reading.minute===minute&&allowed.has(reading.cellIndex)?[{index,reading:structuredClone(reading)}]:[]);
 const repeats=new Map(diagnostic.groups.filter(g=>g.scenario===scenario&&g.minute===minute&&allowed.has(g.cellIndex)).map(g=>[g.cellIndex,g]));
 const cells=Array.from({length:count},(_,cellIndex)=>{
  const readings=rows.filter(r=>r.reading.cellIndex===cellIndex),repeat=repeats.get(cellIndex);
  if(!allowed.has(cellIndex))return {cellIndex,status:'outside',readings:[]};
  if(!readings.length)return {cellIndex,status:'unmeasured',lowerMm:null,upperMm:null,readings};
  if(repeat&&repeat.status!=='overlap')return {cellIndex,status:'conflict',conflict:structuredClone(repeat),readings};
  const lowerMm=repeat?repeat.commonBandMm[0]:Math.max(0,readings[0].reading.depthMm-readings[0].reading.uncertaintyMm),upperMm=repeat?repeat.commonBandMm[1]:readings[0].reading.depthMm+readings[0].reading.uncertaintyMm;
  return {cellIndex,status:upperMm<=thresholdMm?'at-or-below':lowerMm>thresholdMm?'above':'straddling',lowerMm,upperMm,readings};
 });
 const base={query:{...question,scenario,minute,thresholdMm},cells,excludedReadings:project.observations.length-rows.length,usedReadingIndices:rows.map(r=>r.index)};
 if(cells.some(c=>c.status==='conflict'))return {...base,status:cells.some(c=>c.conflict?.status==='disjoint')?'conflicting-bands':'roundoff-contact',path:[],boundary:[]};
 const topology=minimumPondingConnection(Array(count).fill(0),project.width,project.height,question);
 if(!topology.connected)return {...base,status:'disconnected-footprint',path:[],boundary:[]};
 const certain=minimumPondingConnection(cells.map(c=>c.status==='at-or-below'?0:1),project.width,project.height,question);
 if(certain.bottleneckMm===0)return {...base,status:'band-supported',path:certain.path,boundary:[]};
 const possible=minimumPondingConnection(cells.map(c=>c.status==='above'?1:0),project.width,project.height,question);
 if(possible.bottleneckMm===0)return {...base,status:'unresolved',path:possible.path,unresolvedIndices:possible.path.filter(i=>['unmeasured','straddling'].includes(cells[i].status)),boundary:[]};
 const cut=pondingConnectionBoundary(cells.map(c=>c.status==='above'?1:0),project.width,project.height,question,0);
 return {...base,status:'band-excluded',path:[],...cut};
}

export const OBSERVED_CONNECTION_SCHEMA='experimental-earth-observed-connection/1';
export function exportObservedConnection(project,query){
 const report=inspectObservedConnectivity(project,query);
 const text=JSON.stringify({schema:OBSERVED_CONNECTION_SCHEMA,project,query:report.query},null,2);
 if(new TextEncoder().encode(text).length>4*1024*1024)throw Error('Investigation exceeds the 4 MiB transfer limit.');
 return text;
}
export function reopenObservedConnection(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>4*1024*1024)throw Error('Investigation exceeds the 4 MiB transfer limit.');
 const input=JSON.parse(text);
 if(input?.schema!==OBSERVED_CONNECTION_SCHEMA)throw Error('Unsupported observed-connection investigation.');
 return {project:input.project,report:inspectObservedConnectivity(input.project,input.query)};
}
