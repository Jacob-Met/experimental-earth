import fs from 'node:fs';
import assert from 'node:assert/strict';
import {advanceDrainingLayer} from '../../draining-infiltration.js';
const root=new URL('./',import.meta.url),r=JSON.parse(fs.readFileSync(new URL('result.json',root))),m=r.results.find(x=>x.model.id==='delayed-linear').model;
const surfaceMm=m.q0*m.lagSeconds/3600,storedMm=m.q0/m.k;
let maximumError=0;
for(const [tau] of [...r.originalCalibration,...r.originalHeld]){
  const state=advanceDrainingLayer({surfaceMm,storedMm,capacityMm:storedMm,infiltrationMmHr:m.q0,drainagePerHour:m.k,rainMmHr:0,hours:tau/3600});
  const predicted=m.q0*Math.exp(-m.k*Math.max(0,tau-m.lagSeconds)/3600);
  maximumError=Math.max(maximumError,Math.abs(state.storedMm*m.k-predicted));
  assert.ok(Math.abs(state.surfaceBalanceErrorMm)<1e-10);assert.ok(Math.abs(state.receiverBalanceErrorMm)<1e-10);
}
assert.ok(maximumError<1e-10);
console.log(JSON.stringify({meaning:'Exact hypothetical non-unique witness, not an observed surface depth or identified material',initialSurfaceMm:surfaceMm,initialStoredMm:storedMm,capacityMm:storedMm,infiltrationMmHr:m.q0,drainagePerHour:m.k,originalTailTimes:38,maximumErrorMmHr:maximumError},null,2));
