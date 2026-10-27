import {predictFiniteSupplySoil,canonicalFiniteSupplyProtocol} from './finite-supply-soil.js';
import {parsePondedUptake,serializePondedUptake} from './ponded-uptake.js';
import {planComplementaryDepths} from './complementary-depth-plan.js';
const text=x=>typeof x==='string'&&x.trim()&&x.length<=1000;
export function planFiniteSupplyOffers(input){
 if(!input||input.schema!=='experimental-earth-finite-supply-offers/1'||!text(input.basis)||!Array.isArray(input.offers)||input.offers.length<1||input.offers.length>32)throw Error('Declare a sourced prospective design with1–32 complete offered schedules and reading times.');
 const study=parsePondedUptake(serializePondedUptake(input.study)),seen=new Set();let work=0;
 const prepared=input.offers.map(o=>{
  if(!o||!text(o.id)||seen.has(o.id)||typeof o.available!=='boolean'||!text(o.basis)||!Number.isFinite(o.minute)||o.minute<=0||!Number.isFinite(o.uncertaintyLiters)||o.uncertaintyLiters<0||o.uncertaintyLiters/study.areaM2>1000)throw Error('Each offer needs distinct identity, availability, source basis, covered positive time and0–1000mm-equivalent future reading bounds.');seen.add(o.id);
  const steps=new Set([0,...(o.protocol?.segments??[]).map(s=>s.untilMinute),o.minute]).size-1;work+=steps*study.hypotheses.length;
  return o;
 });
 if(work>12000)throw Error('Complete offered course work exceeds12000 kernel advances; no partial plan.');
 const rows=prepared.map(o=>{
  // Prediction query has no observation objects or invented future values.
  const r=predictFiniteSupplySoil(study,o.protocol,[o.minute]),candidates=r.candidates.filter(c=>r.originalHasCalibration&&c.originalCalibrationCompatible!==false),predictions=candidates.map(c=>({id:c.id,liters:c.history.find(h=>h.minute===o.minute).surfaceLiters}));
  if(!o.available)return{id:o.id,minute:o.minute,status:'unavailable',predictions:[],separatedPairs:[],unresolvedPairs:[],originalHasCalibration:r.originalHasCalibration};
  const runs=predictions.map(p=>({snapshots:[{minute:0,depthsMm:[0]},{minute:o.minute,depthsMm:[p.liters/study.areaM2]}]})),screen=planComplementaryDepths(runs,{uncertaintyMm:o.uncertaintyLiters/study.areaM2,maxReadings:1}),label=p=>[candidates[p.first].id,candidates[p.second].id];
  return{id:o.id,minute:o.minute,status:screen.status,originalHasCalibration:r.originalHasCalibration,predictions:predictions.map(p=>({...p,lowLiters:Math.max(0,p.liters-o.uncertaintyLiters),highLiters:p.liters+o.uncertaintyLiters})),separatedPairs:screen.pairs.filter((_,i)=>screen.questions[0]?.separated.includes(i)).map(label),unresolvedPairs:screen.unresolvedPairs.map(label)};
 });
 const ranked=rows.filter(r=>r.separatedPairs.length).sort((a,b)=>b.separatedPairs.length-a.separatedPairs.length||a.minute-b.minute||input.offers.findIndex(o=>o.id===a.id)-input.offers.findIndex(o=>o.id===b.id));
 return{status:!rows.some(r=>r.originalHasCalibration)?'need-original-calibration':ranked.length?'offered-question':'no-separating-offer',preferredOfferId:ranked[0]?.id??null,rows,requestedWork:work,policy:'Greatest pair coverage, earliest reading then original offer order. Separate prospective tests explicitly reuse original nominal soil state and area. Original calibration only; no actual future readings or prior surface challenges select alternatives. No forcing uncertainty, field validation or automatic adoption.'};
}
export function serializeFiniteSupplyOffers(input){planFiniteSupplyOffers(input);const source={schema:input.schema,basis:input.basis,study:parsePondedUptake(serializePondedUptake(input.study)),offers:input.offers.map(({id,basis,available,minute,uncertaintyLiters,protocol})=>({id,basis,available,minute,uncertaintyLiters,protocol:canonicalFiniteSupplyProtocol(input.study,protocol)}))};const raw=JSON.stringify(source,null,2);if(new TextEncoder().encode(raw).length>360000)throw Error('Complete offered source exceeds360000bytes.');return raw;}
export function parseFiniteSupplyOffers(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>360000)throw Error('Choose offered source up to360000bytes.');return JSON.parse(serializeFiniteSupplyOffers(JSON.parse(raw)));}
