/** Diagnostics of retained solver snapshots, with linear interpolation between them. */
export function pondingExposure(result, thresholdMm) {
  if (!Number.isFinite(thresholdMm) || thresholdMm <= 0 || thresholdMm > 1000) {
    throw new Error('Choose a depth threshold greater than 0 and at most 1000 mm.');
  }
  const snapshots = validateSnapshots(result);
  const count = snapshots[0].depthsMm.length;
  return Array.from({ length: count }, (_, cellIndex) => {
    const intervals = [];
    for (let i = 1; i < snapshots.length; i++) {
      const a = snapshots[i - 1], b = snapshots[i];
      const da = a.depthsMm[cellIndex], db = b.depthsMm[cellIndex];
      if (da <= thresholdMm && db <= thresholdMm) continue;
      const crossing = da === db ? a.minute : a.minute + (thresholdMm - da) * (b.minute - a.minute) / (db - da);
      const startMinute = da > thresholdMm ? a.minute : crossing;
      const endMinute = db > thresholdMm ? b.minute : crossing;
      if (endMinute <= startMinute) continue;
      const previous = intervals.at(-1);
      // Merge adjacent wet segments only if their shared snapshot is wet.
      if (previous && previous.endMinute === startMinute && da > thresholdMm) previous.endMinute = endMinute;
      else intervals.push({ startMinute, endMinute });
    }
    return { cellIndex, minutesAbove: intervals.reduce((sum, x) => sum + x.endMinute - x.startMinute, 0), intervals };
  });
}

export function snapshotDepths(result, minute) {
  const snapshots = validateSnapshots(result);
  if (!Number.isFinite(minute) || minute < snapshots[0].minute || minute > snapshots.at(-1).minute) throw new Error('Replay time is outside the modeled event.');
  let i = snapshots.findIndex(s => s.minute >= minute);
  const b = snapshots[i];
  if (b.minute === minute) return b.depthsMm.slice();
  const a = snapshots[i - 1];
  const fraction = (minute - a.minute) / (b.minute - a.minute);
  return a.depthsMm.map((depth, j) => depth + fraction * (b.depthsMm[j] - depth));
}

function validateSnapshots(result) {
  const snapshots = result?.snapshots;
  if (!Array.isArray(snapshots) || snapshots.length < 2) throw new Error('Two or more solver snapshots are required.');
  if (!Array.isArray(snapshots[0]?.depthsMm) || !snapshots[0].depthsMm.length) throw new Error('Snapshot depths are required.');
  const count = snapshots[0].depthsMm.length;
  snapshots.forEach((s, i) => {
    if (!Number.isFinite(s.minute) || s.minute < 0 || (i && s.minute <= snapshots[i - 1].minute) ||
        !Array.isArray(s.depthsMm) || s.depthsMm.length !== count || !s.depthsMm.every(d => Number.isFinite(d) && d >= 0)) {
      throw new Error('Invalid solver snapshot sequence.');
    }
  });
  return snapshots;
}
