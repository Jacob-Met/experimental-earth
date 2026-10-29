import { node, number, signed, point, locationFigure, drawEpochWitness } from './shade-heat-epoch-view.js';
import { parseSpatialOriginalReading } from './shade-heat-spatial-evidence.js';
import { checkShadeHeatBytes } from './shade-heat.js';
import { createShadeHeatComputation } from './shade-heat-computation.js';

const $ = id => document.querySelector('#epoch-' + id);
const stores = [['surfaceC', 'Ground surface'], ['subsurfaceC', 'Lower heat store']];
const computation = createShadeHeatComputation(() => new Worker(new URL('./shade-heat-epoch-evidence-worker.js', import.meta.url), { type: 'module' }));
let originals = null, primary = 0, accepted = null, generation = 0, reading = false, selected = 0;
const pending = () => reading || computation.pending;
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
function updateBoundaryHint() {
  if (!originals) { $('boundary').textContent = 'Choose a boundary between two existing original intervals.'; return; }
  const path = originals[0].source.declaration.path;
  const intervals = Math.ceil((Date.parse(path.endUtc) - Date.parse(path.startUtc)) / (path.stepMinutes * 60000));
  $('split').max = String(intervals - 1);
  const split = Number($('split').value);
  $('boundary').textContent = Number.isInteger(split) && split >= 1 && split < intervals
    ? 'Change after original interval ' + split + ' of ' + intervals + ' · '
      + new Date(Date.parse(path.startUtc) + split * path.stepMinutes * 60000).toISOString()
    : 'The split must leave at least one complete original interval in each epoch.';
}
function drawSources() {
  updateBoundaryHint();
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
  $('split').value = String(next.investigation.query.splitAfterInterval); $('sharing').value = next.investigation.query.sharingSource;
  selected = next.report.ranges?.surfaceC.lower.witnessId ?? 0; drawSources(); draw(); controls();
  state(next.report.compatibility === 'compatible' ? 'The declared two-epoch model meets both original bands. Inspect original replay evidence at point ' + point(originals[0]) + '.'
    : 'No two-epoch profile in this declared model meets both original bands. Both original inputs are retained.', next.report.compatibility);
}
for (const id of ['split', 'sharing']) $(id).addEventListener('input', () => { invalidate('Shared conditions changed. Compare again using both original readings.'); updateBoundaryHint(); });
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
    state('Both original readings are loaded. Choose the comparison point and original interval boundary.', 'inputs-ready');
  } catch (error) {
    if (request === generation) state('Files refused: ' + error.message + (accepted ? ' The prior accepted inquiry is retained.' : ''), 'file-refused');
  } finally { if (request === generation) { reading = false; controls(); } }
});
$('form').addEventListener('submit', async event => {
  event.preventDefault(); if (!originals || pending()) return;
  const ordered = primary === 0 ? originals : [originals[1], originals[0]];
  const query = { bins: 4, splitAfterInterval: Number($('split').value), sharingSource: $('sharing').value };
  invalidate('Recomputing every original sky pair, exact two-epoch profiles and original witness replays…'); const request = generation;
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
  const request = startFile('Reading and recomputing the original two-epoch inquiry…');
  try {
    checkShadeHeatBytes(file.size); const bytes = await file.arrayBuffer();
    if (request !== generation) return;
    await parseIntoWorker(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes), request);
  } catch (error) {
    if (request === generation && error.code !== 'superseded') state('File refused: ' + error.message + (accepted ? ' The prior accepted inquiry is retained.' : ''), 'file-refused');
  } finally { if (request === generation) { reading = false; controls(); } }
});
$('example').addEventListener('click', async () => {
  const request = startFile('Opening the authored changing-sky courtyard control…');
  try {
    const { makeEpochSkyExample } = await import('./shade-heat-epoch-example.js');
    const text = JSON.stringify(makeEpochSkyExample()); checkShadeHeatBytes(new Blob([text]).size); await parseIntoWorker(text, request);
  } catch (error) { if (request === generation && error.code !== 'superseded') state('Example refused: ' + error.message, 'file-refused'); }
  finally { if (request === generation) { reading = false; controls(); } }
});
$('export').addEventListener('click', () => {
  if (!accepted || pending()) return;
  const text = JSON.stringify(accepted.investigation); checkShadeHeatBytes(new Blob([text]).size);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), link = node('a');
  link.href = url; link.download = 'experimental-earth-two-epoch-sky-reading-inputs.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function inspectButton(field, bound) {
  const range = accepted.report.ranges[field][bound], button = node('button', bound === 'lower' ? 'Inspect minimum' : 'Inspect maximum'); button.type = 'button'; button.dataset.store = field; button.dataset.bound = bound;
  button.setAttribute('aria-label', 'Inspect ' + stores.find(s => s[0] === field)[1].toLowerCase() + ' ' + bound + ' profile');
  button.addEventListener('click', () => { selected = range.witnessId; $('witness-select').value = String(selected); drawWitness(); $('witness').scrollIntoView({ block: 'nearest' }); }); return button;
}
function drawWitness() {
  drawEpochWitness($('witness'), { report: accepted.report, readings: accepted.investigation.readings, witnessId: selected });
}
function draw() {
  const r = accepted.report, host = $('results'); host.hidden = false; host.replaceChildren(); resetResultData();
  Object.assign(host.dataset, { status: r.compatibility, cell: String(r.cellIndex), bins: String(r.query.bins),
    split: String(r.query.splitAfterInterval), originalStatic: r.originalStatic.compatibility, additiveStatic: r.additiveStatic.compatibility });
  host.append(node('p', '03 / Compare the assumptions'), node('h2', 'Could one change alter the conclusion?'),
    node('p', 'Original final UTC ' + r.finalUtc + '. Change after original interval ' + r.query.splitAfterInterval + ' of '
      + r.intervalCount + ' · ' + r.splitUtc + '.'), node('p', 'Shared conditions: ' + r.query.sharingSource));
  const comparisons = node('div'); comparisons.className = 'model-grid';
  for (const [key, label, value, detail] of [
    ['original-static', 'Original static model', r.originalStatic, 'The maintained one-profile model with four common bins.'],
    ['additive-static', 'Additive static model', r.additiveStatic, 'The new coefficient model restricted to the same profile in both epochs.'],
    ['two-epoch', 'Two-epoch additive model', r, 'One early and one late profile at the declared original boundary.'],
  ]) {
    const card = node('section'); card.className = 'model-card'; card.dataset.model = key; card.dataset.status = value.compatibility;
    card.append(node('h3', label), node('strong', value.compatibility === 'compatible' ? 'Compatible' : 'No compatible profile'), node('p', detail));
    comparisons.append(card);
  }
  host.append(comparisons);
  if (!r.staticCompatibilityAgrees) host.append(node('p', 'The two static comparisons disagree. A numerical coefficient-model change is present, so this result cannot be attributed only to allowing a sky change.'));
  if (r.compatibility === 'compatible') {
    const layout = node('div'); layout.className = 'result-layout'; const cards = node('div'); cards.className = 'range-grid';
    for (const [field, label] of stores) {
      const range = r.ranges[field], card = node('section'); card.className = 'range-card';
      host.dataset[field + 'Lower'] = String(range.lower.differenceC.lower); host.dataset[field + 'Upper'] = String(range.upper.differenceC.upper);
      card.append(node('h3', label), node('strong', '≈ ' + signed(range.lower.differenceC.lower) + ' to ' + signed(range.upper.differenceC.upper) + ' °C'),
        node('p', 'Two-epoch model · proposal minus existing at ' + point(accepted.investigation.readings[0])),
        inspectButton(field, 'lower'), inspectButton(field, 'upper')); cards.append(card);
    }
    layout.append(cards, locationFigure(accepted.investigation.readings)); host.append(layout);
    host.append(node('p', 'Negative means cooler in the proposal; positive means warmer. Component extrema may require different profiles. These ranges describe the declared additive model.'));
    const label = node('label', 'Inspect an extremal two-epoch profile'); label.className = 'witness-label'; const select = node('select'); select.id = 'epoch-witness-select';
    r.witnesses.forEach(w => { const option = node('option', 'Extremum ' + (w.id + 1)); option.value = String(w.id); select.append(option); });
    select.value = String(selected); select.addEventListener('input', () => { selected = Number(select.value); drawWitness(); }); label.append(select); host.append(label);
    const witness = node('div'); witness.id = 'epoch-witness'; host.append(witness); drawWitness();
  } else {
    const empty = node('p', 'No compatible two-epoch profile is present in this declared model. There is no paired range. Both complete original bases were evaluated, and the original inputs can still be downloaded.');
    empty.className = 'empty-family'; host.append(empty);
  }
  const details = node('details'); details.append(node('summary', 'Complete work and model limits'),
    node('p', r.work.executedBasisCourses + ' original basis courses and ' + r.work.executedWitnessCourses + ' original witness replay courses; '
      + r.work.geometryPasses + ' geometry passes. ' + r.work.profileIntersection.candidates + ' exact vertices admitted from '
      + r.work.profileIntersection.examinedPairs + ' pair supports and ' + r.work.profileIntersection.examinedTriangles + ' triangle supports.'),
    node('p', 'All sixteen original pair courses at each receiver are required before either reading screens the family. All candidates enter each objective; only distinct extremal witnesses are shown.'),
    node('p', 'Numerical consistency screen: ' + number(r.numericalEvidence.consistencyScreenC) + ' °C. ' + r.numericalEvidence.scope), node('p', r.semantics));
  host.append(details);
  const numerical = node('details'); numerical.append(node('summary', 'Every original pair course and additive discrepancy'));
  const pre = node('pre', JSON.stringify(r.numericalEvidence.points, null, 2)); numerical.append(pre); host.append(numerical);
}
drawSources(); controls();
for (const id of ['example', 'originals', 'reopen', 'split', 'sharing']) $(id).disabled = false;
