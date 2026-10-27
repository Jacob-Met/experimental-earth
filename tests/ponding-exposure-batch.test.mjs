import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotDepths, snapshotDepthsAtMinutes} from '../ponding-exposure.js';
import {inspectTimedRoute} from '../route-traversal.js';

// Independent analytic expectations; scalar equivalence is additional coverage.
const fixture=()=>({snapshots:[
  {minute:3,depthsMm:[0,8,2]},
  {minute:7,depthsMm:[8,0,2]},
  {minute:13,depthsMm:[2,6,5]}
]});

test('analytic endpoints and interior values preserve caller order and repeated times',()=>{
  const source=fixture(),before=structuredClone(source);
  const minutes=[10,3,5,13,7,5];
  const expected=[[5,3,3.5],[0,8,2],[4,4,2],[2,6,5],[8,0,2],[4,4,2]];
  const actual=snapshotDepthsAtMinutes(source,minutes);
  assert.deepEqual(actual,expected);
  assert.deepEqual(actual,minutes.map(t=>snapshotDepths(source,t)));
  assert.deepEqual(source,before);
  assert.deepEqual(minutes,[10,3,5,13,7,5]);
});

test('every returned depth array is independent of snapshots, duplicate queries and later calls',()=>{
  const source=fixture(),before=structuredClone(source);
  const actual=snapshotDepthsAtMinutes(source,[3,5,3,5]);
  for(let i=0;i<actual.length;i++) {
    for(let j=i+1;j<actual.length;j++) assert.notStrictEqual(actual[i],actual[j]);
    for(const snapshot of source.snapshots) assert.notStrictEqual(actual[i],snapshot.depthsMm);
  }
  actual[0][0]=999;actual[1][1]=999;
  assert.deepEqual(actual[2],[0,8,2]);assert.deepEqual(actual[3],[4,4,2]);
  assert.deepEqual(source,before);
  assert.deepEqual(snapshotDepthsAtMinutes(source,[3,5]),[[0,8,2],[4,4,2]]);
});

test('each requested minute must satisfy scalar bounds and finiteness',()=>{
  for(const bad of [2.99,13.01,NaN,Infinity,-Infinity,'5',null,undefined]) {
    const source=fixture(),before=structuredClone(source);
    assert.throws(()=>snapshotDepths(source,bad));
    assert.throws(()=>snapshotDepthsAtMinutes(source,[3,bad,7]));
    assert.deepEqual(source,before);
  }
});

test('batch query is a nonempty dense Array of at most 128 minutes',()=>{
  for(const invalid of [[],null,undefined,5,'5',{},new Float64Array([5]),
    Array(1),[3,,7],Array(129).fill(5)]) {
    assert.throws(()=>snapshotDepthsAtMinutes(fixture(),invalid));
  }
  const minutes=Array.from({length:128},(_,i)=>i%2?13:3);
  const result=snapshotDepthsAtMinutes(fixture(),minutes);
  assert.equal(result.length,128);
  result.forEach((depths,i)=>assert.deepEqual(depths,i%2?[2,6,5]:[0,8,2]));
  assert.equal(new Set(result).size,128,'maximum batch returns independent arrays');
});

test('batch validates entire retained result including cells and times never sampled',()=>{
  const corruptions=[
    r=>{r.snapshots[2].depthsMm[2]=-1;},
    r=>{r.snapshots[2].depthsMm[2]=NaN;},
    r=>{r.snapshots[2].depthsMm[2]=Infinity;},
    r=>{r.snapshots[2].depthsMm.pop();},
    r=>{r.snapshots[2].minute=7;},
    r=>{r.snapshots[2].minute=6;},
    r=>{r.snapshots[2].minute=NaN;},
    r=>{r.snapshots[0].minute=-1;},
    r=>{r.snapshots.length=1;}
  ];
  for(const corrupt of corruptions) {
    const source=fixture();corrupt(source);
    assert.throws(()=>snapshotDepths(source,3));
    assert.throws(()=>snapshotDepthsAtMinutes(source,[3]),'earliest endpoint must not bypass full validation');
  }
});

test('full source validation precedes batch query validation',()=>{
  const source=fixture();source.snapshots[2].depthsMm[2]=-1;
  let scalarError;
  try { snapshotDepths(source,3); } catch(error) { scalarError=error; }
  assert.ok(scalarError);
  for(const minutes of [[],null,[99]]) {
    assert.throws(()=>snapshotDepthsAtMinutes(source,minutes),
      error=>error.constructor===scalarError.constructor && error.message===scalarError.message);
  }
});

test('valid and invalid mutations on same object are observed on every invocation',()=>{
  const source=fixture();
  assert.deepEqual(snapshotDepthsAtMinutes(source,[5]),[[4,4,2]]);
  source.snapshots[1].depthsMm[0]=12;
  assert.deepEqual(snapshotDepthsAtMinutes(source,[5]),[[6,4,2]]);
  source.snapshots[2].depthsMm[2]=-1;
  assert.throws(()=>snapshotDepthsAtMinutes(source,[5]));
  source.snapshots[2].depthsMm[2]=5;
  assert.deepEqual(snapshotDepthsAtMinutes(source,[5]),[[6,4,2]]);
  source.snapshots[1].minute=11;
  assert.deepEqual(snapshotDepthsAtMinutes(source,[5]),[[3,6,2]]);
  source.snapshots[1].minute=13;
  assert.throws(()=>snapshotDepthsAtMinutes(source,[5]));
});

test('timed route consumer retains cumulative arrival identities and first-failure order',()=>{
  const source={snapshots:[0,10,20,30].map((minute,j)=>({minute,
    depthsMm:[[0,0,0,0],[0,2,0,0],[0,0,2,0]].map(values=>values[j])}))};
  const cases=[
    {departure:20.5,times:[20.5,22.5,25.5],depths:[0,0,0.9],failure:null},
    {departure:18,times:[18,20,23],depths:[0,0,1.4],failure:2},
    {departure:12,times:[12,14,17],depths:[0,1.2,1.4],failure:1},
    {departure:4,times:[4,6,9],depths:[0,1.2,0],failure:1}
  ];
  const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} differs from ${b}`);
  for(const item of cases) {
    const actual=inspectTimedRoute(source,[0,1,2],[2,3],item.departure,1);
    assert.equal(actual.departureMinute,item.departure);assert.equal(actual.arrivals.length,3);
    actual.arrivals.forEach((arrival,k)=>{
      assert.equal(arrival.cellIndex,k);assert.equal(arrival.routePosition,k);
      assert.equal(arrival.minute,item.times[k]);near(arrival.depthMm,item.depths[k]);
    });
    assert.equal(actual.allAtOrBelow,item.failure===null);
    if(item.failure===null) assert.equal(actual.firstFailure,null);
    else {
      const k=item.failure;
      assert.equal(actual.firstFailure.cellIndex,k);assert.equal(actual.firstFailure.routePosition,k);
      assert.equal(actual.firstFailure.minute,item.times[k]);near(actual.firstFailure.depthMm,item.depths[k]);
    }
  }
  source.snapshots[3].depthsMm[0]=-1;
  assert.throws(()=>inspectTimedRoute(source,[0,1,2],[2,3],4,1),'consumer must retain full-result validation');
});

test('mixed-invalid timed route remains refused without requiring scalar error priority',()=>{
  // Cell 9 is invalid at the first arrival; the final arrival is also outside
  // the horizon. Eager batch validation may now report the horizon first.
  // This intentional error-priority difference must never admit the query.
  assert.throws(()=>inspectTimedRoute(fixture(),[9,0],[2],12,1));
});

// Full source validation remains the existing scalar validator. This suite
// does not introduce new requirements for preexisting sparse-depth behavior.

test('scalar keeps source-first error order and independent endpoint results',()=>{
  const source=fixture();
  const first=snapshotDepths(source,3),second=snapshotDepths(source,3);
  assert.deepEqual(first,[0,8,2]);assert.notStrictEqual(first,second);
  assert.notStrictEqual(first,source.snapshots[0].depthsMm);
  first[0]=999;
  assert.deepEqual(second,[0,8,2]);
  assert.deepEqual(source.snapshots[0].depthsMm,[0,8,2]);
  assert.throws(()=>snapshotDepths(source,99),/Replay time is outside the modeled event\./);
  source.snapshots[2].depthsMm[2]=-1;
  assert.throws(()=>snapshotDepths(source,99),/Invalid solver snapshot sequence\./);
});
