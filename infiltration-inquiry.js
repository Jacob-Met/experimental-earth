import {validateProject,infiltrationObservationSteps} from './core.js';

// Conservative nominal work admission, not a wall-clock or memory guarantee.
// The extra time step also covers floating-point accumulation at step boundaries.
export const INFILTRATION_CELL_STEP_LIMIT = 12_000_000;

export function planInfiltrationInquiry(project, target = 'proposal', coverage = 'complete') {
  validateProject(project);
  if (!['proposal','existing'].includes(target)) throw Error('Unknown scenario');
  if (!['complete','shortlist'].includes(coverage)) throw Error('Unknown infiltration coverage');
  const totalCount = project.width * project.height;
  const shortlisted = coverage === 'shortlist' && totalCount > 96;
  const candidateCount = shortlisted ? 36 : totalCount;
  const stepsPerRun = Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes) + 1;
  const estimatedCellSteps = (2 * candidateCount + Number(shortlisted)) * totalCount * stepsPerRun;
  return {status:estimatedCellSteps <= INFILTRATION_CELL_STEP_LIMIT ? 'ready' : 'capacity',
    target,coverage,totalCount,candidateCount,estimatedCellSteps,cellStepLimit:INFILTRATION_CELL_STEP_LIMIT};
}

/** Snapshot before yielding: an edited caller cannot change an in-flight inquiry. */
export function createInfiltrationInquiry(project, target = 'proposal', coverage = 'complete') {
  const snapshot = structuredClone(project);
  const plan = planInfiltrationInquiry(snapshot,target,coverage);
  function* steps() {
    if (plan.status !== 'ready') return {...plan,evaluatedCount:0,winner:null};
    let last;
    for (const step of infiltrationObservationSteps(snapshot,target,coverage)) {
      last = step;
      yield {...plan,status:'running',evaluatedCount:step.evaluatedCount};
    }
    const winner = last.winner?.impactLiters > 1e-9 ? last.winner : null;
    return {...plan,status:'complete',evaluatedCount:last.evaluatedCount,
      completeCoverage:last.evaluatedCount === plan.totalCount,winner};
  }
  return {plan,steps:steps()};
}

export function runInfiltrationInquiry(project, target = 'proposal', coverage = 'complete') {
  const {steps} = createInfiltrationInquiry(project,target,coverage);
  let next;
  do { next = steps.next(); } while (!next.done);
  return next.value;
}
