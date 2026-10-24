import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {appendOutletReading} from '../outlet-evidence.js';
import {prepareJointStudy} from '../joint-evidence.js';
import {makeJointEventChallenge,reopenJointEventChallenge} from '../joint-event-challenge.js';
const fixture=JSON.parse(await readFile(new URL('../examples/joint-evidence-ambiguity.json',import.meta.url),'utf8'));
const pairs=[{label:'Slow',infiltrationMmHr:1,outletPerHour:.1},{label:'Fast',infiltrationMmHr:21,outletPerHour:2/15}];
const independence='A separate authored event; no measured acquisition or independence claim';
const settings={target:'existing',eventRef:'Authored second storm',collectionSource:'Independent first-step arithmetic on same four cells',coverage:'all-modeled-edges',ratesPerHour:[.1,2/15]};
const reading={startMinute:0,endMinute:30,volume:12,unit:'L',uncertainty:0,source:'4 cells × (20+10) mm × 0.1/h × 0.5 h × 2 sides = 12 L',use:'challenge'};
function first(){const p=structuredClone(fixture);p.jointEvidenceStudy=prepareJointStudy(p,{surface:'sealed',pairs});return p;}
function second(){const p=structuredClone(fixture);delete p.outletEvidence;p.observations=[];p.weather.rainMmHr=41;return appendOutletReading(p,settings,reading);}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} vs ${b}`);
const bundle=(a=first(),b=second(),options={})=>makeJointEventChallenge(a,b,{independence,...options});

test('second rainfall challenges a volume-equivalent pair without retuning',()=>{
 const a=first(),b=second(),before=structuredClone({a,b}),r=reopenJointEventChallenge(bundle(a,b));
 assert.deepEqual(r.compatiblePairs,['Slow','Fast']);assert.deepEqual(r.survivingPairs,['Slow']);assert.equal(r.status,'one-survivor');
 for(const c of r.candidates)close(c.calibration.volume.errors[0].predicted,16);
 close(r.candidates[0].secondEvent.volume.errors[0].predicted,12);close(r.candidates[1].secondEvent.volume.errors[0].predicted,32/3);assert.deepEqual({a,b},before);
});
test('second values change rejection, never first calibration or pair order',()=>{
 const before=reopenJointEventChallenge(bundle()),b=second();b.outletEvidence.readings[0].volume=32/3;const after=reopenJointEventChallenge(bundle(first(),b));
 assert.deepEqual(after.candidates.map(c=>c.calibration),before.candidates.map(c=>c.calibration));assert.deepEqual(after.candidates.map(c=>c.label),['Slow','Fast']);assert.deepEqual(after.survivingPairs,['Fast']);
 b.outletEvidence.readings[0].volume=100;assert.equal(reopenJointEventChallenge(bundle(first(),b)).status,'challenged');
});
test('same-event held-aside contradictions still apply after a second event',()=>{
 const a=first();a.jointEvidenceStudy=prepareJointStudy(a,{surface:'sealed',pairs,depthIndices:[0],depthAssociation:'Authored common minute-zero origin'});const b=second();b.outletEvidence.readings[0].volume=32/3;
 const r=reopenJointEventChallenge(bundle(a,b));assert.deepEqual(r.compatiblePairs,['Slow','Fast']);assert.deepEqual(r.survivingPairs,[]);assert.equal(r.status,'challenged');
});
test('only explicitly associated second depth is scored in its own units',()=>{
 const b=second();b.outletEvidence.readings[0].use='unassigned';b.observations=[{cellIndex:0,minute:30,depthMm:17,uncertaintyMm:0,source:'Independent authored depth:20−3mm',scenario:'existing',use:'challenge'}];
 assert.throws(()=>bundle(first(),b),/associate held-aside/);
 const saved=bundle(first(),b,{depthIndices:[0],depthAssociation:'Same second event and time origin'}),r=reopenJointEventChallenge(saved);assert.deepEqual(r.survivingPairs,['Slow']);assert.equal(r.candidates[0].secondEvent.volume.rmse,null);close(r.candidates[0].secondEvent.depth.errors[0].predicted,17);
 saved.challengeProject.observations[0].source='Another source';assert.throws(()=>reopenJointEventChallenge(saved),/stale/);
});
test('calibration-assigned second evidence and absent first calibration refuse',()=>{
 for(const kind of ['volume','depth']){const b=second();if(kind==='volume')b.outletEvidence.readings[0].use='calibration';else b.observations=[{...fixture.observations[0],use:'calibration'}];assert.throws(()=>bundle(first(),b),/contains calibration evidence/);}
 const a=first();a.outletEvidence.readings[0].use='unassigned';assert.throws(()=>bundle(a),/first event needs assigned calibration/);
});
test('distinct declared events and compatible site/model assumptions are required',()=>{
 assert.throws(()=>bundle(first(),second(),{independence:''}),/independently held aside/);
 const same=second();same.outletEvidence.eventRef=fixture.outletEvidence.eventRef;assert.throws(()=>bundle(first(),same),/distinct event references/);
 for(const mutate of [p=>p.existing[0].elevationM=1,p=>p.weather.cellSizeM=2,p=>p.weather.mobilityPerHour=1,p=>p.weather.stepMinutes=15]){const b=second();mutate(b);assert.throws(()=>bundle(first(),b),/match|current observed site/);}
 const b=second();b.weather.boundaryExitPerHour=8;const r=reopenJointEventChallenge(bundle(first(),b));assert.deepEqual(r.survivingPairs,['Slow'],'the declared pair overrides each event default');
});
test('reopening refuses retuned, reordered and stale associations',()=>{
 for(const mutate of [p=>p.challengeStudy.pairs[0].outletPerHour=.2,p=>p.challengeStudy.pairs.reverse(),p=>p.challengeStudy.surface='garden']){const saved=bundle();mutate(saved);assert.throws(()=>reopenJointEventChallenge(saved),/without retuning/);}
 const saved=bundle();saved.challengeProject.outletEvidence.collectionSource='Changed collector';assert.throws(()=>reopenJointEventChallenge(saved),/stale/);
 const changed=bundle();changed.calibrationProject.weather.rainMmHr=62;assert.throws(()=>reopenJointEventChallenge(changed),/First-event association/);
});
test('portable raw bundle replays evidence and ignores fabricated conclusions',()=>{
 const saved=JSON.parse(JSON.stringify(bundle()));saved.result={status:'ambiguous',survivingPairs:['Fast']};const r=reopenJointEventChallenge(saved);assert.equal(r.status,'one-survivor');assert.deepEqual(r.survivingPairs,['Slow']);assert.throws(()=>reopenJointEventChallenge({...saved,schema:'unknown'}),/Unsupported/);
});
test('total two-event work is bounded before either event is simulated',()=>{
 const p=structuredClone(fixture);delete p.outletEvidence;p.observations=[];p.width=p.height=24;p.existing=Array.from({length:576},()=>structuredClone(fixture.existing[0]));p.proposal=structuredClone(p.existing);p.weather.stepMinutes=1;p.weather.durationMinutes=720;
 const a=appendOutletReading(p,{...settings,eventRef:'Large first'},{...reading,volume:16,use:'calibration'});a.jointEvidenceStudy=prepareJointStudy(a,{surface:'sealed',pairs:Array.from({length:12},(_,i)=>({label:`Pair${i}`,infiltrationMmHr:i,outletPerHour:.1}))});
 const b=appendOutletReading(p,{...settings,eventRef:'Large second'},reading),r=reopenJointEventChallenge(bundle(a,b));assert.equal(r.status,'work-limit');assert.deepEqual(r.candidates,[]);assert.ok(r.cellStepUpperBound>r.workLimit);
});
