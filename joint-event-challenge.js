import {validateProject} from './core.js';
import {compareJointEvidence,prepareJointStudy} from './joint-evidence.js';
import {validateJointStudy,readingIdentity} from './joint-evidence-contract.js';
import {assertMatchingEventSite} from './event-challenge.js';
import {OUTLET_WORK_LIMIT} from './outlet-evidence.js';
export const JOINT_EVENT_SCHEMA='experimental-earth-joint-event-challenge/1';
const requireThat=(condition,message)=>{if(!condition)throw Error(message);};
function declaration(value){requireThat(typeof value==='string'&&value.trim()&&value.length<=400,'Describe why the second event is independently held aside (up to 400 characters).');return value.trim();}
function admit(first,second,secondStudy,independence){
 validateProject(first);validateProject(second);validateJointStudy(first.jointEvidenceStudy);validateJointStudy(secondStudy);declaration(independence);
 const study=first.jointEvidenceStudy,a=first.outletEvidence,b=second.outletEvidence;
 requireThat(study&&a&&b,'Both events need retained outlet records and the first needs a saved joint pair set.');
 requireThat(a.eventRef.trim()!==b.eventRef.trim(),'Use distinct event references; a copied event is not an independent challenge.');
 requireThat(b.target===study.target&&secondStudy?.target===study.target,'Both collections must describe the same observed scenario.');
 requireThat(secondStudy.surface===study.surface&&readingIdentity(secondStudy.pairs)===readingIdentity(study.pairs),'The second event must use the exact first-event surface, pairs, labels and order without retuning.');
 assertMatchingEventSite(first,second,study.target,{explicitOutletPairs:true});
 requireThat(!b.readings.some(r=>r.use==='calibration')&&!second.observations.some(r=>r.scenario===study.target&&r.use==='calibration'),'The second event contains calibration evidence; it cannot be silently relabeled as held aside.');
 return {study,a,b};
}
/** Transfer fixed finite hypotheses. Second-event values can reject, never refit or rank. */
export function compareJointEvents(first,second,secondStudy,independence){
 const {study,a,b}=admit(first,second,secondStudy,independence);
 const work=study.pairs.length*first.width*first.height*(Math.ceil(first.weather.durationMinutes/first.weather.stepMinutes)+Math.ceil(second.weather.durationMinutes/second.weather.stepMinutes));
 const common={calibrationReference:a.eventRef,challengeReference:b.eventRef,independence:declaration(independence),cellStepUpperBound:work,workLimit:OUTLET_WORK_LIMIT};
 if(work>OUTLET_WORK_LIMIT)return {...common,status:'work-limit',candidates:[],compatiblePairs:[],survivingPairs:[]};
 const calibration=compareJointEvidence(first),challenge=compareJointEvidence(second,secondStudy);
 requireThat(calibration.candidates.length>0,'First-event association is unavailable or stale: '+calibration.status);
 requireThat(challenge.candidates.length>0,'Second-event association is unavailable or stale: '+challenge.status);
 requireThat(calibration.counts.calibrationDepth+calibration.counts.calibrationVolume>0,'The first event needs assigned calibration evidence.');
 requireThat(challenge.counts.challengeDepth+challenge.counts.challengeVolume>0,'Explicitly associate held-aside depth or collection evidence from the second event.');
 const candidates=calibration.candidates.map((candidate,i)=>{
  const secondEvent=challenge.candidates[i].challenge;
  return {...candidate,secondEvent,survives:candidate.calibration.compatible===true&&candidate.challenge.compatible!==false&&secondEvent.compatible===true};
 });
 const survivingPairs=candidates.filter(c=>c.survives).map(c=>c.label);
 return {...common,status:!calibration.compatiblePairs.length?'calibration-rejected':!survivingPairs.length?'challenged':survivingPairs.length===1?'one-survivor':'ambiguous',candidates,compatiblePairs:calibration.compatiblePairs,survivingPairs,counts:{first:calibration.counts,second:challenge.counts},limitation:'Event identity and independence are user declarations. Passing these readings does not establish a unique physical pair or predictive accuracy on other events.'};
}
export function prepareJointEventChallenge(first,second,{depthIndices=[],depthAssociation='',independence=''}={}){
 validateProject(first);validateProject(second);requireThat(first.jointEvidenceStudy,'Save a first-event joint pair set before transferring it.');
 const study=first.jointEvidenceStudy,secondStudy=prepareJointStudy(second,{surface:study.surface,pairs:study.pairs,depthIndices,depthAssociation});
 const bundle=structuredClone({schema:JOINT_EVENT_SCHEMA,calibrationProject:first,challengeProject:second,challengeStudy:secondStudy,independence:declaration(independence)});
 return {bundle,report:reopenJointEventChallenge(bundle)};
}
export function makeJointEventChallenge(first,second,options){return prepareJointEventChallenge(first,second,options).bundle;}
export function reopenJointEventChallenge(bundle){
 requireThat(bundle&&bundle.schema===JOINT_EVENT_SCHEMA,'Unsupported joint two-event challenge.');
 return compareJointEvents(bundle.calibrationProject,bundle.challengeProject,bundle.challengeStudy,bundle.independence);
}
