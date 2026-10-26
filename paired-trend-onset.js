/** Infer continuous nonzero trend-change times without selecting a time grid. */
import {inferPairedTrendResponse} from './paired-trend-response.js';
import {rational as q,sub,div,neg,cmp,clip,serial,enclosure} from './vendor/chronos/exact-halfplanes.mjs';
export const TREND_ONSET_SCHEMA='experimental-earth-paired-trend-onset/1';
const unpack=x=>[BigInt(x.exact.numerator),BigInt(x.exact.denominator)];
const bound=x=>({exact:serial(x),...enclosure(x)});
export function inferPairedTrendOnset(source,{maxRootEvaluations=512,...responseOptions}={}){
 if(!source||source.schema!==TREND_ONSET_SCHEMA||source.model!=='continuous-change-in-original-gap'||Object.keys(source).sort().join(',')!=='model,response,schema')throw Error('Select continuous trend change in the original observation gap');
 if(!Number.isSafeInteger(maxRootEvaluations)||maxRootEvaluations<1||maxRootEvaluations>512)throw Error('Declare bounded complete onset projection work');
 const response=inferPairedTrendResponse(source.response,responseOptions),original=structuredClone(source);
 const common={source:original,response,gap:null,branches:[],unchangedSupported:false};
 if(response.status!=='response-compatible')return{...common,status:'response-unavailable'};
 const start=response.earlier.preTimeSupport[1],end=response.later.timeSupport[0],tau=q(Date.parse(response.intervention));
 const lo=div(sub(q(Date.parse(start)),tau),q(86400000)),hi=div(sub(q(Date.parse(end)),tau),q(86400000));
 const gap={start,end,endpointPolicy:'inclusive',durationDays:bound(sub(hi,lo)),offsetOrigin:start};
 const work={...response.work,responseConstraintChecks:response.work.constraintChecks,rootEvaluations:0,maxRootEvaluations};
 const clipWork={count:response.work.constraintChecks,limit:response.work.maxConstraintChecks};
 const vertices=response.vertices.map(p=>[unpack(p.jump),unpack(p.slopeChange)]),branches=[];
 const unchangedSupported=response.zeroSlopeChange.status==='compatible'&&cmp(unpack(response.zeroSlopeChange.jump.lower),q(0))<=0&&cmp(unpack(response.zeroSlopeChange.jump.upper),q(0))>=0;
 for(const sign of [1,-1]){
  // A crossing lies in [lo,hi] iff the signed endpoint values straddle zero.
  let polygon=clip(vertices,q(sign),sign===1?lo:neg(lo),q(0),clipWork);
  polygon=clip(polygon,q(-sign),sign===1?neg(hi):hi,q(0),clipWork);
  polygon=clip(polygon,q(0),q(-sign),q(0),clipWork);
  const nonzero=polygon.filter(p=>cmp(p[1],q(0))!==0);
  if(work.rootEvaluations+nonzero.length>maxRootEvaluations)throw Error('Complete onset projection exceeds declared work; no partial onset interval');
  if(!nonzero.length)continue;
  let lower=null,upper=null,lowerWitness=null,upperWitness=null;
  for(const p of nonzero){
   work.rootEvaluations++;const root=sub(div(neg(p[0]),p[1]),lo);
   if(lower===null||cmp(root,lower)<0){lower=root;lowerWitness=p;}
   if(upper===null||cmp(root,upper)>0){upper=root;upperWitness=p;}
  }
  const witness=p=>({jump:bound(p[0]),slopeChange:bound(p[1])});
  branches.push({slopeChangeDirection:sign===1?'positive':'negative',
   offsetAfterLastEarlierDays:{lower:bound(lower),upper:bound(upper)},
   witnesses:{lower:witness(lowerWitness),upper:witness(upperWitness)},
   closureVertices:polygon.map(witness),zeroSlopeExcluded:true});
 }
 work.constraintChecks=clipWork.count;
 return{...common,gap,branches,unchangedSupported,work,status:branches.length?'change-compatible':unchangedSupported?'unchanged-only':'continuous-change-incompatible'};
}
