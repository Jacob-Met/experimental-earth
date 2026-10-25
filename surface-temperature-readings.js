const number=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
const text=(v,limit)=>typeof v==='string'&&!!v.trim()&&v.length<=limit;
const fields=(value,allowed)=>Object.keys(value).every(key=>allowed.includes(key));

/** Shared original surface-temperature reading contract. Role labels describe
 * declared use, not independent acquisition or statistical independence. */
export function validateSurfaceTemperatureReadings(readings,duration) {
  if(!Array.isArray(readings)||readings.length>100)throw Error('Retain at most 100 sourced surface readings');
  const times=new Set();
  for(const r of readings) {
    const mean=r?.aggregation==='interval-mean';
    const instant=r?.aggregation===undefined||r?.aggregation==='instant';
    const identity=JSON.stringify([mean?'interval-mean':'instant',mean?r.fromMinute:null,r?.minute]);
    if(!r||!fields(r,['minute','temperatureC','halfWidthC','use','source','aggregation','fromMinute'])||
      (!mean&&!instant)||(mean?!number(r.fromMinute,0,duration)||!(r.fromMinute<r.minute):Object.hasOwn(r,'fromMinute'))||
      !number(r.minute,0,duration)||times.has(identity)||!number(r.temperatureC,-100,500)||
      !number(r.halfWidthC,0,100)||!['calibration','challenge'].includes(r.use)||!text(r.source,600)) {
      throw Error('Surface readings need unique times or nonempty averaging windows within the exposure, −100–500 °C, a 0–100 °C half-width, calibration/challenge use and sources');
    }
    times.add(identity);
  }
  return readings;
}
