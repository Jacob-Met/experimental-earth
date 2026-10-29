import {validateRainCounter} from './rain-counter-original.js';
import {DEPTH_UNITS} from './observation-units.js';
import {rational as q,add,sub,mul,div,neg,cmp,serial,clip} from './vendor/chronos/exact-halfplanes.mjs';

// R is constant intensity; V=R*T/60 is total storm rain. Partition only at
// calibration clocks so each original rain contribution is affine in (R,V).
export function counterStormRegion(project,counter) {
 const original=validateRainCounter(project,counter), zero=q(0), one=q(1), sixty=q(60);
 const rows=original.readings.flatMap((reading,index)=>reading.use==='calibration'?[{reading,index}]:[]);
 const times=[...new Set([0,project.weather.durationMinutes,...rows.map(r=>r.reading.minute)])].sort((a,b)=>a-b);
 const pairs=(rows.length+1)*rows.length, cellCount=times.length-1;
 const reservedWork=cellCount*(pairs+2)*Math.min(244,4+pairs+2);
 if(reservedWork>200000)throw Error('Complete storm-region constraint work exceeds200000; no partial region returned.');
 const work={count:0,limit:200000},cells=[];
 for(let k=0;k<cellCount;k++) {
  const start=times[k],end=times[k+1];
  const bands=rows.map(({reading:r,index})=>{const u=q(DEPTH_UNITS[r.unit]),d=mul(q(r.depth),u),e=mul(q(r.uncertainty),u);return{index,low:sub(d,e),high:add(d,e),a:r.minute<=start?div(q(r.minute),sixty):zero,b:r.minute<=start?zero:one};});
  const constraints=[{a:div(q(start),sixty),b:neg(one),c:zero,domain:'storm>=start'},{a:neg(div(q(end),sixty)),b:one,c:zero,domain:'storm<=end'}];
  for(const lower of[{index:null,low:zero,a:zero,b:zero},...bands])for(const upper of bands)constraints.push({a:sub(upper.a,lower.a),b:sub(upper.b,lower.b),c:sub(upper.high,lower.low),lowerRow:lower.index,upperRow:upper.index});
  const maxR=q(250),maxV=div(mul(maxR,q(project.weather.durationMinutes)),sixty);
  let polygon=[[zero,zero],[maxR,zero],[maxR,maxV],[zero,maxV]];
  for(const c of constraints)polygon=clip(polygon,c.a,c.b,c.c,work);
  cells.push({startMinute:start,endMinute:end,vertices:polygon.map(([R,V])=>({rainMmHr:serial(R),totalRainMm:serial(V),stormMinutes:cmp(R,zero)>0?serial(div(mul(sixty,V),R)):null})),constraints:constraints.map(c=>({...c,a:serial(c.a),b:serial(c.b),c:serial(c.c)}))});
 }
 return{status:!rows.length?'no-calibration':cells.some(c=>c.vertices.length)?'compatible-region':'inconsistent',calibrationRows:rows.map(r=>({index:r.index,reading:r.reading})),cells,reservedWork,usedWork:work.count,meaning:'Exact constant-storm calibration region in intensity and total rain, with one shared nonnegative counter baseline. Storm end lies inside the original event and intensity in0–250mm/h. Held-aside readings do not partition or constrain this region. Zero rain leaves storm duration unresolved. Rational vertices are not necessarily representable native inputs; every numerical proposal requires original receiving. No soil fit or independent validation of clock/reset/site declarations is implied.'};
}

export function stormRegionContains(region,rainMmHr,stormMinutes) {
 if(!Number.isFinite(rainMmHr)||rainMmHr<0||rainMmHr>250||!Number.isFinite(stormMinutes)||stormMinutes<0)return false;
 const R=q(rainMmHr),V=div(mul(R,q(stormMinutes)),q(60)),decode=x=>[BigInt(x.numerator),BigInt(x.denominator)];
 return region.cells.some(cell=>stormMinutes>=cell.startMinute&&stormMinutes<=cell.endMinute&&cell.vertices.length&&cell.constraints.every(c=>cmp(add(mul(decode(c.a),R),mul(decode(c.b),V)),decode(c.c))<=0));
}
