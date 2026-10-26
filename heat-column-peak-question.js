import {validateHeatSearch,searchHeatColumnParameters,HEAT_SEARCH_METHOD} from './heat-column-search.js';
import {searchHeatColumnBands,HEAT_BAND_SEARCH_METHOD} from './heat-column-band-search.js';
import {evaluateHeatColumnTarget} from './heat-column.js';
import {heatColumnQuestionGuard} from './heat-column-question.js';
import {finitePeakQuestion} from './heat-column-peak-range.js';
export const HEAT_PEAK_QUESTION_METHOD='inferred-heat-peak-minimax/1';
const finite=(x,lo,hi)=>typeof x==='number'&&Number.isFinite(x)&&x>=lo&&x<=hi;
export function validateHeatPeakQuestion(project,query,settings){
 const {evidence,reservedWork:searchWork}=validateHeatSearch(project,query);
 const duration=evidence.columnStudy.heatStudy.schedule.reduce((sum,r)=>sum+r.minutes,0);
 const {fromMinute,toMinute,sampleCount,halfWidthC,aggregation='instant',averagingMinutes=0,searchMethod=HEAT_SEARCH_METHOD,acquisitionSource}=settings??{};
 if(![HEAT_SEARCH_METHOD,HEAT_BAND_SEARCH_METHOD].includes(searchMethod))throw Error('Select a maintained inferred-proposal search method');
 if(typeof acquisitionSource!=='string'||!acquisitionSource.trim()||acquisitionSource.length>600)throw Error('Describe the available acquisition window and prospective precision (at most 600 characters)');
 const mean=aggregation==='interval-mean';
 if(!['instant','interval-mean'].includes(aggregation)||!finite(averagingMinutes,0,duration)||(mean?averagingMinutes<=0:averagingMinutes!==0))throw Error('Declare an instantaneous reading or positive supported averaging duration');
 if(!finite(fromMinute,averagingMinutes,duration)||!finite(toMinute,fromMinute,duration)||fromMinute===toMinute||!Number.isInteger(sampleCount)||sampleCount<2||sampleCount>241||!finite(halfWidthC,0,100))throw Error('Declare a nonempty supported window, 2–241 times and a 0–100 °C prospective half-width');
 const phases=evidence.columnStudy.heatStudy.schedule.length;
 const reservedWork=searchWork+400*phases*(sampleCount*(mean?2:1)+phases*4+1);
 if(reservedWork>2_000_000)throw Error('Search plus complete prospective courses exceed the 2000000 course-sample budget');
 const requested=Array.from({length:sampleCount},(_,i)=>i===sampleCount-1?toMinute:fromMinute+(toMinute-fromMinute)*i/(sampleCount-1));
 if(new Set(requested).size!==requested.length)throw Error('Prospective times collapse at floating-point precision');
 const times=requested.filter(t=>!evidence.readings.some(r=>(mean?t-averagingMinutes:t)<=r.minute&&t>=(r.aggregation==='interval-mean'?r.fromMinute:r.minute)));
 return{evidence,settings:{fromMinute,toMinute,sampleCount,halfWidthC,aggregation,averagingMinutes,searchMethod,acquisitionSource},times,reservedWork};
}
export function planHeatPeakQuestion(project,query,input){
 const {evidence,settings,times,reservedWork}=validateHeatPeakQuestion(project,query,input);
 const report=(settings.searchMethod===HEAT_BAND_SEARCH_METHOD?searchHeatColumnBands:searchHeatColumnParameters)(project,query);
 const base={method:HEAT_PEAK_QUESTION_METHOD,settings,reservedWork,searchEvaluations:report.evaluations,compatibleCount:report.compatibleIds.length,requestedCount:settings.sampleCount,excludedCount:settings.sampleCount-times.length,inspectedCount:times.length,target:evidence.target,associationSource:evidence.associationSource,domainSource:query.source};
 if(report.status==='need-calibration')return{...base,status:'need-calibration'};
 const unique=new Map();for(const c of report.candidates)if(c.calibration.compatible===true)unique.set(JSON.stringify([c.hypothesis.capacityJm2K,c.hypothesis.conductanceWm2K]),c);
 const proposals=[...unique.values()];base.uniqueProposalCount=proposals.length;
 if(!proposals.length)return{...base,status:'no-compatible-proposals'};
 if(!times.length)return{...base,status:'no-unrecorded-time'};
 const mean=settings.aggregation==='interval-mean';
 const courses=proposals.map(c=>{
  const study=structuredClone(evidence.columnStudy);Object.assign(study.lowerLayers[evidence.target],{capacityJm2K:c.hypothesis.capacityJm2K,conductanceWm2K:c.hypothesis.conductanceWm2K,source:c.hypothesis.source});
  const windows=mean?times.map(minute=>({fromMinute:minute-settings.averagingMinutes,minute})):[];
  const course=evaluateHeatColumnTarget(study,evidence.target,times,windows);
  const averages=new Map(course.averages.map(r=>[r.minute,r]));
  if(mean&&averages.size!==times.length)throw Error('A qualified interval-mean operator is required');
  return{proposal:c,study,averages,rows:new Map(course.trajectory.map(r=>[r.minute,r]))};
 });
 const rows=times.map(minute=>{
  const predictions=courses.map(c=>{const point=c.rows.get(minute),average=c.averages.get(minute),row=mean?{...point,surfaceC:average.surfaceMeanC,subsurfaceC:average.subsurfaceMeanC}:point;
   const guardC=heatColumnQuestionGuard(c.study,evidence.target,row),radius=settings.halfWidthC+guardC;
   return{id:c.proposal.id,hypothesis:c.proposal.hypothesis,peakC:c.proposal.summary.subsurface.maximumC,predictionC:row.surfaceC,guardC,lowerC:row.surfaceC-radius,upperC:row.surfaceC+radius};
  });
  return{minute,...(mean?{fromMinute:minute-settings.averagingMinutes,aggregation:settings.aggregation}:{}),...finitePeakQuestion(predictions),predictions};
 });
 const best=rows.reduce((best,r)=>!best||r.worstRemainingC<best.worstRemainingC?r:best,null);
 return{...base,status:best.reductionC>0?'question':'no-peak-reduction',best,rows,
 semantics:'Minimizes worst conditional lower-store peak spread among the distinct sampled calibration-compatible proposals on the declared unrecorded-time grid; ties keep the earliest time. Prospective bands are assumed, not observed. Overlapping bands retain every possible extreme pair. Duplicate samples do not weight the objective. This is not a continuous-domain enclosure, probability, certified numerical bound or physical guarantee; an observation outside all proposal bands would challenge the finite set. Existing reading supports are excluded without using held-aside values. A proposed time is usable only in the acquisition window you declared.'};
}
export function serializeHeatPeakQuestion(project,query,settings){validateHeatPeakQuestion(project,query,settings);return JSON.stringify({method:HEAT_PEAK_QUESTION_METHOD,project,query,settings},null,2);}
export function parseHeatPeakQuestion(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>6*1024*1024)throw Error('Peak-question source exceeds 6 MiB');
 const source=JSON.parse(text);if(!source||source.method!==HEAT_PEAK_QUESTION_METHOD||Object.keys(source).sort().join(',')!=='method,project,query,settings')throw Error('Expected original peak-question inputs and method');
 validateHeatPeakQuestion(source.project,source.query,source.settings);return source;
}
