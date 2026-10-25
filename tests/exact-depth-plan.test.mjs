import test from 'node:test';
import assert from 'node:assert/strict';
import {planComplementaryDepths} from '../complementary-depth-plan.js';
import {planInfiltrationReadings} from '../complementary-infiltration.js';
import {makeExample} from '../core.js';
const runs = rows => rows.map(depthsMm => ({snapshots:[{minute:0,depthsMm:depthsMm.map(()=>0)},{minute:5,depthsMm}]}));
const exact = rows => planComplementaryDepths(runs(rows),{uncertaintyMm:2,maxReadings:2,strategy:'exact-pair'});
test('joint optimum improves authored greedy failure and keeps every alternative',()=>{
 const rows=[[6,10,8,2,6],[0,2,1,7,4],[10,4,4,5,7],[6,4,1,7,0],[2,2,10,1,10]];
 const r=exact(rows);assert.equal(r.separatedPairCount,8);assert.deepEqual(r.questions.map(x=>x.cellIndex),[0,4]);assert.equal(r.unresolvedPairs.length,2);
 assert.equal(planComplementaryDepths(runs(rows),{uncertaintyMm:2}).separatedPairCount,7);
});
test('word masks agree with independent uncompressed exhaustive set union including all 36 pairs',()=>{
 let seed=731;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let trial=0;trial<120;trial++){
  const rows=Array.from({length:9},()=>Array.from({length:8},()=>rand()%30));
  const sets=Array.from({length:8},(_,c)=>{const s=new Set();for(let a=0;a<9;a++)for(let b=a+1;b<9;b++)if(Math.abs(rows[a][c]-rows[b][c])>4+1e-9*Math.max(1,rows[a][c],rows[b][c],2))s.add(`${a}:${b}`);return s;});
  let best=0;for(let a=0;a<8;a++)for(let b=a;b<8;b++)best=Math.max(best,new Set([...sets[a],...sets[b]]).size);
  const before=JSON.stringify(rows),r=exact(rows);assert.equal(r.separatedPairCount,best);assert.equal(JSON.stringify(rows),before);
 }
});
test('coverage ties prefer a singleton and earliest coordinate; recorded values cannot select questions',()=>{
 const r=exact([[0,0,0],[10,10,10]]);assert.deepEqual(r.questions.map(x=>x.cellIndex),[0]);assert.equal(r.exact.candidatePatterns,1);
 const trajectory=runs([[0,0],[10,10]]),o={uncertaintyMm:2,maxReadings:2,strategy:'exact-pair',recorded:[{cellIndex:0,minute:5,depthMm:999}]};
 const a=planComplementaryDepths(trajectory,o);o.recorded[0].depthMm=-999;assert.deepEqual(planComplementaryDepths(trajectory,o),a);assert.equal(a.questions[0].cellIndex,1);
 assert.throws(()=>planComplementaryDepths([],{uncertaintyMm:2,maxReadings:3,strategy:'exact-pair'}),/two-reading/);
});
test('complete pattern-family work refusal never returns a partial optimum',()=>{
 let seed=849;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed>>>8)%100;};
 const r=Array.from({length:9},()=>({snapshots:Array.from({length:7},(_,i)=>({minute:i*5,depthsMm:Array.from({length:500},()=>rand())}))}));
 assert.throws(()=>planComplementaryDepths(r,{uncertaintyMm:15,maxReadings:2,strategy:'exact-pair'}),/complete singleton\/pair/);
});
test('actual maintained courtyard improves 33 to 34 distinctions without adopting source or using held-aside values',()=>{
 const p=makeExample();p.weather.rainMmHr=24;p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[0,1,3,6,9,15,22,40,60]};
 p.observations=[{cellIndex:0,minute:0,depthMm:0,uncertaintyMm:0,source:'Authored initial control',scenario:'existing',use:'calibration'}];
 const before=JSON.stringify(p),g=planInfiltrationReadings(p,{uncertaintyMm:2,maxReadings:2}),e=planInfiltrationReadings(p,{uncertaintyMm:2,maxReadings:2,strategy:'exact-pair'});
 assert.equal(g.separatedPairCount,33);assert.equal(e.separatedPairCount,34);assert.deepEqual(e.questions.map(x=>[x.cellIndex,x.minute]),[[45,40],[10,120]]);assert.equal(e.exact.evaluatedPlans,8128);assert.equal(JSON.stringify(p),before);
 p.observations.push({cellIndex:0,minute:5,depthMm:0,uncertaintyMm:0,source:'Authored challenge',scenario:'existing',use:'challenge'});
 const a=planInfiltrationReadings(p,{uncertaintyMm:2,maxReadings:2,strategy:'exact-pair'});p.observations[1].depthMm=999;const b=planInfiltrationReadings(p,{uncertaintyMm:2,maxReadings:2,strategy:'exact-pair'});assert.deepEqual(b.questions,a.questions);assert.deepEqual(b.ratesMmHr,a.ratesMmHr);assert.deepEqual(b.unresolvedPairs,a.unresolvedPairs);
});
