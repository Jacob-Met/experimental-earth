import {comparePairedSeries} from './paired-series.js';
import {rational as q,add,sub,mul,div,neg,cmp,enclosure,serial,clip,unique} from './vendor/chronos/exact-halfplanes.mjs';

export const TREND_REGION_SCHEMA='experimental-earth-paired-trend-region/1';
const bound=x=>({exact:serial(x),...enclosure(x)});
const extrema=values=>values.reduce((r,v)=>({lower:cmp(v,r.lower)<0?v:r.lower,upper:cmp(v,r.upper)>0?v:r.upper}),{lower:values[0],upper:values[0]});

/** Entire linear prehistory support; later values never constrain this region. */
export function inferPairedTrendRegion(input,{maxPairChecks=1953,maxConstraintChecks=200000}={}){
 if(!input||input.schema!==TREND_REGION_SCHEMA||Object.keys(input).sort().join(',')!=='basis,schema,series')throw Error('Supply original paired series and a linear-continuation basis');
 if(typeof input.basis!=='string'||!input.basis.trim()||input.basis.length>1000)throw Error('Declare the linear-continuation basis (1–1000 characters)');
 const series=comparePairedSeries(input.series).source;
 const pre=series.pairs.map((p,index)=>({...p,index})).filter(p=>p.role==='pre').sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 const post=series.pairs.map((p,index)=>({...p,index})).filter(p=>p.role==='post');
 const pairChecks=pre.length*(pre.length-1)/2;
 if(!Number.isSafeInteger(maxPairChecks)||maxPairChecks<1||maxPairChecks>1953||pairChecks>maxPairChecks)throw Error('Complete earlier-pair work exceeds the declared bound; no partial result');
 if(!Number.isSafeInteger(maxConstraintChecks)||maxConstraintChecks<1||maxConstraintChecks>200000)throw Error('Declare bounded constraint work');
 const originMs=Date.parse(pre[0].time),lastMs=Date.parse(pre.at(-1).time);
 const operands=series.pairs.map(p=>({time:div(sub(q(Date.parse(p.time)),q(originMs)),q(86400000)),lower:sub(q(p.treated.lower),q(p.comparison.upper)),upper:sub(q(p.treated.upper),q(p.comparison.lower))}));
 let slopeLower=null,slopeUpper=null,lowerWitness=null,upperWitness=null;
 for(let i=0;i<pre.length;i++)for(let j=i+1;j<pre.length;j++){
  const a=operands[pre[i].index],b=operands[pre[j].index],dt=sub(b.time,a.time);
  const lower=div(sub(b.lower,a.upper),dt),upper=div(sub(b.upper,a.lower),dt);
  if(slopeLower===null||cmp(lower,slopeLower)>0){slopeLower=lower;lowerWitness=[pre[i].index,pre[j].index];}
  if(slopeUpper===null||cmp(upper,slopeUpper)<0){slopeUpper=upper;upperWitness=[pre[i].index,pre[j].index];}
 }
 const common={source:structuredClone(input),origin:pre[0].time,preTimeSupport:[pre[0].time,pre.at(-1).time],slope:{lower:bound(slopeLower),upper:bound(slopeUpper)},witnesses:{lower:lowerWitness,upper:upperWitness},work:{pairChecks,maxPairChecks,constraintChecks:0,maxConstraintChecks}};
 if(cmp(slopeLower,slopeUpper)>0)return {...common,status:'incompatible',vertices:[],post:[]};
 // At fixed slope the original baseline bands have a common point iff every
 // pair overlaps. Pair inequalities therefore give exact finite slope bounds.
 // The earliest band is an exact baseline bound: no invented box is needed.
 const first=operands[pre[0].index];
 let polygon=unique([[first.lower,slopeLower],[first.upper,slopeLower],[first.upper,slopeUpper],[first.lower,slopeUpper]]);
 const work={count:0,limit:maxConstraintChecks};
 for(const p of pre){const v=operands[p.index];polygon=clip(polygon,q(1),v.time,v.upper,work);polygon=clip(polygon,q(-1),neg(v.time),neg(v.lower),work);}
 if(!polygon.length)throw Error('Internal contradiction between exact pair and region support');
 const baseline=extrema(polygon.map(p=>p[0]));
 return {...common,status:polygon.length<3?'boundary':'compatible',baseline:{lower:bound(baseline.lower),upper:bound(baseline.upper)},vertices:polygon.map(p=>({baseline:bound(p[0]),slope:bound(p[1])})),work:{...common.work,constraintChecks:work.count},post:post.map(p=>{
  const v=operands[p.index],predicted=extrema(polygon.map(point=>add(point[0],mul(point[1],v.time))));
  const lower=sub(v.lower,predicted.upper),upper=sub(v.upper,predicted.lower);
  return {index:p.index,time:p.time,extrapolationDays:bound(div(sub(q(Date.parse(p.time)),q(lastMs)),q(86400000))),predictedGap:{lower:bound(predicted.lower),upper:bound(predicted.upper)},contrast:{lower:bound(lower),upper:bound(upper)},direction:cmp(upper,q(0))<0?'negative':cmp(lower,q(0))>0?'positive':'includes-zero'};
 })};
}
