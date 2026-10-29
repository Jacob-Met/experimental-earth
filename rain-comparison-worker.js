import { compare } from './core.js';

let started = false;
self.onmessage = ({ data }) => {
  const generation = data?.generation;
  try {
    if (started) throw new Error('Comparison worker already received its job.');
    started = true;
    if (data?.type !== 'compare' || !Number.isSafeInteger(generation) || generation < 1) {
      throw new Error('Invalid comparison worker request.');
    }
    self.postMessage({ type: 'result', generation, result: compare(data.project) });
  } catch (error) {
    self.postMessage({ type: 'error', generation,
      error: { message: error instanceof Error ? error.message : String(error) } });
  }
};
