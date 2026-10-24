import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample } from '../core.js';
import { compareIntervention } from '../intervention-study.js';
function fixture() {
 const p = makeExample(); p.width = p.height = 2; p.selectedIndex = 0;
 p.existing = Array.from({length:4},()=>({elevationM:0,surface:'turf',provenance:'analytic authored control'}));
 p.proposal = p.existing.map(c=>({...c,surface:'garden'}));
 Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:60,mobilityPerHour:0,boundaryExitPerHour:0,cellSizeM:1});
 p.infiltrationStudy = {target:'existing',surface:'turf',ratesMmHr:[10,24,28]}; return p;
}
test('analytic paired intervention reverses, retaining per-rate effects and local harm',()=>{
 const p=fixture(), original=structuredClone(p), r=compareIntervention(p);
 assert.equal(r.metrics.storedLiters.direction,'reverses');
 assert.ok(Math.abs(r.metrics.storedLiters.min+56)<1e-8); assert.ok(Math.abs(r.metrics.storedLiters.max-16)<1e-8);
 assert.deepEqual(r.affected,{existing:4,proposal:0}); assert.equal(r.cells.length,4);
 assert.equal(r.cells[0].direction,'reverses'); assert.deepEqual(p,original);
 for(const c of r.candidates) for(const e of Object.values(c.massErrorLiters)) assert.ok(Math.abs(e)<1e-8);
});
test('identical plans have exactly zero effects even across hypotheses',()=>{
 const p=fixture();p.proposal=structuredClone(p.existing); const r=compareIntervention(p);
 assert.equal(r.cells.length,0); for(const m of Object.values(r.metrics))assert.equal(m.direction,'unchanged');
});
test('explicit evidence filters require readings and never fall back to closest',()=>{
 const p=fixture();assert.equal(compareIntervention(p,{subset:'calibration'}).status,'need-calibration');
 p.observations=[{cellIndex:0,minute:60,depthMm:20,uncertaintyMm:.01,source:'authored analytic control',scenario:'existing',use:'calibration'}];
 assert.deepEqual(compareIntervention(p,{subset:'calibration'}).candidates.map(c=>c.rateMmHr),[10]);
 assert.equal(compareIntervention(p,{subset:'surviving'}).status,'need-challenge');
 p.observations.push({...p.observations[0],depthMm:0,use:'challenge'});
 assert.equal(compareIntervention(p,{subset:'surviving'}).status,'no-compatible-rates');
 assert.deepEqual(compareIntervention(p,{subset:'calibration'}).candidates.map(c=>c.rateMmHr),[10]);
 assert.equal(compareIntervention(p).candidates.length,3);
});
test('proposal-target evidence selects without changing pairing semantics',()=>{
 const p=fixture();p.infiltrationStudy.target='proposal';p.infiltrationStudy.surface='garden';
 p.observations=[{cellIndex:0,minute:60,depthMm:2,uncertaintyMm:.01,source:'authored',scenario:'proposal',use:'calibration'}];
 const r=compareIntervention(p,{subset:'calibration'});assert.deepEqual(r.candidates.map(c=>c.rateMmHr),[28]);assert.ok(r.metrics.storedLiters.max<0);
});
test('absence and dry storm do not invent a benefit',()=>{
 const p=fixture();p.infiltrationStudy.surface='sealed';assert.equal(compareIntervention(p).status,'surface-absent');
 p.infiltrationStudy.surface='turf';p.weather.rainMmHr=0;assert.equal(compareIntervention(p).metrics.storedLiters.direction,'unchanged');
});
test('bounded work and malformed selections refuse before simulation',()=>{
 const p=fixture();assert.throws(()=>compareIntervention(p,{subset:'best'}),/Unknown/);
 p.width=p.height=24;p.existing=Array.from({length:576},()=>({...p.existing[0]}));p.proposal=structuredClone(p.existing);
 p.weather.durationMinutes=720;p.weather.stepMinutes=1;assert.throws(()=>compareIntervention(p),/budget/);
});
test('site storage improvement does not hide a locally deeper cell',()=>{
 const p=fixture(); p.infiltrationStudy.ratesMmHr=[10,11];p.proposal[0].surface='sealed';
 const r=compareIntervention(p);assert.equal(r.metrics.storedLiters.direction,'lower');
 assert.equal(r.cells.length,1);assert.equal(r.cells[0].cellIndex,0);
 assert.equal(r.cells[0].direction,'higher');assert.ok(Math.abs(r.cells[0].min-9)<1e-8);
});
test('unassigned or different-scenario readings cannot narrow hypotheses',()=>{
 const p=fixture();p.observations=[{cellIndex:0,minute:60,depthMm:20,uncertaintyMm:.01,source:'authored',scenario:'proposal',use:'calibration'}, {cellIndex:1,minute:60,depthMm:20,uncertaintyMm:.01,source:'legacy'}];
 assert.equal(compareIntervention(p,{subset:'calibration'}).status,'need-calibration');
 assert.equal(compareIntervention(p).candidates.length,3);
});

test('explicit absent-surface all-rate evaluation preserves the default refusal and identity',()=>{
 const p=fixture();p.infiltrationStudy.surface='sealed';const before=structuredClone(p);
 assert.equal(compareIntervention(p).status,'surface-absent');
 const r=compareIntervention(p,{allowAbsentSurface:true});assert.equal(r.status,'compared');assert.deepEqual(r.affected,{existing:0,proposal:0});
 assert.equal(r.candidates.length,3);for(const c of r.candidates)assert.deepEqual(c.metrics,r.candidates[0].metrics);
 assert.deepEqual(p,before);
 for(const subset of ['calibration','surviving'])assert.throws(()=>compareIntervention(p,{subset,allowAbsentSurface:true}),/cannot filter evidence/);
 assert.throws(()=>compareIntervention(p,{allowAbsentSurface:'yes'}),/explicit boolean/);
});
