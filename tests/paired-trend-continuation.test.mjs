import test from 'node:test';
import assert from 'node:assert/strict';
import {challengePairedTrendContinuation} from '../paired-trend-continuation.js';
import {inferPairedTrendRegion} from '../paired-trend-region.js';
import {continuationFixture} from './paired-trend-continuation-fixture.mjs';
test('separate later zero-overlaps do not establish a shared unchanged history',()=>{
 const x=continuationFixture(),before=structuredClone(x),r=challengePairedTrendContinuation(x);
 assert.ok(r.earlier.post.every(p=>p.direction==='includes-zero'));assert.equal(r.status,'jointly-incompatible');assert.deepEqual(r.testedPostIndices,[2,3]);assert.equal(r.contradictionAt,3);assert.deepEqual(x,before);assert.deepEqual(r.earlier,inferPairedTrendRegion(x));assert.deepEqual(challengePairedTrendContinuation(JSON.parse(JSON.stringify(x))),r);
});
test('compatible challenge is separate from earlier support and source-order-independent',()=>{
 const x=continuationFixture(true),r=challengePairedTrendContinuation(x);
 assert.equal(r.status,'jointly-compatible');assert.equal(r.jointVertices.length,1);assert.equal(r.earlier.vertices.length,2);assert.equal(r.contradictionAt,null);
 x.series.pairs.reverse();const reversed=challengePairedTrendContinuation(x);assert.deepEqual(reversed.jointVertices,r.jointVertices);assert.equal(reversed.status,r.status);
});
test('independent whole-course integer pair oracle matches150 unfamiliar challenges',()=>{
 let seed=41;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};let rejected=0,retained=0;
 for(let course=0;course<150;course++){
  const x=continuationFixture();const bands=x.series.pairs.map(p=>{const lo=(rand()%11)-5,hi=lo+rand()%7;p.treated.lower=lo;p.treated.upper=hi;return [lo,hi];});
  let low=null,high=null;const compare=(a,b)=>Math.sign(a[0]*b[1]-b[0]*a[1]);
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const a=[bands[j][0]-bands[i][1],j-i],b=[bands[j][1]-bands[i][0],j-i];if(!low||compare(a,low)>0)low=a;if(!high||compare(b,high)<0)high=b;}
  const possible=compare(low,high)<=0,r=challengePairedTrendContinuation(x);assert.equal(r.status==='jointly-compatible',possible);possible?retained++:rejected++;
 }
 assert.deepEqual({retained,rejected},{retained:31,rejected:119});
});
test('combined work ceiling refuses instead of returning partly challenged success',()=>{
 const x=continuationFixture(true),earlier=inferPairedTrendRegion(x);
 assert.throws(()=>challengePairedTrendContinuation(x,{maxConstraintChecks:earlier.work.constraintChecks}),/capacity/);
 assert.equal(challengePairedTrendContinuation(x).testedPostIndices.length,2);
 const bad=continuationFixture();bad.series.pairs[2].role='pre';bad.series.intervention='2026-01-03T12:00:00Z';bad.series.pairs[2].treated.lower=bad.series.pairs[2].treated.upper=10;
 const r=challengePairedTrendContinuation(bad);assert.equal(r.status,'earlier-incompatible');assert.deepEqual(r.testedPostIndices,[]);assert.deepEqual(r.jointVertices,[]);
});
