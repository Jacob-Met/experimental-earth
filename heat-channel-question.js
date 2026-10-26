import {planHeatColumnQuestion, heatColumnQuestionGuard} from './heat-column-question.js';
import {evaluateHeatColumnTarget} from './heat-column.js';
import {validateProject} from './core.js';
export const HEAT_CHANNEL_SCHEMA='experimental-earth-heat-channel-question/1';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
function validateSettings(s){
 if(!exact(s,['fromMinute','toMinute','sampleCount','aggregation','averagingMinutes','surfaceHalfWidthC','lowerHalfWidthC','lowerAssociationSource']))throw Error('Retain the complete original channel question settings');
 for(const key of ['surfaceHalfWidthC','lowerHalfWidthC'])if(typeof s[key]!=='number'||!Number.isFinite(s[key])||s[key]<0||s[key]>100)throw Error('Declare each prospective half-width between 0 and 100 °C');
 if(typeof s.lowerAssociationSource!=='string'||!s.lowerAssociationSource.trim()||s.lowerAssociationSource.length>600)throw Error('Explain the lower sensor to lumped-store association in 1–600 characters');
}
/** Compare hypothetical channels, never interpret a lumped state as a depth. */
export function planHeatChannelQuestion(project,settings){
 validateSettings(settings);
 const {surfaceHalfWidthC,lowerHalfWidthC,lowerAssociationSource,...window}=settings;
 // The maintained surface planner owns calibration admission, original support
 // exclusion and window validation. Its challenge values never select labels.
 const baseline=planHeatColumnQuestion(project,{...window,halfWidthC:surfaceHalfWidthC});
 const context={settings:structuredClone(settings),labels:baseline.labels??[],target:baseline.target,cellIndex:baseline.cellIndex,associationSource:baseline.associationSource};
 if(!baseline.best)return {...context,status:baseline.status,candidates:[]};
 const evidence=project.heatColumnEvidence,mean=window.aggregation==='interval-mean';
 const requested=Array.from({length:window.sampleCount},(_,i)=>i===window.sampleCount-1?window.toMinute:window.fromMinute+(window.toMinute-window.fromMinute)*i/(window.sampleCount-1));
 const times=requested.filter(t=>!evidence.readings.some(r=>{const start=mean?t-window.averagingMinutes:t,recordStart=r.aggregation==='interval-mean'?r.fromMinute:r.minute;return start<=r.minute&&t>=recordStart;}));
 const courses=evidence.hypotheses.filter(h=>baseline.labels.includes(h.label)).map(h=>{
  const study=structuredClone(evidence.columnStudy);Object.assign(study.lowerLayers[evidence.target],{capacityJm2K:h.capacityJm2K,conductanceWm2K:h.conductanceWm2K,source:h.source});
  const result=evaluateHeatColumnTarget(study,evidence.target,times,mean?times.map(minute=>({fromMinute:minute-window.averagingMinutes,minute})):[]);
  return {h,study,rows:new Map(result.trajectory.map(r=>[r.minute,r])),means:new Map(result.averages.map(r=>[r.minute,r]))};
 });
 const candidates=[];
 for(const channel of ['surface','lower'])for(const minute of times){
  const halfWidthC=channel==='surface'?surfaceHalfWidthC:lowerHalfWidthC;
  const predictions=courses.map(({h,study,rows,means})=>{const original=rows.get(minute),average=means.get(minute),row=mean?{...original,surfaceC:average.surfaceMeanC,subsurfaceC:average.subsurfaceMeanC}:original;return {label:h.label,source:h.source,temperatureC:channel==='surface'?row.surfaceC:row.subsurfaceC,guardC:heatColumnQuestionGuard(study,evidence.target,row)};});
  const pairs=[];for(let a=0;a<predictions.length;a++)for(let b=a+1;b<predictions.length;b++){const x=predictions[a],y=predictions[b],gapC=Math.abs(x.temperatureC-y.temperatureC),guardC=x.guardC+y.guardC,marginC=gapC-guardC-2*halfWidthC;pairs.push({labels:[x.label,y.label],gapC,guardC,marginC,separated:gapC>2*halfWidthC+guardC});}
  candidates.push({channel,minute,fromMinute:mean?minute-window.averagingMinutes:minute,aggregation:window.aggregation,halfWidthC,predictions,pairs,separatedCount:pairs.filter(p=>p.separated).length,minimumMarginC:Math.min(...pairs.map(p=>p.marginC))});
 }
 const better=(a,b)=>!b||a.separatedCount>b.separatedCount||a.separatedCount===b.separatedCount&&(a.minimumMarginC>b.minimumMarginC||a.minimumMarginC===b.minimumMarginC&&(a.channel==='surface'&&b.channel==='lower'||a.channel===b.channel&&a.minute<b.minute));
 const bestByChannel={};let best=null;for(const c of candidates){if(better(c,best))best=c;if(better(c,bestByChannel[c.channel]))bestByChannel[c.channel]=c;}
 return {...context,status:best.separatedCount?'question':'no-separating-question',requestedCount:requested.length,excludedCount:requested.length-times.length,inspectedCount:candidates.length,candidates,best,bestByChannel,semantics:'Finite-grid hypothetical channel comparison. Maximize separated offered-model pairs, then the weakest guarded gap minus twice that channel’s prospective half-width; exact ties prefer surface, then earlier time. Both channels conservatively exclude every original surface-reading support. Lower means the declared lumped store, not an inferred sensor depth. No measurement, probability, information gain or physical sensor recommendation is created.'};
}
export function serializeHeatChannelQuestion(project,settings){validateProject(project);validateSettings(settings);const json=JSON.stringify({schema:HEAT_CHANNEL_SCHEMA,project,settings},null,2);if(new TextEncoder().encode(json).length>5*1024*1024)throw Error('Channel question exceeds 5 MiB');return json;}
export function parseHeatChannelQuestion(json){if(typeof json!=='string'||new TextEncoder().encode(json).length>5*1024*1024)throw Error('Channel question exceeds 5 MiB');const input=JSON.parse(json);if(!exact(input,['schema','project','settings'])||input.schema!==HEAT_CHANNEL_SCHEMA)throw Error('Retain only original channel question inputs');validateProject(input.project);validateSettings(input.settings);return input;}
