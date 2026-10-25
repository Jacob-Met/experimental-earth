import {COOLING_FILE_LIMIT,validateCoolingStudy,prepareCooling,evaluateCoolingTarget} from './evaporative-cooling.js';
import {validateSurfaceTemperatureReadings} from './surface-temperature-readings.js';

export const COOLING_FRACTION_SCHEMA='experimental-earth-cooling-fraction/1';
export const COOLING_FRACTION_MEANING='One constant fraction must explain every retained reading under the same original water, demand, heat and material declarations. The fraction assigns plant latent energy to this effective thermal surface; it is not a crop coefficient, measured evaporation, unique physical cause or an adopted parameter. Calibration and held-aside intervals are retained separately. Numerical comparison guards are engineering roundoff allowances, not measurement uncertainty, probabilities or certified bounds.';
const finite=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
const source=s=>typeof s==='string'&&!!s.trim()&&s.length<=600;
function exact(x,keys,label) {
  if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(x,k)))throw Error('Invalid '+label+' fields');
}
export function validateCoolingFractionEvidence(study,evidence) {
  exact(evidence,['schema','target','fractionRange','rangeSource','associationSource','readings'],'cooling fraction evidence');
  const r=evidence.fractionRange;
  if(evidence.schema!==COOLING_FRACTION_SCHEMA||!['existing','proposal'].includes(evidence.target)||
    !Array.isArray(r)||r.length!==2||!r.every(v=>finite(v,0,1))||r[0]>r[1]||!source(evidence.rangeSource)||!source(evidence.associationSource))
    throw Error('Declare a selected place, ordered fraction range within 0–1 and original range/reading sources');
  const duration=study.heatColumn.heatStudy.schedule.reduce((n,r)=>n+r.minutes,0);
  validateSurfaceTemperatureReadings(evidence.readings,duration);
  return evidence;
}
export const intersectCoolingFractionRanges=(a,b)=>!a||!b||Math.max(a[0],b[0])>Math.min(a[1],b[1])?null:[Math.max(a[0],b[0]),Math.min(a[1],b[1])];
export function constrainCoolingFractionReading(range,a,b,reading,guard) {
  const lo=reading.temperatureC-reading.halfWidthC-guard,hi=reading.temperatureC+reading.halfWidthC+guard,delta=b-a;
  if(delta===0)return a>=lo&&a<=hi?[...range]:null;
  const u=(lo-a)/delta,v=(hi-a)/delta,left=Math.max(0,Math.min(u,v)),right=Math.min(1,Math.max(u,v));
  if(left>right)return null;
  // Interpolate in a normalized coordinate. A very narrow declared fraction
  // range never requires dividing by that range's width.
  const at=x=>x===0?range[0]:x===1?range[1]:range[0]+x*(range[1]-range[0]);
  return [at(left),at(right)];
}
export function coolingFractionArithmeticGuard(study,target,predictions,reading,segments=study.heatColumn.heatStudy.schedule.length) {
  const top=study.heatColumn.heatStudy[target],lower=study.heatColumn.lowerLayers[target];
  const scales=predictions.flatMap(p=>[Math.abs(p.value),Math.abs(p.end.surfaceC),Math.abs(p.end.subsurfaceC),
    (Math.abs(p.end.inputJm2)+Math.abs(p.end.exchangeOutJm2)+Math.abs(p.end.transferDownJm2)+Math.abs(p.end.surfaceLossJm2))/top.capacityJm2K+
      Math.abs(p.end.transferDownJm2)/lower.capacityJm2K]);
  return Number.EPSILON*4096*segments*Math.max(1,Math.abs(reading.temperatureC),Math.abs(top.initialC),Math.abs(lower.initialC),...scales);
}

export function compareCoolingFractions(project,study,evidence) {
  validateCoolingStudy(project,study);validateCoolingFractionEvidence(study,evidence);
  const original=prepareCooling(project,study),target=evidence.target;
  const times=evidence.readings.map(r=>r.minute),windows=evidence.readings.filter(r=>r.aggregation==='interval-mean').map(r=>({fromMinute:r.fromMinute,minute:r.minute}));
  // Water is computed once. Thermal endpoint evaluations use the declared
  // range, avoiding an unsupported extrapolation to 0 or 1 outside that range.
  const courses=evidence.fractionRange.map(fraction=>{
    const variant={...original,study:{...original.study,surfaceLatentFraction:{...original.study.surfaceLatentFraction,[target]:fraction}}};
    const evaluated=evaluateCoolingTarget(variant,target,times,windows);
    return {fraction,byTime:new Map(evaluated.trajectory.map(row=>[row.minute,row])),
      byWindow:new Map(evaluated.averages.map(row=>[JSON.stringify([row.fromMinute,row.minute]),row]))};
  });
  const rows=evidence.readings.map((reading,index)=>{
    const predictions=courses.map(c=>({end:c.byTime.get(reading.minute),value:reading.aggregation==='interval-mean'?
      c.byWindow.get(JSON.stringify([reading.fromMinute,reading.minute])).surfaceMeanC:c.byTime.get(reading.minute).surfaceC}));
    const values=predictions.map(p=>p.value),guard=coolingFractionArithmeticGuard(study,target,predictions,reading);
    return {index,reading:structuredClone(reading),predictionsAtRangeEndsC:values,arithmeticGuardC:guard,
      compatibleFractionRange:constrainCoolingFractionReading(evidence.fractionRange,values[0],values[1],reading,guard),
      sensitivity:evidence.fractionRange[0]===evidence.fractionRange[1]?'fixed-range':values[0]===values[1]?'none':'varying'};
  });
  const {counts,calibrationRange,challengeRange,survivingRange,status}=summarizeCoolingFractionRows(evidence,rows);
  return {schema:'experimental-earth-cooling-fraction-result/1',evidence:structuredClone(evidence),durationMinutes:original.durationMinutes,
    originalWater:structuredClone(original.initial[target]),model:original,rows,counts,calibrationRange,challengeRange,survivingRange,status,meaning:COOLING_FRACTION_MEANING};
}

export function inspectCoolingFraction(result,minute) {
  if(result?.schema!=='experimental-earth-cooling-fraction-result/1'||!finite(minute,0,result.durationMinutes))throw Error('Inspect a time inside the retained cooling evidence exposure');
  const target=result.evidence.target,domain=result.evidence.fractionRange,original=result.model;
  const endpoints=domain.map(f=>evaluateCoolingTarget({...original,study:{...original.study,surfaceLatentFraction:{...original.study.surfaceLatentFraction,[target]:f}}},target,[minute]).trajectory.find(r=>r.minute===minute).surfaceC);
  const predictions=range=>{
    if(!range)return null;
    const values=range.map(f=>domain[0]===domain[1]?endpoints[0]:endpoints[0]+(endpoints[1]-endpoints[0])*((f-domain[0])/(domain[1]-domain[0])));
    return [Math.min(...values),Math.max(...values)];
  };
  return {minute,predictionsAtDeclaredEndsC:endpoints,calibrationPredictionRangeC:predictions(result.calibrationRange),survivingPredictionRangeC:predictions(result.survivingRange)};
}

export function authoredCoolingFractionReadings(project,study,target='proposal') {
  validateCoolingStudy(project,study);
  const original=prepareCooling(project,study),sample={...original,study:{...original.study,surfaceLatentFraction:{...original.study.surfaceLatentFraction,[target]:.4}}};
  const times=[original.durationMinutes/8,original.durationMinutes];
  const course=evaluateCoolingTarget(sample,target,times);
  return {schema:COOLING_FRACTION_SCHEMA,target,fractionRange:[0,1],rangeSource:'Authored complete 0–1 fraction comparison; no field restriction was measured',
    associationSource:'Authored surface-temperature control generated from the retained cooling source with fraction 0.4. No sensor acquisition or independent field validation.',
    readings:times.map((minute,i)=>({minute,temperatureC:course.trajectory.find(r=>r.minute===minute).surfaceC,halfWidthC:.2,use:i?'challenge':'calibration',
      source:'Authored analytic temperature at fraction 0.4; the role illustrates data use and does not establish held-aside acquisition'}))};
}

export function serializeCoolingFraction(project,study,evidence) {
  validateCoolingStudy(project,study);validateCoolingFractionEvidence(study,evidence);
  const text=JSON.stringify({schema:'experimental-earth-cooling-fraction-investigation/1',project,study,evidence},null,2);
  if(new TextEncoder().encode(text).length>COOLING_FILE_LIMIT)throw Error('Cooling evidence investigation exceeds 5 MiB');
  return text;
}
export function parseCoolingFraction(text) {
  if(typeof text!=='string'||new TextEncoder().encode(text).length>COOLING_FILE_LIMIT)throw Error('Cooling evidence file must be UTF-8 JSON up to 5 MiB');
  const x=JSON.parse(text);exact(x,['schema','project','study','evidence'],'cooling evidence file');
  if(x.schema!=='experimental-earth-cooling-fraction-investigation/1')throw Error('Unsupported cooling evidence investigation');
  validateCoolingStudy(x.project,x.study);validateCoolingFractionEvidence(x.study,x.evidence);return x;
}

/** The same whole-reading intersection and declared-use status for affine cooling sources. */
export function summarizeCoolingFractionRows(evidence,rows){
  const retain=use=>rows.filter(r=>r.reading.use===use).reduce((range,row)=>intersectCoolingFractionRanges(range,row.compatibleFractionRange),[...evidence.fractionRange]);
  const calibrationRange=retain('calibration'),challengeRange=retain('challenge'),survivingRange=intersectCoolingFractionRanges(calibrationRange,challengeRange);
  const counts={calibration:rows.filter(r=>r.reading.use==='calibration').length,challenge:rows.filter(r=>r.reading.use==='challenge').length};
  const status=!counts.calibration?'need-calibration':!calibrationRange?'calibration-rejected':!counts.challenge?'needs-challenge':!survivingRange?'challenged':'compatible-range';
  return {counts,calibrationRange,challengeRange,survivingRange,status};
}
