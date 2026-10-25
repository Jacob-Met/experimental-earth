import test from 'node:test';
import assert from 'node:assert/strict';
import {drySourceCounterexample} from '../evaluation/dry-source-counterexample.js';
test('exact local pair compositions conserve supply but approach order-dependent allocation',()=>{
 for(const dt of [.01,.0001,.000001]){
  const r=drySourceCounterexample(dt);
  for(const course of [r.forward,r.reverse]){
   assert.ok(course.received.every(x=>x>=0));
   assert.ok(Math.abs(course.received[0]+course.received[1]+course.remaining-dt)<1e-14);
  }
  assert.ok(Math.abs(r.simultaneous.received.reduce((a,b)=>a+b,0)-dt)<1e-14);
 }
 const r=drySourceCounterexample(1e-6);
 assert.ok(Math.abs(r.simultaneous.fractions[0]-2/3)<1e-6);
 assert.ok(Math.abs(r.forward.fractions[0]-1)<1e-10);
 assert.ok(Math.abs(r.reverse.fractions[0]-.5)<1e-6);
});
test('nonpositive, nonfinite and unsupported time intervals refuse',()=>{
 for(const x of [0,-1,NaN,Infinity,.1,'0.01'])assert.throws(()=>drySourceCounterexample(x));
});
