/** Exact projection of a shared linear history plus one constant later gap shift. */
import {inferPairedTrendRegion} from './paired-trend-region.js';
import {rational as q,sub,mul,div,neg,cmp,clip,unique,serial,enclosure} from './vendor/chronos/exact-halfplanes.mjs';
const unpack=b=>[BigInt(b.exact.numerator),BigInt(b.exact.denominator)];
const bound=x=>({exact:serial(x),...enclosure(x)});
export const TREND_SHIFT_SCHEMA='experimental-earth-paired-trend-shift/1';
export function inferPairedTrendShift(source,{maxPairChecks=1953,maxCrossPairs=1024,maxConstraintChecks=200000}={}){
 if(!source||source.schema!==TREND_SHIFT_SCHEMA||source.model!=='constant-later-gap-shift'||Object.keys(source).sort().join(',')!=='inquiry,model,schema')throw Error('Select the constant later gap-shift model with original region inputs');
 if(!Number.isSafeInteger(maxCrossPairs)||maxCrossPairs<1||maxCrossPairs>1024)throw Error('Declare a bounded complete cross-period comparison');
 const input=source.inquiry,earlier=inferPairedTrendRegion(input,{maxPairChecks,maxConstraintChecks});
 const original=structuredClone(source);
 if(earlier.status==='incompatible')return {source:original,earlier,status:'earlier-incompatible',vertices:[],shift:null};
 const origin=q(Date.parse(earlier.origin));
 const rows=input.series.pairs.map((p,index)=>({index,role:p.role,t:div(sub(q(Date.parse(p.time)),origin),q(86400000)),lo:sub(q(p.treated.lower),q(p.comparison.upper)),hi:sub(q(p.treated.upper),q(p.comparison.lower))}));
 const pre=rows.filter(p=>p.role==='pre'),post=rows.filter(p=>p.role==='post').sort((a,b)=>cmp(a.t,b.t));
 const withinPeriodPairs=earlier.work.pairChecks+post.length*(post.length-1)/2,crossPairsPlanned=pre.length*post.length;
 if(withinPeriodPairs>maxPairChecks||crossPairsPlanned>maxCrossPairs)throw Error('Complete original comparison exceeds declared work; no partial shift support');
 const usage={withinPeriodPairs,maxPairChecks,crossPairsPlanned,crossPairsEvaluated:0,maxCrossPairs,constraintChecks:earlier.work.constraintChecks,maxConstraintChecks};
 let bl=unpack(earlier.slope.lower),bu=unpack(earlier.slope.upper);
 for(let i=0;i<post.length;i++)for(let j=i+1;j<post.length;j++){
  const dt=sub(post[j].t,post[i].t),lo=div(sub(post[j].lo,post[i].hi),dt),hi=div(sub(post[j].hi,post[i].lo),dt);
  if(cmp(lo,bl)>0)bl=lo;if(cmp(hi,bu)<0)bu=hi;
 }
 if(cmp(bl,bu)>0)return {source:original,earlier,status:'shift-incompatible',vertices:[],shift:null,work:usage};
 const a=pre[0],z=post[0],dt=sub(z.t,a.t);
 const lowers=[bl,bu].map(b=>sub(sub(z.lo,a.hi),mul(b,dt))),uppers=[bl,bu].map(b=>sub(sub(z.hi,a.lo),mul(b,dt)));
 let dl=cmp(lowers[0],lowers[1])<0?lowers[0]:lowers[1],du=cmp(uppers[0],uppers[1])>0?uppers[0]:uppers[1];
 let polygon=unique([[bl,dl],[bu,dl],[bu,du],[bl,du]]);const work={count:earlier.work.constraintChecks,limit:maxConstraintChecks};
 for(const p of pre)for(const r of post){usage.crossPairsEvaluated++;const dt=sub(r.t,p.t);polygon=clip(polygon,dt,q(1),sub(r.hi,p.lo),work);polygon=clip(polygon,neg(dt),q(-1),neg(sub(r.lo,p.hi)),work);}
 usage.constraintChecks=work.count;
 if(!polygon.length)return {source:original,earlier,status:'shift-incompatible',vertices:[],shift:null,work:usage};
 dl=polygon[0][1];du=polygon[0][1];for(const p of polygon){if(cmp(p[1],dl)<0)dl=p[1];if(cmp(p[1],du)>0)du=p[1];}
 return {source:original,earlier,status:'shift-compatible',work:usage,direction:cmp(du,q(0))<0?'negative':cmp(dl,q(0))>0?'positive':'includes-zero',shift:{lower:bound(dl),upper:bound(du)},vertices:polygon.map(p=>({slope:bound(p[0]),shift:bound(p[1])}))};
}
