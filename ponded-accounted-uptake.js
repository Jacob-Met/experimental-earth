import{parsePondedUptake,serializePondedUptake,comparePondedUptake}from'./ponded-uptake.js';
import{accountPondedWater,parseWaterAccounting,serializeWaterAccounting}from'./ponded-water-accounting.js';
export const ACCOUNTED_UPTAKE_LIMIT=180000;
function association(a){if(!a||a.sameTestAndOrigin!==true||typeof a.source!=='string'||!a.source.trim()||a.source.length>1000)throw Error('Explicitly associate this account with the same original test and cumulative origin, with a source basis.');return{sameTestAndOrigin:true,source:a.source};}
export function compareAccountedUptake(original,account,admission){
 association(admission);const study=parsePondedUptake(serializePondedUptake(original)),source=parseWaterAccounting(serializeWaterAccounting(account)),balance=accountPondedWater(source);
 if(balance.status==='incomplete-accounting'||balance.status==='inconsistent-accounting')throw Error('Complete a noncontradictory sourced water account before admitting it to a soil comparison.');
 if(study.readings.length>=100||source.minute<=study.readings.at(-1).minute)throw Error('The accounted challenge must follow every retained original reading and fit the100-reading bound.');
 const declared=[Math.max(0,balance.declaredBalanceLiters[0]),Math.max(0,balance.declaredBalanceLiters[1])];
 // Carrier intervals are temporary numerical inputs to the maintained comparator.
 // They are never saved as an original measured reading or adopted calibration.
 const center=declared[0]/2+declared[1]/2,half=(declared[1]-declared[0])/2;
 const carrierRoundingAllowanceLiters=16*Number.EPSILON*Math.max(Number.MIN_VALUE,Math.abs(center),half);
 const allowance=balance.arithmeticGuardLiters+carrierRoundingAllowanceLiters;
 const reading=radius=>({minute:source.minute,volume:center,uncertainty:radius,unit:'L',role:'challenge',source:'Computed net-volume carrier from retained original water-accounting terms; includes disclosed arithmetic allowance.'});
 const outer=comparePondedUptake({...study,readings:[...study.readings,reading(half+allowance)]});
 const inner=half>allowance?comparePondedUptake({...study,readings:[...study.readings,reading(half-allowance)]}):null;
 const candidates=outer.candidates.map((c,i)=>{const prediction=c.predictions.at(-1),inside=inner?.candidates[i].predictions.at(-1);return{id:c.id,originalCalibrationCompatible:c.calibrationCompatible,originalCalibrationNumericalBoundary:c.calibrationNumericalBoundary,originalChallenges:c.predictions.slice(0,-1).filter(r=>r.role==='challenge'),predictedLiters:prediction.predictedLiters,accountedChallenge:prediction.classification==='outside'?'contradicted':inside?.classification==='within'?'compatible-with-declared-bounds':'numerical-boundary'};});
 return {minute:source.minute,balance,declaredNetVolumeLiters:declared,arithmeticGuardLiters:balance.arithmeticGuardLiters,carrierRoundingAllowanceLiters,candidates,originalCalibrationOrder:outer.calibrationOrder,qualification:'Explicitly admitted as a held-aside challenge to the retained original study. Original calibration and readings remain unchanged. Arithmetic allowances are computational safeguards, not original measurement uncertainty. Compatibility neither validates the test protocol nor identifies soil properties or permits site transfer.'};
}
export function serializeAccountedUptake(study,account,admission){compareAccountedUptake(study,account,admission);const t=JSON.stringify({schema:'experimental-earth-accounted-uptake/1',study:JSON.parse(serializePondedUptake(study)),account:JSON.parse(serializeWaterAccounting(account)),admission:association(admission)},null,2);if(new TextEncoder().encode(t).length>ACCOUNTED_UPTAKE_LIMIT)throw Error('Original accounted-comparison source exceeds180000bytes.');return t;}
export function parseAccountedUptake(t){if(typeof t!=='string'||new TextEncoder().encode(t).length>ACCOUNTED_UPTAKE_LIMIT)throw Error('Choose original accounted comparison up to180000bytes.');const x=JSON.parse(t);if(x.schema!=='experimental-earth-accounted-uptake/1')throw Error('Wrong accounted-comparison source format.');return JSON.parse(serializeAccountedUptake(x.study,x.account,x.admission));}
