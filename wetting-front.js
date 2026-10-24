/**
 * Event-scale Green–Ampt infiltration, with ponding head neglected.
 * K is conductivity (mm/h), A is suction × initial moisture deficit (mm).
 * F is cumulative infiltration (mm); no drying/redistribution resets F.
 * References and model boundaries: docs/WETTING_FRONT.md.
 */
function nonnegative(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite nonnegative number`);
  }
}

// x - log(1+x), evaluated without subtracting nearly equal numbers.
function logRemainder(x) {
  if (x >= 0.01) return x - Math.log1p(x);
  let power = x * x, sum = power / 2;
  for (let order = 3; order <= 12; order++) {
    power *= -x;
    sum += power / order;
  }
  return sum;
}

function integratedTimeDepth(initialMm, incrementMm, driveMm) {
  if (driveMm === 0) return incrementMm;
  const denominator = initialMm + driveMm;
  const ratio = incrementMm / denominator;
  if (ratio >= 0.01) {
    const logarithm = Number.isFinite(ratio) ? Math.log1p(ratio) :
      Math.log(incrementMm + denominator) - Math.log(denominator);
    return incrementMm - driveMm * logarithm;
  }
  return incrementMm * (initialMm / denominator) +
    driveMm * logRemainder(ratio);
}

function ponded(initialMm, conductivityMmHr, driveMm, hours) {
  const demand = conductivityMmHr * hours;
  if (demand === 0) return 0;
  if (driveMm === 0) return demand;
  // Integral >= d²/[2(A+d)] for F0 >= 0. Its positive root brackets d.
  let lo = demand;
  const dryStartBound = demand + Math.sqrt(demand * demand + 2 * driveMm * demand);
  // f(F) decreases. This tighter upper bound also preserves tiny increments
  // after a large cumulative depth instead of exhausting the bisection budget.
  let hi = initialMm > 0 ? Math.min(dryStartBound, demand * (1 + driveMm / initialMm)) : dryStartBound;
  let estimate = hi;
  for (let iteration = 0; iteration < 64; iteration++) {
    const elapsed = integratedTimeDepth(initialMm, estimate, driveMm);
    const residual = elapsed - demand;
    if (residual < 0) lo = estimate;
    else hi = estimate;
    if (Math.abs(residual) <= demand * 8 * Number.EPSILON) return estimate;
    const derivative = (initialMm + estimate) / (initialMm + estimate + driveMm);
    const next = estimate - residual / derivative;
    const middle = lo + (hi - lo) / 2;
    if (middle === lo || middle === hi) break;
    estimate = Number.isFinite(next) && next > lo && next < hi ? next : middle;
  }
  return lo + (hi - lo) / 2;
}

/** Integrated ponded increment; unlike an instantaneous rate it is finite at F=0. */
export function pondedInfiltration(initialMm, conductivityMmHr, capillaryDriveMm, hours) {
  for (const [value, name] of [[initialMm, 'Cumulative infiltration'],
    [conductivityMmHr, 'Conductivity'], [capillaryDriveMm, 'Capillary drive'], [hours, 'Duration']]) {
    nonnegative(value, name);
  }
  if (initialMm > 1e9 || conductivityMmHr > 2000 || capillaryDriveMm > 5000 || hours > 12) {
    throw new Error('Wetting-front calculation exceeds its supported event bounds');
  }
  return ponded(initialMm, conductivityMmHr, capillaryDriveMm, hours);
}

/**
 * Exact local constant-rain segment for this sharp-front model. Surface water
 * is supplied continuously. A pre-existing pool may drain and later reform;
 * simply min(potential infiltration, total water) is wrong in that case.
 */
export function advanceWettingFront({ cumulativeMm, surfaceWaterMm, rainMmHr,
  hours, conductivityMmHr, capillaryDriveMm }) {
  for (const [value, name] of [[cumulativeMm, 'Cumulative infiltration'],
    [surfaceWaterMm, 'Surface water'], [rainMmHr, 'Rainfall rate'], [hours, 'Duration'],
    [conductivityMmHr, 'Conductivity'], [capillaryDriveMm, 'Capillary drive']]) nonnegative(value, name);
  if (cumulativeMm > 1e9 || surfaceWaterMm > 1e9 || rainMmHr > 2000 ||
      conductivityMmHr > 2000 || capillaryDriveMm > 5000 || hours > 12) {
    throw new Error('Wetting-front calculation exceeds its supported event bounds');
  }
  const supply = surfaceWaterMm + rainMmHr * hours;
  const K = conductivityMmHr, A = capillaryDriveMm, F = cumulativeMm;
  let amount = 0;
  if (hours > 0 && K > 0 && supply > 0) {
    if (A === 0) amount = Math.min(supply, K * hours);
    else if (rainMmHr <= K) {
      // Once an initial pool empties, rainfall cannot re-form it.
      amount = surfaceWaterMm === 0 ? supply : Math.min(supply, ponded(F, K, A, hours));
    } else {
      const saturationDepth = K * A / (rainMmHr - K);
      if (surfaceWaterMm === 0 && F < saturationDepth) {
        const untilPonding = (saturationDepth - F) / rainMmHr;
        amount = untilPonding >= hours ? supply :
          saturationDepth - F + ponded(saturationDepth, K, A, hours - untilPonding);
      } else {
        const potential = ponded(F, K, A, hours);
        if (F >= saturationDepth) amount = potential;
        else {
          // While ponded, surface depth has its minimum when f(F)=rain.
          const toMinimum = integratedTimeDepth(F, saturationDepth - F, A) / K;
          const atMinimum = Math.min(hours, toMinimum);
          const incrementAtMinimum = toMinimum <= hours ? saturationDepth - F : potential;
          const minimumWater = surfaceWaterMm + rainMmHr * atMinimum - incrementAtMinimum;
          if (minimumWater >= 0) amount = potential;
          else if (F + supply <= saturationDepth) amount = supply;
          else {
            // A depleted pool leaves all supply infiltrating until F=Fp.
            const repondingTime = (saturationDepth - F - surfaceWaterMm) / rainMmHr;
            amount = saturationDepth - F + ponded(saturationDepth, K, A, hours - repondingTime);
          }
        }
      }
    }
  }
  const infiltratedMm = Math.max(0, Math.min(supply, amount));
  return { infiltratedMm, cumulativeMm: F + infiltratedMm,
    surfaceWaterMm: supply - infiltratedMm };
}
