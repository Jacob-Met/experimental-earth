import {planHeatPeakQuestion,validateHeatPeakQuestion} from './heat-column-peak-question.js';
import {finitePeakQuestion} from './heat-column-peak-range.js';
export const HEAT_PEAK_ADAPTIVE_METHOD='inferred-heat-peak-adaptive/1';
const ownKeys=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>keys.includes(k));
const channel=r=>r.channel??'surface';
const support=r=>({channel:channel(r),minute:r.minute,...(r.fromMinute===undefined?{}:{fromMinute:r.fromMinute})});
function validateDeclaration(adaptive){if(!ownKeys(adaptive,['minimumDecisionMinutes','responseSource'])||!Number.isFinite(adaptive.minimumDecisionMinutes)||adaptive.minimumDecisionMinutes<0||adaptive.minimumDecisionMinutes>1e6||typeof adaptive.responseSource!=='string'||!adaptive.responseSource.trim()||adaptive.responseSource.length>600)throw Error('Declare a finite nonnegative decision delay and response availability source');}
function validateReading(reading){if(reading===undefined)return;if(!ownKeys(reading,['channel','minute','fromMinute','temperatureC','source'])||!['surface','lower'].includes(reading.channel)||!Number.isFinite(reading.minute)||!Number.isFinite(reading.temperatureC)||(Object.hasOwn(reading,'fromMinute')&&(!Number.isFinite(reading.fromMinute)||reading.fromMinute>=reading.minute))||typeof reading.source!=='string'||!reading.source.trim()||reading.source.length>600)throw Error('Retain the entered first value, exact support/channel and its source');}
export function finiteAdaptiveHeatPeak(rows,declaration){
 validateDeclaration(declaration);
 if(!Array.isArray(rows)||!rows.length||rows.length>482)throw Error('Retain a complete finite query grid');
 const N=rows[0].predictions?.length,reference=rows[0].predictions;if(!Number.isInteger(N)||N<1||N>800||new Set(reference.map(p=>p.id)).size!==N)throw Error('Retain 1–800 distinct models');
 for(const row of rows){if(!Number.isFinite(row.minute)||(row.fromMinute!==undefined&&(!Number.isFinite(row.fromMinute)||row.fromMinute>=row.minute))||!['surface','lower'].includes(channel(row))||!Array.isArray(row.predictions)||row.predictions.length!==N)throw Error('Retain complete supported query rows');for(let i=0;i<N;i++){const p=row.predictions[i];if(p.id!==reference[i].id||p.peakC!==reference[i].peakC||![p.peakC,p.lowerC,p.upperC].every(Number.isFinite)||p.lowerC>p.upperC)throw Error('Retain the same complete ordered model family and finite bands');}}
 const later=rows.map(a=>rows.flatMap((b,i)=>(b.fromMinute??b.minute)>a.minute&&(b.fromMinute??b.minute)-a.minute>=declaration.minimumDecisionMinutes?[i]:[]));
 const firstCount=later.filter(x=>x.length).length,orderedQueryPairs=later.reduce((n,x)=>n+x.length,0),maximumPolicyConditionalPlans=2*N*orderedQueryPairs,maximumBranchConditionalPlans=Math.max(0,...later.map(r=>r.length)),maximumConditionalPlans=maximumPolicyConditionalPlans+maximumBranchConditionalPlans,maximumPredictionVisits=2*N*N*(orderedQueryPairs+firstCount)+(firstCount?N*(1+maximumBranchConditionalPlans):0);
 if(maximumConditionalPlans>100000||maximumPredictionVisits>40000000)throw Error('Complete adaptive policy exceeds 100,000 conditional plans or 40,000,000 prediction visits; reduce the declared grid, never prune models');
 const work={modelCount:N,queryCount:rows.length,orderedQueryPairs,maximumPolicyConditionalPlans,maximumBranchConditionalPlans,maximumConditionalPlans,maximumPredictionVisits,conditionalPlans:0,branchConditionalPlans:0,predictionVisits:0,endpointStates:0,fixedPairSlots:orderedQueryPairs,maximumFixedPairUpdates:maximumPolicyConditionalPlans,fixedPairUpdates:0};
 const firstChoices=[],fixedPairs=[];
 for(let first=0;first<rows.length;first++){
  if(!later[first].length)continue;
  const endpoints=[...new Set(rows[first].predictions.flatMap(p=>[p.lowerC,p.upperC]))].sort((a,b)=>a-b),states=[],fixedRemaining=new Map(later[first].map(second=>[second,0]));let worstRemainingC=0;
  for(const observedC of endpoints){work.predictionVisits+=N;const active=rows[first].predictions.flatMap((p,i)=>p.lowerC<=observedC&&observedC<=p.upperC?[i]:[]);if(!active.length)continue;work.endpointStates++;let best=null;
   for(const second of later[first]){work.conditionalPlans++;work.predictionVisits+=active.length;const r=finitePeakQuestion(active.map(i=>rows[second].predictions[i]),800);fixedRemaining.set(second,Math.max(fixedRemaining.get(second),r.worstRemainingC));work.fixedPairUpdates++;if(!best||r.worstRemainingC<best.worstRemainingC)best={second,worstRemainingC:r.worstRemainingC};}
   worstRemainingC=Math.max(worstRemainingC,best.worstRemainingC);states.push({observedC,activeCount:active.length,...best});
  }
  firstChoices.push({first,worstRemainingC,states});for(const [second,worstRemainingC]of fixedRemaining)fixedPairs.push({first,second,worstRemainingC});
 }
 const best=firstChoices.reduce((a,b)=>!a||b.worstRemainingC<a.worstRemainingC?b:a,null);
 const bestFixed=fixedPairs.reduce((a,b)=>!a||b.worstRemainingC<a.worstRemainingC?b:a,null);
 return{work,firstChoices,best,later,fixedPairs,bestFixed};
}
export function planAdaptiveHeatPeak(project,query,settings,declaration,firstReading){
 validateDeclaration(declaration);validateReading(firstReading);const single=planHeatPeakQuestion(project,query,settings),result={method:HEAT_PEAK_ADAPTIVE_METHOD,status:single.status,settings:single.settings,declaration:{...declaration},single,best:null,branch:null};
 if(!single.rows?.length){if(firstReading)throw Error('No complete family is available for the entered first reading');return result;}
 const policy=finiteAdaptiveHeatPeak(single.rows,declaration);Object.assign(result,policy);
 if(!policy.best){if(firstReading)throw Error('No chronological first/second policy is available');result.status='no-later-query';return result;}
 result.status=policy.best.worstRemainingC<single.best.worstRemainingC?'adaptive-question':'no-additional-peak-reduction';result.firstSupport=support(single.rows[policy.best.first]);
 if(firstReading){const originalSupport={channel:firstReading.channel,minute:firstReading.minute,...(firstReading.fromMinute===undefined?{}:{fromMinute:firstReading.fromMinute})};if(JSON.stringify(originalSupport)!==JSON.stringify(result.firstSupport))throw Error('Entered reading support must match the first query chosen without that reading');const first=single.rows[policy.best.first];result.work.predictionVisits+=first.predictions.length;const active=first.predictions.flatMap((p,i)=>p.lowerC<=firstReading.temperatureC&&firstReading.temperatureC<=p.upperC?[i]:[]);let best=null;const rows=[];
  for(const second of active.length?policy.later[policy.best.first]:[]){result.work.conditionalPlans++;result.work.branchConditionalPlans++;result.work.predictionVisits+=active.length;const r={second,...finitePeakQuestion(active.map(i=>single.rows[second].predictions[i]),800)};rows.push(r);if(!best||r.worstRemainingC<best.worstRemainingC)best=r;}
  result.branch={status:active.length?(best.reductionC>0?'later-question':'no-later-reading-benefit'):'outside-finite-family',firstReading:{...firstReading},survivingModelIds:active.map(i=>first.predictions[i].id),rows,best};
 }
 return result;
}
export function serializeAdaptiveHeatPeak(project,query,settings,declaration,firstReading){validateHeatPeakQuestion(project,query,settings);validateDeclaration(declaration);validateReading(firstReading);return JSON.stringify({method:HEAT_PEAK_ADAPTIVE_METHOD,project,query,settings,declaration,...(firstReading===undefined?{}:{firstReading})},null,2);}
export function parseAdaptiveHeatPeak(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>6*1024*1024)throw Error('Original adaptive source exceeds 6 MiB');const v=JSON.parse(text);if(!ownKeys(v,['method','project','query','settings','declaration','firstReading'])||v.method!==HEAT_PEAK_ADAPTIVE_METHOD)throw Error('Expected original adaptive source only');validateHeatPeakQuestion(v.project,v.query,v.settings);validateDeclaration(v.declaration);validateReading(v.firstReading);return v;}
