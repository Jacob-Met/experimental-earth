/**
 * Constant-rain Green–Ampt segments with an explicitly declared surface-head term.
 * F' = K [1 + (A + beta W) / F], W' = R - F' while ponded.
 * A remains suction times initial moisture deficit. beta is the separately
 * declared volumetric moisture deficit. Zero selects the existing head-neglected
 * mathematical control; it must not be inferred from soil moisture or fitted A.
 * Source assumptions, phase transitions and verification: docs/pressure-head.md.
 */
import { advanceWettingFront } from './wetting-front.js';

// Stable integral for a constant affine drive: integral (F+x)/(alpha(F+x)+B) dx.
function gaHeadRemainderRatio(x) {
  if (x >= 0.01) return (x - Math.log1p(x)) / (x * x);
  let sum = 0.5, power = 1;
  for (let n = 3; n <= 14; n++) { power *= -x; sum += power / n; }
  return sum;
}
function gaHeadTimeDepth(F, d, alpha, B) {
  if (d === 0) return 0;
  if (B === 0) return d / alpha;
  if (alpha === 0) return (F + d / 2) * (d / B);
  const denominator = alpha * F + B;
  const ratio = alpha * d / denominator;
  if (ratio >= 0.01) {
    const log = Number.isFinite(ratio) ? Math.log1p(ratio) :
      Math.log(alpha * d + denominator) - Math.log(denominator);
    return d / alpha - (B / alpha / alpha) * log;
  }
  const scale = d / denominator;
  return d * (F / denominator) + B * scale * scale * gaHeadRemainderRatio(ratio);
}

// Comparison bounds use the initial and final total available water.
// The implicit constant-rain trajectory is solved within that bracket.
function constantDriveIncrement(F, alpha, B, demand) {
 if (demand === 0) return 0;
 if (B === 0) return alpha * demand;
 if (alpha === 0) {
  const z=Math.SQRT2*Math.sqrt(B)*Math.sqrt(demand), total=Math.hypot(F,z);
  return F===0?total:z*(z/(total+F));
 }
 const D=alpha*F+B, drift=alpha*demand;
 let lo=0,hi=Math.min(drift+Math.hypot(drift,Math.SQRT2*Math.sqrt(D)*Math.sqrt(demand)),F>0?demand*(alpha+B/F):Infinity),x=hi;
 for(let n=0;n<80;n++){
  const residual=gaHeadTimeDepth(F,x,alpha,B)-demand;
  if(residual>0)hi=x;else lo=x;
  if(Math.abs(residual)<=16*Number.EPSILON*demand)return x;
  const middle=lo+(hi-lo)/2;if(middle===lo||middle===hi)break;
  const derivative=(F+x)/(alpha*(F+x)+B),next=x-residual/derivative;
  x=Number.isFinite(next)&&next>lo&&next<hi?next:middle;
 }
 return lo+(hi-lo)/2;
}
function remainderOverX(x){
 if(x===0)return 0;
 if(Math.abs(x)>=.01)return 1-Math.log1p(x)/x;
 let power=x,sum=x/2;
 for(let n=3;n<=16;n++){power*=-x;sum+=power/n;}
 return sum;
}
function potentialWithHead(F,W,R,h,K,A,beta){
 if(h===0||K===0)return 0;
 const alpha=1-beta,B=A+beta*(F+W),demand=K*h;
 if(R===0)return constantDriveIncrement(F,alpha,B,demand);
 const a=K*alpha,q=Math.sqrt(K)*Math.sqrt(beta)*Math.sqrt(R);
 const lambda=(a+Math.hypot(a,2*q))/2,m=q*(q/lambda);
 if(alpha===0){
  const u=Math.SQRT2*Math.sqrt(K)*Math.sqrt(B)*Math.sqrt(h),v=q*h,total=Math.hypot(F,u,v);
  return F===0?total:u*(u/(total+F))+v*(v/(total+F));
 }
 if(F===0&&B===0)return lambda*h;
 let lo=constantDriveIncrement(F,alpha,B,demand),hi=constantDriveIncrement(F,alpha,B+beta*R*h,demand);
 const tolerance=64*Number.EPSILON*Math.max(1,lo,hi);
 if(hi-lo<=tolerance)return lo+(hi-lo)/2;
 const c=K*B,v=c-m*F,S=c+lambda*F;
 if(v===0)return lambda*h;
 if(F>0&&h*Math.abs(v)/F<=tolerance)return Math.max(lo,Math.min(hi,lambda*h));
 if(!(S>0))throw Error('Unresolved numerical scaling');
 const D=lambda+m,scale=lambda*D*h*((a*F+c)/S);
 function residual(d){
  const x1=m*(lambda*h-d)/v,plus=d+m*h,x2=lambda*plus/S;
  if(x1<=-1)return v>0?-Infinity:Infinity;
  const first=lambda*D*(h*((a*F+c)/S)-(F/S)*d);
  const second=lambda*(lambda*h-d)*remainderOverX(x1);
  const third=(v/S)*lambda*plus*remainderOverX(x2);
  return first-second-third;
 }
 let x=lo+(hi-lo)/2;
 for(let n=0;n<96;n++){
  const y=residual(x);
  if(Number.isNaN(y))throw Error('Nonfinite implicit head residual');
  if(y>0)lo=x;else hi=x;
  if(Number.isFinite(y)&&Math.abs(y)<=32*Number.EPSILON*Math.max(Number.MIN_VALUE,scale))return x;
  const middle=lo+(hi-lo)/2;
  if(hi-lo<=tolerance||middle===lo||middle===hi)return middle;
  const x1=m*(lambda*h-x)/v,plus=x+m*h;
  const derivative=-lambda*D*((F+x)/(S+lambda*plus))/(1+x1);
  const next=x-y/derivative;
  x=Number.isFinite(next)&&next>lo&&next<hi?next:middle;
 }
 throw Error('Implicit head calculation work limit exceeded');
}

// Keep continuously arriving rainfall distinct from a pre-existing pool.
// A pool can empty before the rain subsequently creates ponding again.
export function advancePressureHead({cumulativeMm:F,surfaceWaterMm:W,rainMmHr:R,hours:h,
    conductivityMmHr:K,capillaryDriveMm:A,moistureDeficit:beta}) {
 for(const x of [F,W,R,h,K,A,beta])if(typeof x!=='number'||!Number.isFinite(x)||x<0)throw Error('Explicit finite nonnegative values required');
 if(F>1e9||W>1e9||R>2000||h>12||K>2000||A>5000||beta>1)throw Error('Pressure-head segment exceeds supported bounds');
 if(beta===0)return advanceWettingFront({cumulativeMm:F,surfaceWaterMm:W,rainMmHr:R,hours:h,conductivityMmHr:K,capillaryDriveMm:A});
 const supply=W+R*h;
 let d=0;
 if(h>0&&K>0&&supply>0) {
  if(R<=K)d=W===0?supply:Math.min(supply,potentialWithHead(F,W,R,h,K,A,beta));
  else {
   const threshold=K*A/(R-K);
   if(W===0&&F<threshold) {
    const untilPonding=(threshold-F)/R;
    d=untilPonding>=h?supply:threshold-F+potentialWithHead(threshold,0,R,h-untilPonding,K,A,beta);
   } else if(F>=threshold||F+W>=threshold) {
    d=potentialWithHead(F,W,R,h,K,A,beta);
   } else {
    const reponding=(threshold-F-W)/R;
    const checkAt=Math.min(h,reponding);
    const checkAmount=potentialWithHead(F,W,R,checkAt,K,A,beta);
    if(checkAmount<=W+R*checkAt)d=potentialWithHead(F,W,R,h,K,A,beta);
    else if(h<=reponding)d=supply;
    else d=threshold-F+potentialWithHead(threshold,0,R,h-reponding,K,A,beta);
   }
  }
 }
 if (!Number.isFinite(d)) throw Error('Pressure-head calculation could not resolve a finite increment');
 d=Math.max(0,Math.min(supply,d));
 return {infiltratedMm:d,cumulativeMm:F+d,surfaceWaterMm:supply-d};
}
