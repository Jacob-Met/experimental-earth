import {compareAreaOffers,serializeAreaOffers,parseAreaOffers} from './ponded-area-offers.js';
import {compareUptakeArea} from './ponded-uptake-area.js';
export function receiveUptakeOutcome(study,area,offer,actual){
 const design=compareAreaOffers(study,area,offer);
 if(!actual||actual.sameTest!==true||actual.continuouslyPonded!==true||actual.quantity!=='net-infiltrated-volume')throw Error('Confirm the same original test and continued continuously ponded net-infiltration protocol.');
 if(study.readings.length>=100)throw Error('Retain at most99original readings to admit one additional challenge within the maintained100-reading bound.');
 const planned=design.rows.find(r=>r.minute===actual.minute);
 if(!planned||!planned.available||!planned.predictions.length)throw Error('Choose an available, later offered time with original calibration-supported explanations.');
 const reading={minute:actual.minute,volume:actual.volume,uncertainty:actual.uncertainty,unit:actual.unit,source:actual.source,role:'challenge'};
 const tested={...study,readings:[...study.readings,reading]};
 // Original calibration and held-aside rows stay literal; the actual follow-up
 // enters only the maintained challenge path, never fitting or planning.
 const challenged=compareUptakeArea(tested,area),ids=new Set(design.candidates.map(c=>c.id));
 const candidates=challenged.candidates.filter(c=>ids.has(c.id)).map(c=>({id:c.id,calibrationSupport:c.support,calibrationAreaM2:c.possibleAreaM2,actual:c.challenges.at(-1),remainsPossible:c.challenges.at(-1).status!=='contradicts-all'}));
 const possible=candidates.filter(c=>c.remainsPossible).map(c=>c.id),scale=actual.unit==='mL'?.001:1,boundLiters=actual.uncertainty*scale;
 const expected=planned.uncertaintyLiters,guard=16*Number.EPSILON*Math.max(Number.MIN_VALUE,boundLiters,expected);
 const precision=boundLiters===expected||boundLiters<expected-guard?'met':boundLiters>expected+guard?'not-met':'numerical-boundary';
 const resolvedPairs=planned.separatedPairs.filter(pair=>pair.filter(id=>possible.includes(id)).length===1),stillPossiblePairs=planned.separatedPairs.filter(pair=>pair.every(id=>possible.includes(id))),bothContradictedPairs=planned.separatedPairs.filter(pair=>pair.every(id=>!possible.includes(id)));
 return {status:possible.length===0?'all-original-explanations-contradicted':possible.length===1?'one-original-explanation-remains-possible':'multiple-original-explanations-remain-possible',actual:reading,plannedMinute:planned.minute,plannedStatus:planned.status,plannedVolumeBoundLiters:expected,actualVolumeBoundLiters:boundLiters,precision,precisionArithmeticGuardLiters:guard,originalPreferredMinute:design.preferredMinute,candidates,possible,resolvedPairs,stillPossiblePairs,bothContradictedPairs,qualification:'Actual reading is a separately declared held-aside challenge to the frozen design. Original calibration areas do not change. Remaining possibility is not physical validation, a fitted parameter or automatic adoption.'};
}
export function serializeUptakeOutcome(study,area,offer,actual){receiveUptakeOutcome(study,area,offer,actual);const design=JSON.parse(serializeAreaOffers(study,area,offer));const a={sameTest:actual.sameTest,continuouslyPonded:actual.continuouslyPonded,quantity:actual.quantity,minute:actual.minute,volume:actual.volume,uncertainty:actual.uncertainty,unit:actual.unit,source:actual.source};const text=JSON.stringify({schema:'experimental-earth-uptake-outcome/1',design,actual:a},null,2);if(new TextEncoder().encode(text).length>165000)throw Error('Outcome source exceeds165000bytes.');return text;}
export function parseUptakeOutcome(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>165000)throw Error('Choose an outcome source up to165000bytes.');const x=JSON.parse(text);if(x.schema!=='experimental-earth-uptake-outcome/1')throw Error('Wrong actual-outcome source format.');const d=parseAreaOffers(JSON.stringify(x.design));return JSON.parse(serializeUptakeOutcome(d.study,d.area,d.offer,x.actual));}
