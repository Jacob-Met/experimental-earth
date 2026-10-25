import {validateDurationGoal,assessDurationGoal} from './placement-duration.js';
import { validatePlacementTargets, assessPlacementTargets } from './placement-constraints.js';
import { validateProject, SURFACES } from './core.js';
import { createInterventionBatch, summarizeEffects } from './intervention-study.js';
import { validateStudy, DEFAULT_STUDY } from './study-contract.js';

export const PLACEMENT_METRICS = Object.freeze({
  unabsorbedLiters: {label:'Water not absorbed',unit:'L'},
  exitLiters: {label:'Edge outflow',unit:'L'},
  peakPondingLiters: {label:'Peak standing water',unit:'L'},
  storedLiters: {label:'Final stored water',unit:'L'},
  maxDepthMm: {label:'Maximum cell depth',unit:'mm'},
});
export const PLACEMENT_WORK_LIMIT = 3_000_000;
export const placementSignature = project => JSON.stringify(project);
// Ephemeral provenance for support produced by this module, never imported result data.
const originalSupportContexts = new WeakMap();

export function validatePlacementQuery(project, query) {
  validateProject(project);
  if (!query || !Array.isArray(query.eligibleCells) || !query.eligibleCells.length || query.eligibleCells.length > 12 ||
      new Set(query.eligibleCells).size !== query.eligibleCells.length ||
      query.eligibleCells.some(i => !Number.isInteger(i) || i < 0 || i >= project.proposal.length)) throw Error('Choose 1–12 distinct eligible cells');
  if (![1,2].includes(query.maxEdits)) throw Error('Choose at most one or two surface edits');
  if (!Object.hasOwn(SURFACES, query.surface)) throw Error('Choose a known replacement surface');
  if (query.eligibleCells.some(i => project.proposal[i].surface === query.surface)) throw Error('Eligible cells must differ from the replacement surface');
  if (!Object.hasOwn(PLACEMENT_METRICS, query.metric)) throw Error('Choose a supported comparison objective');
  if (!['all','calibration','surviving'].includes(query.subset)) throw Error('Choose a supported evidence subset');
  const study = query.study ?? project.infiltrationStudy ?? DEFAULT_STUDY;
  validateStudy(study);
  return {eligibleCells:[...query.eligibleCells].sort((a,b)=>a-b),maxEdits:query.maxEdits,
    surface:query.surface,metric:query.metric,subset:query.subset,study:structuredClone(study),targets:validatePlacementTargets(project,query.targets),durationGoal:validateDurationGoal(project,query.durationGoal)};
}

export function estimatePlacementWork(project,query,stepsMinutes=[project.weather.stepMinutes]) {
 const n=query.eligibleCells.length,variantCount=1+n+(query.maxEdits===2?n*(n-1)/2:0);
 const unit=variantCount*query.study.ratesMmHr.length*project.width*project.height*stepsMinutes.reduce((sum,step)=>sum+Math.ceil(project.weather.durationMinutes/step),0);
 const modelCellSteps=3*unit,exposureCellSegments=query.durationGoal?2*unit:0;
 return {variantCount,modelCellSteps,exposureCellSegments,estimatedCellSteps:modelCellSteps+exposureCellSegments};
}
function variants(query) {
  const out=[[]];for(const i of query.eligibleCells)out.push([i]);
  if(query.maxEdits===2)for(let a=0;a<query.eligibleCells.length;a++)for(let b=a+1;b<query.eligibleCells.length;b++)out.push([query.eligibleCells[a],query.eligibleCells[b]]);
  return out;
}
function edited(project,query,cells) {
  const next=structuredClone(project);
  for(const i of cells)next.proposal[i]={...next.proposal[i],surface:query.surface,provenance:'hypothetical surface placement'};
  return next;
}
const value=(candidate,key)=>key==='unabsorbedLiters' ? candidate.metrics.exitLiters.proposal+candidate.metrics.storedLiters.proposal : candidate.metrics[key].proposal;

/** Exact finite enumeration; evidence is conditioned once on the unchanged source. */
export function comparePlacements(project, input) {
  const report=evaluatePlacements(project,input);
  if(report.status==='compared')originalSupportContexts.set(report,{sourceSignature:report.sourceSignature,querySignature:JSON.stringify(report.query),rates:[...report.ratesMmHr]});
  return report;
}

/** Reevaluate the same layouts at another supported step with baseline support frozen. */
export function comparePlacementsWithFixedSupport(project,input,baseline,stepMinutes) {
  const query=validatePlacementQuery(project,input);
  const context=originalSupportContexts.get(baseline);
  if(!context||baseline.status!=='compared'||context.sourceSignature!==placementSignature(project)||baseline.sourceSignature!==context.sourceSignature||JSON.stringify(query)!==context.querySignature||JSON.stringify(baseline.query)!==context.querySignature)throw Error('Fixed support requires the matching original in-memory placement comparison');
  if(JSON.stringify(baseline.ratesMmHr)!==JSON.stringify(context.rates))throw Error('Original hypothesis support was altered');
  const rates=[...context.rates];
  const changed={...project,weather:{...project.weather,stepMinutes}};
  return evaluatePlacements(changed,query,rates);
}

function evaluatePlacements(project, input, fixedRates=null) {
  const query=validatePlacementQuery(project,input),choices=variants(query);
  // Reuse the maintained comparator's conservative three-run allowance for
  // every variant, including original evidence evaluation. Never shortlist.
  const workDetail=estimatePlacementWork(project,query),work=workDetail.estimatedCellSteps;
  const exposureRequest=query.durationGoal?{thresholdMm:query.durationGoal.thresholdMm,cellIndices:query.durationGoal.cellIndices}:null;
  if(work>PLACEMENT_WORK_LIMIT)throw Error('Placement comparison exceeds 3 million estimated model/exposure work units; reduce eligible cells, duration, grid or hypothesis count');
  const subset=fixedRates?'all':query.subset;
  const compareVariant=createInterventionBatch();
  const original=compareVariant(project,{study:query.study,subset,allowAbsentSurface:subset==='all',exposureRequest});
  const context={query,sourceSignature:placementSignature(project),variantCount:choices.length,
    cellStepUpperBound:work,workDetail,evidenceTarget:query.study.target,supportMode:fixedRates?'fixed-original-support':'original-source-filter'};
  if(original.status!=='compared')return {...context,status:original.status,plans:[],best:[]};
  const rates=fixedRates??original.candidates.map(c=>c.rateMmHr),reference=new Map(original.candidates.map(c=>[c.rateMmHr,c]));
  const plans=choices.map(cells=>{
    // Do not refit original observations against hypothetical edited geometry.
    const computed=cells.length?compareVariant(edited(project,query,cells),{study:query.study,subset:'all',allowAbsentSurface:true,exposureRequest}):original;
    if(computed.status!=='compared')throw Error('Not every declared variant can be evaluated by the maintained intervention comparison; choose another eligible set or studied surface');
    const candidates=computed.candidates.filter(c=>rates.includes(c.rateMmHr)).map(c=>{
      const base=reference.get(c.rateMmHr);
      return {rateMmHr:c.rateMmHr,...(exposureRequest?{exposure:{current:base.pondingExposure.proposal,proposed:c.pondingExposure.proposal}}:{}),metrics:Object.fromEntries(Object.keys(PLACEMENT_METRICS).map(key=>
        [key,{current:value(base,key),proposed:value(c,key),delta:value(c,key)-value(base,key)}])),
        peakDeltaMm:c.peakDeltaMm.map((depth,i)=>depth-base.peakDeltaMm[i]),massErrorLiters:structuredClone(c.massErrorLiters)};
    });
    if(candidates.length!==rates.length)throw Error('A source-supported hypothesis was not evaluated');
    const metrics=Object.fromEntries(Object.keys(PLACEMENT_METRICS).map(key=>[key,summarizeEffects(candidates.map(c=>c.metrics[key].delta))]));
    const worseningCells=project.proposal.map((_,cellIndex)=>({cellIndex,...summarizeEffects(candidates.map(c=>c.peakDeltaMm[cellIndex]))})).filter(c=>c.max>1e-8);
    const localTargets=assessPlacementTargets(candidates,query.targets),durationTargets=assessDurationGoal(candidates,query.durationGoal);
    return {cells:[...cells],candidates,metrics,worseningCells,score:metrics[query.metric].max,localTargets,durationTargets,meetsAllTargets:localTargets.meets&&durationTargets.meets};
  });
  plans.sort((a,b)=>a.score-b.score||a.cells.length-b.cells.length||a.cells.join(',').localeCompare(b.cells.join(',')));
  const qualifying=plans.filter(p=>p.meetsAllTargets);
  const minimum=qualifying[0]?.score,tieGuard=minimum===undefined?0:1e-8*Math.max(1,Math.abs(minimum));
  return {...context,status:'compared',ratesMmHr:rates,sourceAffected:structuredClone(original.affected),plans,best:qualifying.filter(p=>Math.abs(p.score-minimum)<=tieGuard).map(p=>p.cells),tieGuard,qualifyingCount:qualifying.length,
    adoptionBlockedByProposalEvidence:project.observations.some(o=>o.scenario==='proposal'),
    semantics:'Worst additional change from the current proposal across the fixed hypotheses from the unchanged source study. This is a finite comparison over declared eligible cells, not a field recommendation or an optimum outside this set.'};
}

/** Explicit hypothetical adoption, with no evidence reassignment or deletion. */
export function adoptPlacement(project, input, cells, expectedSignature) {
  const query=validatePlacementQuery(project,input);
  if(expectedSignature!==placementSignature(project))throw Error('The project changed; compare placements again before adoption');
  if(!Array.isArray(cells)||cells.length>query.maxEdits||new Set(cells).size!==cells.length||cells.some(i=>!query.eligibleCells.includes(i)))throw Error('Choose an evaluated eligible placement');
  if(cells.length&&project.observations.some(o=>o.scenario==='proposal'))throw Error('Proposal-assigned observations must stay with their observed geometry. This candidate can be inspected, but cannot replace that proposal without a separately prepared evidence workspace');
  if(query.targets.length||query.durationGoal){
    const report=comparePlacements(project,query);
    const selected=report.plans.find(p=>p.cells.join(',')===[...cells].sort((a,b)=>a-b).join(','));
    if(!selected?.meetsAllTargets)throw Error('This placement does not meet every declared local target');
  }
  return validateProject(edited(project,query,cells));
}
