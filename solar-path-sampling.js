import {compareSunPath, validateSunPath, sunPathCellCourse} from './solar-path.js';

export const SUN_SAMPLING_SEMANTICS = 'Additional discrete times can reveal a classification absent from the coarse interval endpoints. '
  + 'No newly sampled classification does not establish continuous agreement, convergence, or an absence of intervening changes. '
  + 'Counts are samples, not hours of shade. The same declared geometry, geographic position and model limits apply to both grids.';

/** A nested grid reuses every original instant and evaluates each fine time once. */
export function compareSunPathSampling(project, input, fineStepMinutes) {
  const coarseDeclaration = validateSunPath(input);
  if (!Number.isInteger(fineStepMinutes) || fineStepMinutes < 1
    || fineStepMinutes >= coarseDeclaration.stepMinutes
    || coarseDeclaration.stepMinutes % fineStepMinutes !== 0) {
    throw Error('Use a finer whole-minute interval that evenly divides the original sample interval.');
  }
  // The maintained complete-course sample and ray-work bounds admit this entire grid.
  // Independent time samples have no stepping state, so shared instants need no second ray run.
  const fine = compareSunPath(project, {...input, stepMinutes: fineStepMinutes});
  const start = Date.parse(coarseDeclaration.startUtc), end = Date.parse(coarseDeclaration.endUtc);
  const byUtc = new Map(fine.samples.map(sample => [sample.utc, sample]));
  const samples = Array.from({length: coarseDeclaration.sampleCount}, (_, index) => {
    const utc = new Date(Math.min(end, start + index * coarseDeclaration.stepMinutes * 60000)).toISOString();
    const sample = byUtc.get(utc);
    if (!sample) throw Error('The finer course did not retain every original instant.');
    return structuredClone(sample);
  });
  const cells = project.width * project.height;
  const coarse = {...fine, declaration: coarseDeclaration, samples,
    estimatedRayTests: 6 * cells * (cells - 1) * samples.length};
  return {schema: 'experimental-earth-sun-sampling/1', coarse, fine,
    evaluatedSamples: fine.samples.length, insertedSamples: fine.samples.length - samples.length,
    semantics: SUN_SAMPLING_SEMANTICS};
}

/** Inspect complete inserted observations without treating the endpoints as a continuous claim. */
export function inspectSunPathSampling(comparison, cellIndex) {
  const coarse = sunPathCellCourse(comparison.coarse, cellIndex);
  const fine = sunPathCellCourse(comparison.fine, cellIndex);
  const intervals = []; let cursor = 0, newObservationCount = 0;
  for (let index = 0; index < coarse.length - 1; index++) {
    const left = coarse[index], right = coarse[index + 1], inserted = [];
    while (cursor < fine.length && fine[cursor].utc <= left.utc) cursor++;
    while (cursor < fine.length && fine[cursor].utc < right.utc) {
      const row = fine[cursor++];
      const newTargets = ['existing', 'proposal'].filter(target =>
        row[target].status !== left[target].status && row[target].status !== right[target].status);
      newObservationCount += newTargets.length;
      inserted.push({...row, newTargets});
    }
    intervals.push({startUtc: left.utc, endUtc: right.utc, left, right, inserted,
      newObservations: inserted.filter(row => row.newTargets.length > 0)});
  }
  return {cellIndex, intervals, newObservationCount,
    intervalsWithNewClassifications: intervals.filter(interval => interval.newObservations.length > 0).length,
    semantics: SUN_SAMPLING_SEMANTICS};
}
