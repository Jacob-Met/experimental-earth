import { validateSurfaceHeatStudy } from './surface-heat-contract.js';
import { advanceSurfaceHeat } from './surface-heat.js';
import { screenHeatReadings } from './surface-heat-evidence.js';

export const CHANGING_HEAT_EXCHANGE_SCHEMA = 'experimental-earth-changing-heat-exchange/1';
const targets = ['existing', 'proposal'];
const finite = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const sourced = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 600;
const pick = (v, fields) => Object.fromEntries(fields.map(k => [k, v[k]]));

/** Each offered history declares the complete exchange course of both layers.
 * Coefficients replace the retained constant exchange; they are not added to it.
 * No weather-to-coefficient conversion or fitted coefficient is implied.
 */
export function canonicalChangingHeatExchange(input) {
  if (!input || input.schema !== CHANGING_HEAT_EXCHANGE_SCHEMA || !input.heatStudy) throw Error('Retain a changing-exchange heat investigation');
  validateSurfaceHeatStudy(input.heatStudy);
  if (!sourced(input.associationSource)) throw Error('Declare the association of exchange histories and readings with this exposure');
  const study = input.heatStudy;
  const heatStudy = pick(study, ['schema', 'model', 'cellIndex', 'contextJson']);
  for (const target of targets) heatStudy[target] = pick(study[target], ['capacityJm2K', 'absorptivity', 'exchangeWm2K', 'initialC', 'source']);
  heatStudy.schedule = study.schedule.map(r => pick(r, ['minutes', 'incidentWm2', 'reservoirC', 'source']));
  if (!Array.isArray(input.histories) || input.histories.length < 2 || input.histories.length > 12) throw Error('Offer 2–12 complete exchange histories');
  const labels = new Set();
  const histories = input.histories.map(h => {
    if (!sourced(h?.label) || h.label.length > 60 || labels.has(h.label)) throw Error('Give exchange histories distinct labels of at most 60 characters');
    labels.add(h.label);
    if (!Array.isArray(h.intervals) || h.intervals.length !== study.schedule.length) throw Error('Every history must cover each original exposure interval');
    return {label:h.label, intervals:h.intervals.map(row => {
      const out = {};
      for (const target of targets) {
        if (!finite(row?.[target]?.exchangeWm2K, 0, 1000) || !sourced(row[target].source)) throw Error('Each layer and interval needs exchange 0–1000 W/(m²·K) and a source');
        out[target] = pick(row[target], ['exchangeWm2K', 'source']);
      }
      return out;
    })};
  });
  const duration = study.schedule.reduce((s,r) => s+r.minutes,0);
  if (!Array.isArray(input.readings) || input.readings.length > 100) throw Error('Retain at most 100 original temperature readings');
  const seen = new Set();
  const readings = input.readings.map(r => {
    const key = `${r?.target}:${r?.minute}`;
    if (!targets.includes(r?.target) || !finite(r.minute,0,duration) || !finite(r.temperatureC,-100,500) || !finite(r.halfWidthC,0,100) || !['calibration','challenge'].includes(r.use) || !sourced(r.source) || seen.has(key)) throw Error('Readings need distinct layer/time, supported temperature, uncertainty, role and source');
    seen.add(key);
    return pick(r,['target','minute','temperatureC','halfWidthC','use','source']);
  });
  const canonical = {schema:CHANGING_HEAT_EXCHANGE_SCHEMA,heatStudy,associationSource:input.associationSource,histories,readings};
  if (new TextEncoder().encode(JSON.stringify(canonical,null,2)).length > 256*1024) throw Error('Complete changing-exchange source exceeds the 256 KiB replay bound');
  return canonical;
}

function trajectory(study, history, target, times, work) {
  const layer=study[target];
  let minute=0, temperatureC=layer.initialC, inputJm2=0, exchangedJm2=0;
  const snapshot=()=>({minute,temperatureC,inputJm2,exchangedJm2,storedJm2:layer.capacityJm2K*(temperatureC-layer.initialC),balanceResidualJm2:inputJm2-exchangedJm2-layer.capacityJm2K*(temperatureC-layer.initialC)});
  const rows=[snapshot()];
  for (let i=0;i<study.schedule.length;i++) {
    const forcing=study.schedule[i],end=minute+forcing.minutes;
    const stops=[...times.filter(t=>t>minute&&t<end),end];
    for(const stop of stops) {
      if (++work.used>work.limit) throw Error('Changing-exchange work budget exhausted');
      const result=advanceSurfaceHeat({...layer,exchangeWm2K:history.intervals[i][target].exchangeWm2K},forcing,temperatureC,(stop-minute)*60);
      temperatureC=result.temperatureC;inputJm2+=result.inputJm2;exchangedJm2+=result.exchangedJm2;minute=stop;rows.push(snapshot());
    }
  }
  return rows;
}

/** Complete finite histories, with challenge rows unable to choose support.
 * Exact-real analytic interval propagation, evaluated with floating point.
 */
export function compareChangingHeatExchange(original,{workLimit=10000}={}) {
  const input=canonicalChangingHeatExchange(original), study=input.heatStudy;
  if (!Number.isSafeInteger(workLimit)||workLimit<1||workLimit>10000) throw Error('Unsupported changing-exchange work limit');
  const times=[...new Set(input.readings.map(r=>r.minute))].sort((a,b)=>a-b);
  const upperBound=input.histories.length*2*(study.schedule.length+times.length);
  if(upperBound>workLimit) throw Error('Complete changing-exchange comparison exceeds work budget before execution');
  const work={used:0,limit:workLimit};
  const candidates=input.histories.map(history=>{
    const courses=Object.fromEntries(targets.map(target=>[target,trajectory(study,history,target,times,work)]));
    const rows=input.readings.map((r,index)=>{
      const predictionC=courses[r.target].find(p=>p.minute===r.minute).temperatureC;
      const residualC=r.temperatureC-predictionC;
      const arithmeticGuardC=Number.EPSILON*128*Math.max(1,Math.abs(r.temperatureC),Math.abs(predictionC));
      return {index,target:r.target,minute:r.minute,use:r.use,predictionC,residualC,arithmeticGuardC,withinBand:Math.abs(residualC)<=r.halfWidthC+arithmeticGuardC};
    });
    const finalDifferenceC=courses.proposal.at(-1).temperatureC-courses.existing.at(-1).temperatureC;
    return {label:history.label,courses,finalDifferenceC,calibration:screenHeatReadings(rows.filter(r=>r.use==='calibration')),challenge:screenHeatReadings(rows.filter(r=>r.use==='challenge'))};
  });
  const supported=candidates.filter(c=>c.calibration.compatible===true);
  const surviving=supported.filter(c=>c.challenge.compatible!==false);
  const range=list=>list.length?{minimum:Math.min(...list.map(c=>c.finalDifferenceC)),maximum:Math.max(...list.map(c=>c.finalDifferenceC))}:null;
  return {candidates,calibrationLabels:supported.map(c=>c.label),survivingLabels:surviving.map(c=>c.label),finalDifferenceRanges:{all:range(candidates),calibration:range(supported),surviving:range(surviving)},workUsed:work.used,
    semantics:'Conditional uniform-layer temperature and energy under explicitly declared changing linear exchange. Coefficients replace constant exchange. No wind conversion, nonlinear radiation, evaporation, field validation or automatic adoption.'};
}

export const exportChangingHeatExchange=input=>JSON.stringify(canonicalChangingHeatExchange(input),null,2);
export function importChangingHeatExchange(text) {
  if(typeof text!=='string'||new TextEncoder().encode(text).length>256*1024) throw Error('Changing-exchange source file exceeds 256 KiB');
  return canonicalChangingHeatExchange(JSON.parse(text));
}
