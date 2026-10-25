import {comparePairedSeries} from './paired-series.js';
import {rational as q,sub,mul,div,cmp,enclosure,serial} from './vendor/chronos/exact-halfplanes.mjs';
export const TREND_SCHEMA='experimental-earth-paired-trends/1';
const bound=r=>({exact:serial(r),...enclosure(r)});
export function comparePairedTrends(input,{maxPairChecks=576}={}){
 if(!input||input.schema!==TREND_SCHEMA||Object.keys(input).sort().join(',')!=='basis,schema,series,slopes')throw Error('Supply original paired series, explicit slopes and basis');
 if(typeof input.basis!=='string'||!input.basis.trim()||input.basis.length>1000)throw Error('Declare the trend hypothesis basis (1–1000 characters)');
 const slopes=input.slopes;
 if(!Array.isArray(slopes)||slopes.length<2||slopes.length>9||!slopes.includes(0)||new Set(slopes).size!==slopes.length||slopes.some(s=>typeof s!=='number'||!Number.isFinite(s)||Math.abs(s)>1e12))throw Error('Offer2–9 unique finite slopes within±1e12, including zero');
 const series=comparePairedSeries(input.series).source,work=slopes.length*series.pairs.length;
 if(!Number.isSafeInteger(maxPairChecks)||maxPairChecks<1||maxPairChecks>576||work>maxPairChecks)throw Error('Complete family exceeds declared pair-check bound; no partial result');
 const pre=series.pairs.map((p,index)=>({...p,index})).filter(p=>p.role==='pre'),post=series.pairs.map((p,index)=>({...p,index})).filter(p=>p.role==='post');
 const originMs=Math.min(...pre.map(p=>Date.parse(p.time))),lastPreMs=Math.max(...pre.map(p=>Date.parse(p.time))),origin=new Date(originMs).toISOString().replace('.000Z','Z');
 const operands=series.pairs.map(p=>({elapsed:div(q(Date.parse(p.time)-originMs),q(86400000)),lower:sub(q(p.treated.lower),q(p.comparison.upper)),upper:sub(q(p.treated.upper),q(p.comparison.lower))}));
 const candidates=slopes.map(slope=>{
  const shifted=operands.map(p=>{const shift=mul(q(slope),p.elapsed);return {lower:sub(p.lower,shift),upper:sub(p.upper,shift)};});
  let lower=shifted[pre[0].index].lower,upper=shifted[pre[0].index].upper,lowerIndex=pre[0].index,upperIndex=pre[0].index;
  for(const p of pre){const v=shifted[p.index];if(cmp(v.lower,lower)>0){lower=v.lower;lowerIndex=p.index;}if(cmp(v.upper,upper)<0){upper=v.upper;upperIndex=p.index;}}
  const relation=cmp(lower,upper),status=relation>0?'incompatible':relation===0?'boundary':'compatible';
  return {slope,status,baseline:{lower:bound(lower),upper:bound(upper)},witnesses:{lower:lowerIndex,upper:upperIndex},pre:pre.map(p=>({index:p.index,shiftedGap:{lower:bound(shifted[p.index].lower),upper:bound(shifted[p.index].upper)}})),
   post:relation>0?[]:post.map(p=>{const lo=sub(shifted[p.index].lower,upper),hi=sub(shifted[p.index].upper,lower);return {index:p.index,time:p.time,extrapolationDays:bound(div(q(Date.parse(p.time)-lastPreMs),q(86400000))),contrast:{lower:bound(lo),upper:bound(hi)},direction:cmp(hi,q(0))<0?'negative':cmp(lo,q(0))>0?'positive':'includes-zero'};})};
 });
 return {source:structuredClone(input),origin,preTimeSupport:[origin,new Date(lastPreMs).toISOString().replace('.000Z','Z')],work:{pairChecks:work,maxPairChecks},candidates,compatibleSlopes:candidates.filter(c=>c.status!=='incompatible').map(c=>c.slope)};
}
