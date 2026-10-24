import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain } from '../core.js';
import { compareComponentHypotheses } from '../proposal-components.js';
const partition = [19, 27, 35];
const study = { target: 'existing', surface: 'sealed', ratesMmHr: [1, 9] };

test('an actual coupled courtyard interaction reverses across fixed finite source rates', () => {
  const p = makeExample(); const before = JSON.stringify(p);
  const result = compareComponentHypotheses(p, partition, { study });
  assert.equal(result.status, 'compared');
  const interaction = result.interactions.find(m => m.key === 'exitLiters');
  assert.equal(interaction.direction, 'reverses');
  assert.ok(interaction.min < -7 && interaction.max > 17);
  assert.equal(JSON.stringify(p), before);
});

test('source evidence selects rates once, before any component edits; held-aside values never select calibration', () => {
  const p = makeExample();
  p.observations = [{ cellIndex: 27, minute: 240, depthMm: 27.122973789020786,
    uncertaintyMm: 24, source: 'Authored simulation control, not field measurement',
    scenario: 'existing', use: 'calibration' },
  { cellIndex: 27, minute: 240, depthMm: 27.122973789020786,
    uncertaintyMm: 0.1, source: 'Authored simulation control, not independent physical evidence',
    scenario: 'existing', use: 'challenge' }];
  const calibration = compareComponentHypotheses(p, partition, { study, subset: 'calibration' });
  assert.deepEqual(calibration.candidates.map(c => c.rateMmHr), [1, 9]);
  assert.deepEqual(compareComponentHypotheses(p, partition, { study, subset: 'surviving' }).candidates.map(c => c.rateMmHr), [1]);
  p.observations[1].depthMm = 4.585178206054172;
  assert.deepEqual(compareComponentHypotheses(p, partition, { study, subset: 'calibration' }), calibration);
  assert.deepEqual(compareComponentHypotheses(p, partition, { study, subset: 'surviving' }).candidates.map(c => c.rateMmHr), [9]);
  p.observations[1].depthMm = 100;
  assert.equal(compareComponentHypotheses(p, partition, { study, subset: 'surviving' }).status, 'no-compatible-rates');
});

test('missing evidence never falls back to an unfiltered candidate experiment', () => {
  const p = makeExample();
  assert.equal(compareComponentHypotheses(p, partition, { study, subset: 'calibration' }).status, 'need-calibration');
  assert.equal(compareComponentHypotheses(p, partition, { study, subset: 'surviving' }).status, 'need-calibration');
});

test('proposal evidence is evaluated on the observed full proposal, not counterfactual partial plans', () => {
  const p = makeExample();
  const proposalStudy = { ...study, target: 'proposal' };
  const predicted = runRain(p.proposal, p.width, p.height, p.weather,
    { surfaceInfiltrationOverride: { surface: 'sealed', rateMmHr: 1 } });
  p.observations = [{ cellIndex: 27, minute: 240, depthMm: predicted.finalDepthMm[27],
    uncertaintyMm: 0.01, source: 'Authored full-proposal control', scenario: 'proposal', use: 'calibration' }];
  const result = compareComponentHypotheses(p, partition, { study: proposalStudy, subset: 'calibration' });
  assert.equal(result.status, 'compared');
  assert.ok(result.candidates.some(c => c.rateMmHr === 1));
  const one = result.candidates.find(c => c.rateMmHr === 1);
  // The intentionally altered partial world need not explain a reading from
  // the actual observed full plan; it must not reselect source hypotheses.
  assert.ok(Math.abs(one.result.finalDepths[27].selected - p.observations[0].depthMm) > 0.01);
});

test('combined source-plus-four-case work refuses oversized hypotheses before inference', () => {
  const p = makeExample();
  Object.assign(p.weather, { durationMinutes: 720, stepMinutes: 1 });
  const many = { ...study, ratesMmHr: [1, 2, 3, 4, 5, 6, 7, 8, 9] };
  assert.throws(() => compareComponentHypotheses(p, partition, { study: many }), /combined cell-step budget/);
});

test('an absent surface in the observed source cannot acquire evidence-filtered support from partial worlds', () => {
  const p = makeExample();
  const garden = { target: 'existing', surface: 'garden', ratesMmHr: [12, 24] };
  p.observations = [{ cellIndex: 27, minute: 240, depthMm: 20, uncertaintyMm: 100,
    source: 'Authored control', scenario: 'existing', use: 'calibration' }];
  assert.equal(compareComponentHypotheses(p, partition, { study: garden, subset: 'calibration' }).status,
    'surface-absent-in-observed-source');
  assert.equal(compareComponentHypotheses(p, partition, { study: garden, subset: 'all' }).status, 'compared');
});
