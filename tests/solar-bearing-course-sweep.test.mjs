import test from 'node:test';import assert from 'node:assert/strict';
import {sweepBearingCourse} from '../solar-bearing-course-sweep.js';
const side=(inner=[],outer=inner,eligible=true)=>({eligible,inner,outer});
const row=(existing=side(),proposal=side())=>({existing,proposal});
const contains=(ranges,numerator,denominator=1)=>ranges.some(([a,b])=>a*denominator<=numerator&&numerator<=b*denominator);
test('closed endpoint extrema and reference-counted touching/overlapping lists stay exact',()=>{
 const rows=[row(side(),side([[0,1]])),row(side(),side([[1,2]]))],r=sweepBearingCourse([0,2],rows);
 assert.deepEqual(r.extrema.proposal,[1,2]);assert.equal(r.atoms.length,5);assert.deepEqual(r.atoms[2].counts.proposal,[2,2]);assert.equal(r.eventCount,8);
 const overlap=sweepBearingCourse([0,2],[row(side(),side([[0,1],[1,2],[.5,1.5]]))]);assert.deepEqual(overlap.extrema.proposal,[1,1]);assert.equal(overlap.eventCount,12);
});
test('a real open atom survives adjacent binary64 endpoints with no representable midpoint',()=>{
 const a=1,b=1+Number.EPSILON,r=sweepBearingCourse([a,b],[row(side(),side([[a,a],[b,b]]))]);
 assert.equal(a+(b-a)/2,a);assert.equal(r.atoms.length,3);assert.deepEqual(r.atoms[1],{from:a,to:b,includeFrom:false,includeTo:false,counts:{existing:[0,0],proposal:[0,0],additional:[0,0],removed:[0,0]}});assert.deepEqual(r.extrema.proposal,[0,1]);
});
test('all admissible paired Boolean states match exhaustive possible actual outcomes',()=>{
 let cases=0;for(const ei of [0,1])for(const eo of [0,1])for(const pi of [0,1])for(const po of [0,1]){
  if(ei>eo||pi>po)continue;const list=v=>v?[[0,1]]:[],r=sweepBearingCourse([0,1],[row(side(list(ei),list(eo)),side(list(pi),list(po)))]),additional=[],removed=[];
  for(let e=ei;e<=eo;e++)for(let p=pi;p<=po;p++){additional.push(Number(p&&!e));removed.push(Number(e&&!p));}
  assert.deepEqual(r.extrema.additional,[Math.min(...additional),Math.max(...additional)]);assert.deepEqual(r.extrema.removed,[Math.min(...removed),Math.max(...removed)]);cases++;
 }
 assert.equal(cases,9);
 const ineligible=sweepBearingCourse([0,1],[row(side([],[],false),side([[0,1]]))]);assert.deepEqual(ineligible.extrema.additional,[0,0]);assert.deepEqual(ineligible.extrema.proposal,[1,1]);
});
test('integer rational oracle independently evaluates every endpoint and open atom',()=>{
 const rows=[row(side([[0,1],[3,4]],[[0,2],[3,4]]),side([[1,3]],[[0,4]])),row(side([[1,1]],[[1,2]]),side([[3,4]],[[2,4]])),row(side([],[],false),side([[0,2]]))],before=JSON.stringify(rows),r=sweepBearingCourse([0,4],rows);
 for(const atom of r.atoms){const d=atom.includeFrom?1:2,n=atom.includeFrom?atom.from:atom.from+atom.to,expected={existing:[0,0],proposal:[0,0],additional:[0,0],removed:[0,0]};
  for(const t of rows){const ei=contains(t.existing.inner,n,d),eo=contains(t.existing.outer,n,d),pi=contains(t.proposal.inner,n,d),po=contains(t.proposal.outer,n,d);if(t.existing.eligible){expected.existing[0]+=+ei;expected.existing[1]+=+eo;}if(t.proposal.eligible){expected.proposal[0]+=+pi;expected.proposal[1]+=+po;}if(t.existing.eligible&&t.proposal.eligible){expected.additional[0]+=+(pi&&!eo);expected.additional[1]+=+(po&&!ei);expected.removed[0]+=+(ei&&!po);expected.removed[1]+=+(eo&&!pi);}}
  assert.deepEqual(atom.counts,expected);
 }
 assert.equal(JSON.stringify(rows),before);
});
test('zero-width/full-circle and numerical-unknown normalized envelopes retain all timestamps',()=>{
 const zero=sweepBearingCourse([7,7],[row(side(),side([[7,7]]))]);assert.equal(zero.atoms.length,1);assert.deepEqual(zero.extrema.proposal,[1,1]);
 const full=sweepBearingCourse([0,360],[row(side([[0,10],[350,360]]),side([[0,10],[350,360]])),row(side([],[[0,360]]),side([],[[0,360]]))]);assert.deepEqual(full.atoms[0].counts,full.atoms.at(-1).counts);assert.deepEqual(full.extrema.existing,[0,2]);assert.deepEqual(full.extrema.additional,[0,1]);assert.equal(full.sampleCount,2);
 const empty=sweepBearingCourse([0,1],[row()],{maxEvents:0});assert.equal(empty.eventCount,0);assert.equal(empty.atoms.length,3);
});
test('complete work/shape/inner-subset admission refuses instead of truncating',()=>{
 assert.throws(()=>sweepBearingCourse([0,1],[row(side([[0,1]]))],{maxEvents:3}),/budget/);
 assert.throws(()=>sweepBearingCourse([0,1],[row(side([[0,1]],[]))]),/Inner membership/);
 assert.throws(()=>sweepBearingCourse([0,2],[row(side([[0,2]],[[0,1],[1.1,2]]))]),/Inner membership/);
 assert.throws(()=>sweepBearingCourse([0,1],[row(side([[0,1]],[],false))]),/ineligible/);
 for(const d of [[1,0],[0,361],[NaN,1]])assert.throws(()=>sweepBearingCourse(d,[row()]));
 for(const rows of [[],Array.from({length:194},()=>row())])assert.throws(()=>sweepBearingCourse([0,1],rows),/193/);
 assert.throws(()=>sweepBearingCourse([0,1],[row(side([[0,2]]))]),/inside/);assert.throws(()=>sweepBearingCourse([0,1],[row()],{maxEvents:250001}),/budget/);
});
