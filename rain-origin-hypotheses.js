import { validateProject } from './core.js';
import { compareInfiltration } from './infiltration-study.js';
import { DEFAULT_STUDY, validateStudy } from './study-contract.js';
import { MAX_ORIGIN_CELL_STEPS, ORIGIN_HYPOTHESIS_SUBSETS, validateRainOriginStudy } from './rain-origins.js';
import { compareRainOrigins, rainOriginSignature } from './rain-origin-study.js';

export const MAX_ORIGIN_HYPOTHESIS_CELL_STEPS = 2_000_000;
const envelope = values => ({ min: Math.min(...values), max: Math.max(...values) });

function pairedEnvelope(candidates, value) {
  const existing = candidates.map(c => value(c.comparison.existing));
  const proposal = candidates.map(c => value(c.comparison.proposal));
  return { existing: envelope(existing), proposal: envelope(proposal),
    delta: envelope(proposal.map((v, i) => v - existing[i])) };
}

/** Finite hypotheses at one exact modeled time, never a probability distribution.
 * Each paired change uses the SAME rate in both sites. Marginal range endpoints
 * may belong to different candidates and cannot be assembled into a new flow. */
export function compareRainOriginHypotheses(project, {
  study = project.infiltrationStudy ?? DEFAULT_STUDY,
  subset = project.rainOriginStudy?.hypothesisSubset ?? 'all',
} = {}) {
  validateProject(project); validateStudy(study);
  if (!ORIGIN_HYPOTHESIS_SUBSETS.includes(subset)) throw new Error('Unknown rainfall-origin hypothesis subset');
  const cellCount = project.width * project.height;
  const query = validateRainOriginStudy(project.rainOriginStudy, cellCount, project.weather.durationMinutes);
  if (!query) throw new Error('Choose a destination before comparing rainfall origins');
  const originCellSteps = cellCount * Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes);
  // Bound before evidence fitting. Filtering can reduce actual work, not admission.
  const cellStepUpperBound = originCellSteps * study.ratesMmHr.length * (subset === 'all' ? 2 : 3);
  const affected = Object.fromEntries(['existing', 'proposal'].map(target =>
    [target, project[target].filter(cell => cell.surface === study.surface).length]));
  const context = { subset, surface: study.surface, evidenceTarget: study.target,
    requestedRatesMmHr: [...study.ratesMmHr], query, affected, originCellSteps,
    cellStepUpperBound, limit: MAX_ORIGIN_HYPOTHESIS_CELL_STEPS };
  const refuse = (status, evidence = null) => ({ ...context, status, evidence,
    candidates: [], originRanges: [], totals: {}, maxSourceLiters: 0 });
  if (originCellSteps > MAX_ORIGIN_CELL_STEPS || cellStepUpperBound > MAX_ORIGIN_HYPOTHESIS_CELL_STEPS) {
    return refuse('work-limit');
  }
  if (!affected.existing && !affected.proposal) return refuse('surface-absent');
  const evidence = subset === 'all' ? null : compareInfiltration(project, study);
  if (evidence?.status === 'surface-absent') return refuse('evidence-surface-absent', evidence);
  if (evidence && !evidence.counts.calibration) return refuse('need-calibration', evidence);
  if (evidence && !evidence.compatibleRatesMmHr.length) return refuse('no-compatible-rates', evidence);
  if (subset === 'surviving' && !evidence.counts.challenge) return refuse('need-challenge', evidence);
  const admitted = evidence && new Set(subset === 'calibration'
    ? evidence.compatibleRatesMmHr : evidence.survivingRatesMmHr);
  // Keep declared order; an error ranking is not a probability or selected truth.
  const rates = study.ratesMmHr.filter(rate => !admitted || admitted.has(rate));
  if (!rates.length) return refuse('no-compatible-rates', evidence);
  const candidates = rates.map(rateMmHr => ({ rateMmHr,
    comparison: compareRainOrigins(project, {
      surfaceInfiltrationOverride: { surface: study.surface, rateMmHr },
    }),
  }));
  const originRanges = Array.from({ length: cellCount }, (_, cellIndex) => ({ cellIndex,
    ...pairedEnvelope(candidates, result => result.bySourceLiters[cellIndex]),
  }));
  const totals = Object.fromEntries(['rainfallLiters', 'initialWaterLiters', 'targetTotalLiters'].map(key =>
    [key, pairedEnvelope(candidates, result => result[key])]));
  const maxSourceLiters = Math.max(0, ...originRanges.flatMap(r => [r.existing.max, r.proposal.max]));
  const maxBalanceErrorLiters = Math.max(0, ...candidates.flatMap(c =>
    [Math.abs(c.comparison.existing.balanceErrorLiters), Math.abs(c.comparison.proposal.balanceErrorLiters)]));
  return { ...context, status: 'compared', evidence, candidates, originRanges,
    totals, maxSourceLiters, maxBalanceErrorLiters,
    minute: candidates[0].comparison.minute,
    durationMinutes: candidates[0].comparison.durationMinutes };
}

export function rainOriginHypothesisSignature(project) {
  return JSON.stringify({ model: rainOriginSignature(project),
    study: project.infiltrationStudy ?? DEFAULT_STUDY, observations: project.observations });
}
