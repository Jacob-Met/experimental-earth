/**
 * Largest finite-candidate depth range on a shared retained solver grid.
 * Callers supply validated trajectories for the same event and declare which
 * candidates are eligible. This is disagreement, not information gain.
 */
export function greatestDepthDisagreement(runs, { recorded = [], cellIndices,
  fromMinute = 0, toMinute = Infinity } = {}) {
  if (runs.length < 2) throw new Error('Depth disagreement needs at least two trajectories');
  const snapshots = runs[0].snapshots;
  if (runs.some(run => run.snapshots.length !== snapshots.length)) {
    throw new Error('Depth trajectories must share retained solver times');
  }
  const cells = cellIndices ?? snapshots[0].depthsMm.map((_, index) => index);
  // Reconcile floating point timestamps only, at 1e-7 minute, as in the
  // maintained fixed-rate observation consumer.
  const key = (cell, minute) => `${cell}:${Math.round(minute * 1e7)}`;
  const occupied = new Set(recorded.map(reading => key(reading.cellIndex, reading.minute)));
  let best = null, evaluatedCount = 0, excludedCount = 0, eligibleCount = 0;
  for (let step = 1; step < snapshots.length; step++) {
    const minute = snapshots[step].minute;
    if (runs.some(run => run.snapshots[step].minute !== minute)) {
      throw new Error('Depth trajectories must share retained solver times');
    }
    const guard = 1e-9 * Math.max(1, Math.abs(minute));
    if (minute + guard < fromMinute || minute - guard > toMinute) continue;
    for (const cellIndex of cells) {
      eligibleCount++;
      if (occupied.has(key(cellIndex, minute))) { excludedCount++; continue; }
      evaluatedCount++;
      const depthsMm = runs.map(run => run.snapshots[step].depthsMm[cellIndex]);
      const minDepthMm = Math.min(...depthsMm), maxDepthMm = Math.max(...depthsMm);
      const spanMm = maxDepthMm - minDepthMm;
      if (!best || spanMm > best.spanMm + 1e-9 * Math.max(1, spanMm)) {
        best = { cellIndex, minute, spanMm, minDepthMm, maxDepthMm, depthsMm };
      }
    }
  }
  return { best, evaluatedCount, excludedCount, eligibleCount };
}
