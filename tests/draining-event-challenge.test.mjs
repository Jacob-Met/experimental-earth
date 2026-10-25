import test from 'node:test';
import assert from 'node:assert/strict';
import {compareDrainingEvents, makeDrainingEventExample, validateDrainingEvents,
  parseDrainingEvents, serializeDrainingEvents} from '../draining-event-challenge.js';
import {makeDrainingEvidenceExample} from '../draining-layer-evidence.js';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} differs from ${b}`);

test('a separate lower-rainfall event challenges frozen explanations without a first same-event holdout', () => {
  const input = makeDrainingEventExample(), before = structuredClone(input);
  const r = compareDrainingEvents(input);
  assert.deepEqual(r.compatibleIds, ['draining', 'closed-matched']);
  assert.deepEqual(r.eligibleIds, r.compatibleIds); assert.deepEqual(r.survivingIds, ['draining']);
  assert.equal(r.status, 'one-survivor'); assert.equal(r.counts.first.challenge, 0);
  assert.equal(r.candidates.length, 4); assert.equal(r.counts.second.calibration, 0);
  near(r.candidates[0].secondEvent.challenge.errors[0].depthMm, 7 * (1 - Math.log(12 / 7)));
  near(r.candidates[1].secondEvent.challenge.errors[0].depthMm, 12 - (5 + 19 * Math.log(24 / 19)));
  assert.deepEqual(input, before);
});

test('changing only second-event depth changes survival but never first calibration, hypotheses or model consequences', () => {
  const input = makeDrainingEventExample(), a = compareDrainingEvents(input);
  input.challengeProject.observations[0].depthMm = 12 - input.study.hypotheses[1].capacityMm;
  const b = compareDrainingEvents(input); assert.deepEqual(b.survivingIds, ['closed-matched']);
  assert.deepEqual(a.compatibleIds, b.compatibleIds); assert.deepEqual(a.study, b.study);
  for (let i = 0; i < a.candidates.length; i++) {
    for (const key of ['calibration', 'challenge', 'existing', 'proposal', 'change']) assert.deepEqual(a.candidates[i][key], b.candidates[i][key]);
    assert.deepEqual(a.candidates[i].secondEvent.change, b.candidates[i].secondEvent.change);
  }
});

test('a first-event held-aside rejection cannot be revived and all offered rows stay visible', () => {
  const input = makeDrainingEventExample();
  const held = structuredClone(makeDrainingEvidenceExample().project.observations[1]);
  held.depthMm = input.calibrationProject.observations[0].depthMm;
  input.calibrationProject.observations.push(held);
  const r = compareDrainingEvents(input);
  assert.deepEqual(r.eligibleIds, ['closed-matched']); assert.equal(r.status, 'challenged');
  assert.deepEqual(r.survivingIds, []); assert.equal(r.candidates.length, 4);
  assert.equal(r.effects.first.surviving.metrics.storedLiters, null);
  assert.equal(r.effects.second.surviving.metrics.storedLiters, null);
  input.calibrationProject.observations[0].depthMm = 100;
  assert.equal(compareDrainingEvents(input).status, 'calibration-rejected');
});

test('both layout maps and event model assumptions must match and second calibration is refused', () => {
  for (const side of ['existing', 'proposal']) {
    const input = makeDrainingEventExample(); input.challengeProject[side][0].elevationM = 0.1;
    assert.throws(() => compareDrainingEvents(input), /geometry and surfaces/);
  }
  for (const key of ['cellSizeM', 'mobilityPerHour', 'stepMinutes', 'boundaryExitPerHour']) {
    const input = makeDrainingEventExample(); input.challengeProject.weather[key] += 0.25;
    assert.throws(() => compareDrainingEvents(input), /assumptions must match/);
  }
  const calibrated = makeDrainingEventExample(); calibrated.challengeProject.observations[0].use = 'calibration';
  assert.throws(() => compareDrainingEvents(calibrated), /contains calibration/);
  const empty = makeDrainingEventExample(); empty.calibrationProject.observations = [];
  assert.throws(() => compareDrainingEvents(empty), /first event needs original calibration/);
});

test('each event starts from the same offered nonzero store rather than zero or the first terminal state', () => {
  const input = makeDrainingEventExample(); input.study.hypotheses[0].initialStoredMm = 1;
  input.references.startingWater = 'The same explicitly hypothetical 1 mm starting store applies separately in both events.';
  const r = compareDrainingEvents(input), c = r.candidates[0];
  near(c.proposal.receiver.initialLiters, 4); near(c.secondEvent.proposal.receiver.initialLiters, 4);
  assert.notEqual(c.proposal.receiver.retainedLiters, c.secondEvent.proposal.receiver.initialLiters);
  assert.equal(c.hypothesis.initialStoredMm, 1);
});

test('combined admission refuses a pair that individually fits the work limit', () => {
  const input = makeDrainingEventExample();
  for (const p of [input.calibrationProject, input.challengeProject]) {
    p.width = p.height = 20; p.existing = Array.from({length: 400}, () => ({...p.existing[0]}));
    p.proposal = Array.from({length: 400}, () => ({...p.proposal[0]}));
    p.weather.durationMinutes = 180; p.weather.stepMinutes = 1;
  }
  assert.throws(() => validateDrainingEvents(input), /combined cell-steps/);
});

test('source-only replay retains all originals and refuses missing declarations or injected conclusions', () => {
  const input = makeDrainingEventExample(), text = serializeDrainingEvents(input), reopened = parseDrainingEvents(text);
  assert.deepEqual(reopened, input); assert.deepEqual(compareDrainingEvents(reopened), compareDrainingEvents(input));
  assert.throws(() => parseDrainingEvents(JSON.stringify({...input, report: {status: 'one-survivor'}})), /saved conclusions/);
  for (const key of ['calibration', 'challenge', 'independence', 'startingWater']) {
    const copy = structuredClone(input); copy.references[key] = ' ';
    assert.throws(() => serializeDrainingEvents(copy), /nonempty/);
  }
  const duplicate = structuredClone(input); duplicate.references.challenge = ' ' + duplicate.references.calibration + ' ';
  assert.throws(() => compareDrainingEvents(duplicate), /distinct event/);
  const forged = structuredClone(input); forged.references.extra = 'allowed';
  assert.throws(() => compareDrainingEvents(forged), /declarations/);
});

test('independent one-hour depths remain stable across declared receiving time steps', () => {
  for (const stepMinutes of [1, 5, 30]) {
    const input = makeDrainingEventExample();
    input.calibrationProject.weather.stepMinutes = input.challengeProject.weather.stepMinutes = stepMinutes;
    const r = compareDrainingEvents(input); assert.deepEqual(r.survivingIds, ['draining']);
    near(r.candidates[0].secondEvent.challenge.errors[0].depthMm, 7 * (1 - Math.log(12 / 7)));
  }
});
