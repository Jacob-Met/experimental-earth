import test from 'node:test';
import assert from 'node:assert/strict';
import { createRainComparisonComputation } from '../rain-comparison-computation.js';
import { makeExample, compare } from '../core.js';

function harness() {
  const workers = [];
  const computation = createRainComparisonComputation(() => {
    const worker = {
      terminated: 0,
      postMessage(message) { this.request = structuredClone(message); },
      terminate() { this.terminated++; },
      reply(result = compare(this.request.project)) {
        this.onmessage({ data: { type: 'result', generation: this.request.generation, result } });
      },
    };
    workers.push(worker);
    return worker;
  });
  return { computation, workers };
}
test('complete canonical result settles and retires its worker', async () => {
  const { computation, workers } = harness();
  const project = makeExample(), expected = compare(project);
  const pending = computation.compute(project);
  assert.equal(computation.pending, true);
  workers[0].reply();
  assert.deepEqual(await pending, expected);
  assert.equal(computation.pending, false);
  assert.equal(workers[0].terminated, 1);
  assert.equal(workers[0].onmessage, null);
  assert.equal(workers[0].onerror, null);
  assert.equal(workers[0].onmessageerror, null);
});
test('a queued old response cannot settle or retire its successor', async () => {
  const { computation, workers } = harness();
  const first = computation.compute(makeExample());
  const retired = assert.rejects(first, { code: 'superseded' });
  const late = workers[0].onmessage, lateError = workers[0].onerror;
  const next = makeExample(); next.weather.rainMmHr = 48;
  const second = computation.compute(next);
  await retired;
  late({ data: { type: 'result', generation: 1, result: compare(makeExample()) } });
  lateError({ message: 'Late error' });
  assert.equal(computation.pending, true);
  assert.equal(workers[1].terminated, 0);
  workers[1].reply();
  assert.deepEqual(await second, compare(next));
});
test('cancellation is idempotent and leaves the controller reusable', async () => {
  const { computation, workers } = harness();
  const rejection = assert.rejects(computation.compute(makeExample()), { code: 'superseded' });
  computation.cancel(); computation.cancel();
  await rejection;
  assert.equal(workers[0].terminated, 1);
  const next = computation.compute(makeExample());
  workers[1].reply(); await next;
  computation.dispose();
  assert.equal(computation.pending, false);
});
test('dispatch captures the input contract before caller mutation', async () => {
  const { computation, workers } = harness(), project = makeExample();
  const expected = compare(project), pending = computation.compute(project);
  project.width = 24; project.weather.durationMinutes = 720;
  workers[0].reply();
  assert.deepEqual(await pending, expected);
});
for (const [name, send, code] of [
  ['incomplete result', worker => worker.reply({}), 'worker-protocol'],
  ['wrong generation', worker => worker.onmessage({ data: { type: 'result', generation: 999 } }), 'worker-protocol'],
  ['worker error reply', worker => worker.onmessage({ data: { type: 'error', generation: 1, error: { message: 'Failed' } } }), 'worker-failed'],
  ['runtime error', worker => worker.onerror({ message: 'Crashed', preventDefault() {} }), 'worker-failed'],
  ['undecodable message', worker => worker.onmessageerror(), 'worker-message'],
]) test(name + ' fails and retires the active worker', async () => {
  const { computation, workers } = harness();
  const rejection = assert.rejects(computation.compute(makeExample()), { code });
  send(workers[0]); await rejection;
  assert.equal(computation.pending, false);
  assert.equal(workers[0].terminated, 1);
});
for (const [name, corrupt] of [
  ['wrong peak cell count', result => result.existing.peakDepthMm.pop()],
  ['missing final snapshot', result => result.proposal.snapshots.pop()],
  ['null first snapshot', result => { result.existing.snapshots[0] = null; }],
  ['unordered timestamp', result => { result.existing.snapshots[1].minute = 0; }],
  ['incomplete snapshot depths', result => result.proposal.snapshots[1].depthsMm.pop()],
  ['nonfinite depth', result => { result.existing.finalDepthMm[0] = NaN; }],
  ['nonfinite snapshot budget', result => { result.existing.snapshots[1].storedLiters = Infinity; }],
]) test(name + ' cannot be accepted as complete', async () => {
  const { computation, workers } = harness();
  const rejection = assert.rejects(computation.compute(makeExample()), { code: 'worker-protocol' });
  const result = compare(makeExample()); corrupt(result); workers[0].reply(result);
  await rejection; assert.equal(computation.pending, false);
});
test('constructor failure rejects without an active job or fallback', async () => {
  let calls = 0;
  const computation = createRainComparisonComputation(() => { calls++; throw new Error('Blocked worker'); });
  await assert.rejects(computation.compute(makeExample()), /Blocked worker/);
  assert.equal(calls, 1); assert.equal(computation.pending, false);
});
test('postMessage failure retires the constructed worker', async () => {
  const worker = { postMessage() { throw new Error('Clone failure'); }, terminated: 0,
    terminate() { this.terminated++; } };
  const computation = createRainComparisonComputation(() => worker);
  await assert.rejects(computation.compute(makeExample()), /Clone failure/);
  assert.equal(worker.terminated, 1); assert.equal(computation.pending, false);
});
test('fractional supported duration and step retain complete canonical snapshots', async () => {
  const { computation, workers } = harness(), project = makeExample();
  project.weather.durationMinutes = 5.3;
  project.weather.stormMinutes = 2.3;
  project.weather.stepMinutes = 1.1;
  const pending = computation.compute(project);
  workers[0].reply();
  assert.deepEqual(await pending, compare(project));
});
