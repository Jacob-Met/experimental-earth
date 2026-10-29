import test from 'node:test';
import assert from 'node:assert/strict';
import { advancePressureHead as advance } from '../pressure-head.js';
import { advanceWettingFront as legacy } from '../wetting-front.js';

const near = (actual, expected, tolerance, context) =>
  assert.ok(Math.abs(actual - expected) <= tolerance,
    JSON.stringify({ actual, expected, tolerance, context }));

test('19,200 constant-rain courses preserve water and interval composition; 3,840 zero-head controls are exact', () => {
  let count = 0, controls = 0;
  for (const F of [0, .1, 4, 100]) for (const W of [0, .1, 20])
  for (const R of [0, 5, 10, 60]) for (const K of [0, .5, 10, 100])
  for (const A of [0, 1, 20, 5000]) for (const beta of [0, .01, .3, .8, 1])
  for (const h of [0, 1 / 3600, .1, 1, 12]) {
    const p = { cumulativeMm: F, surfaceWaterMm: W, rainMmHr: R, hours: h,
      conductivityMmHr: K, capillaryDriveMm: A, moistureDeficit: beta };
    const whole = advance(p), first = advance({ ...p, hours: h * .37 });
    const second = advance({ ...p, cumulativeMm: first.cumulativeMm,
      surfaceWaterMm: first.surfaceWaterMm, hours: h * .63 });
    const tolerance = 2e-10 * Math.max(1, F, W + R * h);
    assert.ok(Object.values(whole).every(Number.isFinite));
    assert.ok(whole.infiltratedMm >= 0 && whole.surfaceWaterMm >= 0);
    near(whole.infiltratedMm + whole.surfaceWaterMm, W + R * h, tolerance, p);
    near(whole.cumulativeMm, F + whole.infiltratedMm, tolerance, p);
    near(first.infiltratedMm + second.infiltratedMm, whole.infiltratedMm, tolerance, p);
    if (beta === 0) { assert.deepEqual(whole, legacy(p)); controls++; }
    count++;
  }
  assert.equal(count, 19200);
  assert.equal(controls, 3840);
});

test('unit moisture deficit agrees with the independent square-root solution without reponding', () => {
  let count = 0;
  for (const F of [0, .1, 5, 100]) for (const W of [0, .1, 20, 1000])
  for (const R of [0, .1, 1, 10]) for (const K of [1, 10, 100])
  for (const A of [0, 1, 100]) for (const h of [1 / 3600, .1, 1]) {
    if (R > K) continue;
    const p = { cumulativeMm: F, surfaceWaterMm: W, rainMmHr: R, hours: h,
      conductivityMmHr: K, capillaryDriveMm: A, moistureDeficit: 1 };
    const B = A + F + W;
    const potential = Math.sqrt(F * F + 2 * K * B * h + K * R * h * h) - F;
    const expected = Math.min(W + R * h, potential);
    near(advance(p).infiltratedMm, expected, 1e-10 * Math.max(1, expected, F), p);
    count++;
  }
  assert.equal(count, 1584);
});
function integrateSimpson(fn,a,b,tolerance,depth=24){
 const c=(a+b)/2,fa=fn(a),fb=fn(b),fc=fn(c),whole=(b-a)*(fa+4*fc+fb)/6;
 function step(a,b,fa,fb,fc,whole,tol,left){
  const c=(a+b)/2,l=(a+c)/2,r=(c+b)/2,fl=fn(l),fr=fn(r);
  const one=(c-a)*(fa+4*fl+fc)/6,two=(b-c)*(fc+4*fr+fb)/6,delta=one+two-whole;
  if(Math.abs(delta)<=15*tol)return one+two+delta/15;
  if(left===0)throw Error("Independent quadrature bound exhausted");
  return step(a,c,fa,fc,fl,one,tol/2,left-1)+step(c,b,fc,fb,fr,two,tol/2,left-1);
 }
 return step(a,b,fa,fb,fc,whole,tolerance,depth);
}

test('648 finite-pool courses agree with independent adaptive quadrature', () => {
  let count = 0;
  for (const F of [0, .1, 20]) for (const W of [.01, 1, 100])
  for (const K of [.1, 10]) for (const A of [0, 1, 100])
  for (const beta of [.01, .3, .8, 1]) for (const h of [.001, .1, 1]) {
    const p = { cumulativeMm: F, surfaceWaterMm: W, rainMmHr: 0, hours: h,
      conductivityMmHr: K, capillaryDriveMm: A, moistureDeficit: beta };
    const d = advance(p).infiltratedMm;
    const elapsed = integrateSimpson(x => (F + x) /
      (K * (F + x + A + beta * (W - x))), 0, d, 1e-12);
    if (d < W) near(elapsed, h, 1e-9 * Math.max(1, h), p);
    else assert.ok(elapsed <= h + 1e-9, JSON.stringify(p));
    count++;
  }
  assert.equal(count, 648);
});
function projectedMidpoint(p,steps){
 const F=p.cumulativeMm,W=p.surfaceWaterMm,R=p.rainMmHr,h=p.hours,K=p.conductivityMmHr,A=p.capillaryDriveMm,beta=p.moistureDeficit;
 const alpha=K*(1-beta),c=K*(A+beta*(F+W)),b=K*beta*R,dt=h/steps;
 let y=F*F;
 for(let i=0;i<steps;i++){
  const t=(i+.5)*dt,pred=y+dt*(c+b*t),ad=alpha*dt;
  const z=(ad+Math.sqrt(ad*ad+4*pred))/2;
  const next=y+2*dt*(alpha*z+c+b*t),available=F+W+R*((i+1)*dt);
  y=Math.min(next,available*available);
 }
 const cumulativeMm=Math.sqrt(y);
 return {cumulativeMm,surfaceWaterMm:F+W+R*h-cumulativeMm};
}

test('ten physical courses converge to the independently projected midpoint reference', () => {
  const courses = [
    [0, 0, 60, 10, 20, .3, 1], [0, .1, 60, 10, 20, .3, 1],
    [3.9, .01, 60, 10, 20, .3, .1], [0, 20, 5, 10, 20, .3, 1],
    [100, .01, 60, 10, 20, .3, 1], [0, 20, 60, 10, 0, .8, 1],
    [0, 0, 60, 10, 0, .3, 1], [.1, 2, 0, 10, 20, .8, .1],
    [0, 20, 10, 10, 0, 1, 1], [0, .01, 11, 10, 1, .01, 1],
  ];
  for (const [F, W, R, K, A, beta, h] of courses) {
    const p = { cumulativeMm: F, surfaceWaterMm: W, rainMmHr: R, hours: h,
      conductivityMmHr: K, capillaryDriveMm: A, moistureDeficit: beta };
    const actual = advance(p).cumulativeMm;
    const errors = [8192, 16384, 32768].map(n =>
      Math.abs(projectedMidpoint(p, n).cumulativeMm - actual));
    assert.ok(errors[2] <= 2e-4 && errors[2] <= errors[0] + 1e-8,
      JSON.stringify({ p, actual, errors }));
  }
});

test('6,000 logarithmic boundary courses preserve interval composition', () => {
  let seed = 0x49a6b271;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const value = (low, high) => 10 ** (low + rand() * (high - low));
  const deficits = [0, 1e-16, 1e-12, 1e-6, .01, .3, 1-1e-6, 1-1e-12, 1-1e-16, 1];
  for (let i = 0; i < 6000; i++) {
    const p = { cumulativeMm: i % 7 ? value(-10, 8) : 0,
      surfaceWaterMm: i % 5 ? value(-10, 8) : 0,
      rainMmHr: i % 11 ? value(-8, 3.3) : 0, hours: value(-8, 1.079),
      conductivityMmHr: i % 13 ? value(-8, 3.3) : 0,
      capillaryDriveMm: i % 3 ? value(-8, 3.69) : 0,
      moistureDeficit: deficits[i % 10] };
    const whole = advance(p), first = advance({ ...p, hours: p.hours * .37 });
    const second = advance({ ...p, cumulativeMm: first.cumulativeMm,
      surfaceWaterMm: first.surfaceWaterMm, hours: p.hours * .63 });
    const tolerance = 1e-10 * Math.max(1, whole.infiltratedMm) +
      256 * Number.EPSILON * Math.max(p.cumulativeMm, p.surfaceWaterMm);
    assert.ok(Object.values(whole).every(Number.isFinite), JSON.stringify(p));
    near(first.infiltratedMm + second.infiltratedMm, whole.infiltratedMm, tolerance, p);
  }
});

test('140 very small input controls remain finite', () => {
  let count = 0;
  for (const tiny of [Number.MIN_VALUE, 1e-300, 1e-150, 1e-50, 1e-16, 1, 2000])
  for (const beta of [Number.MIN_VALUE, 1e-300, 1e-16, 1-Number.EPSILON, 1]) {
    const cases = [
      [0, tiny, tiny, 1, tiny, tiny], [tiny, 1, tiny, 1, 1, tiny],
      [0, tiny, 1, 1, tiny, tiny], [0, 1, 1, Math.min(tiny, 12), 1, 1]
    ];
    for (const [F, W, R, h, K, A] of cases) {
      const p = { cumulativeMm: F, surfaceWaterMm: W, rainMmHr: R, hours: h,
        conductivityMmHr: K, capillaryDriveMm: A, moistureDeficit: beta };
      const result = advance(p);
      assert.ok(Object.values(result).every(Number.isFinite), JSON.stringify(p));
      count++;
    }
  }
  assert.equal(count, 140);
});

test('explicit declared inputs, supported event bounds and nonmutation', () => {
  const p = { cumulativeMm: 0, surfaceWaterMm: .1, rainMmHr: 60, hours: 1,
    conductivityMmHr: 10, capillaryDriveMm: 20, moistureDeficit: .3 };
  for (const key of Object.keys(p)) {
    for (const value of [undefined, null, NaN, Infinity, -1, '1'])
      assert.throws(() => advance({ ...p, [key]: value }), /Explicit finite nonnegative/);
  }
  for (const [key, value] of Object.entries({ cumulativeMm: 1e9+1,
    surfaceWaterMm: 1e9+1, rainMmHr: 2001, hours: 12.01,
    conductivityMmHr: 2001, capillaryDriveMm: 5001, moistureDeficit: 1.01 }))
    assert.throws(() => advance({ ...p, [key]: value }), /supported bounds/);
  const before = structuredClone(p);
  advance(p);
  assert.deepEqual(p, before);
});
