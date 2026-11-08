import {runRain, validateProject} from './core.js';
import {compareIntervention, INTERVENTION_METRICS} from './intervention-study.js';
import {DEFAULT_STUDY,validateStudy} from './study-contract.js';
import {planComplementaryDepths} from './complementary-depth-plan.js';
import {normalizeDecisionCriterion,partitionDecisionCandidates,decisionCriterionContext} from './decision-criterion.js';

export const DECISION_DEPTH_PAIR_SCHEMA='experimental-earth-decision-depth-pair/1';
export const DECISION_DEPTH_PAIR_CRITERION_SCHEMA='experimental-earth-decision-depth-pair/2';
export function exportDecisionDepthPlan(project,options){
 planDecisionDepths(project,options);
 const criterion=normalizeDecisionCriterion(options.criterion);
 const text=JSON.stringify({schema:criterion===undefined?DECISION_DEPTH_PAIR_SCHEMA:DECISION_DEPTH_PAIR_CRITERION_SCHEMA,project,options:{metric:options.metric??'exitLiters',uncertaintyMm:options.uncertaintyMm??1,...(criterion===undefined?{}:{criterion}),...(options.availability?{availability:options.availability}:{}),study:options.study??project.infiltrationStudy??DEFAULT_STUDY}},null,2);
 if(new TextEncoder().encode(text).length>4*1024*1024)throw Error('Investigation exceeds 4 MiB');
 return text;
}
export function reopenDecisionDepthPlan(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>4*1024*1024)throw Error('Investigation exceeds 4 MiB');
 const input=JSON.parse(text);if(![DECISION_DEPTH_PAIR_SCHEMA,DECISION_DEPTH_PAIR_CRITERION_SCHEMA].includes(input?.schema))throw Error('Unsupported decision depth investigation');
 const hasCriterion=input.options!=null&&Object.hasOwn(input.options,'criterion');
 if(input.schema===DECISION_DEPTH_PAIR_CRITERION_SCHEMA){
  if(!hasCriterion||normalizeDecisionCriterion(input.options.criterion)===undefined)throw Error('Version 2 decision depth investigation requires an explicit criterion');
 }else if(hasCriterion)throw Error('Version 1 decision depth investigation cannot contain a criterion');
 return {...input,report:planDecisionDepths(input.project,input.options)};
}

/** Finite prospective pair coverage for proposal-decision disagreement. Calibration
 * supports the alternatives; held-aside values never choose the questions. */
export function planDecisionDepths(project,{metric='exitLiters',uncertaintyMm=1,availability,study=project.infiltrationStudy??DEFAULT_STUDY,criterion}={}){
 validateProject(project);validateStudy(study);
 criterion=normalizeDecisionCriterion(criterion);
 if(!Object.hasOwn(INTERVENTION_METRICS,metric))throw Error('Choose a supported proposal outcome');
 if(!Number.isFinite(uncertaintyMm)||uncertaintyMm<0||uncertaintyMm>1000)throw Error('Choose a depth tolerance from 0–1000 mm');
 const work=study.ratesMmHr.length*4*project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
 if(work>3000000)throw Error('Decision plan exceeds three million cell-steps');
 const comparison=compareIntervention(project,{study,subset:'calibration'});
 if(comparison.status!=='compared')return {status:comparison.status,metric};
 const candidates=comparison.candidates.slice().sort((a,b)=>a.rateMmHr-b.rateMmHr);
 const groups=partitionDecisionCandidates(candidates,metric,criterion),{pairIndices}=groups;
 const context={metric,study:structuredClone(study),candidates,cellStepUpperBound:work,...decisionCriterionContext(groups)};
 if(!pairIndices.length)return criterion===undefined?{...context,status:'no-reversal'}:
  {...context,status:'no-decision-disagreement',criterionAgreement:groups.meets.length===candidates.length?'all-meet':'all-miss'};
 const runs=candidates.map(c=>runRain(project[study.target],project.width,project.height,project.weather,{surfaceInfiltrationOverride:{surface:study.surface,rateMmHr:c.rateMmHr}}));
 const options={uncertaintyMm,availability,pairIndices,recorded:project.observations.filter(o=>o.scenario===study.target)};
 const single=planComplementaryDepths(runs,{...options,maxReadings:1});
 const plan=planComplementaryDepths(runs,{...options,maxReadings:2,strategy:'exact-pair'});
 return {...context,status:plan.status,single,plan,additionalSeparatedPairs:plan.separatedPairCount-single.separatedPairCount};
}
