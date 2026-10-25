import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample, runRain} from '../core.js';
import {advanceRootZoneDry, validateRootZone, runRootZone, rootZoneAtDay} from '../root-zone.js';
import {compareRootZone, validateRootZoneStudy, serializeRootZoneInvestigation, parseRootZoneInvestigation, ROOT_ZONE_FILE_LIMIT} from '../root-zone-study.js';
const near=(a,b,t=2e-11)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),a+' versus '+b);
const root=(extra={})=>({fieldCapacity:.3,wiltingPoint:.1,rootDepthM:.5,initialAvailableMm:20,depletionFraction:.5,source:'Authored numerical control',...extra});
const schedule=(days=10,demand=5)=>[{durationDays:days,potentialTranspirationMmPerDay:demand,source:'Authored dry interval'}];
const study=p=>({schema:'experimental-earth-root-zone-study/1',cellIndex:27,rechargeBasis:'modeled-event-infiltration-pulse',
 associationSource:'Hypothetical full infiltration-to-root association; event pulse',existing:root(),proposal:root({rootDepthM:1}),schedule:schedule()});

test('capacity uses volumetric fractions, metres and millimetres; no surface lookup',()=>{
 const c=validateRootZone(root());near(c.capacityMm,100);near(c.readilyAvailableMm,50);near(c.stressThresholdMm,50);
});
test('wet-to-stressed transition agrees with independent two-phase solution',()=>{
 const a=advanceRootZoneDry({availableMm:80,capacityMm:100,depletionFraction:.5,demandMmPerDay:5,days:10});
 near(a.availableMm,50*Math.exp(-.4));near(a.suppliedMm,80-50*Math.exp(-.4));near(a.firstLimitedDay,6);near(a.demandLimitedDays,4);
 near(a.unmetMm,50-a.suppliedMm);
});
test('always-wet and already-stressed histories have distinct analytical controls',()=>{
 const a=advanceRootZoneDry({availableMm:100,capacityMm:100,depletionFraction:.5,demandMmPerDay:5,days:2});
 near(a.availableMm,90);near(a.suppliedMm,10);assert.equal(a.firstLimitedDay,null);
 const b=advanceRootZoneDry({availableMm:25,capacityMm:100,depletionFraction:.5,demandMmPerDay:5,days:10});
 near(b.availableMm,25/Math.E);near(b.demandLimitedDays,10);assert.equal(b.firstLimitedDay,0);
});
test('zero demand retains storage and never invents an unmet-demand period',()=>{
 const r=runRootZone(root({initialAvailableMm:0}),0,schedule(30,0));
 assert.equal(r.availableMm,0);assert.equal(r.unmetMm,0);assert.equal(r.firstLimitedDay,null);assert.equal(r.demandLimitedDays,0);
});
test('an empty store cannot meet positive demand',()=>{
 const r=runRootZone(root({initialAvailableMm:0}),0,schedule(4,3));
 assert.equal(r.suppliedMm,0);assert.equal(r.unmetMm,12);assert.equal(r.firstLimitedDay,0);assert.equal(r.demandLimitedDays,4);
});
test('instantaneous recharge retains only available capacity, with complete accounting',()=>{
 const r=runRootZone(root({initialAvailableMm:80}),50,schedule(1,0));
 near(r.retainedRechargeMm,20);near(r.drainageMm,30);near(r.availableMm,100);near(r.balanceErrorMm,0);
});
test('p endpoints are explicit exponential and linear-until-empty limits',()=>{
 const a=runRootZone(root({initialAvailableMm:100,depletionFraction:0}),0,schedule(10,5));near(a.availableMm,100*Math.exp(-.5));near(a.firstLimitedDay,0);
 const b=runRootZone(root({initialAvailableMm:20,depletionFraction:1}),0,schedule(10,5));near(b.availableMm,0);near(b.suppliedMm,20);near(b.unmetMm,30);near(b.firstLimitedDay,4);near(b.demandLimitedDays,6);
});
test('reaching the threshold only at final endpoint does not create limited duration',()=>{
 const a=advanceRootZoneDry({availableMm:80,capacityMm:100,depletionFraction:.5,demandMmPerDay:5,days:6});
 near(a.availableMm,50);assert.equal(a.firstLimitedDay,null);assert.equal(a.demandLimitedDays,0);
});
test('partitioning the same dry forcing preserves response across transitions',()=>{
 for(const p of [0,.2,.5,.9,1]) for(const initial of [0,10,50,99]) for(const demand of [0,.01,4,30]){
  const r=root({initialAvailableMm:initial,depletionFraction:p});
  const a=runRootZone(r,0,schedule(13,demand));
  const b=runRootZone(r,0,[.01,.19,.8,2,10].map(t=>schedule(t,demand)[0]));
  for(const key of ['availableMm','suppliedMm','unmetMm','demandLimitedDays'])near(a[key],b[key],1e-9);
 }
});
test('zero-demand gaps do not count as demand-limited and retain actual first onset',()=>{
 const r=runRootZone(root({initialAvailableMm:10}),0,[...schedule(3,0),...schedule(2,5),...schedule(7,0)]);
 near(r.firstLimitedDay,3);near(r.demandLimitedDays,2);near(rootZoneAtDay(r,2).availableMm,10);near(rootZoneAtDay(r,12).availableMm,r.availableMm);
});
test('arbitrary-time inspection uses the nonlinear solution and respects segment boundaries',()=>{
 const r=runRootZone(root({initialAvailableMm:80}),0,[...schedule(10,5),...schedule(3,2)]);
 near(rootZoneAtDay(r,8).availableMm,50*Math.exp(-.2));
 near(rootZoneAtDay(r,10).availableMm,r.snapshots[1].availableMm);
 near(rootZoneAtDay(r,13).availableMm,r.availableMm);
 assert.throws(()=>rootZoneAtDay(r,-1));assert.throws(()=>rootZoneAtDay(r,14));
});
test('capacity, nonnegativity and demand bounds hold over changed-input states',()=>{
 let seed=1234567;const rand=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
 for(let i=0;i<500;i++){
  const c=1+999*rand(), p=rand(), water=c*rand(), d=30*rand(), days=366*rand();
  const r=advanceRootZoneDry({availableMm:water,capacityMm:c,depletionFraction:p,demandMmPerDay:d,days});
  assert.ok(r.availableMm>=0&&r.availableMm<=water);assert.ok(r.suppliedMm>=0&&r.suppliedMm<=r.potentialMm+1e-12);
  near(water,r.availableMm+r.suppliedMm);near(r.potentialMm,r.suppliedMm+r.unmetMm);
  const wetter=advanceRootZoneDry({availableMm:c,capacityMm:c,depletionFraction:p,demandMmPerDay:d,days});
  assert.ok(wetter.availableMm+1e-11>=r.availableMm);assert.ok(wetter.suppliedMm+1e-11>=r.suppliedMm);
 }
});
test('composed recharge uses each original-cell infiltration and original square-metre area',()=>{
 const p=makeExample(), s=study(p), before=JSON.stringify({p,s});
 const a=compareRootZone(p,s);
 for(const side of ['existing','proposal']){
  const native=runRain(p[side],p.width,p.height,p.weather,{traceBudget:true});
  const liters=native.waterBudget.cells[s.cellIndex].absorbedLiters;
  near(a[side].rechargeMm,liters/4);assert.deepEqual(a[side].originalBudget,native.waterBudget.cells[s.cellIndex]);
  assert.deepEqual(a[side].originalCell,p[side][s.cellIndex]);near(a[side].balanceErrorMm,0);
 }
 assert.notEqual(a.existing.rechargeMm,a.proposal.rechargeMm);assert.equal(JSON.stringify({p,s}),before);
});
test('identical plans and soil assumptions preserve exact paired results',()=>{
 const p=makeExample();p.proposal=structuredClone(p.existing);const s=study(p);s.proposal=structuredClone(s.existing);
 const r=compareRootZone(p,s);assert.deepEqual(r.existing,r.proposal);assert.ok(Object.values(r.change).every(v=>v===0));
});
test('whole-event pulse is bounded independently of unmet transpiration demand',()=>{
 const p=makeExample(),s=study(p);s.existing=root({initialAvailableMm:99});
 const a=compareRootZone(p,s);assert.ok(a.existing.drainageMm>0);near(a.existing.retainedRechargeMm,1);
 assert.ok(a.existing.unmetMm>=0);near(a.existing.initialAvailableMm+a.existing.rechargeMm,a.existing.drainageMm+a.existing.suppliedMm+a.existing.availableMm);
});
test('source-only serialization replays unchanged source and refuses forged conclusions',()=>{
 const p=makeExample(),s=study(p),text=serializeRootZoneInvestigation(p,s),open=parseRootZoneInvestigation(text);
 assert.deepEqual(compareRootZone(open.project,open.study),compareRootZone(p,s));
 assert.throws(()=>parseRootZoneInvestigation(JSON.stringify({...open,result:{availableMm:999}})),/conclusions/);
 assert.throws(()=>parseRootZoneInvestigation(' '.repeat(ROOT_ZONE_FILE_LIMIT+1)),/limit/);
});
test('changing source or demand recomputes rather than trusting prior output',()=>{
 const p=makeExample(),s=study(p),a=compareRootZone(p,s);
 p.weather.rainMmHr=0;const b=compareRootZone(p,s);assert.equal(b.existing.rechargeMm,0);assert.notEqual(a.sourceSignature,b.sourceSignature);
 const t=structuredClone(s);t.schedule=schedule(10,0);const c=compareRootZone(p,t);assert.equal(c.existing.suppliedMm,0);
});
test('whole-course invalidity refuses before running the source model',()=>{
 const p=makeExample(),s=study(p);
 for(const change of [
  t=>{t.existing.source='';},t=>{t.existing.initialAvailableMm=101;},t=>{t.existing.fieldCapacity=.1;},
  t=>{t.proposal.depletionFraction=1.1;},t=>{t.schedule.push({...schedule(1)[0],source:''});},
  t=>{t.schedule[0].durationDays=367;},t=>{t.schedule[0].potentialTranspirationMmPerDay=NaN;},
  t=>{t.cellIndex=48;},t=>{t.rechargeBasis='observed';},t=>{t.associationSource='';},
  t=>{t.existing.derivedCapacityMm=100;},t=>{t.schedule=[];}
 ]){const t=structuredClone(s);change(t);assert.throws(()=>validateRootZoneStudy(p,t));}
});
test('maintained source-work limit rejects oversized model before numerical execution',()=>{
 const p=makeExample();p.width=24;p.height=24;p.existing=Array.from({length:576},()=>({...p.existing[0]}));p.proposal=structuredClone(p.existing);
 p.weather.durationMinutes=720;p.weather.stepMinutes=1;
 assert.throws(()=>compareRootZone(p,study(p)),/cell-step/);
});
