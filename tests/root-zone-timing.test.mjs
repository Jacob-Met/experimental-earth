import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample,runRain} from '../core.js';
import {runRootZone} from '../root-zone.js';
import {advanceRootZoneForced as advance} from '../root-zone-forced.js';
import {runRootZoneTiming,rootZoneTimingAtDay,compareRootZoneTiming,originalRechargeIntervals,serializeRootZoneTiming,parseRootZoneTiming,validateRootZoneTiming} from '../root-zone-timing.js';
const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),a+' != '+b);
const root={fieldCapacity:.3,wiltingPoint:.12,rootDepthM:.1,initialAvailableMm:0,depletionFraction:.5,source:'Authored rooted store; no calibration'};
const demand={potentialTranspirationMmPerDay:12,source:'Authored event transpiration, no soil evaporation'};
const schedule=[{durationDays:7,potentialTranspirationMmPerDay:4,source:'Authored dry demand'}];
const args={availableMm:3,capacityMm:18,depletionFraction:.5,rechargeMmPerDay:2,demandMmPerDay:12,days:1};
const study=()=>({schema:'experimental-earth-root-zone-study/1',cellIndex:27,rechargeBasis:'modeled-event-infiltration-pulse',associationSource:'Hypothetical all infiltration enters this store; timing is declared separately',existing:root,proposal:root,schedule});
test('forced store matches independent constant-regime analytic values and capacity overflow',()=>{
 const r=advance(args),k=12/9;close(r.availableMm,1.5+(3-1.5)*Math.exp(-k));
 const full=advance({...args,availableMm:18,rechargeMmPerDay:20});close(full.availableMm,18);close(full.suppliedMm,12);close(full.drainageMm,8);
 const dry=advance({...args,rechargeMmPerDay:0});close(dry.availableMm,3*Math.exp(-k));close(dry.balanceErrorMm,0);
 const noDemand=advance({...args,demandMmPerDay:0,rechargeMmPerDay:20});close(noDemand.availableMm,18);close(noDemand.drainageMm,5);
});
test('upward and downward threshold crossings agree with separate analytic solutions',()=>{
 const up=advance({...args,availableMm:0,rechargeMmPerDay:24,days:1});const cross=Math.log(2)/(12/9);close(up.availableMm,Math.min(18,9+12*(1-cross)));
 const down=advance({...args,availableMm:15,rechargeMmPerDay:3,days:2});const crossing=(15-9)/9;close(down.availableMm,2.25+(9-2.25)*Math.exp(-(12/9)*(2-crossing)));
});
test('piecewise flow agrees when the same forcing is split at an arbitrary time',()=>{
 for(const p of [0,.3,.9,1])for(const S of [0,2,9,18])for(const r of [0,.2,12,26]){
  const a={...args,availableMm:S,depletionFraction:p,rechargeMmPerDay:r,days:.4};
  const first=advance(a),second=advance({...a,availableMm:first.availableMm,days:.6}),whole=advance({...a,days:1});
  close(whole.availableMm,second.availableMm);close(whole.suppliedMm,first.suppliedMm+second.suppliedMm);close(whole.drainageMm,first.drainageMm+second.drainageMm);
 }
});
test('independently reported extreme numeric failures either compute finitely or refuse explicitly',()=>{
 assert.throws(()=>advance({...args,capacityMm:Number.MIN_VALUE,availableMm:0,depletionFraction:0,rechargeMmPerDay:1,demandMmPerDay:30}),/finite numeric range/);
 assert.equal(advance({...args,capacityMm:Number.MIN_VALUE,availableMm:0,depletionFraction:0,rechargeMmPerDay:1,demandMmPerDay:30,days:0}).availableMm,0);
 const large=advance({...args,capacityMm:1e-307,availableMm:5e-308,depletionFraction:0,rechargeMmPerDay:1,demandMmPerDay:10,days:366});
 assert.ok(large.availableMm>0&&large.availableMm<2e-308);assert.ok(Math.abs(large.availableMm/1e-308-1)<1e-12);
 const tiny=advance({...args,capacityMm:.012589254117941675,availableMm:.0013988060131046305,depletionFraction:.07,rechargeMmPerDay:1e-19,demandMmPerDay:2,days:31});assert.ok(tiny.availableMm>0);
 for(const bad of [NaN,Infinity,-1])assert.throws(()=>advance({...args,rechargeMmPerDay:bad}));
});
test('same demand is applied before the late pulse, including nonzero original initial water',()=>{
 const r=runRootZoneTiming({...root,initialAvailableMm:10},[{startMinute:0,endMinute:720,rechargeMm:10}],demand,schedule);
 assert.ok(r.latePulse.event.suppliedMm>0);assert.ok(r.latePulse.event.availableMm<18);
 for(const p of Object.values(r)){close(p.event.rechargeMm,10);close(p.event.potentialMm,6);close(p.event.balanceErrorMm,0);}
 assert.equal(r.interval.root.initialAvailableMm,10);assert.equal(r.latePulse.root.initialAvailableMm,10);
 assert.notEqual(r.interval.dry.root.initialAvailableMm,10);assert.match(r.interval.dry.root.source,/Computed event-end/);
});
test('no event demand recovers the maintained whole-event pulse store and dry course',()=>{
 const original=runRootZone(root,30,schedule),r=runRootZoneTiming(root,[{startMinute:0,endMinute:360,rechargeMm:10},{startMinute:360,endMinute:720,rechargeMm:20}],{...demand,potentialTranspirationMmPerDay:0},schedule);
 for(const p of Object.values(r)){const end=rootZoneTimingAtDay(p,p.totalDays);close(end.availableMm,original.availableMm);close(end.suppliedMm,original.suppliedMm);close(end.drainageMm,original.drainageMm);}
});
test('exact-time inspection accounts for partial recharge and the end pulse boundary',()=>{
 const r=runRootZoneTiming(root,[{startMinute:0,endMinute:360,rechargeMm:12},{startMinute:360,endMinute:720,rechargeMm:0}],demand,schedule);
 const half=rootZoneTimingAtDay(r.interval,90/1440);close(half.rechargeMm,3);close(half.balanceErrorMm,0);
 const before=rootZoneTimingAtDay(r.latePulse,.5-1e-8);assert.equal(before.rechargeMm,0);
 const boundary=rootZoneTimingAtDay(r.latePulse,.5);close(boundary.rechargeMm,12);close(boundary.balanceErrorMm,0);
 const after=rootZoneTimingAtDay(r.interval,.5+3.25);close(after.rechargeMm,12);close(after.balanceErrorMm,0);
 assert.throws(()=>rootZoneTimingAtDay(r.interval,-1));
});
test('native original per-cell trace matches full infiltration and retains a partial final interval',()=>{
 const p=makeExample();p.weather.durationMinutes=13;p.weather.stormMinutes=7;
 const run=runRain(p.existing,p.width,p.height,p.weather,{traceBudget:true,rainTrace:{sourceCells:p.existing.map((_,i)=>i),captureSteps:true}});
 const r=originalRechargeIntervals(run,p,27);assert.equal(r.intervals.length,3);assert.equal(r.intervals.at(-1).endMinute,13);
 close(r.rechargeMm,run.waterBudget.cells[27].absorbedLiters/4);close(r.intervals.reduce((s,v)=>s+v.rechargeMm,0),r.rechargeMm);
 const wet=structuredClone(run);wet.snapshots[0].depthsMm[0]=1;assert.throws(()=>originalRechargeIntervals(wet,p,27),/initially dry/);
 const incomplete=structuredClone(run);incomplete.rainTrace.snapshots.at(-1).absorbedByCellLiters[0]+=1;assert.throws(()=>originalRechargeIntervals(incomplete,p,27),/complete original infiltration/);
});
test('actual paired native course changes timing while retaining source budgets and water accounts',()=>{
 const p=makeExample();p.weather.durationMinutes=720;p.weather.stormMinutes=30;const before=JSON.stringify(p),s=study();
 const r=compareRootZoneTiming(p,s,demand);assert.equal(JSON.stringify(p),before);
 close(r.existing.interval.event.availableMm,4.021304911332183);close(r.proposal.interval.event.availableMm,13.896614767413665);
 close(r.proposal.latePulse.event.availableMm,18);assert.ok(r.proposal.interval.event.drainageMm<r.proposal.latePulse.event.drainageMm);
 for(const side of ['existing','proposal'])for(const kind of ['interval','latePulse']){
  const profile=r[side][kind];close(profile.event.rechargeMm,r[side].originalBudget.absorbedLiters/r.cellAreaM2);
  for(const day of [0,.1,.5,1.5,profile.totalDays]){const q=rootZoneTimingAtDay(profile,day);close(q.balanceErrorMm,0);assert.ok(q.availableMm>=0&&q.availableMm<=profile.capacityMm);}
 }
});
test('strict source-only save and reopen preserve inputs and reject forged conclusions',()=>{
 const p=makeExample(),s=study(),text=serializeRootZoneTiming(p,s,demand),opened=parseRootZoneTiming(text);
 assert.deepEqual(opened,{schema:'experimental-earth-root-zone-timing-investigation/1',project:p,study:s,demand});
 assert.throws(()=>parseRootZoneTiming(JSON.stringify({...opened,event:{availableMm:999}})),/saved conclusions/);
 assert.throws(()=>parseRootZoneTiming(JSON.stringify({...opened,demand:{...demand,rechargeMm:4}})),/Declare event/);
 assert.throws(()=>serializeRootZoneTiming(p,s,{potentialTranspirationMmPerDay:2,source:''}),/Declare event/);
});
test('paired retained-trace work is refused before running oversized native sources',()=>{
 const p=makeExample();p.width=p.height=24;p.existing=Array.from({length:576},()=>({...p.existing[0]}));p.proposal=structuredClone(p.existing);p.weather.durationMinutes=720;p.weather.stepMinutes=1;
 assert.throws(()=>validateRootZoneTiming(p,study(),demand),/retained cell-step budget|cell-step water-budget limit/);
 assert.throws(()=>runRootZoneTiming(root,[{startMinute:1,endMinute:2,rechargeMm:1}],demand,schedule),/contiguous/);
});
