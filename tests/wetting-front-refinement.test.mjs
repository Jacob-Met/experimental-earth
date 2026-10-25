import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample,runRain,interpolateDepth} from '../core.js';
import {searchSoilParameters,soilSearchSelection} from '../wetting-front-search.js';
import {refineSoilParameters,serializeSoilRefinement,parseSoilRefinement} from '../wetting-front-refinement.js';
import {fixture} from './wetting-front-refinement-fixture.mjs';
test('automatic proposals recover off-grid compatibility without inventing supporting readings',()=>{
 const {p,q}=fixture(),before=JSON.stringify(p),coarse=searchSoilParameters(p,q),r=refineSoilParameters(p,q);
 assert.equal(coarse.compatibleIds.length,0);assert.ok(r.compatibleIds.length>0,JSON.stringify(r.candidates[0]));assert.ok(r.candidates[0].calibration.rmseMm<coarse.candidates[0].calibration.rmseMm/20);
 assert.equal(r.coarseCount,9);assert.ok(r.addedCount<=600);assert.equal(JSON.stringify(p),before);
 for(const original of coarse.candidates)assert.deepEqual(r.candidates.find(c=>c.id===original.id),{...original,origin:'declared-grid'});
 for(const c of r.candidates)assert.ok(Math.abs(c.massErrorLiters)<1e-9);
 const selected=soilSearchSelection(r,r.candidates.slice(0,2).map(c=>c.id));assert.equal(selected.hypotheses.length,2);
});
test('unfamiliar off-grid parameters and original off-step times improve against baseline',()=>{for(const [k,a] of [[12.7,13.4],[23.1,3.7],[18.9,16.1]]){const {p,q}=fixture(k,a),b=searchSoilParameters(p,q),r=refineSoilParameters(p,q);assert.ok(r.candidates[0].calibration.rmseMm<b.candidates[0].calibration.rmseMm/10);assert.ok(r.compatibleIds.length,`${k},${a}: ${r.candidates[0].calibration.rmseMm}`);}});
test('held aside values never steer proposal locations or calibration ranking',()=>{const {p,q}=fixture();p.observations[2].use='challenge';const a=refineSoilParameters(p,q);p.observations[2].depthMm=1000;const b=refineSoilParameters(p,q);const projection=r=>r.candidates.map(c=>[c.id,c.conductivityMmHr,c.capillaryDriveMm,c.calibration]);assert.deepEqual(projection(a),projection(b));assert.deepEqual(a.compatibleIds,b.compatibleIds);assert.ok(b.candidates.every(c=>!c.challenge.compatible));});
test('dry ambiguity and impossible evidence never become unique successful inference',()=>{const {p,q}=fixture();p.weather.rainMmHr=0;p.observations.forEach(r=>r.depthMm=0);const dry=refineSoilParameters(p,q);assert.equal(dry.compatibleIds.length,dry.candidates.length);assert.equal(dry.closestIds.length,dry.candidates.length);p.observations[0].depthMm=100;const rejected=refineSoilParameters(p,q);assert.equal(rejected.status,'calibration-rejected');assert.deepEqual(rejected.compatibleIds,[]);});
test('original-only file replays, source absence and work limits are explicit',()=>{const {p,q}=fixture();const saved=serializeSoilRefinement(p,q),reopened=parseSoilRefinement(saved);assert.deepEqual(refineSoilParameters(reopened.project,reopened.query),refineSoilParameters(p,q));assert.throws(()=>parseSoilRefinement(JSON.stringify({...JSON.parse(saved),results:[]})),/inputs/);p.observations=[];assert.equal(refineSoilParameters(p,q).status,'need-calibration');const large=makeExample();large.weather.durationMinutes=720;large.weather.stepMinutes=1;assert.throws(()=>refineSoilParameters(large,q),/reserved cell-steps/);});
test('actual routed courtyard reveals a narrow compatible family missed by coarse values',()=>{
 const p=makeExample(),q={target:'existing',surface:'turf',basis:'Authored routed control',conductivity:{min:5,max:25,count:3},drive:{min:0,max:40,count:3}};
 const truth=runRain(p.existing,p.width,p.height,p.weather,{surfaceWettingFront:{surface:'turf',conductivityMmHr:13.7,capillaryDriveMm:11.3}});
 p.observations=[[10,30],[21,60],[35,90]].map(([cellIndex,minute])=>({cellIndex,minute,depthMm:interpolateDepth(truth,cellIndex,minute).depthMm,uncertaintyMm:.05,scenario:'existing',use:'calibration',source:'Authored routed source, not field readings',method:'ruler'}));
 const coarse=searchSoilParameters(p,q),refined=refineSoilParameters(p,q);
 assert.equal(coarse.compatibleIds.length,0);assert.ok(refined.compatibleIds.length>0);assert.ok(refined.candidates[0].calibration.rmseMm<1e-5);assert.ok(refined.candidates.length<300);
});
test('independent constant-infiltration water balance supports an off-grid rate at the zero-drive boundary',()=>{
 const {p,q}=fixture();p.observations=[15,35,55].map(minute=>({cellIndex:0,minute,depthMm:(50-17.3)*minute/60,uncertaintyMm:.001,scenario:'existing',use:'calibration',source:'Independent authored water balance: depth=(rain−K)×hours, closed flat field, A=0',method:'ruler'}));
 const coarse=searchSoilParameters(p,q),r=refineSoilParameters(p,q);assert.equal(coarse.compatibleIds.length,0);assert.ok(r.compatibleIds.length);assert.ok(r.candidates[0].calibration.rmseMm<1e-5);assert.ok(r.candidates.some(c=>c.calibration.compatible&&c.boundary));
});
