import{counterStormRegion}from'./rain-counter-storm.js';
import{validateRainCounter,scoreRainCounter}from'./rain-counter-original.js';
import{compareJointPressureHeads}from'./rain-pressure-evidence.js';
import{rational as q,add,div,mul,cmp,enclosure}from'./vendor/chronos/exact-halfplanes.mjs';
import{validateProject,SURFACES}from'./core.js';
import{validatePressureHeadStudy,MAX_PRESSURE_HEAD_CELL_STEPS}from'./pressure-head-contract.js';
const decode=r=>[BigInt(r.numerator),BigInt(r.denominator)];
export function counterStormProposals(project,counter){
 const region=counterStormRegion(project,counter),proposals=[],keys=new Set();
 if(region.status!=='compatible-region')return{region,proposals};
 for(let index=0;index<region.cells.length;index++){
  const cell=region.cells[index];if(!cell.vertices.length)continue;
  const points=cell.vertices.map(v=>[decode(v.rainMmHr),decode(v.totalRainMm)]),centroid=points.reduce((a,p)=>[add(a[0],p[0]),add(a[1],p[1])],[q(0),q(0)]).map(x=>div(x,q(points.length)));
  for(const [R,V]of[...points,centroid]){
   // A zero-total vertex cannot identify duration. Offer the phase ends and
   // midpoint explicitly, retaining ambiguity rather than manufacturing T=0.
   const times=cmp(R,q(0))===0?[cell.startMinute,(cell.startMinute+cell.endMinute)/2,cell.endMinute]:Object.values(enclosure(div(mul(q(60),V),R)));
   for(const rainMmHr of Object.values(enclosure(R)))for(const stormMinutes of times){
    const key=JSON.stringify([rainMmHr,stormMinutes]);if(keys.has(key))continue;keys.add(key);
    if(proposals.length>=128)throw Error('Complete storm vertex/centroid proposal course exceeds128; no partial course.');
    const counterEvidence=scoreRainCounter(project,counter,rainMmHr,stormMinutes);
    proposals.push({rainMmHr,stormMinutes,counterEvidence,eligible:counterEvidence.calibration.compatible===true});
   }
  }
 }
 return{region,proposals};
}
export function compareCounterStormPressure(source,fronts,study,counter,declaration){
 validateProject(source.project);validatePressureHeadStudy(study,SURFACES);const original=validateRainCounter(source.project,counter);
 if(original.eventRef!==source.gauge.eventRef)throw Error('Counter must name the original gauge event.');
 if(!declaration||Array.isArray(declaration)||Object.keys(declaration).length!==1||!Object.hasOwn(declaration,'basis')||typeof declaration.basis!=='string'||!declaration.basis.trim()||declaration.basis.length>600)throw Error('Declare the original basis for joint storm proposals.');
 const course=counterStormProposals(source.project,original),p=source.project,q0=source.request,H=study.hypotheses.length,nonpressure=q0.ratesMmHr.length*(1+source.capacities.length+source.layers.length)+fronts.length,one=p.width*p.height*Math.ceil(p.weather.durationMinutes/p.weather.stepMinutes),maximumForcings=source.durations.length*q0.rainRatesMmHr.length+course.proposals.length,reservedCellSteps=maximumForcings*(nonpressure+2*(H+1))*one,reservedCounterRows=(maximumForcings*(nonpressure+H)+course.proposals.length)*original.readings.length;
 if(!Number.isFinite(reservedCellSteps)||reservedCellSteps>3000000||2*(H+1)*one>MAX_PRESSURE_HEAD_CELL_STEPS||reservedCounterRows>200000)throw Error('Complete joint-storm mechanism family exceeds work limits before simulation.');
 const receive=c=>{const counterEvidence=scoreRainCounter(p,original,c.rainMmHr,c.stormMinutes),compatible=c.compatible&&counterEvidence.calibration.compatible!==false;return{...structuredClone(c),counterEvidence,compatible,surviving:compatible&&c.surviving&&counterEvidence.challenge.compatible!==false};};
 const base=compareJointPressureHeads(source,fronts,study),originalCandidates=base.candidates.map(receive),candidates=[];
 for(const offer of course.proposals)if(offer.eligible){const supplied=structuredClone(source);supplied.durations=[offer.stormMinutes];supplied.request.rainRatesMmHr=[offer.rainMmHr];candidates.push(...compareJointPressureHeads(supplied,fronts,study).candidates.map(receive));}
 return{...course,original:{...base,candidates:originalCandidates,compatibleCount:originalCandidates.filter(c=>c.compatible).length,survivingCount:originalCandidates.filter(c=>c.surviving).length},candidates,reservedCellSteps,reservedCounterRows,compatibleCount:candidates.filter(c=>c.compatible).length,survivingCount:candidates.filter(c=>c.surviving).length,meaning:'Joint original counter calibration constrains constant rainfall intensity and storm end with one shared nonnegative baseline. This finite course tests adjacent binary64 enclosures of exact phase vertices and centroids, and explicit phase endpoints/midpoints for zero rain. Every proposed pair is checked against the original counter bands before hydraulic use; rejected rounding proposals remain visible. All original offered mechanisms and measured gauge/depth constraints are retained. Held-aside readings never define cells, proposals or eligibility. Earlier finite duration offers remain separate, not a measured bound. Finite tested points do not cover the continuous region, identify soil, validate source declarations or authorize parameter adoption.'};
}
const SCHEMA='experimental-earth-counter-storm-pressure/1',LIMIT=4*1024*1024,exact=(o,k)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===k.length&&k.every(x=>Object.hasOwn(o,x));
export function exportCounterStormPressure(source,fronts,study,counter,declaration){compareCounterStormPressure(source,fronts,study,counter,declaration);const text=JSON.stringify({schema:SCHEMA,source:{project:source.project,request:source.request,gauge:source.gauge,durations:source.durations,capacities:source.capacities,layers:source.layers},fronts,study,counter,declaration});if(new TextEncoder().encode(text).length>LIMIT)throw Error('At most4MiB original inputs.');return text;}
export function importCounterStormPressure(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>LIMIT)throw Error('At most4MiB original inputs.');const s=JSON.parse(text);if(!exact(s,['schema','source','fronts','study','counter','declaration'])||s.schema!==SCHEMA||!exact(s.source,['project','request','gauge','durations','capacities','layers']))throw Error('Open original joint-storm comparison inputs, not saved conclusions.');return{...s,result:compareCounterStormPressure(s.source,s.fronts,s.study,s.counter,s.declaration)};}
