import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {runRootZone,rootZoneAtDay} from '../root-zone.js';
import {serializeRootZoneInvestigation,parseRootZoneInvestigation} from '../root-zone-study.js';
import {compareRootZoneFactors,rootZoneFactorsAtDay,ROOT_ZONE_FACTOR_CASES,ROOT_ZONE_FACTOR_METRICS} from '../root-zone-factors.js';
const near=(a,b,t=2e-11)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),a+' versus '+b);
const study=()=>{const r={fieldCapacity:.3,wiltingPoint:.12,initialAvailableMm:10,depletionFraction:.5,source:'Authored root declaration'};
 return {schema:'experimental-earth-root-zone-study/1',cellIndex:27,rechargeBasis:'modeled-event-infiltration-pulse',associationSource:'Authored complete pulse association',
 existing:{...r,rootDepthM:.25},proposal:{...r,rootDepthM:.6},schedule:[{durationDays:7,potentialTranspirationMmPerDay:4,source:'Authored 4 mm/day'},{durationDays:7,potentialTranspirationMmPerDay:5,source:'Authored 5 mm/day'}]};};

test('each crossed case uses the entire attributed store and one unchanged original recharge',()=>{
 const project=makeExample(),s=study(),before=JSON.stringify({project,s}),r=compareRootZoneFactors(project,s);
 for(const spec of ROOT_ZONE_FACTOR_CASES){const c=r.factors.cases[spec.id],direct=runRootZone(s[spec.store],r[spec.recharge].rechargeMm,s.schedule);
  for(const key of Object.keys(direct))assert.deepEqual(c.result[key],direct[key]);
  assert.deepEqual(c.result.originalBudget,r[spec.recharge].originalBudget);
  assert.deepEqual(c.result.originalCell,project[spec.recharge][s.cellIndex]);
 }
 assert.equal(r.cellSteps,2*project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes));
 assert.equal(JSON.stringify({project,s}),before);
});
test('authored dry spell exposes drainage interaction and the contrary store-only transpiration change',()=>{
 const r=compareRootZoneFactors(makeExample(),study()),e=r.factors.end;
 for(const [id,n]of Object.entries({existing:.8513408767530515,rechargeOnly:3.719224984985697,storeOnly:4.359645134804369,combined:29.18023812498028}))near(e.cases[id].availableMm,n);
 near(e.cases.rechargeOnly.drainageMm,38.76341348078462);
 near(e.effects.availableMm.interaction,21.95270888194327);
 near(e.effects.drainageMm.interaction,-38.76341348078462);
 assert.ok(e.effects.suppliedMm.storeOnly<0);
 assert.ok(e.effects.suppliedMm.combined>e.effects.suppliedMm.rechargeOnly);
});
test('identical store declarations remove every store effect and interaction',()=>{
 const p=makeExample(),s=study();s.proposal=structuredClone(s.existing);const r=compareRootZoneFactors(p,s);
 for(const d of [0,1,7,10,14])for(const e of Object.values(rootZoneFactorsAtDay(r,d).effects)){assert.equal(e.storeOnly,0);assert.equal(e.interaction,0);near(e.combined,e.rechargeOnly);}
});
test('identical recharge removes every recharge effect without erasing differences in initial water',()=>{
 const p=makeExample(),s=study();p.proposal=structuredClone(p.existing);s.proposal.initialAvailableMm=60;s.proposal.depletionFraction=.8;
 const r=compareRootZoneFactors(p,s);
 assert.equal(r.factors.cases.storeOnly.result.initialAvailableMm,60);
 assert.equal(r.factors.cases.storeOnly.result.root.depletionFraction,.8);
 assert.ok(r.factors.end.effects.availableMm.storeOnly!==0);
 for(const d of [0,.7,7,14])for(const e of Object.values(rootZoneFactorsAtDay(r,d).effects)){assert.equal(e.rechargeOnly,0);assert.equal(e.interaction,0);near(e.combined,e.storeOnly);}
});
test('all four exact histories and interaction retain time-local conservation and the additive identity',()=>{
 const r=compareRootZoneFactors(makeExample(),study());
 for(const d of [0,.1,3,7,7.00001,9.5,14]){const at=rootZoneFactorsAtDay(r,d);
  for(const spec of ROOT_ZONE_FACTOR_CASES){const row=at.cases[spec.id],direct=rootZoneAtDay(r.factors.cases[spec.id].result,d);
   near(row.availableMm,direct.availableMm);near(row.suppliedMm,direct.suppliedMm);
   near(row.initialAvailableMm+row.rechargeMm,row.drainageMm+row.suppliedMm+row.availableMm);
   near(row.balanceErrorMm,0);
  }
  for(const key of ROOT_ZONE_FACTOR_METRICS){const e=at.effects[key];near(e.combined,e.rechargeOnly+e.storeOnly+e.interaction);}
  near(at.effects.availableMm.interaction+at.effects.suppliedMm.interaction+at.effects.drainageMm.interaction,0);
 }
 near(rootZoneFactorsAtDay(r,0).effects.availableMm.interaction,38.76341348078462);
});
test('source-only files recompute all crossed cases, refuse derived assertions, and isolate returned provenance',()=>{
 const p=makeExample(),s=study(),text=serializeRootZoneInvestigation(p,s),opened=parseRootZoneInvestigation(text),r=compareRootZoneFactors(p,s);
 assert.deepEqual(compareRootZoneFactors(opened.project,opened.study),r);
 assert.equal(text.includes('interaction'),false);
 assert.throws(()=>parseRootZoneInvestigation(JSON.stringify({...opened,factors:r.factors})),/conclusions/);
 r.factors.cases.rechargeOnly.result.originalCell.surface='forged';
 assert.notEqual(p.proposal[s.cellIndex].surface,'forged');
 assert.notEqual(r.proposal.originalCell.surface,'forged');
});
test('changed forcing is recomputed and invalid days or missing original declarations refuse',()=>{
 const p=makeExample(),s=study();s.schedule.forEach(x=>x.potentialTranspirationMmPerDay=0);
 const r=compareRootZoneFactors(p,s);for(const row of Object.values(r.factors.end.cases)){assert.equal(row.suppliedMm,0);assert.equal(row.unmetMm,0);assert.equal(row.demandLimitedDays,0);}
 for(const day of [-1,15,NaN,Infinity,'2'])assert.throws(()=>rootZoneFactorsAtDay(r,day));
 assert.throws(()=>rootZoneFactorsAtDay({},0));
 s.proposal.source='';assert.throws(()=>compareRootZoneFactors(p,s));
});

