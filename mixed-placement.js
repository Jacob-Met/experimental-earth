import{validateDrainingHypotheses}from'./draining-layer-evidence.js';
import{createReceivingPlacementComparison}from'./placement-receiving.js';
import {validateProject,SURFACES} from './core.js';
import {createInterventionBatch} from './intervention-study.js';
import {validateStudy} from './study-contract.js';
import {validateDrainingLayer} from './draining-infiltration.js';
import {validatePlacementTargets,assessPlacementTargets} from './placement-constraints.js';
import {validateDurationGoal,assessDurationGoal} from './placement-duration.js';
import {PLACEMENT_METRICS} from './placement-search.js';
const contexts=new WeakMap(),clone=structuredClone;
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const keys=(o,allowed)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>allowed.includes(k));
export function admitMixed(project,input){
 validateProject(project);
 if(!keys(input,['offers','budget','costUnit','maxEdits','metric','subset','study','drainingLayer','targets','durationGoal','receivingStudy']))throw Error('Unsupported mixed declaration');
 if(!dense(input.offers)||!input.offers.length||input.offers.length>12)throw Error('Choose1–12 offered cells');
 const offers=input.offers.map(row=>{if(!keys(row,['cellIndex','options'])||!Number.isInteger(row.cellIndex)||row.cellIndex<0||row.cellIndex>=project.proposal.length||!dense(row.options)||!row.options.length||row.options.length>2)throw Error('Invalid offered cell');
 const options=row.options.map(o=>{if(!keys(o,['surface','cost','source'])||!Object.hasOwn(SURFACES,o.surface)||o.surface===project.proposal[row.cellIndex].surface||!Number.isFinite(o.cost)||o.cost<0||typeof o.source!=='string'||!o.source.trim()||o.source.length>1000)throw Error('Declare distinct material, finite cost and cost source');return{surface:o.surface,cost:o.cost,source:o.source.trim()};});if(new Set(options.map(o=>o.surface)).size!==options.length)throw Error('Duplicate material');return{cellIndex:row.cellIndex,options};}).sort((a,b)=>a.cellIndex-b.cellIndex);
 if(new Set(offers.map(o=>o.cellIndex)).size!==offers.length)throw Error('Duplicate cell');
 if(!Number.isFinite(input.budget)||input.budget<0||typeof input.costUnit!=='string'||!input.costUnit.trim()||input.costUnit.length>100||![1,2].includes(input.maxEdits)||!Object.hasOwn(PLACEMENT_METRICS,input.metric)||!['all','calibration','surviving'].includes(input.subset))throw Error('Invalid budget or comparison scope');
 let family;if(Object.hasOwn(input,'receivingStudy')){if(Object.hasOwn(input,'study')||Object.hasOwn(input,'drainingLayer'))throw Error('Choose receiving hypotheses or infiltration rates, not a joint model');validateDrainingHypotheses(input.receivingStudy);family={receivingStudy:clone(input.receivingStudy)};}else{validateStudy(input.study);const drainingLayer=input.drainingLayer??null;if(drainingLayer!==null){validateDrainingLayer(drainingLayer,SURFACES);if(input.subset!=='all')throw Error('Finite receiver requires all declared rates');}family={study:clone(input.study),drainingLayer:clone(drainingLayer)};}
 return{offers,budget:input.budget,costUnit:input.costUnit.trim(),maxEdits:input.maxEdits,metric:input.metric,subset:input.subset,...family,targets:validatePlacementTargets(project,input.targets),durationGoal:validateDurationGoal(project,input.durationGoal)};
}
export function enumerateMixed(q){const layouts=[[]];for(const row of q.offers)for(const o of row.options)layouts.push([{cellIndex:row.cellIndex,...o}]);if(q.maxEdits===2)for(let i=0;i<q.offers.length;i++)for(let j=i+1;j<q.offers.length;j++)for(const a of q.offers[i].options)for(const b of q.offers[j].options)layouts.push([{cellIndex:q.offers[i].cellIndex,...a},{cellIndex:q.offers[j].cellIndex,...b}]);return layouts;}
const value=(c,k)=>k==='unabsorbedLiters'?c.metrics.exitLiters.proposal+c.metrics.storedLiters.proposal:c.metrics[k].proposal;
export function compareMixed(project,input){return evaluateMixed(project,input);}
function evaluateMixed(project,input,fixed=null){const q=admitMixed(project,input),layouts=enumerateMixed(q),work=layouts.length*(q.receivingStudy?q.receivingStudy.hypotheses.length:q.study.ratesMmHr.length)*project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes)*(q.durationGoal?5:3);if(work>3000000)throw Error('Complete mixed comparison exceeds3M work bound');
 let rates=null,receiving=null,evaluate;
 if(q.receivingStudy){receiving=createReceivingPlacementComparison(project,q,Object.keys(PLACEMENT_METRICS),fixed?.receiving??null);if(receiving.status!=='compared')return{status:receiving.status,plans:[],bestKeys:[],work};evaluate=(changed,unchanged)=>receiving.compare(changed.proposal,unchanged);}
 else{ const compare=createInterventionBatch(),exposureRequest=q.durationGoal?{thresholdMm:q.durationGoal.thresholdMm,cellIndices:q.durationGoal.cellIndices}:null,options={study:q.study,subset:fixed?'all':q.subset,allowAbsentSurface:fixed?true:q.subset==='all',drainingLayer:q.drainingLayer,exposureRequest},original=compare(project,options);
 if(original.status!=='compared')return{status:original.status,plans:[],bestKeys:[],work};
 rates=fixed?.rates??original.candidates.map(c=>c.rateMmHr);const base=new Map(original.candidates.map(c=>[c.rateMmHr,c]));
evaluate=(changed,unchanged)=>{ const result=!unchanged?compare(changed,{...options,subset:'all',allowAbsentSurface:true}):original;if(result.status!=='compared')throw Error('Incomplete layout evaluation');
 const candidates=result.candidates.filter(c=>rates.includes(c.rateMmHr)).map(c=>{const b=base.get(c.rateMmHr);return{rateMmHr:c.rateMmHr,metrics:Object.fromEntries(Object.keys(PLACEMENT_METRICS).map(k=>[k,{current:value(b,k),proposed:value(c,k),delta:value(c,k)-value(b,k)}])),peakDeltaMm:c.peakDeltaMm.map((v,i)=>v-b.peakDeltaMm[i]),...(exposureRequest?{exposure:{current:b.pondingExposure.proposal,proposed:c.pondingExposure.proposal}}:{}),massErrorLiters:clone(c.massErrorLiters)};});if(candidates.length!==rates.length)throw Error('Missing original-supported rate');
return candidates;};}
 const plans=layouts.map(edits=>{const changed=clone(project);for(const e of edits)changed.proposal[e.cellIndex]={...changed.proposal[e.cellIndex],surface:e.surface,provenance:'Authored mixed hypothetical layout'};
 const candidates=evaluate(changed,edits.length===0);
 const cost=edits.reduce((a,e)=>a+e.cost,0),scores=Object.fromEntries(Object.keys(PLACEMENT_METRICS).map(k=>[k,Math.max(...candidates.map(c=>c.metrics[k].delta))]));if(![cost,...Object.values(scores),...candidates.flatMap(c=>c.peakDeltaMm)].every(Number.isFinite))throw Error('Nonfinite complete layout');const targets=assessPlacementTargets(candidates,q.targets),duration=assessDurationGoal(candidates,q.durationGoal);
 return{key:edits.map(e=>e.cellIndex+':'+e.surface).join('|')||'none',edits,cost,scores,candidates,targets,duration,qualifies:cost<=q.budget&&targets.meets&&duration.meets};});
 const feasible=plans.filter(p=>p.qualifies),best=Math.min(...feasible.map(p=>p.scores[q.metric]));for(const p of plans)p.pareto=p.qualifies&&!feasible.some(o=>o!==p&&o.cost<=p.cost&&o.scores.exitLiters<=p.scores.exitLiters&&o.scores.unabsorbedLiters<=p.scores.unabsorbedLiters&&(o.cost<p.cost||o.scores.exitLiters<p.scores.exitLiters||o.scores.unabsorbedLiters<p.scores.unabsorbedLiters));
 const report={status:'compared',query:q,work,...(receiving?{hypothesisIds:[...receiving.ids],originalEvidence:clone(receiving.evidence)}:{ratesMmHr:rates}),plans,bestKeys:feasible.filter(p=>Math.abs(p.scores[q.metric]-best)<=1e-8*Math.max(1,Math.abs(best))).map(p=>p.key)};contexts.set(report,{signature:JSON.stringify(project),query:JSON.stringify(q),plans:clone(plans),support:receiving?{receiving:{ids:[...receiving.ids],evidence:clone(receiving.evidence)}}:{rates:[...rates]}});return report;
}
export function adoptMixed(project,report,key){const c=contexts.get(report);if(!c||c.signature!==JSON.stringify(project)||c.query!==JSON.stringify(report.query))throw Error('Stale or untrusted mixed comparison');const p=c.plans.find(p=>p.key===key);if(!p?.qualifies)throw Error('Choose an evaluated qualifying layout');if(p.edits.length&&project.observations.some(o=>o.scenario==='proposal'))throw Error('Observed proposal geometry cannot be replaced');const next=clone(project);for(const e of p.edits)next.proposal[e.cellIndex]={...next.proposal[e.cellIndex],surface:e.surface,provenance:'Authored maintained-model mixed placement'};return validateProject(next);}
export const MIXED_FILE_SCHEMA='earth-maintained-mixed-investigation/1';
export function serializeMixed(project,report){const context=contexts.get(report);if(!context||context.signature!==JSON.stringify(project)||context.query!==JSON.stringify(report.query))throw Error('Save requires the matching unchanged comparison');return JSON.stringify({schema:MIXED_FILE_SCHEMA,project:clone(project),query:clone(report.query)},null,2);}
export function parseMixed(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>2000000)throw Error('Mixed file exceeds2MB');const raw=JSON.parse(text);if(!keys(raw,['schema','project','query'])||raw.schema!==MIXED_FILE_SCHEMA)throw Error('Unsupported mixed file or computed payload');validateProject(raw.project);const query=admitMixed(raw.project,raw.query);return{project:clone(raw.project),query};}

export function compareMixedResolution(project,input,baseline,stepMinutes){
 const q=admitMixed(project,input),c=contexts.get(baseline);
 if(!c||c.signature!==JSON.stringify(project)||c.query!==JSON.stringify(q)||c.query!==JSON.stringify(baseline.query))throw Error('Resolution requires unchanged original in-memory comparison');
 if(JSON.stringify(c.support.receiving?baseline.hypothesisIds:baseline.ratesMmHr)!==JSON.stringify(c.support.receiving?c.support.receiving.ids:c.support.rates))throw Error('Original support was altered');
 if(!Number.isFinite(stepMinutes)||stepMinutes<=0||stepMinutes>=project.weather.stepMinutes)throw Error('Choose a positive finer timestep');
 const changed={...project,weather:{...project.weather,stepMinutes}},count=q.receivingStudy?q.receivingStudy.hypotheses.length:q.study.ratesMmHr.length;
 const total=enumerateMixed(q).length*count*project.width*project.height*(Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes)+Math.ceil(project.weather.durationMinutes/stepMinutes))*(q.durationGoal?5:3);
 if(total>3000000)throw Error('Combined resolution comparison exceeds3M work bound');
 const fine=evaluateMixed(changed,q,clone(c.support));
 return{baselineStepMinutes:project.weather.stepMinutes,finerStepMinutes:stepMinutes,combinedEstimatedWork:total,fine,qualification:'Fixed original support; empirical timestep sensitivity, not a convergence certificate.'};
}
