import {validateProject} from './core.js';
import {DEFAULT_STUDY,validateStudy} from './study-contract.js';
import {assertMatchingEventSite} from './event-challenge.js';
import {compareThresholdEvidence} from './threshold-evidence.js';
import {compareThresholdIntervention} from './threshold-intervention.js';
import {INTERVENTION_METRICS,summarizeEffects} from './intervention-study.js';
export const THRESHOLD_TRANSFER_SCHEMA='experimental-earth-threshold-event-transfer/1';
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
/** An independent declared event can reject fixed rates, never tune first evidence. */
export function compareThresholdEvents(first,second,{study=first.infiltrationStudy??DEFAULT_STUDY,independence}={}){
 validateProject(first);validateProject(second);validateStudy(study);
 requireThat(typeof independence==='string'&&independence.trim()&&independence.length<=400,'Describe why the second event is independently held aside (up to 400 characters).');
 const a=first.thresholdEvidence,b=second.thresholdEvidence;
 requireThat(a&&b,'Both events need their original one-sided observation records.');
 requireThat(a.eventRef.trim()!==b.eventRef.trim(),'Use distinct event references; a renamed copy is not independent evidence.');
 requireThat(a.target===study.target&&b.target===study.target,'Both original records must describe the selected observed scenario.');
 assertMatchingEventSite(first,second,study.target);
 requireThat(!b.readings.some(r=>r.use==='calibration'),'Second-event calibration bounds cannot be silently relabeled as held aside.');
 requireThat(b.readings.some(r=>r.use==='challenge'),'The second event needs explicitly held-aside bounds.');
 const cellSteps=study.ratesMmHr.length*first.width*first.height*(3*Math.ceil(first.weather.durationMinutes/first.weather.stepMinutes)+Math.ceil(second.weather.durationMinutes/second.weather.stepMinutes));
 const common={calibrationReference:a.eventRef,challengeReference:b.eventRef,independence:independence.trim(),cellStepUpperBound:cellSteps};
 const empty=status=>({...common,status,candidates:[],survivingRatesMmHr:[],metrics:{},cells:[]});
 if(cellSteps>3000000)return empty('work-limit');
 const firstEffects=compareThresholdIntervention(first,{study,subset:'calibration'});
 if(firstEffects.status!=='compared')return {...empty('first-'+firstEffects.status),firstEffects};
 const challenge=compareThresholdEvidence(second,study);
 if(!challenge.candidates.length)return {...empty('second-'+challenge.status),firstEffects,challenge};
 const candidates=firstEffects.evidence.candidates.map(c=>({...c,secondEvent:challenge.candidates.find(s=>s.rateMmHr===c.rateMmHr).challenge,
 survives:c.calibration.compatible===true&&c.challenge.compatible!==false&&challenge.candidates.find(s=>s.rateMmHr===c.rateMmHr).challenge.compatible===true}));
 const survivingRatesMmHr=candidates.filter(c=>c.survives).map(c=>c.rateMmHr);
 const retained=firstEffects.candidates.filter(c=>survivingRatesMmHr.includes(c.rateMmHr));
 if(!retained.length)return {...empty('challenged'),firstEffects,challenge,candidates};
 const metrics=Object.fromEntries(Object.keys(INTERVENTION_METRICS).map(k=>[k,summarizeEffects(retained.map(c=>c.metrics[k].delta))]));
 const cells=first.existing.map((_,cellIndex)=>({cellIndex,...summarizeEffects(retained.map(c=>c.peakDeltaMm[cellIndex]))}));
 return {...common,status:retained.length===1?'one-survivor':'ambiguous',firstEffects,challenge,candidates,survivingRatesMmHr,consequences:retained,metrics,cells,
 limitation:'Independent events and unchanged material rates are explicit user declarations. Second-event readings only reject offered rates; consequences remain paired under the original first-event forcing. Agreement is not physical calibration, proof of independence or transfer to an unseen site.'};
}
export function prepareThresholdTransfer(first,second,options){
 const bundle=structuredClone({schema:THRESHOLD_TRANSFER_SCHEMA,calibrationProject:first,challengeProject:second,options:{...options,study:options?.study??first.infiltrationStudy??DEFAULT_STUDY}});
 return {bundle,report:compareThresholdEvents(bundle.calibrationProject,bundle.challengeProject,bundle.options)};
}
export function makeThresholdTransfer(first,second,options){return prepareThresholdTransfer(first,second,options).bundle;}
export function reopenThresholdTransfer(bundle){
 requireThat(bundle?.schema===THRESHOLD_TRANSFER_SCHEMA,'Unsupported threshold-event transfer');
 validateStudy(bundle.options?.study);
 return compareThresholdEvents(bundle.calibrationProject,bundle.challengeProject,bundle.options);
}

export const MAX_THRESHOLD_TRANSFER_BYTES=8*1024*1024;
export function serializeThresholdTransfer(bundle){
 requireThat(bundle?.schema===THRESHOLD_TRANSFER_SCHEMA,'Unsupported threshold-event transfer');
 // Preserve original projects and declarations only; derived imported verdicts are omitted.
 const raw={schema:THRESHOLD_TRANSFER_SCHEMA,calibrationProject:bundle.calibrationProject,challengeProject:bundle.challengeProject,options:bundle.options};
 let text=JSON.stringify(raw,null,2);
 if(new TextEncoder().encode(text).length>MAX_THRESHOLD_TRANSFER_BYTES)text=JSON.stringify(raw);
 requireThat(new TextEncoder().encode(text).length<=MAX_THRESHOLD_TRANSFER_BYTES,'The complete two-event source exceeds 8 MiB; no source evidence was dropped.');
 return text;
}
export function parseThresholdTransfer(text){
 requireThat(typeof text==='string'&&new TextEncoder().encode(text).length<=MAX_THRESHOLD_TRANSFER_BYTES,'Threshold transfer input must be text of at most 8 MiB.');
 const bundle=JSON.parse(text);return {bundle,report:reopenThresholdTransfer(bundle)};
}
