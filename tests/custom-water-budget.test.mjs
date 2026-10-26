import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, validateProject, compare } from '../core.js';
import { serializePortableProject, parsePortableProject } from '../project-portability.js';
import { compareLocalWaterBudget, inspectRegionalWaterBudget, localBudgetRegion,
  localBudgetInputKey } from '../local-water-budget.js';

const close = (actual, expected) => assert.ok(
  Math.abs(actual - expected) < 1e-8 * Math.max(1, Math.abs(expected)),
  `${actual} != ${expected}`);
const study = (project, cellIndices, scope = 'custom') => ({
  schema: 'experimental-earth-local-water-budget/1', scope,
  width: project.width, height: project.height, cellIndices,
});

function slope() {
  const project = makeExample();
  project.width = project.height = 2; project.selectedIndex = 0;
  project.existing = [0, 1, 2, 3].map(i => ({ elevationM: i % 2 ? 0 : .02,
    surface: 'sealed', provenance: 'independent custom-area control' }));
  project.proposal = project.existing.map(cell => ({ ...cell,
    elevationM: .02 - cell.elevationM }));
  Object.assign(project.weather, { rainMmHr: 60, stormMinutes: 5,
    durationMinutes: 5, stepMinutes: 5, cellSizeM: 1,
    mobilityPerHour: .5, boundaryExitPerHour: 0 });
  return project;
}

test('ordinary project export and reopen preserve scope, disconnected area and deliberate empty area', () => {
  const legacy = makeExample();
  const legacyReopened = parsePortableProject(serializePortableProject(legacy));
  assert.equal(legacyReopened.localWaterBudgetStudy, undefined);
  assert.deepEqual(localBudgetRegion(legacyReopened, 'cell'), [legacy.selectedIndex]);
  for (const scope of ['cell', 'edited', 'site', 'custom']) {
    for (const members of [[47, 0, 18], []]) {
      const project = makeExample();
      project.localWaterBudgetStudy = study(project, members, scope);
      const before = structuredClone(project);
      const reopened = parsePortableProject(serializePortableProject(project));
      assert.deepEqual(reopened.localWaterBudgetStudy, before.localWaterBudgetStudy);
      assert.deepEqual(project, before, 'export must not normalize or mutate the live selection');
      assert.deepEqual(new Set(localBudgetRegion(reopened, 'custom')), new Set(members));
    }
  }
});

test('project entry points reject stale grid dimensions and malformed custom membership', () => {
  const project = makeExample();
  const invalidStudies = [null,
    study(project, [0, 0]), study(project, [project.width * project.height]),
    { ...study(project, [0]), width: project.height, height: project.width },
    { ...study(project, [0]), scope: 'influence' }];
  for (const invalid of invalidStudies) {
    const candidate = { ...project, localWaterBudgetStudy: invalid };
    assert.throws(() => validateProject(candidate), /local water budget study/i);
    assert.throws(() => parsePortableProject(JSON.stringify(candidate)), /local water budget study/i);
  }
});

test('area and scope edits preserve physical results and reuse the same saved-assumption ledger', () => {
  const project = slope();
  const before = structuredClone(project), physical = compare(project);
  const inputKey = localBudgetInputKey(project), budget = compareLocalWaterBudget(project);
  for (const [scope, members] of [['custom', [3, 0]], ['site', [1, 2]], ['custom', []]]) {
    project.localWaterBudgetStudy = study(project, members, scope);
    project.selectedIndex = 3;
    assert.equal(localBudgetInputKey(project), inputKey);
    assert.deepEqual(compare(project), physical);
    assert.deepEqual(compareLocalWaterBudget(project), budget);
    assert.deepEqual(project.existing, before.existing);
    assert.deepEqual(project.proposal, before.proposal);
    assert.deepEqual(project.weather, before.weather);
  }
});

test('saved custom membership drives identical connected and disconnected region boundaries in both scenarios', () => {
  const project = slope(), comparison = compareLocalWaterBudget(project);
  for (const members of [[2, 0], [3, 0]]) {
    project.localWaterBudgetStudy = study(project, members);
    const reopened = parsePortableProject(serializePortableProject(project));
    const selected = localBudgetRegion(reopened, 'custom');
    const region = inspectRegionalWaterBudget(comparison, selected);
    assert.deepEqual(region.cellIndices, [...members].sort((a, b) => a - b));
    assert.deepEqual(reopened.localWaterBudgetStudy.cellIndices, members);
    for (const scenario of ['existing', 'proposal']) {
      close(region[scenario].rainLiters, 10);
      close(region[scenario].absorbedLiters, 1 / 6);
      close(region[scenario].balanceErrorLiters, 0);
      assert.ok(region.neighbors.every(neighbor => !members.includes(neighbor.cellIndex)));
    }
    close(region.changeBalanceErrorLiters, 0);
    if (members.includes(2)) {
      close(region.existing.outgoingLiters, 5 / 3);
      close(region.proposal.incomingLiters, 5 / 3);
      close(region.existing.incomingLiters, 0);
      close(region.proposal.outgoingLiters, 0);
      close(region.changes.storedLiters, 10 / 3);
    } else {
      for (const scenario of ['existing', 'proposal']) {
        close(region[scenario].incomingLiters, 5 / 6);
        close(region[scenario].outgoingLiters, 5 / 6);
        close(region[scenario].internalCrossingLiters, 0);
      }
      close(region.changes.storedLiters, 0);
    }
  }
});

test('custom selection never hides source changes that require a fresh trace', () => {
  const source = makeExample();
  source.localWaterBudgetStudy = study(source, [0, 18, 47]);
  const inputKey = localBudgetInputKey(source);
  for (const change of [
    project => { project.weather.rainMmHr += 1; },
    project => { project.existing[0].elevationM += .01; },
    project => { project.proposal[18].surface = 'garden'; },
    project => { project.proposal[0].internalBarriers = { east: {
      closed: true, source: 'independent source-invalidation control' } }; },
  ]) {
    const changed = structuredClone(source); change(changed);
    assert.notEqual(localBudgetInputKey(changed), inputKey);
    assert.deepEqual(localBudgetRegion(changed, 'custom'), localBudgetRegion(source, 'custom'));
  }
});
