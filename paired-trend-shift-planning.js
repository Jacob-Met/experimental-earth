/** What additional later-only evidence cannot identify under the explicit shift model. */
import {inferPairedTrendShift} from './paired-trend-shift.js';
import {rational as q,sub,mul,div,cmp,serial,enclosure} from './vendor/chronos/exact-halfplanes.mjs';
const unpack=b=>[BigInt(b.exact.numerator),BigInt(b.exact.denominator)];
const bound=x=>({exact:serial(x),...enclosure(x)});
export function inferPairedTrendShiftPlanning(source,options={}){
 const result=inferPairedTrendShift(source,options);
 if(result.status!=='shift-compatible')return {...result,laterOnlyPlanning:null};
 let lo=unpack(result.vertices[0].slope),hi=lo;
 for(const vertex of result.vertices){const b=unpack(vertex.slope);if(cmp(b,lo)<0)lo=b;if(cmp(b,hi)>0)hi=b;}
 const origin=q(Date.parse(result.earlier.origin));
 const pre=result.source.inquiry.series.pairs.filter(p=>p.role==='pre').map(p=>({
  t:div(sub(q(Date.parse(p.time)),origin),q(86400000)),
  lo:sub(q(p.treated.lower),q(p.comparison.upper)),
  hi:sub(q(p.treated.upper),q(p.comparison.lower))
 }));
 let endpointBandChecks=0;
 const interval=b=>{
  let lower=null,upper=null;
  for(const p of pre){endpointBandChecks++;const a=sub(p.lo,mul(b,p.t)),z=sub(p.hi,mul(b,p.t));if(lower===null||cmp(a,lower)>0)lower=a;if(upper===null||cmp(z,upper)<0)upper=z;}
  if(cmp(lower,upper)>0)throw Error('Jointly supported slope has no original earlier intercept');
  return {slope:bound(b),intercept:{lower:bound(lower),upper:bound(upper)},width:bound(sub(upper,lower))};
 };
 const endpoints=[interval(lo),interval(hi)],a=unpack(endpoints[0].width),b=unpack(endpoints[1].width),floor=cmp(a,b)<=0?a:b,current=sub(unpack(result.shift.upper),unpack(result.shift.lower));
 if(cmp(floor,q(0))<0||cmp(floor,current)>0)throw Error('Inconsistent later-only identification bound');
 return {...result,laterOnlyPlanning:{
  assumption:'Only additional later-period gap bands; original earlier bands and constant shift model unchanged; resulting support nonempty.',
  currentWidth:bound(current),minimumRemainingWidth:bound(floor),
  widthReductionUpperBound:bound(sub(current,floor)),positiveFloor:cmp(floor,q(0))>0,
  slopeEndpoints:endpoints,work:{endpointBandChecks,maxEndpointBandChecks:126}
 }};
}
