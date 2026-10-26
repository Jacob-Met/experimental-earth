import {inferPairedTrendRegion} from './paired-trend-region.js';
import {rational as q,sub,div,neg,clip,serial,enclosure} from './vendor/chronos/exact-halfplanes.mjs';
const bound=x=>({exact:serial(x),...enclosure(x)});
const unpack=b=>[BigInt(b.exact.numerator),BigInt(b.exact.denominator)];

/** Challenge a frozen earlier region; never replace its support with later fits. */
export function challengePairedTrendContinuation(input,{maxPairChecks=1953,maxConstraintChecks=200000}={}){
 const earlier=inferPairedTrendRegion(input,{maxPairChecks,maxConstraintChecks});
 const post=input.series.pairs.map((p,index)=>({...p,index})).filter(p=>p.role==='post');
 const common={earlier,originalPostIndices:post.map(p=>p.index)};
 if(earlier.status==='incompatible')return {...common,status:'earlier-incompatible',jointVertices:[],testedPostIndices:[],contradictionAt:null,work:earlier.work};
 let polygon=earlier.vertices.map(p=>[unpack(p.baseline),unpack(p.slope)]);
 const work={count:earlier.work.constraintChecks,limit:maxConstraintChecks},testedPostIndices=[];
 for(const p of post){
  const time=div(sub(q(Date.parse(p.time)),q(Date.parse(earlier.origin))),q(86400000));
  const lower=sub(q(p.treated.lower),q(p.comparison.upper)),upper=sub(q(p.treated.upper),q(p.comparison.lower));
  polygon=clip(polygon,q(1),time,upper,work);polygon=clip(polygon,q(-1),neg(time),neg(lower),work);testedPostIndices.push(p.index);
  if(!polygon.length)return {...common,status:'jointly-incompatible',jointVertices:[],testedPostIndices,contradictionAt:p.index,work:{...earlier.work,constraintChecks:work.count}};
 }
 return {...common,status:'jointly-compatible',jointVertices:polygon.map(p=>({baseline:bound(p[0]),slope:bound(p[1])})),testedPostIndices,contradictionAt:null,work:{...earlier.work,constraintChecks:work.count}};
}
