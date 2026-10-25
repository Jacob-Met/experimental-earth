import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {inspectSharedObservedConnection as inspect} from '../observed-shared-connection.js';
import {exportSharedObservedConnection,reopenSharedObservedConnection} from '../observed-shared-connection.js';
const question={scenario:'existing',minutes:[10,20],thresholdMm:5,startIndex:8,endIndex:10,allowedIndices:[0,1,2,8,10,16,17,18]};
function control(){const p=makeExample();p.observations=[10,20].flatMap(minute=>question.allowedIndices.map(cellIndex=>({minute,cellIndex,scenario:'existing',depthMm:(minute===10?[16,17,18]:[0,1,2]).includes(cellIndex)?10:0,uncertaintyMm:0,source:'Authored original-band control'})));return p;}
test('individual supported visits cannot certify a shared connection',()=>{
 const p=control(),before=structuredClone(p),r=inspect(p,question);
 assert.deepEqual(r.ledgers.map(l=>l.status),['band-supported','band-supported']);assert.equal(r.status,'band-excluded');
 assert.deepEqual(r.boundary,[0,16]);assert.equal(r.usedReadingIndices.length,16);assert.deepEqual(p,before);
 for(const i of r.boundary)assert.ok(r.cells[i].visits.some(v=>v.status==='above'));
});
test('missing originals remain unresolved; stable original bands can support only sampled visits',()=>{
 const p=control();p.observations=p.observations.filter(o=>!(o.minute===20&&[0,1,2].includes(o.cellIndex)));
 const r=inspect(p,question);assert.equal(r.status,'unresolved');assert.deepEqual(r.unresolvedPairs,[0,1,2].map(cellIndex=>({cellIndex,minute:20})));
 p.observations.push(...[0,1,2].map(cellIndex=>({minute:20,cellIndex,scenario:'existing',depthMm:4,uncertaintyMm:1,source:'Authored inclusive upper bound'})));
 assert.equal(inspect(p,question).status,'band-supported');
 assert.equal(inspect(p,{...question,minutes:[10,15,20]}).status,'unresolved','an unobserved visit is never interpolated');
});
test('contradictions, wrong scenario, duplicate times and disconnected footprints remain explicit',()=>{
 const p=control();p.observations.push({...p.observations[0],depthMm:40});assert.equal(inspect(p,question).status,'conflicting-bands');
 assert.equal(inspect(control(),{...question,scenario:'proposal'}).status,'unresolved');
 assert.equal(inspect(control(),{...question,allowedIndices:[8,10]}).status,'disconnected-footprint');
 for(const minutes of [[10],[10,10],[10,NaN],[10,721],Array(2),Array.from({length:17},(_,i)=>i)])assert.throws(()=>inspect(control(),{...question,minutes}));
});
test('small-grid independent binary completions agree with supported/excluded/unresolved classification',()=>{
 let seed=276;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed%3;};
 const reachable=wet=>{const seen=new Set([0]),queue=wet[0]?[]:[0];for(const i of queue)for(const j of [i-3,i+3,...(i%3?[i-1]:[]),...(i%3<2?[i+1]:[])])if(j>=0&&j<6&&!wet[j]&&!seen.has(j)){seen.add(j);queue.push(j);}return queue.includes(5);};
 for(let k=0;k<64;k++){
  const p=makeExample();p.width=3;p.height=2;p.existing=p.existing.slice(0,6);p.proposal=p.proposal.slice(0,6);delete p.selectedIndex;
  const codes=Array.from({length:12},random),unknown=codes.flatMap((c,i)=>c===2?[i]:[]);
  p.observations=codes.map((c,i)=>({minute:i<6?10:20,cellIndex:i%6,scenario:'existing',depthMm:c===0?0:c===1?10:5,uncertaintyMm:c===2?5:0,source:'Authored completion control'}));
  let successes=0;
  for(let mask=0;mask<2**unknown.length;mask++){
   const values=codes.map(c=>c===1);unknown.forEach((i,bit)=>values[i]=Boolean(mask&(1<<bit)));
   const wet=Array.from({length:6},(_,i)=>values[i]||values[i+6]);if(reachable(wet))successes++;
  }
  const expected=successes===0?'band-excluded':successes===2**unknown.length?'band-supported':'unresolved';
  assert.equal(inspect(p,{...question,startIndex:0,endIndex:5,allowedIndices:[0,1,2,3,4,5]}).status,expected);
 }
});

test('source-only replay recomputes, preserving original source rows and query',()=>{
 const p=control();p.observations[0].tableSource={fileName:'authored-original.csv',line:2,unit:'cm',depthValue:'0.000',uncertaintyValue:'0'};
 const text=exportSharedObservedConnection(p,question),packet=JSON.parse(text);
 assert.deepEqual(Object.keys(packet).sort(),['project','query','schema']);assert.deepEqual(packet.project,p);
 assert.deepEqual(reopenSharedObservedConnection(text).report,inspect(p,question));
 packet.report={status:'band-supported'};assert.equal(reopenSharedObservedConnection(JSON.stringify(packet)).report.status,'band-excluded');
 packet.query.minutes=[10,10];assert.throws(()=>reopenSharedObservedConnection(JSON.stringify(packet)));
 assert.throws(()=>reopenSharedObservedConnection('{}'));
});
