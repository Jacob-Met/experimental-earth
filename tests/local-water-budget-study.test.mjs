import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLocalWaterBudgetStudy } from '../local-water-budget-study.js';

function study(overrides = {}) {
  return { schema: 'experimental-earth-local-water-budget/1', scope: 'custom',
    width: 3, height: 2, cellIndices: [5, 0, 2], ...overrides };
}

test('legacy projects may omit the study, while present studies retain their identity and order', () => {
  assert.equal(validateLocalWaterBudgetStudy(undefined, 3, 2), undefined);
  const saved = study(), before = structuredClone(saved), members = saved.cellIndices;
  assert.equal(validateLocalWaterBudgetStudy(saved, 3, 2), saved);
  assert.equal(saved.cellIndices, members);
  assert.deepEqual(saved, before);
});

test('all scope choices retain the separately authored membership, including an unfinished empty area', () => {
  for (const scope of ['cell', 'edited', 'site', 'custom']) {
    for (const cellIndices of [[], [4, 1]]) {
      const saved = study({ scope, cellIndices });
      assert.equal(validateLocalWaterBudgetStudy(saved, 3, 2), saved);
      assert.deepEqual(saved.cellIndices, cellIndices);
    }
  }
});

test('project JSON round trips preserve disconnected membership and an explicitly empty study', () => {
  for (const cellIndices of [[5, 0, 2], []]) {
    const project = { width: 3, height: 2, localWaterBudgetStudy: study({ cellIndices }) };
    const restored = JSON.parse(JSON.stringify(project));
    assert.equal(validateLocalWaterBudgetStudy(restored.localWaterBudgetStudy,
      restored.width, restored.height), restored.localWaterBudgetStudy);
    assert.deepEqual(restored, project);
  }
  const legacy = JSON.parse(JSON.stringify({ width: 3, height: 2 }));
  assert.equal(validateLocalWaterBudgetStudy(legacy.localWaterBudgetStudy,
    legacy.width, legacy.height), undefined);
});

test('frozen input and the full maximum grid validate without sorting or mutation', () => {
  const cellIndices = Object.freeze(Array.from({ length: 24 * 24 }, (_, i) => 575 - i));
  const saved = Object.freeze(study({ width: 24, height: 24, cellIndices }));
  assert.equal(validateLocalWaterBudgetStudy(saved, 24, 24), saved);
  assert.equal(saved.cellIndices, cellIndices);
  assert.deepEqual(saved.cellIndices, Array.from({ length: 576 }, (_, i) => 575 - i));
  const restored = JSON.parse(JSON.stringify(saved));
  assert.deepEqual(validateLocalWaterBudgetStudy(restored, 24, 24), saved);
  assert.equal(validateLocalWaterBudgetStudy(study({ width: 2, height: 2,
    cellIndices: [3, 0] }), 2, 2).width, 2);
});

test('present studies require an object with exactly the persisted versioned fields', () => {
  for (const invalid of [null, false, 0, 'study', [], () => {}, {},
    study({ schema: 'experimental-earth-local-water-budget/2' }),
    study({ scope: 'downstream' }), study({ extra: true })]) {
    assert.throws(() => validateLocalWaterBudgetStudy(invalid, 3, 2), /local water budget study/i);
  }
  for (const field of ['schema', 'scope', 'width', 'height', 'cellIndices']) {
    const missing = study(); delete missing[field];
    assert.throws(() => validateLocalWaterBudgetStudy(missing, 3, 2), /local water budget study/i);
  }
  const inherited = Object.create(study());
  assert.throws(() => validateLocalWaterBudgetStudy(inherited, 3, 2), /fields/);
  const hidden = study(); Object.defineProperty(hidden, 'extra', { value: true });
  assert.throws(() => validateLocalWaterBudgetStudy(hidden, 3, 2), /fields/);
  const symbolic = study(); symbolic[Symbol('extra')] = true;
  assert.throws(() => validateLocalWaterBudgetStudy(symbolic, 3, 2), /fields/);
});

test('stored dimensions must match both project axes, even when total cell counts agree', () => {
  assert.throws(() => validateLocalWaterBudgetStudy(study(), 2, 3), /dimensions/);
  for (const dimension of [undefined, null, '3', 1, 25, 2.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validateLocalWaterBudgetStudy(study({ width: dimension }), dimension, 2), /dimensions/);
    assert.throws(() => validateLocalWaterBudgetStudy(study({ height: dimension }), 3, dimension), /dimensions/);
  }
  assert.throws(() => validateLocalWaterBudgetStudy(study({ width: '3' }), 3, 2), /dimensions/);
  assert.throws(() => validateLocalWaterBudgetStudy(study({ height: 3 }), 3, 2), /dimensions/);
});

test('membership rejects coercion, out-of-range values, duplicates, holes and excess cells', () => {
  for (const cellIndices of [null, {}, '0,1', new Uint8Array([0, 1]),
    [-1], [6], [1.5], ['1'], [true], [null], [undefined], [NaN], [Infinity],
    [Number.MAX_SAFE_INTEGER + 1], [0, 0], [0, -0], [2, , 4], [0, 1, 2, 3, 4, 5, 0]]) {
    const saved = study({ cellIndices }), before = structuredClone(saved);
    assert.throws(() => validateLocalWaterBudgetStudy(saved, 3, 2), /distinct cells/);
    assert.deepEqual(saved, before);
  }
});
