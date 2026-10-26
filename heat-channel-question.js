import {planHeatColumnQuestion, heatColumnQuestionGuard} from './heat-column-question.js';
import {evaluateHeatColumnTarget} from './heat-column.js';
import {validateProject} from './core.js';
export const HEAT_CHANNEL_SCHEMA='experimental-earth-heat-channel-question/2';
const LEGACY_SCHEMA='experimental-earth-heat-channel-question/1';
const SHARED='shared-surface-support',SEPARATE='separate-channels';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
function validateSettings(s){
 const fields=['fromMinute','toMinute','sampleCount','aggregation','averagingMinutes','surfaceHalfWidthC','lowerHalfWidthC','lowerAssociationSource'];
 if(!exact(s,fields)&&!exact(s,[...fields,'supportPolicy']))throw Error('Retain the complete original channel question settings');
 if(Object.hasOwn(s,'supportPolicy')&&![SHARED,SEPARATE].includes(s.supportPolicy))throw Error('Declare shared-surface-support or separate-channels support policy');
 for(const key of ['surfaceHalfWidthC','lowerHalfWidthC'])if(typeof s[key]!=='number'||!Number.isFinite(s[key])||s[key]<0||s[key]>100)throw Error('Declare each prospective half-width between 0 and 100 °C');
 if(typeof s.lowerAssociationSource!=='string'||!s.lowerAssociationSource.trim()||s.lowerAssociationSource.length>600)throw Error('Explain the lower sensor to lumped-store association in 1–600 characters');
}
/** Compare hypothetical channels, never interpret a lumped state as a depth. */
export function planHeatChannelQuestion(project,settings){
 validateSettings(settings);
 settings={...settings,supportPolicy:settings.supportPolicy??SHARED};
 const {surfaceHalfWidthC,lowerHalfWidthC,lowerAssociationSource,supportPolicy,...window}=settings;
 // The maintained surface planner owns calibration admission, original support
 // exclusion and window validation. Its challenge values never select labels.
 const baseline=planHeatColumnQuestion(project,{...window,halfWidthC:surfaceHalfWidthC});
 const context={settings:structuredClone(settings),labels:baseline.labels??[],target:baseline.target,cellIndex:baseline.cellIndex,associationSource:baseline.associationSource};
 if(!baseline.best&&(supportPolicy===SHARED||baseline.status!=='no-unrecorded-time'))return {...context,status:baseline.status,candidates:[]};
 const evidence=project.heatColumnEvidence,mean=window.aggregation==='interval-mean';
 const requested=Array.from({length:window.sampleCount},(_,i)=>i===window.sampleCount-1?window.toMinute:window.fromMinute+(window.toMinute-window.fromMinute)*i/(window.sampleCount-1));
 const surfaceTimes=requested.filter(t=>!evidence.readings.some(r=>{const start=mean?t-window.averagingMinutes:t,recordStart=r.aggregation==='interval-mean'?r.fromMinute:r.minute;return start<=r.minute&&t>=recordStart;}));
 // Original evidence contains surface readings only. A hypothetical lower
 // channel is distinct, so a surface support does not block it. This does not
 // assert sensor availability, obtain historical readings or imply independence.
 const times=supportPolicy===SEPARATE?requested:surfaceTimes,surfaceSet=new Set(surfaceTimes);
 const courses=evidence.hypotheses.filter(h=>baseline.labels.includes(h.label)).map(h=>{
  const study=structuredClone(evidence.columnStudy);Object.assign(study.lowerLayers[evidence.target],{capacityJm2K:h.capacityJm2K,conductanceWm2K:h.conductanceWm2K,source:h.source});
  const result=evaluateHeatColumnTarget(study,evidence.target,times,mean?times.map(minute=>({fromMinute:minute-window.averagingMinutes,minute})):[]);
  return {h,study,rows:new Map(result.trajectory.map(r=>[r.minute,r])),means:new Map(result.averages.map(r=>[r.minute,r]))};
 });
 const candidates=[];
 for(const channel of ['surface','lower'])for(const minute of times){
  if(channel==='surface'&&!surfaceSet.has(minute))continue;
  const halfWidthC=channel==='surface'?surfaceHalfWidthC:lowerHalfWidthC;
  const predictions=courses.map(({h,study,rows,means})=>{const original=rows.get(minute),average=means.get(minute),row=mean?{...original,surfaceC:average.surfaceMeanC,subsurfaceC:average.subsurfaceMeanC}:original;return {label:h.label,source:h.source,temperatureC:channel==='surface'?row.surfaceC:row.subsurfaceC,guardC:heatColumnQuestionGuard(study,evidence.target,row)};});
  const pairs=[];for(let a=0;a<predictions.length;a++)for(let b=a+1;b<predictions.length;b++){const x=predictions[a],y=predictions[b],gapC=Math.abs(x.temperatureC-y.temperatureC),guardC=x.guardC+y.guardC,marginC=gapC-guardC-2*halfWidthC;pairs.push({labels:[x.label,y.label],gapC,guardC,marginC,separated:gapC>2*halfWidthC+guardC});}
  candidates.push({channel,minute,fromMinute:mean?minute-window.averagingMinutes:minute,aggregation:window.aggregation,halfWidthC,predictions,pairs,separatedCount:pairs.filter(p=>p.separated).length,minimumMarginC:Math.min(...pairs.map(p=>p.marginC))});
 }
 const better=(a,b)=>!b||a.separatedCount>b.separatedCount||a.separatedCount===b.separatedCount&&(a.minimumMarginC>b.minimumMarginC||a.minimumMarginC===b.minimumMarginC&&(a.channel==='surface'&&b.channel==='lower'||a.channel===b.channel&&a.minute<b.minute));
 const bestByChannel={};let best=null;for(const c of candidates){if(better(c,best))best=c;if(better(c,bestByChannel[c.channel]))bestByChannel[c.channel]=c;}
 return {...context,status:best.separatedCount?'question':'no-separating-question',requestedCount:requested.length,excludedCount:requested.length-surfaceTimes.length,excludedByChannel:{surface:requested.length-surfaceTimes.length,lower:requested.length-times.length},inspectedCount:candidates.length,candidates,best,bestByChannel,semantics:'Support policy: '+supportPolicy+'. Finite-grid hypothetical channel comparison. Maximize separated offered-model pairs, then the weakest guarded gap minus twice that channel’s prospective half-width; exact ties prefer surface, then earlier time. Shared-surface-support excludes original surface supports for both channels; separate-channels excludes them only for surface. Overlap does not establish historical lower-data availability or independent errors. Lower means the declared lumped store, not an inferred sensor depth. No measurement, probability, information gain or physical sensor recommendation is created.'};
}
export function serializeHeatChannelQuestion(project,settings){validateProject(project);validateSettings(settings);const json=JSON.stringify({schema:HEAT_CHANNEL_SCHEMA,project,settings:{...settings,supportPolicy:settings.supportPolicy??SHARED}},null,2);if(new TextEncoder().encode(json).length>5*1024*1024)throw Error('Channel question exceeds 5 MiB');return json;}
export function parseHeatChannelQuestion(json){if(typeof json!=='string'||new TextEncoder().encode(json).length>5*1024*1024)throw Error('Channel question exceeds 5 MiB');const input=JSON.parse(json);if(!exact(input,['schema','project','settings'])||![HEAT_CHANNEL_SCHEMA,LEGACY_SCHEMA].includes(input.schema))throw Error('Retain only original channel question inputs');validateProject(input.project);validateSettings(input.settings);if(input.schema===LEGACY_SCHEMA&&Object.hasOwn(input.settings,'supportPolicy'))throw Error('Legacy question cannot declare a changed support policy');if(input.schema===HEAT_CHANNEL_SCHEMA&&!Object.hasOwn(input.settings,'supportPolicy'))throw Error('Version 2 question must declare its original support policy');return input;}
