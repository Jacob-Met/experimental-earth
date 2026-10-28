import { parseShadeHeatSampling } from './shade-heat-sampling.js';
import { checkShadeHeatBytes } from './shade-heat.js';
export const WINDOW_KIND='experimental-earth/sampled-cooling-window/1';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function normalizeCoolingWindow(q){
 if(!exact(q,['fromMinute','toMinute','thresholdC','store'])||!Number.isInteger(q.fromMinute)||!Number.isInteger(q.toMinute)||q.fromMinute<0||q.toMinute>1440||q.fromMinute>q.toMinute||!Number.isFinite(q.thresholdC)||Math.abs(q.thresholdC)>1000||!['surfaceC','subsurfaceC'].includes(q.store))throw Error('Declare an ordered integer-minute window in 0..1440, a finite cooling threshold in −1000..1000°C and a heat store');
 return {...q};
}
export function checkCoolingWindow(report,input){
 const query=normalizeCoolingWindow(input),count=query.toMinute-query.fromMinute+1;
 if(report.courses?.length!==3||new Set(report.courses.map(c=>c.solarStepMinutes)).size!==3||report.courses.some(c=>![60,30,15].includes(c.solarStepMinutes)))throw Error('Three complete solar grids are required');
 const courses=report.courses.map(course=>{
  const get=target=>['lower','upper'].map(bound=>{
   const points=new Map();
   for(const row of course.targets[target][bound].trajectory){
    if(!Number.isFinite(row.minute))throw Error('Finite sample times are required');
    if(!Number.isInteger(row.minute)||row.minute<query.fromMinute||row.minute>query.toMinute)continue;
    if(points.has(row.minute)||!Number.isFinite(row[query.store]))throw Error('Unique finite window samples are required');
    points.set(row.minute,row[query.store]);
   }
   if(points.size!==count)throw Error('The complete declared window must be present');
   return points;
  });
  const e=get('existing'),p=get('proposal'),samples=[];
  for(let minute=query.fromMinute;minute<=query.toMinute;minute++){
   const lowerC=e[0].get(minute)-p[1].get(minute),upperC=e[1].get(minute)-p[0].get(minute);
   if(!Number.isFinite(lowerC)||!Number.isFinite(upperC)||lowerC>upperC)throw Error('Ordered finite cooling bounds are required');
   samples.push({minute,lowerC,upperC,state:lowerC>=query.thresholdC?'supported':upperC<query.thresholdC?'failed':'ambiguous'});
  }
  const firstFailure=samples.find(s=>s.state==='failed')??null,firstAmbiguous=samples.find(s=>s.state==='ambiguous')??null;
  return {solarStepMinutes:course.solarStepMinutes,state:firstFailure?'failed':firstAmbiguous?'ambiguous':'supported',firstFailure,firstAmbiguous,samples,
   counts:Object.fromEntries(['supported','failed','ambiguous'].map(s=>[s,samples.filter(x=>x.state===s).length]))};
 });
 return {query,sampleCount:count,courses};
}
export function serializeCoolingWindow(investigation,query){
 const text=JSON.stringify({kind:WINDOW_KIND,sampling:investigation,query:normalizeCoolingWindow(query)},null,2);checkShadeHeatBytes(new Blob([text]).size);return text;
}
export function parseCoolingWindow(text){
 if(typeof text!=='string')throw Error('Window inputs must be JSON text');checkShadeHeatBytes(new Blob([text]).size);
 const v=JSON.parse(text);if(!exact(v,['kind','sampling','query'])||v.kind!==WINDOW_KIND)throw Error('Original sampling inputs and query only are accepted');
 const query=normalizeCoolingWindow(v.query),accepted=parseShadeHeatSampling(JSON.stringify(v.sampling));
 return {accepted,query,report:checkCoolingWindow(accepted.report,query)};
}
