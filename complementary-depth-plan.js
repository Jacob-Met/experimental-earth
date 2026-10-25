/** Greedy finite pair coverage on already admitted, synchronized trajectories.
 * Disjoint prospective bands are a conditional distinction, not information gain.
 */
export const EXACT_PAIR_WORK_LIMIT = 1_000_000;
const popcount = n => { n -= (n >>> 1) & 0x55555555; n = (n & 0x33333333) + ((n >>> 2) & 0x33333333); return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };

export function planComplementaryDepths(runs, { uncertaintyMm, maxReadings = 2, recorded = [], strategy = 'greedy' } = {}) {
  if (!['greedy', 'exact-pair'].includes(strategy) || (strategy === 'exact-pair' && maxReadings !== 2)) throw Error('Exact pair planning requires a two-reading budget');
  if (!Number.isFinite(uncertaintyMm) || uncertaintyMm < 0 || uncertaintyMm > 1000 ||
      !Number.isInteger(maxReadings) || maxReadings < 1 || maxReadings > 3) {
    throw Error('Choose a depth tolerance from 0–1000 mm and a budget of 1–3 readings');
  }
  if (!Array.isArray(runs) || runs.length > 9) throw Error('At most nine depth trajectories are supported');
  if (runs.length < 2) return { status: 'insufficient-alternatives', questions: [], pairs: [], unresolvedPairs: [] };
  const snapshots = runs[0].snapshots;
  if (!Array.isArray(snapshots) || snapshots.length < 2 || snapshots.length > 721) throw Error('Expected retained solver snapshots');
  const count = snapshots[0].depthsMm.length;
  if (count < 1 || count > 576 || runs.length * count * snapshots.length > 1_010_000) throw Error('Depth planning exceeds its trajectory bound');
  for (const run of runs) {
    if (run.snapshots?.length !== snapshots.length) throw Error('Depth trajectories must share times and cells');
    run.snapshots.forEach((snapshot, step) => {
      if (!Number.isFinite(snapshot.minute) || snapshot.minute < 0 || snapshot.minute > 720 ||
          snapshot.minute !== snapshots[step].minute || (step && snapshot.minute <= run.snapshots[step - 1].minute) ||
          snapshot.depthsMm?.length !== count || snapshot.depthsMm.some(n => !Number.isFinite(n) || n < 0)) {
        throw Error('Depth trajectories must contain finite nonnegative depths at shared ordered times');
      }
    });
  }
  const pairs = [];
  for (let first = 0; first < runs.length; first++) for (let second = first + 1; second < runs.length; second++) pairs.push({ first, second });
  const key = (cell, minute) => `${cell}:${Math.round(minute * 1e7)}`;
  const occupied = new Set(recorded.map(row => key(row.cellIndex, row.minute)));
  const questions = [], covered = new Set();
  let evaluatedCount = 0, excludedCount = 0;
  // Keep only one best coordinate for each separation pattern. This preserves
  // the exact greedy score while bounding repeated scans on long trajectories.
  const patterns = new Map();
  for (let step = 1; step < snapshots.length; step++) for (let cellIndex = 0; cellIndex < count; cellIndex++) {
    const minute = snapshots[step].minute;
    if (occupied.has(key(cellIndex, minute))) { excludedCount++; continue; }
    evaluatedCount++;
    const depthsMm = runs.map(run => run.snapshots[step].depthsMm[cellIndex]);
    const separated = [], gaps = [];
    pairs.forEach(({ first, second }, index) => {
      const gap = Math.abs(depthsMm[first] - depthsMm[second]) - 2 * uncertaintyMm;
      const guard = 1e-9 * Math.max(1, depthsMm[first], depthsMm[second], uncertaintyMm);
      if (gap > guard) { separated.push(index); gaps.push(gap); }
    });
    if (!separated.length) continue;
    const pattern = separated.join(',');
    // Earliest time, then lowest cell is the transparent stable tie break.
    if (!patterns.has(pattern)) patterns.set(pattern, { cellIndex, minute, depthsMm, separated, gaps });
  }
  let exact = null;
  if (strategy === 'exact-pair') {
    const points = [...patterns.values()];
    const combinations = points.length * (points.length - 1) / 2;
    if (combinations + points.length > EXACT_PAIR_WORK_LIMIT) throw Error('Exact pair planning exceeds one million complete singleton/pair evaluations; no partial optimum computed');
    const masks = points.map(p => p.separated.reduce((m, i) => { m[i < 32 ? 0 : 1] |= 1 << (i % 32); return m; }, [0, 0]));
    let best = [], score = 0;
    // Pattern order already is chronological, then lowest cell. Singletons
    // win coverage ties; equal-cardinality ties keep the first coordinate tuple.
    for (let i = 0; i < points.length; i++) {
      const n = popcount(masks[i][0]) + popcount(masks[i][1]);
      if (n > score) { score = n; best = [i]; }
    }
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      const n = popcount(masks[i][0] | masks[j][0]) + popcount(masks[i][1] | masks[j][1]);
      if (n > score) { score = n; best = [i, j]; }
    }
    exact = { strategy, evaluatedPlans: points.length + combinations, candidatePatterns: points.length };
    for (const i of best) {
      const point = points[i], newPairs = point.separated.filter(index => !covered.has(index));
      for (const index of newPairs) covered.add(index);
      questions.push({ ...point, newlySeparatedPairs: newPairs, cumulativePairCount: covered.size });
    }
  }
  for (let slot = 0; strategy === 'greedy' && slot < maxReadings; slot++) {
    let best = null, newPairs = [];
    for (const point of patterns.values()) {
      const added = point.separated.filter(index => !covered.has(index));
      if (added.length > newPairs.length || (added.length && added.length === newPairs.length &&
          (point.minute < best.minute || (point.minute === best.minute && point.cellIndex < best.cellIndex)))) {
        best = point; newPairs = added;
      }
    }
    if (!best || !newPairs.length) break;
    for (const index of newPairs) covered.add(index);
    questions.push({ ...best, newlySeparatedPairs: newPairs, cumulativePairCount: covered.size });
  }
  const unresolvedPairs = pairs.flatMap((pair, index) => covered.has(index) ? [] : [{ ...pair, index }]);
  return { status: !evaluatedCount ? 'all-recorded' : !questions.length ? 'indistinguishable' : 'planned',
    uncertaintyMm, maxReadings, questions, pairs, unresolvedPairs, evaluatedCount, excludedCount,
    separatedPairCount: covered.size, distinctPatterns: patterns.size,
    complete: unresolvedPairs.length === 0, ...(exact ? { exact } : {}) };
}
