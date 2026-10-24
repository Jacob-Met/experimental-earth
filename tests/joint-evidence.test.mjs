import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, validateProject } from '../core.js';
import { appendOutletReading } from '../outlet-evidence.js';
import { prepareJointStudy, compareJointEvidence } from '../joint-evidence.js';
import { validateJointStudy, outletEventIdentity } from '../joint-evidence-contract.js';
const pairs=[{label:'Slow soil / slower outlet',infiltrationMmHr:1,outletPerHour:.1},{label:'Fast soil / faster outlet',infiltrationMmHr:21,outletPerHour:2/15}];
const settings={target:'existing',eventRef:'Authored ambiguity control, not measured',coverage:'all-modeled-edges',collectionSource:'Four 1 m² cells, two boundary sides each',ratesPerHour:[.1,2/15]};
const volume={startMinute:0,endMinute:30,volume:16,uncertainty:0,unit:'L',source:'Authored first-interval arithmetic',use:'calibration'};
const depth={cellIndex:0,minute:30,depthMm:26,uncertaintyMm:0,source:'Authored depth arithmetic',scenario:'existing',use:'challenge'};
function site(){const p=makeExample();p.width=2;p.height=2;p.selectedIndex=0;p.existing=Array.from({length:4},()=>({elevationM:0,surface:'sealed',provenance:'Authored flat control'}));p.proposal=structuredClone(p.existing);p.weather={...p.weather,rainMmHr:61,stormMinutes:60,durationMinutes:60,stepMinutes:30,cellSizeM:1,mobilityPerHour:0};return appendOutletReading(p,settings,volume);}
const save=(p,extra={})=>({...p,jointEvidenceStudy:prepareJointStudy(p,{surface:'sealed',pairs,...extra})});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} vs ${b}`);

test('different soil/outlet pairs explain exactly the same first volume',()=>{
 const r=compareJointEvidence(save(site()));assert.equal(r.status,'needs-challenge');assert.deepEqual(r.compatiblePairs,pairs.map(p=>p.label));
 for(const c of r.candidates){close(c.calibration.volume.errors[0].predicted,16);close(c.massErrorLiters,0);assert.equal(c.calibration.depth.rmse,null);}
 close(r.candidates[0].exitLiters,42.4);close(r.candidates[1].exitLiters,40.53333333333333);
});
test('explicitly associated held-aside depth distinguishes volume-equivalent pairs',()=>{
 const p=site();p.observations.push(depth);const r=compareJointEvidence(save(p,{depthIndices:[0],depthAssociation:'Same authored event/time origin'}));
 assert.equal(r.status,'one-survivor');assert.deepEqual(r.compatiblePairs,pairs.map(p=>p.label));assert.deepEqual(r.survivingPairs,[pairs[0].label]);
 close(r.candidates[0].challenge.depth.errors[0].predicted,26);close(r.candidates[1].challenge.depth.errors[0].predicted,16);assert.equal(r.candidates[0].challenge.volume.count,0);
});
test('a later held-aside collection distinguishes pairs without depth evidence',()=>{
 const p=appendOutletReading(site(),settings,{...volume,startMinute:30,endMinute:60,volume:26.4,use:'challenge'});const r=compareJointEvidence(save(p));
 assert.equal(r.status,'one-survivor');assert.deepEqual(r.survivingPairs,[pairs[0].label]);close(r.candidates[1].challenge.volume.errors[0].predicted,24.53333333333333);
});
test('held-aside changes never reorder pairs or change calibration evidence',()=>{
 const p=save(appendOutletReading(site(),settings,{...volume,startMinute:30,endMinute:60,volume:26.4,use:'challenge'}));const before=compareJointEvidence(p);
 p.outletEvidence.readings[1].volume=24.53333333333333;const after=compareJointEvidence(p);
 assert.deepEqual(after.candidates.map(c=>c.calibration),before.candidates.map(c=>c.calibration));assert.deepEqual(after.candidates.map(c=>c.label),before.candidates.map(c=>c.label));assert.deepEqual(after.survivingPairs,[pairs[1].label]);
 p.outletEvidence.readings[1].volume=1e8;assert.equal(compareJointEvidence(p).status,'challenged');
});
test('mixed modalities intersect bands and retain separate native-unit scores',()=>{
 const p=site();p.observations.push({...depth,depthMm:16,use:'calibration'});p.outletEvidence.readings[0].volume=16000;p.outletEvidence.readings[0].unit='mL';
 const r=compareJointEvidence(save(p,{depthIndices:[0],depthAssociation:'Declared same event'}));assert.deepEqual(r.compatiblePairs,[pairs[1].label]);
 assert.equal(r.candidates[0].calibration.depth.unit,'mm');assert.equal(r.candidates[0].calibration.volume.unit,'L');assert.equal(r.candidates[0].calibration.depth.rmse,10);close(r.candidates[0].calibration.volume.rmse,0);assert.equal(r.candidates[0].calibration.rmse,undefined);
 p.outletEvidence.readings[0].volume=1e6;assert.equal(compareJointEvidence(save(p)).status,'calibration-rejected');
});
test('unused, wrong-scenario and unassigned readings cannot silently enter evidence',()=>{
 const p=site();p.observations.push(depth,{...depth,depthMm:999,scenario:'proposal'},{...depth,depthMm:999,use:'unassigned'});p.outletEvidence.readings.push({...volume,volume:1e9,use:'unassigned'});
 const r=compareJointEvidence(save(p));assert.equal(r.counts.ignoredDepth,3);assert.equal(r.counts.ignoredVolume,1);assert.equal(r.candidates[0].challenge.count,0);
 for(const depthIndices of [[1],[2],[-1],[100],[0,0]])assert.throws(()=>save(p,{depthIndices,depthAssociation:'declared'}));assert.throws(()=>save(p,{depthIndices:[0]}));
 p.outletEvidence.readings[0].use='unassigned';assert.equal(compareJointEvidence(save(p,{depthIndices:[0],depthAssociation:'declared'})).status,'need-calibration');
});
test('changed event and selected source retire comparisons without discarding saved association',()=>{
 const p=site();p.observations.push(depth);const original=save(p,{depthIndices:[0],depthAssociation:'Declared association'});
 for(const mutate of [q=>q.weather.rainMmHr=62,q=>q.existing[0].elevationM=1,q=>q.outletEvidence.eventRef='another event',q=>delete q.outletEvidence]){const q=structuredClone(original);mutate(q);assert.equal(compareJointEvidence(q).status,'context-changed');assert.deepEqual(q.jointEvidenceStudy,original.jointEvidenceStudy);}
 for(const mutate of [q=>q.observations[0].source='another source',q=>q.observations[0].use='calibration',q=>q.observations[0].depthMm=16,q=>q.observations.shift()]){const q=structuredClone(original);mutate(q);assert.equal(compareJointEvidence(q).status,'depth-evidence-changed');}
 const q=structuredClone(original);q.title='renamed';q.proposal[0].elevationM=1;q.observations.push({...depth,source:'unselected later reading'});q.observations[0]=Object.fromEntries(Object.entries(q.observations[0]).reverse());assert.equal(compareJointEvidence(q).status,'one-survivor');
});
test('roundtrip recomputes evidence without changing project, rates or roles',()=>{
 const p=site();p.observations.push(depth);const saved=save(p,{depthIndices:[0],depthAssociation:'Declared association'}),before=JSON.stringify(saved);
 assert.deepEqual(compareJointEvidence(validateProject(JSON.parse(before))),compareJointEvidence(saved));assert.equal(JSON.stringify(saved),before);
 const q=structuredClone(saved);q.weather.stepMinutes=15;q.weather.boundaryExitPerHour=8;assert.notEqual(compareJointEvidence(q).status,'context-changed');assert.equal(q.weather.boundaryExitPerHour,8);
});
test('inconsistent imported collection duration refuses preparation and comparison',()=>{
 const p=site();p.outletEvidence.readings[0].endMinute=5;const saved=save(p);saved.outletEvidence.durationMinutes=5;
 validateProject(saved);assert.throws(()=>prepareJointStudy(saved,{surface:'sealed',pairs}));
 saved.jointEvidenceStudy.outletIdentity=outletEventIdentity(saved.outletEvidence);
 assert.equal(compareJointEvidence(saved).status,'context-changed');
});
test('pair limits, absent surfaces and work budget refuse misleading computation',()=>{
 for(const bad of [[],[pairs[0]],[pairs[0],pairs[0]],[pairs[0],{...pairs[1],label:pairs[0].label}],[pairs[0],{...pairs[1],outletPerHour:11}],[pairs[0],{...pairs[1],infiltrationMmHr:NaN}]])assert.throws(()=>save(site(),{pairs:bad}));
 assert.equal(compareJointEvidence(save(site(),{surface:'garden'})).status,'surface-absent');
 const p=site();delete p.outletEvidence;p.width=24;p.height=24;p.existing=Array.from({length:576},()=>structuredClone(p.existing[0]));p.proposal=structuredClone(p.existing);p.weather.stepMinutes=1;p.weather.durationMinutes=720;
 const large=save(appendOutletReading(p,settings,volume),{pairs:Array.from({length:12},(_,i)=>({label:`Pair ${i}`,infiltrationMmHr:i,outletPerHour:.1}))}),r=compareJointEvidence(large);
 assert.equal(r.status,'work-limit');assert.deepEqual(r.candidates,[]);assert.throws(()=>validateJointStudy({...large.jointEvidenceStudy,schema:'other'}));
});
