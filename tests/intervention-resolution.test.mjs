import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample } from '../core.js';
import { compareInterventionResolution as compare, MAX_INTERVENTION_RESOLUTION_CELL_STEPS } from '../intervention-resolution.js';

function analytic() {
  const p = makeExample(); p.width = p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({length:4}, () => ({elevationM:0, surface:'turf', provenance:'authored analytic control'}));
  p.proposal = p.existing.map(c => ({...c, surface:'garden'}));
  Object.assign(p.weather, {rainMmHr:30, stormMinutes:60, durationMinutes:60,
    stepMinutes:5, mobilityPerHour:0, boundaryExitPerHour:0, cellSizeM:1});
  p.infiltrationStudy = {target:'existing', surface:'turf', ratesMmHr:[10,24,28]};
  return p;
}
function sensitive() {
  const p = analytic();
  Object.assign(p.weather, {rainMmHr:67, stormMinutes:19, boundaryExitPerHour:1.91, mobilityPerHour:2.79});
  p.existing = [
    ['sealed',.031], ['garden',.04], ['turf',-.032], ['garden',.026],
  ].map(([surface,elevationM]) => ({surface,elevationM,provenance:'authored changed-step control'}));
  p.proposal = structuredClone(p.existing); p.proposal[3].elevationM=-.036;
  p.infiltrationStudy.ratesMmHr=[1,9,24];
  return p;
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);

test('analytic closed-edge, no-motion paired runoff stays invariant under changed step', () => {
  const project = analytic(), saved = structuredClone(project), r = compare(project);
  assert.equal(r.status,'compared');assert.deepEqual(r.stepsMinutes,[5,2.5,1.25]);
  assert.deepEqual(r.ratesMmHr,[10,24,28]);assert.deepEqual(r.directionChanges,[]);
  for(const c of r.candidates)for(const metric of Object.values(c.metrics)) {
    assert.equal(metric.changedSign,false);
    metric.deltas.forEach(d => close(d,metric.deltas[0]));
    close(metric.spread,0);
  }
  for(const run of r.runs) for(const c of run.candidates)
    for(const err of Object.values(c.massErrorLiters)) close(err,0);
  assert.deepEqual(project,saved, 'source observations, project and saved step must not change');
});

test('actual paired grid shows changed exit-benefit classification as step refines',()=>{
  const project=sensitive(), saved=structuredClone(project), r=compare(project);
  assert.equal(r.status,'compared'); assert.ok(r.directionChanges.includes('exitLiters'));
  assert.deepEqual(r.metrics.exitLiters.stepDirections,['reverses','reverses','lower-or-equal']);
  assert.deepEqual(r.metrics.exitLiters.changedCandidateSigns,[24]);
  const c=r.candidates.find(c=>c.rateMmHr===24).metrics.exitLiters;
  [0.2351689694497665,0.1396249972640078,0].forEach((d,i)=>close(c.deltas[i],d));
  assert.deepEqual(c.signs,[1,1,0]);assert.equal(c.changedSign,true);
  assert.ok(c.spread>0.23);
  assert.deepEqual(project,saved);
});

test('identical plans give zero effects at every step even with outflow',()=>{
  const p=sensitive();p.proposal=structuredClone(p.existing);
  const r=compare(p);assert.deepEqual(r.directionChanges,[]);
  for(const c of r.candidates) for(const metric of Object.values(c.metrics)) {
    assert.deepEqual(metric.deltas,[0,0,0]);assert.equal(metric.changedSign,false);
  }
});

test('strictly finer supported steps and solver minimum are explicit, never extrapolated',()=>{
  const p=analytic();p.weather.stepMinutes=1;
  const r=compare(p);assert.equal(r.status,'minimum-step');assert.deepEqual(r.stepsMinutes,[1]);
  assert.deepEqual(r.runs,[]);
  p.weather.stepMinutes=1.5;assert.deepEqual(compare(p).stepsMinutes,[1.5,1]);
  p.weather.stepMinutes=NaN;assert.throws(()=>compare(p),/parameters/);
});

test('missing intervention surface and too-large study refuse before any simulations',()=>{
  const p=analytic();p.infiltrationStudy.surface='sealed';
  assert.equal(compare(p).status,'surface-absent');
  p.infiltrationStudy.surface='turf';p.width=p.height=24;
  p.existing=Array.from({length:576},()=>({...p.existing[0]}));
  p.proposal=structuredClone(p.existing);p.weather.durationMinutes=720;p.weather.stepMinutes=1.1;
  p.infiltrationStudy.ratesMmHr=[1,2,3,4,5,6,7,8,9];
  const r=compare(p);assert.equal(r.status,'work-limit');assert.ok(r.estimatedCellSteps>MAX_INTERVENTION_RESOLUTION_CELL_STEPS);
  assert.deepEqual(r.runs,[]);assert.deepEqual(r.candidates,[]);
});

test('observations never reselect different rates as step changes',()=>{
  const p=sensitive();p.observations=[{cellIndex:0,minute:60,depthMm:999,
    uncertaintyMm:0,source:'deliberately contradictory independent evidence',scenario:'existing',use:'calibration'}];
  const a=compare(p);p.observations[0].depthMm=0;
  const b=compare(p);assert.deepEqual(a,b);
  assert.deepEqual(a.ratesMmHr,[1,9,24]);
  for(const run of a.runs)assert.deepEqual(run.candidates.map(c=>c.rateMmHr),[1,9,24]);
});
