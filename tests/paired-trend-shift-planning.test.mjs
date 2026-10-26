import test from 'node:test';
import assert from 'node:assert/strict';
import {inferPairedTrendShiftPlanning as infer} from '../paired-trend-shift-planning.js';
import {inferPairedTrendShift} from '../paired-trend-shift.js';
import {shiftFixture,shiftOracleInputs} from './paired-trend-shift-fixture.mjs';
const value=b=>Number(b.exact.numerator)/Number(b.exact.denominator);
function uncertain(){
 const x=shiftFixture();for(const p of x.inquiry.series.pairs.slice(0,2)){p.treated.lower=-1;p.treated.upper=1;}
 for(const p of x.inquiry.series.pairs.slice(2)){p.treated.lower-=.01;p.treated.upper+=.01;}return x;
}
function append(source,day,lo,hi){
 const p=structuredClone(source.inquiry.series.pairs.at(-1)),time=new Date(Date.parse('2026-01-01T00:00:00Z')+day*86400000).toISOString().replace('.000Z','Z');
 p.time=p.treated.time=p.comparison.time=time;p.treated.lower=lo;p.treated.upper=hi;source.inquiry.series.pairs.push(p);
}
test('original earlier uncertainty imposes an exact positive later-only floor',()=>{
 const x=uncertain(),before=structuredClone(x),r=infer(x),p=r.laterOnlyPlanning;
 assert.deepEqual(x,before);assert.deepEqual(r.earlier,inferPairedTrendShift(x).earlier);
 assert.equal(p.positiveFloor,true);assert(Math.abs(value(p.minimumRemainingWidth)-.98)<1e-14);
 assert.equal(p.work.endpointBandChecks,4);
 assert.equal(p.slopeEndpoints.length,2);
 assert(value(p.widthReductionUpperBound)>=0);
});
test('additional exact later evidence retains the earlier baseline ambiguity',()=>{
 const x=uncertain(),prior=infer(x);append(x,4,5,5);append(x,5,6,6);
 const r=infer(x);assert.equal(value(r.shift.lower),1);assert.equal(value(r.shift.upper),2);
 assert.equal(value(r.laterOnlyPlanning.currentWidth),1);
 assert.equal(value(r.laterOnlyPlanning.minimumRemainingWidth),1);
 assert.equal(value(r.laterOnlyPlanning.widthReductionUpperBound),0);
 assert(value(r.laterOnlyPlanning.currentWidth)>=value(prior.laterOnlyPlanning.minimumRemainingWidth));
 assert.deepEqual(r.earlier.vertices,prior.earlier.vertices);
 append(x,6,100,100);assert.equal(infer(x).laterOnlyPlanning,null);
});
test('zero floor and model rejection are separate results',()=>{
 const r=infer(shiftFixture());assert.equal(value(r.laterOnlyPlanning.minimumRemainingWidth),0);assert.equal(r.laterOnlyPlanning.positiveFloor,false);
 assert.equal(infer(shiftFixture(1)).laterOnlyPlanning,null);
 const x=shiftFixture();x.inquiry.series.pairs[1].treated.lower=10;x.inquiry.series.pairs[1].treated.upper=10;
 append(x,4,100,100);assert.equal(infer(x).laterOnlyPlanning,null);
 assert.throws(()=>infer(uncertain(),{maxConstraintChecks:1}));
});
test('complete existing exact-oracle course family retains original support and bounded planning work',()=>{
 let supported=0,positive=0;
 for(const x of shiftOracleInputs()){
  const r=infer(x),base=inferPairedTrendShift(x),{laterOnlyPlanning:p,...unchanged}=r;assert.deepEqual(unchanged,base);
  if(r.status!=='shift-compatible'){assert.equal(p,null);continue;}
  supported++;if(p.positiveFloor)positive++;
  assert(value(p.minimumRemainingWidth)>=0);assert(value(p.currentWidth)>=value(p.minimumRemainingWidth));
  assert(p.work.endpointBandChecks<=126);
 }
 assert.equal(supported,33);assert.equal(positive,7);
});
