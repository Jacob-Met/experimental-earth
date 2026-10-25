import { mountBottomHeatEvidence } from './bottom-heat-evidence-panel.js';
import { prepareBottomHeatStudy, canonicalBottomHeatStudy, compareBottomHeatStudy, inspectBottomHeatStudy } from './bottom-heat-study.js';
import { evaluateHeatColumnTarget } from './heat-column.js';
import { heatColumnCurrent } from './heat-column-contract.js';
const node = (tag, text = '') => { const n = document.createElement(tag); n.textContent = text; return n; };
const svg = (tag, attrs = {}) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); return n;
};
const targets = ['existing', 'proposal'], cap = 4 * 1024 * 1024;
const show = v => Number(v).toLocaleString('en-US', { maximumFractionDigits: 4 });
const energy = [['Absorbed input', 'inputJm2'], ['Ambient exchange out', 'exchangeOutJm2'],
  ['Internal transfer down', 'transferDownJm2'], ['Bottom exchange out', 'bottomOutJm2'],
  ['Surface stored change', 'surfaceStoredJm2'], ['Lower stored change', 'subsurfaceStoredJm2'],
  ['Total balance residual', 'balanceResidualJm2'], ['Surface balance residual', 'surfaceBalanceResidualJm2'],
  ['Lower balance residual', 'subsurfaceBalanceResidualJm2']];

export function mountBottomHeat({ getProject, notice }) {
  const panel = node('section'); panel.id = 'bottom-heat'; panel.className = 'panel study'; panel.style.minWidth = '0';
  panel.innerHTML = '<span class="eyebrow">HEAT / LOWER BOUNDARY</span><h2>Does a deeper reservoir change heat recovery?</h2>' +
    '<p>Compare the saved two-store exposure with an explicitly exchanging lower boundary. The original insulated calculation remains visible.</p>' +
    '<form id="bottom-form">' + targets.map(t => '<fieldset style="min-width:0"><legend>' + t + ' place</legend>' +
      '<label class="input-label">Bottom conductance · W/(m²·K)<input id="bottom-' + t + '-conductance" type="number" min="0" max="1000" step="any" required></label>' +
      '<label class="input-label">Deep reservoir · °C<input id="bottom-' + t + '-temperature" type="number" min="-100" max="200" step="any" required></label>' +
      '<label class="input-label">Source or declared basis<textarea id="bottom-' + t + '-source" maxlength="600" required></textarea></label></fieldset>').join('') +
    '<button type="submit">Compare lower boundaries</button></form><p id="bottom-status" role="status"></p>' +
    '<button id="bottom-download" type="button" disabled>Download original investigation</button>' +
    '<button id="bottom-restore" type="button" disabled>Restore accepted investigation</button>' +
    '<label class="input-label">Reopen original investigation<input id="bottom-file" type="file" accept="application/json,.json"></label>' +
    '<div id="bottom-results"></div><p class="mini-note">The constant reservoir is declared, not a measured depth profile or inferred soil parameter. Positive bottom exchange removes heat; negative exchange supplies heat. These are conditional model results, not a validated environmental forecast.</p>';
  document.querySelector('#heat-column').after(panel);
  const $ = id => panel.querySelector('#' + id);
  const context = () => { const p = getProject(); return JSON.stringify({
    source: p.heatColumnStudy, current: !!p.heatColumnStudy && heatColumnCurrent(p, p.heatColumnStudy)
  }); };
  let accepted = null, revision = 0, dirty = false, imported = false, signature = context();
  const status = text => { $('bottom-status').textContent = text; };
  function invalidate(text) {
    revision++; dirty = true; $('bottom-download').disabled = true; $('bottom-restore').disabled = !accepted;
    $('bottom-results').replaceChildren(); status(text);
  }
  function fill(study) {
    for (const t of targets) {
      $('bottom-' + t + '-conductance').value = study.bottoms[t].conductanceWm2K;
      $('bottom-' + t + '-temperature').value = study.bottoms[t].reservoirC;
      $('bottom-' + t + '-source').value = study.bottoms[t].source;
    }
  }
  function render(study, report) {
    const host = node('div');
    for (const target of targets) {
      const s = report.summary[target];
      host.append(node('h3', target + ' place'), node('p', 'Surface maximum ' + show(s.surface.maximumC) +
        ' °C at ' + show(s.surface.maximumMinute) + ' min; lower maximum ' + show(s.subsurface.maximumC) +
        ' °C at ' + show(s.subsurface.maximumMinute) + ' min.'));
      const chart = svg('svg', { viewBox: '0 0 320 210', role: 'img',
        'aria-label': target + ' insulated and exchanging surface and lower temperature courses' });
      chart.style.width = '100%'; chart.style.maxWidth = '30rem';
      const traces = [['insulated', 'surfaceC', '#9a643e', '5 4'], ['exchanging', 'surfaceC', '#b14c17', ''],
        ['insulated', 'subsurfaceC', '#779bb2', '5 4'], ['exchanging', 'subsurfaceC', '#175f89', '']];
      const values = report.trajectory.flatMap(r => traces.map(([m, k]) => r[target][m][k]));
      const lo = Math.min(...values), hi = Math.max(...values), pad = Math.max(1, (hi - lo) * .08);
      const xx = t => 45 + 260 * t / report.durationMinutes, yy = v => 175 - 150 * (v - lo + pad) / (hi - lo + 2 * pad);
      for (let i = 0; i <= 4; i++) {
        const v = lo - pad + (hi - lo + 2 * pad) * i / 4;
        chart.append(svg('line', { x1: 45, x2: 305, y1: yy(v), y2: yy(v), stroke: '#dce6df' }));
        const label = svg('text', { x: 38, y: yy(v) + 4, 'text-anchor': 'end', 'font-size': 12 });
        label.textContent = v.toFixed(1); chart.append(label);
      }
      for (const [m, k, color, dash] of traces) chart.append(svg('path', {
        d: report.trajectory.map((r, i) => (i ? 'L' : 'M') + xx(r.minute) + ',' + yy(r[target][m][k])).join(' '),
        fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-dasharray': dash
      }));
      for (const ratio of [0, .5, 1]) {
        const label = svg('text', { x: xx(report.durationMinutes * ratio), y: 198, 'text-anchor': 'middle', 'font-size': 12 });
        label.textContent = show(report.durationMinutes * ratio); chart.append(label);
      }
      host.append(chart, node('p', 'Temperature °C over elapsed minutes. Orange: surface; blue: lower. Dashed: insulated; solid: exchanging. Lines connect modeled samples, boundaries and stationary points.'));
      const label = node('label', 'Inspect elapsed minutes'); label.className = 'input-label';
      const time = node('input'); time.type = 'range'; time.min = 0; time.max = report.durationMinutes;
      time.step = 'any'; time.value = report.durationMinutes; time.dataset.target = target; label.append(time);
      const inspection = node('div'); inspection.setAttribute('aria-live', 'polite'); host.append(label, inspection);
      function inspectTime() {
        const minute = Number(time.value), changed = inspectBottomHeatStudy(study, minute)[target];
        const baseline = evaluateHeatColumnTarget(study.heatColumnStudy, target, [minute]).trajectory.find(r => r.minute === minute);
        const table = node('table'); table.append(node('caption', show(minute) + ' minutes · °C'));
        for (const [name, key] of [['Surface temperature', 'surfaceC'], ['Lower temperature', 'subsurfaceC']]) {
          const tr = node('tr'); tr.append(node('th', name), node('td', 'Insulated ' + show(baseline[key])),
            node('td', 'Exchanging ' + show(changed[key]))); table.append(tr);
        }
        const scroll = node('div'); scroll.style.overflowX = 'auto'; scroll.tabIndex = 0; scroll.append(table);
        inspection.replaceChildren(scroll, node('p', 'Cumulative bottom exchange ' + show(changed.bottomOutJm2 / 1000) +
          ' kJ/m²; total balance residual ' + changed.balanceResidualJm2.toExponential(3) + ' J/m².'));
        inspection.dataset.surfaceC = String(changed.surfaceC); inspection.dataset.bottomOutJm2 = String(changed.bottomOutJm2);
      }
      time.addEventListener('input', inspectTime); inspectTime();
      const ledger = node('table'); ledger.append(node('caption', 'Final cumulative energy · J/m²'));
      for (const [name, key] of energy) {
        const tr = node('tr'); tr.append(node('th', name), node('td', key.includes('Residual') ? s.final[key].toExponential(3) : show(s.final[key]))); ledger.append(tr);
      }
      const scroll = node('div'); scroll.style.overflowX = 'auto'; scroll.tabIndex = 0; scroll.append(ledger); host.append(scroll);
      const detail = node('details'); detail.append(node('summary', 'Original ' + target + ' declarations'));
      const source = node('pre', JSON.stringify({ surface: study.heatColumnStudy.heatStudy[target],
        lower: study.heatColumnStudy.lowerLayers[target], bottom: study.bottoms[target],
        schedule: study.heatColumnStudy.heatStudy.schedule }, null, 2));
      source.style.whiteSpace = 'pre-wrap'; source.style.overflowWrap = 'anywhere'; detail.append(source); host.append(detail);
    }
    return host;
  }
  function accept(study, report, fromFile) {
    const retained = canonicalBottomHeatStudy(study);
    if (new TextEncoder().encode(JSON.stringify(retained, null, 2)).length > cap) {
      throw Error('The retained investigation exceeds the 4 MiB portable representation limit');
    }
    // Construct and calculate the entire replacement before committing custody.
    const view = render(retained, report);
    accepted = retained; imported = fromFile; dirty = false;
    $('bottom-results').replaceChildren(view); $('bottom-download').disabled = false; $('bottom-restore').disabled = true;
    status(fromFile ? 'Showing reopened original source, independently of the working site.' :
      'Compared the current saved two-store source with declared lower boundaries.');
  }
  $('bottom-form').addEventListener('input', () =>
    invalidate('Draft changed. Compare again; the previously accepted inputs remain retained until replacement.'));
  $('bottom-form').addEventListener('submit', event => {
    event.preventDefault(); revision++;
    try {
      const bottoms = Object.fromEntries(targets.map(t => {
        const c = $('bottom-' + t + '-conductance').value, r = $('bottom-' + t + '-temperature').value;
        if (!c.trim() || !r.trim()) throw Error('Enter every boundary value');
        return [t, { conductanceWm2K: Number(c), reservoirC: Number(r), source: $('bottom-' + t + '-source').value }];
      }));
      const study = prepareBottomHeatStudy(getProject(), bottoms), report = compareBottomHeatStudy(study);
      accept(study, report, false);
    } catch (error) { status('Comparison refused: ' + error.message); notice(error.message); }
  });
  $('bottom-restore').addEventListener('click', () => {
    if (!accepted) return; revision++;
    try {
      const study = structuredClone(accepted), report = compareBottomHeatStudy(study);
      accept(study, report, true); fill(study);
      status('Restored accepted original inputs; no working-site source was substituted.');
    } catch (error) { status('Restore refused: ' + error.message); notice(error.message); }
  });
  $('bottom-download').addEventListener('click', () => {
    if (!accepted || dirty) return;
    const raw = JSON.stringify(accepted, null, 2);
    if (new TextEncoder().encode(raw).length > cap) { notice('Investigation exceeds the 4 MiB transfer limit'); return; }
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' })), link = node('a');
    link.href = url; link.download = 'bottom-heat-investigation.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('bottom-file').addEventListener('change', async () => {
    const file = $('bottom-file').files?.[0]; if (!file) return;
    const request = ++revision; status('Reading replacement investigation; existing accepted inputs are retained.');
    try {
      if (file.size > cap) throw Error('Investigation exceeds the 4 MiB transfer limit');
      const raw = await file.text(); if (request !== revision) return;
      if (new TextEncoder().encode(raw).length > cap) throw Error('Investigation exceeds the 4 MiB transfer limit');
      const study = canonicalBottomHeatStudy(JSON.parse(raw)), report = compareBottomHeatStudy(study);
      if (request !== revision) return;
      accept(study, report, true); fill(study);
    } catch (error) {
      if (request === revision) {
        status('Replacement refused; prior accepted inputs and current draft remain unchanged. ' + error.message);
        notice(error.message);
      }
    } finally { if (request === revision) $('bottom-file').value = ''; }
  });
  mountBottomHeatEvidence({ getOriginal: () => accepted, notice });
  return { refresh() {
    const next = context(); if (next === signature) return; signature = next; revision++;
    if (imported && accepted && !dirty) {
      status('Showing reopened original source; the working heat declaration changed separately.'); return;
    }
    invalidate('Working heat declaration changed. Compare again or reopen an original investigation.');
  } };
}
