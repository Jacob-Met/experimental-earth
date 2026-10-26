/** Original interval means compared to an explicitly declared uniform-time affine operator. */
import {rational as q,add,sub,mul,div,neg,cmp,clip,unique,serial,enclosure} from './vendor/chronos/exact-halfplanes.mjs';
import {projectAffineHistoryResponse} from './paired-trend-response.js';
import {projectContinuousTrendOnset} from './paired-trend-onset.js';
export const PAIRED_MEAN_SCHEMA='experimental-earth-paired-mean-history/1';
const bound=x=>({exact:serial(x),...enclosure(x)});
const span=values=>{let lo=values[0],hi=lo;for(const v of values){if(cmp(v,lo)<0)lo=v;if(cmp(v,hi)>0)hi=v;}return{lower:bound(lo),upper:bound(hi)};};
const exactKeys=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===[...keys].sort().join(',');
const text=(x,name)=>{if(typeof x!=='string'||!x.trim()||x.length>1000)throw Error('Declare '+name+' in 1–1000 characters');};
function timestamp(x){if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(x)||!Number.isFinite(Date.parse(x))||new Date(x).toISOString().replace('.000Z','Z')!==x)throw Error('Retain exact canonical UTC support boundaries');return Date.parse(x);}
export function validatePairedMeanHistory(x){return validateOriginalMeanHistory(x,{partitioned:true});}
/** Shared original-record admission; unpartitioned records never acquire authored roles. */
export function validateOriginalMeanHistory(x,{partitioned=true}={}){
 if(!exactKeys(x,['schema','quantity','unit','treatedPlace','comparisonPlace','association','comparisonOperator','pairs',...(partitioned?['boundary','boundaryBasis']:['modelBasis'])])||x.schema!==(partitioned?PAIRED_MEAN_SCHEMA:'experimental-earth-unpartitioned-means/1'))throw Error('Supply an original paired interval-mean history');
 for(const key of ['quantity','unit','treatedPlace','comparisonPlace','association',partitioned?'boundaryBasis':'modelBasis'])text(x[key],key);
 if(x.treatedPlace.trim()===x.comparisonPlace.trim())throw Error('Declare distinct source places or channels');
 const phase=partitioned?timestamp(x.boundary):null;
 if(!exactKeys(x.comparisonOperator,['kind','basis'])||x.comparisonOperator.kind!=='uniform-time-mean')throw Error('Explicitly declare the uniform-time mean comparison operator; source weighting is not inferred');
 text(x.comparisonOperator.basis,'uniform-time comparison assumption');
 if(!Array.isArray(x.pairs)||x.pairs.length>64)throw Error('Retain at most 64 original mean pairs');
 let pre=0,post=0;const seen=new Set();
 for(const p of x.pairs){
  if(!exactKeys(p,[...(partitioned?['role']:[]),'treated','comparison'])||(partitioned&&!['pre','post'].includes(p.role)))throw Error('Retain each original mean pair and its declared phase');
  for(const name of ['treated','comparison']){
   const r=p[name];
   if(!exactKeys(r,['from','to','value','halfWidth','bandSource','source','sourceAggregation','unit','place']))throw Error('Retain the original mean value, full support, band and aggregation source');
   const start=timestamp(r.from),end=timestamp(r.to);if(start>=end)throw Error('Original mean windows need positive duration');
   if(partitioned&&(p.role==='pre'?end>phase:start<phase))throw Error('Every complete mean window must lie on its declared side of the phase boundary');
   if(!Number.isFinite(r.value)||Math.abs(r.value)>1e12||!Number.isFinite(r.halfWidth)||r.halfWidth<0||r.halfWidth>1e12)throw Error('Declare finite original means and nonnegative comparison half-widths');
   if(r.unit!==x.unit||r.place!==x[name+'Place'])throw Error('Retain matching original units and declared channel association');
   text(r.bandSource,'comparison band source');text(r.source,'original mean source');
   if(!exactKeys(r.sourceAggregation,['kind','weighting','basis'])||r.sourceAggregation.kind!=='reported-interval-mean'||!['unknown','uniform-time'].includes(r.sourceAggregation.weighting))throw Error('Retain reported aggregation separately from the comparison operator');
   text(r.sourceAggregation.basis,'original aggregation basis');
  }
  if(p.treated.from!==p.comparison.from||p.treated.to!==p.comparison.to)throw Error('Paired mean windows must match exactly; no temporal interpolation or weighting equivalence is inferred');
  const key=p.treated.from+'/'+p.treated.to;if(seen.has(key))throw Error('Original mean windows must be distinct');seen.add(key);
  if(p.role==='pre')pre++;else post++;
 }
 if(partitioned&&(pre<2||post<1))throw Error('Retain at least two earlier mean pairs and one later pair');
 if(!partitioned&&x.pairs.length<2)throw Error('Retain at least two original mean pairs');
 return x;
}
export function inferMeanPeriodConstraints(pairs,role,clipWork){
 const selected=pairs.map((p,index)=>({...p,index})).filter(p=>p.role===role),start=Math.min(...selected.map(p=>Date.parse(p.treated.from))),end=Math.max(...selected.map(p=>Date.parse(p.treated.to)));
 const origin=new Date(start).toISOString().replace('.000Z','Z');
 const rows=selected.map(p=>{
  const r=p.treated,c=p.comparison;
  // This coefficient is an exact first moment of the DECLARED model operator.
  // It never replaces the original support with a point observation.
  const t=div(sub(div(add(q(Date.parse(r.from)),q(Date.parse(r.to))),q(2)),q(start)),q(86400000));
  return{index:p.index,t,lo:sub(sub(q(r.value),q(r.halfWidth)),add(q(c.value),q(c.halfWidth))),hi:sub(add(q(r.value),q(r.halfWidth)),sub(q(c.value),q(c.halfWidth))),from:r.from,to:r.to};
 }).sort((a,b)=>cmp(a.t,b.t));
 const timeSupport=[origin,new Date(end).toISOString().replace('.000Z','Z')];
 const common={origin,timeSupport,...(role==='pre'?{preTimeSupport:timeSupport}:{}),sourceIndices:selected.map(p=>p.index),vertices:[],observations:rows.map(r=>({index:r.index,support:{from:r.from,to:r.to},comparisonOperator:'uniform-time-mean',meanTimeCoefficientDays:bound(r.t),gapBand:{lower:bound(r.lo),upper:bound(r.hi)}}))};
 let sl=null,su=null,lowerWitness=null,upperWitness=null,sameCoefficientConflict=null;
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  const a=rows[i],b=rows[j],dt=sub(b.t,a.t);
  if(cmp(dt,q(0))===0){if(cmp(a.lo,b.hi)>0||cmp(b.lo,a.hi)>0)sameCoefficientConflict=[a.index,b.index];continue;}
  const lo=div(sub(b.lo,a.hi),dt),hi=div(sub(b.hi,a.lo),dt);
  if(sl===null||cmp(lo,sl)>0){sl=lo;lowerWitness=[a.index,b.index];}
  if(su===null||cmp(hi,su)<0){su=hi;upperWitness=[a.index,b.index];}
 }
 if(sameCoefficientConflict)return{...common,status:'incompatible',sameCoefficientConflict};
 if(sl===null)return{...common,status:'insufficient-distinct-mean-coefficients'};
 const metadata={slope:{lower:bound(sl),upper:bound(su)},witnesses:{lower:lowerWitness,upper:upperWitness}};
 if(cmp(sl,su)>0)return{...common,...metadata,status:'incompatible'};
 const first=rows[0],low=[sl,su].map(b=>sub(first.lo,mul(b,first.t))),high=[sl,su].map(b=>sub(first.hi,mul(b,first.t)));
 const al=cmp(low[0],low[1])<0?low[0]:low[1],au=cmp(high[0],high[1])>0?high[0]:high[1];
 let polygon=unique([[al,sl],[au,sl],[au,su],[al,su]]);
 for(const r of rows){polygon=clip(polygon,q(1),r.t,r.hi,clipWork);polygon=clip(polygon,q(-1),neg(r.t),neg(r.lo),clipWork);}
 if(!polygon.length)throw Error('Exact mean constraints contradict their pair support');
 return{...common,...metadata,status:polygon.length<3?'boundary':'compatible',baseline:span(polygon.map(p=>p[0])),vertices:polygon.map(p=>({baseline:bound(p[0]),slope:bound(p[1])}))};
}
export function inferPairedMeanHistory(input,{maxPairChecks=1953,maxConstraintChecks=200000,maxVertexPairs=4096,maxHullChecks=131072,maxRootEvaluations=512}={}){
 validatePairedMeanHistory(input);const source=structuredClone(input);
 for(const[name,n,max]of[['pairs',maxPairChecks,1953],['constraints',maxConstraintChecks,200000],['vertex pairs',maxVertexPairs,4096],['hull checks',maxHullChecks,131072],['onset roots',maxRootEvaluations,512]])if(!Number.isSafeInteger(n)||n<1||n>max)throw Error('Declare bounded complete '+name+' work');
 const pre=source.pairs.filter(p=>p.role==='pre').length,post=source.pairs.length-pre,pairChecks=pre*(pre-1)/2+post*(post-1)/2;
 if(pairChecks>maxPairChecks)throw Error('Complete original mean-pair work exceeds declared bound');
 const work={pairChecks,maxPairChecks,constraintChecks:0,maxConstraintChecks,vertexPairs:0,maxVertexPairs,hullChecks:0,maxHullChecks},clipWork={count:0,limit:maxConstraintChecks};
 const earlier=inferMeanPeriodConstraints(source.pairs,'pre',clipWork),common={source,earlier,later:null,intervention:source.boundary,vertices:[],jump:null,slopeChange:null,zeroSlopeChange:null,onset:null,operatorQualification:'Uniform-time means are an explicit model comparison. Unknown original sample weights remain unknown; matched windows do not establish matched weighting or statistical independence.'};
 work.constraintChecks=clipWork.count;
 if(!earlier.vertices.length)return{...common,status:earlier.status==='incompatible'?'earlier-incompatible':'earlier-operator-unbounded',work};
 const later=inferMeanPeriodConstraints(source.pairs,'post',clipWork);work.constraintChecks=clipWork.count;
 if(!later.vertices.length)return{...common,later,status:later.status==='incompatible'?'later-incompatible':'insufficient-later-operator-support',work};
 const response={...common,later,...projectAffineHistoryResponse(earlier,later,source.boundary,work,clipWork)};
 const{response:omitted,...onset}=projectContinuousTrendOnset(response,{maxRootEvaluations});
 return{...response,onset};
}
