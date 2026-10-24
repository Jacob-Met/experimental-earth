import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, compare } from '../core.js';
import { componentEditIndices, compareProposalComponents } from '../proposal-components.js';

function fixture() {
  const project = makeExample();
  project.width = 2; project.height = 2; project.selectedIndex = 0;
  project.existing = Array.from({ length: 4 }, () => ({ surface: 'sealed', elevationM: 0, provenance: 'authored control' }));
  project.proposal = structuredClone(project.existing);
  project.proposal[0].surface = 'garden'; project.proposal[1].surface = 'turf';
  Object.assign(project.weather, { rainMmHr: 30, stormMinutes: 60, durationMinutes: 60,
    stepMinutes: 5, mobilityPerHour: 0, boundaryExitPerHour: 0, cellSizeM: 1 });
  return project;
}
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('maximum interaction can come from aggregation even when cells do not exchange water', () => {
  const p = fixture(); p.proposal.forEach(cell => { cell.surface = 'garden'; });
  const result = compareProposalComponents(p, [0, 1]);
  const maximum = result.metrics.find(m => m.key === 'maxDepthMm');
  near(maximum.existing, 29); near(maximum.selected, 29); near(maximum.remaining, 29);
  near(maximum.full, 6); near(maximum.interaction, -23);
  near(result.metrics.find(m => m.key === 'storedLiters').interaction, 0);
  for (const cell of result.finalDepths) near(cell.interaction, 0);
});

test('independent cell water volumes have exact analytic effects and zero interaction', () => {
  const p = fixture(); const result = compareProposalComponents(p, [0]);
  const storage = result.metrics.find(m => m.key === 'storedLiters');
  near(storage.existing, 116); near(storage.selected, 93); near(storage.remaining, 108); near(storage.full, 85);
  near(storage.selectedEffect, -23); near(storage.remainingEffect, -8); near(storage.fullEffect, -31); near(storage.interaction, 0);
  for (const cell of result.finalDepths) near(cell.interaction, 0);
  for (const balance of Object.values(result.balances)) { near(balance.rainLiters, 120); near(balance.massErrorLiters, 0); }
});

test('coupled terrain and surface edits expose nonadditivity and complementary partition symmetry', () => {
  const p = fixture(); p.weather.mobilityPerHour = 0.5;
  p.proposal[0].elevationM = -0.05;
  p.proposal[1].elevationM = 0.02;
  const result = compareProposalComponents(p, [0]);
  const reversed = compareProposalComponents(p, [1]);
  assert.ok(result.finalDepths.some(cell => Math.abs(cell.interaction) > 0.01));
  for (let i = 0; i < result.metrics.length; i++) {
    const m = result.metrics[i], r = reversed.metrics[i];
    near(m.interaction, r.interaction); near(m.selected, r.remaining); near(m.remaining, r.selected);
    near(m.fullEffect, m.selectedEffect + m.remainingEffect + m.interaction);
  }
  for (const balance of Object.values(result.balances)) near(balance.massErrorLiters, 0);
});

test('full and existing cases equal ordinary comparison; original evidence and plans stay unchanged', () => {
  const p = fixture(); p.observations.push({ cellIndex: 0, minute: 30, depthMm: 3, uncertaintyMm: 1, source: 'authored control reading' });
  const before = JSON.stringify(p); const ordinary = compare(p);
  const result = compareProposalComponents(p, [0]);
  assert.equal(JSON.stringify(p), before);
  for (const metric of result.metrics) {
    near(metric.existing, ordinary.existing[metric.key]); near(metric.full, ordinary.proposal[metric.key]);
  }
  for (const cell of result.finalDepths) {
    near(cell.existing, ordinary.existing.finalDepthMm[cell.cellIndex]); near(cell.full, ordinary.proposal.finalDepthMm[cell.cellIndex]);
  }
});

test('metadata-only edits excluded and both components must contain distinct actual edits', () => {
  const p = fixture(); p.proposal[2].provenance = 'new annotation only';
  assert.deepEqual(componentEditIndices(p), [0, 1]);
  for (const selection of [[], [0, 1], [0, 0], [2], [-1], [0.5], ['0'], null]) {
    assert.throws(() => compareProposalComponents(p, selection), /component|edited cells/);
  }
});

test('four-case interactive budget refuses expensive requests before solving', () => {
  const p = fixture(); p.width = 24; p.height = 24;
  p.existing = Array.from({ length: 576 }, () => structuredClone(p.existing[0]));
  p.proposal = structuredClone(p.existing); p.proposal[0].surface = 'garden'; p.proposal[1].surface = 'turf';
  Object.assign(p.weather, { durationMinutes: 720, stepMinutes: 1 });
  assert.throws(() => compareProposalComponents(p, [0]), /exceeds 1000000/);
});

test('canonical edge changes follow their owner cell while edge source-only edits do not count', () => {
  const p = fixture();
  p.existing[0].internalBarriers = { east: { closed: false, source: 'authored opening' } };
  p.proposal[0].internalBarriers = { east: { closed: true, source: 'authored wall' } };
  p.proposal[2].internalBarriers = { east: { closed: false, source: 'same open behavior' } };
  assert.deepEqual(componentEditIndices(p), [0, 1]);
  p.weather.mobilityPerHour = 0.5;
  const result = compareProposalComponents(p, [0]);
  const selectedOnly = structuredClone(p);
  selectedOnly.proposal[1] = structuredClone(p.existing[1]);
  const ordinary = compare(selectedOnly);
  for (const cell of result.finalDepths) near(cell.selected, ordinary.proposal.finalDepthMm[cell.cellIndex]);
});

test('crest-only proposals are partitioned by canonical owner and retain exact finite-crest physics', () => {
  const p = fixture();
  p.existing.forEach((cell, i) => { cell.elevationM = [0.04, -0.02, 0.02, -0.04][i]; });
  p.proposal = structuredClone(p.existing);
  p.proposal[0].internalBarriers = { east: { crestElevationM: 0.06, source: 'authored upper crest' } };
  p.proposal[2].internalBarriers = { east: { crestElevationM: 0.04, source: 'authored lower crest' } };
  p.weather.mobilityPerHour = 0.5;
  assert.deepEqual(componentEditIndices(p), [0, 2]);
  const before = JSON.stringify(p);
  const result = compareProposalComponents(p, [0]);
  const selectedOnly = structuredClone(p);
  selectedOnly.proposal[2] = structuredClone(p.existing[2]);
  const selectedRun = compare(selectedOnly).proposal;
  assert.ok(result.finalDepths.some(cell => Math.abs(cell.full - cell.existing) > 1));
  for (const cell of result.finalDepths) near(cell.selected, selectedRun.finalDepthMm[cell.cellIndex]);
  for (const balance of Object.values(result.balances)) near(balance.massErrorLiters, 0);
  assert.equal(JSON.stringify(p), before);
  p.existing[0].internalBarriers = { east: { crestElevationM: 0.06, source: 'different source, same crest' } };
  assert.deepEqual(componentEditIndices(p), [2]);
  p.proposal[0].internalBarriers.east.crestElevationM = 0.061;
  assert.deepEqual(componentEditIndices(p), [0, 2]);
});
