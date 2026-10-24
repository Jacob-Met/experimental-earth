import { prepareHeatEvidence, compareHeatEvidence, authoredHeatEvidenceExample } from './surface-heat-evidence.js';
import { heatEvidenceCurrent } from './surface-heat-evidence-contract.js';
import { parseHeatHypotheses, parseHeatReadings, formatHeatHypotheses, formatHeatReadings } from './surface-heat-evidence-table.js';

const node = (tag, text = '') => { const e = document.createElement(tag); e.textContent = text; return e; };
const svg = (tag, attributes = {}) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, value] of Object.entries(attributes)) e.setAttribute(key, String(value)); return e; };
const display = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 3 });
const colors = ['#167c69', '#b56b3b', '#6157a5', '#1d70a2', '#9d3d6e', '#637734', '#d55e00', '#0072b2', '#6d597a', '#7b6f13', '#4b626c', '#a5432b'];
const statuses = {
  'need-calibration': 'No calibration readings supplied. No declared candidate has evidence support yet.',
  'calibration-rejected': 'Every declared candidate conflicts with at least one calibration interval. This finite set does not explain the supplied readings.',
  challenged: 'Every calibration-compatible candidate conflicts with a challenge interval. The original candidates and calibration results remain unchanged.',
  'needs-challenge': 'Calibration-compatible candidates remain. No challenge readings have been supplied.',
  'one-survivor': 'One candidate in this finite declared set remains compatible with both reading groups. This does not identify unique physical parameters.',
  ambiguous: 'Several declared candidates remain compatible. Preserve their different parameter and energy implications.',
};

export function mountHeatEvidence({ getProject, replaceProject, notice }) {
  const link = node('link'); link.rel = 'stylesheet'; link.href = new URL('./surface-heat-evidence.css', import.meta.url); document.head.append(link);
  const panel = node('section'); panel.id = 'heat-observations'; panel.className = 'panel study';
  panel.innerHTML = `<span class="eyebrow">HEAT / TEMPERATURE EVIDENCE</span><h2>Which heat responses do the readings challenge?</h2>
    <p>Associate sourced temperature intervals with one layer in the saved exposure above. Compare a finite set of declared properties. Calibration readings screen the original candidates; separately declared challenge readings can reject them but never refit them.</p>
    <form id="heat-evidence-form"><label class="input-label">Observed layer<select id="heat-evidence-target"><option value="existing">Existing layer</option><option value="proposal">Proposed layer</option></select></label>
    <label class="input-label">How the readings belong to this place, layer and exposure<textarea id="heat-evidence-association" rows="3" maxlength="600" required></textarea></label>
    <label class="input-label">Declared layer hypotheses · CSV<textarea id="heat-hypotheses" rows="6" maxlength="24000" spellcheck="false" required></textarea></label>
    <p class="mini-note">Columns: <code>label,absorptivity,capacity_j_m2_k,exchange_w_m2_k,initial_c,source</code>. Keep 2–12 distinct labels. Each row is an explicit alternative; properties are never inferred from a surface name.</p>
    <label class="input-label">Temperature readings · CSV<textarea id="heat-readings" rows="6" maxlength="128000" spellcheck="false" required></textarea></label>
    <label class="input-label">Load readings from a CSV file<input id="heat-readings-file" type="file" accept=".csv,text/csv"></label>
    <p class="mini-note">Columns: <code>minute,temperature_c,half_width_c,use,source</code>. Use <code>calibration</code> or <code>challenge</code>. Times are elapsed minutes from the saved exposure; one reading per time, up to 100. Half-widths are supplied bounds, not confidence levels. A challenge label does not verify when the reading was acquired or selected.</p>
    <div class="obs-actions"><button id="heat-evidence-save" type="submit">Save temperature evidence</button><button id="heat-evidence-example" type="button">Load authored ambiguity example</button><button id="heat-evidence-clear" type="button">Clear retained temperature evidence</button></div></form>
    <p class="heat-assumptions">Temperature responds to absorption / capacity and exchange / capacity. Scaling all three properties together can preserve its response while changing energy. Compatible readings do not establish the model's omissions, material identity or physical validity.</p>
    <button id="heat-evidence-run" class="primary" type="button">Compare saved hypotheses</button><p id="heat-evidence-status" role="status"></p><div id="heat-evidence-results"></div>`;
  document.getElementById('surface-heat').after(panel);
  const $ = id => panel.querySelector('#' + id);
  let generation = 0, signature = '', lastProject = null, dirty = false;
  function invalidate(message, state = 'not-compared') {
    generation++; $('heat-evidence-results').replaceChildren();
    $('heat-evidence-status').textContent = message; $('heat-evidence-status').dataset.state = state;
  }
  function changed() { dirty = true; $('heat-evidence-run').disabled = true; invalidate('Draft changed. Save the temperature evidence before comparing.'); }
  function fill(evidence) {
    $('heat-evidence-target').value = evidence?.target ?? 'existing';
    $('heat-evidence-association').value = evidence?.associationSource ?? '';
    $('heat-hypotheses').value = formatHeatHypotheses(evidence?.hypotheses ?? []);
    $('heat-readings').value = formatHeatReadings(evidence?.readings ?? []);
  }
  for (const input of panel.querySelectorAll('form textarea, form select')) input.addEventListener('input', changed);
  $('heat-readings-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    changed(); const request = generation;
    try {
      if (file.size > 128000) throw Error('Use a temperature table no larger than 128 KB.');
      const text = await file.text(); if (request !== generation) return;
      parseHeatReadings(text); $('heat-readings').value = text; changed();
      $('heat-evidence-status').textContent = `Loaded ${file.name} into the draft. Review the row sources and save before comparing.`;
    } catch (error) { if (request === generation) { notice(error.message); $('heat-evidence-status').textContent = error.message; } }
    finally { event.target.value = ''; }
  });
  $('heat-evidence-example').addEventListener('click', () => {
    try { fill(authoredHeatEvidenceExample(getProject(), $('heat-evidence-target').value)); changed(); }
    catch (error) { notice(error.message); invalidate(error.message, 'refused'); }
  });
  $('heat-evidence-clear').addEventListener('click', () => {
    const next = structuredClone(getProject()); delete next.surfaceHeatEvidence; replaceProject(next);
  });
  $('heat-evidence-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const current = getProject(), old = current.surfaceHeatEvidence, target = $('heat-evidence-target').value;
      if (old && (!heatEvidenceCurrent(current, old) || old.target !== target)) {
        throw Error('The retained exposure, place or selected layer changed. Export the project to preserve its evidence, then clear this temperature evidence before associating another exposure.');
      }
      const next = structuredClone(current);
      next.surfaceHeatEvidence = prepareHeatEvidence(current, { target, associationSource: $('heat-evidence-association').value,
        hypotheses: parseHeatHypotheses($('heat-hypotheses').value), readings: parseHeatReadings($('heat-readings').value) });
      compareHeatEvidence(next); // Refuse unsupported trajectories before replacing accepted evidence.
      replaceProject(next); dirty = false; $('heat-evidence-run').disabled = false;
      invalidate('Temperature evidence saved with the original heat declaration. Compare to inspect every candidate.');
    } catch (error) { notice(error.message); invalidate(error.message, 'refused'); }
  });
  function table(headers, rows) {
    const wrap = node('div'); wrap.className = 'heat-evidence-table'; wrap.tabIndex = 0;
    const t = node('table'), head = node('thead'), tr = node('tr');
    for (const title of headers) { const th = node('th', title); th.scope = 'col'; tr.append(th); } head.append(tr); t.append(head);
    const body = node('tbody');
    for (const row of rows) { const line = node('tr'); for (const value of row) line.append(node('td', value)); body.append(line); }
    t.append(body); wrap.append(t); return wrap;
  }
  function draw(result, evidence) {
    const host = $('heat-evidence-results'); host.replaceChildren();
    host.append(node('h3', result.counts.calibration ? `${result.survivingLabels.length} declared candidates remain after the supplied intervals` : 'Supply calibration readings before assessing candidate support'),
      node('p', `${result.counts.calibration} calibration and ${result.counts.challenge} challenge intervals. Declared order is retained; no candidate is fitted or automatically adopted.`));
    const chart = svg('svg', { viewBox: '0 0 700 290', role: 'img', 'aria-label': 'Declared temperature responses with calibration circles and challenge diamonds and supplied interval half-widths' });
    chart.id = 'heat-evidence-chart';
    const values = result.candidates.flatMap(c => c.trajectory.map(r => r.temperatureC)).concat(evidence.readings.flatMap(r => [r.temperatureC - r.halfWidthC, r.temperatureC + r.halfWidthC]));
    const low = Math.min(...values), high = Math.max(...values), pad = Math.max(1, (high - low) * .08);
    const x = t => 78 + 570 * t / result.durationMinutes, y = v => 230 - 205 * (v - low + pad) / (high - low + 2 * pad);
    for (let i = 0; i <= 4; i++) {
      const v = low - pad + (high - low + 2 * pad) * i / 4;
      chart.append(svg('line', { x1: 78, x2: 648, y1: y(v), y2: y(v), stroke: '#dce6df' }));
      const label = svg('text', { x: 70, y: y(v) + 4, 'text-anchor': 'end' }); label.textContent = v.toFixed(1); chart.append(label);
      const time = svg('text', { x: x(result.durationMinutes * i / 4), y: 255, 'text-anchor': 'middle' }); time.textContent = display(result.durationMinutes * i / 4); chart.append(time);
    }
    result.candidates.forEach((candidate, index) => {
      chart.append(svg('path', { d: candidate.trajectory.map((r, i) => `${i ? 'L' : 'M'}${x(r.minute)},${y(r.temperatureC)}`).join(' '),
        fill: 'none', stroke: colors[index % colors.length], 'stroke-width': 2.5, 'stroke-dasharray': index % 2 ? '6 3' : 'none' }));
    });
    for (const reading of evidence.readings) {
      const xx = x(reading.minute), yy = y(reading.temperatureC);
      chart.append(svg('line', { x1: xx, x2: xx, y1: y(reading.temperatureC - reading.halfWidthC), y2: y(reading.temperatureC + reading.halfWidthC), stroke: '#102e34', 'stroke-width': 2 }));
      chart.append(reading.use === 'calibration' ? svg('circle', { cx: xx, cy: yy, r: 4, fill: '#102e34' }) : svg('path', { d: `M${xx},${yy-6}L${xx+6},${yy}L${xx},${yy+6}L${xx-6},${yy}Z`, fill: '#fff', stroke: '#102e34', 'stroke-width': 2 }));
    }
    host.append(chart, node('p', 'Vertical: layer °C · Horizontal: elapsed minutes · Filled circles: calibration · Open diamonds: challenge. Curves are sampled for display; reading comparisons use exact interval propagation.'));
    const legend = node('ul'); legend.className = 'heat-curve-legend';
    result.candidates.forEach((candidate, index) => { const item = node('li', candidate.label); item.style.borderLeft = `8px solid ${colors[index % colors.length]}`; item.style.paddingLeft = '8px'; legend.append(item); });
    host.append(legend);
    const outcome = group => group.compatible === null ? 'No readings' : `${group.withinCount}/${group.count} within bounds`;
    host.append(table(['Candidate', 'Calibration', 'Challenge', 'Stored change at end · kJ/m²'], result.candidates.map(c => [c.label, outcome(c.calibration), outcome(c.challenge), display(c.final.storedJm2 / 1000)])));
    if (result.survivingLabels.length) {
      const range = result.energyRanges.storedJm2;
      const p = node('p', `Remaining finite candidates imply ${display(range.minimum / 1000)}–${display(range.maximum / 1000)} kJ/m² of final stored change. Coinciding temperature responses can retain different energy and material declarations.`);
      p.id = 'heat-evidence-energy'; p.dataset.minimum = String(range.minimum); p.dataset.maximum = String(range.maximum); host.append(p);
    }
    result.candidates.forEach((candidate, index) => {
      const h = evidence.hypotheses[index], detail = node('details'); detail.className = 'heat-candidate';
      const title = node('summary', candidate.label); title.style.borderLeft = `8px solid ${colors[index % colors.length]}`; detail.append(title);
      detail.append(node('p', `Absorptivity ${h.absorptivity}; capacity ${h.capacityJm2K} J/(m²·K); exchange ${h.exchangeWm2K} W/(m²·K); initial ${h.initialC} °C. ${h.source}`));
      detail.append(node('p', `Calculated absorption / capacity ${candidate.responseRatios.inputPerCapacity.toExponential(5)}; exchange / capacity ${candidate.responseRatios.exchangePerCapacity.toExponential(5)} per second. End absorbed input ${display(candidate.final.inputJm2/1000)}, signed exchange out ${display(candidate.final.exchangedJm2/1000)}, stored change ${display(candidate.final.storedJm2/1000)} kJ/m².`));
      const rows = [...candidate.calibration.rows, ...candidate.challenge.rows].sort((a, b) => a.index - b.index);
      detail.append(table(['Minute / use', 'Reading ± half-width · °C', 'Prediction · °C', 'Within bounds?', 'Reading source'], rows.map(r => {
        const reading = evidence.readings[r.index]; return [`${display(r.minute)} · ${reading.use}`, `${display(reading.temperatureC)} ± ${display(reading.halfWidthC)}`, display(r.predictionC), r.withinBand ? 'Yes' : 'No', reading.source];
      })));
      host.append(detail);
    });
    host.append(node('p', `Association source: ${evidence.associationSource}`));
  }
  $('heat-evidence-run').addEventListener('click', () => {
    if (dirty) return;
    const project = structuredClone(getProject()), request = ++generation; $('heat-evidence-run').disabled = true;
    setTimeout(() => {
      try {
        if (request !== generation) return;
        const result = compareHeatEvidence(project);
        if (request !== generation || JSON.stringify(getProject()) !== JSON.stringify(project)) return;
        $('heat-evidence-status').dataset.state = result.status;
        $('heat-evidence-status').textContent = statuses[result.status] ?? (result.status === 'no-evidence' ? 'Save temperature evidence first.' : 'The retained heat declaration or place changed. Preserve the original project before clearing and associating new evidence.');
        $('heat-evidence-results').replaceChildren(); if (result.candidates) draw(result, project.surfaceHeatEvidence);
      } catch (error) { invalidate(error.message, 'refused'); notice(error.message); }
      finally { $('heat-evidence-run').disabled = dirty; }
    }, 20);
  });
  function refresh() {
    const project = getProject(), next = JSON.stringify(project); if (next === signature && project === lastProject) return;
    signature = next; lastProject = project; dirty = false; fill(project.surfaceHeatEvidence); $('heat-evidence-run').disabled = false;
    invalidate('Compare the retained temperature evidence after any workspace change.');
  }
  return { refresh };
}
