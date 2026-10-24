/**
 * Intersect declared simultaneous depth bands independently of any model.
 * Call with a validated project's observations. Distinct exact times/scenarios
 * are never combined; an unassigned scenario cannot establish co-location.
 */
export function observationConsistency(observations) {
  if (!Array.isArray(observations) || observations.length > 100) throw Error('Expected at most 100 readings');
  const groups = new Map();
  let unassignedCount = 0;
  observations.forEach((reading, index) => {
    if (!reading || !Number.isInteger(reading.cellIndex) || reading.cellIndex < 0 || reading.cellIndex >= 576 ||
        !Number.isFinite(reading.minute) || reading.minute < 0 || reading.minute > 720 ||
        !Number.isFinite(reading.depthMm) || reading.depthMm < 0 || reading.depthMm > 1000 ||
        !Number.isFinite(reading.uncertaintyMm) || reading.uncertaintyMm < 0 || reading.uncertaintyMm > 1000 ||
        typeof reading.source !== 'string' || !reading.source.trim() || reading.source.length > 200) throw Error('Invalid depth reading');
    if (reading.use !== undefined && !['calibration','challenge','unassigned'].includes(reading.use)) throw Error('Invalid evidence role');
    if (!['existing', 'proposal'].includes(reading.scenario)) {
      if (reading.scenario !== undefined && reading.scenario !== 'unassigned') throw Error('Invalid observed scenario');
      unassignedCount++; return;
    }
    const key = JSON.stringify([reading.scenario, reading.cellIndex, reading.minute]);
    if (!groups.has(key)) groups.set(key, { scenario: reading.scenario, cellIndex: reading.cellIndex, minute: reading.minute, readings: [] });
    groups.get(key).readings.push({ index, reading: structuredClone(reading),
      lowerMm: Math.max(0, reading.depthMm - reading.uncertaintyMm),
      upperMm: reading.depthMm + reading.uncertaintyMm });
  });
  const repeated = [];
  for (const group of groups.values()) {
    if (group.readings.length < 2) continue;
    let lower = group.readings[0], upper = lower;
    for (const row of group.readings) {
      if (row.lowerMm > lower.lowerMm) lower = row;
      if (row.upperMm < upper.upperMm) upper = row;
    }
    const gapMm = Math.max(0, lower.lowerMm - upper.upperMm);
    // A numerical guard is disclosed separately, never disguised as tolerance.
    const numericalGuardMm = Number.EPSILON * 32 * Math.max(1, Math.abs(lower.lowerMm), Math.abs(upper.upperMm));
    const contradictory = gapMm > numericalGuardMm;
    const status = contradictory ? 'disjoint' : gapMm > 0 ? 'roundoff-contact' : 'overlap';
    repeated.push({ ...group, status, gapMm, numericalGuardMm,
      commonBandMm: gapMm === 0 ? [lower.lowerMm, upper.upperMm] : null,
      witness: contradictory ? [upper.index, lower.index] : null });
  }
  return { groups: repeated, unassignedCount,
    contradictoryGroups: repeated.filter(g => g.status === 'disjoint').length,
    limitation: 'Bands are user-declared tolerances for the exact same scenario, cell and time. Treating them as one depth assumes the declared grid cell represents the same location. Sub-cell variation or different actual events can explain disjoint bands. Their intersection does not establish measurement truth, event identity or statistical independence; disjoint bands do not identify which reading is wrong.' };
}
