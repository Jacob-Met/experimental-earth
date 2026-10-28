import assert from 'node:assert/strict';
import { searchCoolingWindows, normalizeCoolingSearch } from '../shade-heat-window-search.js';
const q = { availabilityFromMinute: 0, availabilityToMinute: 5, endpointSpanMinutes: 1, thresholdC: 0, store: 'surfaceC' };
function report(bounds) {
 return { courses: [60,30,15].map(solarStepMinutes => ({ solarStepMinutes, targets: Object.fromEntries(['existing','proposal'].map(target =>
  [target,Object.fromEntries(['lower','upper'].map(bound=>[bound,{trajectory:bounds.map(([lo,hi],minute)=>({minute,
    surfaceC:target==='proposal'?0:bound==='lower'?lo:hi,
    subsurfaceC:target==='proposal'?0:bound==='lower'?lo-2:hi-2}))}]))])) })) };
}
function oracle(bounds,input) {
 const rows=[];
 for(let start=input.availabilityFromMinute;start+input.endpointSpanMinutes<=input.availabilityToMinute;start++){
  const selected=bounds.slice(start,start+input.endpointSpanMinutes+1).map(([lo,hi],i)=>{
   const lowerC=lo-(input.store==='subsurfaceC'?2:0),upperC=hi-(input.store==='subsurfaceC'?2:0);
   return{minute:start+i,lowerC,upperC,state:lowerC>=input.thresholdC?'supported':upperC<input.thresholdC?'failed':'ambiguous'};
  });
  const firstFailure=selected.find(s=>s.state==='failed')??null,firstAmbiguous=selected.find(s=>s.state==='ambiguous')??null;
  const row={fromMinute:start,toMinute:start+input.endpointSpanMinutes,state:firstFailure?'refuted':firstAmbiguous?'unresolved':'supported',
   counts:Object.fromEntries(['supported','failed','ambiguous'].map(s=>[s,selected.filter(r=>r.state===s).length])),firstFailure,firstAmbiguous};
  rows.push(row);if(row.state==='supported')break;
 }
 return rows;
}
const mixed=[[-1,1],[-1,1],[1,2],[1,2],[-2,-1],[2,3]];
const r=searchCoolingWindows(report(mixed),q).courses[0];
assert.equal(r.firstSupported.fromMinute,2);assert.equal(r.firstUnresolved.fromMinute,0);assert.deepEqual(r.earlierCounts,{refuted:0,unresolved:2});
assert.equal(searchCoolingWindows(report(Array(6).fill([-2,-1])),q).courses[0].state,'all-starts-refuted');
assert.equal(searchCoolingWindows(report(Array(6).fill([-1,1])),q).courses[0].state,'unresolved-starts-remain');
assert.equal(searchCoolingWindows(report(Array(6).fill([0,0])),{...q,endpointSpanMinutes:0}).sampleCount,1);
assert.equal(searchCoolingWindows(report(Array(6).fill([0,0])),{...q,endpointSpanMinutes:5}).eligibleStartCount,1);
let seed=17;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
for(let trial=0;trial<240;trial++){
 const bounds=Array.from({length:12},()=>{const lo=random()%9-4;return[lo,lo+random()%5];});
 const from=random()%5,to=from+random()%(12-from),input={...q,availabilityFromMinute:from,availabilityToMinute:to,
  endpointSpanMinutes:random()%(to-from+1),thresholdC:random()%7-3,store:trial%2?'surfaceC':'subsurfaceC'};
 const expected=oracle(bounds,input),actual=searchCoolingWindows(report(bounds),input);
 for(const c of actual.courses)assert.deepEqual([...c.earlierStarts,...(c.firstSupported?[c.firstSupported]:[])],expected);
}
for(const change of[x=>x.endpointSpanMinutes=6,x=>x.endpointSpanMinutes=-1,x=>x.endpointSpanMinutes=.5,x=>x.availabilityFromMinute='0',x=>x.extra=true]){
 const x={...q};change(x);assert.throws(()=>normalizeCoolingSearch(x));
}
for(const change of[rows=>rows.pop(),rows=>rows.push({...rows[0]}),rows=>rows[2].surfaceC=NaN]){
 const x=report(mixed);change(x.courses[2].targets.proposal.lower.trajectory);assert.throws(()=>searchCoolingWindows(x,q));
}
const separate=report(mixed);separate.courses[1].targets.existing.lower.trajectory.forEach(r=>r.surfaceC=-5);
assert.equal(searchCoolingWindows(separate,q).courses[1].firstSupported,null);
const extra=report(mixed);extra.courses[0].targets.proposal.lower.trajectory.unshift({minute:.25,surfaceC:1000});
assert.deepEqual(searchCoolingWindows(extra,q),searchCoolingWindows(report(mixed),q));
console.log('PASS: independent deterministic 240-query oracle across three grids; earlier ambiguity, refutation, equality/span0/full span, store isolation, invalid admission and complete coverage');
