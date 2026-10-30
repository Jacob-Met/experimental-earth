// Browser and Node helpers for the Nemotron reading of a saved comparison.
// The model drafts prose; this module decides which numbers in that prose
// match the comparison the workbench computed. Nothing here calls the network
// except requestNemotronReview, which posts to the local server only.

export const REVIEW_ENDPOINT = '/api/nemotron-review';

const roundTo = (value, decimals) => {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
};

// Summary figures only: no grid, observations or project file leaves the page.
export function summaryFigures(results, weather) {
  const a = results.existing, b = results.proposal;
  const rows = [
    ['Hypothetical rain on the site', 'L', a.rainLiters, a.rainLiters],
    ['Water leaving modeled edges', 'L', a.exitLiters, b.exitLiters],
    ['Water infiltrated', 'L', a.absorbedLiters, b.absorbedLiters],
    ['Peak standing water', 'L', a.peakPondingLiters, b.peakPondingLiters],
    ['Final stored water', 'L', a.storedLiters, b.storedLiters],
    ['Cells ever at or above 10 mm', 'cells', a.cellsOver10Mm, b.cellsOver10Mm],
    ['Maximum cell water depth', 'mm', a.maxDepthMm, b.maxDepthMm],
  ];
  const figures = rows.map(([label, unit, existing, proposed]) => ({
    label, unit, existing: roundTo(Number(existing), 2), proposed: roundTo(Number(proposed), 2),
  }));
  if (weather) {
    figures.push(
      { label: 'Rain intensity', unit: 'mm/h', existing: roundTo(Number(weather.rainMmHr), 2), proposed: roundTo(Number(weather.rainMmHr), 2) },
      { label: 'Storm length', unit: 'min', existing: roundTo(Number(weather.stormMinutes), 2), proposed: roundTo(Number(weather.stormMinutes), 2) },
      { label: 'Run duration', unit: 'min', existing: roundTo(Number(weather.durationMinutes), 2), proposed: roundTo(Number(weather.durationMinutes), 2) },
    );
  }
  return figures.filter(f => Number.isFinite(f.existing) && Number.isFinite(f.proposed));
}

// Every number a draft quotes must equal a figure shown to the reader, rounded
// to the same number of decimals the draft used. Anything else is flagged.
export function checkDraft(text, figures) {
  const clean = String(text).replace(/(\d),(\d{3})(?!\d)/g, '$1$2');
  const allowed = figures.flatMap(f => [f.existing, f.proposed]).filter(Number.isFinite);
  // Numbers written into a label (for example "10 mm" in a threshold name) are part of the shown comparison.
  const labelNumbers = figures.flatMap(f => (f.label.match(/\d+(?:\.\d+)?/g) || []).map(Number));
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const unmatched = [];
  let checked = 0;
  for (const sentence of sentences) {
    for (const match of sentence.matchAll(/\d+(?:\.\d+)?/g)) {
      checked += 1;
      const token = match[0];
      const decimals = (token.split('.')[1] || '').length;
      const value = Number(token);
      const ok = labelNumbers.includes(value) || allowed.some(v => roundTo(v, decimals) === value);
      if (!ok) unmatched.push({ token, sentence });
    }
  }
  return {
    checked,
    matched: checked - unmatched.length,
    unmatched,
    verified: checked > 0 && unmatched.length === 0,
    noFigures: checked === 0,
  };
}

// Returns {status:'ok', model, text, check} or {status:'error', code, message}.
export async function requestNemotronReview(figures, { fetchImpl = globalThis.fetch, endpoint = REVIEW_ENDPOINT } = {}) {
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ figures }),
      cache: 'no-store',
    });
  } catch {
    return { status: 'error', code: 'offline', message: 'The local server did not answer. Start it with python3 serve.py.' };
  }
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok || !body || typeof body.text !== 'string') {
    const message = body?.error || `The local server returned HTTP ${response.status}.`;
    return { status: 'error', code: body?.code || 'http', message };
  }
  return { status: 'ok', model: String(body.model || ''), text: body.text, check: checkDraft(body.text, figures) };
}
