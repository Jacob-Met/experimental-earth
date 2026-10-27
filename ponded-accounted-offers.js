import{rational as q,add,sub,mul,div,cmp,enclosure}from'./vendor/chronos/exact-halfplanes.mjs';
import{compareAreaInventory,serializeAreaInventory,parseAreaInventory}from'./ponded-area-inventory.js';
import{validateWaterAccounting,serializeWaterAccounting}from'./ponded-water-accounting.js';
import{validateUptakeOffers,rankUptakeOffers}from'./ponded-uptake-offers.js';
import{planComplementaryDepths}from'./complementary-depth-plan.js';
import{pondedInfiltration}from'./wetting-front.js';
const zero=q(0),min=(a,b)=>cmp(a,b)<0?a:b,max=(a,b)=>cmp(a,b)>0?a:b,exact=x=>[BigInt(x.numerator),BigInt(x.denominator)];
function bounds(r){const scale=r.unit==='mL'?div(q(1),q(1000)):q(1);return[mul(max(zero,sub(q(r.volume),q(r.uncertainty))),scale),mul(add(q(r.volume),q(r.uncertainty)),scale)];}
function admit(inquiry,offer){
 const original=parseAreaInventory(JSON.stringify(inquiry)),first=original.comparisons[0];validateUptakeOffers(first.study,offer);
 if(offer.conditionOnCompleteCourse!==true||offer.sameTestAndOrigin!==true||offer.continuouslyPonded!==true||typeof offer.protocol!=='string'||!offer.protocol.trim()||offer.protocol.length>1000)throw Error('Explicitly condition on the complete challenged course and declare the same test/origin, continued ponding and prospective accounting protocol.');
 const times=offer.times.map(x=>{const carrier={...first.account,minute:x.minute,surfaceEnd:x.surfaceEnd,otherLoss:x.otherLoss};validateWaterAccounting(carrier);const clean=JSON.parse(serializeWaterAccounting(carrier));return{minute:x.minute,available:x.available,uncertaintyLiters:x.uncertaintyLiters,surfaceEnd:clean.surfaceEnd,otherLoss:clean.otherLoss};});
 return{original,offer:{basis:offer.basis,afterMinute:offer.afterMinute,conditionOnCompleteCourse:true,sameTestAndOrigin:true,continuouslyPonded:true,protocol:offer.protocol,times}};
}
export function compareAccountedOffers(inquiry,offered){
 const {original,offer}=admit(inquiry,offered),first=original.comparisons[0],study=first.study,joint=compareAreaInventory(original.comparisons,original.shared,original.area),last=joint.minutes.at(-1);
 const candidates=joint.candidates.filter(c=>c.originalAreaCalibration!=='need-calibration'&&c.originalAreaCalibration!=='excluded'&&c.possiblePolygon.length).map(c=>({...c,hypothesis:study.hypotheses.find(h=>h.id===c.id)}));
 const rows=offer.times.map(x=>{
  const base={...x,predictions:[],separatedPairs:[],unresolvedPairs:[]};
  if(!x.available)return{...base,status:'unavailable'};if(x.minute<=Math.max(last,offer.afterMinute,study.readings.at(-1).minute))return{...base,status:'not-after-complete-course'};
  if(x.surfaceEnd.status==='unknown'||x.otherLoss.status==='unknown')return{...base,status:'unknown-future-accounting'};
  const end=bounds(x.surfaceEnd),loss=bounds(x.otherLoss),pastLoss=original.comparisons.map(r=>bounds(r.account.otherLoss)[0]).reduce(max),pastInput=original.comparisons.map(r=>bounds(r.account.inputWater)[0]).reduce(max);
  if(cmp(loss[1],pastLoss)<0)return{...base,status:'incompatible-cumulative-loss-bounds'};
  const predictions=candidates.map(c=>{const h=c.hypothesis,depth=pondedInfiltration(h.initialCumulativeMm,h.conductivityMmHr,h.capillaryDriveMm,x.minute/60),values=c.possiblePolygon.map(p=>sub(mul(q(depth),exact(p.exact.area)),exact(p.exact.inventory))),low=add(add(values.reduce(min),end[0]),loss[0]),high=add(add(values.reduce(max),end[1]),loss[1]);
   const lo=enclosure(low).lower,hi=enclosure(high).upper,guard=Math.max(16*Number.MIN_VALUE,32*Number.EPSILON*(Math.abs(depth*original.area.highM2)+Math.abs(lo)+Math.abs(hi))),g=q(guard);
   return{id:c.id,courseStatus:c.status,lowLiters:enclosure(sub(low,g)).lower,highLiters:enclosure(add(high,g)).upper,arithmeticAllowanceLiters:guard};});
  // A possible negative cumulative input exposes a mismatch with the declared
  // future protocol, including cumulative input already recorded. Do not silently remove those cases to manufacture separation.
  if(predictions.some(p=>p.lowLiters<0||p.lowLiters<enclosure(pastInput).lower))return{...base,status:'future-protocol-sensitive',predictions};
  const separatedPairs=[],unresolvedPairs=[];
  for(let i=0;i<predictions.length;i++)for(let j=i+1;j<predictions.length;j++){
   const a=predictions[i],b=predictions[j];let left,right;if(a.highLiters<b.lowLiters){left=a.highLiters;right=b.lowLiters;}else if(b.highLiters<a.lowLiters){left=b.highLiters;right=a.lowLiters;}else left=right=Math.max(a.lowLiters,b.lowLiters);
   const runs=[left,right].map(liters=>({snapshots:[{minute:0,depthsMm:[0]},{minute:x.minute,depthsMm:[liters/study.areaM2]}]})),screen=planComplementaryDepths(runs,{uncertaintyMm:x.uncertaintyLiters/study.areaM2,maxReadings:1});(screen.separatedPairCount?separatedPairs:unresolvedPairs).push([a.id,b.id]);
  }
  return{...base,status:candidates.length<2?'insufficient-alternatives':separatedPairs.length?'planned':'indistinguishable',predictions:predictions.map(p=>({...p,readingLowLiters:Math.max(0,p.lowLiters-x.uncertaintyLiters),readingHighLiters:p.highLiters+x.uncertaintyLiters})),separatedPairs,unresolvedPairs};
 });
 const ranked=rankUptakeOffers(rows);return{status:candidates.length<2?'insufficient-alternatives':ranked.length?'offered-accounted-question':'no-separating-offer',preferredMinute:ranked[0]?.minute??null,candidates:candidates.map(c=>({id:c.id,originalAreaCalibration:c.originalAreaCalibration,courseStatus:c.status})),rows,qualification:'Conditional on all original accounted challenges jointly, separately from original calibration. Future original incoming-water volume uses paired area/inventory vertices plus explicitly declared future final inventory and other losses. Unknown terms do not become zero. Greatest robust pair coverage among supplied offers, earliest time breaks ties. No new measurement, fitted value, probability or site change is adopted.'};
}
export function serializeAccountedOffers(inquiry,offer){compareAccountedOffers(inquiry,offer);const clean=admit(inquiry,offer),text=JSON.stringify({schema:'experimental-earth-accounted-offers/1',inquiry:clean.original,offer:clean.offer},null,2);if(new TextEncoder().encode(text).length>2200000)throw Error('Complete original accounted offers exceed2200000bytes.');return text;}
export function parseAccountedOffers(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>2200000)throw Error('Choose original accounted offers up to2200000bytes.');const x=JSON.parse(text);if(x.schema!=='experimental-earth-accounted-offers/1')throw Error('Wrong accounted-offer source format.');return JSON.parse(serializeAccountedOffers(x.inquiry,x.offer));}
