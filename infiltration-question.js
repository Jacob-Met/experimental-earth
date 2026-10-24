import { runRain } from './core.js';
import { compareInfiltration } from './infiltration-study.js';

/**
 * A deterministic disagreement heuristic on the retained solver grid, not
 * expected information gain. Only calibration-compatible candidates enter;
 * held-aside values cannot choose the next question or alter its predictions.
 */
export function chooseInfiltrationQuestion(project, study = project.infiltrationStudy) {
  const comparison = compareInfiltration(project, study);
  const rates = comparison.compatibleRatesMmHr.slice().sort((a, b) => a - b);
  if (rates.length < 2) return { status: 'insufficient-alternatives', ratesMmHr: rates };
  const { target, surface } = study;
  const runs = rates.map(rateMmHr => runRain(project[target], project.width, project.height, project.weather,
    { surfaceInfiltrationOverride: { surface, rateMmHr } }));
  // Quantization only reconciles floating point timestamps (1e-7 minute).
  const key = (cell, minute) => `${cell}:${Math.round(minute * 1e7)}`;
  const recorded = new Set(project.observations.filter(o => o.scenario === target).map(o => key(o.cellIndex, o.minute)));
  let best = null, evaluatedCount = 0, excludedCount = 0;
  for (let step = 1; step < runs[0].snapshots.length; step++) {
    const minute = runs[0].snapshots[step].minute;
    for (let cellIndex = 0; cellIndex < project[target].length; cellIndex++) {
      if (recorded.has(key(cellIndex, minute))) { excludedCount++; continue; }
      evaluatedCount++;
      const predictions = rates.map((rateMmHr, i) => ({ rateMmHr, depthMm: runs[i].snapshots[step].depthsMm[cellIndex] }));
      const depths = predictions.map(p => p.depthMm);
      const minDepthMm = Math.min(...depths), maxDepthMm = Math.max(...depths);
      const spanMm = maxDepthMm - minDepthMm;
      if (!best || spanMm > best.spanMm + 1e-9 * Math.max(1, spanMm)) {
        best = { cellIndex, minute, spanMm, minDepthMm, maxDepthMm, predictions };
      }
    }
  }
  const counts = { evaluatedCount, excludedCount, ratesMmHr: rates, target, surface,
    stepMinutes: project.weather.stepMinutes };
  if (!evaluatedCount) return { status: 'all-recorded', ...counts };
  if (!best || best.spanMm <= 1e-8) return { status: 'indistinguishable', ...counts };
  return { status: 'question', ...counts, ...best };
}
