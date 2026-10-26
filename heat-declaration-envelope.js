import {validateHeatColumnEvidence} from './heat-column-evidence-contract.js';
import {rational as q,add,sub,mul,div,cmp,enclosure,serial} from './vendor/chronos/exact-halfplanes.mjs';
const zero=q(0),two=q(2),sixty=q(60),min=(a,b)=>cmp(a,b)<=0?a:b,max=(a,b)=>cmp(a,b)>=0?a:b;
const bound=x=>({exact:serial(x),...enclosure(x)});
/** Necessary invariant bounds for the retained cooperative two-store equations.
 * They hold for every positive lower capacity and nonnegative conductance.
 * Exact arithmetic concerns supplied binary64 declarations, not measured truth.
 */
export function diagnoseHeatDeclaration(evidence){
 validateHeatColumnEvidence(evidence);if(!evidence)throw Error('Retain original heat evidence');
 const {columnStudy:study,target,readings}=evidence,top=study.heatStudy[target],lower=study.lowerLayers[target];
 const initial=q(top.initialC),initialLower=q(lower.initialC),h=q(top.exchangeWm2K),capacity=q(top.capacityJm2K);
 let lo=min(initial,initialLower),hi=max(initial,initialLower),time=zero;
 const phases=study.heatStudy.schedule.map((phase,index)=>{
  const from=time,to=add(time,q(phase.minutes)),input=mul(q(top.absorptivity),q(phase.incidentWm2));
  let equilibrium=null,slope=zero;
  if(cmp(h,zero)>0){equilibrium=add(q(phase.reservoirC),div(input,h));lo=min(lo,equilibrium);hi=max(hi,equilibrium);}
  else slope=div(mul(input,sixty),capacity);
  const startUpper=hi;hi=add(hi,mul(slope,sub(to,from)));time=to;
  return {index,from,to,lower:lo,startUpper,endUpper:hi,slope,equilibrium,source:phase.source};
 });
 function envelope(from,to,mean){
  if(cmp(from,zero)<0||cmp(to,time)>0)throw Error('Reading support exceeds the exact sum of original phase durations; no rounded-time diagnostic');
  if(!mean&&cmp(to,zero)===0)return {lower:initial,upper:initial,phaseIndexes:[]};
  if(!mean){const p=phases.find(p=>cmp(to,p.to)<=0&&cmp(to,p.from)>0);if(!p)throw Error('Reading time has no original phase support');return {lower:p.lower,upper:add(p.startUpper,mul(p.slope,sub(to,p.from))),phaseIndexes:[p.index]};}
  let lowerIntegral=zero,upperIntegral=zero,covered=zero;const phaseIndexes=[];
  for(const p of phases){const a=max(from,p.from),b=min(to,p.to);if(cmp(a,b)>=0)continue;const width=sub(b,a),aOffset=sub(a,p.from),bOffset=sub(b,p.from);
   lowerIntegral=add(lowerIntegral,mul(p.lower,width));
   const linear=div(mul(p.slope,sub(mul(bOffset,bOffset),mul(aOffset,aOffset))),two);
   upperIntegral=add(upperIntegral,add(mul(p.startUpper,width),linear));covered=add(covered,width);phaseIndexes.push(p.index);
  }
  const width=sub(to,from);if(cmp(covered,width)!==0||cmp(width,zero)<=0)throw Error('Complete original averaging support is required');
  return {lower:div(lowerIntegral,width),upper:div(upperIntegral,width),phaseIndexes};
 }
 const rows=readings.map((reading,index)=>{
  const mean=reading.aggregation==='interval-mean',e=envelope(q(mean?reading.fromMinute:reading.minute),q(reading.minute),mean),originalLower=sub(q(reading.temperatureC),q(reading.halfWidthC)),originalUpper=add(q(reading.temperatureC),q(reading.halfWidthC));
  const below=cmp(originalUpper,e.lower)<0,above=cmp(originalLower,e.upper)>0,conflict=below||above;
  return {index,use:reading.use,aggregation:mean?'interval-mean':'instant',...(mean?{fromMinute:reading.fromMinute}:{}),minute:reading.minute,source:reading.source,phaseIndexes:e.phaseIndexes,necessaryLower:bound(e.lower),necessaryUpper:bound(e.upper),originalLower:bound(originalLower),originalUpper:bound(originalUpper),conflict,direction:below?'below':above?'above':null,separation:conflict?bound(below?sub(e.lower,originalUpper):sub(originalLower,e.upper)):null};
 });
 const calibrationConflicts=rows.filter(r=>r.use==='calibration'&&r.conflict).map(r=>r.index),challengeConflicts=rows.filter(r=>r.use==='challenge'&&r.conflict).map(r=>r.index);
 return {method:'fixed-heat-declaration-necessary-envelope/1',fixedDeclarations:{surfaceInitialC:top.initialC,lowerInitialC:lower.initialC,surfaceCapacityJm2K:top.capacityJm2K,surfaceExchangeWm2K:top.exchangeWm2K,absorptivity:top.absorptivity},status:calibrationConflicts.length?'calibration-declaration-conflict':challengeConflicts.length?'challenge-declaration-conflict':'no-necessary-conflict',target,rows,calibrationConflicts,challengeConflicts,
 phases:phases.map(p=>({index:p.index,fromMinute:bound(p.from),toMinute:bound(p.to),lower:bound(p.lower),startUpper:bound(p.startUpper),endUpper:bound(p.endUpper),upperSlopeCPerMinute:bound(p.slope),forcingEquilibrium:p.equilibrium?bound(p.equilibrium):null,source:p.source})),
 semantics:'Necessary bounds of the retained two-store equations with fixed surface properties, both initial temperatures and original piecewise forcing. They apply to every positive lower capacity and nonnegative conductance; a separated calibration band cannot be repaired by changing those two parameters. Exact fractions and outward display endpoints concern supplied binary64 numbers, not measurement truth or the numerical trajectory solver. No conflict does not establish a feasible explanation. Initial-state uncertainty, other heat mechanisms and physical model validity are not inferred; challenge roles never refit the model.'};
}
