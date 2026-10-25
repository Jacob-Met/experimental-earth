/**
 * Declared root-zone water store; no field calibration or crop recommendation.
 * FAO56 ch.8 supplies TAW/RAW and the stress coefficient. The continuous dry-down
 * and instantaneous recharge used here are explicit adaptations, not FAO56's
 * full daily weather/crop/soil-evaporation model.
 */
export const ROOT_ZONE_MODEL = 'experimental-earth-root-zone-dry-down/1';
const finite = (n, lo, hi) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
const record = x => x && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys, label) => {
  if (!record(x) || Object.keys(x).some(k => !keys.includes(k)) ||
      keys.some(k => !Object.hasOwn(x, k))) throw Error('Invalid ' + label + ' fields');
};
const source = (s, label) => {
  if (typeof s !== 'string' || !s.trim() || s.length > 500) throw Error(label + ' needs an attributed source or explicit hypothetical assumption');
};
export function validateRootZone(root) {
  exact(root, ['fieldCapacity','wiltingPoint','rootDepthM','initialAvailableMm','depletionFraction','source'], 'root-zone');
  if (!finite(root.fieldCapacity, 0, 1) || !finite(root.wiltingPoint, 0, 1) ||
      root.fieldCapacity <= root.wiltingPoint || !finite(root.rootDepthM, 0.001, 10) ||
      !finite(root.depletionFraction, 0, 1)) throw Error('Root-zone fractions or depth are out of bounds');
  const capacityMm = 1000 * (root.fieldCapacity - root.wiltingPoint) * root.rootDepthM;
  // Accept only a few arithmetic ulps at the computed capacity boundary.
  const capacityRoundoff = 4 * Number.EPSILON * Math.max(1, capacityMm);
  if (!finite(root.initialAvailableMm, 0, capacityMm + capacityRoundoff)) throw Error('Initial available water must be between zero and the declared capacity');
  source(root.source, 'Root zone');
  return { capacityMm, readilyAvailableMm: root.depletionFraction * capacityMm,
    stressThresholdMm: (1 - root.depletionFraction) * capacityMm };
}
export function validateDrySchedule(schedule) {
  if (!Array.isArray(schedule) || schedule.length < 1 || schedule.length > 60) throw Error('Supply 1–60 complete dry-period intervals');
  let days = 0;
  for (const row of schedule) {
    exact(row, ['durationDays','potentialTranspirationMmPerDay','source'], 'dry-period interval');
    if (!finite(row.durationDays, 0.001, 366) || !finite(row.potentialTranspirationMmPerDay, 0, 30)) throw Error('Dry-period duration or transpiration demand is out of bounds');
    source(row.source, 'Transpiration interval');
    days += row.durationDays;
  }
  if (days > 366) throw Error('The complete dry period is limited to 366 days');
  return days;
}

/** Exact piecewise solution for dS/dt = -demand * min(1,S/threshold).
 * threshold=0 is the explicit full-demand-until-empty limit (p=1).
 * The constitutive coefficient reduces transpiration only; soil evaporation
 * must not be quietly added to the supplied demand.
 */
export function advanceRootZoneDry({availableMm, capacityMm, depletionFraction, demandMmPerDay, days}) {
  if (!finite(capacityMm, Number.MIN_VALUE, 10000) || !finite(availableMm, 0, capacityMm) ||
      !finite(depletionFraction, 0, 1) || !finite(demandMmPerDay, 0, 30) ||
      !finite(days, 0, 366)) throw Error('Invalid dry-down state or forcing');
  const potentialMm = demandMmPerDay * days, threshold = (1 - depletionFraction) * capacityMm;
  if (potentialMm === 0) return { availableMm, suppliedMm: 0, unmetMm: 0, potentialMm,
    demandLimitedDays: 0, firstLimitedDay: null };
  const fullDays = Math.min(days, Math.max(0, availableMm - threshold) / demandMmPerDay);
  const linearLoss = demandMmPerDay * fullDays;
  const remainder = days - fullDays;
  const atThreshold = Math.max(0, availableMm - linearLoss);
  const exponentialLoss = threshold > 0 ? atThreshold * -Math.expm1(-demandMmPerDay * remainder / threshold) : 0;
  const suppliedMm = Math.min(potentialMm, availableMm, linearLoss + exponentialLoss);
  const demandLimitedDays = remainder;
  return { availableMm: Math.max(0, availableMm - suppliedMm), suppliedMm,
    unmetMm: Math.max(0, potentialMm - suppliedMm), potentialMm, demandLimitedDays,
    firstLimitedDay: demandLimitedDays > 0 ? fullDays : null };
}

export function runRootZone(root, rechargeMm, schedule) {
  const capacity = validateRootZone(root), totalDays = validateDrySchedule(schedule);
  if (!finite(rechargeMm, 0, 1000000)) throw Error('Modeled recharge is outside the admitted range');
  const before = Math.min(root.initialAvailableMm, capacity.capacityMm), retainedRechargeMm = Math.min(rechargeMm, capacity.capacityMm - before);
  const drainageMm = rechargeMm - retainedRechargeMm;
  const rechargedMm = before + retainedRechargeMm;
  let availableMm = rechargedMm, day = 0, suppliedMm = 0, potentialMm = 0, unmetMm = 0;
  let demandLimitedDays = 0, firstLimitedDay = null;
  const snapshots = [{day: 0, availableMm, suppliedMm: 0, unmetMm: 0, demandLimitedDays: 0}];
  const intervals = [];
  schedule.forEach((forcing, index) => {
    const initialMm = availableMm;
    const step = advanceRootZoneDry({availableMm, capacityMm: capacity.capacityMm,
      depletionFraction: root.depletionFraction, demandMmPerDay: forcing.potentialTranspirationMmPerDay,
      days: forcing.durationDays});
    if (firstLimitedDay === null && step.firstLimitedDay !== null) firstLimitedDay = day + step.firstLimitedDay;
    intervals.push({index, startDay: day, endDay: day + forcing.durationDays, initialMm,
      forcing: structuredClone(forcing), ...step});
    day += forcing.durationDays; availableMm = step.availableMm;
    suppliedMm += step.suppliedMm; potentialMm += step.potentialMm; unmetMm += step.unmetMm;
    demandLimitedDays += step.demandLimitedDays;
    snapshots.push({day, availableMm, suppliedMm, unmetMm, demandLimitedDays});
  });
  return { schema: ROOT_ZONE_MODEL, ...capacity, root: structuredClone(root), totalDays,
    initialAvailableMm: before, rechargeMm, retainedRechargeMm, drainageMm, rechargedMm,
    availableMm, suppliedMm, potentialMm, unmetMm, demandLimitedDays, firstLimitedDay,
    balanceErrorMm: before + rechargeMm - drainageMm - suppliedMm - availableMm,
    intervals, snapshots };
}

/** Inspect any point without interpolating across the nonlinear dry-down. */
export function rootZoneAtDay(result, day) {
  if (result?.schema !== ROOT_ZONE_MODEL || !finite(day, 0, result.totalDays)) throw Error('Day is outside this computed dry period');
  if (day === 0) return {...result.snapshots[0]};
  const interval = result.intervals.find(row => day <= row.endDay);
  const prior = result.snapshots[interval.index];
  const step = advanceRootZoneDry({availableMm: interval.initialMm, capacityMm: result.capacityMm,
    depletionFraction: result.root.depletionFraction,
    demandMmPerDay: interval.forcing.potentialTranspirationMmPerDay, days: day - interval.startDay});
  return {day, availableMm: step.availableMm, suppliedMm: prior.suppliedMm + step.suppliedMm,
    unmetMm: prior.unmetMm + step.unmetMm, demandLimitedDays: prior.demandLimitedDays + step.demandLimitedDays};
}
