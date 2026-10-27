import{rational as q,add,sub,mul,div,neg,cmp,enclosure,serial,clip,unique}from'./vendor/chronos/exact-halfplanes.mjs';
import{parseSharedInventory,serializeSharedInventory}from'./ponded-shared-inventory.js';
import{compareUptakeArea,validateArea}from'./ponded-uptake-area.js';
import{accountPondedWater}from'./ponded-water-accounting.js';
import{pondedInfiltration}from'./wetting-front.js';
const zero=q(0),one=q(1),max=(a,b)=>cmp(a,b)>0?a:b;
function bounds(r){const scale=r.unit==='mL'?div(one,q(1000)):one;return[mul(max(zero,sub(q(r.volume),q(r.uncertainty))),scale),mul(add(q(r.volume),q(r.uncertainty)),scale)];}
const rectangle=(area,inventory)=>area?unique([[q(area[0]),inventory[0]],[q(area[1]),inventory[0]],[q(area[1]),inventory[1]],[q(area[0]),inventory[1]]]):[];
const show=polygon=>polygon.map(([a,s])=>({areaM2:enclosure(a),initialInventoryLiters:enclosure(s),exact:{area:serial(a),inventory:serial(s)}}));
export function compareAreaInventory(sources,shared,area){
 const inquiry=parseSharedInventory(serializeSharedInventory(sources,shared)),rows=inquiry.comparisons,study=rows[0].study;
 validateArea(study,area);const calibration=compareUptakeArea(study,area),inventory=bounds(rows[0].account.surfaceStart),work={count:0,limit:200000};
 const candidates=study.hypotheses.map((h,i)=>{
  const cal=calibration.candidates[i];let outer=rectangle(cal.possibleAreaM2,inventory),inner=rectangle(cal.interiorAreaM2,inventory);
  const constraints=rows.map(({account})=>{
   const input=bounds(account.inputWater),end=bounds(account.surfaceEnd),loss=bounds(account.otherLoss),depth=pondedInfiltration(h.initialCumulativeMm,h.conductivityMmHr,h.capillaryDriveMm,account.minute/60);
   // depth*area - initialInventory = incoming - finalInventory - otherLoss.
   const lo=sub(sub(input[0],end[1]),loss[1]),hi=sub(sub(input[1],end[0]),loss[0]);
   const guard=Math.max(16*Number.MIN_VALUE,accountPondedWater(account).arithmeticGuardLiters+32*Number.EPSILON*Math.abs(depth*area.highM2)),g=q(guard),d=q(depth);
   outer=clip(outer,d,neg(one),add(hi,g),work);outer=clip(outer,neg(d),one,neg(sub(lo,g)),work);
   inner=clip(inner,d,neg(one),sub(hi,g),work);inner=clip(inner,neg(d),one,neg(add(lo,g)),work);
   return{minute:account.minute,depthMm:depth,arithmeticAllowanceLiters:guard};
  });
  const status=!calibration.hasCalibration?'need-calibration':cal.support==='excluded'?'originally-excluded':!outer.length?'no-common-area-and-inventory':inner.length?'common-area-and-inventory-supported':'numerical-boundary';
  return{id:h.id,originalAreaCalibration:cal.support,originalPossibleAreaM2:cal.possibleAreaM2,status,possiblePolygon:show(outer),interiorPolygon:show(inner),constraints};
 });
 return{area:{lowM2:area.lowM2,highM2:area.highM2,source:area.source},originalInitialInventory:rows[0].account.surfaceStart,shared:inquiry.shared,minutes:rows.map(r=>r.account.minute),candidates,work:work.count,qualification:'One original area and one original inventory must explain the complete course together. Calibration area remains determined only by original calibration rows. Exact clipping concerns stored numeric coefficients and engineering allowances, not certified soil physics. Polygon projections are conditional possibilities, not independently interchangeable fitted values. No measurement bounds, calibration, site ponding or adopted properties are changed.'};
}
export function serializeAreaInventory(sources,shared,area){compareAreaInventory(sources,shared,area);const inquiry=parseSharedInventory(serializeSharedInventory(sources,shared));const text=JSON.stringify({...inquiry,schema:'experimental-earth-area-inventory/1',area:{lowM2:area.lowM2,highM2:area.highM2,source:area.source}},null,2);if(new TextEncoder().encode(text).length>2110000)throw Error('Complete original area/inventory inquiry exceeds2110000bytes.');return text;}
export function parseAreaInventory(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>2110000)throw Error('Choose complete area/inventory source up to2110000bytes.');const x=JSON.parse(text);if(x.schema!=='experimental-earth-area-inventory/1')throw Error('Wrong area/inventory source format.');return JSON.parse(serializeAreaInventory(x.comparisons,x.shared,x.area));}
