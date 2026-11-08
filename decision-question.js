import { runRain, validateProject } from './core.js';
import { DEFAULT_STUDY, validateStudy } from './study-contract.js';
import { compareIntervention, INTERVENTION_METRICS } from './intervention-study.js';
import { normalizeDecisionCriterion, partitionDecisionCandidates, decisionCriterionContext, meetsDecisionCriterion } from './decision-criterion.js';

/** Maximize the smallest predicted depth separation between hypotheses that
 * disagree on the proposal criterion (or, by default, its effect direction).
 * A finite decision-disagreement heuristic, not
 * information gain or a promise that a real observation resolves the decision. */
export function chooseDecisionQuestion(project, { metric = 'exitLiters', uncertaintyMm = 1,
  study = project.infiltrationStudy ?? DEFAULT_STUDY, criterion } = {}) {
  validateProject(project); validateStudy(study);
  criterion = normalizeDecisionCriterion(criterion);
  if (!Object.hasOwn(INTERVENTION_METRICS, metric)) throw Error('Choose a supported proposal outcome');
  if (!Number.isFinite(uncertaintyMm) || uncertaintyMm < 0 || uncertaintyMm > 1000) throw Error('Measurement tolerance must be from 0 to 1000 mm');
  const cellStepUpperBound = study.ratesMmHr.length * 4 * project.width * project.height * Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes);
  if (cellStepUpperBound > 3000000) throw Error('Decision question exceeds the 3 million cell-step budget. Reduce grid, duration or candidate count.');
  // Deliberately calibration-only: selecting using the held-aside values would
  // consume their independence. They still exclude already recorded locations.
  const comparison = compareIntervention(project, { study, subset: 'calibration' });
  if (comparison.status !== 'compared') return { status: comparison.status, metric };
  const candidates = comparison.candidates.slice().sort((a,b)=>a.rateMmHr-b.rateMmHr);
  const groups = partitionDecisionCandidates(candidates, metric, criterion);
  const { lower, higher, neutral, opposingPairs } = groups;
  const context = { metric, target:study.target, surface:study.surface, uncertaintyMm,
    lowerRatesMmHr:lower.map(c=>c.rateMmHr), higherRatesMmHr:higher.map(c=>c.rateMmHr), neutralRatesMmHr:neutral.map(c=>c.rateMmHr), cellStepUpperBound, ...decisionCriterionContext(groups) };
  if (!opposingPairs.length) return criterion === undefined ? { status:'no-reversal', ...context } :
    {status:'no-decision-disagreement', ...context, criterionAgreement:groups.meets.length === candidates.length ? 'all-meet' : 'all-miss'};
  const runs=candidates.map(c=>runRain(project[study.target],project.width,project.height,project.weather,
    {surfaceInfiltrationOverride:{surface:study.surface,rateMmHr:c.rateMmHr}}));
  const key=(cell,minute)=>`${cell}:${Math.round(minute*1e7)}`;
  const recorded=new Set(project.observations.filter(o=>o.scenario===study.target).map(o=>key(o.cellIndex,o.minute)));
  let best=null,evaluatedCount=0,excludedCount=0;
  for(let step=1;step<runs[0].snapshots.length;step++) {
    const minute=runs[0].snapshots[step].minute;
    for(let cellIndex=0;cellIndex<project[study.target].length;cellIndex++) {
      if(recorded.has(key(cellIndex,minute))){excludedCount++;continue;}
      evaluatedCount++;
      const depths=runs.map(r=>r.snapshots[step].depthsMm[cellIndex]);
      const separationMm=Math.min(...opposingPairs.map(([a,b])=>Math.abs(depths[a]-depths[b])));
      if(!best||separationMm>best.separationMm+1e-9*Math.max(1,separationMm))best={cellIndex,minute,separationMm,
        predictions:candidates.map((c,i)=>({rateMmHr:c.rateMmHr,depthMm:depths[i],effect:c.metrics[metric].delta,
          ...(criterion === undefined ? {} : {meetsCriterion:meetsDecisionCriterion(c.metrics[metric].delta,criterion)})}))};
    }
  }
  const counts={...context,evaluatedCount,excludedCount,opposingPairCount:opposingPairs.length,stepMinutes:project.weather.stepMinutes};
  if(!evaluatedCount)return {status:'all-recorded',...counts};
  if(!best||best.separationMm<=1e-8)return {status:'indistinguishable',...counts};
  return {status:'question',...counts,...best, bandsDisjoint:best.separationMm>2*uncertaintyMm+1e-8};
}
