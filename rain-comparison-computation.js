// A dedicated worker owns one complete comparison. Retiring a job terminates
// that worker and prevents any already queued response from changing its successor.
function failure(message, code = 'worker-failed') {
  return Object.assign(new Error(message), { code });
}

function completeResult(result, expected) {
  const vector = value => Array.isArray(value) && value.length === expected.cells &&
    value.every(Number.isFinite);
  return result && ['existing', 'proposal'].every(key => {
    const run = result[key];
    if (!run || !vector(run.peakDepthMm) || !vector(run.finalDepthMm) ||
        !Array.isArray(run.snapshots) || !run.snapshots.length ||
        run.snapshots[0]?.minute !== 0 ||
        run.snapshots.at(-1)?.minute !== expected.durationMinutes) return false;
    if (!['rainLiters', 'exitLiters', 'absorbedLiters', 'storedLiters',
      'peakPondingLiters', 'cellsOver10Mm', 'maxDepthMm', 'massErrorLiters']
      .every(name => Number.isFinite(run[name]))) return false;
    let previous = -Infinity;
    return run.snapshots.every(snapshot => {
      if (!snapshot || !Number.isFinite(snapshot.minute) ||
          snapshot.minute <= previous || !vector(snapshot.depthsMm) ||
          !['storedLiters', 'absorbedLiters', 'exitLiters']
            .every(name => Number.isFinite(snapshot[name]))) return false;
      previous = snapshot.minute;
      return true;
    });
  });
}

export function createRainComparisonComputation(workerFactory) {
  let generation = 0;
  let active = null;
  function settle(job, error, result) {
    if (active !== job) return;
    active = null;
    if (job.worker) {
      job.worker.onmessage = null;
      job.worker.onerror = null;
      job.worker.onmessageerror = null;
      try { job.worker.terminate(); } catch { /* retirement remains final */ }
    }
    if (error) job.reject(error);
    else job.resolve(result);
  }
  function cancel() {
    if (active) settle(active, failure('Comparison superseded.', 'superseded'));
  }
  return {
    get pending() { return active !== null; },
    cancel,
    dispose: cancel,
    compute(project) {
      cancel();
      const id = ++generation;
      // Capture the contract before postMessage clones the input. Later changes
      // to the caller's object cannot alter the response that this job expects.
      const expected = {
        cells: project?.width * project?.height,
        durationMinutes: project?.weather?.durationMinutes,
      };
      return new Promise((resolve, reject) => {
        const job = { id, resolve, reject, worker: null };
        active = job;
        try {
          job.worker = workerFactory();
          job.worker.onmessage = event => {
            if (active !== job) return;
            const message = event.data;
            if (!message || typeof message !== 'object' || message.generation !== id) {
              settle(job, failure('Invalid comparison worker response.', 'worker-protocol'));
            } else if (message.type === 'error') {
              settle(job, failure(typeof message.error?.message === 'string'
                ? message.error.message : 'Comparison worker failed.'));
            } else if (message.type === 'result' && completeResult(message.result, expected)) {
              settle(job, null, message.result);
            } else {
              settle(job, failure('Incomplete comparison worker response.', 'worker-protocol'));
            }
          };
          job.worker.onerror = event => {
            event?.preventDefault?.();
            settle(job, failure(event?.message || 'Comparison worker failed.'));
          };
          job.worker.onmessageerror = () =>
            settle(job, failure('Comparison worker response could not be decoded.', 'worker-message'));
          job.worker.postMessage({ type: 'compare', generation: id, project });
        } catch (error) {
          settle(job, failure(error?.message || 'Comparison worker could not start.'));
        }
      });
    },
  };
}
