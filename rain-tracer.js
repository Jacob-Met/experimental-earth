/** Passive attribution of modeled rainfall; it never changes water fluxes. */
export function validateRainTraceStudy(study, cellCount) {
  if (study === undefined) return null;
  const sources = study?.sourceCells;
  if (!study || Array.isArray(study) || !Array.isArray(sources) ||
      sources.length < 1 || sources.length > cellCount ||
      sources.some(i => !Number.isInteger(i) || i < 0 || i >= cellCount) ||
      new Set(sources).size !== sources.length) {
    throw new Error('Rain tracing needs distinct source cells inside the site');
  }
  return [...sources].sort((a, b) => a - b);
}

/**
 * Each cell is completely mixed. Rain, absorption and the solver's capped
 * simultaneous transfers call these hooks in the same order as bulk water.
 * Incoming tagged water is unavailable to outgoing transfers until endStep.
 */
export function createRainTracer(cellCount, cellAreaM2, study) {
  const sourceCells = validateRainTraceStudy(study, cellCount);
  if (!sourceCells) return null;
  const depth = Array(cellCount).fill(0);
  const movement = Array(cellCount).fill(0);
  const absorbed = Array(cellCount).fill(0);
  const exited = Array(cellCount).fill(0);
  let rainLiters = 0;
  return {
    rain(rainMm) {
      for (const i of sourceCells) depth[i] += rainMm;
      rainLiters += rainMm * cellAreaM2 * sourceCells.length;
    },
    absorb(i, amountMm, fullDepthMm) {
      const tagged = fullDepthMm > 0 ? Math.min(depth[i], amountMm * depth[i] / fullDepthMm) : 0;
      depth[i] -= tagged;
      absorbed[i] += tagged * cellAreaM2;
    },
    transfer(src, dst, amountMm, fullSourceDepthMm) {
      const fraction = fullSourceDepthMm > 0 ? Math.min(1, depth[src] / fullSourceDepthMm) : 0;
      const tagged = amountMm * fraction;
      movement[src] -= tagged;
      if (dst >= 0) movement[dst] += tagged;
      else exited[src] += tagged * cellAreaM2;
    },
    endStep() {
      for (let i = 0; i < cellCount; i++) depth[i] = Math.max(0, depth[i] + movement[i]);
      movement.fill(0);
    },
    finish() {
      const storedByCellLiters = depth.map(d => d * cellAreaM2);
      const sum = values => values.reduce((a, b) => a + b, 0);
      const absorbedLiters = sum(absorbed), exitLiters = sum(exited), storedLiters = sum(storedByCellLiters);
      return {
        schema: 'experimental-earth-rain-trace/1', mixing: 'complete-cell',
        sourceCells: [...sourceCells], rainLiters, absorbedLiters, exitLiters, storedLiters,
        massErrorLiters: rainLiters - absorbedLiters - exitLiters - storedLiters,
        absorbedByCellLiters: [...absorbed], exitByCellLiters: [...exited],
        storedByCellLiters, finalDepthMm: [...depth],
      };
    },
  };
}
