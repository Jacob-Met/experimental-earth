import {validateRainGauge} from './rain-gauge-evidence.js';
import {DEPTH_UNITS} from './observation-units.js';
// Exact rational arithmetic on the admitted binary64 inputs. At most 64 rows;
// no grid solver or search over rates. This tests declared bands, not epsilon-expanded bands.
const gcd=(a,b)=>{while(b){[a,b]=[b,a%b];}return a<0n?-a:a;};
const rat=(n,d=1n)=>{const g=gcd(n,d);return {n:n/g,d:d/g};};
const from=x=>{if(x===0)return rat(0n);const v=new DataView(new ArrayBuffer(8));v.setFloat64(0,x);const bits=v.getBigUint64(0),ex=Number((bits>>52n)&2047n),m=(bits&((1n<<52n)-1n))+(ex?1n<<52n:0n),e=(ex||1)-1075;return e>=0?rat(m<<BigInt(e)):rat(m,1n<<BigInt(-e));};
const add=(a,b)=>rat(a.n*b.d+b.n*a.d,a.d*b.d),sub=(a,b)=>rat(a.n*b.d-b.n*a.d,a.d*b.d),mul=(a,b)=>rat(a.n*b.n,a.d*b.d),div=(a,b)=>rat(a.n*b.d,a.d*b.n),cmp=(a,b)=>a.n*b.d-b.n*a.d;
const zero=rat(0n),sixty=rat(60n);
const encode=r=>r===null?null:{numerator:String(r.n),denominator:String(r.d)};
export function rainfallConsistency(project,gauge,offeredRates=[]){
 const original=validateRainGauge(project,gauge);
 if(!Array.isArray(offeredRates)||offeredRates.length>64||Array.from(offeredRates).some(v=>!Number.isFinite(v)||v<0))throw Error('Supply at most 64 finite nonnegative offered rainfall rates.');
 let lower=zero,upper=null,lowerRow=null,upperRow=null;const constraints=[],contradictions=[];
 for(const [index,r]of original.readings.entries()){
  if(r.use!=='calibration')continue;
  const unit=from(DEPTH_UNITS[r.unit]),depth=mul(from(r.depth),unit),bound=mul(from(r.uncertainty),unit),rawLow=sub(depth,bound),low=cmp(rawLow,zero)>0?rawLow:zero,high=add(depth,bound);
  const overlap=sub(from(Math.min(r.endMinute,project.weather.stormMinutes)),from(Math.min(r.startMinute,project.weather.stormMinutes)));
  if(overlap.n===0n){constraints.push({index,reading:r,lower:encode(zero),upper:null,zeroOverlap:true});if(low.n>0n)contradictions.push(index);continue;}
  const lo=div(mul(low,sixty),overlap),hi=div(mul(high,sixty),overlap);
  constraints.push({index,reading:r,lower:encode(lo),upper:encode(hi),zeroOverlap:false});
  if(cmp(lo,lower)>0){lower=lo;lowerRow=index;}if(upper===null||cmp(hi,upper)<0){upper=hi;upperRow=index;}
 }
 const empty=contradictions.length>0||(upper!==null&&cmp(lower,upper)>0),witness=contradictions.length?[contradictions[0]]:empty?[lowerRow,upperRow]:[];
 const calibrationCount=constraints.length;
 const compatibleOfferedRates=empty?[]:offeredRates.filter(v=>cmp(from(v),lower)>=0&&(upper===null||cmp(from(v),upper)<=0));
 return {status:!calibrationCount?'no-calibration':empty?'inconsistent':compatibleOfferedRates.length?'offered-rate-compatible':'compatible-range-unoffered',lower:encode(lower),upper:encode(upper),constraints,witness:witness.map(index=>({index,reading:original.readings[index]})),compatibleOfferedRates,
 meaning:'Exact intersection of the supplied calibration rainfall bands under the declared constant storm support, using the represented numeric inputs and maintained units. Held-aside readings do not constrain this range. Numerical allowances in the finite-pair checker are separate from supplied uncertainty; near-boundary differences do not establish physical contradiction. A compatible rainfall range does not establish a soil fit or verify event/site association.'};
}

// Shared exact arithmetic for bounded original rainfall interval constraints.
export const gaugeRational={from,add,sub,mul,div,cmp,zero,encode};
