import {comparePondedUptake} from './ponded-uptake.js';
import {pondedInfiltration} from './wetting-front.js';
import {planComplementaryDepths} from './complementary-depth-plan.js';
export function compareUptakeOffers(study,offer){
 const comparison=comparePondedUptake(study);
 if(!offer||typeof offer.basis!=='string'||!offer.basis.trim()||offer.basis.length>500||!Number.isFinite(offer.afterMinute)||offer.afterMinute<0||offer.afterMinute>=720||!Array.isArray(offer.times)||offer.times.length>32)throw Error('Declare elapsed time, acquisition basis and at most32 offered times.');
 const seen=new Set();for(const x of offer.times){if(!x||typeof x.minute!=='number'||!Number.isFinite(x.minute)||x.minute<=offer.afterMinute||x.minute>720||seen.has(x.minute)||typeof x.available!=='boolean'||typeof x.uncertaintyLiters!=='number'||!Number.isFinite(x.uncertaintyLiters)||x.uncertaintyLiters<0||x.uncertaintyLiters/study.areaM2>1000)throw Error('Offer distinct future times through720min, explicit availability and0–1000mm-equivalent volume bounds.');seen.add(x.minute);}
 const candidates=comparison.candidates.filter(c=>comparison.hasCalibration&&c.calibrationCompatible!==false).map(({id,conductivityMmHr,capillaryDriveMm,initialCumulativeMm,calibrationNumericalBoundary})=>({id,conductivityMmHr,capillaryDriveMm,initialCumulativeMm,calibrationNumericalBoundary}));
 const rows=offer.times.map(x=>{
  if(!x.available||study.readings.some(r=>r.minute===x.minute))return {...x,status:x.available?'already-recorded':'unavailable',predictions:[],separatedPairs:[],unresolvedPairs:[]};
  if(x.minute<=Math.max(offer.afterMinute,study.readings.at(-1).minute))return {...x,status:'not-after-recorded-course',predictions:[],separatedPairs:[],unresolvedPairs:[]};
  const predictions=candidates.map(c=>{const liters=pondedInfiltration(c.initialCumulativeMm,c.conductivityMmHr,c.capillaryDriveMm,x.minute/60)*study.areaM2;return {id:c.id,liters,lowLiters:Math.max(0,liters-x.uncertaintyLiters),highLiters:liters+x.uncertaintyLiters};});
  const runs=predictions.map(p=>({snapshots:[{minute:0,depthsMm:[0]},{minute:x.minute,depthsMm:[p.liters/study.areaM2]}]}));
  const d=planComplementaryDepths(runs,{uncertaintyMm:x.uncertaintyLiters/study.areaM2,maxReadings:1});const label=p=>[candidates[p.first].id,candidates[p.second].id];
  return {...x,status:d.status,predictions,separatedPairs:d.pairs.filter((_,i)=>d.questions[0]?.separated.includes(i)).map(label),unresolvedPairs:d.unresolvedPairs.map(label)};
 });
 const ranked=rows.filter(r=>r.separatedPairs.length).slice().sort((a,b)=>b.separatedPairs.length-a.separatedPairs.length||a.minute-b.minute);
 return {status:!comparison.hasCalibration?'need-calibration':candidates.length<2?'insufficient-alternatives':ranked.length?'offered-question':'no-separating-offer',candidates,rows,preferredMinute:ranked[0]?.minute??null,policy:'Greatest pair coverage among supplied offers; earliest time breaks ties. Numerical-boundary calibration alternatives remain possible, not confirmed; maintained conservative band guard; no probabilities, automatic evidence or site transfer.'};
}
