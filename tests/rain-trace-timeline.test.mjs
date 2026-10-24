import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain } from '../core.js';
import { compareRainTrace } from '../rain-trace-study.js';
import { MAX_TRACE_CELL_STEPS } from '../rain-tracer.js';
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<=tol, `${a} != ${b}`);
const vectors=(a,b)=>{assert.equal(a.length,b.length);a.forEach((x,i)=>close(x,b[i]));};
function splitFixture(){
 const p=makeExample();p.width=p.height=2;p.selectedIndex=0;
 p.existing=Array.from({length:4},(_,i)=>({surface:'sealed',elevationM:i===0?1:0,provenance:'authored split control'}));
 p.proposal=structuredClone(p.existing);
 Object.assign(p.weather,{rainMmHr:60,stormMinutes:5,durationMinutes:10,stepMinutes:5,cellSizeM:1,mobilityPerHour:1,boundaryExitPerHour:0});
 p.rainTraceStudy={sourceCells:[0]};return p;
}
function run(p,{captureSteps=true,sourceCells=[0],...extra}={}){
 return runRain(p.existing,p.width,p.height,p.weather,{...extra,rainTrace:{sourceCells,captureSteps}});
}
test('saved steps retain initial zero, capped first split and delayed mixed second hop',()=>{
 const p=splitFixture();const r=run(p,{surfaceInfiltrationOverride:{surface:'sealed',rateMmHr:0}}),snaps=r.rainTrace.snapshots;
 assert.deepEqual(snaps.map(s=>s.minute),[0,5,10]);
 vectors(snaps[0].depthsMm,[0,0,0,0]);vectors(snaps[1].depthsMm,[0,2.5,2.5,0]);
 vectors(snaps[2].depthsMm,[0,2.5-5/72,2.5-5/72,5/36]);
 assert.equal(snaps[0].rainLiters,0);assert.equal(snaps[1].rainLiters,5);assert.equal(snaps[2].rainLiters,5);
 for(const s of snaps)close(s.rainLiters,s.absorbedLiters+s.exitLiters+s.storedLiters);
});
test('retained snapshots reproduce separately stopped model runs including fractional final intervals',()=>{
 const p=makeExample();Object.assign(p.weather,{stormMinutes:13.2,durationMinutes:30.7,stepMinutes:7});
 const sourceCells=[0,12,27],r=run(p,{sourceCells});
 assert.deepEqual(r.rainTrace.snapshots.map(s=>s.minute),[0,7,14,21,28,30.7]);
 for(const s of r.rainTrace.snapshots.slice(1)){
  const prefix={...p,weather:{...p.weather,durationMinutes:s.minute,stormMinutes:Math.min(s.minute,p.weather.stormMinutes)}};
  const t=run(prefix,{captureSteps:false,sourceCells}).rainTrace;
  for(const key of ['rainLiters','absorbedLiters','exitLiters','storedLiters'])close(s[key],t[key]);
  vectors(s.depthsMm,t.finalDepthMm);vectors(s.absorbedByCellLiters,t.absorbedByCellLiters);vectors(s.exitByCellLiters,t.exitByCellLiters);
  close(s.massErrorLiters,0);
 }
});
test('timeline collection preserves all final attribution and every ordinary water result exactly',()=>{
 const p=makeExample(),sourceCells=[0,27];
 const withTimeline=run(p,{sourceCells}),without=run(p,{sourceCells,captureSteps:false});
 const {snapshots,...finalTrace}=withTimeline.rainTrace;
 assert.deepEqual(finalTrace,without.rainTrace);
 delete withTimeline.rainTrace;delete without.rainTrace;assert.deepEqual(withTimeline,without);
 assert.ok(snapshots.length>2);
});
test('recorded arrays own their values independently of earlier steps and final output',()=>{
 const p=splitFixture(),r=run(p),s=r.rainTrace.snapshots,last=s.at(-1);
 const initial=structuredClone(s[0]),first=structuredClone(s[1]),final=structuredClone(r.rainTrace.finalDepthMm);
 last.depthsMm[0]=999;last.absorbedByCellLiters[0]=999;last.exitByCellLiters[0]=999;
 assert.deepEqual(s[0],initial);assert.deepEqual(s[1],first);assert.deepEqual(r.rainTrace.finalDepthMm,final);
});
test('disjoint source contributions add at every retained time with nonnegative conserved fates',()=>{
 const p=makeExample(),a=run(p,{sourceCells:[0]}).rainTrace.snapshots,b=run(p,{sourceCells:[27]}).rainTrace.snapshots;
 const all=run(p,{sourceCells:[0,27]}).rainTrace.snapshots;
 for(let j=0;j<all.length;j++){
  for(const key of ['rainLiters','absorbedLiters','exitLiters','storedLiters'])close(a[j][key]+b[j][key],all[j][key]);
  for(const key of ['depthsMm','absorbedByCellLiters','exitByCellLiters']){
   vectors(a[j][key].map((v,i)=>v+b[j][key][i]),all[j][key]);assert.ok(all[j][key].every(x=>x>=0&&Number.isFinite(x)));
  }
  close(all[j].massErrorLiters,0);
 }
});
test('all-source snapshot depth and fate agree with each ordinary water snapshot',()=>{
 const p=makeExample(),r=run(p,{sourceCells:p.existing.map((_,i)=>i)});
 r.snapshots.forEach((s,i)=>{
  const tag=r.rainTrace.snapshots[i];assert.equal(tag.minute,s.minute);vectors(tag.depthsMm,s.depthsMm);
  for(const key of ['storedLiters','absorbedLiters','exitLiters'])close(tag[key],s[key],1e-6);
 });
});
test('retention limit refuses oversized capture before simulation while paired consumer preserves final-only attribution',()=>{
 const p=makeExample();p.width=p.height=24;p.selectedIndex=0;
 p.existing=Array.from({length:576},()=>({surface:'sealed',elevationM:0,provenance:'authored budget control'}));p.proposal=structuredClone(p.existing);
 Object.assign(p.weather,{durationMinutes:720,stepMinutes:1,mobilityPerHour:0,boundaryExitPerHour:0});
 p.rainTraceStudy={sourceCells:[0]};
 assert.ok(576*721>MAX_TRACE_CELL_STEPS);
 assert.throws(()=>run(p),/cell-step budget/);
 const r=compareRainTrace(p,{timeline:true});
 assert.equal(r.timeline.status,'not-retained');assert.equal(r.existing.snapshots,undefined);
 assert.equal(r.proposal.snapshots,undefined);assert.equal(r.timeline.requestedCellSteps,576*721);
 close(r.existing.massErrorLiters,0,1e-6);assert.deepEqual(r.existing,r.proposal);
});
test('actual fictional courtyard retains the temporary contribution hidden by final-only storage',()=>{
 const p=makeExample();p.rainTraceStudy={sourceCells:[27]};
 const before=JSON.stringify(p),r=compareRainTrace(p,{timeline:true});
 assert.equal(r.timeline.status,'retained');assert.equal(JSON.stringify(p),before);
 const minute60=r.proposal.snapshots.find(s=>s.minute===60);
 close(minute60.storedLiters,59.26239957612627);close(r.proposal.snapshots.at(-1).storedLiters,0);
 for(let i=0;i<r.existing.snapshots.length;i++)assert.equal(r.existing.snapshots[i].minute,r.proposal.snapshots[i].minute);
});
test('dry timeline stays exactly zero and malformed capture choices are refused',()=>{
 const p=splitFixture();p.weather.rainMmHr=0;
 for(const s of run(p).rainTrace.snapshots){
  assert.equal(s.rainLiters,0);assert.equal(s.storedLiters,0);assert.equal(s.absorbedLiters,0);assert.equal(s.exitLiters,0);assert.equal(s.massErrorLiters,0);
 }
 assert.throws(()=>run(p,{captureSteps:'yes'}),/boolean/);
 assert.throws(()=>compareRainTrace(p,{timeline:1}),/boolean/);
});
