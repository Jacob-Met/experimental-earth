import { mountRainSensible } from './rain-sensible-panel.js';
import { mountBottomHeat } from './bottom-heat-panel.js';
import { prepareHeatColumnStudy, compareHeatColumn, inspectHeatColumn } from './heat-column.js';

const node = (tag, text = '') => { const e = document.createElement(tag); e.textContent = text; return e; };
const svg = (tag, attrs = {}) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, value] of Object.entries(attrs)) e.setAttribute(key, String(value)); return e; };
const display = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 3 });
const targets = ['existing', 'proposal'];
const fields = [
  ['capacityJm2K', 'Lower-store capacity · J/(m²·K)', 1000, 10000000],
  ['conductanceWm2K', 'Surface-to-lower conductance · W/(m²·K)', 0, 1000],
  ['initialC', 'Initial lower temperature · °C', -100, 200],
];

export function mountHeatColumn({ getProject, replaceProject, notice }) {
  const sheet = node('link'); sheet.rel = 'stylesheet'; sheet.href = new URL('./heat-column.css', import.meta.url); document.head.append(sheet);
  const panel = node('section'); panel.id = 'heat-column'; panel.className = 'panel study';
  panel.innerHTML = `<span class="eyebrow">HEAT / TWO DECLARED STORES</span><h2>Can heat keep building below the surface?</h2><p><a href="noaa-hourly.html" id="noaa-hourly-link">Investigate an original NOAA hourly station file</a> in a separate thermal experiment without changing this site.</p>
    <p>Add a lower heat store to the saved surface exposure. Its temperature can keep rising after the surface starts cooling. The original surface properties stay in place; each store has one uniform temperature, with no resolved depth.</p>
    <p id="column-basis" class="mini-note"></p>
    <form id="column-form"><div class="heat-layers">${targets.map(target => `<fieldset><legend>${target === 'existing' ? 'Existing place' : 'Proposed place'} · lower store</legend>${fields.map(([key, label, min, max]) => `<label class="input-label">${label}<input id="column-${target}-${key}" type="number" min="${min}" max="${max}" step="any" required></label>`).join('')}<label class="input-label">Source or basis for these lower-store values<textarea id="column-${target}-source" maxlength="600" rows="3" required></textarea></label></fieldset>`).join('')}</div>
    <div class="obs-actions"><button id="column-save" type="submit">Save two-layer declaration</button><button id="column-example" type="button">Fill authored lower-store draft</button><button id="column-clear" type="button">Clear two-layer study</button></div></form>
    <p class="mini-note">Absorbed heat enters the surface. The two stores exchange heat through the declared conductance; the lower boundary is insulated. Moisture, lateral conduction and nonlinear radiation are not included.</p>
    <button id="column-run" class="primary" type="button">Compare saved heat stores</button><p id="column-status" role="status"></p><div id="column-results"></div>`;
  document.querySelector('#surface-heat').after(panel);
  const rainSensiblePanel = mountRainSensible({getProject});
  const bottomPanel = mountBottomHeat({ getProject, notice });
  const $ = id => panel.querySelector('#' + id);
  let signature = '', generation = 0, dirty = false, report = null, accepted = null, selected = 'existing', minute = null;
  function invalidate(message, state = 'not-compared') {
    generation++; report = null; accepted = null; $('column-results').replaceChildren();
    $('column-status').textContent = message; $('column-status').dataset.state = state;
  }
  function changed() { dirty = true; $('column-run').disabled = true; invalidate('Draft changed. Save the declaration before comparing.'); }
  function fill(study) {
    for (const target of targets) {
      const p = study?.lowerLayers?.[target];
      for (const [key] of fields) $(`column-${target}-${key}`).value = p?.[key] ?? '';
      $(`column-${target}-source`).value = p?.source ?? '';
    }
  }
  for (const input of panel.querySelectorAll('form input, form textarea')) input.addEventListener('input', changed);
  $('column-example').addEventListener('click', () => {
    const heat = getProject().surfaceHeatStudy;
    fill({ lowerLayers: Object.fromEntries(targets.map(target => [target, { capacityJm2K: 80000, conductanceWm2K: 20,
      initialC: heat?.[target]?.initialC ?? 20, source: 'Authored illustrative lower heat store; no measured material, conductance or depth' }])) });
    changed();
  });
  $('column-clear').addEventListener('click', () => { const next = structuredClone(getProject()); delete next.heatColumnStudy; replaceProject(next); });
  $('column-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const lower = {};
      for (const target of targets) {
        lower[target] = { source: $(`column-${target}-source`).value };
        for (const [key] of fields) {
          const raw = $(`column-${target}-${key}`).value;
          if (!raw.trim()) throw Error('Enter every declared lower-store value');
          lower[target][key] = Number(raw);
        }
      }
      const next = structuredClone(getProject()); next.heatColumnStudy = prepareHeatColumnStudy(next, lower);
      compareHeatColumn(next); replaceProject(next); dirty = false; $('column-run').disabled = false;
      invalidate('Two-layer inputs saved with the original place and exposure. Compare to inspect their response.');
    } catch (error) { notice(error.message); invalidate(error.message, 'refused'); }
  });

  function inspect() {
    const row = inspectHeatColumn(accepted, minute)[selected], host = $('column-inspect'); host.replaceChildren();
    host.dataset.surfaceC = String(row.surfaceC); host.dataset.subsurfaceC = String(row.subsurfaceC);
    host.append(node('h3', display(minute) + ' minutes · ' + (selected === 'existing' ? 'existing place' : 'proposed place')));
    const stack = node('div'); stack.className = 'column-stores';
    for (const [name, field, cls] of [['Surface store', 'surfaceC', 'column-surface'], ['Lower store', 'subsurfaceC', 'column-lower']]) {
      const box = node('div'); box.className = cls; box.append(node('span', name), node('strong', display(row[field]) + ' °C')); stack.append(box);
    }
    const current = accepted.lowerLayers[selected].conductanceWm2K * (row.surfaceC - row.subsurfaceC);
    host.append(stack, node('p', 'Current heat transfer to the lower store: ' + display(current) + ' W/m². Negative means heat is returning to the surface.'));
    const table = node('table'); table.className = 'column-ledger';
    const caption = node('caption', 'Cumulative energy since the declared start · kJ/m²'); table.append(caption);
    const body = node('tbody');
    for (const [label, key] of [['Absorbed input', 'inputJm2'], ['Ambient exchange out', 'exchangeOutJm2'],
      ['Internal transfer down', 'transferDownJm2'], ['Surface stored change', 'surfaceStoredJm2'], ['Lower stored change', 'subsurfaceStoredJm2']]) {
      const tr = node('tr'), th = node('th', label); th.scope = 'row'; tr.append(th, node('td', display(row[key] / 1000))); body.append(tr);
    }
    table.append(body); host.append(table, node('p', 'A negative ambient exchange means the reservoir supplied heat. Internal transfer moves energy between the two stores; it is not another external input.'));
    const detail = node('details'); detail.append(node('summary', 'Inspect arithmetic balance residuals'));
    detail.append(node('p', 'Input minus ambient exchange minus total stored change: ' + row.balanceResidualJm2.toExponential(3) + ' J/m². Surface: ' + row.surfaceBalanceResidualJm2.toExponential(3) + '; lower: ' + row.subsurfaceBalanceResidualJm2.toExponential(3) + ' J/m². Floating-point residuals qualify the calculation, not the place.'));
    host.append(detail);
  }

  function draw() {
    if (!report || !accepted) return;
    const host = $('column-results'); host.replaceChildren();
    const label = node('label', 'Inspect one declared place'); label.className = 'input-label';
    const select = node('select'); select.id = 'column-target';
    for (const target of targets) { const option = node('option', target === 'existing' ? 'Existing place' : 'Proposed place'); option.value = target; select.append(option); }
    select.value = selected; label.append(select); host.append(label);
    select.addEventListener('change', () => { selected = select.value; draw(); });
    const width = Math.max(320, Math.min(700, host.clientWidth || 700)), left = 58, right = width - 18;
    const uniformField = selected === 'existing' ? 'uniformExistingC' : 'uniformProposalC';
    const values = report.trajectory.flatMap(row => [row[selected].surfaceC, row[selected].subsurfaceC,
      ...(report.uniform.status === 'available' ? [row[uniformField]] : [])]);
    const low = Math.min(...values), high = Math.max(...values), pad = Math.max(1, (high - low) * .08);
    const xx = t => left + (right - left) * t / report.durationMinutes;
    const yy = v => 220 - 195 * (v - low + pad) / (high - low + 2 * pad);
    const chart = svg('svg', { viewBox: '0 0 ' + width + ' 265', role: 'img', 'aria-label': 'Declared temperature traces: surface orange, lower store blue, original uniform surface dashed grey' });
    chart.id = 'column-chart';
    for (let i = 0; i <= 4; i++) {
      const v = low - pad + (high - low + 2 * pad) * i / 4;
      chart.append(svg('line', { x1: left, x2: right, y1: yy(v), y2: yy(v), stroke: '#dce6df' }));
      const tick = svg('text', { x: left - 8, y: yy(v) + 5, 'text-anchor': 'end' }); tick.textContent = v.toFixed(1); chart.append(tick);
    }
    for (const ratio of width < 500 ? [0, .5, 1] : [0, .25, .5, .75, 1]) {
      const tick = svg('text', { x: xx(report.durationMinutes * ratio), y: 245, 'text-anchor': 'middle' }); tick.textContent = display(report.durationMinutes * ratio); chart.append(tick);
    }
    const traces = [ ['surfaceC', '#b56b3b'], ['subsurfaceC', '#286a91'] ];
    for (const [field, color] of traces) chart.append(svg('path', { d: report.trajectory.map((row, i) => (i ? 'L' : 'M') + xx(row.minute) + ',' + yy(row[selected][field])).join(' '), fill: 'none', stroke: color, 'stroke-width': 3 }));
    if (report.uniform.status === 'available') chart.append(svg('path', { d: report.trajectory.map((row, i) => (i ? 'L' : 'M') + xx(row.minute) + ',' + yy(row[uniformField])).join(' '), fill: 'none', stroke: '#687571', 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
    host.append(chart, node('p', 'Temperature °C · elapsed minutes. Orange: surface. Blue: lower store. Dashed grey: original uniform surface without the added store.'));
    if (report.uniform.status !== 'available') host.append(node('p', 'Original uniform comparison unavailable: ' + report.uniform.reason));
    const summary = report.summary[selected];
    const peaks = node('p', 'Computed surface maximum ' + display(summary.surface.maximumC) + ' °C at ' + display(summary.surface.maximumMinute) + ' min; lower maximum ' + display(summary.subsurface.maximumC) + ' °C at ' + display(summary.subsurface.maximumMinute) + ' min.');
    peaks.id = 'column-summary'; peaks.dataset.lowerMaximumMinute = String(summary.subsurface.maximumMinute); peaks.dataset.lowerMaximumC = String(summary.subsurface.maximumC); host.append(peaks);
    const peak = node('button', 'Inspect lower-store maximum'); peak.type = 'button'; peak.id = 'column-peak'; host.append(peak);
    const timeLabel = node('label', 'Inspect elapsed time · minutes'); timeLabel.className = 'input-label';
    const slider = node('input'); slider.id = 'column-minute'; slider.type = 'range'; slider.min = 0; slider.max = report.durationMinutes; slider.step = 'any';
    minute = Math.min(minute ?? report.durationMinutes, report.durationMinutes); slider.value = minute; timeLabel.append(slider); host.append(timeLabel);
    const inspector = node('div'); inspector.id = 'column-inspect'; host.append(inspector);
    slider.addEventListener('input', () => { minute = Number(slider.value); inspect(); });
    peak.addEventListener('click', () => { minute = summary.subsurface.maximumMinute; slider.value = minute; inspect(); }); inspect();
    const sources = node('details'); sources.id = 'column-sources'; sources.append(node('summary', 'Inspect original declarations and calculation limits'));
    sources.append(node('p', 'Surface basis: ' + accepted.heatStudy[selected].source), node('p', 'Lower-store basis: ' + accepted.lowerLayers[selected].source));
    for (const interval of accepted.heatStudy.schedule) sources.append(node('p', display(interval.minutes) + ' min: ' + display(interval.incidentWm2) + ' W/m² incident, reservoir ' + display(interval.reservoirC) + ' °C. ' + interval.source));
    sources.append(node('p', report.semantics), node('p', 'Computed maxima include exposure boundaries and interior stationary points of the two-rate response. Plotted connecting lines use one-minute samples plus those turning points; neither depth nor sampling is a measured profile.'));
    host.append(sources);
  }

  $('column-run').addEventListener('click', () => {
    if (dirty) return;
    const project = structuredClone(getProject()), request = ++generation; $('column-run').disabled = true;
    setTimeout(() => {
      try {
        if (request !== generation) return;
        const next = compareHeatColumn(project);
        if (request !== generation || JSON.stringify(getProject()) !== JSON.stringify(project)) return;
        $('column-status').dataset.state = next.status;
        $('column-status').textContent = next.status === 'compared' ? 'Computed both source-bound two-layer responses. Inspect when surface and lower-store temperatures peak.' :
          next.status === 'no-study' ? 'Save a sourced two-layer declaration first.' : 'The place or heat exposure changed. The two-layer study remains attached to its original declaration; export it before clearing and declaring another.';
        report = null; accepted = null; $('column-results').replaceChildren();
        if (next.status === 'compared') { report = next; accepted = project.heatColumnStudy; draw(); }
      } catch (error) { notice(error.message); invalidate(error.message, 'refused'); }
      finally { $('column-run').disabled = dirty; }
    }, 20);
  });
  window.addEventListener('resize', () => { if (report) draw(); });
  function refresh() {
    rainSensiblePanel.refresh();
    bottomPanel.refresh();
    const project = getProject(), next = JSON.stringify(project); if (next === signature) return;
    signature = next; dirty = false; minute = null; fill(project.heatColumnStudy);
    invalidate('Compare the retained two-layer declaration after a place or exposure change.'); $('column-run').disabled = false;
    $('column-basis').textContent = project.surfaceHeatStudy ? 'Uses the saved surface properties and all ' + project.surfaceHeatStudy.schedule.length + ' exposure intervals, retaining their original place and sources.' : 'First save a sourced surface exposure in the heat experiment above.';
  }
  return { refresh };
}

