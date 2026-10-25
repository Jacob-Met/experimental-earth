import {runRain, validateProject} from './core.js';
import {compareIntervention, INTERVENTION_METRICS} from './intervention-study.js';
import {DEFAULT_STUDY,validateStudy} from './study-contract.js';
import {planComplementaryDepths} from './complementary-depth-plan.js';

export const DECISION_DEPTH_PAIR_SCHEMA='experimental-earth-decision-depth-pair/1';
export function exportDecisionDepthPlan(project,options){
 planDecisionDepths(project,options);
 const text=JSON.stringify({schema:DECISION_DEPTH_PAIR_SCHEMA,project,options:{metric:options.metric??'exitLiters',uncertaintyMm:options.uncertaintyMm??1,...(options.availability?{availability:options.availability}:{}),study:options.study??project.infiltrationStudy??DEFAULT_STUDY}},null,2);
 if(new TextEncoder().encode(text).length>4*1024*1024)throw Error('Investigation exceeds 4 MiB');
 return text;
}
export function reopenDecisionDepthPlan(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>4*1024*1024)throw Error('Investigation exceeds 4 MiB');
 const input=JSON.parse(text);if(input?.schema!==DECISION_DEPTH_PAIR_SCHEMA)throw Error('Unsupported decision depth investigation');
 return {...input,report:planDecisionDepths(input.project,input.options)};
}

/** Finite prospective pair coverage for opposite proposal effects. Calibration
 * supports the alternatives; held-aside values never choose the questions. */
export function planDecisionDepths(project,{metric='exitLiters',uncertaintyMm=1,availability,study=project.infiltrationStudy??DEFAULT_STUDY}={}){
 validateProject(project);validateStudy(study);
 if(!Object.hasOwn(INTERVENTION_METRICS,metric))throw Error('Choose a supported proposal outcome');
 if(!Number.isFinite(uncertaintyMm)||uncertaintyMm<0||uncertaintyMm>1000)throw Error('Choose a depth tolerance from 0–1000 mm');
 const work=study.ratesMmHr.length*4*project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
 if(work>3000000)throw Error('Decision plan exceeds three million cell-steps');
 const comparison=compareIntervention(project,{study,subset:'calibration'});
 if(comparison.status!=='compared')return {status:comparison.status,metric};
 const candidates=comparison.candidates.slice().sort((a,b)=>a.rateMmHr-b.rateMmHr);
 const pairIndices=[];let index=0;
 for(let a=0;a<candidates.length;a++)for(let b=a+1;b<candidates.length;b++,index++){
  const da=candidates[a].metrics[metric].delta,db=candidates[b].metrics[metric].delta;
  if((da < -1e-8&&db > 1e-8)||(db < -1e-8&&da > 1e-8))pairIndices.push(index);
 }
 const context={metric,study:structuredClone(study),candidates,cellStepUpperBound:work};
 if(!pairIndices.length)return {...context,status:'no-reversal'};
 const runs=candidates.map(c=>runRain(project[study.target],project.width,project.height,project.weather,{surfaceInfiltrationOverride:{surface:study.surface,rateMmHr:c.rateMmHr}}));
 const options={uncertaintyMm,availability,pairIndices,recorded:project.observations.filter(o=>o.scenario===study.target)};
 const single=planComplementaryDepths(runs,{...options,maxReadings:1});
 const plan=planComplementaryDepths(runs,{...options,maxReadings:2,strategy:'exact-pair'});
 return {...context,status:plan.status,single,plan,additionalSeparatedPairs:plan.separatedPairCount-single.separatedPairCount};
}
