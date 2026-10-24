import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { allocateCrestTransfers } from '../crest-transfers.js';
import { makeExample, runRain, validateProject } from '../core.js';
import { withInternalBarrier, withInternalCrest, sameInternalBarriers } from '../internal-barriers.js';
import { localBudgetRegion } from '../local-water-budget.js';
import { assertMatchingEventSite } from '../event-challenge.js';
const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,a+' != '+b);
const vector=(a,b)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>close(v,b[i]));};
const link=(requested,stopDepthMm)=>({src:0,dst:1,requested,...(stopDepthMm===undefined?{}:{stopDepthMm})});
function fixture(){
 const p=makeExample();p.width=p.height=2;p.selectedIndex=0;
 p.existing=Array.from({length:4},(_,i)=>({surface:'sealed',elevationM:i===0?.01:0,provenance:'authored crest control'}));
 p.proposal=structuredClone(p.existing);
 Object.assign(p.weather,{rainMmHr:100,stormMinutes:6,durationMinutes:6,stepMinutes:6,cellSizeM:1,mobilityPerHour:10,boundaryExitPerHour:0});
 return withInternalBarrier(p,'proposal',0,'south',true,'Isolate the analytical east path');
}
const run=(p,extra={})=>runRain(p.proposal,p.width,p.height,p.weather,{surfaceInfiltrationOverride:{surface:'sealed',rateMmHr:0},traceBudget:true,rainTrace:{sourceCells:[0]},...extra});
test('analytical donor layers share the same upper water and deactivate tied thresholds',()=>{
 vector(allocateCrestTransfers([10],[link(2,8)]),[2]);
 vector(allocateCrestTransfers([10],[link(2,8),link(2,8)]),[1,1]);
 vector(allocateCrestTransfers([10],[link(2,8),link(4,6)]),[2/3,10/3]);
});
test('higher overflow and later lower drainage compete for the same water',()=>{
 const q=allocateCrestTransfers([10],[link(2,8),link(6,4),link(20)]);
 vector(q,[1/7,123/91,774/91]);close(q.reduce((a,b)=>a+b,0),10);
 const reversed=allocateCrestTransfers([10],[link(20),link(6,4),link(2,8)]);
 vector(reversed,[774/91,123/91,1/7]);
});
test('unaffected donors retain legacy cap path and incoming transfer is unavailable',()=>{
 assert.equal(allocateCrestTransfers([10],[link(30)]),null);
 const q=allocateCrestTransfers([10,1],[link(2,8),{src:1,dst:2,requested:5}]);
 close(q[0],2);assert.equal(q[1],undefined);
});
test('below and at crest no water crosses; above it the full solver transfers two liters',()=>{
 for(const crest of [.02,.021]){
  const p=withInternalCrest(fixture(),'proposal',0,'east',crest,'Declared crest');
  vector(run(p).finalDepthMm,[10,10,10,10]);
 }
 const p=withInternalCrest(fixture(),'proposal',0,'east',.018,'Declared crest');
 const r=run(p,{rainOrigins:{targetCells:[1],fate:'stored'}});
 vector(r.finalDepthMm,[8,12,10,10]);vector(r.rainTrace.finalDepthMm,[8,2,0,0]);
 vector(r.rainOrigins.bySourceLiters,[2,10,0,0]);close(r.waterBudget.edges[0].aToBLiters,2);
 close(r.massErrorLiters,0);close(r.rainOrigins.balanceErrorLiters,0);
 r.waterBudget.cells.forEach(c=>close(c.balanceErrorLiters,0));
});
test('multiple finite paths use shared donor layers in the maintained solver',()=>{
 let p=withInternalCrest(fixture(),'proposal',0,'east',.018,'East crest');
 p=withInternalCrest(p,'proposal',0,'south',.016,'Lower south crest');
 const r=run(p);vector(r.finalDepthMm,[6,10+2/3,10+10/3,10]);close(r.massErrorLiters,0);
});
test('canonical finite crests allow reverse flow and reciprocal edits',()=>{
 let p=fixture();p.proposal[0].elevationM=0;p.proposal[1].elevationM=.01;
 p=withInternalBarrier(p,'proposal',1,'south',true,'Isolate west path');
 const a=withInternalCrest(p,'proposal',1,'west',.018,'Same crest');
 const b=withInternalCrest(p,'proposal',0,'east',.018,'Same crest');assert.deepEqual(a,b);
 vector(run(a).finalDepthMm,[12,8,10,10]);close(run(a).waterBudget.edges[0].bToALiters,2);
});
test('crests at or below higher adjoining ground are inert without changing legacy numerics',()=>{
 const p=fixture(),legacy=run(p);
 for(const crest of [-10,0,.01])assert.deepEqual(run(withInternalCrest(p,'proposal',0,'east',crest,'Inert declaration')),legacy);
});
test('finite crest edits survive portability and update both footprint endpoints and event admission',()=>{
 const p=fixture(),a=withInternalCrest(p,'proposal',0,'east',.018,'First source');
 const b=withInternalCrest(a,'proposal',0,'east',.019,'Changed crest');
 assert.equal(sameInternalBarriers(a.proposal,b.proposal),false);
 assert.throws(()=>assertMatchingEventSite(a,b,'proposal'));
 assert.deepEqual(localBudgetRegion(a,'edited'),[0,1,2]);
 const same=withInternalCrest(a,'proposal',1,'west',.018,'Another source');
 assert.equal(sameInternalBarriers(a.proposal,same.proposal),true);
 assert.deepEqual(run(validateProject(JSON.parse(JSON.stringify(a)))),run(a));
 const open=withInternalBarrier(a,'proposal',0,'east',false,'Remove crest');
 assert.deepEqual(run(open),run(p));assert.equal(open.proposal[0].internalBarriers.east.crestElevationM,undefined);
});
test('malformed, ambiguous and exterior crests never enter an accepted site',()=>{
 for(const edge of [{crestElevationM:NaN,source:'x'},{crestElevationM:Infinity,source:'x'},
  {crestElevationM:11,source:'x'},{crestElevationM:null,source:'x'},{crestElevationM:.02,closed:false,source:'x'},
  {crestElevationM:.02,source:''},{crestElevationM:.02,source:'x',heightM:.02}]){
  const p=fixture();p.proposal[0].internalBarriers.east=edge;assert.throws(()=>validateProject(p));
 }
 assert.throws(()=>withInternalCrest(fixture(),'proposal',0,'north',.02,'Exterior'),/exterior/);
});
test('time-step choice remains visible for rain crossing a crest during the modeled interval',()=>{
 const p=withInternalCrest(fixture(),'proposal',0,'east',.018,'Rain crosses crest');
 const coarse=run(p);p.weather.stepMinutes=3;const refined=run(p);
 close(coarse.waterBudget.edges[0].aToBLiters,2);close(refined.waterBudget.edges[0].aToBLiters,1);
 close(refined.massErrorLiters,0);assert.equal(refined.snapshots.length,3);
});
test('mixed finite paths preserve positivity and all accepted-flux accounting with sinks',()=>{
 let p=makeExample();for(const [i,direction]of [[0,'east'],[7,'south'],[18,'east'],[27,'south'],[36,'east']])
  p=withInternalCrest(p,'proposal',i,direction,p.proposal[i].elevationM+.02,'Authored finite network');
 for(const fate of ['stored','absorbed','exit']){
  const r=runRain(p.proposal,p.width,p.height,p.weather,{traceBudget:true,rainTrace:{sourceCells:[0,18,27]},rainOrigins:{targetCells:[0,18,27],fate}});
  close(r.massErrorLiters,0);close(r.rainTrace.massErrorLiters,0);close(r.rainOrigins.balanceErrorLiters,0);
  r.waterBudget.cells.forEach(c=>close(c.balanceErrorLiters,0));assert(r.snapshots.every(s=>s.depthsMm.every(x=>x>=0)));
 }
});
test('six frozen pre-crest outputs stay bit-for-bit identical for legacy open/closed projects',()=>{
 const frozen=JSON.parse(readFileSync(new URL('./fixtures/pre-crest-legacy.json',import.meta.url)));
 assert.equal(frozen.sourceCommit,'4b867d01e60ce35da3c0e00f88a1b4d1ef382258');
 for(const c of frozen.cases){const p=c.project,r=runRain(p.proposal,p.width,p.height,p.weather,c.options);
  assert.equal(createHash('sha256').update(JSON.stringify(r)).digest('hex'),c.resultSha256,c.name);}
});

test('unserialized prototype fields cannot introduce a hidden hydraulic mode',()=>{
 for(const edge of [Object.assign(Object.create({crestElevationM:.02}),{closed:false,source:'Own opening'}),
   Object.assign(Object.create({closed:true}),{crestElevationM:.02,source:'Own crest'})]){
  const p=fixture();p.proposal[0].internalBarriers.east=edge;assert.throws(()=>validateProject(p));
 }
 const p=fixture();p.proposal[0].internalBarriers=Object.create({east:{closed:true,source:'Inherited edge'}});
 assert.throws(()=>validateProject(p));
});
