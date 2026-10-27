import{parseAccountedOffers,serializeAccountedOffers,compareAccountedOffers}from'./ponded-accounted-offers.js';
import{parseWaterAccounting,serializeWaterAccounting,accountPondedWater}from'./ponded-water-accounting.js';
import{serializeAccountedUptake}from'./ponded-accounted-uptake.js';
import{compareAreaInventory,serializeAreaInventory}from'./ponded-area-inventory.js';
import{rational as q,add,sub,mul,div,cmp,enclosure}from'./vendor/chronos/exact-halfplanes.mjs';
const zero=q(0),max=(a,b)=>cmp(a,b)>0?a:b;
function bounds(r){if(r.status==='unknown')return null;const scale=r.unit==='mL'?div(q(1),q(1000)):q(1);return[mul(max(zero,sub(q(r.volume),q(r.uncertainty))),scale),mul(add(q(r.volume),q(r.uncertainty)),scale)];}
const display=b=>b?[enclosure(b[0]).lower,enclosure(b[1]).upper]:null;
function relation(actual,planned){if(!actual)return'actual-unknown';if(!planned)return'not-promised';return cmp(actual[1],planned[0])<0||cmp(actual[0],planned[1])>0?'outside-promised-bounds':cmp(actual[0],planned[0])>=0&&cmp(actual[1],planned[1])<=0?'within-promised-bounds':'overlaps-promised-bounds';}
function admit(design,account,admission){
 const frozen=parseAccountedOffers(serializeAccountedOffers(design.inquiry,design.offer)),actual=parseWaterAccounting(serializeWaterAccounting(account));
 if(!admission||admission.sameTestAndOrigin!==true||typeof admission.source!=='string'||!admission.source.trim()||admission.source.length>1000)throw Error('Explicitly associate the actual account with the same original test and cumulative origin.');
 const first=frozen.inquiry.comparisons[0],offer=frozen.offer.times.find(x=>x.minute===actual.minute);
 if(!offer||!offer.available)throw Error('The actual account must match an explicitly available offered time.');
 if(actual.minute<=frozen.inquiry.comparisons.at(-1).account.minute||actual.minute<=frozen.offer.afterMinute)throw Error('Actual accounted time must follow the frozen complete course.');
 if(first.study.readings.length+frozen.inquiry.comparisons.length+1>100)throw Error('Original and actual accounted readings exceed the complete100-reading bound.');
 if(actual.testReference!==first.account.testReference||actual.originReference!==first.account.originReference||JSON.stringify(actual.surfaceStart)!==JSON.stringify(first.account.surfaceStart))throw Error('Preserve the same original test/origin and exact initial-inventory source record.');
 return{design:frozen,account:actual,admission:{sameTestAndOrigin:true,source:admission.source},offer};
}
export function receiveAccountedOutcome(design,account,admission){
 const source=admit(design,account,admission),actual=source.account,inquiry=source.design.inquiry,plan=compareAccountedOffers(inquiry,source.design.offer),question=plan.rows.find(x=>x.minute===actual.minute),balance=accountPondedWater(actual);
 const radius=actual.inputWater.status==='bounded'?mul(q(actual.inputWater.uncertainty),actual.inputWater.unit==='mL'?div(q(1),q(1000)):q(1)):null;
 const precision=radius===null?'actual-unknown':cmp(radius,q(source.offer.uncertaintyLiters))<=0?'met-promised-precision':'worse-than-promised-precision';
 const terms=['surfaceEnd','otherLoss'].map(name=>{const a=bounds(actual[name]),p=bounds(source.offer[name]);return{name,status:relation(a,p),actualLiters:display(a),promisedLiters:display(p)};});
 const requirements=precision==='actual-unknown'||terms.some(x=>x.status==='actual-unknown'||x.status==='not-promised')?'requirements-unresolved':precision==='met-promised-precision'&&terms.every(x=>x.status==='within-promised-bounds')?'within-declared-requirements':'declared-requirements-not-met';
 const incoming=bounds(actual.inputWater),frozenPredictions=question.predictions.map(p=>({id:p.id,originalPromisedReadingBand:[p.readingLowLiters??p.lowLiters,p.readingHighLiters??p.highLiters],actualIncomingRelation:relation(incoming,[q(p.readingLowLiters??p.lowLiters),q(p.readingHighLiters??p.highLiters)])}));
 const cumulativeConflicts=['inputWater','otherLoss'].filter(name=>{const current=bounds(actual[name]);return current&&inquiry.comparisons.some(row=>{const past=bounds(row.account[name]);return past&&cmp(current[1],past[0])<0;});});
 let completeCourse=null,status=cumulativeConflicts.length?'inconsistent-cumulative-accounting':balance.status==='incomplete-accounting'?'incomplete-actual-accounting':balance.status==='inconsistent-accounting'?'inconsistent-actual-accounting':'compared-complete-actual-course';
 if(status==='compared-complete-actual-course'){
  const row=JSON.parse(serializeAccountedUptake(inquiry.comparisons[0].study,actual,source.admission));
  completeCourse=compareAreaInventory([...inquiry.comparisons,row],inquiry.shared,inquiry.area);
 }
 return{status,cumulativeConflicts,minute:actual.minute,frozenOfferStatus:question.status,requirements,achievedPrecision:precision,promisedUncertaintyLiters:source.offer.uncertaintyLiters,actualUncertaintyLiters:radius?enclosure(radius):null,futureAccountingRequirements:terms,actualIncomingLiters:display(incoming),frozenPredictions,completeCourse,qualification:'Frozen prospective requirements and actual complete-account comparison are separate. A precision/storage/loss mismatch does not itself reject a soil explanation. Actual original terms challenge the complete course with the same original area/inventory; original calibration, source bounds and frozen design are unchanged. Unknown actual terms do not become zero. No fitted property, field validation or site change is adopted.'};
}
export function serializeAccountedOutcome(design,account,admission){receiveAccountedOutcome(design,account,admission);const x=admit(design,account,admission),text=JSON.stringify({schema:'experimental-earth-accounted-outcome/1',design:x.design,account:x.account,admission:x.admission},null,2);if(new TextEncoder().encode(text).length>2250000)throw Error('Complete original accounted outcome exceeds2250000bytes.');return text;}
export function parseAccountedOutcome(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>2250000)throw Error('Choose original accounted outcome up to2250000bytes.');const x=JSON.parse(text);if(x.schema!=='experimental-earth-accounted-outcome/1')throw Error('Wrong accounted-outcome source format.');return JSON.parse(serializeAccountedOutcome(x.design,x.account,x.admission));}

export function continueAccountedOutcome(design,account,admission){const result=receiveAccountedOutcome(design,account,admission);if(result.status!=='compared-complete-actual-course')throw Error('Complete and reconcile the actual account before continuing its original challenge.');const source=admit(design,account,admission),inquiry=source.design.inquiry,row=JSON.parse(serializeAccountedUptake(inquiry.comparisons[0].study,source.account,source.admission));return JSON.parse(serializeAreaInventory([...inquiry.comparisons,row],inquiry.shared,inquiry.area));}
