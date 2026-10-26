/** Worst conditional range of a finite scalar target after a banded observation.
 * Closed prospective bands are intervals of possible observed values. No density,
 * probability, continuous-domain coverage or physical error bound is implied.
 */
export function finitePeakQuestion(rows, maximumRows = 400) {
 if (![400,800].includes(maximumRows)) throw Error('Select a bounded 400 or 800 proposal family');
 if (!Array.isArray(rows) || rows.length < 1 || rows.length > maximumRows) throw Error(`Require 1–${maximumRows} finite prospective proposal bands`);
 for (const row of rows) if (!Number.isFinite(row?.lowerC) || !Number.isFinite(row?.upperC) || row.lowerC > row.upperC || !Number.isFinite(row?.peakC)) throw Error('Require ordered finite prospective bands and finite peak predictions');
 const minimumC = Math.min(...rows.map(r => r.peakC)), maximumC = Math.max(...rows.map(r => r.peakC));
 if (!Number.isFinite(maximumC - minimumC)) throw Error('Finite peak range exceeds arithmetic support');
 let worstRemainingC = 0, witness = null;
 for (let a = 0; a < rows.length; a++) for (let b = a + 1; b < rows.length; b++) {
  const lowerC = Math.max(rows[a].lowerC, rows[b].lowerC), upperC = Math.min(rows[a].upperC, rows[b].upperC);
  if (lowerC > upperC) continue;
  const spreadC = Math.abs(rows[a].peakC - rows[b].peakC);
  if (spreadC > worstRemainingC) { worstRemainingC = spreadC; witness = { indexes: [a,b], possibleObservedBand: {lowerC,upperC} }; }
 }
 const beforeC = maximumC - minimumC;
 return { minimumC, maximumC, beforeC, worstRemainingC, reductionC: Math.max(0, beforeC - worstRemainingC), witness };
}
