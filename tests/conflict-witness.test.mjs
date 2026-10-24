import test from 'node:test';import assert from 'node:assert/strict';import {smallestConflict} from '../conflict-witness.js';
const rows=sets=>sets.map((supportedRatesMmHr,index)=>({index,supportedRatesMmHr}));
test('three-way witness despite pairwise compatibility',()=>{const r=smallestConflict(rows([[1,2],[2,3],[1,3]]),[1,2,3]);assert.deepEqual(r.indices,[0,1,2]);});
test('minimum cardinality preferred to early larger witness',()=>{const r=smallestConflict(rows([[1,2],[2,3],[1,3],[]]),[1,2,3]);assert.deepEqual(r.indices,[3]);});
test('tie uses stable indices and compatible evidence has no witness',()=>{assert.deepEqual(smallestConflict(rows([[1],[2],[1],[2]]),[1,2]).indices,[0,1]);assert.equal(smallestConflict(rows([[1,2],[1]]),[1,2]).indices,null);assert.equal(smallestConflict([],[1,2]).indices,null);});
test('full candidate bound resolves nine-reading conflict without pair conflict',()=>{const rates=Array.from({length:9},(_,i)=>i);const r=smallestConflict(rows(rates.map(rate=>rates.filter(x=>x!==rate))),rates);assert.deepEqual(r.indices,rates);assert.equal(r.searchStates,512);});
test('dynamic result agrees with exhaustive subset oracle over every four-reading/three-hypothesis support pattern',()=>{
 const rates=[0,1,2];
 for(let encoded=0;encoded<4096;encoded++){
  const sets=Array.from({length:4},(_,i)=>rates.filter(r=>((encoded>>(3*i))&7)&(1<<r)));
  let expected=null;
  for(let subset=1;subset<16;subset++){
   const ids=[0,1,2,3].filter(i=>subset&(1<<i));
   if(rates.some(rate=>ids.every(i=>sets[i].includes(rate))))continue;
   if(!expected||ids.length<expected.length||(ids.length===expected.length&&ids.join(',')<expected.join(',')))expected=ids;
  }
  assert.deepEqual(smallestConflict(rows(sets),rates).indices,expected);
 }
});
