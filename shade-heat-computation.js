/** One owned worker per complete investigation. Superseded workers cannot
 * clear or settle a newer job. Model validation remains in the maintained core.
 */
export function createShadeHeatComputation(workerFactory) {
  if (typeof workerFactory !== 'function') throw Error('A computation worker factory is required');
  let active = null;
  function cancel() {
    if (!active) return;
    const previous = active; active = null;
    const error = Error('Calculation superseded by newer input'); error.code = 'superseded';
    previous.finish(error);
  }
  function compute(request) {
    cancel();
    return new Promise((resolve, reject) => {
      let worker;
      try { worker = workerFactory(); } catch (error) { reject(error); return; }
      let settled = false;
      const job = { worker, finish };
      function finish(error, result) {
        if (settled) return; settled = true;
        worker.terminate(); if (active === job) active = null;
        if (error) reject(error); else resolve(result);
      }
      active = job;
      worker.onmessage = event => {
        const data = event.data, result = data?.result;
        const complete = request.operation === 'serialize' ? typeof result === 'string'
          : result && result.investigation && result.report?.status === 'compared';
        if (data?.ok === true && complete) finish(null, result);
        else finish(Error(data?.error || 'The calculation worker did not return a complete investigation'));
      };
      worker.onerror = event => { event?.preventDefault?.(); finish(Error('The shade and heat calculation could not complete')); };
      try { worker.postMessage(request); } catch (error) { finish(error); }
    });
  }
  return { compute, cancel, get pending() { return active !== null; } };
}
