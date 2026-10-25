import { compareOutletResolution } from '../outlet-evidence-resolution.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain, validateProject } from '../core.js';
import { appendOutletReading, compareOutletEvidence, cumulativeExitAt, predictCollectedVolume, OUTLET_WORK_LIMIT } from '../outlet-evidence.js';
import { outletContext } from '../outlet-evidence-contract.js';

function site() {
  const project = makeExample();
  project.width = 2; project.height = 2; project.selectedIndex = 0;
  project.existing = Array.from({length: 4}, () => ({elevationM: 0, surface: 'sealed', provenance: 'authored flat control'}));
  project.proposal = structuredClone(project.existing);
  project.weather = { ...project.weather, rainMmHr: 61, stormMinutes: 60, durationMinutes: 60,
    stepMinutes: 30, cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0.38 };
  return project;
}
const settings = {target: 'existing', eventRef: 'Authored arithmetic control, not a measured event',
  coverage: 'all-modeled-edges', collectionSource: 'Analytic total of all four cells, two exterior sides each', ratesPerHour: [0, 0.1, 0.2]};
const reading = {startMinute: 0, endMinute: 30, volume: 16, uncertainty: 0, unit: 'L',
  source: 'Authored analytic 4 × (30 + 10) × 0.1 × 0.5 × 2 = 16 L', use: 'calibration'};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} versus ${expected}`);


 test('refinement preserves original windows and agrees with independent direct comparisons', () => {
 const p = appendOutletReading(site(), settings, {...reading,startMinute:7,endMinute:37});
 const original = structuredClone(p); const r = compareOutletResolution(p);
 assert.equal(r.status,'computed'); assert.deepEqual(r.steps,[30,15,7.5]);
 for (const [i,step] of r.steps.entries()) { const q=structuredClone(p);q.weather.stepMinutes=step;assert.deepEqual(r.reports[i],compareOutletEvidence(q)); }
 assert.deepEqual(p,original);
 });
 test('original analytic volume is not preserved artificially by refinement', () => {
 const p=appendOutletReading(site(),settings,reading); const r=compareOutletResolution(p);
 close(r.reports[0].candidates.find(c=>c.ratePerHour===0.1).calibration.errors[0].volumeLiters,16);
 assert.ok(r.changedSets.includes('compatibleRatesPerHour'));
 });
 test('held aside values cannot alter per-step calibration', () => {
 let p=appendOutletReading(site(),settings,reading);p=appendOutletReading(p,settings,{...reading,use:'challenge'});
 const before=compareOutletResolution(p);p.outletEvidence.readings[1].volume=999;
 const after=compareOutletResolution(p);
 assert.deepEqual(before.reports.map(r=>r.candidates.map(c=>c.calibration)),after.reports.map(r=>r.candidates.map(c=>c.calibration)));
 });
 test('complete preflight refuses stale contexts, minimum and missing calibration', () => {
 const p=appendOutletReading(site(),settings,reading);p.weather.stepMinutes=1;
 assert.equal(compareOutletResolution(p).status,'minimum-step');p.weather.stepMinutes=1.5;
 assert.deepEqual(compareOutletResolution(p).steps,[1.5,1]);
 p.outletEvidence.readings[0].use='challenge';assert.equal(compareOutletResolution(p).status,'need-calibration');
 p.weather.rainMmHr=40;assert.equal(compareOutletResolution(p).status,'context-changed');
 });
test('aggregate budget refuses although each individual interval is admissible', () => {
 const p=site();p.width=24;p.height=24;p.existing=Array.from({length:576},()=>({...p.existing[0]}));p.proposal=structuredClone(p.existing);
 p.weather.durationMinutes=720;p.weather.stepMinutes=4;
 const rates=[0,0.1,0.2,0.3];const q=appendOutletReading(p,{...settings,ratesPerHour:rates},reading);
 const r=compareOutletResolution(q);assert.equal(r.status,'work-limit');assert.deepEqual(r.reports,[]);
 assert.ok(576*720*rates.length<=OUTLET_WORK_LIMIT);assert.ok(r.cellSteps>OUTLET_WORK_LIMIT);
});
