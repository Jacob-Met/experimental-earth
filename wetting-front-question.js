import { greatestDepthDisagreement } from './depth-disagreement.js';
import { validateWettingFrontQuestion } from './wetting-front-contract.js';

/**
 * Called by the soil comparison with its already-computed, calibration-
 * compatible target trajectories. No additional solver run or held-aside
 * value is used. Original reading coordinates exclude repeat questions.
 */
export function planWettingFrontQuestion(project, study, supportedRuns) {
  const options = validateWettingFrontQuestion(study.question);
  if (!options) return null;
  if (options.toMinute > project.weather.durationMinutes) {
    throw new Error('The reading-question window must fit inside the modeled event');
  }
  const candidates = supportedRuns.slice().sort((a, b) => a.id - b.id);
  const context = { target: study.target, surface: study.surface, ...options,
    candidateIds: candidates.map(candidate => candidate.id),
    stepMinutes: project.weather.stepMinutes };
  if (candidates.length < 2) return { status: 'insufficient-alternatives', ...context };
  const { best, evaluatedCount, excludedCount, eligibleCount } = greatestDepthDisagreement(candidates, {
    recorded: project.observations.filter(reading => reading.scenario === study.target),
    cellIndices: options.scope === 'selected' ? [project.selectedIndex ?? 0] : undefined,
    fromMinute: options.fromMinute, toMinute: options.toMinute,
  });
  const counts = { ...context, evaluatedCount, excludedCount, eligibleCount };
  if (!eligibleCount) return { status: 'no-supported-times', ...counts };
  if (!evaluatedCount) return { status: 'all-recorded', ...counts };
  if (!best || best.spanMm <= 1e-8) return { status: 'indistinguishable', ...counts };
  const { depthsMm, ...point } = best;
  const predictions = candidates.map((candidate, index) => ({ id: candidate.id,
    conductivityMmHr: candidate.conductivityMmHr, capillaryDriveMm: candidate.capillaryDriveMm,
    depthMm: depthsMm[index], lowMm: Math.max(0, depthsMm[index] - options.uncertaintyMm),
    highMm: depthsMm[index] + options.uncertaintyMm }));
  const pairs = [];
  for (let a = 0; a < predictions.length; a++) for (let b = a + 1; b < predictions.length; b++) {
    const first = predictions[a], second = predictions[b];
    const bandGapMm = Math.max(first.lowMm, second.lowMm) - Math.min(first.highMm, second.highMm);
    const guard = 1e-9 * Math.max(1, first.highMm, second.highMm);
    pairs.push({ firstId: first.id, secondId: second.id, bandGapMm, disjoint: bandGapMm > guard });
  }
  const disjointPairCount = pairs.filter(pair => pair.disjoint).length;
  return { status: 'question', ...counts, ...point, predictions, pairs,
    disjointPairCount, pairCount: pairs.length, allPairsDisjoint: disjointPairCount === pairs.length };
}
