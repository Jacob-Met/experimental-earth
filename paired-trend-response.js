/** Joint descriptive jump and slope change between two original affine histories. */
import {inferPairedTrendRegion} from './paired-trend-region.js';
import {rational as q,add,sub,mul,div,neg,cmp,clip,unique,serial,enclosure} from './vendor/chronos/exact-halfplanes.mjs';
export const TREND_RESPONSE_SCHEMA='experimental-earth-paired-trend-response/1';
const unpack=x=>[BigInt(x.exact.numerator),BigInt(x.exact.denominator)];
const bound=x=>({exact:serial(x),...enclosure(x)});
const span=values=>{let lo=values[0],hi=lo;for(const v of values){if(cmp(v,lo)<0)lo=v;if(cmp(v,hi)>0)hi=v;}return{lower:bound(lo),upper:bound(hi)};};
function hull(points,work){
 const charge=()=>{if(++work.hullChecks>work.maxHullChecks)throw Error('Complete joint response exceeds declared hull work; no partial response');};
 const sorted=unique([...points].sort((a,b)=>{charge();return cmp(a[0],b[0])||cmp(a[1],b[1]);}));
 if(sorted.length<3)return sorted;
 const turn=(o,a,b)=>{charge();return cmp(sub(mul(sub(a[0],o[0]),sub(b[1],o[1])),mul(sub(a[1],o[1]),sub(b[0],o[0]))),q(0));};
 const half=ps=>{const h=[];for(const p of ps){while(h.length>1&&turn(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}return h;};
 return [...half(sorted).slice(0,-1),...half([...sorted].reverse()).slice(0,-1)];
}
export function inferPairedTrendResponse(source,{maxPairChecks=1953,maxConstraintChecks=200000,maxVertexPairs=4096,maxHullChecks=131072}={}){
 if(!source||source.schema!==TREND_RESPONSE_SCHEMA||source.model!=='separate-linear-periods'||Object.keys(source).sort().join(',')!=='inquiry,model,schema')throw Error('Select the separate earlier and later linear-history model with original inputs');
 for(const [name,value,max]of [['vertex pairs',maxVertexPairs,4096],['hull checks',maxHullChecks,131072]])if(!Number.isSafeInteger(value)||value<1||value>max)throw Error('Declare bounded '+name+' work');
 const earlier=inferPairedTrendRegion(source.inquiry,{maxPairChecks,maxConstraintChecks}),original=structuredClone(source);
 const common={source:original,earlier,intervention:source.inquiry.series.intervention,later:null,vertices:[],jump:null,slopeChange:null,zeroSlopeChange:null};
 if(earlier.status==='incompatible')return{...common,status:'earlier-incompatible'};
 const rows=source.inquiry.series.pairs.map((p,index)=>({...p,index})).filter(p=>p.role==='post').sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 if(rows.length<2)return{...common,status:'insufficient-later-history'};
 const pairChecks=earlier.work.pairChecks+rows.length*(rows.length-1)/2;
 if(pairChecks>maxPairChecks)throw Error('Complete period-pair work exceeds declared bound; no partial response');
 const originMs=Date.parse(rows[0].time),origin=q(originMs);
 const operands=rows.map(p=>({index:p.index,t:div(sub(q(Date.parse(p.time)),origin),q(86400000)),lo:sub(q(p.treated.lower),q(p.comparison.upper)),hi:sub(q(p.treated.upper),q(p.comparison.lower))}));
 let sl=null,su=null,lowerWitness=null,upperWitness=null;
 for(let i=0;i<operands.length;i++)for(let j=i+1;j<operands.length;j++){
  const a=operands[i],b=operands[j],dt=sub(b.t,a.t),lo=div(sub(b.lo,a.hi),dt),hi=div(sub(b.hi,a.lo),dt);
  if(sl===null||cmp(lo,sl)>0){sl=lo;lowerWitness=[a.index,b.index];}
  if(su===null||cmp(hi,su)<0){su=hi;upperWitness=[a.index,b.index];}
 }
 const work={pairChecks,maxPairChecks,constraintChecks:earlier.work.constraintChecks,maxConstraintChecks,vertexPairs:0,maxVertexPairs,hullChecks:0,maxHullChecks};
 const later={origin:rows[0].time,timeSupport:[rows[0].time,rows.at(-1).time],sourceIndices:rows.map(p=>p.index),slope:{lower:bound(sl),upper:bound(su)},witnesses:{lower:lowerWitness,upper:upperWitness},vertices:[]};
 if(cmp(sl,su)>0)return{...common,later:{...later,status:'incompatible'},status:'later-incompatible',work};
 const first=operands[0];let polygon=unique([[first.lo,sl],[first.hi,sl],[first.hi,su],[first.lo,su]]);
 const clipWork={count:earlier.work.constraintChecks,limit:maxConstraintChecks};
 for(const r of operands){polygon=clip(polygon,q(1),r.t,r.hi,clipWork);polygon=clip(polygon,q(-1),neg(r.t),neg(r.lo),clipWork);}
 if(!polygon.length)throw Error('Internal contradiction between later pair and region support');
 later.status=polygon.length<3?'boundary':'compatible';later.baseline=span(polygon.map(p=>p[0]));
 later.vertices=polygon.map(p=>({baseline:bound(p[0]),slope:bound(p[1])}));
 const total=earlier.vertices.length*polygon.length;if(total>maxVertexPairs)throw Error('Complete vertex projection exceeds declared work; no partial response');
 const instant=q(Date.parse(common.intervention)),preOffset=div(sub(instant,q(Date.parse(earlier.origin))),q(86400000)),postOffset=div(sub(instant,origin),q(86400000)),points=[];
 for(const a of earlier.vertices)for(const z of polygon){work.vertexPairs++;const ab=unpack(a.baseline),as=unpack(a.slope);points.push([sub(add(z[0],mul(z[1],postOffset)),add(ab,mul(as,preOffset))),sub(z[1],as)]);}
 const joint=hull(points,work);
 // Slice the joint region, not its independent marginal intervals.
 let zero=clip(joint,q(0),q(1),q(0),clipWork);zero=clip(zero,q(0),q(-1),q(0),clipWork);
 work.constraintChecks=clipWork.count;
 return{...common,later,status:'response-compatible',work,
  jump:span(joint.map(p=>p[0])),slopeChange:span(joint.map(p=>p[1])),
  vertices:joint.map(p=>({jump:bound(p[0]),slopeChange:bound(p[1])})),
  zeroSlopeChange:zero.length?{status:'compatible',jump:span(zero.map(p=>p[0]))}:{status:'incompatible',jump:null}
 };
}
