import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeLocalDepthChange} from '../proposal-local-timing.js';
import {makeExample,compare} from '../core.js';

test('fractional final sample identifies extrema and a bracket, without inventing a crossing time',()=>{
 const times=Object.freeze([0,5,7.5]),deltas=Object.freeze([0,2,-1]);
 assert.deepEqual(summarizeLocalDepthChange(times,deltas),{
  greatestDeepening:{deltaMm:2,indices:[1]},greatestShallowing:{deltaMm:-1,indices:[2]},
  zeroRuns:[{startIndex:0,endIndex:0}],signReversals:[{fromIndex:1,toIndex:2,fromSign:1,toSign:-1}]
 });
 assert.deepEqual(times,[0,5,7.5]);assert.deepEqual(deltas,[0,2,-1]);
});

test('all tied extrema survive, while a zero plateau brackets only opposite nonzero signs',()=>{
 assert.deepEqual(summarizeLocalDepthChange([0,1,2,3,4,4.5],[0,2,2,0,-3,-3]),{
  greatestDeepening:{deltaMm:2,indices:[1,2]},greatestShallowing:{deltaMm:-3,indices:[4,5]},
  zeroRuns:[{startIndex:0,endIndex:0},{startIndex:3,endIndex:3}],
  signReversals:[{fromIndex:2,toIndex:4,fromSign:1,toSign:-1,zeroStartIndex:3,zeroEndIndex:3}]
 });
 assert.deepEqual(summarizeLocalDepthChange([0,5,10,15],[2,0,-0,-1]),{
  greatestDeepening:{deltaMm:2,indices:[0]},greatestShallowing:{deltaMm:-1,indices:[3]},
  zeroRuns:[{startIndex:1,endIndex:2}],
  signReversals:[{fromIndex:0,toIndex:3,fromSign:1,toSign:-1,zeroStartIndex:1,zeroEndIndex:2}]
 });
 assert.deepEqual(summarizeLocalDepthChange([0,5,10],[1,0,1]),{
  greatestDeepening:{deltaMm:1,indices:[0,2]},greatestShallowing:null,
  zeroRuns:[{startIndex:1,endIndex:1}],signReversals:[]
 });
});

test('neutral and one-sided courses do not manufacture an absent adverse or beneficial direction',()=>{
 assert.deepEqual(summarizeLocalDepthChange([0,5,10],[0,-0,0]),{
  greatestDeepening:null,greatestShallowing:null,zeroRuns:[{startIndex:0,endIndex:2}],signReversals:[]
 });
 assert.deepEqual(summarizeLocalDepthChange([0,5,10],[-2,-1,-2]),{
  greatestDeepening:null,greatestShallowing:{deltaMm:-2,indices:[0,2]},zeroRuns:[],signReversals:[]
 });
 assert.deepEqual(summarizeLocalDepthChange([3.5],[7]),{
  greatestDeepening:{deltaMm:7,indices:[0]},greatestShallowing:null,zeroRuns:[],signReversals:[]
 });
 // Values remain signed even when an unrelated display might round them to zero.
 const exact=summarizeLocalDepthChange([1,2,3],[1e-14,0,-1e-14]);
 assert.equal(exact.greatestDeepening.deltaMm,1e-14);assert.equal(exact.greatestShallowing.deltaMm,-1e-14);
 assert.deepEqual(exact.signReversals,[{fromIndex:0,toIndex:2,fromSign:1,toSign:-1,zeroStartIndex:1,zeroEndIndex:1}]);
});

test('reversing the difference exchanges extrema and reversal directions while retaining sample locations',()=>{
 const times=Object.freeze([2,3,4,5,6,7,8,9,9.5]),deltas=Object.freeze([0,3,3,0,-2,-2,1,0,-1]);
 const before=JSON.stringify({times,deltas}),a=summarizeLocalDepthChange(times,deltas),b=summarizeLocalDepthChange(times,Object.freeze(deltas.map(x=>-x)));
 assert.deepEqual(b.greatestDeepening,{deltaMm:-a.greatestShallowing.deltaMm,indices:a.greatestShallowing.indices});
 assert.deepEqual(b.greatestShallowing,{deltaMm:-a.greatestDeepening.deltaMm,indices:a.greatestDeepening.indices});
 assert.deepEqual(b.zeroRuns,a.zeroRuns);
 assert.deepEqual(b.signReversals,a.signReversals.map(r=>({...r,fromSign:-r.fromSign,toSign:-r.toSign})));
 assert.deepEqual(a.signReversals,[
  {fromIndex:2,toIndex:4,fromSign:1,toSign:-1,zeroStartIndex:3,zeroEndIndex:3},
  {fromIndex:5,toIndex:6,fromSign:-1,toSign:1},
  {fromIndex:6,toIndex:8,fromSign:1,toSign:-1,zeroStartIndex:7,zeroEndIndex:7}
 ]);
 assert.equal(JSON.stringify({times,deltas}),before);
});

test('refuses incomplete, nonnumeric or unordered samples rather than presenting partial timing evidence',()=>{
 const sparseTimes=[0,,2],sparseDeltas=[1,,2];
 for(const [times,deltas] of [
  [[],[]],[[0,1],[1]],[[0],[1,2]],[[0,0],[1,2]],[[2,1],[1,2]],
  [[-1,0],[1,2]],[[0,Infinity],[1,2]],[[0,1],[1,NaN]],[[0,1],[1,Infinity]],
  [['0',1],[1,2]],[[0,1],[1,'2']],[sparseTimes,[1,2,3]],[[0,1,2],sparseDeltas],
  [null,[1]],[[0],null]
 ])assert.throws(()=>summarizeLocalDepthChange(times,deltas));
});

test('authored lowered-garden control retains early local deepening and later shallowing in the maintained model',()=>{
 const project=makeExample();
 const gardens=project.proposal.filter(cell=>cell.surface==='garden');assert.equal(gardens.length,6);
 for(const cell of gardens)cell.elevationM-=0.025;
 const original=JSON.stringify(project),runs=compare(project),cellIndex=19;
 const times=runs.existing.snapshots.map(s=>s.minute);
 assert.deepEqual(runs.proposal.snapshots.map(s=>s.minute),times);
 const deltas=runs.proposal.snapshots.map((s,i)=>s.depthsMm[cellIndex]-runs.existing.snapshots[i].depthsMm[cellIndex]);
 const summary=summarizeLocalDepthChange(Object.freeze(times),Object.freeze(deltas));
 // Independent direct reduction of the original solver arrays; no report or UI helpers.
 const largest=Math.max(...deltas),smallest=Math.min(...deltas);
 const indicesFor=value=>deltas.flatMap((delta,index)=>delta===value?[index]:[]);
 assert.ok(Math.abs(largest-0.5140637056327169)<1e-9);
 assert.ok(Math.abs(smallest-(-23.263792805563806))<1e-9);
 assert.deepEqual(summary.greatestDeepening,{deltaMm:largest,indices:indicesFor(largest)});
 assert.deepEqual(summary.greatestShallowing,{deltaMm:smallest,indices:indicesFor(smallest)});
 assert.deepEqual(summary.greatestDeepening.indices.map(i=>times[i]),[15]);
 assert.deepEqual(summary.greatestShallowing.indices.map(i=>times[i]),[225]);
 assert.ok(summary.signReversals.some(r=>r.fromSign===1&&r.toSign===-1),'Authored local effect changes direction across retained samples');
 for(const r of summary.signReversals){
  assert.equal(Math.sign(deltas[r.fromIndex]),r.fromSign);assert.equal(Math.sign(deltas[r.toIndex]),r.toSign);
  assert.ok(deltas.slice(r.fromIndex+1,r.toIndex).every(value=>value===0));
 }
 assert.equal(JSON.stringify(project),original,'Timing inspection does not adopt or edit the authored model');
});
