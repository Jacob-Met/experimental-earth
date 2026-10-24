import { prepareSurfaceHeatStudy, compareSurfaceHeat, inspectSurfaceHeat } from './surface-heat.js';
import { surfaceHeatContext } from './surface-heat-contract.js';
import { parseHeatSchedule, formatHeatSchedule } from './surface-heat-table.js';

const node = (tag, text = '') => { const e = document.createElement(tag); e.textContent = text; return e; };
const svgNode = (tag, attrs = {}) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); return e; };
const display = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 3 });
const cellName = (p, i) => `${String.fromCharCode(65 + i % p.width)}${Math.floor(i / p.width) + 1}`;
const targets = ['existing', 'proposal'];
const fields = [
  ['absorptivity', 'Absorbed fraction of incident input', 0, 1],
  ['capacityJm2K', 'Layer heat capacity · J/(m²·K)', 1000, 10000000],
  ['exchangeWm2K', 'Linear exchange · W/(m²·K)', 0, 1000],
  ['initialC', 'Initial layer temperature · °C', -100, 200],
];

export function mountSurfaceHeat({ getProject, replaceProject, notice }) {
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('./surface-heat.css', import.meta.url); document.head.append(link);
  const panel = node('section'); panel.id = 'surface-heat'; panel.className = 'panel study';
  panel.innerHTML = `<span class="eyebrow">HEAT / DECLARED LAYER EXPERIMENT</span><h2>How does a surface warm up and cool down?</h2>
    <p>Compare two uniform layers at one site cell under the same supplied exposure. Absorption changes incoming heat; capacity changes how quickly it warms and cools. Every property is a declaration with its own source.</p>
    <form id="heat-form"><label class="input-label">Place in the current grid<select id="heat-cell"></select></label>
    <div class="heat-layers">${targets.map(target => `<fieldset><legend>${target === 'existing' ? 'Existing layer' : 'Proposed layer'}</legend>${fields.map(([key, label, min, max]) => `<label class="input-label">${label}<input id="heat-${target}-${key}" type="number" min="${min}" max="${max}" step="any" required></label>`).join('')}<label class="input-label">Source or basis for these layer properties<textarea id="heat-${target}-source" maxlength="600" rows="3" required></textarea></label></fieldset>`).join('')}</div>
    <label class="input-label">Consecutive exposure intervals · CSV<textarea id="heat-schedule" rows="5" maxlength="16000" spellcheck="false" required></textarea></label>
    <p class="mini-note">Columns: <code>minutes,incident_w_m2,reservoir_c,source</code>. Each row starts when the previous ends. Use zero incident input to explore cooling. Both layers receive the same incident input and reservoir temperature; sources containing commas can be quoted.</p>
    <div class="obs-actions"><button id="heat-save" type="submit">Save heat declaration</button><button id="heat-example" type="button">Load fictional heating / cooling draft</button><button id="heat-clear" type="button">Clear retained heat study</button></div></form>
    <p class="heat-assumptions">This experiment assumes uniform layer temperature and constant properties, with linear exchange to a supplied thermal reservoir. Nonlinear radiation, evaporation, internal gradients and heat transport between cells are omitted. It does not predict human comfort or infer properties from the site's surface labels.</p>
    <button id="heat-run" class="primary" type="button">Compare saved layers</button><p id="heat-status" role="status"></p><div id="heat-results"></div>`;
  document.querySelector('.observations').before(panel);
  const $ = id => panel.querySelector('#' + id);
  let signature = '', lastProject = null, generation = 0, report = null, dirty = false;
  function invalidate(message, state = 'not-compared') {
    generation++; report = null; $('heat-results').replaceChildren();
    $('heat-status').textContent = message; $('heat-status').dataset.state = state;
  }
  function draftChanged() {
    dirty = true; $('heat-run').disabled = true;
    invalidate('Draft changed. Save the declaration before comparing.');
  }
  function fill(study) {
    $('heat-cell').value = String(study?.cellIndex ?? getProject().selectedIndex ?? 0);
    for (const target of targets) {
      for (const [key] of fields) $(`heat-${target}-${key}`).value = study?.[target]?.[key] ?? '';
      $(`heat-${target}-source`).value = study?.[target]?.source ?? '';
    }
    $('heat-schedule').value = study ? formatHeatSchedule(study.schedule) : 'minutes,incident_w_m2,reservoir_c,source\n';
  }
  for (const input of panel.querySelectorAll('form input, form textarea, form select')) input.addEventListener('input', draftChanged);
  $('heat-example').addEventListener('click', () => {
    fill({ cellIndex: getProject().surfaceHeatStudy?.cellIndex ?? getProject().selectedIndex ?? 0,
      existing: { absorptivity: .85, capacityJm2K: 40000, exchangeWm2K: 12, initialC: 25, source: 'Fictional thin layer; illustrative constants, not a measured material' },
      proposal: { absorptivity: .45, capacityJm2K: 160000, exchangeWm2K: 12, initialC: 25, source: 'Fictional more reflective layer with fourfold heat capacity; not a measured proposal' },
      schedule: [{ minutes: 60, incidentWm2: 600, reservoirC: 25, source: 'Authored constant heating interval' },
        { minutes: 360, incidentWm2: 0, reservoirC: 25, source: 'Authored cooling interval at the same reservoir temperature' }] });
    draftChanged();
  });
  $('heat-clear').addEventListener('click', () => {
    const next = structuredClone(getProject()); delete next.surfaceHeatStudy; replaceProject(next);
  });
  $('heat-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const current = getProject(), old = current.surfaceHeatStudy, cellIndex = Number($('heat-cell').value);
      if (old && (old.cellIndex !== cellIndex || old.contextJson !== surfaceHeatContext(current, old.cellIndex))) {
        throw Error('The saved place changed. Export the project to preserve it, then clear this heat study before declaring another place.');
      }
      const input = { cellIndex, schedule: parseHeatSchedule($('heat-schedule').value) };
      for (const target of targets) {
        input[target] = { source: $(`heat-${target}-source`).value };
        for (const [key] of fields) {
          const value = $(`heat-${target}-${key}`).value;
          if (value.trim() === '') throw Error('Enter every declared layer property');
          input[target][key] = Number(value);
        }
      }
      const next = structuredClone(current); next.surfaceHeatStudy = prepareSurfaceHeatStudy(current, input);
      // Evaluate before changing the workspace, so an unsupported trajectory cannot replace a working study.
      compareSurfaceHeat(next);
      replaceProject(next);
      dirty = false; $('heat-run').disabled = false;
      invalidate('Heat declaration saved with its original place and sources. Compare to inspect its response.');
    } catch (error) { notice(error.message); invalidate(error.message, 'refused'); }
  });
  function inspect(study, minute) {
    const value = inspectSurfaceHeat(study, minute), host = $('heat-inspect'); host.replaceChildren();
    host.append(node('h3', `${display(minute)} minutes · proposed minus existing ${display(value.differenceC)} °C`));
    host.dataset.differenceC = String(value.differenceC);
    const cards = node('div'); cards.className = 'heat-layers';
    for (const target of targets) {
      const row = value[target], card = node('article'); card.className = 'heat-result-card'; card.dataset.scenario = target;
      card.dataset.temperatureC = String(row.temperatureC);
      card.append(node('h4', target === 'existing' ? 'Existing layer' : 'Proposed layer'), node('strong', `${display(row.temperatureC)} °C`),
        node('p', `Absorbed input: ${display(row.inputJm2 / 1000)} kJ/m². Exchange out: ${display(row.exchangedJm2 / 1000)} kJ/m². Stored change: ${display(row.storedJm2 / 1000)} kJ/m².`));
      cards.append(card);
    }
    host.append(cards, node('p', 'Exchange out is signed: a negative value means the reservoir supplied heat. All energies are per square metre, relative to the declared initial temperature.'));
  }
  function draw(result, study) {
    const host = $('heat-results'); host.replaceChildren();
    const context = JSON.parse(study.contextJson);
    host.append(node('h3', `Declared layers at ${cellName(context, study.cellIndex)}`));
    const chart = svgNode('svg', { viewBox: '0 0 700 270', role: 'img', 'aria-label': 'Modeled layer temperature in degrees Celsius versus elapsed minutes; existing orange and proposed green' });
    chart.id = 'heat-chart';
    const values = result.trajectory.flatMap(row => targets.map(k => row[k].temperatureC));
    const low = Math.min(...values), high = Math.max(...values), pad = Math.max(1, (high - low) * .08);
    const xx = t => 75 + 585 * t / result.durationMinutes, yy = v => 225 - 205 * (v - (low - pad)) / (high - low + 2 * pad);
    for (let i = 0; i <= 4; i++) {
      const v = low - pad + (high - low + 2 * pad) * i / 4;
      chart.append(svgNode('line', { x1: 75, x2: 660, y1: yy(v), y2: yy(v), stroke: '#dce6df' }));
      const label = svgNode('text', { x: 67, y: yy(v) + 4, 'text-anchor': 'end' }); label.textContent = v.toFixed(1); chart.append(label);
      const time = svgNode('text', { x: xx(result.durationMinutes * i / 4), y: 245, 'text-anchor': 'middle' }); time.textContent = display(result.durationMinutes * i / 4); chart.append(time);
    }
    for (const target of targets) chart.append(svgNode('path', { d: result.trajectory.map((row, i) => `${i ? 'L' : 'M'}${xx(row.minute)},${yy(row[target].temperatureC)}`).join(' '),
      fill: 'none', stroke: target === 'existing' ? '#b56b3b' : '#167c69', 'stroke-width': 3, 'data-scenario': target }));
    host.append(chart, node('p', 'Vertical: layer °C · Horizontal: elapsed minutes · Orange: existing · Green: proposed'));
    const peaks = node('p', `Maximum over the supplied intervals: existing ${display(result.summary.existing.maximumC)} °C; proposed ${display(result.summary.proposal.maximumC)} °C. Final difference: ${display(result.summary.proposal.final.temperatureC - result.summary.existing.final.temperatureC)} °C.`);
    peaks.id = 'heat-summary'; host.append(peaks);
    const label = node('label', 'Inspect elapsed time · minutes'); label.className = 'input-label';
    const slider = node('input'); slider.id = 'heat-minute'; slider.type = 'range'; slider.min = 0; slider.max = result.durationMinutes; slider.step = 'any'; slider.value = result.durationMinutes;
    label.append(slider); const details = node('div'); details.id = 'heat-inspect'; host.append(label, details);
    slider.addEventListener('input', () => inspect(study, Number(slider.value))); inspect(study, result.durationMinutes);
    const evidence = node('details'); evidence.id = 'heat-evidence'; evidence.append(node('summary', 'Inspect retained inputs and energy accounting'));
    for (const target of targets) evidence.append(node('p', `${target}: ${study[target].source}`));
    let minute = 0;
    for (const row of study.schedule) { evidence.append(node('p', `${display(minute)}–${display(minute + row.minutes)} min: incident ${display(row.incidentWm2)} W/m², reservoir ${display(row.reservoirC)} °C. ${row.source}`)); minute += row.minutes; }
    const error = Math.max(...result.trajectory.flatMap(row => targets.map(k => Math.abs(row[k].balanceResidualJm2))));
    evidence.append(node('p', `Maximum arithmetic energy residual: ${error.toExponential(3)} J/m². This checks the declared equation's bookkeeping; it does not establish that the model describes the place.`));
    host.append(evidence);
  }
  $('heat-run').addEventListener('click', () => {
    if (dirty) return;
    const p = structuredClone(getProject()), request = ++generation; $('heat-run').disabled = true;
    setTimeout(() => {
      try {
        if (request !== generation) return;
        const result = compareSurfaceHeat(p);
        if (request !== generation || JSON.stringify(getProject()) !== JSON.stringify(p)) return;
        report = result.status === 'compared' ? result : null;
        $('heat-status').dataset.state = result.status;
        $('heat-status').textContent = result.status === 'compared' ? `Compared the saved ${display(result.durationMinutes)}-minute exposure. Inspect both heating and later cooling before interpreting a difference.` :
          result.status === 'no-study' ? 'Save a sourced layer declaration first.' : 'The selected place or its source changed. The heat declaration remains attached to the original place; export it before clearing and redeclaring.';
        $('heat-results').replaceChildren(); if (report) draw(report, p.surfaceHeatStudy);
      } catch (error) { invalidate(error.message, 'refused'); notice(error.message); }
      finally { $('heat-run').disabled = dirty; }
    }, 20);
  });
  function refresh() {
    const p = getProject(), next = JSON.stringify(p); if (next === signature && p === lastProject) return;
    signature = next; lastProject = p; dirty = false; invalidate('Compare the retained declaration after any site change.');
    $('heat-cell').replaceChildren();
    for (let i = 0; i < p.width * p.height; i++) { const option = node('option', cellName(p, i)); option.value = String(i); $('heat-cell').append(option); }
    fill(p.surfaceHeatStudy); $('heat-run').disabled = false;
  }
  return { refresh };
}
