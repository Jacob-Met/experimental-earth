import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {inferPairedTrendShift} from '../paired-trend-shift.js';
import {inferPairedTrendRegion} from '../paired-trend-region.js';
import {shiftFixture,shiftOracleInputs} from './paired-trend-shift-fixture.mjs';
const exact=b=>b.exact.numerator+'/'+b.exact.denominator;
test('infer shared response rather than intersecting separate marginal residuals',()=>{
 const x=shiftFixture(),r=inferPairedTrendShift(x);
 assert.deepEqual(r.earlier.post.map(p=>[p.contrast.lower.lower,p.contrast.upper.upper]),[[1,5],[1,7]]);assert.equal(r.status,'shift-compatible');assert.deepEqual([exact(r.shift.lower),exact(r.shift.upper)],['1/1','1/1']);assert.equal(r.earlier.vertices.length,2);
 const bad=inferPairedTrendShift(shiftFixture(1));assert.deepEqual(bad.earlier.post.map(p=>[p.contrast.lower.lower,p.contrast.upper.upper]),[[1,5],[-2,4]]);assert.equal(bad.status,'shift-incompatible');assert.equal(bad.shift,null);
});
test('original source, earlier support, replay and order remain intact',()=>{
 const x=shiftFixture(),before=structuredClone(x),r=inferPairedTrendShift(x);assert.deepEqual(x,before);assert.deepEqual(r.earlier,inferPairedTrendRegion(x.inquiry));assert.deepEqual(inferPairedTrendShift(JSON.parse(JSON.stringify(x))),r);
 x.inquiry.series.pairs.reverse();assert.deepEqual(inferPairedTrendShift(x).shift,r.shift);
 x.inquiry.series.pairs.filter(p=>p.role==='post').forEach(p=>{p.treated.lower+=2;p.treated.upper+=2;});const changed=inferPairedTrendShift(x);assert.equal(changed.shift.lower.lower,3);assert.deepEqual(changed.earlier.vertices,inferPairedTrendRegion(x.inquiry).vertices);
});
test('whole-comparison capacity and model refusals cannot become a supported shift',()=>{
 const x=shiftFixture();assert.throws(()=>inferPairedTrendShift(x,{maxCrossPairs:3}),/Complete/);assert.throws(()=>inferPairedTrendShift(x,{maxPairChecks:1}),/Complete/);
 const earlier=inferPairedTrendRegion(x.inquiry);assert.throws(()=>inferPairedTrendShift(x,{maxConstraintChecks:earlier.work.constraintChecks}),/capacity/);
 for(const mutate of [v=>v.model='causal-effect',v=>v.extra=1,v=>v.inquiry.series.pairs[0].treated.source='']){const v=structuredClone(x);mutate(v);assert.throws(()=>inferPairedTrendShift(v));}
});
test('independent exact 3D vertex oracle agrees on60 irregular-time original courses',()=>{
 const inputs=shiftOracleInputs(),p=process.env.EARTH_SHIFT_ORACLE ? {status:0,stdout:readFileSync(process.env.EARTH_SHIFT_ORACLE,'utf8')}:spawnSync('python3',[new URL('./paired-trend-shift-oracle.py',import.meta.url).pathname],{input:JSON.stringify(inputs),encoding:'utf8'});
 assert.equal(p.status,0,p.stderr);const expected=JSON.parse(p.stdout);assert.equal(expected.length,60);
 inputs.forEach((x,i)=>{const r=inferPairedTrendShift(x),e=expected[i];if(e===null)assert.notEqual(r.status,'shift-compatible');else assert.deepEqual([exact(r.shift.lower),exact(r.shift.upper)],e);});
});
test('one later band keeps its full original uncertainty and64-row source is complete',()=>{
 const one=shiftFixture();one.inquiry.series.pairs.pop();const r=inferPairedTrendShift(one);assert.equal(r.status,'shift-compatible');assert.deepEqual([r.shift.lower.lower,r.shift.upper.upper],[1,5]);
 const x=shiftFixture(),s=x.inquiry.series,template=structuredClone(s.pairs[0]),origin=Date.parse('2026-01-01T00:00:00Z');s.intervention='2026-01-01T00:00:02Z';s.pairs=[];
 for(let i=0;i<64;i++){const elapsed=i<2?i:i+1,time=new Date(origin+elapsed*1000).toISOString().replace('.000Z','Z'),p=structuredClone(template);p.time=p.treated.time=p.comparison.time=time;p.role=i<2?'pre':'post';p.treated.lower=p.treated.upper=elapsed+(i<2?0:3);s.pairs.push(p);}
 const full=inferPairedTrendShift(x);assert.equal(full.status,'shift-compatible');assert.deepEqual([exact(full.shift.lower),exact(full.shift.upper)],['3/1','3/1']);assert.equal(full.work.withinPeriodPairs,1892);assert.equal(full.work.crossPairsEvaluated,124);
});
