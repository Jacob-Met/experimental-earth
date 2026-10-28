import { parseSpatialOriginalReading } from './shade-heat-spatial-evidence.js';
import { checkShadeHeatBytes } from './shade-heat.js';
import { createShadeHeatComputation } from './shade-heat-computation.js';

const $ = id => document.querySelector('#spatial-' + id);
const node = (tag, text = '') => { const element = document.createElement(tag); element.textContent = text; return element; };
const number = value => value !== 0 && Math.abs(value) < .000001 ? value.toExponential(5)
  : Number(value).toLocaleString('en-US', { maximumSignificantDigits: 8 });
const signed = value => (value > 0 ? '+' : '') + number(value);
const stores = [['surfaceC', 'Ground surface'], ['subsurfaceC', 'Lower heat store']];
const computation = createShadeHeatComputation(() => new Worker(new URL('./shade-heat-spatial-evidence-worker.js', import.meta.url), { type: 'module' }));
let originals = null, primary = 0, accepted = null, generation = 0, reading = false, selected = 0;
const pending = () => reading || computation.pending;
const point = input => {
  const p = input.source.project, i = input.query.reading.cellIndex;
  return String.fromCharCode(65 + i % p.width) + (Math.floor(i / p.width) + 1);
};
function state(text, kind) { $('status').textContent = text; $('status').dataset.state = kind; }
function controls() { $('run').disabled = pending() || !originals; $('export').disabled = pending() || !accepted; }
function resetResultData() { for (const key of Object.keys($('results').dataset)) delete $('results').dataset[key]; }
function clearResult() { accepted = null; $('results').replaceChildren(); $('results').hidden = true; resetResultData(); }
function invalidate(message) {
  generation++; reading = false; computation.cancel(); clearResult(); controls(); state(message, 'not-compared');
}
function startFile(message) {
  computation.cancel(); const request = ++generation; reading = true; controls(); state(message, 'file-pending'); return request;
}
function drawSources() {
  const host = $('sources'); host.replaceChildren();
  if (!originals) { host.append(node('p', 'No original readings loaded.')); return; }
  originals.forEach((input, index) => {
    const p = input.source.project, r = input.query.reading, card = node('article');
    card.className = 'source-card'; card.dataset.primary = String(index === primary); card.dataset.cell = String(r.cellIndex);
    const label = node('label'), radio = node('input'); radio.type = 'radio'; radio.name = 'comparison-point'; radio.value = String(index); radio.checked = index === primary;
    radio.addEventListener('input', () => {
      if (!radio.checked) return; primary = index;
      invalidate('Comparison point changed. Compare again using the same original readings.'); drawSources();
    });
    label.append(radio, node('span', 'Compare designs at point ' + point(input))); card.append(label,
      node('p', p.title), node('strong', String(r.temperatureC) + ' ± ' + String(r.halfWidthC) + ' °C'),
      node('p', 'Original existing-surface reading · ' + r.utc), node('p', r.source));
    const detail = node('p', p.width + ' × ' + p.height + ' original grid · original inquiry used ' + input.query.bins + ' sky bins.'); detail.className = 'quiet'; card.append(detail); host.append(card);
  });
}
function receive(next) {
  accepted = next; originals = next.investigation.readings; primary = 0; reading = false;
  $('bins').value = String(next.investigation.query.bins); $('sharing').value = next.investigation.query.sharingSource;
  selected = next.report.ranges?.surfaceC.lower.witnessId ?? 0; drawSources(); draw(); controls();
  state(next.report.compatibility === 'compatible' ? 'One shared sky family meets both original bands. Its consequences are shown at point ' + point(originals[0]) + '.'
    : 'No common sky profile in this declared family meets both original bands. Both original inputs are retained.', next.report.compatibility);
}
for (const id of ['bins', 'sharing']) $(id).addEventListener('input', () => invalidate('Common-sky inputs changed. Compare again using both original readings.'));
$('originals').addEventListener('change', async () => {
  const files = [...($('originals').files ?? [])]; if (!files.length) return; $('originals').value = '';
  const request = startFile('Reading both original temperature-band files…');
  try {
    if (files.length !== 2) throw Error('Choose exactly two original reading-input files together');
    checkShadeHeatBytes(files.reduce((total, file) => total + file.size, 0));
    const inputs = await Promise.all(files.map(async file => {
      checkShadeHeatBytes(file.size); const bytes = await file.arrayBuffer();
      return parseSpatialOriginalReading(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
    }));
    if (request !== generation) return;
    originals = inputs; primary = 0; clearResult(); drawSources();
    state('Both original readings are loaded. Choose the comparison point and declare the common sky.', 'inputs-ready');
  } catch (error) {
    if (request === generation) state('Files refused: ' + error.message + (accepted ? ' The prior accepted inquiry is retained.' : ''), 'file-refused');
  } finally { if (request === generation) { reading = false; controls(); } }
});
$('form').addEventListener('submit', async event => {
  event.preventDefault(); if (!originals || pending()) return;
  const ordered = primary === 0 ? originals : [originals[1], originals[0]];
  const query = { bins: Number($('bins').value), sharingSource: $('sharing').value };
  invalidate('Recomputing both complete original bases and every common profile intersection…'); const request = generation;
  try {
    const promise = computation.compute({ operation: 'prepare', originals: ordered, query }); controls();
    const next = await promise; if (request === generation) receive(next);
  } catch (error) { if (request === generation && error.code !== 'superseded') state(error.message, 'refused'); }
  finally { if (request === generation) controls(); }
});
async function parseIntoWorker(text, request) {
  if (request !== generation) return;
  const next = await computation.compute({ operation: 'parse', text });
  if (request === generation) receive(next);
}
$('reopen').addEventListener('change', async () => {
  const file = $('reopen').files?.[0]; if (!file) return; $('reopen').value = '';
  const request = startFile('Reading and recomputing the original two-point inquiry…');
  try {
    checkShadeHeatBytes(file.size); const bytes = await file.arrayBuffer();
    if (request !== generation) return;
    await parseIntoWorker(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes), request);
  } catch (error) {
    if (request === generation && error.code !== 'superseded') state('File refused: ' + error.message + (accepted ? ' The prior accepted inquiry is retained.' : ''), 'file-refused');
  } finally { if (request === generation) { reading = false; controls(); } }
});
$('example').addEventListener('click', async () => {
  const request = startFile('Opening the authored two-point courtyard control…');
  try {
    const response = await fetch(new URL('./examples/shared-sky-two-points.json', import.meta.url));
    if (!response.ok) throw Error('The authored source could not be loaded');
    const text = await response.text(); checkShadeHeatBytes(new Blob([text]).size); await parseIntoWorker(text, request);
  } catch (error) { if (request === generation && error.code !== 'superseded') state('Example refused: ' + error.message, 'file-refused'); }
  finally { if (request === generation) { reading = false; controls(); } }
});
$('export').addEventListener('click', () => {
  if (!accepted || pending()) return;
  const text = JSON.stringify(accepted.investigation, null, 2); checkShadeHeatBytes(new Blob([text]).size);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), link = node('a');
  link.href = url; link.download = 'experimental-earth-shared-sky-spatial-reading-inputs.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function table(caption, headings, rows) {
  const wrap = node('div'); wrap.className = 'table-wrap'; wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', caption);
  const el = node('table'); el.append(node('caption', caption)); const head = node('thead'), hr = node('tr');
  headings.forEach(text => { const th = node('th', text); th.scope = 'col'; hr.append(th); }); head.append(hr); el.append(head);
  const body = node('tbody'); rows.forEach(row => { const tr = node('tr'); row.forEach(text => tr.append(node('td', String(text)))); body.append(tr); }); el.append(body); wrap.append(el); return wrap;
}
function locationFigure() {
  const [first, second] = accepted.investigation.readings, p = first.source.project, ns = 'http://www.w3.org/2000/svg';
  const figure = node('figure'); figure.className = 'site-figure';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 ' + p.width * 24 + ' ' + p.height * 24); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Original grid: comparison point ' + point(first) + ', second observation at ' + point(second));
  for (let i = 0; i < p.width * p.height; i++) {
    const rect = document.createElementNS(ns, 'rect'); rect.setAttribute('x', i % p.width * 24); rect.setAttribute('y', Math.floor(i / p.width) * 24);
    rect.setAttribute('width', 24); rect.setAttribute('height', 24); rect.setAttribute('fill', '#f3f5ed'); rect.setAttribute('stroke', '#cddbd0'); svg.append(rect);
    const existing = p.solarStudy.existing.some(column => column.cellIndex === i), proposal = p.solarStudy.proposal.some(column => column.cellIndex === i);
    if (existing || proposal) { rect.setAttribute('fill', existing ? '#c7d2c1' : '#f0d4a7'); const title = document.createElementNS(ns, 'title'); title.textContent = (existing ? 'Existing mapped column' : 'Proposed mapped column') + (existing && proposal ? ' and proposed mapped column' : ''); rect.append(title); }
  }
  [first, second].forEach((input, index) => {
    const i = input.query.reading.cellIndex, circle = document.createElementNS(ns, 'circle'); circle.setAttribute('cx', i % p.width * 24 + 12); circle.setAttribute('cy', Math.floor(i / p.width) * 24 + 12); circle.setAttribute('r', 9); circle.setAttribute('fill', index ? '#356aa0' : '#205b4e'); svg.append(circle);
    const label = document.createElementNS(ns, 'text'); label.setAttribute('x', i % p.width * 24 + 12); label.setAttribute('y', Math.floor(i / p.width) * 24 + 16); label.setAttribute('font-size', 12); label.setAttribute('font-weight', 700); label.setAttribute('text-anchor', 'middle'); label.setAttribute('fill', '#fff'); label.textContent = String(index + 1); svg.append(label);
  });
  figure.append(svg, node('figcaption', '1 · comparison ' + point(first) + '   2 · observation ' + point(second) + '. Original mapped columns: gray-green existing, sand proposed. ' + p.weather.cellSizeM + ' m cells.'));
  return figure;
}
function inspectButton(field, bound) {
  const range = accepted.report.ranges[field][bound], button = node('button', bound === 'lower' ? 'Inspect minimum' : 'Inspect maximum'); button.type = 'button'; button.dataset.store = field; button.dataset.bound = bound;
  button.setAttribute('aria-label', 'Inspect ' + stores.find(s => s[0] === field)[1].toLowerCase() + ' ' + bound + ' profile');
  button.addEventListener('click', () => { selected = range.witnessId; $('witness-select').value = String(selected); drawWitness(); $('witness').scrollIntoView({ block: 'nearest' }); }); return button;
}
function drawWitness() {
  const r = accepted.report, w = r.witnesses.find(value => value.id === selected), host = $('witness'); host.replaceChildren(); host.dataset.witness = String(w.id); host.dataset.support = w.support.join(',');
  host.append(node('h3', 'One shared compatible mixture'), node('p', 'This same profile supplies both original readings and every design endpoint below.'));
  host.append(table('Original reading compatibility · approximately °C', ['Saved point', 'Calculated existing surface', 'Original band'], r.readings.map((reading, i) => [point(accepted.investigation.readings[i]), number(w.observedC[i].lower), number(reading.temperatureC) + ' ± ' + number(reading.halfWidthC)])));
  host.append(table('Nonzero shared sky masses', ['Bin · grid heading', 'Brightness fraction · approximately'], w.support.map(bin => [(bin + 1) + ' · ' + bin * 360 / r.query.bins + '–' + (bin + 1) * 360 / r.query.bins + '°', number(w.weights[bin].lower)])));
  host.append(table('Final temperatures at comparison point ' + point(accepted.investigation.readings[0]) + ' · approximately °C', ['Design', 'Ground surface · lower / upper', 'Lower store · lower / upper'], ['existing', 'proposal'].map(target => [target === 'existing' ? 'Existing' : 'Proposal', ...stores.map(([field]) => number(w.targets[target].lower[field].lower) + ' / ' + number(w.targets[target].upper[field].upper))])));
  const exact = node('details'); exact.append(node('summary', 'Exact mixture fractions and outward numeric displays'));
  w.support.forEach(bin => exact.append(node('p', 'Bin ' + (bin + 1) + ': ' + w.weights[bin].exact.numerator + ' / ' + w.weights[bin].exact.denominator + '. Display bracket [' + w.weights[bin].lower + ', ' + w.weights[bin].upper + '].'))); host.append(exact);
}
function draw() {
  const r = accepted.report, host = $('results'); host.hidden = false; host.replaceChildren(); resetResultData(); host.dataset.status = r.compatibility; host.dataset.cell = String(r.cellIndex); host.dataset.bins = String(r.query.bins);
  host.append(node('p', '03 / Paired consequences'), node('h2', 'Both readings, compared at point ' + point(accepted.investigation.readings[0])), node('p', 'Original final UTC ' + r.finalUtc + '. Shared-sky basis: ' + r.query.sharingSource));
  if (r.compatibility === 'compatible') {
    const layout = node('div'); layout.className = 'result-layout'; const cards = node('div'); cards.className = 'range-grid';
    for (const [field, label] of stores) {
      const range = r.ranges[field], before = r.firstReadingOnly.ranges[field], card = node('section'); card.className = 'range-card';
      host.dataset[field + 'Lower'] = String(range.lower.differenceC.lower); host.dataset[field + 'Upper'] = String(range.upper.differenceC.upper);
      card.append(node('h3', label), node('strong', '≈ ' + signed(range.lower.differenceC.lower) + ' to ' + signed(range.upper.differenceC.upper) + ' °C'),
        node('p', 'Both readings · proposal minus existing'), node('p', 'First reading alone: ' + signed(before.lower.differenceC.lower) + ' to ' + signed(before.upper.differenceC.upper) + ' °C.'), inspectButton(field, 'lower'), inspectButton(field, 'upper')); cards.append(card);
    }
    layout.append(cards, locationFigure()); host.append(layout);
    const interpretation = node('p', 'Negative means cooler in the proposal; positive means warmer. Each component bound has its own profile, and the component extrema need not occur together.'); interpretation.className = 'interpretation'; host.append(interpretation);
    const label = node('label', 'Inspect an extremal compatible profile'); label.className = 'witness-label'; const select = node('select'); select.id = 'spatial-witness-select';
    r.witnesses.forEach(w => { const option = node('option', 'Mixture ' + (w.id + 1) + ' · ' + w.support.map(bin => 'bin ' + (bin + 1)).join(' + ')); option.value = String(w.id); select.append(option); }); select.value = String(selected); select.addEventListener('input', () => { selected = Number(select.value); drawWitness(); }); label.append(select); host.append(label);
    const witness = node('div'); witness.id = 'spatial-witness'; host.append(witness); drawWitness();
  } else { const empty = node('p', 'The two original bands do not share a compatible profile in this declared coefficient family. There is no paired range to report. The original inputs can still be downloaded and reconsidered.'); empty.className = 'empty-family'; host.append(empty); }
  const work = r.work.profileIntersection, details = node('details'); details.append(node('summary', 'Complete work and interpretation'),
    node('p', r.work.executedThermalCourses + ' original thermal courses; ' + work.examinedPairs + ' bin pairs and ' + work.examinedTriangles + ' bin triangles checked. ' + work.admittedOriginalVertices + ' one-bin, ' + work.admittedPairVertices + ' two-bin and ' + work.admittedTriangleVertices + ' three-bin vertices admitted.'),
    node('p', 'Every admitted vertex enters all paired component comparisons. The inspector shows the distinct extremal witnesses. The download stores both original reading inputs and the common-sky question; calculated profiles are recomputed on reopening.'), node('p', r.semantics)); host.append(details);
}
drawSources(); controls();
for (const id of ['example', 'originals', 'reopen', 'bins', 'sharing']) $(id).disabled = false;
