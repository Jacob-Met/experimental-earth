import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRootZoneForced,advanceRootZoneForcedWithSupply} from '../root-zone-forced.js';
const near=(a,b,scale=1)=>assert.ok(Math.abs(a-b)<=2e-10*Math.max(scale,Math.abs(a),Math.abs(b)),a+' != '+b);
function integrate(s){const x=s.decayPerDay*s.days;let phi,psi;if(x<1e-3){phi=1-x/2+x*x/6-x*x*x/24+x**4/120;psi=.5-x/6+x*x/24-x*x*x/120+x**4/720;}else{phi=-Math.expm1(-x)/x;psi=(1-phi)/x;}return s.days*(s.initialMmPerDay*phi+s.equilibriumMmPerDay*x*psi);}
test('recorded supply integrates to unchanged native water over all constitutive branches',()=>{
 let cases=0;
 for(const C of [.001,5,200])for(const p of [0,.4,1])for(const S of [0,(1-p)*C,C])
 for(const r of [0,1,18,60,48000])for(const E of [0,1,18,30])for(const days of [0,1/1440,1/6,1,10]){
  const params={availableMm:S,capacityMm:C,depletionFraction:p,rechargeMmPerDay:r,demandMmPerDay:E,days};
  const original=advanceRootZoneForced(params),{supplySegments,...water}=advanceRootZoneForcedWithSupply(params);
  assert.deepEqual(water,original);
  near(supplySegments.reduce((a,s)=>a+s.days,0),days);
  near(supplySegments.reduce((a,s)=>a+integrate(s),0),water.suppliedMm);
  for(const s of supplySegments){const end=s.initialMmPerDay*Math.exp(-s.decayPerDay*s.days)+s.equilibriumMmPerDay*-Math.expm1(-s.decayPerDay*s.days);assert.ok(s.initialMmPerDay>=0&&end>=0&&s.initialMmPerDay<=E+1e-8&&end<=E+1e-8);}
  cases++;
 }
 assert.equal(cases,2700);
});
test('rising and falling stressed water record native exponential rate and recharge equilibrium',()=>{
 const a=advanceRootZoneForcedWithSupply({availableMm:0,capacityMm:5,depletionFraction:.4,rechargeMmPerDay:18,demandMmPerDay:18,days:1/6});
 assert.deepEqual(a.supplySegments,[{days:1/6,initialMmPerDay:0,equilibriumMmPerDay:18,decayPerDay:6}]);
 near(a.availableMm,3*(1-Math.exp(-1)));near(a.suppliedMm,3*Math.exp(-1));
 const b=advanceRootZoneForcedWithSupply({availableMm:2,capacityMm:5,depletionFraction:.4,rechargeMmPerDay:3,demandMmPerDay:18,days:.1});
 assert.equal(b.supplySegments[0].initialMmPerDay,12);assert.equal(b.supplySegments[0].equilibriumMmPerDay,3);
});
test('zero threshold consumes arriving water after emptying without fabricating a negative store',()=>{
 const r=advanceRootZoneForcedWithSupply({availableMm:1,capacityMm:5,depletionFraction:1,rechargeMmPerDay:6,demandMmPerDay:18,days:.25});
 assert.deepEqual(r.supplySegments,[{days:1/12,initialMmPerDay:18,equilibriumMmPerDay:0,decayPerDay:0},{days:.25-1/12,initialMmPerDay:6,equilibriumMmPerDay:0,decayPerDay:0}]);
 near(r.availableMm,0);near(r.suppliedMm,2.5);
});
