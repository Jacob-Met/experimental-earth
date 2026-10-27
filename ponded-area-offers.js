import {compareUptakeArea,serializeUptakeArea,parseUptakeArea} from './ponded-uptake-area.js';
import {validateUptakeOffers,rankUptakeOffers} from './ponded-uptake-offers.js';
import {pondedInfiltration} from './wetting-front.js';
import {planComplementaryDepths} from './complementary-depth-plan.js';
export function compareAreaOffers(study,area,offer){
 const support=compareUptakeArea(study,area);validateUptakeOffers(study,offer);
 const candidates=support.hasCalibration?support.candidates.filter(c=>c.possibleAreaM2).map(c=>({...study.hypotheses.find(h=>h.id===c.id),possibleAreaM2:c.possibleAreaM2,support:c.support})):[];
 const rows=offer.times.map(x=>{if(!x.available||study.readings.some(r=>r.minute===x.minute))return {...x,status:x.available?'already-recorded':'unavailable',predictions:[],separatedPairs:[],unresolvedPairs:[]};if(x.minute<=Math.max(offer.afterMinute,study.readings.at(-1).minute))return {...x,status:'not-after-recorded-course',predictions:[],separatedPairs:[],unresolvedPairs:[]};
  const predictions=candidates.map(c=>{const depth=pondedInfiltration(c.initialCumulativeMm,c.conductivityMmHr,c.capillaryDriveMm,x.minute/60),low=depth*c.possibleAreaM2[0],high=depth*c.possibleAreaM2[1],guard=32*Number.EPSILON*Math.max(Number.MIN_VALUE,high);return {id:c.id,possibleAreaM2:c.possibleAreaM2,lowLiters:Math.max(0,low-guard),highLiters:high+guard,readingLowLiters:Math.max(0,low-guard-x.uncertaintyLiters),readingHighLiters:high+guard+x.uncertaintyLiters};});
  const separatedPairs=[],unresolvedPairs=[];
  for(let i=0;i<predictions.length;i++)for(let j=i+1;j<predictions.length;j++){
   const a=predictions[i],b=predictions[j];let first,second;
   if(a.highLiters<b.lowLiters){first=a.highLiters;second=b.lowLiters;}else if(b.highLiters<a.lowLiters){first=a.lowLiters;second=b.highLiters;}else first=second=Math.max(a.lowLiters,b.lowLiters);
   // Nearest interval endpoints reduce robust pair separation to the maintained
   // point-band screen; overlap maps both predictions to a common point.
   const runs=[first,second].map(liters=>({snapshots:[{minute:0,depthsMm:[0]},{minute:x.minute,depthsMm:[liters/study.areaM2]}]}));
   const result=planComplementaryDepths(runs,{uncertaintyMm:x.uncertaintyLiters/study.areaM2,maxReadings:1});
   (result.separatedPairCount?separatedPairs:unresolvedPairs).push([a.id,b.id]);
  }
  return {...x,status:candidates.length<2?'insufficient-alternatives':separatedPairs.length?'planned':'indistinguishable',predictions,separatedPairs,unresolvedPairs};
 });
 const ranked=rankUptakeOffers(rows);return {status:!support.hasCalibration?'need-calibration':candidates.length<2?'insufficient-alternatives':ranked.length?'offered-question':'no-separating-offer',candidates,rows,preferredMinute:ranked[0]?.minute??null,policy:'Greatest robust pair coverage among supplied offers; earliest time breaks ties. Each explanation retains its own calibration-compatible common-area range. Bands include all remaining areas and the declared future volume bound; overlap stays unresolved. No held-aside fitting, probability or area adoption.'};
}
export function serializeAreaOffers(study,area,offer){compareAreaOffers(study,area,offer);const original=JSON.parse(serializeUptakeArea(study,area));const s=JSON.stringify({schema:'experimental-earth-area-offers/1',study:original.study,area:original.area,offer:{basis:offer.basis,afterMinute:offer.afterMinute,times:offer.times.map(({minute,available,uncertaintyLiters})=>({minute,available,uncertaintyLiters}))}},null,2);if(new TextEncoder().encode(s).length>160000)throw Error('Area offers exceed160000bytes.');return s;}
export function parseAreaOffers(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>160000)throw Error('Choose area offers up to160000bytes.');const s=JSON.parse(text);if(s.schema!=='experimental-earth-area-offers/1')throw Error('Wrong area offer format.');return JSON.parse(serializeAreaOffers(s.study,s.area,s.offer));}
