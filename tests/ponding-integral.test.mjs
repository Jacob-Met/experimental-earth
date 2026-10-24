import test from 'node:test';import assert from 'node:assert/strict';import {pondingExposure} from '../ponding-exposure.js';
const run=(points,threshold=10)=>pondingExposure({snapshots:points.map(([minute,...depthsMm])=>({minute,depthsMm}))},threshold);
test('triangle exact positive excess and unchanged interval',()=>{const r=run([[0,0],[10,20],[20,0]])[0];assert.equal(r.excessMmMinutes,50);assert.equal(r.minutesAbove,10);assert.deepEqual(r.intervals,[{startMinute:5,endMinute:15}]);assert.equal(r.aboveAtStart,false);assert.equal(r.aboveAtEnd,false);});
test('both endpoint censor flags and positive plateau exposure',()=>{const r=run([[3,20],[13,20]])[0];assert.equal(r.excessMmMinutes,100);assert.equal(r.aboveAtStart,true);assert.equal(r.aboveAtEnd,true);});
test('threshold equality contributes zero; disjoint positive intervals integrate separately',()=>{const r=run([[0,10,0],[10,10,20],[20,10,0],[30,10,20],[40,10,0]]);assert.equal(r[0].excessMmMinutes,0);assert.equal(r[0].aboveAtStart,false);assert.equal(r[1].excessMmMinutes,100);assert.equal(r[1].intervals.length,2);});
test('fractional endpoint integrates only observed horizon without inventing clearance',()=>{
 const r=run([[0,0],[3,3],[6,6],[9,9],[10.3,10.3]],5)[0];
 assert.ok(Math.abs(r.excessMmMinutes-14.045)<1e-12);
 assert.ok(Math.abs(r.minutesAbove-5.3)<1e-12);
 assert.equal(r.aboveAtStart,false);assert.equal(r.aboveAtEnd,true);
 assert.equal(r.intervals.at(-1).endMinute,10.3);
});
