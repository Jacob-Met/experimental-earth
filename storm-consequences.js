import {validateProject} from './core.js';
import {validateStudy} from './study-contract.js';
import {assertMatchingEventSite} from './event-challenge.js';
import {THRESHOLD_TRANSFER_SCHEMA,reopenThresholdTransfer} from './threshold-event-transfer.js';
import {compareIntervention,INTERVENTION_METRICS,summarizeEffects} from './intervention-study.js';
export const STORM_CONSEQUENCE_WORK_LIMIT=3_000_000;
/** Same declared plans, each original storm; no event-frequency or climate inference. */
export function compareStormConsequences(bundle){
 if(bundle?.schema!==THRESHOLD_TRANSFER_SCHEMA)throw Error('Use an original two-event threshold investigation.');
 const first=bundle.calibrationProject,second=bundle.challengeProject,study=bundle.options?.study;
 validateProject(first);validateProject(second);validateStudy(study);
 // Both plans must already be declared in both sources. Never copy one into
 // an observed world or call different counterfactual layouts the same proposal.
 for(const target of ['existing','proposal'])assertMatchingEventSite(first,second,target);
 const work=3*study.ratesMmHr.length*first.width*first.height*(Math.ceil(first.weather.durationMinutes/first.weather.stepMinutes)+Math.ceil(second.weather.durationMinutes/second.weather.stepMinutes));
 const common={cellStepUpperBound:work,workLimit:STORM_CONSEQUENCE_WORK_LIMIT,
 firstReference:first.thresholdEvidence?.eventRef,secondReference:second.thresholdEvidence?.eventRef};
 const empty=status=>({...common,status,candidates:[],metrics:{},cells:[]});
 if(work>STORM_CONSEQUENCE_WORK_LIMIT)return empty('work-limit');
 const transfer=reopenThresholdTransfer(bundle);
 if(!transfer.survivingRatesMmHr.length)return {...empty('no-transferred-support'),transfer};
 const secondPairs=compareIntervention(second,{study,subset:'all'});
 if(secondPairs.status!=='compared')return {...empty('second-'+secondPairs.status),transfer};
 const candidates=transfer.consequences.map(firstPair=>{
  const secondPair=secondPairs.candidates.find(c=>c.rateMmHr===firstPair.rateMmHr);
  const changes=Object.fromEntries(Object.keys(INTERVENTION_METRICS).map(key=>[key,{
   firstDelta:firstPair.metrics[key].delta,secondDelta:secondPair.metrics[key].delta,
   acrossStorms:summarizeEffects([firstPair.metrics[key].delta,secondPair.metrics[key].delta])}]));
  return {rateMmHr:firstPair.rateMmHr,first:firstPair,second:secondPair,changes};
 });
 const metrics=Object.fromEntries(Object.keys(INTERVENTION_METRICS).map(key=>[key,{
  first:summarizeEffects(candidates.map(c=>c.changes[key].firstDelta)),
  second:summarizeEffects(candidates.map(c=>c.changes[key].secondDelta)),
  across:summarizeEffects(candidates.flatMap(c=>[c.changes[key].firstDelta,c.changes[key].secondDelta])),
  ratesWithStormSignReversal:candidates.filter(c=>c.changes[key].acrossStorms.direction==='reverses').map(c=>c.rateMmHr)}]));
 const cells=first.existing.map((_,cellIndex)=>({cellIndex,
  first:summarizeEffects(candidates.map(c=>c.first.peakDeltaMm[cellIndex])),
  second:summarizeEffects(candidates.map(c=>c.second.peakDeltaMm[cellIndex])),
  ratesWithStormSignReversal:candidates.filter(c=>summarizeEffects([c.first.peakDeltaMm[cellIndex],c.second.peakDeltaMm[cellIndex]]).direction==='reverses').map(c=>c.rateMmHr)}));
 return {...common,status:'compared',transfer,candidates,metrics,cells,
 semantics:'Each event uses its own original forcing and duration with the same declared existing and proposed physical plans. Every retained rate is unchanged across both events. A listed storm sign reversal occurs for the same rate, not by combining different rates. Totals describe each recorded horizon, not event-normalized performance, event frequency, climate robustness or field-validated intervention benefit. Local depth changes compare separate modeled peaks, not simultaneous depths.'};
}
