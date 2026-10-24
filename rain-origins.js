/** Reverse rainfall attribution through the maintained solver's accepted events. */
export const MAX_ORIGIN_CELL_STEPS = 250000;
const FATES = new Set(['stored', 'absorbed', 'exit']);

export function validateRainOriginStudy(study, cellCount) {
  if (study === undefined) return null;
  const cells = study?.targetCells;
  if (!study || Array.isArray(study) || !Array.isArray(cells) ||
      !cells.length || cells.length > cellCount ||
      cells.some(i => !Number.isInteger(i) || i < 0 || i >= cellCount) ||
      new Set(cells).size !== cells.length || !FATES.has(study.fate)) {
    throw new Error('Choose distinct destination cells and a rainfall fate');
  }
  return { targetCells: [...cells].sort((a, b) => a - b), fate: study.fate };
}

/**
 * Record fractions, never proposed or independently recomputed hydraulic fluxes.
 * Absorption precedes simultaneous transfers. The reverse pass applies the
 * transpose of those same linear tag operations to a selected destination.
 */
export function createRainOriginTracer(cellCount, cellAreaM2, study, stepCount, pairs, initialDepthsMm) {
  const admitted = validateRainOriginStudy(study, cellCount);
  if (!admitted) return null;
  if (cellCount * stepCount > MAX_ORIGIN_CELL_STEPS) {
    throw new Error('Rain origin analysis exceeds the retained cell-step budget');
  }
  const { targetCells, fate } = admitted;
  const selected = new Uint8Array(cellCount);
  for (const i of targetCells) selected[i] = 1;
  const initial = [...initialDepthsMm];
  const steps = [];
  let step = null, selectedSinkLiters = 0;
  return {
    rain(rainMm) {
      step = { rainMm, absorption: new Float64Array(cellCount),
        edges: new Float64Array(pairs.length), exits: new Float64Array(cellCount) };
    },
    absorb(i, amountMm, fullDepthMm) {
      step.absorption[i] = fullDepthMm > 0 ? amountMm / fullDepthMm : 0;
      if (fate === 'absorbed' && selected[i]) selectedSinkLiters += amountMm * cellAreaM2;
    },
    transfer(src, dst, amountMm, fullSourceDepthMm, edgeIndex) {
      const fraction = fullSourceDepthMm > 0 ? amountMm / fullSourceDepthMm : 0;
      if (dst < 0) {
        step.exits[src] += fraction;
        if (fate === 'exit' && selected[src]) selectedSinkLiters += amountMm * cellAreaM2;
      } else {
        step.edges[edgeIndex] = src === pairs[edgeIndex][0] ? fraction : -fraction;
      }
    },
    endStep() {
      steps.push(step);
      step = null;
    },
    finish(finalDepthsMm) {
      let weights = Float64Array.from(selected, value => fate === 'stored' ? value : 0);
      const bySource = new Float64Array(cellCount);
      for (let s = steps.length - 1; s >= 0; s--) {
        const recorded = steps[s];
        // Every transfer uses the same after-step weights, so one step cannot
        // spend incoming water again or inherit a loop-order dependence.
        const beforeTransfer = weights.slice();
        for (let e = 0; e < pairs.length; e++) {
          const signed = recorded.edges[e];
          if (!signed) continue;
          const [a, b] = pairs[e], src = signed > 0 ? a : b, dst = signed > 0 ? b : a;
          beforeTransfer[src] += Math.abs(signed) * (weights[dst] - weights[src]);
        }
        for (let i = 0; i < cellCount; i++) {
          const exitTarget = fate === 'exit' ? selected[i] : 0;
          beforeTransfer[i] += recorded.exits[i] * (exitTarget - weights[i]);
          const absorbedTarget = fate === 'absorbed' ? selected[i] : 0;
          const a = recorded.absorption[i];
          // A convex mixture can be a few ulps outside [0,1] after transfer
          // cancellation. Clamp only that floating-point representation.
          const beforeAbsorption = (1 - a) * beforeTransfer[i] + a * absorbedTarget;
          beforeTransfer[i] = Math.max(0, Math.min(1, beforeAbsorption));
          bySource[i] += recorded.rainMm * cellAreaM2 * beforeTransfer[i];
        }
        weights = beforeTransfer;
      }
      const rainfallLiters = bySource.reduce((sum, value) => sum + value, 0);
      const initialWaterLiters = initial.reduce((sum, depth, i) => sum + depth * weights[i] * cellAreaM2, 0);
      const targetTotalLiters = fate === 'stored'
        ? targetCells.reduce((sum, i) => sum + finalDepthsMm[i] * cellAreaM2, 0) : selectedSinkLiters;
      return { schema: 'experimental-earth-rain-origins/1', mixing: 'complete-cell',
        targetCells: [...targetCells], fate, bySourceLiters: Array.from(bySource),
        rainfallLiters, initialWaterLiters, targetTotalLiters,
        balanceErrorLiters: targetTotalLiters - rainfallLiters - initialWaterLiters };
    },
  };
}
