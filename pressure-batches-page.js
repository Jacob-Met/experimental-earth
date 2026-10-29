import { comparePressureBatches, normalizePressureBatchStudy, parsePressureBatches,
  serializePressureBatches, PRESSURE_BATCH_FILE_LIMIT, PRESSURE_BATCH_SCHEMA } from './pressure-batches.js';
import { pressureBatchExample } from './pressure-batches-example.js';

const $ = id => document.getElementById('batch-' + id);
const form = $('form');
const el = (tag, text, className) => {
  const n = document.createElement(tag); if (text !== undefined) n.textContent = text;
  if (className) n.className = className; return n;
};
const n = value => Number(value).toLocaleString('en-US', { maximumSignificantDigits: 5,
  notation: value !== 0 && (Math.abs(value) < .001 || Math.abs(value) >= 1e6) ? 'scientific' : 'standard' });
const tick = value => Number(value).toLocaleString('en-US', { maximumSignificantDigits: 3,
  notation: value !== 0 && (Math.abs(value) < .001 || Math.abs(value) >= 1e6) ? 'scientific' : 'standard' });
const original = value => Number(value).toLocaleString('en-US', { maximumSignificantDigits: 21,
  notation: value !== 0 && (Math.abs(value) < .001 || Math.abs(value) >= 1e6) ? 'scientific' : 'standard' });
const phase = value => ({ before: 'Before the addition', after: 'After the addition', 'no-addition': 'No addition at this time' })[value];
const classification = value => ({ inside: 'Inside the declared band', outside: 'Outside the declared band',
  'numerical-boundary': 'At a numerical band edge' })[value];
const roles = { calibration: 'Calibration', challenge: 'Held aside' };
const lists = { addition: $('additions'), hypothesis: $('hypotheses'), reading: $('readings') };
const limits = { addition: [1, 64], hypothesis: [2, 9], reading: [0, 100] };
const specs = {
  addition: [
    ['id', 'Batch reference', 'text'], ['minute', 'Original minute', 'number', 720],
    ['volume', 'Original amount', 'number', 1e9], ['unit', 'Original unit', [['L', 'L'], ['mL', 'mL']]],
    ['source', 'Batch source', 'text'],
  ],
  hypothesis: [
    ['id', 'Explanation reference', 'text'], ['conductivityMmHr', 'Conductivity K · mm/h', 'number', 2000],
    ['capillaryDriveMm', 'Capillary drive A · mm', 'number', 5000], ['moistureDeficit', 'Moisture deficit · fraction', 'number', 1],
    ['initialCumulativeMm', 'Cumulative infiltration at start · mm', 'number', 1e9], ['source', 'Parameter and initial-state basis', 'text'],
  ],
  reading: [
    ['id', 'Reading reference', 'text'], ['minute', 'Original minute', 'number', 720],
    ['phase', 'Side of the addition', [['', 'Choose the recorded phase'], ['before', 'Before the addition'], ['after', 'After the addition'], ['no-addition', 'No addition at this time']]],
    ['volume', 'Original amount', 'number', 1e9], ['uncertainty', 'Declared ± uncertainty', 'number', 1e9],
    ['unit', 'Original unit', [['L', 'L'], ['mL', 'mL']]],
    ['role', 'Use this reading as', [['', 'Choose a role'], ['calibration', 'Calibration'], ['challenge', 'Held aside']]],
    ['source', 'Original reading and uncertainty source', 'text'],
  ],
};
let epoch = 0, retained = null;
const counters = { addition: 0, hypothesis: 0, reading: 0 };
function invalidate(message) {
  epoch++; retained = null; $('results').replaceChildren(); $('download').disabled = true;
  $('run').disabled = false; $('status').textContent = message; $('import-status').textContent = '';
}
function updateButtons(kind) {
  const entries = [...lists[kind].children];
  $('add-' + kind).disabled = entries.length >= limits[kind][1];
  entries.forEach(row => row.querySelector('.remove').disabled = entries.length <= limits[kind][0]);
}
function addEntry(kind, value = {}) {
  if (lists[kind].children.length >= limits[kind][1]) return;
  counters[kind]++;
  const row = el('div', undefined, 'entry'); row.dataset.kind = kind;
  row.append(el('h3', ({ addition: 'Batch', hypothesis: 'Explanation', reading: 'Reading' })[kind] + ' ' + (lists[kind].children.length + 1)));
  const fields = el('div', undefined, 'fields'); row.append(fields);
  for (const [key, title, type, max] of specs[kind]) {
    const label = el('label', title), input = el(Array.isArray(type) ? 'select' : 'input');
    if (Array.isArray(type)) for (const [v, name] of type) { const option = el('option', name); option.value = v; input.append(option); }
    else { input.type = type; if (type === 'number') { input.min = '0'; input.max = String(max); input.step = 'any'; }
      else input.maxLength = key === 'id' ? 80 : 1000; }
    input.required = true; input.dataset.field = key;
    if (value[key] !== undefined) input.value = String(value[key]);
    else if (key === 'id') input.value = ({ addition: 'Batch', hypothesis: 'Explanation', reading: 'Reading' })[kind] + ' ' + counters[kind];
    label.append(input); fields.append(label);
  }
  const remove = el('button', 'Remove ' + kind, 'secondary remove'); remove.type = 'button';
  remove.addEventListener('click', () => {
    if (lists[kind].children.length <= limits[kind][0]) return;
    row.remove(); updateButtons(kind); invalidate('Entry removed. Compare the current inputs again.');
  });
  row.append(remove); lists[kind].append(row); updateButtons(kind);
}
function entries(kind) {
  return [...lists[kind].children].map(row => Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input => [input.dataset.field,
    input.type === 'number' ? input.value.trim() === '' ? NaN : Number(input.value) : input.value])));
}
function readEditor() {
  const field = key => form.elements.namedItem(key), val = key => field(key).value;
  const numeric = key => val(key).trim() === '' ? NaN : Number(val(key));
  return normalizePressureBatchStudy({ schema: PRESSURE_BATCH_SCHEMA, title: val('title'), place: val('place'), source: val('source'),
    protocol: { areaM2: numeric('areaM2'), areaSource: val('areaSource'), durationMinutes: numeric('durationMinutes'),
      initialSurface: { volume: numeric('initialVolume'), unit: val('initialUnit'), source: val('initialSource') },
      instantaneousBatches: field('assumptions').checked, noOtherSupply: field('assumptions').checked,
      noOtherLoss: field('assumptions').checked, assumptionsSource: val('assumptionsSource'), additions: entries('addition') },
    hypotheses: entries('hypothesis'), readings: entries('reading') });
}
function populate(study) {
  const p = study.protocol;
  const values = { title: study.title, place: study.place, source: study.source, areaM2: p.areaM2, areaSource: p.areaSource,
    durationMinutes: p.durationMinutes, initialVolume: p.initialSurface.volume, initialUnit: p.initialSurface.unit,
    initialSource: p.initialSurface.source, assumptionsSource: p.assumptionsSource };
  for (const [key, value] of Object.entries(values)) form.elements.namedItem(key).value = String(value);
  form.elements.namedItem('assumptions').checked = p.instantaneousBatches && p.noOtherSupply && p.noOtherLoss;
  for (const [kind, rows] of Object.entries({ addition: p.additions, hypothesis: study.hypotheses, reading: study.readings })) {
    lists[kind].replaceChildren(); for (const row of rows) addEntry(kind, row); updateButtons(kind);
  }
}
const svgNode = (tag, attributes = {}, text) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text; return node;
};
function chart(candidate, duration) {
  const wrap = el('div', undefined, 'chart'), svg = svgNode('svg', { viewBox: '0 0 640 320', role: 'img',
    'aria-label': 'Modeled surface water and original reading bands for ' + candidate.id });
  svg.append(svgNode('title', {}, 'Surface water through the original batch course. Vertical model jumps are instantaneous additions.'));
  const high = Math.max(1e-12, ...candidate.history.map(r => r.surfaceLiters), ...candidate.predictions.map(r => r.originalBandLiters[1])) * 1.08;
  const left = 126, right = 620, top = 48, bottom = 252;
  const x = t => left + (right - left) * t / duration, y = v => bottom - (bottom - top) * v / high;
  for (const value of [0, high / 2, high]) {
    svg.append(svgNode('line', { x1: left, x2: right, y1: y(value), y2: y(value), stroke: '#d4dfd2' }));
    svg.append(svgNode('text', { x: left - 10, y: y(value) + 5, 'text-anchor': 'end', fill: '#263d32', 'font-size': 15 }, tick(value)));
  }
  for (const time of [0, duration / 2, duration]) svg.append(svgNode('text', {
    x: x(time), y: bottom + 30, 'text-anchor': time === 0 ? 'start' : time === duration ? 'end' : 'middle', fill: '#263d32', 'font-size': 15 }, n(time)));
  svg.append(svgNode('text', { x: (left + right) / 2, y: 312, 'text-anchor': 'middle', fill: '#263d32', 'font-size': 17 }, 'Minutes'));
  svg.append(svgNode('text', { x: 17, y: 20, fill: '#263d32', 'font-size': 17 }, 'L'));
  svg.append(svgNode('polyline', { points: candidate.history.map(r => x(r.minute) + ',' + y(r.surfaceLiters)).join(' '),
    fill: 'none', stroke: '#235f50', 'stroke-width': 3 }));
  for (const r of candidate.predictions) {
    const [low, upper] = r.originalBandLiters, observed = r.volume * (r.unit === 'mL' ? .001 : 1);
    svg.append(svgNode('line', { x1: x(r.minute), x2: x(r.minute), y1: y(low), y2: y(upper), stroke: '#a23e1c', 'stroke-width': 2 }));
    const dot = svgNode('circle', { cx: x(r.minute), cy: y(observed), r: 4.5, fill: '#a23e1c' });
    dot.append(svgNode('title', {}, r.id + ': ' + phase(r.phase) + ', ' + r.volume + '±' + r.uncertainty + r.unit)); svg.append(dot);
  }
  wrap.append(svg); return wrap;
}
function scoreText(score) {
  if (!score.count) return 'No readings assigned';
  return score.inside + ' inside, ' + score.outside + ' outside, ' + score.boundary + ' at numerical edges; RMSE ' + n(score.rmseLiters) + ' L';
}
function drawDetail(host, candidate, report) {
  host.replaceChildren(); host.append(el('h3', candidate.id + ': surface water through both sides of each addition'));
  const h = candidate.hypothesis;
  host.append(el('p', 'K ' + original(h.conductivityMmHr) + ' mm/h; A ' + original(h.capillaryDriveMm) + ' mm; moisture deficit ' + original(h.moistureDeficit) +
    '; initial cumulative infiltration ' + original(h.initialCumulativeMm) + ' mm.'));
  host.append(el('p', h.source, 'source-note'));
  host.append(chart(candidate, report.study.protocol.durationMinutes));
  const legend = el('p', undefined, 'legend small');
  for (const [name, cls] of [['Model', 'swatch'], ['Original readings and declared bands', 'swatch reading']]) {
    const item = el('span'); item.append(el('span', undefined, cls), document.createTextNode(name)); legend.append(item);
  }
  host.append(legend, el('p', 'Lines join sampled model states. Vertical segments are the declared instantaneous additions. Reading markers retain the declared before/after side.', 'small'));
  host.append(el('h3', 'Original readings and their comparisons'));
  if (!candidate.predictions.length) host.append(el('p', 'No original readings were supplied. This is a prediction-only course.'));
  for (const r of candidate.predictions) {
    const card = el('article', undefined, 'reading-result'); card.dataset.readingId = r.id;
    card.append(el('h3', r.id + ' · minute ' + original(r.minute) + ' · ' + phase(r.phase)));
    card.append(el('p', roles[r.role] + '. ' + classification(r.classification) + '.'));
    card.append(el('p', 'Original: ' + original(r.volume) + ' ± ' + original(r.uncertainty) + ' ' + r.unit +
      '. Modeled: ' + n(r.predictedSurfaceLiters) + ' L. Residual: ' + n(r.residualLiters) + ' L.'));
    if (r.batchId) card.append(el('p', 'Associated batch: ' + r.batchId));
    card.append(el('p', 'Source: ' + r.source, 'source-note'));
    card.append(el('p', 'Declared band in liters: [' + n(r.originalBandLiters[0]) + ', ' + n(r.originalBandLiters[1]) + ']. Arithmetic allowance: ' + n(r.arithmeticAllowanceLiters) + ' L.', 'small'));
    host.append(card);
  }
  const details = el('details'), summary = el('summary', 'Exact batch states and water accounting'); details.append(summary);
  const tableWrap = el('div', undefined, 'table-scroll'), table = el('table'); table.append(el('caption', 'Cumulative quantities include only batches applied by that reading phase.'));
  const head = el('tr'); for (const label of ['Minute', 'Phase', 'Batch', 'Supplied L', 'Infiltrated L', 'Surface L', 'Front total mm', 'Balance residual L']) head.append(el('th', label));
  const thead = el('thead'); thead.append(head); table.append(thead); const tbody = el('tbody');
  for (const r of candidate.eventHistory) {
    const tr = el('tr'); for (const value of [n(r.minute), phase(r.phase), r.batchId ?? '—', n(r.suppliedLiters), n(r.infiltratedLiters),
      n(r.surfaceLiters), n(r.cumulativeInfiltrationMm), n(r.waterBalanceResidualLiters)]) tr.append(el('td', value)); tbody.append(tr);
  }
  table.append(tbody); tableWrap.append(table); details.append(tableWrap); host.append(details);
}
function resultView(report) {
  const fragment = document.createDocumentFragment();
  fragment.append(el('h2', 'The declared batch course'), el('p', report.study.title + ' · ' + report.study.place), el('p', 'Original source: ' + report.study.source, 'source-note'));
  fragment.append(el('p', report.hasCalibration ? 'Order uses calibration readings only: ' + report.calibrationOrder.join(', ') + '. Every offered explanation remains visible.' :
    'No calibration readings are assigned. These are conditional model predictions with no evidence-based order.'));
  fragment.append(el('p', 'Held-aside readings challenge the explanations separately. Numerical band edges remain unresolved; the closest fit can still be contradicted.', 'small'));
  const protocol = el('details'); protocol.append(el('summary', 'Original protocol, quantities and sources'));
  const p = report.study.protocol;
  protocol.append(el('p', 'Area ' + original(p.areaM2) + ' m². Source: ' + p.areaSource));
  protocol.append(el('p', 'Initial surface water: ' + original(p.initialSurface.volume) + ' ' + p.initialSurface.unit + '. Source: ' + p.initialSurface.source));
  protocol.append(el('p', 'Assumptions: ' + p.assumptionsSource));
  for (const a of p.additions) protocol.append(el('p', a.id + ' · minute ' + original(a.minute) + ' · original ' + original(a.volume) + ' ' + a.unit + '. Source: ' + a.source));
  fragment.append(protocol);
  const choices = el('div'), detail = el('div'); detail.id = 'batch-detail'; fragment.append(choices, detail);
  const byId = new Map(report.candidates.map(c => [c.id, c]));
  const order = report.hasCalibration ? report.calibrationOrder : report.candidates.map(c => c.id);
  const buttons = [];
  for (const id of order) {
    const c = byId.get(id), button = el('button', undefined, 'result-choice'); button.type = 'button'; button.dataset.candidateId = id;
    button.setAttribute('aria-pressed', 'false'); button.append(el('strong', id),
      el('p', 'Calibration: ' + scoreText(c.calibration)), el('p', 'Held aside: ' + scoreText(c.challenge)),
      el('span', 'Inspect this explanation, original readings and water account', 'small'));
    button.addEventListener('click', () => { buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button))); drawDetail(detail, c, report); });
    buttons.push(button); choices.append(button);
  }
  buttons[0].setAttribute('aria-pressed', 'true'); drawDetail(detail, byId.get(order[0]), report);
  fragment.append(el('p', report.qualification, 'small')); return fragment;
}
function adopt(serialized, view, message) {
  retained = serialized; $('results').replaceChildren(view);
  $('download').disabled = false; $('run').disabled = false; $('status').textContent = message;
}
form.addEventListener('input', () => invalidate('Inputs changed. Compare the current course again.'));
form.addEventListener('change', () => invalidate('Inputs changed. Compare the current course again.'));
for (const kind of Object.keys(lists)) $('add-' + kind).addEventListener('click', () => {
  addEntry(kind); invalidate('Entry added. Supply its original values and source.');
});
form.addEventListener('submit', async event => {
  event.preventDefault(); if (!form.reportValidity()) return;
  const token = ++epoch; $('run').disabled = true; $('status').textContent = 'Comparing the declared course…';
  try {
    const study = readEditor(); await Promise.resolve(); if (token !== epoch) return;
    const serialized = serializePressureBatches(study), report = comparePressureBatches(study), view = resultView(report);
    if (token !== epoch) return; adopt(serialized, view, 'Comparison complete. Inputs alone are saved; every explanation remains available.');
  } catch (error) { if (token === epoch) { $('status').textContent = 'Comparison refused: ' + error.message; $('run').disabled = false; } }
});
$('example').addEventListener('click', () => {
  epoch++; const study = normalizePressureBatchStudy(structuredClone(pressureBatchExample)), serialized = serializePressureBatches(study);
  const report = comparePressureBatches(study), view = resultView(report);
  populate(study); adopt(serialized, view, 'Authored mathematical example loaded and compared. These readings are fictional, not acquired measurements.');
  $('import-status').textContent = '';
});
$('import').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  const token = ++epoch; $('import-status').textContent = 'Reading saved inputs…';
  try {
    if (file.size > PRESSURE_BATCH_FILE_LIMIT) throw Error('Input file exceeds 220000 UTF-8 bytes.');
    const raw = await file.text(); if (token !== epoch) return;
    const study = parsePressureBatches(raw), serialized = serializePressureBatches(study);
    const report = comparePressureBatches(study), view = resultView(report);
    if (token !== epoch) return;
    populate(study); adopt(serialized, view, 'Recomputed from saved original inputs. No site project was adopted.');
    $('import-status').textContent = 'Opened ' + file.name + '. All original quantities, phases and sources were retained.';
  } catch (error) { if (token === epoch) { $('import-status').textContent = 'Open refused: ' + error.message + ' The previous accepted view remains in place.'; $('run').disabled = false; } }
});
$('download').addEventListener('click', () => {
  if (!retained) return;
  const url = URL.createObjectURL(new Blob([retained], { type: 'application/json' })), a = el('a');
  a.href = url; a.download = 'experimental-earth-pressure-batches.json'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
addEntry('addition'); addEntry('hypothesis'); addEntry('hypothesis'); updateButtons('reading');
