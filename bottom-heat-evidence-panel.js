import { prepareBottomEvidence, compareBottomEvidence, serializeBottomEvidence, parseBottomEvidence, BOTTOM_EVIDENCE_FILE_LIMIT } from './bottom-heat-evidence.js';
import { canonicalBottomHeatStudy } from './bottom-heat-study.js';
const node = (tag, text = '') => { const e = document.createElement(tag); e.textContent = text; return e; };
const show = x => Number(x).toLocaleString('en-US', { maximumFractionDigits: 5 });
const rangeText = r => {
  if (!r) return 'No established interval';
  const ends = r.map(show);
  // Never display a nonzero inferred interval as one rounded temperature.
  if (r[0] !== r[1] && ends[0] === ends[1]) return String(r[0]) + ' to ' + String(r[1]) + ' °C (nonzero interval)';
  return ends[0] + ' to ' + ends[1] + ' °C';
};
const conductanceText = b => b > 0 && b < 1e-4 ? b.toExponential(2) : show(b);
const svg = (tag, attrs = {}) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); return e; };

export function mountBottomHeatEvidence({ getOriginal, notice }) {
  const panel = node('section'); panel.id = 'bottom-evidence'; panel.style.minWidth = '0'; panel.style.overflowWrap = 'anywhere';
  panel.innerHTML = '<h3>Which deep-reservoir alternatives survive surface readings?</h3>' +
    '<p>Keep the accepted original heat exposure, capacities and initial states fixed. Offer bottom conductances and continuous reservoir ranges, then compare sourced instantaneous or interval-mean surface readings.</p>' +
    '<button id="bottom-evidence-source" type="button">Use retained accepted original source</button>' +
    '<p id="bottom-evidence-basis">No original source retained here yet.</p>' +
    '<form id="bottom-evidence-form"><label class="input-label">Observed place<select id="bottom-evidence-target"><option value="existing">Existing place</option><option value="proposal">Proposed place</option></select></label>' +
    '<label class="input-label">How these original readings belong to this place and exposure<textarea id="bottom-evidence-association" maxlength="600" required></textarea></label>' +
    '<h4>Offered bottom-conductance alternatives</h4><div id="bottom-evidence-hypotheses"></div><button id="bottom-evidence-add-hypothesis" type="button">Add conductance alternative</button>' +
    '<h4>Original surface-temperature readings</h4><div id="bottom-evidence-readings"></div><button id="bottom-evidence-add-reading" type="button">Add original reading</button>' +
    '<p><button type="submit">Compare reservoir intervals</button></p></form>' +
    '<p id="bottom-evidence-status" role="status"></p><button id="bottom-evidence-download" type="button" disabled>Download original surface investigation</button>' +
    '<button id="bottom-evidence-restore" type="button" disabled>Restore accepted surface investigation</button>' +
    '<label class="input-label">Reopen original surface investigation<input id="bottom-evidence-file" type="file" accept=".json,application/json"></label>' +
    '<div id="bottom-evidence-results"></div>';
  document.getElementById('bottom-heat').append(panel);
  const $ = id => panel.querySelector('#' + id);
  let original = null, accepted = null, revision = 0, dirty = false;
  const status = text => { $('bottom-evidence-status').textContent = text; };
  function invalidate(text = 'Draft changed. Compare again or restore the accepted original investigation.') {
    revision++; dirty = true; $('bottom-evidence-results').replaceChildren();
    $('bottom-evidence-download').disabled = true; $('bottom-evidence-restore').disabled = !accepted; status(text);
  }
  function field(parent, key, label, value, options = {}) {
    const wrapper = node('label', label); wrapper.className = 'input-label';
    const input = options.choices ? node('select') : options.text ? node('textarea') : node('input');
    input.dataset.key = key;
    if (options.choices) for (const [v, title] of options.choices) { const option = node('option', title); option.value = v; input.append(option); }
    else if (options.text) { input.maxLength = options.limit ?? 600; input.rows = 2; }
    else { input.type = 'number'; input.step = 'any'; if (options.min !== undefined) input.min = options.min; if (options.max !== undefined) input.max = options.max; }
    input.value = value ?? ''; input.required = true; wrapper.append(input); parent.append(wrapper); return input;
  }
  function removeButton(parent) {
    const button = node('button', 'Remove this declaration'); button.type = 'button';
    button.addEventListener('click', () => { parent.remove(); invalidate(); }); parent.append(button);
  }
  function addHypothesis(h = {}) {
    if ($('bottom-evidence-hypotheses').children.length >= 9) throw Error('Offer at most nine conductance alternatives');
    const row = node('fieldset'); row.style.minWidth = '0'; row.dataset.kind = 'hypothesis';
    row.append(node('legend', 'Declared bottom alternative'));
    field(row, 'label', 'Label', h.label, { text: true, limit: 80 });
    field(row, 'conductance', 'Bottom conductance · W/(m²·K)', h.conductanceWm2K, { min: 0, max: 1000 });
    field(row, 'low', 'Lowest declared reservoir temperature · °C', h.reservoirRangeC?.[0], { min: -100, max: 200 });
    field(row, 'high', 'Highest declared reservoir temperature · °C', h.reservoirRangeC?.[1], { min: -100, max: 200 });
    field(row, 'source', 'Source or basis for this conductance and continuous range', h.source, { text: true });
    removeButton(row); $('bottom-evidence-hypotheses').append(row);
  }
  function addReading(r = {}) {
    if ($('bottom-evidence-readings').children.length >= 100) throw Error('Retain at most 100 original readings');
    const row = node('fieldset'); row.style.minWidth = '0'; row.dataset.kind = 'reading'; row.append(node('legend', 'Original surface reading'));
    const aggregation = field(row, 'aggregation', 'What was measured?', r.aggregation ?? 'instant', {
      choices: [['instant', 'Instantaneous surface temperature'], ['interval-mean', 'Mean over the complete interval']] });
    const start = field(row, 'from', 'Interval start · elapsed minutes', r.fromMinute, { min: 0 });
    field(row, 'minute', 'Reading time or interval end · elapsed minutes', r.minute, { min: 0 });
    field(row, 'temperature', 'Original surface temperature · °C', r.temperatureC, { min: -100, max: 500 });
    field(row, 'width', 'Declared comparison half-width · °C', r.halfWidthC, { min: 0, max: 100 });
    field(row, 'use', 'Evidence role', r.use ?? 'calibration', { choices: [['calibration', 'Calibration'], ['challenge', 'Held aside']] });
    field(row, 'source', 'Original reading source and method', r.source, { text: true });
    const operator = () => { const mean = aggregation.value === 'interval-mean'; start.disabled = !mean; start.required = mean; start.parentElement.hidden = !mean; };
    aggregation.addEventListener('change', () => { operator(); invalidate(); }); operator();
    removeButton(row); $('bottom-evidence-readings').append(row);
  }
  function fill(e) {
    original = canonicalBottomHeatStudy(e.original);
    $('bottom-evidence-target').value = e.target; $('bottom-evidence-association').value = e.associationSource;
    $('bottom-evidence-hypotheses').replaceChildren(); $('bottom-evidence-readings').replaceChildren();
    for (const h of e.hypotheses) addHypothesis(h); for (const r of e.readings) addReading(r);
    $('bottom-evidence-basis').textContent = 'Retained original source with ' + original.heatColumnStudy.heatStudy.schedule.length +
      ' exposure intervals. It is independent of later working-site or bottom-draft changes.';
  }
  const inputValue = (row, key) => row.querySelector('[data-key="' + key + '"]').value;
  function number(row, key) { const value = inputValue(row, key); if (!value.trim()) throw Error('Enter each required numeric declaration'); return Number(value); }
  function readDraft() {
    if (!original) throw Error('Retain an accepted original heat source first');
    const hypotheses = [...$('bottom-evidence-hypotheses').children].map(row => ({
      label: inputValue(row, 'label'), conductanceWm2K: number(row, 'conductance'),
      reservoirRangeC: [number(row, 'low'), number(row, 'high')], source: inputValue(row, 'source') }));
    const readings = [...$('bottom-evidence-readings').children].map(row => ({
      minute: number(row, 'minute'), temperatureC: number(row, 'temperature'), halfWidthC: number(row, 'width'),
      use: inputValue(row, 'use'), source: inputValue(row, 'source'),
      ...(inputValue(row, 'aggregation') === 'interval-mean' ? { aggregation: 'interval-mean', fromMinute: number(row, 'from') } : {}) }));
    return prepareBottomEvidence(original, { target: $('bottom-evidence-target').value,
      associationSource: $('bottom-evidence-association').value, hypotheses, readings });
  }
  function render(report) {
    const host = node('div'); host.append(node('p', report.meaning), node('p',
      report.counts.calibration + ' calibration readings; ' + report.counts.challenge + ' held-aside readings. ' +
      'No parameter or bottom boundary is applied to the working site.'));
    const domain = report.evidence.hypotheses.flatMap(h => h.reservoirRangeC), low = Math.min(...domain), high = Math.max(...domain);
    const x = v => 60 + 245 * (high === low ? .5 : (v - low) / (high - low));
    const chart = svg('svg', { viewBox: '0 0 320 ' + (45 + report.candidates.length * 48), role: 'img',
      'aria-label': 'Continuous reservoir intervals by declared bottom conductance: calibration orange and surviving blue' });
    chart.style.width = '100%'; chart.style.maxWidth = '30rem';
    for (const [value, anchor] of (low === high ? [[low, 'middle']] : [[low, 'start'], [high, 'end']])) {
      const label = svg('text', { x: x(value), y: 15, 'text-anchor': anchor, 'font-size': 12 });
      label.textContent = show(value) + ' °C'; chart.append(label);
    }
    report.candidates.forEach((c, i) => {
      const y = 37 + i * 48, label = svg('text', { x: 2, y: y + 4, 'font-size': 12 });
      label.textContent = 'b=' + conductanceText(c.hypothesis.conductanceWm2K); chart.append(label);
      chart.append(svg('line', { x1: x(c.hypothesis.reservoirRangeC[0]), x2: x(c.hypothesis.reservoirRangeC[1]),
        y1: y, y2: y, stroke: '#c4ceca', 'stroke-width': 2 }));
      for (const [range, color, offset] of [[report.counts.calibration ? c.calibrationRangeC : null, '#b56b3b', 8], [report.counts.calibration && report.counts.challenge ? c.survivingRangeC : null, '#286a91', 19]]) {
        if (range) chart.append(svg('line', { x1: x(range[0]), x2: Math.max(x(range[0]) + 1, x(range[1])),
          y1: y + offset, y2: y + offset, stroke: color, 'stroke-width': 5 }));
      }
    });
    host.append(chart, node('p', 'Grey: declared range; orange: calibration interval; blue: intersection with held-aside bands. ' +
      'These nominal intervals use the original bands. Numerical-contact alternatives remain separately visible below.'));
    for (const c of report.candidates) {
      const article = node('article'); article.append(node('h4', c.hypothesis.label + ' · ' + c.hypothesis.conductanceWm2K + ' W/(m²·K)'));
      article.append(node('p', c.status.replaceAll('-', ' ')));
      if (c.status === 'numerical-contact') article.append(node('p', 'Only arithmetic-allowance support remains, or endpoint sensitivity is unresolved. This is not a band-established parameter interval.'));
      if (c.reason) article.append(node('p', 'Complete course not computed: ' + c.reason));
      article.append(node('p', 'Declared reservoir: ' + rangeText(c.hypothesis.reservoirRangeC) + '. ' + c.hypothesis.source));
      article.append(node('p', 'Calibration: ' + rangeText(c.calibrationRangeC) + '; held-aside alone: ' +
        rangeText(c.challengeRangeC) + '; common interval: ' + rangeText(c.survivingRangeC) + '.'));
      const guards = node('details'); guards.append(node('summary', 'Separate arithmetic-allowance intervals'),
        node('p', 'Calibration: ' + rangeText(c.calibrationWithAllowanceC) + '; held-aside: ' +
          rangeText(c.challengeWithAllowanceC) + '; common: ' + rangeText(c.survivingWithAllowanceC) +
          '. The allowance is numerical, not added measurement uncertainty or a certified enclosure.'));
      article.append(guards);
      for (const row of c.rows) {
        const r = row.reading, detail = node('details');
        detail.append(node('summary', (r.use === 'challenge' ? 'Held aside' : 'Calibration') + ' · ' +
          (r.aggregation === 'interval-mean' ? show(r.fromMinute) + '–' + show(r.minute) + ' min mean' : show(r.minute) + ' min instant')));
        detail.append(node('p', 'Original ' + show(r.temperatureC) + ' ± ' + show(r.halfWidthC) + ' °C. ' + r.source),
          node('p', 'Predictions at declared reservoir ends: ' + row.predictionsAtRangeEndsC.map(show).join(' / ') +
            ' °C. Sensitivity: ' + row.sensitivity + '. This reading permits ' + rangeText(row.nominalRangeC) + '.'),
          node('p', 'Arithmetic allowance ' + row.arithmeticGuardC.toExponential(3) + ' °C; allowance interval ' + rangeText(row.arithmeticRangeC) + '.'));
        article.append(detail);
      }
      host.append(article);
    }
    const sources = node('details'); sources.append(node('summary', 'Original heat source and reading association'));
    const raw = node('pre', JSON.stringify({ original: report.evidence.original, associationSource: report.evidence.associationSource }, null, 2));
    raw.style.whiteSpace = 'pre-wrap'; raw.style.overflowWrap = 'anywhere'; sources.append(raw); host.append(sources);
    return host;
  }
  function accept(evidence) {
    const raw = serializeBottomEvidence(evidence), retained = parseBottomEvidence(raw);
    const report = compareBottomEvidence(retained), view = render(report);
    accepted = retained; original = canonicalBottomHeatStudy(retained.original); dirty = false;
    $('bottom-evidence-results').replaceChildren(view); $('bottom-evidence-download').disabled = false;
    $('bottom-evidence-restore').disabled = true; status('Compared original surface bands. All alternatives and separate calibration/challenge intervals are retained.');
    return report;
  }
  $('bottom-evidence-source').addEventListener('click', () => {
    try {
      const source = getOriginal(); if (!source) throw Error('First compare or reopen an accepted original bottom-heat investigation');
      const next = canonicalBottomHeatStudy(source); invalidate('Retained a new original source. Add original readings; earlier reading values were not copied.');
      original = next; $('bottom-evidence-hypotheses').replaceChildren(); $('bottom-evidence-readings').replaceChildren();
      $('bottom-evidence-association').value = ''; $('bottom-evidence-target').value = 'existing';
      $('bottom-evidence-basis').textContent = 'Original accepted heat source retained with ' +
        next.heatColumnStudy.heatStudy.schedule.length + ' intervals; subsequent working changes will not rewrite it.';
      addHypothesis(); addReading();
    } catch (error) { status(error.message); notice(error.message); }
  });
  $('bottom-evidence-add-hypothesis').addEventListener('click', () => { try { addHypothesis(); invalidate(); } catch (e) { notice(e.message); } });
  $('bottom-evidence-add-reading').addEventListener('click', () => { try { addReading(); invalidate(); } catch (e) { notice(e.message); } });
  $('bottom-evidence-form').addEventListener('input', () => invalidate());
  $('bottom-evidence-form').addEventListener('change', () => invalidate());
  $('bottom-evidence-form').addEventListener('submit', e => { e.preventDefault(); revision++;
    try { accept(readDraft()); } catch (error) { status('Comparison refused: ' + error.message); notice(error.message); } });
  $('bottom-evidence-restore').addEventListener('click', () => { if (!accepted) return; revision++;
    try { const e = accepted; accept(e); fill(e); } catch (error) { status(error.message); notice(error.message); } });
  $('bottom-evidence-download').addEventListener('click', () => {
    if (!accepted || dirty) return;
    const url = URL.createObjectURL(new Blob([serializeBottomEvidence(accepted)], { type: 'application/json' }));
    const link = node('a'); link.href = url; link.download = 'bottom-surface-investigation.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('bottom-evidence-file').addEventListener('change', async () => {
    const file = $('bottom-evidence-file').files?.[0]; if (!file) return;
    $('bottom-evidence-file').value = ''; const request = ++revision;
    try {
      if (file.size > BOTTOM_EVIDENCE_FILE_LIMIT) throw Error('Evidence file exceeds the 4 MiB limit');
      const raw = await file.text(); if (request !== revision) return;
      const e = parseBottomEvidence(raw); if (request !== revision) return;
      accept(e); fill(e);
    } catch (error) { if (request === revision) { status('Replacement refused; accepted source and current draft retained. ' + error.message); notice(error.message); } }
  });
}
