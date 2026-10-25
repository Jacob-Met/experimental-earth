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

function thirdPhi(x) {
  if(x<.1)return 1/6+x*(-1/24+x*(1/120+x*(-1/720+x*(1/5040+x*(-1/40320+x/362880)))));
  return (.5-psi(x))/x;
}
function positiveMoments(x) {
  // Direct series for integral u(1-u)exp(-xu) and u(1-u/2)exp(-xu).
  // Computing these positive differences from separate moments loses digits
  // near zero. The series is rapidly convergent throughout this branch.
  if(x<1){let a=0,b=0,power=1;for(let n=0;n<20;n++){const term=power/((n+2)*(n+3));a+=term;b+=term*(n+4)/2;power*=-x/(n+1);}return {a,b};}
  const first=firstMoment(x),second=(2-(x*x+2*x+2)*Math.exp(-x))/(x*x*x);
  return {a:first-second,b:first-second/2};
}

/** Twice-integrated modal convolution, with positive equal/zero-rate limits.
 * Its mean is computed directly so tiny windows need no division by duration. */
export function exponentialSecondIntegral(modeRate,forcingRate,seconds) {
  const a=Math.min(modeRate,forcingRate)*seconds,b=Math.max(modeRate,forcingRate)*seconds,d=b-a;
  let value=1/6;
  if(b>0){const m=positiveMoments(a),u=a/b,v=d/b;value=u*u*m.a+u*v*m.b+Math.exp(-a)*v*v*thirdPhi(d);}
  return {integral:seconds*seconds*seconds*value,mean:seconds*seconds*value};
}

/** Nonnegative loss q0 exp(-kt) + q∞(1-exp(-kt)). The rising response is
 * k times the integrated convolution, avoiding subtraction of almost equal
 * constant/decaying heat responses. q∞ may exceed the flux reached in a short
 * interval; caller admission checks the actual endpoint flux. */
export function exponentialDrivenSurfaceLoss(spectrum,initialWm2,equilibriumWm2,decayPerSecond,seconds) {
  if(equilibriumWm2===0)return exponentialSurfaceLoss(spectrum,initialWm2,decayPerSecond,seconds);
  const s=spectrum;
  const modal=rate=>{
    const first=exponentialConvolution(rate,decayPerSecond,seconds),second=exponentialSecondIntegral(rate,decayPerSecond,seconds);
    return {endpoint:initialWm2*first.endpoint+equilibriumWm2*decayPerSecond*first.integral,
      integral:initialWm2*first.integral+equilibriumWm2*decayPerSecond*second.integral,
      mean:initialWm2*first.mean+equilibriumWm2*decayPerSecond*second.mean};
  };
  const slow=modal(s.slow),fast=modal(s.fast),vector=[-1/s.scale[0],0],projected=s.projection.map(p=>p*vector[0]);
  const response=field=>vector.map((v,i)=>(fast[field]*v+(slow[field]-fast[field])*projected[i])/s.scale[i]);
  const z=decayPerSecond*seconds;
  return {delta:response('endpoint'),integral:response('integral'),mean:response('mean'),
    lossJm2:initialWm2*seconds*phi(z)+equilibriumWm2*seconds*z*psi(z)};
}
