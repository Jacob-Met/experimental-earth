import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, compare } from '../core.js';
import { mapObservations } from '../observation-map.js';

function fixture() {
  const p = makeExample();
  p.width = p.height = 2;
  p.existing = Array.from({length:4}, () => ({ elevationM:0, surface:'sealed', provenance:'authored test' }));
  p.proposal = structuredClone(p.existing); p.selectedIndex = 0;
  p.weather = { ...p.weather, rainMmHr:61, stormMinutes:10, durationMinutes:10, stepMinutes:5, mobilityPerHour:0, boundaryExitPerHour:0, cellSizeM:1 };
  return p;
}
const reading = (extra = {}) => ({cellIndex:0, minute:2.5, depthMm:2.5, uncertaintyMm:0, source:'Authored software control; not field evidence', scenario:'existing', use:'challenge', ...extra});

test('off-step evidence uses maintained interpolation, not nearest snapshot', () => {
  const p=fixture();p.observations=[reading()];
  const r=mapObservations(p,compare(p));
  assert.equal(r.cells[0].status,'within');
  const e=r.cells[0].readings[0];
  assert.equal(e.depthMm,2.5);assert.equal(e.beforeMinute,0);assert.equal(e.afterMinute,5);
  assert.equal(r.cells[1].status,'unobserved');
});
test('opposite signed residuals never cancel into agreement', () => {
  const p=fixture();p.observations=[reading({depthMm:1}),reading({depthMm:4})];
  const cell=mapObservations(p,compare(p)).cells[0];
  assert.equal(cell.status,'outside');assert.equal(cell.opposingMismatches,true);
  assert.deepEqual(cell.readings.map(r=>r.residualMm),[-1.5,1.5]);
  p.observations.push(reading());
  assert.equal(mapObservations(p,compare(p)).cells[0].status,'mixed');
});
test('scenario and evidence-role filters cannot silently relabel evidence', () => {
  const p=fixture();p.observations=[reading(),reading({use:'calibration'}),reading({scenario:'proposal'}),reading({scenario:'unassigned',use:'unassigned'}),reading({use:'unassigned'})];
  const before=JSON.stringify(p);const result=compare(p);
  const r=mapObservations(p,result,'existing','challenge');
  assert.equal(r.readingCount,1);assert.equal(r.excludedScenario,2);assert.equal(r.excludedRole,2);
  assert.equal(mapObservations(p,result,'proposal').readingCount,1);
  assert.equal(mapObservations(p,result,'existing','unassigned').readingCount,1);
  assert.equal(JSON.stringify(p),before);
  r.cells[0].readings[0].reading.source='changed derived copy';
  assert.equal(JSON.stringify(p),before);
});
test('changed rain and changed surface recompute real baseline disagreement', () => {
  const p=fixture();p.observations=[reading()];
  assert.equal(mapObservations(p,compare(p)).cells[0].status,'within');
  p.weather.rainMmHr=1;
  assert.equal(mapObservations(p,compare(p)).cells[0].readings[0].direction,'underprediction');
  p.weather.rainMmHr=61;p.existing[0].surface='garden';
  assert.equal(mapObservations(p,compare(p)).cells[0].status,'outside');
  assert.equal(mapObservations(p,compare(p)).cells[1].status,'unobserved');
});
test('zero tolerance, equality at band boundary and independent cell coverage', () => {
  const p=fixture();p.observations=[reading({depthMm:3.5,uncertaintyMm:1}),reading({cellIndex:1,depthMm:0})];
  const r=mapObservations(p,compare(p));
  assert.equal(r.cells[0].status,'within');assert.equal(r.cells[1].status,'outside');
  assert.equal(r.observedCells,2);assert.equal(r.mismatchedCells,1);
});
test('JSON reopen preserves sourced evidence and identical map classifications', () => {
  const p=fixture();p.observations=[reading({use:'calibration'}),reading({minute:7.5,depthMm:8,uncertaintyMm:.25})];
  const q=JSON.parse(JSON.stringify(p));
  assert.deepEqual(mapObservations(q,compare(q)),mapObservations(p,compare(p)));
});
test('empty evidence remains unknown and invalid filters refuse', () => {
  const p=fixture(), result=compare(p);
  assert.ok(mapObservations(p,result).cells.every(c=>c.status==='unobserved'));
  assert.throws(()=>mapObservations(p,result,'unassigned'),/scenario/);
  assert.throws(()=>mapObservations(p,result,'existing','best'),/role/);
});
