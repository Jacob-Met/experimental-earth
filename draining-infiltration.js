/** A declared finite linear reservoir coupled to surface infiltration.
 * This is a conceptual model, not an inferred soil property. Depths are mm,
 * rates mm/hour, drainage coefficient 1/hour and durations hours.
 */
export const DRAINING_LAYER_SCHEMA = 'experimental-earth-draining-layer/1';
const bounded = (x, max) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= max;

export function validateDrainingLayer(layer, surfaces) {
  const keys = ['schema', 'surface', 'capacityMm', 'initialStoredMm', 'drainagePerHour', 'source'];
  if (!layer || typeof layer !== 'object' || Array.isArray(layer) ||
      Object.keys(layer).some(key => !keys.includes(key)) ||
      keys.some(key => !Object.hasOwn(layer, key)) || layer.schema !== DRAINING_LAYER_SCHEMA ||
      typeof layer.surface !== 'string' || !Object.hasOwn(surfaces, layer.surface) ||
      !bounded(layer.capacityMm, 10000) || !bounded(layer.initialStoredMm, layer.capacityMm) ||
      !bounded(layer.drainagePerHour, 100) || typeof layer.source !== 'string' ||
      !layer.source.trim() || layer.source.length > 500) {
    throw Error('Declare a known surface, 0–10,000 mm total storage, initial water within that storage, 0–100 /hour drainage and an attributed source or hypothetical basis');
  }
  return layer;
}

// Stable integral factors for exp(-z). In particular, computing 1-phi by
// subtraction would erase small but nonzero drainage from arriving water.
function factors(z) {
  if (z === 0) return {decay: 1, lost: 0, phi: 1, oneMinusPhi: 0};
  const lost = -Math.expm1(-z);
  const oneMinusPhi = z < 0.001
    ? z * (0.5 + z * (-1 / 6 + z * (1 / 24 + z * (-1 / 120 + z / 720))))
    : 1 - lost / z;
  return {decay: Math.exp(-z), lost, phi: lost / z, oneMinusPhi};
}

/** Exact constant-forcing surface/receiver subproblem, to floating precision.
 * H'=R-q, S'=q-kS, D'=kS. The transfer q is bounded by the stated surface
 * infiltration rate, available surface supply, and receiving space. At S=C,
 * ongoing infiltration cannot exceed kC. State transitions are solved before
 * advancing; no clipping of excess infiltration discards water.
 */
export function advanceDrainingLayer({surfaceMm, storedMm, capacityMm,
  infiltrationMmHr, drainagePerHour, rainMmHr, hours}) {
  if (!bounded(surfaceMm, 100000) || !bounded(capacityMm, 10000) ||
      !bounded(storedMm, capacityMm) || !bounded(infiltrationMmHr, 2000) ||
      !bounded(drainagePerHour, 100) || !bounded(rainMmHr, 250) || !bounded(hours, 12)) {
    throw Error('Invalid bounded draining-layer state, rates or duration');
  }
  const initialSurfaceMm = surfaceMm, initialStoredMm = storedMm;
  let remaining = hours, infiltratedMm = 0, drainedMm = 0, limited = false, segments = 0;
  while (remaining > 0) {
    // With fixed forcing there are at most a filling and an emptying transition
    // (in either order). A guard refuses a numerical pathology, never returns
    // a partial course as if it were complete.
    if (++segments > 6) throw Error('Draining-layer transitions did not resolve');
    const offeredRate = Math.min(infiltrationMmHr, surfaceMm === 0 ? rainMmHr : Infinity);
    const full = storedMm === capacityMm;
    const rate = full ? Math.min(offeredRate, drainagePerHour * capacityMm) : offeredRate;
    if (rate < offeredRate) limited = true;
    const emptyAt = rate > rainMmHr ? surfaceMm / (rate - rainMmHr) : Infinity;
    let fillAt = Infinity;
    if (!full && rate > drainagePerHour * capacityMm) {
      const gap = capacityMm - storedMm;
      const excess = rate - drainagePerHour * capacityMm;
      const z = drainagePerHour * gap / excess;
      // log1p(z)/k loses the entire fill time when k*gap underflows.
      // This equivalent form has the correct zero-drain limit even for an
      // admitted subnormal positive k; an event snap cannot invent storage.
      fillAt = (gap / excess) * (z === 0 ? 1 : Math.log1p(z) / z);
    }
    const dt = Math.min(remaining, emptyAt, fillAt);
    const f = factors(drainagePerHour * dt);
    const accepted = rate * dt;
    const drainage = storedMm * f.lost + accepted * f.oneMinusPhi;
    let nextStored = storedMm * f.decay + accepted * f.phi;
    let nextSurface = surfaceMm + (rainMmHr - rate) * dt;
    // Exact event coordinates prevent a roundoff remnant from re-triggering
    // the same event. Bounds elsewhere absorb floating roundoff only.
    if (dt === fillAt) nextStored = capacityMm;
    if (dt === emptyAt) nextSurface = 0;
    storedMm = Math.max(0, Math.min(capacityMm, nextStored));
    surfaceMm = Math.max(0, nextSurface);
    infiltratedMm += accepted; drainedMm += drainage;
    remaining -= dt;
  }
  return {
    surfaceMm, storedMm, infiltratedMm, drainedMm, limited, segments,
    surfaceBalanceErrorMm: initialSurfaceMm + rainMmHr * hours - infiltratedMm - surfaceMm,
    receiverBalanceErrorMm: initialStoredMm + infiltratedMm - storedMm - drainedMm,
  };
}

/** Own separate receiver inventories while the maintained solver owns routing. */
export function createDrainingLayer(cells, cellAreaM2, declaration, surfaces) {
  if (declaration === undefined) return null;
  validateDrainingLayer(declaration, surfaces);
  const {surface, capacityMm, initialStoredMm, drainagePerHour} = declaration;
  const stored = cells.map(cell => cell.surface === surface ? initialStoredMm : null);
  const infiltrated = stored.map(value => value === null ? null : 0);
  const drained = stored.map(value => value === null ? null : 0);
  const limited = cells.map(() => false);
  const count = stored.filter(value => value !== null).length;
  const sumLiters = values => values.reduce((sum, value) => sum + (value ?? 0), 0) * cellAreaM2;
  const snapshots = [];
  function endStep(minute) {
    snapshots.push({minute, retainedLiters: sumLiters(stored),
      drainedLiters: sumLiters(drained), infiltratedLiters: sumLiters(infiltrated)});
  }
  endStep(0);
  return {
    applies(index) { return stored[index] !== null; },
    advance(index, surfaceMm, infiltrationMmHr, rainMmHr, rainyHours, dryHours) {
      let accepted = 0;
      for (const [hours, rain] of [[rainyHours, rainMmHr], [dryHours, 0]]) {
        if (hours === 0) continue;
        const result = advanceDrainingLayer({surfaceMm, storedMm: stored[index], capacityMm,
          infiltrationMmHr, drainagePerHour, rainMmHr: rain, hours});
        surfaceMm = result.surfaceMm; stored[index] = result.storedMm;
        accepted += result.infiltratedMm; drained[index] += result.drainedMm;
        limited[index] ||= result.limited;
      }
      infiltrated[index] += accepted;
      return accepted;
    },
    endStep,
    finish() {
      const initialLiters = initialStoredMm * count * cellAreaM2;
      const retainedLiters = sumLiters(stored), infiltratedLiters = sumLiters(infiltrated);
      const drainedLiters = sumLiters(drained);
      return {schema: DRAINING_LAYER_SCHEMA, declaration: structuredClone(declaration),
        affectedCellCount: count, initialLiters, retainedLiters, infiltratedLiters, drainedLiters,
        balanceErrorLiters: initialLiters + infiltratedLiters - retainedLiters - drainedLiters,
        retainedMm: stored.slice(), drainedMm: drained.slice(), infiltratedMm: infiltrated.slice(),
        balanceErrorMm: stored.map((value, i) => value === null ? null :
          initialStoredMm + infiltrated[i] - value - drained[i]),
        limitedCells: limited.slice(), snapshots};
    },
  };
}
