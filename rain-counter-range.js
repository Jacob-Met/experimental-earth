import{validateRainCounter}from'./rain-counter-original.js';import{DEPTH_UNITS}from'./observation-units.js';import{gaugeRational as Q}from'./rain-gauge-consistency.js';
export function counterRainRange(project,counter,stormMinutes){
 const original=validateRainCounter(project,counter);if(!Number.isFinite(stormMinutes)||stormMinutes<0||stormMinutes>project.weather.durationMinutes)throw Error('Use an admitted original storm end.');
 const rows=original.readings.map((reading,index)=>({reading,index})).filter(r=>r.reading.use==='calibration').map(({reading:r,index})=>{const unit=Q.from(DEPTH_UNITS[r.unit]),depth=Q.mul(Q.from(r.depth),unit),uncertainty=Q.mul(Q.from(r.uncertainty),unit);return{index,reading:r,time:Q.div(Q.from(Math.min(r.minute,stormMinutes)),Q.from(60)),low:Q.sub(depth,uncertainty),high:Q.add(depth,uncertainty)};});
 let lower=Q.zero,upper=Q.from(250),lowerCause={domain:'rain>=0'},upperCause={domain:'rain<=250'},impossible=null;const constraints=[];
 for(const a of [{index:null,time:Q.zero,low:Q.zero},...rows])for(const b of rows){
  // B>=low_i-R*t_i and B<=high_j-R*t_j: R*(t_j-t_i)<=high_j-low_i.
  const coefficient=Q.sub(b.time,a.time),rhs=Q.sub(b.high,a.low),cause={lowerRow:a.index,upperRow:b.index},sign=Q.cmp(coefficient,Q.zero);constraints.push({...cause,coefficient:Q.encode(coefficient),rhs:Q.encode(rhs)});
  if(sign===0n){if(Q.cmp(rhs,Q.zero)<0&&!impossible)impossible=cause;continue;}
  const bound=sign>0n?Q.div(rhs,coefficient):Q.div(Q.sub(Q.zero,rhs),Q.sub(Q.zero,coefficient));
  if(sign>0n&&Q.cmp(bound,upper)<0){upper=bound;upperCause=cause;}if(sign<0n&&Q.cmp(bound,lower)>0){lower=bound;lowerCause=cause;}
 }
 const empty=impossible!==null||Q.cmp(lower,upper)>0,causes=empty?(impossible?[impossible]:[lowerCause,upperCause]):[],indices=[...new Set(causes.flatMap(c=>[c.lowerRow,c.upperRow]).filter(i=>Number.isInteger(i)))];
 return{status:!rows.length?'no-calibration':empty?'inconsistent':'compatible-range',stormMinutes,calibrationCount:rows.length,lower:Q.encode(lower),upper:Q.encode(upper),constraints,witness:indices.map(index=>({index,reading:original.readings[index]})),witnessCauses:causes,meaning:'Exact projection of original cumulative calibration bands and one nonnegative common baseline onto constant rainfall0–250mm/h, conditional on the declared storm end. Held-aside readings do not restrict this range. A compatible rainfall interval is not a soil fit, a unique physical rate, or proof of original clock/reset/site declarations.'};
}
