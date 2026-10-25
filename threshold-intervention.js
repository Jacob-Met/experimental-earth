import {validateProject} from './core.js';
import {DEFAULT_STUDY,validateStudy} from './study-contract.js';
import {compareThresholdEvidence} from './threshold-evidence.js';
import {compareIntervention,INTERVENTION_METRICS,summarizeEffects} from './intervention-study.js';
export function compareThresholdIntervention(project,{study=project.infiltrationStudy??DEFAULT_STUDY,subset='calibration'}={}){
 validateProject(project);validateStudy(study);
 if(!['calibration','surviving'].includes(subset))throw Error('Choose calibration or surviving threshold hypotheses');
 const empty=status=>({status,subset,candidates:[],metrics:{},cells:[]});
 // N original source runs plus 2N paired worlds, reserved before filtering.
 const work=3*study.ratesMmHr.length*project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
 if(work>3000000)return {...empty('work-limit'),cellStepUpperBound:work};
 const evidence=compareThresholdEvidence(project,study);
 if(['no-record','context-changed','surface-absent','work-limit'].includes(evidence.status))return {...empty(evidence.status),evidence};
 if(!evidence.counts.calibration)return {...empty('need-calibration'),evidence};
 if(subset==='surviving'&&!evidence.counts.challenge)return {...empty('need-challenge'),evidence};
 const rates=subset==='calibration'?evidence.compatibleRatesMmHr:evidence.survivingRatesMmHr;
 if(!rates.length)return {...empty('no-compatible-rates'),evidence};
 // Preserve original 2–9 study contract even if evidence retains one rate.
 const paired=compareIntervention(project,{study,subset:'all'});
 if(paired.status!=='compared')return {...empty(paired.status),evidence};
 const candidates=paired.candidates.filter(c=>rates.includes(c.rateMmHr));
 const metrics=Object.fromEntries(Object.keys(INTERVENTION_METRICS).map(key=>[key,summarizeEffects(candidates.map(c=>c.metrics[key].delta))]));
 const cells=project.existing.map((_,cellIndex)=>({cellIndex,...summarizeEffects(candidates.map(c=>c.peakDeltaMm[cellIndex]))}));
 return {status:'compared',subset,surface:study.surface,evidenceTarget:study.target,eventRef:project.thresholdEvidence.eventRef,evidence,candidates,metrics,cells,affected:paired.affected,cellStepUpperBound:work,
 semantics:'Finite declared rate consequences selected only by the original one-sided observation record. The same rate transfers to matching surfaces in both scenarios; all other assumptions remain fixed. Ranges are not probabilities, a unique physical explanation or an intervention recommendation. Cell values compare separate modeled peaks, not simultaneous depths.'};
}
