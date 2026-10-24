import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain, validateProject } from '../core.js';
import { compareRainOrigins, rainOriginSignature } from '../rain-origin-study.js';
import { createRainOriginTracer, MAX_ORIGIN_CELL_STEPS } from '../rain-origins.js';
const close = (a,b,tol=1e-7) => assert.ok(Math.abs(a-b)<=tol, `${a} != ${b}`);
const sum = xs => xs.reduce((a,b)=>a+b,0);
function fixture() {
  const p=makeExample();p.width=p.height=2;p.selectedIndex=0;
  p.existing=Array.from({length:4},(_,i)=>({surface:'sealed',elevationM:i===0?1:0,provenance:'authored origin control'}));
  p.proposal=structuredClone(p.existing);
  Object.assign(p.weather,{rainMmHr:60,stormMinutes:5,durationMinutes:5,stepMinutes:5,cellSizeM:1,mobilityPerHour:1,boundaryExitPerHour:0});
  return p;
}
const run=(p,study,extra={})=>runRain(p.existing,p.width,p.height,p.weather,{...extra,rainOrigins:study});
const key={stored:'storedByCellLiters',absorbed:'absorbedByCellLiters',exit:'exitByCellLiters'};
test('one-step reverse origin map reproduces the independent capped split calculation',()=>{
  const p=fixture(),r=run(p,{targetCells:[1],fate:'stored'}).rainOrigins;
  close(r.bySourceLiters[0],59/24);close(r.bySourceLiters[1],59/12);
  assert.deepEqual(r.bySourceLiters.slice(2),[0,0]);close(r.targetTotalLiters,59/8);
  close(r.rainfallLiters,59/8);close(r.initialWaterLiters,0);close(r.balanceErrorLiters,0);
});
test('a reverse step cannot send a newly received parcel through a second edge',()=>{
  const p=fixture(),extra={surfaceInfiltrationOverride:{surface:'sealed',rateMmHr:0}};
  close(run(p,{targetCells:[3],fate:'stored'},extra).rainOrigins.bySourceLiters[0],0);
  p.weather.durationMinutes=10;
  close(run(p,{targetCells:[3],fate:'stored'},extra).rainOrigins.bySourceLiters[0],5/36);
});
test('every reverse source agrees with independent forward traces through changing, capped and fractional flows',()=>{
  const cases=[fixture(),makeExample()];
  const fractional=fixture();
  Object.assign(fractional.weather,{rainMmHr:113,stormMinutes:13.2,durationMinutes:30.7,stepMinutes:7,mobilityPerHour:10,boundaryExitPerHour:3,cellSizeM:2.3});
  fractional.existing[1].surface='garden';fractional.existing[2].elevationM=-0.2;
  cases.push(fractional);
  for(const p of cases) for(const fate of ['stored','absorbed','exit']){
    const targetCells=[1,p.existing.length-1],reverse=run(p,{targetCells,fate}).rainOrigins;
    for(let source=0;source<p.existing.length;source++){
      const f=runRain(p.existing,p.width,p.height,p.weather,{rainTrace:{sourceCells:[source]}}).rainTrace;
      const expected=targetCells.reduce((v,i)=>v+f[key[fate]][i],0);
      close(reverse.bySourceLiters[source],expected,1e-6);
    }
    close(reverse.rainfallLiters,reverse.targetTotalLiters,1e-6);
    close(reverse.balanceErrorLiters,0,1e-6);
    assert.ok(reverse.bySourceLiters.every(v=>Number.isFinite(v)&&v>=0));
  }
});
test('disjoint destination regions add for every source and fate',()=>{
  const p=makeExample();
  for(const fate of ['stored','absorbed','exit']){
    const a=run(p,{targetCells:[0,1],fate}).rainOrigins;
    const b=run(p,{targetCells:[27,47],fate}).rainOrigins;
    const both=run(p,{targetCells:[0,1,27,47],fate}).rainOrigins;
    both.bySourceLiters.forEach((value,i)=>close(value,a.bySourceLiters[i]+b.bySourceLiters[i]));
    close(both.targetTotalLiters,a.targetTotalLiters+b.targetTotalLiters);
  }
});
test('all destination fates account for all rainfall at each origin',()=>{
  const p=makeExample(),targetCells=p.existing.map((_,i)=>i);
  const results=['stored','absorbed','exit'].map(fate=>run(p,{targetCells,fate}).rainOrigins);
  const sourceRain=p.weather.rainMmHr*p.weather.stormMinutes/60*p.weather.cellSizeM**2;
  for(let i=0;i<p.existing.length;i++)close(sum(results.map(r=>r.bySourceLiters[i])),sourceRain,1e-6);
});
test('closed movement retains local origin and boundary exit is attributed at the actual outlet cell',()=>{
  const p=fixture();p.weather.mobilityPerHour=0;p.weather.boundaryExitPerHour=0.2;
  for(const fate of ['stored','absorbed','exit']){
    const r=run(p,{targetCells:[2],fate}).rainOrigins;
    assert.deepEqual(r.bySourceLiters.filter((_,i)=>i!==2),[0,0,0]);
    assert.ok(r.bySourceLiters[2]>0);close(r.bySourceLiters[2],r.targetTotalLiters);
  }
  const interior=makeExample();
  close(run(interior,{targetCells:[27],fate:'exit'}).rainOrigins.rainfallLiters,0);
});
test('optional reverse recording leaves ordinary water, forward tags and local budgets exactly unchanged',()=>{
  const p=makeExample(),extra={traceBudget:true,rainTrace:{sourceCells:[0,27],captureSteps:true}};
  const plain=runRain(p.existing,p.width,p.height,p.weather,extra);
  const traced=run(p,{targetCells:[27],fate:'absorbed'},extra);
  assert.ok(traced.rainOrigins);delete traced.rainOrigins;assert.deepEqual(traced,plain);
  assert.equal(runRain(p.existing,p.width,p.height,p.weather).rainOrigins,undefined);
});
test('paired origins use identical destinations, preserve inputs and invalidate only relevant context',()=>{
  const p=makeExample();p.rainOriginStudy={targetCells:[28,27],fate:'absorbed'};
  const before=JSON.stringify(p),signature=rainOriginSignature(p),r=compareRainOrigins(p);
  assert.equal(JSON.stringify(p),before);assert.deepEqual(r.targetCells,[27,28]);
  assert.deepEqual(r.existing.targetCells,r.proposal.targetCells);assert.notEqual(r.deltaLiters,0);
  p.selectedIndex=0;assert.equal(rainOriginSignature(p),signature);
  p.weather.rainMmHr+=1;assert.notEqual(rainOriginSignature(p),signature);
  p.proposal=structuredClone(p.existing);const same=compareRainOrigins(p);
  assert.deepEqual(same.existing,same.proposal);assert.equal(same.deltaLiters,0);
});
test('initial water remains separate from rain in reverse event accounting',()=>{
  const t=createRainOriginTracer(2,1,{targetCells:[1],fate:'stored'},2,[[0,1]],[2,0]);
  t.rain(1);t.absorb(0,1,3);t.absorb(1,0,1);t.transfer(0,1,1,2,0);t.endStep();
  const r=t.finish([1,2]);
  close(r.bySourceLiters[0],1/3);close(r.bySourceLiters[1],1);
  close(r.initialWaterLiters,2/3);close(r.targetTotalLiters,2);close(r.balanceErrorLiters,0);
});
test('dry controls, invalid destination metadata and finite work admission are explicit',()=>{
  const p=fixture();p.weather.rainMmHr=0;
  for(const fate of ['stored','absorbed','exit']){
    const r=run(p,{targetCells:[0],fate}).rainOrigins;
    assert.deepEqual(r.bySourceLiters,[0,0,0,0]);assert.equal(r.targetTotalLiters,0);assert.equal(r.balanceErrorLiters,0);
  }
  for(const study of [{targetCells:[],fate:'stored'},{targetCells:[0,0],fate:'exit'},{targetCells:[4],fate:'absorbed'},{targetCells:[0],fate:'all'}]){
    assert.throws(()=>run(p,study),/destination/);
    p.rainOriginStudy=study;assert.throws(()=>validateProject(p),/destination/);
  }
  delete p.rainOriginStudy;assert.throws(()=>compareRainOrigins(p),/destination/);
  p.width=p.height=24;p.existing=Array.from({length:576},()=>({surface:'sealed',elevationM:0,provenance:'authored budget control'}));
  p.proposal=structuredClone(p.existing);Object.assign(p.weather,{durationMinutes:720,stepMinutes:1});
  assert.ok(576*721>MAX_ORIGIN_CELL_STEPS);
  assert.throws(()=>run(p,{targetCells:[0],fate:'stored'}),/cell-step budget/);
});
