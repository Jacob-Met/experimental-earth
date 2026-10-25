import { advanceSurfaceHeat } from './surface-heat.js';
import { exponentialSurfaceLoss,exponentialDrivenSurfaceLoss } from './heat-exponential-loss.js';

// Exact-real propagator for two declared, internally uniform heat stores.
// Computation is floating point; these are not certified interval bounds.
const finite = (x, lo, hi) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
function factors(x) {
  if (x < .001) return {
    phi: 1 + x * (-1 / 2 + x * (1 / 6 + x * (-1 / 24 + x * (1 / 120 + x * (-1 / 720 + x / 5040))))),
    psi: .5 + x * (-1 / 6 + x * (1 / 24 + x * (-1 / 120 + x * (1 / 720 + x * (-1 / 5040 + x / 40320))))),
  };
  const phi = -Math.expm1(-x) / x;
  return { phi, psi: (1 - phi) / x };
}

// Divided power differences preserve the small coupling term when both rates
// are small. Direct subtraction of two nearly unit phi values loses that term.
function differences(slow, fast) {
  if (fast >= .01) {
    const a = factors(slow), b = factors(fast);
    return { phi: a.phi - b.phi, psi: a.psi - b.psi };
  }
  let phi = 0, psi = 0, factorial = 1;
  for (let n = 1; n <= 8; n++) {
    factorial *= n + 1;
    let sum = 0;
    for (let j = 0; j < n; j++) sum += slow ** (n - 1 - j) * fast ** j;
    const term = (n % 2 ? -1 : 1) * (slow - fast) * sum / factorial;
    phi += term; psi += term / (n + 2);
  }
  return { phi, psi };
}

function validate(surface, lower, interval, initial, seconds, maximumConductance = 1000) {
  if (!surface || !lower || !interval || !initial ||
      !finite(surface.capacityJm2K, 1000, 1e7) || !finite(lower.capacityJm2K, 1000, 1e7) ||
      !finite(surface.exchangeWm2K, 0, 1000) || !finite(lower.conductanceWm2K, 0, maximumConductance) ||
      !finite(surface.absorptivity, 0, 1) || !finite(interval.incidentWm2, 0, 2000) ||
      !finite(interval.reservoirC, -100, 200) || !finite(initial.surfaceC, -100, 500) ||
      !finite(initial.subsurfaceC, -100, 500) || !finite(seconds, 0, 86400)) {
    throw Error('Two-layer heat step requires supported finite capacities, exchange, conductance, temperatures and elapsed seconds');
  }
}

function spectrum(surface, lower, interval, initial, bottom = null, secondInputWm2 = 0) {
  const c1 = surface.capacityJm2K, c2 = lower.capacityJm2K;
  const h = surface.exchangeWm2K, g = lower.conductanceWm2K;
  const b = bottom?.conductanceWm2K ?? 0;
  const q = surface.absorptivity * interval.incidentWm2;
  const v = [(q - h * (initial.surfaceC - interval.reservoirC) - g * (initial.surfaceC - initial.subsurfaceC)) / c1,
    bottom ? (g * (initial.surfaceC - initial.subsurfaceC) - b * (initial.subsurfaceC - bottom.reservoirC)) / c2 : g * (initial.surfaceC - initial.subsurfaceC) / c2];
  if (secondInputWm2 !== 0) v[1] += secondInputWm2 / c2;
  const scale = [Math.sqrt(c1), Math.sqrt(c2)], u = v.map((x, i) => x * scale[i]);
  // Capacity scaling makes the decay matrix symmetric. Its orthogonal
  // projection avoids a poorly scaled nonsymmetric eigenvector basis.
  const a = (h + g) / c1, d = bottom ? (g + b) / c2 : g / c2, k = g / (scale[0] * scale[1]);
  const gap = Math.hypot(a - d, 2 * k), fast = (a + d + gap) / 2;
  const slow = fast === 0 ? 0 : !bottom ? (h / c1) * (g / c2) / fast :
    ((h / c1) * (g / c2) + (h / c1) * (b / c2) + (g / c1) * (b / c2)) / fast;
  let projected = [0, 0], projection = [0, 0];
  if (gap > 0) {
    let p11, p22;
    if (a >= d) { p11 = (2 * k / gap) * (k / (gap + a - d)); p22 = 1 - p11; }
    else { p22 = (2 * k / gap) * (k / (gap + d - a)); p11 = 1 - p22; }
    const p12 = k / gap;
    projection = [p11, p12];
    projected = [p11 * u[0] + p12 * u[1], p12 * u[0] + p22 * u[1]];
  }
  return { c1, c2, h, g, b, q, v, scale, u, projected, projection, slow, fast };
}

function stationary(s, seconds) {
  const out = { surface: [], subsurface: [] };
  if (!(s.fast > s.slow)) return out;
  for (const [i, name] of ['surface', 'subsurface'].entries()) {
    const a = s.projected[i] / s.scale[i], b = s.v[i] - a;
    if (a === 0 || b === 0 || Math.sign(a) === Math.sign(b)) continue;
    const time = (Math.log(Math.abs(b)) - Math.log(Math.abs(a))) / (s.fast - s.slow);
    if (Number.isFinite(time) && time > 0 && time < seconds) out[name].push(time);
  }
  return out;
}

/** Constant-forcing step. Positive external exchange leaves the surface;
 * positive internal transfer enters the subsurface. No bottom flux is modeled.
 */
export function advanceHeatColumn(surface, lower, interval, initial, seconds) {
  return advanceColumn(surface, lower, interval, initial, seconds, null);
}

/** Same maintained propagator with a nonnegative, exponentially declining
 * surface heat loss. Water/latent-energy assumptions belong to its caller.
 * Interior extrema are not searched for the additional exponential mode.
 */
export function advanceHeatColumnWithLoss(surface, lower, interval, initial, seconds, loss) {
  if (!loss || !finite(loss.initialWm2, 0, 5000) || !finite(loss.decayPerSecond, 0, 1e100)) {
    throw Error('Surface loss needs finite initial flux 0–5000 W/m² and nonnegative decay');
  }
  if (loss.initialWm2 === 0) return {...advanceHeatColumn(surface, lower, interval, initial, seconds), surfaceLossJm2: 0};
  return advanceColumn(surface, lower, interval, initial, seconds, loss);
}

/** Same propagator with a nonnegative loss approaching an explicit level.
 * Rising and falling responses share stable analytic modal integrals. */
export function advanceHeatColumnWithDrivenLoss(surface,lower,interval,initial,seconds,loss) {
  if(!loss||!finite(loss.initialWm2,0,5000)||!finite(loss.equilibriumWm2,0,2e6)||
    !finite(loss.decayPerSecond,0,1e100)||!finite(seconds,0,86400))throw Error('Driven loss needs supported nonnegative initial/equilibrium flux, rate and duration');
  const z=loss.decayPerSecond*seconds,end=loss.initialWm2*Math.exp(-z)+loss.equilibriumWm2*(-Math.expm1(-z));
  if(!finite(end,0,5000))throw Error('Driven loss exceeds 5000 W/m² during this interval');
  if(loss.equilibriumWm2===0)return advanceHeatColumnWithLoss(surface,lower,interval,initial,seconds,loss);
  if(loss.decayPerSecond===0||loss.initialWm2===loss.equilibriumWm2)
    return advanceHeatColumnWithLoss(surface,lower,interval,initial,seconds,{initialWm2:loss.initialWm2,decayPerSecond:0});
  return advanceColumn(surface,lower,interval,initial,seconds,loss);
}

function advanceColumn(surface, lower, interval, initial, seconds, loss, bottom = null, secondInputWm2 = null, maximumConductance = 1000) {
  validate(surface, lower, interval, initial, seconds, maximumConductance);
  if (lower.conductanceWm2K === 0 && !loss && !bottom) {
    const one = advanceSurfaceHeat(surface, interval, initial.surfaceC, seconds);
    const rate = surface.exchangeWm2K / surface.capacityJm2K;
    const velocity = (surface.absorptivity * interval.incidentWm2 -
      surface.exchangeWm2K * (initial.surfaceC - interval.reservoirC)) / surface.capacityJm2K;
    const surfaceMeanC = initial.surfaceC + seconds * factors(rate * seconds).psi * velocity;
    return { surfaceC: one.temperatureC, subsurfaceC: initial.subsurfaceC,
      surfaceMeanC, subsurfaceMeanC: initial.subsurfaceC,
      surfaceDegreeSeconds: surfaceMeanC * seconds, subsurfaceDegreeSeconds: initial.subsurfaceC * seconds,
      inputJm2: one.inputJm2, exchangeOutJm2: one.exchangedJm2, transferDownJm2: 0,
      surfaceStoredJm2: one.storedJm2, subsurfaceStoredJm2: 0, totalStoredJm2: one.storedJm2,
      balanceResidualJm2: one.balanceResidualJm2, surfaceBalanceResidualJm2: one.balanceResidualJm2,
      subsurfaceBalanceResidualJm2: 0, stationarySeconds: { surface: [], subsurface: [] } };
  }
  const s = spectrum(surface, lower, interval, initial, bottom, secondInputWm2 ?? 0);
  const f = factors(s.fast * seconds), diff = differences(s.slow * seconds, s.fast * seconds);
  const delta = s.u.map((u, i) => seconds * (f.phi * u + diff.phi * s.projected[i]) / s.scale[i]);
  const integral = s.u.map((u, i) => seconds * seconds * (f.psi * u + diff.psi * s.projected[i]) / s.scale[i]);
  // Compute the mean change directly. Dividing a cumulative integral difference
  // would lose short windows; dividing by ambient exchange would fail at h=0.
  const meanChange = s.u.map((u, i) => seconds * (f.psi * u + diff.psi * s.projected[i]) / s.scale[i]);
  let surfaceLossJm2 = 0;
  if (loss) {
    const response = loss.equilibriumWm2===undefined?exponentialSurfaceLoss(s,loss.initialWm2,loss.decayPerSecond,seconds):
      exponentialDrivenSurfaceLoss(s,loss.initialWm2,loss.equilibriumWm2,loss.decayPerSecond,seconds);
    for (let i = 0; i < 2; i++) {
      delta[i] += response.delta[i]; integral[i] += response.integral[i]; meanChange[i] += response.mean[i];
    }
    surfaceLossJm2 = response.lossJm2;
  }
  const surfaceMeanC = initial.surfaceC + meanChange[0], subsurfaceMeanC = initial.subsurfaceC + meanChange[1];
  const surfaceC = initial.surfaceC + delta[0], subsurfaceC = initial.subsurfaceC + delta[1];
  const inputJm2 = s.q * seconds;
  const exchangeOutJm2 = s.h * ((initial.surfaceC - interval.reservoirC) * seconds + integral[0]);
  const transferDownJm2 = s.g * ((initial.surfaceC - initial.subsurfaceC) * seconds + integral[0] - integral[1]);
  const bottomOutJm2 = bottom ? s.b * ((initial.subsurfaceC - bottom.reservoirC) * seconds + integral[1]) : 0;
  const surfaceStoredJm2 = s.c1 * (surfaceC - initial.surfaceC), subsurfaceStoredJm2 = s.c2 * (subsurfaceC - initial.subsurfaceC);
  const totalStoredJm2 = surfaceStoredJm2 + subsurfaceStoredJm2;
  if (![surfaceC, subsurfaceC, surfaceMeanC, subsurfaceMeanC, inputJm2, exchangeOutJm2, transferDownJm2, bottomOutJm2, totalStoredJm2].every(Number.isFinite) ||
      surfaceC < -100 || surfaceC > 500 || subsurfaceC < -100 || subsurfaceC > 500) {
    throw Error('Predicted two-layer temperature leaves the supported −100–500 °C range; revise the declaration');
  }
  const result = { surfaceC, subsurfaceC, inputJm2, exchangeOutJm2, transferDownJm2, surfaceStoredJm2,
    surfaceMeanC, subsurfaceMeanC,
    surfaceDegreeSeconds: initial.surfaceC * seconds + integral[0],
    subsurfaceDegreeSeconds: initial.subsurfaceC * seconds + integral[1],
    subsurfaceStoredJm2, totalStoredJm2, balanceResidualJm2: bottom ? inputJm2 - surfaceLossJm2 - exchangeOutJm2 - bottomOutJm2 - totalStoredJm2 : inputJm2 - surfaceLossJm2 - exchangeOutJm2 - totalStoredJm2,
    surfaceBalanceResidualJm2: inputJm2 - surfaceLossJm2 - exchangeOutJm2 - transferDownJm2 - surfaceStoredJm2,
    subsurfaceBalanceResidualJm2: bottom ? transferDownJm2 - bottomOutJm2 - subsurfaceStoredJm2 : transferDownJm2 - subsurfaceStoredJm2,
    stationarySeconds: loss ? {surface: [], subsurface: []} : stationary(s, seconds),
    ...(bottom ? {bottomOutJm2} : {}),
    ...(loss ? {surfaceLossJm2} : {}) };
  if (secondInputWm2 !== null) {
    result.secondInputJm2 = secondInputWm2 * seconds;
    result.balanceResidualJm2 += result.secondInputJm2;
    result.subsurfaceBalanceResidualJm2 += result.secondInputJm2;
  }
  return result;
}

/** Explicit constant deep reservoir. Positive bottom exchange leaves the lower
 * store. Existing callers and cooling-loss APIs retain their insulated model. */
export function advanceHeatColumnWithBottom(surface, lower, interval, initial, seconds, bottom) {
  if (!bottom || !finite(bottom.conductanceWm2K, 0, 1000) || !finite(bottom.reservoirC, -100, 200)) {
    throw Error('Bottom exchange needs conductance 0–1000 W/(m²·K) and reservoir −100–200 °C');
  }
  if (bottom.conductanceWm2K === 0) return {
    ...advanceHeatColumn(surface, lower, interval, initial, seconds), bottomOutJm2: 0
  };
  return advanceColumn(surface, lower, interval, initial, seconds, null, bottom);
}


/** Exact-real two-forced-store response using the maintained spectral kernel.
 * Both internally uniform stores receive the supplied incident exposure and
 * exchange with its reservoir. Positive internal transfer travels first->second.
 * Capacities and conductance here are per unit cell area; lateral consumers
 * convert their total edge conductance before calling. Old column wrappers
 * retain their original admission and surface-only forcing unchanged.
 */
export function advanceCoupledHeatLayers(first, second, interval, initial, seconds, conductanceWm2K) {
  if (!second || !finite(second.absorptivity, 0, 1) || !finite(second.exchangeWm2K, 0, 1000)) {
    throw Error('The second layer needs absorption 0–1 and exchange 0–1000 W/(m²·K)');
  }
  const result = advanceColumn(first,
    {capacityJm2K:second.capacityJm2K, conductanceWm2K}, interval,
    {surfaceC:initial?.firstC, subsurfaceC:initial?.secondC}, seconds, null,
    {conductanceWm2K:second.exchangeWm2K, reservoirC:interval?.reservoirC},
    second.absorptivity * interval?.incidentWm2, 16000);
  return {firstC:result.surfaceC, secondC:result.subsurfaceC,
    firstMeanC:result.surfaceMeanC, secondMeanC:result.subsurfaceMeanC,
    firstInputJm2:result.inputJm2, secondInputJm2:result.secondInputJm2,
    firstExchangeOutJm2:result.exchangeOutJm2, secondExchangeOutJm2:result.bottomOutJm2,
    transferJm2:result.transferDownJm2,
    firstStoredJm2:result.surfaceStoredJm2, secondStoredJm2:result.subsurfaceStoredJm2,
    totalStoredJm2:result.totalStoredJm2, balanceResidualJm2:result.balanceResidualJm2,
    firstBalanceResidualJm2:result.surfaceBalanceResidualJm2,
    secondBalanceResidualJm2:result.subsurfaceBalanceResidualJm2,
    stationarySeconds:{first:result.stationarySeconds.surface, second:result.stationarySeconds.subsurface}};
}
