import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeReceivingAccountExample,inspectReceivingAccounts,serializeReceivingAccounts,parseReceivingAccounts} from '../receiving-account-evidence.js';

const run=e=>inspectReceivingAccounts(e.project,e.study,e.account),clone=x=>structuredClone(x);
const close=(x,y)=>assert.ok(Math.abs(x-y)<1e-8,JSON.stringify({x,y}));
const proof={schema:'experimental-earth-receiving-account-native/1',checks:[],limits:'Authored controls; numerical guards are not measurement calibration or certified error bounds; receiver totals are not point soil probes or surface outlet collections.'};

test('equal surface courses separate in complete receiving accounts against independent analytic totals',()=>{
  const e=makeReceivingAccountExample(),before=clone(e),r=run(e);
  assert.equal(r.status,'ambiguous');assert.equal(r.surfaceOnlyQuestion.status,'no-separation');
  assert.deepEqual(r.compatibleIds,['initial-water','empty-fit']);assert.equal(r.footprint.areaM2,4);assert.deepEqual(r.footprint.cellIndices,[0,1,2,3]);
  assert.equal(r.question.status,'question');assert.equal(r.question.best.id,'retained-180');
  for(const h of e.study.hypotheses){
    const q=h.drainagePerHour*h.capacityMm,tf=Math.log((24-h.drainagePerHour*h.initialStoredMm)/(24-q))/h.drainagePerHour;
    const stored=h.capacityMm*4,drained=(h.initialStoredMm+24*tf+q*(3-tf)-h.capacityMm)*4;
    close(r.question.offers[0].predictions.find(p=>p.id===h.id).modeledLiters,stored);
    close(r.question.offers[1].predictions.find(p=>p.id===h.id).modeledLiters,drained);
  }
  assert.deepEqual(e,before);
  proof.control={surfaceStatus:r.surfaceOnlyQuestion.status,footprint:r.footprint,offers:r.question.offers};
  proof.checks.push('Independent full-store mass account agrees for both surface-equivalent explanations; explicit retained/drained offers separate them');
});

test('held-aside receiver values challenge without refitting, reranking support or choosing questions',()=>{
  const e=makeReceivingAccountExample();
  e.account.readings=[{id:'retained-check',channel:'retained',minute:180,valueLiters:29.2,uncertaintyLiters:.1,use:'challenge',source:'Authored retained-water held-aside control across the declared footprint'}];
  const a=run(e);assert.equal(a.status,'one-survivor');assert.deepEqual(a.survivingIds,['initial-water']);
  assert.equal(a.question.offers[0].status,'already-recorded');assert.equal(a.question.best.id,'drained-180');
  e.account.readings[0].valueLiters=17.94110474899122;const b=run(e);
  assert.deepEqual(b.compatibleIds,a.compatibleIds);assert.deepEqual(b.survivingIds,['empty-fit']);assert.deepEqual(b.question,a.question);
  assert.deepEqual(b.candidates.map(c=>c.hypothesis),a.candidates.map(c=>c.hypothesis));
  proof.checks.push('A changed original held-aside inventory changes only challenge compatibility; candidate parameters, calibration support and offered-question choice remain fixed');
});

test('calibration uses all original bands, never restores a rejected family, and can use independently sourced receiver readings',()=>{
  const e=makeReceivingAccountExample();
  const reading={id:'retained-calibration',channel:'retained',minute:180,valueLiters:29.2,uncertaintyLiters:.1,use:'calibration',source:'Authored calibration inventory'};
  e.account.readings=[reading];let r=run(e);assert.deepEqual(r.compatibleIds,['initial-water']);assert.equal(r.question.status,'no-supported-pair');
  e.account.readings.push({...reading,id:'contradictory-repeat',valueLiters:100});r=run(e);
  assert.equal(r.status,'calibration-rejected');assert.equal(r.candidates.length,2);assert.deepEqual(r.compatibleIds,[]);assert.equal(r.question.best,null);
  e.account.readings=[reading];e.project.observations=[];r=run(e);assert.deepEqual(r.compatibleIds,['initial-water']);assert.equal(r.status,'needs-challenge');
  e.account.readings=[];r=run(e);assert.equal(r.status,'need-calibration');assert.deepEqual(r.compatibleIds,[]);
  proof.checks.push('Every original calibration band constrains support, including contradictory repeated readings; no closest-fit fallback or unsupported no-calibration winner');
});

test('unavailable, zero-signal, overlapping and exactly touching prospective bands do not become useful questions',()=>{
  const e=makeReceivingAccountExample();e.account.offers=[];assert.equal(run(e).question.status,'no-offers');
  e.account.offers=[{id:'start-drain',channel:'drained',minute:0,uncertaintyLiters:0,basis:'Authored explicit offer at the original event start'}];
  let r=run(e);assert.equal(r.question.status,'no-separating-offer');assert.ok(r.question.offers[0].predictions.every(p=>p.modeledLiters===0));
  const normal=makeReceivingAccountExample(),difference=run(normal).question.offers[0].pairs[0].gapLiters;
  normal.account.offers=[{...normal.account.offers[0],uncertaintyLiters:difference/2}];assert.equal(run(normal).question.status,'no-separating-offer');
  normal.account.offers[0].uncertaintyLiters=100;assert.equal(run(normal).question.status,'no-separating-offer');
  const order=makeReceivingAccountExample();order.account.offers.reverse();assert.equal(run(order).question.best.id,'drained-180');
  proof.checks.push('No offers, zero cumulative drainage, touching/overlapping bands and stable original-order ties behave explicitly');
});

test('wrong footprint, unsupported timestamps, channel/role/source mistakes and complete work overflow refuse or remain contradicted',()=>{
  const e=makeReceivingAccountExample();
  e.account.readings=[{id:'original-inventory',channel:'retained',minute:180,valueLiters:29.2,uncertaintyLiters:.1,use:'calibration',source:'Authored original four-square-metre total'}];
  e.project.weather.cellSizeM=2;assert.equal(run(e).status,'calibration-rejected');
  const bad=makeReceivingAccountExample();bad.account.offers[0].minute=181;assert.throws(()=>run(bad),/exact retained solver endpoints/);
  for(const mutate of [x=>x.account.footprintBasis='',x=>x.account.offers[0].channel='surface-outlet',x=>x.account.offers[0].uncertaintyLiters=NaN,x=>x.account.offers[0].valueLiters=29.2,x=>x.account.offers[0].basis='',x=>x.account.offers[1].id=x.account.offers[0].id]){
    const x=makeReceivingAccountExample();mutate(x);assert.throws(()=>run(x));
  }
  const large=makeReceivingAccountExample();large.project.width=24;large.project.height=24;
  for(const target of ['existing','proposal'])large.project[target]=Array.from({length:576},()=>clone(large.project[target][0]));
  large.project.weather.stepMinutes=1;large.project.weather.durationMinutes=720;
  large.study.hypotheses.push({...large.study.hypotheses[0],id:'third',capacityMm:9,drainagePerHour:.2});
  assert.throws(()=>run(large),/complete original receiving family/);
  const absent=makeReceivingAccountExample();absent.project.proposal.forEach(c=>{c.surface='sealed';});assert.equal(run(absent).status,'surface-absent');
  proof.checks.push('Original footprint changes cannot silently preserve old inventory support; no invented interpolation, surface-outlet substitution, future values or partial over-budget comparison');
});

test('source-only file round-trip recomputes the same account and rejects saved results',()=>{
  const e=makeReceivingAccountExample(),text=serializeReceivingAccounts(e.project,e.study,e.account),opened=parseReceivingAccounts(text);
  assert.deepEqual(run(opened),run(e));assert.deepEqual(Object.keys(JSON.parse(text)).sort(),['account','project','schema','study']);
  const forged=JSON.parse(text);forged.result={status:'one-survivor'};assert.throws(()=>parseReceivingAccounts(JSON.stringify(forged)),/saved conclusions/);
  const wrong=JSON.parse(text);wrong.account.readings=[{id:'bad',channel:'retained',minute:180,valueLiters:3,uncertaintyLiters:0,use:'unassigned',source:'Authored role negative'}];assert.throws(()=>parseReceivingAccounts(JSON.stringify(wrong)));
  proof.checks.push('Strict original-input export/reopen is deterministic and rejects derived results or unassigned receiving roles');
});

test('proof records the complete executed groups and source identity',()=>{
  assert.equal(proof.checks.length,6);proof.passed=true;proof.sourceHashes={};
  for(const f of ['receiving-account-evidence.js','tests/receiving-account-evidence.test.mjs','draining-infiltration.js','draining-layer-evidence.js','core.js'])proof.sourceHashes[f]=createHash('sha256').update(readFileSync(new URL('../'+f,import.meta.url))).digest('hex');
  if(process.env.RECEIVING_ACCOUNT_RECEIPT){mkdirSync(new URL('../docs/receipts/receiving-accounts/',import.meta.url),{recursive:true});writeFileSync(process.env.RECEIVING_ACCOUNT_RECEIPT,JSON.stringify(proof,null,2)+'\n');}
});
