import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample,chooseInfiltrationObservation,runRain,SURFACES} from '../core.js';
import {planInfiltrationInquiry,createInfiltrationInquiry,runInfiltrationInquiry,INFILTRATION_CELL_STEP_LIMIT} from '../infiltration-inquiry.js';

function course({size=12,index=78,surface='sealed',rain=10,steps=15,slope=false}={}) {
  const p=makeExample();p.width=p.height=size;p.selectedIndex=0;
  p.existing=Array.from({length:size*size},(_,i)=>({surface:i===index?surface:'garden',elevationM:slope?i%size*.002:0,provenance:'Authored sensitivity course'}));
  p.proposal=structuredClone(p.existing);
  Object.assign(p.weather,{rainMmHr:rain,stormMinutes:15,durationMinutes:steps*3,stepMinutes:3,mobilityPerHour:.5,boundaryExitPerHour:.2,cellSizeM:1});
  return p;
}
// Independent exhaustive source-model oracle, retaining the full endpoint vector.
function oracle(p,target='proposal') {
  const rows=p[target].map((cell,cellIndex)=>{
    const range=SURFACES[cell.surface];
    const values=[range.rangeLowMmHr,range.rangeHighMmHr].map(rateMmHr=>{
      const r=runRain(p[target],p.width,p.height,p.weather,{infiltrationOverride:{cellIndex,rateMmHr}});
      return r.storedLiters+r.exitLiters;
    });
    return {cellIndex,impactLiters:Math.abs(values[1]-values[0])};
  });
  let best=rows[0];for(const row of rows.slice(1))if(row.impactLiters>best.impactLiters+1e-9)best=row;
  return best.impactLiters>1e-9?best:null;
}

test('complete-grid inquiry finds consequential sealed cell omitted by legacy shortlist',()=>{
  const p=course(),before=JSON.stringify(p);assert.equal(chooseInfiltrationObservation(p),null);
  const full=runInfiltrationInquiry(p),partial=runInfiltrationInquiry(p,'proposal','shortlist');
  assert.equal(full.status,'complete');assert.equal(full.completeCoverage,true);assert.equal(full.evaluatedCount,144);
  assert.equal(full.winner.cellIndex,78);assert.ok(Math.abs(full.winner.impactLiters-.6345256532362199)<1e-12);
  assert.equal(partial.winner,null);assert.equal(partial.completeCoverage,false);assert.equal(partial.evaluatedCount,36);
  assert.equal(JSON.stringify(p),before);
});
test('unfamiliar rain/material/location/slope courses agree with complete original-solver oracle',()=>{
  for(const options of [{rain:2},{index:0},{index:143},{slope:true},{index:12,surface:'turf',rain:11},{size:10,index:89,rain:4},{rain:25},{rain:0},{rain:.1},{surface:'turf',rain:6}]) {
    const p=course(options),expected=oracle(p),r=runInfiltrationInquiry(p);
    assert.equal(r.winner?.cellIndex??null,expected?.cellIndex??null,JSON.stringify(options));
    if(expected)assert.equal(r.winner.impactLiters,expected.impactLiters);
    assert.equal(r.completeCoverage,true);
  }
});
test('largest admitted short course retains every cell; long course refuses before claiming a result',()=>{
  const p=course({size:24,index:312}),r=runInfiltrationInquiry(p);
  assert.equal(r.evaluatedCount,576);assert.equal(r.winner.cellIndex,312);assert.equal(r.completeCoverage,true);
  p.weather.durationMinutes=720;p.weather.stepMinutes=1;
  const refusal=runInfiltrationInquiry(p);
  assert.equal(refusal.status,'capacity');assert.equal(refusal.evaluatedCount,0);assert.equal(refusal.winner,null);
  assert.ok(refusal.estimatedCellSteps>INFILTRATION_CELL_STEP_LIMIT);assert.equal(refusal.completeCoverage,undefined);
  p.weather.durationMinutes=240;p.weather.stepMinutes=5;
  assert.equal(planInfiltrationInquiry(p).status,'capacity');
  assert.equal(planInfiltrationInquiry(p,'proposal','shortlist').status,'ready');
});
test('snapshot isolates in-flight source; edits to reused source recompute next inquiry',()=>{
  const p=course(),expected=runInfiltrationInquiry(p),q=createInfiltrationInquiry(p);
  assert.equal(q.steps.next().value.evaluatedCount,1);p.proposal[78].surface='garden';
  let n;do{n=q.steps.next();}while(!n.done);assert.deepEqual(n.value,expected);
  assert.equal(runInfiltrationInquiry(p).winner,null);
  assert.equal(runInfiltrationInquiry(p,'existing').winner.cellIndex,78);
});
test('zero-effect full/partial coverage and deterministic ties remain distinct',()=>{
  const p=course({rain:0});assert.equal(runInfiltrationInquiry(p).completeCoverage,true);
  const partial=runInfiltrationInquiry(p,'proposal','shortlist');assert.equal(partial.completeCoverage,false);assert.equal(partial.winner,null);
  const small=course({size:4,index:0});small.proposal.forEach(c=>c.surface='sealed');
  const expected=oracle(small);assert.equal(runInfiltrationInquiry(small).winner.cellIndex,expected.cellIndex);
  assert.deepEqual(chooseInfiltrationObservation(small),{...runInfiltrationInquiry(small).winner,evaluatedCount:16,totalCount:16});
});
test('invalid scenario, coverage and source are refusals, never zero sensitivity',()=>{
  const p=course();assert.throws(()=>runInfiltrationInquiry(p,'other'),/scenario/);
  assert.throws(()=>runInfiltrationInquiry(p,'proposal','automatic-fallback'),/coverage/);
  p.weather.stepMinutes=0;assert.throws(()=>runInfiltrationInquiry(p),/Weather/);
});
