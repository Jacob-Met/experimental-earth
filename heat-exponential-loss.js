// Stable convolution of exp(-decay*t) forcing with a linear decay mode.
// These are dimensionless analytic integrals, not a time-step approximation.
function phi(x) { return x === 0 ? 1 : -Math.expm1(-x) / x; }
function psi(x) {
  if (x < .01) return .5 + x * (-1/6 + x * (1/24 + x * (-1/120 + x * (1/720 + x * (-1/5040 + x/40320)))));
  return (1 - phi(x)) / x;
}
function firstMoment(x) {
  if (x < .01) return .5 + x * (-1/3 + x * (1/8 + x * (-1/30 + x * (1/144 + x * (-1/840 + x/5760)))));
  return (-Math.expm1(-x) - x * Math.exp(-x)) / (x * x);
}

/** Endpoint and time-integral response, including equal/zero-rate limits. */
export function exponentialConvolution(modeRate, forcingRate, seconds) {
  const a = Math.min(modeRate, forcingRate) * seconds;
  const b = Math.max(modeRate, forcingRate) * seconds;
  const gap = b - a;
  const endpoint = seconds * Math.exp(-a) * phi(gap);
  // (phi(a)-phi(b))/(b-a), rewritten to avoid subtracting nearby values.
  const mean = b === 0 ? .5 : (a * firstMoment(a) + Math.exp(-a) * gap * psi(gap)) / b;
  return { endpoint, integral: seconds * seconds * mean, mean: seconds * mean };
}

/** Receive the maintained capacity-scaled symmetric heat spectrum. */
export function exponentialSurfaceLoss(spectrum, watts, decayPerSecond, seconds) {
  const s = spectrum, initial = -watts / s.scale[0];
  const slow = exponentialConvolution(s.slow, decayPerSecond, seconds);
  const fast = exponentialConvolution(s.fast, decayPerSecond, seconds);
  const projected = [s.projection[0] * initial, s.projection[1] * initial];
  const vector = [initial, 0];
  const response = field => vector.map((v, i) =>
    (fast[field] * v + (slow[field] - fast[field]) * projected[i]) / s.scale[i]);
  return {delta: response('endpoint'), integral: response('integral'), mean: response('mean'),
    lossJm2: watts * seconds * phi(decayPerSecond * seconds)};
}
