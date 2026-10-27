import {validatePondedUptake,comparePondedUptake,serializePondedUptake} from './ponded-uptake.js';
import {pondedInfiltration} from './wetting-front.js';
export const AREA_FILE_LIMIT=140000;
export function validateArea(study,area){validatePondedUptake(study);if(!area||!Number.isFinite(area.lowM2)||!Number.isFinite(area.highM2)||area.lowM2<.0001||area.highM2>100||area.lowM2>study.areaM2||area.highM2<study.areaM2||typeof area.source!=='string'||!area.source.trim()||area.source.length>1000)throw Error('Declare a sourced positive area range (0.0001–100 m²) containing the original nominal area.');return area;}
const intersect=(a,b)=>[Math.max(a[0],b[0]),Math.min(a[1],b[1])];
const present=a=>a[0]<=a[1];
export function compareUptakeArea(study,area){
 validateArea(study,area);const declared=[area.lowM2,area.highM2],hasCalibration=study.readings.some(r=>r.role==='calibration');
 const exact=area.lowM2===area.highM2?comparePondedUptake(study):null;
 const candidates=study.hypotheses.map((h,hi)=>{
  const rows=study.readings.map((r,ri)=>{const scale=r.unit==='mL'?.001:1,low=Math.max(0,(r.volume-r.uncertainty)*scale),high=(r.volume+r.uncertainty)*scale,depth=pondedInfiltration(h.initialCumulativeMm,h.conductivityMmHr,h.capillaryDriveMm,r.minute/60);
   const guard=32*Number.EPSILON*Math.max(Number.MIN_VALUE,Math.abs(low),Math.abs(high),depth*area.highM2);
   let outer,inner;
   if(exact){const c=exact.candidates[hi].predictions[ri].classification;outer=c==='outside'?[1,0]:declared;inner=c==='within'?declared:[1,0];}
   else if(depth===0){outer=low<=guard?declared:[1,0];inner=low+guard<0&&high-guard>0?declared:[1,0];}
   else{outer=intersect(declared,[(low-guard)/depth,(high+guard)/depth]);inner=intersect(declared,[(low+guard)/depth,(high-guard)/depth]);}
   return {...r,depthMm:depth,lowLiters:low,highLiters:high,arithmeticGuardLiters:guard,possibleAreaM2:present(outer)?outer:null,interiorAreaM2:present(inner)?inner:null};
  });
  let outer=declared,inner=declared;
  for(const r of rows.filter(r=>r.role==='calibration')){outer=intersect(outer,r.possibleAreaM2??[1,0]);inner=intersect(inner,r.interiorAreaM2??[1,0]);}
  const support=!hasCalibration?'need-calibration':!present(outer)?'excluded':present(inner)&&(exact||inner[0]<inner[1])?'supported':'numerical-boundary';
  const possibleAreaM2=present(outer)?outer:null;
  const challenges=rows.filter(r=>r.role==='challenge').map(r=>{let status=hasCalibration?'no-calibration-support':'need-calibration';if(hasCalibration&&possibleAreaM2){const overlap=intersect(outer,r.possibleAreaM2??[1,0]);status=!present(overlap)?'contradicts-all':r.interiorAreaM2&&outer[0]>=r.interiorAreaM2[0]&&outer[1]<=r.interiorAreaM2[1]?'within-for-all':'area-sensitive-or-boundary';}return {...r,status};});
  return {id:h.id,support,possibleAreaM2,interiorAreaM2:present(inner)?inner:null,calibrationRows:rows.filter(r=>r.role==='calibration'),challenges};
 });
 return {hasCalibration,declaredAreaM2:declared,candidates,qualification:'One common area across calibration only. Possible ranges include an explicit arithmetic guard; supported interiors do not establish physical accuracy. Held-aside readings never shrink calibration support. No area or soil property is adopted.'};
}
export function serializeUptakeArea(study,area){validateArea(study,area);const s=JSON.stringify({schema:'experimental-earth-uptake-area/1',study:JSON.parse(serializePondedUptake(study)),area:{lowM2:area.lowM2,highM2:area.highM2,source:area.source}},null,2);if(new TextEncoder().encode(s).length>AREA_FILE_LIMIT)throw Error('Area study exceeds140000bytes.');return s;}
export function parseUptakeArea(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>AREA_FILE_LIMIT)throw Error('Choose an area study up to140000bytes.');const x=JSON.parse(text);if(x.schema!=='experimental-earth-uptake-area/1')throw Error('Wrong area study format.');return JSON.parse(serializeUptakeArea(x.study,x.area));}
