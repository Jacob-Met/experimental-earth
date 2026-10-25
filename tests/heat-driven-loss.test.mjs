import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceHeatColumn,advanceHeatColumnWithLoss,advanceHeatColumnWithDrivenLoss} from '../heat-column-step.js';
import {exponentialSecondIntegral} from '../heat-exponential-loss.js';
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}: ${a-b}`);
const top={capacityJm2K:50000,exchangeWm2K:15,absorptivity:.7},lower={capacityJm2K:150000,conductanceWm2K:8};
const forcing={incidentWm2:650,reservoirC:28},initial={surfaceC:28,subsurfaceC:26};
test('rising latent loss matches independent augmented seven-state matrix control',()=>{
  const result=advanceHeatColumnWithDrivenLoss(top,lower,forcing,initial,14400,{initialWm2:0,equilibriumWm2:306.25,decayPerSecond:6/86400});
  near(result.surfaceC,42.129284417107804,1e-11);near(result.subsurfaceC,34.56886671046495,1e-11);
  near(result.surfaceMeanC,41.60119183800371,1e-11);near(result.surfaceLossJm2,1622348.33556606,1e-7);near(result.balanceResidualJm2,0,1e-6);
});
test('old declining, constant and zero-loss APIs retain exact behavior',()=>{
  const args=[top,lower,forcing,initial,4000];
  for(const flux of [0,20,300])for(const rate of [0,1e-8,.001])assert.deepEqual(advanceHeatColumnWithDrivenLoss(...args,{initialWm2:flux,equilibriumWm2:0,decayPerSecond:rate}),advanceHeatColumnWithLoss(...args,{initialWm2:flux,decayPerSecond:rate}));
  assert.deepEqual(advanceHeatColumnWithDrivenLoss(...args,{initialWm2:300,equilibriumWm2:300,decayPerSecond:.02}),advanceHeatColumnWithLoss(...args,{initialWm2:300,decayPerSecond:0}));
});
test('rising/falling flux partition preserves thermal state and independent energy/means',()=>{
  for(const h of [0,15])for(const g of [0,8])for(const rate of [0,1e-12,6/86400,.01])for(const [a,b]of [[0,300],[300,30]]){
    const surface={...top,exchangeWm2K:h},bottom={...lower,conductanceWm2K:g},q={initialWm2:a,equilibriumWm2:b,decayPerSecond:rate};
    const full=advanceHeatColumnWithDrivenLoss(surface,bottom,forcing,initial,1200,q),left=advanceHeatColumnWithDrivenLoss(surface,bottom,forcing,initial,400,q);
    const right=advanceHeatColumnWithDrivenLoss(surface,bottom,forcing,left,800,{...q,initialWm2:a*Math.exp(-rate*400)+b*(-Math.expm1(-rate*400))});
    near(right.surfaceC,full.surfaceC);near(right.subsurfaceC,full.subsurfaceC);near((left.surfaceMeanC+2*right.surfaceMeanC)/3,full.surfaceMeanC);
    for(const key of ['surfaceLossJm2','exchangeOutJm2','transferDownJm2'])near(left[key]+right[key],full[key],1e-6);
    near(full.balanceResidualJm2,0,1e-6);
  }
});
test('stable zero/equal-rate integral and tiny rising-loss limits remain positive',()=>{
  near(exponentialSecondIntegral(0,0,3).integral,4.5,1e-15);
  for(const rate of [0,1e-12,.001,1000]){
    const v=exponentialSecondIntegral(rate,rate,1);assert.ok(v.integral>=0&&Number.isFinite(v.integral));
    if(rate<1e-10)near(v.integral,1/6,1e-12);
  }
  const flat={...top,exchangeWm2K:0,absorptivity:0},bottom={...lower,conductanceWm2K:0};
  for(const seconds of [1e-8,.1,100]){
    const q={initialWm2:0,equilibriumWm2:1e6,decayPerSecond:1e-10},r=advanceHeatColumnWithDrivenLoss(flat,bottom,forcing,initial,seconds,q);
    assert.ok(r.surfaceLossJm2>0);near(r.surfaceC,initial.surfaceC-r.surfaceLossJm2/top.capacityJm2K,1e-12);near(r.balanceResidualJm2,0,1e-9);
  }
});
test('actual reached loss is bounded without refusing an unreached high equilibrium',()=>{
  assert.doesNotThrow(()=>advanceHeatColumnWithDrivenLoss(top,lower,forcing,initial,1e-3,{initialWm2:0,equilibriumWm2:1e6,decayPerSecond:.001}));
  assert.throws(()=>advanceHeatColumnWithDrivenLoss(top,lower,forcing,initial,1000,{initialWm2:0,equilibriumWm2:1e6,decayPerSecond:.001}),/5000/);
  const base=advanceHeatColumn(top,lower,forcing,initial,100);assert.ok(base.surfaceC>initial.surfaceC);
});
