import { advanceSurfaceHeat } from './surface-heat.js';

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

function validate(surface, lower, interval, initial, seconds) {
  if (!surface || !lower || !interval || !initial ||
      !finite(surface.capacityJm2K, 1000, 1e7) || !finite(lower.capacityJm2K, 1000, 1e7) ||
      !finite(surface.exchangeWm2K, 0, 1000) || !finite(lower.conductanceWm2K, 0, 1000) ||
      !finite(surface.absorptivity, 0, 1) || !finite(interval.incidentWm2, 0, 2000) ||
      !finite(interval.reservoirC, -100, 200) || !finite(initial.surfaceC, -100, 500) ||
      !finite(initial.subsurfaceC, -100, 500) || !finite(seconds, 0, 86400)) {
    throw Error('Two-layer heat step requires supported finite capacities, exchange, conductance, temperatures and elapsed seconds');
  }
}

function spectrum(surface, lower, interval, initial) {
  const c1 = surface.capacityJm2K, c2 = lower.capacityJm2K;
  const h = surface.exchangeWm2K, g = lower.conductanceWm2K;
  const q = surface.absorptivity * interval.incidentWm2;
  const v = [(q - h * (initial.surfaceC - interval.reservoirC) - g * (initial.surfaceC - initial.subsurfaceC)) / c1,
    g * (initial.surfaceC - initial.subsurfaceC) / c2];
  const scale = [Math.sqrt(c1), Math.sqrt(c2)], u = v.map((x, i) => x * scale[i]);
  // Capacity scaling makes the decay matrix symmetric. Its orthogonal
  // projection avoids a poorly scaled nonsymmetric eigenvector basis.
  const a = (h + g) / c1, d = g / c2, k = g / (scale[0] * scale[1]);
  const gap = Math.hypot(a - d, 2 * k), fast = (a + d + gap) / 2;
  const slow = fast === 0 ? 0 : (h / c1) * (g / c2) / fast;
  let projected = [0, 0];
  if (gap > 0) {
    let p11, p22;
    if (a >= d) { p11 = (2 * k / gap) * (k / (gap + a - d)); p22 = 1 - p11; }
    else { p22 = (2 * k / gap) * (k / (gap + d - a)); p11 = 1 - p22; }
    const p12 = k / gap;
    projected = [p11 * u[0] + p12 * u[1], p12 * u[0] + p22 * u[1]];
  }
  return { c1, c2, h, g, q, v, scale, u, projected, slow, fast };
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
  validate(surface, lower, interval, initial, seconds);
  if (lower.conductanceWm2K === 0) {
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
  const s = spectrum(surface, lower, interval, initial);
  const f = factors(s.fast * seconds), diff = differences(s.slow * seconds, s.fast * seconds);
  const delta = s.u.map((u, i) => seconds * (f.phi * u + diff.phi * s.projected[i]) / s.scale[i]);
  const integral = s.u.map((u, i) => seconds * seconds * (f.psi * u + diff.psi * s.projected[i]) / s.scale[i]);
  // Compute the mean change directly. Dividing a cumulative integral difference
  // would lose short windows; dividing by ambient exchange would fail at h=0.
  const meanChange = s.u.map((u, i) => seconds * (f.psi * u + diff.psi * s.projected[i]) / s.scale[i]);
  const surfaceMeanC = initial.surfaceC + meanChange[0], subsurfaceMeanC = initial.subsurfaceC + meanChange[1];
  const surfaceC = initial.surfaceC + delta[0], subsurfaceC = initial.subsurfaceC + delta[1];
  const inputJm2 = s.q * seconds;
  const exchangeOutJm2 = s.h * ((initial.surfaceC - interval.reservoirC) * seconds + integral[0]);
  const transferDownJm2 = s.g * ((initial.surfaceC - initial.subsurfaceC) * seconds + integral[0] - integral[1]);
  const surfaceStoredJm2 = s.c1 * (surfaceC - initial.surfaceC), subsurfaceStoredJm2 = s.c2 * (subsurfaceC - initial.subsurfaceC);
  const totalStoredJm2 = surfaceStoredJm2 + subsurfaceStoredJm2;
  if (![surfaceC, subsurfaceC, surfaceMeanC, subsurfaceMeanC, inputJm2, exchangeOutJm2, transferDownJm2, totalStoredJm2].every(Number.isFinite) ||
      surfaceC < -100 || surfaceC > 500 || subsurfaceC < -100 || subsurfaceC > 500) {
    throw Error('Predicted two-layer temperature leaves the supported −100–500 °C range; revise the declaration');
  }
  return { surfaceC, subsurfaceC, inputJm2, exchangeOutJm2, transferDownJm2, surfaceStoredJm2,
    surfaceMeanC, subsurfaceMeanC,
    surfaceDegreeSeconds: initial.surfaceC * seconds + integral[0],
    subsurfaceDegreeSeconds: initial.subsurfaceC * seconds + integral[1],
    subsurfaceStoredJm2, totalStoredJm2, balanceResidualJm2: inputJm2 - exchangeOutJm2 - totalStoredJm2,
    surfaceBalanceResidualJm2: inputJm2 - exchangeOutJm2 - transferDownJm2 - surfaceStoredJm2,
    subsurfaceBalanceResidualJm2: transferDownJm2 - subsurfaceStoredJm2,
    stationarySeconds: stationary(s, seconds) };
}
