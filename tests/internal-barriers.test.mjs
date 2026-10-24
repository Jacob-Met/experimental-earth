import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, validateProject, runRain, compare } from '../core.js';
import { internalEdge, withInternalBarrier, sameInternalBarriers } from '../internal-barriers.js';
import { assertMatchingEventSite } from '../event-challenge.js';
import { outletContext } from '../outlet-evidence-contract.js';

const close = (a, b, tol = 1e-8) => assert.ok(Math.abs(a - b) <= tol, a + ' != ' + b);
const vector = (a, b) => { assert.equal(a.length, b.length); a.forEach((value, i) => close(value, b[i])); };
const noAbsorption = { surfaceInfiltrationOverride: { surface: 'sealed', rateMmHr: 0 } };
function fixture() {
  const p = makeExample();
  p.width = p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({ length: 4 }, (_, i) => ({
    surface: 'sealed', elevationM: i === 0 ? 1 : 0, provenance: 'authored analytical control',
  }));
  p.proposal = structuredClone(p.existing);
  Object.assign(p.weather, { rainMmHr: 60, stormMinutes: 5, durationMinutes: 5,
    stepMinutes: 5, cellSizeM: 1, mobilityPerHour: 1, boundaryExitPerHour: 0 });
  return p;
}
const run = (p, target = 'proposal', extra = {}) => runRain(p[target], p.width, p.height, p.weather,
  { ...noAbsorption, traceBudget: true, rainTrace: { sourceCells: [0] }, ...extra });

test('a closed edge redirects the independently known five liters through the remaining neighbor', () => {
  const p = fixture(), before = structuredClone(p);
  const closed = withInternalBarrier(p, 'proposal', 0, 'east', true, 'Hypothetical closed wall');
  const r = run(closed);
  vector(r.finalDepthMm, [0, 5, 10, 5]);
  vector(r.rainTrace.finalDepthMm, [0, 0, 5, 0]);
  close(r.rainLiters, 20); close(r.storedLiters, 20); close(r.massErrorLiters, 0);
  assert.deepEqual(p, before);
  assert.deepEqual(r.waterBudget.edges.map(e => [e.a, e.b]), run(p).waterBudget.edges.map(e => [e.a, e.b]));
  const edge = r.waterBudget.edges.find(e => e.a === 0 && e.b === 1);
  close(edge.aToBLiters, 0); close(edge.bToALiters, 0);
});

test('closing both exits retains source water and reopening restores the original split exactly', () => {
  let p = withInternalBarrier(fixture(), 'proposal', 0, 'east', true, 'East wall');
  p = withInternalBarrier(p, 'proposal', 0, 'south', true, 'South wall');
  vector(run(p).rainTrace.finalDepthMm, [5, 0, 0, 0]);
  p = withInternalBarrier(p, 'proposal', 0, 'east', false, 'Proposed east opening');
  p = withInternalBarrier(p, 'proposal', 0, 'south', false, 'Proposed south opening');
  assert.deepEqual(run(p), run(fixture()));
  assert.equal(p.proposal[0].internalBarriers.east.source, 'Proposed east opening');
});

test('water reaches the other side through an available gap over subsequent steps', () => {
  let p = withInternalBarrier(fixture(), 'proposal', 0, 'east', true, 'Top wall');
  p.weather.durationMinutes = 10;
  const gap = run(p);
  assert.ok(gap.rainTrace.finalDepthMm[3] > 0);
  p = withInternalBarrier(p, 'proposal', 2, 'east', true, 'Gap closed');
  const sealed = run(p);
  close(sealed.rainTrace.finalDepthMm[1], 0); close(sealed.rainTrace.finalDepthMm[3], 0);
  close(sealed.rainTrace.storedLiters, 5);
});

test('a canonical link is reciprocal and can be edited from either endpoint', () => {
  const p = fixture();
  assert.deepEqual(internalEdge(2, 2, 1, 'west'), { ownerIndex: 0, neighborIndex: 0, key: 'east', a: 0, b: 1 });
  const a = withInternalBarrier(p, 'existing', 1, 'west', true, 'Shared wall');
  const b = withInternalBarrier(p, 'existing', 0, 'east', true, 'Shared wall');
  assert.deepEqual(a, b);
  const south = withInternalBarrier(p, 'existing', 2, 'north', true, 'Shared wall');
  assert.equal(south.existing[0].internalBarriers.south.closed, true);
  assert.deepEqual(south.proposal, p.proposal);
});

test('closed links conserve local, forward attribution and reverse attribution under absorption and outlets', () => {
  let p = makeExample();
  for (const [i, direction] of [[0, 'east'], [7, 'south'], [18, 'east'], [27, 'south'], [36, 'east']]) {
    p = withInternalBarrier(p, 'proposal', i, direction, true, 'Authored mixed-boundary control');
  }
  for (const fate of ['stored', 'absorbed', 'exit']) {
    const r = runRain(p.proposal, p.width, p.height, p.weather, {
      traceBudget: true, rainTrace: { sourceCells: [0, 18, 27] },
      rainOrigins: { targetCells: [0, 18, 27], fate },
    });
    close(r.massErrorLiters, 0); close(r.rainTrace.massErrorLiters, 0);
    close(r.rainOrigins.balanceErrorLiters, 0);
    r.waterBudget.cells.forEach(cell => close(cell.balanceErrorLiters, 0));
    assert.ok(r.snapshots.every(s => s.depthsMm.every(value => value >= 0)));
    for (const edge of r.waterBudget.edges) {
      const key = edge.b === edge.a + 1 ? 'east' : 'south';
      if (p.proposal[edge.a].internalBarriers?.[key]?.closed) {
        close(edge.aToBLiters, 0); close(edge.bToALiters, 0);
      }
    }
  }
});

test('reverse source attribution agrees with the independent blocked-edge routing control', () => {
  const p = withInternalBarrier(fixture(), 'proposal', 0, 'east', true, 'Closed edge');
  const r = run(p, 'proposal', { rainOrigins: { targetCells: [2], fate: 'stored' } });
  vector(r.rainOrigins.bySourceLiters, [5, 0, 5, 0]);
  close(r.rainOrigins.targetTotalLiters, 10); close(r.rainOrigins.balanceErrorLiters, 0);
});

test('dry sites do not produce water across barriers and exterior outlets remain unchanged', () => {
  const p = withInternalBarrier(fixture(), 'proposal', 0, 'east', true, 'Closed edge');
  p.weather.rainMmHr = 0;
  assert.equal(run(p).storedLiters, 0);
  p.weather.rainMmHr = 60; p.weather.mobilityPerHour = 0; p.weather.boundaryExitPerHour = 1;
  const unblocked = structuredClone(p); delete unblocked.proposal[0].internalBarriers;
  assert.deepEqual(run(p), run(unblocked));
  assert.equal(internalEdge(2, 2, 0, 'north'), null);
  assert.throws(() => withInternalBarrier(p, 'proposal', 0, 'north', true, 'Exterior'), /exterior/);
});

test('malformed, ambiguous, unsourced and exterior-edge records are refused', () => {
  for (const value of [null, [], {west:{closed:true,source:'x'}}, {east:null},
    {east:{closed:'yes',source:'x'}}, {east:{closed:true,source:''}},
    {east:{closed:true,source:'x'.repeat(241)}}, {east:{closed:true,source:'x',height:2}}]) {
    const p = fixture(); p.proposal[0].internalBarriers = value;
    assert.throws(() => validateProject(p));
  }
  for (const [index, key] of [[1, 'east'], [2, 'south']]) {
    const p = fixture(); p.proposal[index].internalBarriers = {[key]:{closed:false,source:'Outside'}};
    assert.throws(() => validateProject(p), /exterior/);
  }
  assert.throws(() => withInternalBarrier(fixture(), 'other', 0, 'east', true, 'x'));
  assert.throws(() => withInternalBarrier(fixture(), 'existing', 0, 'east', true, '   '));
});

test('portable project preserves declarations and reproduces paired results', () => {
  const p = withInternalBarrier(fixture(), 'proposal', 0, 'east', true, 'Supplied note <wall>');
  const restored = validateProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(restored, p); assert.deepEqual(compare(restored), compare(p));
  assert.notDeepEqual(compare(p).existing.finalDepthMm, compare(p).proposal.finalDepthMm);
});

test('cross-storm transfer requires identical connectivity but accepts differing notes and default-open encoding', () => {
  const a = fixture(), b = withInternalBarrier(a, 'existing', 0, 'east', true, 'Changed topology');
  assert.throws(() => assertMatchingEventSite(a, b, 'existing'), /walls and openings/);
  const c = withInternalBarrier(a, 'existing', 0, 'east', false, 'Verified opening');
  assert.equal(sameInternalBarriers(a.existing, c.existing), true);
  assert.doesNotThrow(() => assertMatchingEventSite(a, c, 'existing'));
  const d = withInternalBarrier(a, 'existing', 0, 'east', true, 'Different note, same wall');
  assert.doesNotThrow(() => assertMatchingEventSite(b, d, 'existing'));
});

test('retained collection context changes with the actual wall declaration', () => {
  const p = fixture(), next = withInternalBarrier(p, 'existing', 0, 'east', true, 'Changed place');
  assert.notEqual(outletContext(p, 'existing'), outletContext(next, 'existing'));
  assert.equal(outletContext(p, 'proposal'), outletContext(next, 'proposal'));
});
