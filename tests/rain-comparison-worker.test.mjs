import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { makeExample, compare } from '../core.js';

const workerUrl = new URL('../rain-comparison-worker.js', import.meta.url).href;
function startWorker() {
  const source = `import { parentPort } from 'node:worker_threads';
    globalThis.self = { postMessage: message => parentPort.postMessage(message) };
    await import(${JSON.stringify(workerUrl)});
    parentPort.on('message', data => self.onmessage({ data }));`;
  return new Worker(new URL('data:text/javascript,' + encodeURIComponent(source)));
}
async function request(worker, message) {
  const response = once(worker, 'message'); worker.postMessage(message);
  return (await response)[0];
}
for (const name of ['ordinary', 'changed', 'fractional']) {
  test(name + ' worker output equals every canonical comparison field', { timeout: 10000 }, async t => {
    const worker = startWorker(); t.after(() => worker.terminate());
    const project = makeExample();
    if (name === 'changed') {
      project.weather.durationMinutes = 120;
      [project.existing, project.proposal] = [project.proposal, project.existing];
    }
    if (name === 'fractional') {
      project.weather.durationMinutes = 5.3;
      project.weather.stormMinutes = 2.3;
      project.weather.stepMinutes = 1.1;
    }
    const response = await request(worker, { type: 'compare', generation: 17, project });
    assert.equal(response.type, 'result'); assert.equal(response.generation, 17);
    assert.deepEqual(response.result, compare(project));
    assert.equal(response.result.existing.snapshots.at(-1).minute, project.weather.durationMinutes);
  });
}
test('invalid project yields a failure and cannot reuse a one-job worker', { timeout: 10000 }, async t => {
  const worker = startWorker(); t.after(() => worker.terminate());
  const first = await request(worker, { type: 'compare', generation: 1, project: {} });
  assert.equal(first.type, 'error'); assert.equal(first.generation, 1);
  assert.equal(typeof first.error.message, 'string');
  const second = await request(worker, { type: 'compare', generation: 2, project: makeExample() });
  assert.equal(second.type, 'error'); assert.match(second.error.message, /already received/);
});
test('unknown protocol cannot execute a comparison', { timeout: 10000 }, async t => {
  const worker = startWorker(); t.after(() => worker.terminate());
  const response = await request(worker, { type: 'unexpected', generation: 1, project: makeExample() });
  assert.equal(response.type, 'error'); assert.match(response.error.message, /Invalid/);
});

test('authored 24 by 24, 720-minute worker result exactly preserves the full canonical comparison and original inputs', { timeout: 10000 }, async t => {
  const worker = startWorker(); t.after(() => worker.terminate());
  // Keep this authored source identical to the browser responsiveness fixture.
  const project = makeExample();
  project.title = 'Authored worker responsiveness';
  project.width = 24; project.height = 24; project.selectedIndex = 0;
  project.existing = Array.from({ length: 576 }, (_, i) => ({
    surface: i % 3 === 0 ? 'garden' : i % 3 === 1 ? 'turf' : 'sealed',
    elevationM: ((i % 24) + (Math.floor(i / 24) % 4)) / 100,
    provenance: 'Authored responsiveness control'
  }));
  project.proposal = structuredClone(project.existing);
  project.proposal[0].surface = 'sealed';
  project.weather.durationMinutes = 720;
  project.weather.stepMinutes = 1;
  const original = structuredClone(project);
  const canonicalInput = structuredClone(original);
  const expected = compare(canonicalInput);
  assert.deepEqual(canonicalInput, original, 'canonical comparison preserves the original source');

  const response = await request(worker, { type: 'compare', generation: 23, project });
  assert.equal(response.type, 'result');
  assert.equal(response.generation, 23);
  assert.deepEqual(response.result, expected, 'both complete scenario results, including every snapshot, budget, and peak, equal unchanged compare');
  assert.deepEqual(project, original, 'worker submission preserves the complete original source');
  for (const side of ['existing', 'proposal']) {
    assert.equal(response.result[side].peakDepthMm.length, 576);
    assert.equal(response.result[side].finalDepthMm.length, 576);
    assert.equal(response.result[side].snapshots[0].minute, 0);
    assert.equal(response.result[side].snapshots.at(-1).minute, 720);
  }
});
