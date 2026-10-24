import {
  compareStormIntensities, validateStormIntensities, STORM_INTENSITY_METRICS,
  STORM_INTENSITY_WORK_LIMIT,
} from './storm-intensity.js';

export const STORM_RESOLUTION_WORK_LIMIT = 900_000;
const equal = (a,b) => Math.abs(a-b) <= 1e-12;
const sign = (delta, reference) => {
  const tolerance = Math.max(1e-7, 1e-10 * reference);
  return delta > tolerance ? 1 : delta < -tolerance ? -1 : 0;
};

export function prepareStormResolution(project, rates) {
  const query = validateStormIntensities(project, rates);
  const baseStep = project.weather.stepMinutes;
  const steps = [baseStep, baseStep/2, baseStep/4].filter(step => step >= 1);
  if (steps.length < 2) {
    throw new Error('This storm is already at or near the minimum supported 1-minute calculation step; no finer supported comparison exists.');
  }
  if (new Set(steps).size !== steps.length || steps.some(x => !Number.isFinite(x) || x > 30)) {
    throw new Error('Unsupported calculation interval sequence.');
  }
  const perStep = steps.map(step => 2 * query.ratesMmHr.length *
    project.width * project.height * Math.ceil(project.weather.durationMinutes/step));
  const totalCellSteps = perStep.reduce((a,b)=>a+b,0);
  if (totalCellSteps > STORM_RESOLUTION_WORK_LIMIT ||
      perStep.some(work=>work > STORM_INTENSITY_WORK_LIMIT)) {
    throw new Error('Storm resolution comparison exceeds its joint 900,000 cell-step or individual storm budget; reduce rates, grid or duration.');
  }
  return {ratesMmHr: query.ratesMmHr, stepsMinutes:steps, cellSteps:totalCellSteps, perStep};
}

/** Pure, same-input evaluation of explicitly supported time-step refinements. */
export function compareStormResolution(project, rates) {
  const {ratesMmHr,stepsMinutes,cellSteps} = prepareStormResolution(project,rates);
  const sourceSignature = JSON.stringify(project);
  const results = stepsMinutes.map(stepMinutes =>
    compareStormIntensities({
      ...project,
      weather: {...project.weather, stepMinutes},
    },ratesMmHr));
  const issues = [], rows = ratesMmHr.map((rateMmHr,rateIndex)=>{
    const metrics = Object.fromEntries(STORM_INTENSITY_METRICS.map(([key])=>{
      const values = results.map(result=>result.rows[rateIndex].metrics[key]);
      const deltas = values.map(value=>value.delta);
      const signs = values.map(value=>sign(value.delta,Math.max(
        Math.abs(value.existing),Math.abs(value.proposal))));
      const positive = signs.includes(1),negative = signs.includes(-1);
      const opposed = positive && negative;
      const someZero = signs.includes(0);
      const finding = opposed
        ? 'opposite numerical directions across tested steps'
        : someZero && (positive || negative)
          ? 'resolved in some steps, unresolved in others'
          : positive ? 'positive at all tested steps'
            : negative ? 'negative at all tested steps'
              : 'no resolved difference at tested steps';
      if (opposed || someZero && (positive || negative)) {
        issues.push({rateMmHr,metric:key,finding,signs:[...signs]});
      }
      return [key,{deltas,signs,opposed,unresolvedAcrossSteps:!opposed&&someZero&&(positive||negative),
        minDelta:Math.min(...deltas),maxDelta:Math.max(...deltas),finding}];
    }));
    return {rateMmHr,metrics};
  });
  return {
    status:'compared',sourceSignature,ratesMmHr,stepsMinutes,cellSteps,rows,issues,
    sameTestedDirections:issues.length===0,
    meaning: 'Only selected supported numerical steps were compared. Matching signs do not '+
      'prove numerical convergence or physical accuracy. Opposite signs show that the '+
      'chosen model conclusion depends on the calculation interval. Inputs and retained '+
      'field evidence were not changed or reclassified.',
  };
}
