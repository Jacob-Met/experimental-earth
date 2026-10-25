import { compareTerrainSensitivity } from './terrain-sensitivity.js';
import { INTERVENTION_METRICS } from './intervention-study.js';
const fmt = n => n !== 0 && Math.abs(n) < .0001 ? n.toExponential(3) : Number(n).toLocaleString('en-US', { maximumFractionDigits: 5 });
const name = (i, width) => `${String.fromCharCode(65 + i % width)}${Math.floor(i / width) + 1}`;
function paragraph(parent, text) { const p = document.createElement('p'); p.textContent = text; parent.append(p); return p; }

export function mountTerrainSensitivity({ getProject }) {
  const host = document.createElement('section'); host.className = 'panel'; host.id = 'terrain-sensitivity-panel';
  host.style.minWidth = '0'; host.style.overflowWrap = 'anywhere';
  host.innerHTML = `<span class="eyebrow">SUPPLIED GROUND / SAMPLED HYPOTHESES</span>
    <h2>Could an uncertain ground height change the proposal's effect?</h2>
    <p>Choose one supplied existing-site elevation. Start with low, central and high values, or request more equally spaced samples to inspect interior effects. All other heights, the storm and default material capacities stay fixed.</p>
    <form id="terrain-sensitivity-form">
      <label class="input-label">Supplied existing-site cell <select id="terrain-sensitivity-cell"></select></label>
      <label class="input-label">Elevation samples <select id="terrain-sensitivity-samples"><option value="3">3 · low, central, high</option><option value="5">5 · include quarter points</option><option value="9">9 · finer interior samples</option><option value="17">17 · finest offered samples</option></select></label>
      <p id="terrain-sensitivity-source" class="mini-note"></p>
      <label style="display:flex;gap:10px;align-items:start;margin:16px 0"><input id="terrain-sensitivity-transfer" type="checkbox" style="width:18px;flex:0 0 18px;margin-top:4px">I assume this ground-height error transfers equally to the proposal, preserving its authored elevation change. Other heights and absolute wall crests stay fixed.</label>
      <button id="terrain-sensitivity-run" type="submit" class="subtle">Compare sampled ground heights</button>
    </form>
    <p id="terrain-sensitivity-status" role="status" aria-live="polite"></p>
    <div id="terrain-sensitivity-results"></div>
    <p class="mini-note">These finite samples are not bounds over the whole elevation interval or a joint survey uncertainty analysis. A consistent sign at the samples can reverse between them, even with 17 samples. Supplied uncertainty is not a probability. No observations are fitted or reassigned; no plan is adopted. Calculation interval and omitted physics can change the result.</p>`;
  for (const note of host.querySelectorAll('.mini-note')) note.style.color = 'var(--muted)';
  document.getElementById('terrain-file').closest('.panel').after(host);
  const $ = id => host.querySelector('#terrain-sensitivity-' + id);
  let fingerprint = null;
  function clear(message = 'Choose a sourced cell and confirm the transfer assumption.') { $('results').replaceChildren(); $('status').textContent = message; }
  function source() {
    clear(); $('transfer').checked = false;
    const p = getProject(), cell = p.existing[Number($('cell').value)], s = cell?.terrainSource;
    $('source').textContent = s ? `${s.fileName}, line ${s.line} · ${s.elevationValue} ± ${s.uncertaintyValue} ${s.unit} · datum: ${s.datum} · ${s.source}` : 'Import a supplied elevation table first.';
    $('run').disabled = !s;
  }
  function refresh() {
    const p = getProject(), next = JSON.stringify(p);
    if (fingerprint === next) return;
    fingerprint = next; const old = $('cell').value; $('cell').replaceChildren();
    for (const [i, cell] of p.existing.entries()) if (cell.terrainSource) {
      const option = document.createElement('option'); option.value = String(i); option.textContent = name(i, p.width); $('cell').append(option);
    }
    if ([...$('cell').options].some(o => o.value === old)) $('cell').value = old;
    source();
  }
  $('cell').addEventListener('change', source);
  $('samples').addEventListener('change', () => clear('Sample count changed; recompute all requested heights.'));
  $('transfer').addEventListener('change', () => clear('Transfer assumption changed; recompute to inspect results.'));
  $('form').addEventListener('submit', event => {
    event.preventDefault(); clear();
    try {
      const p = getProject();
      if (JSON.stringify(p) !== fingerprint) { refresh(); throw Error('Project changed; confirm the current source and recompute'); }
      if (!$('cell').value) throw Error('Choose a supplied elevation');
      const report = compareTerrainSensitivity(p, { cellIndex: Number($('cell').value), transferConfirmed: $('transfer').checked, sampleCount: Number($('samples').value) });
      $('status').textContent = `${report.sampleCount} paired comparisons · ${name(report.cellIndex, p.width)} · fixed intervention height change ${fmt(report.interventionDeltaM)} m · ${report.cellStepUpperBound.toLocaleString()} cell-steps.`;
      const output = $('results');
      for (const [key, metric] of Object.entries(INTERVENTION_METRICS)) {
        const summary = report.metrics[key];
        paragraph(output, `${metric.label}: proposal − existing spans ${fmt(summary.min)} to ${fmt(summary.max)} ${metric.unit} across the ${report.sampleCount} samples (${summary.direction}).`);
      }
      paragraph(output, 'Negative differences mean a smaller modeled quantity, not an overall benefit. Peak depths compare separate maxima, which need not occur at the same time.');
      for (const candidate of report.candidates) {
        const details = document.createElement('details'), title = document.createElement('summary');
        title.textContent = `${candidate.label}: existing ${fmt(candidate.existingElevationM)} m → proposal ${fmt(candidate.proposalElevationM)} m`; details.append(title);
        for (const [key, metric] of Object.entries(INTERVENTION_METRICS)) {
          const row = candidate.metrics[key]; paragraph(details, `${metric.label}: existing ${fmt(row.existing)}; proposal ${fmt(row.proposal)}; difference ${fmt(row.delta)} ${metric.unit}`);
        }
        const local = document.createElement('details'), heading = document.createElement('summary'); heading.textContent = 'Inspect final and peak depth at every cell'; local.append(heading);
        for (const row of candidate.cells) paragraph(local, `${name(row.cellIndex, p.width)} · final: ${fmt(row.existingFinalMm)} → ${fmt(row.proposalFinalMm)} mm (difference ${fmt(row.finalDeltaMm)}); peak: ${fmt(row.existingPeakMm)} → ${fmt(row.proposalPeakMm)} mm (difference ${fmt(row.peakDeltaMm)}).`);
        details.append(local); output.append(details);
      }
    } catch (error) { clear(`Comparison refused: ${error.message}`); }
  });
  return { refresh };
}
