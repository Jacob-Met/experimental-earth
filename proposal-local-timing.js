/** Summarize changes at retained model samples without inferring between them. */
export function summarizeLocalDepthChange(snapshotMinutes, proposalMinusExistingMm) {
  if (!Array.isArray(snapshotMinutes) || !Array.isArray(proposalMinusExistingMm)
      || snapshotMinutes.length === 0 || snapshotMinutes.length !== proposalMinusExistingMm.length) {
    throw new TypeError('Retained times and depth changes must be nonempty arrays of equal length.');
  }
  let greatestDeepening = null;
  let greatestShallowing = null;
  const zeroRuns = [];
  const signReversals = [];
  let previousNonzero = null;
  let zeroStart = null;

  for (let index = 0; index < snapshotMinutes.length; index++) {
    const minute = snapshotMinutes[index];
    const deltaMm = proposalMinusExistingMm[index];
    if (typeof minute !== 'number' || !Number.isFinite(minute) || minute < 0
        || (index > 0 && minute <= snapshotMinutes[index - 1])) {
      throw new TypeError('Retained times must be finite, nonnegative and strictly increasing.');
    }
    if (typeof deltaMm !== 'number' || !Number.isFinite(deltaMm)) {
      throw new TypeError('Retained depth changes must be finite numbers.');
    }

    // Zero, including negative zero, is exact. Display rounding and the
    // aggregate comparison's tolerance do not classify these retained samples.
    if (deltaMm === 0) {
      if (zeroStart === null) zeroStart = index;
      continue;
    }
    if (zeroStart !== null) {
      zeroRuns.push({startIndex: zeroStart, endIndex: index - 1});
      zeroStart = null;
    }
    const sign = deltaMm > 0 ? 1 : -1;
    if (sign > 0) {
      if (greatestDeepening === null || deltaMm > greatestDeepening.deltaMm) {
        greatestDeepening = {deltaMm, indices: [index]};
      } else if (deltaMm === greatestDeepening.deltaMm) {
        greatestDeepening.indices.push(index);
      }
    } else {
      if (greatestShallowing === null || deltaMm < greatestShallowing.deltaMm) {
        greatestShallowing = {deltaMm, indices: [index]};
      } else if (deltaMm === greatestShallowing.deltaMm) {
        greatestShallowing.indices.push(index);
      }
    }
    if (previousNonzero !== null && previousNonzero.sign !== sign) {
      const reversal = {fromIndex: previousNonzero.index, toIndex: index,
        fromSign: previousNonzero.sign, toSign: sign};
      if (index > previousNonzero.index + 1) {
        reversal.zeroStartIndex = previousNonzero.index + 1;
        reversal.zeroEndIndex = index - 1;
      }
      signReversals.push(reversal);
    }
    previousNonzero = {index, sign};
  }
  if (zeroStart !== null) {
    zeroRuns.push({startIndex: zeroStart, endIndex: snapshotMinutes.length - 1});
  }
  return {greatestDeepening, greatestShallowing, zeroRuns, signReversals};
}
