import { node, number, signed, point, table, locationFigure, drawEpochWitness } from './shade-heat-epoch-view.js';
import { parseSpatialOriginalReading } from './shade-heat-spatial-evidence.js';
import { checkShadeHeatBytes } from './shade-heat.js';
import { createShadeHeatComputation } from './shade-heat-computation.js';

const $ = id => document.querySelector('#boundary-' + id);
const computation = createShadeHeatComputation(() => new Worker(new URL('./shade-heat-boundary-evidence-worker.js', import.meta.url), { type: 'module' }));
let originals = null, primary = 0, accepted = null, generation = 0, reading = false, selectedBoundary = 0, selectedWitness = null;
const pending = () => reading || computation.pending;
function state(text, kind) { $('status').textContent = text; $('status').dataset.state = kind; }
function controls() { $('run').disabled = pending() || !originals; $('export').disabled = pending() || !accepted; $('all').disabled = !originals; }
function resetResultData() { for (const key of Object.keys($('results').dataset)) delete $('results').dataset[key]; }
function clearResult() { accepted = null; $('results').replaceChildren(); $('results').hidden = true; resetResultData(); }
function invalidate(message) {
  generation++; reading = false; computation.cancel(); clearResult(); controls(); state(message, 'not-compared');
}
function startFile(message) {
  computation.cancel(); const request = ++generation; reading = true; controls(); state(message, 'file-pending'); return request;
}
const compactSigned = value => (value > 0 ? '+' : '') + (value !== 0 && Math.abs(value) < .000001 ? value.toExponential(4) : Number(value).toLocaleString('en-US', { maximumSignificantDigits: 7 }));
const offered = () => $('splits').value.split(',').map(value => value.trim() ? Number(value) : NaN);
function updateBoundaryHint() {
  if (!originals) { $('boundary').textContent = 'Offer boundaries between existing original intervals.'; return; }
  const path = originals[0].source.declaration.path;
  const count = Math.ceil((Date.parse(path.endUtc) - Date.parse(path.startUtc)) / (path.stepMinutes * 60000));
  const values = offered(), valid = values.length > 0 && values.length <= 23
    && values.every(value => Number.isInteger(value) && value >= 1 && value < count)
    && new Set(values).size === values.length;
  $('boundary').textContent = valid
    ? values.length + ' distinct original boundaries offered, in this order: ' + values.join(', ') + '. Each leaves a whole interval on either side.'
    : 'Use distinct whole numbers from 1 to ' + (count - 1) + ', separated by commas. Empty entries and invented times refuse the whole inquiry.';
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
  $('splits').value = next.investigation.query.splitAfterIntervals.join(', ');
  $('sharing').value = next.investigation.query.sharingSource;
  const first = next.report.boundaries.findIndex(report => report.compatibility === 'compatible');
  selectedBoundary = Math.max(0, first);
  selectedWitness = next.report.boundaries[selectedBoundary].ranges?.surfaceC.lower.witnessId ?? null;
  drawSources(); draw(); controls();
  state(next.report.compatibility === 'compatible'
    ? next.report.compatibleBoundaries.length + ' of ' + next.report.boundaries.length + ' offered boundaries admit a two-epoch profile. Every offered alternative is retained.'
    : 'No offered boundary admits a two-epoch profile in this declared model. Every offered alternative and both original inputs are retained.', next.report.compatibility);
}
for (const id of ['splits', 'sharing']) $(id).addEventListener('input', () => { invalidate('Shared conditions changed. Compare again using both original readings.'); updateBoundaryHint(); });
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
    state('Both original readings are loaded. Choose the comparison point and explicitly offered original boundaries.', 'inputs-ready');
  } catch (error) {
    if (request === generation) state('Files refused: ' + error.message + (accepted ? ' The prior accepted inquiry is retained.' : ''), 'file-refused');
  } finally { if (request === generation) { reading = false; controls(); } }
});
$('form').addEventListener('submit', async event => {
  event.preventDefault(); if (!originals || pending()) return;
  const ordered = primary === 0 ? originals : [originals[1], originals[0]];
  const query = { bins: 4, splitAfterIntervals: offered(), sharingSource: $('sharing').value };
  invalidate('Comparing every offered boundary, complete original pair bases and witness replays…'); const request = generation;
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
  const request = startFile('Reading and recomputing all original boundary alternatives…');
  try {
    checkShadeHeatBytes(file.size); const bytes = await file.arrayBuffer();
    if (request !== generation) return;
    await parseIntoWorker(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes), request);
  } catch (error) {
    if (request === generation && error.code !== 'superseded') state('File refused: ' + error.message + (accepted ? ' The prior accepted inquiry is retained.' : ''), 'file-refused');
  } finally { if (request === generation) { reading = false; controls(); } }
});
$('example').addEventListener('click', async () => {
  const request = startFile('Opening all 15 authored courtyard boundary alternatives…');
  try {
    const { makeSkyBoundaryExample } = await import('./shade-heat-boundary-example.js');
    const text = JSON.stringify(makeSkyBoundaryExample()); checkShadeHeatBytes(new Blob([text]).size); await parseIntoWorker(text, request);
  } catch (error) { if (request === generation && error.code !== 'superseded') state('Example refused: ' + error.message, 'file-refused'); }
  finally { if (request === generation) { reading = false; controls(); } }
});
$('export').addEventListener('click', () => {
  if (!accepted || pending()) return;
  const text = JSON.stringify(accepted.investigation); checkShadeHeatBytes(new Blob([text]).size);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), link = node('a');
  link.href = url; link.download = 'experimental-earth-offered-sky-boundary-inputs.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$('all').addEventListener('click', () => {
  if (!originals) return;
  const path = originals[0].source.declaration.path;
  const count = Math.ceil((Date.parse(path.endUtc) - Date.parse(path.startUtc)) / (path.stepMinutes * 60000));
  $('splits').value = Array.from({ length: count - 1 }, (_, i) => i + 1).join(', ');
  invalidate('Every original internal boundary is now explicitly offered. Compare to evaluate the complete list.');
  updateBoundaryHint();
});
const stores = [['surfaceC', 'Ground surface'], ['subsurfaceC', 'Lower heat store']];
function chooseBoundary(index, witnessId = null) {
  selectedBoundary = index;
  const report = accepted.report.boundaries[index];
  selectedWitness = witnessId ?? report.ranges?.surfaceC.lower.witnessId ?? null;
  $('select').value = String(index);
  for (const button of $('alternatives').querySelectorAll('button'))
    button.setAttribute('aria-pressed', String(Number(button.dataset.index) === index));
  drawBoundary();
}
function extremeButton(field, bound) {
  const range = accepted.report.ranges[field][bound], button = node('button',
    (bound === 'lower' ? 'Inspect minimum' : 'Inspect maximum') + ' · after ' + range.splitAfterInterval);
  button.type = 'button'; button.dataset.store = field; button.dataset.bound = bound;
  button.setAttribute('aria-label', 'Inspect ' + stores.find(row => row[0] === field)[1].toLowerCase() + ' ' + bound + ' across offered boundaries');
  button.addEventListener('click', () => {
    chooseBoundary(range.boundaryIndex, range.witnessId); $('detail').scrollIntoView({ block: 'nearest' });
  }); return button;
}
function drawBoundary() {
  const r = accepted.report.boundaries[selectedBoundary], host = $('detail'); host.replaceChildren();
  Object.assign(host.dataset, { index: String(selectedBoundary), split: String(r.query.splitAfterInterval),
    status: r.compatibility, originalStatic: r.originalStatic.compatibility, additiveStatic: r.additiveStatic.compatibility });
  host.append(node('h3', 'Change after original interval ' + r.query.splitAfterInterval), node('p', r.splitUtc + ' · original final reading ' + r.finalUtc));
  const comparisons = node('div'); comparisons.className = 'model-grid';
  for (const [label, report] of [['Original static model', r.originalStatic], ['Additive static model', r.additiveStatic], ['Two-epoch additive model', r]]) {
    const card = node('section'); card.className = 'model-card'; card.dataset.status = report.compatibility;
    card.append(node('h4', label), node('strong', report.compatibility === 'compatible' ? 'Compatible' : 'No compatible profile')); comparisons.append(card);
  }
  host.append(comparisons);
  if (!r.staticCompatibilityAgrees) host.append(node('p', 'The two static comparisons disagree. A numerical coefficient-model change is present; this result cannot be attributed only to allowing a sky change.'));
  if (r.ranges) {
    host.append(table('Paired consequences at this boundary · approximately °C', ['Component', 'Minimum', 'Maximum'],
      stores.map(([field, label]) => [label, signed(r.ranges[field].lower.differenceC.lower), signed(r.ranges[field].upper.differenceC.upper)])));
    const label = node('label', 'Inspect an extremal profile at this boundary'); label.className = 'witness-label';
    const select = node('select'); select.id = 'boundary-witness-select';
    r.witnesses.forEach(witness => { const option = node('option', 'Extremum ' + (witness.id + 1)); option.value = String(witness.id); select.append(option); });
    select.value = String(selectedWitness);
    const witnessHost = node('div'); witnessHost.id = 'boundary-witness';
    const showWitness = () => drawEpochWitness(witnessHost, { report: r, readings: accepted.investigation.readings,
      witnessId: selectedWitness, prefix: 'boundary' });
    select.addEventListener('input', () => { selectedWitness = Number(select.value); showWitness(); });
    label.append(select); host.append(label, witnessHost); showWitness();
  } else {
    const empty = node('p', 'This offered boundary has no compatible two-epoch profile. It remains part of the complete inquiry, with both original pair bases retained.');
    empty.className = 'empty-family'; host.append(empty);
  }
  const work = node('details'); work.append(node('summary', 'Complete evidence at this boundary'),
    node('p', r.work.completeBasisCourses + ' complete basis courses: ' + r.work.executedBasisCourses + ' newly evaluated and ' + r.work.reusedCompleteBasisCourses + ' identical static courses reused within this inquiry. '
      + r.work.executedWitnessCourses + ' full witness replay courses. ' + r.work.profileIntersection.candidates + ' exact vertices.'),
    node('p', r.numericalEvidence.scope), node('p', r.semantics)); host.append(work);
  const numerical = node('details'); numerical.append(node('summary', 'Every original pair course and additive discrepancy'),
    node('pre', JSON.stringify(r.numericalEvidence.points, null, 2))); host.append(numerical);
}
function draw() {
  const r = accepted.report, host = $('results'); host.hidden = false; host.replaceChildren(); resetResultData();
  Object.assign(host.dataset, { status: r.compatibility, cell: String(r.cellIndex), offered: String(r.boundaries.length),
    compatible: r.compatibleBoundaries.join(','), basis: String(r.work.executedBasisCourses), reused: String(r.work.reusedCompleteBasisCourses) });
  host.append(node('p', '03 / Keep every offered alternative'), node('h2', 'Which declared changes remain compatible?'),
    node('p', 'Same original readings at ' + r.finalUtc + '. Shared conditions: ' + r.query.sharingSource));
  const counts = node('div'); counts.className = 'boundary-counts';
  for (const [label, value] of [['Offered boundaries', r.boundaries.length], ['Compatible alternatives', r.compatibleBoundaries.length],
    ['Incompatible alternatives', r.boundaries.length - r.compatibleBoundaries.length]]) {
    const card = node('section'); card.append(node('strong', String(value)), node('span', label)); counts.append(card);
  }
  host.append(counts);
  if (r.ranges) {
    const layout = node('div'); layout.className = 'result-layout'; const cards = node('div'); cards.className = 'range-grid';
    for (const [field, label] of stores) {
      const range = r.ranges[field], card = node('section'); card.className = 'range-card';
      host.dataset[field + 'Lower'] = String(range.lower.differenceC.lower); host.dataset[field + 'Upper'] = String(range.upper.differenceC.upper);
      card.append(node('h3', label), node('strong', '≈ ' + compactSigned(range.lower.differenceC.lower) + ' to ' + compactSigned(range.upper.differenceC.upper) + ' °C'),
        node('p', 'Outer bounds across compatible offered boundaries · proposal minus existing at ' + point(accepted.investigation.readings[0])),
        extremeButton(field, 'lower'), extremeButton(field, 'upper')); cards.append(card);
    }
    layout.append(cards, locationFigure(accepted.investigation.readings)); host.append(layout);
    host.append(node('p', 'Negative means cooler in the proposal; positive means warmer. These outer bounds enclose the offered alternatives; they do not assert that every intermediate difference is attainable. Each component extreme may use a different boundary and profile.'));
  } else {
    const empty = node('p', 'None of the explicitly offered boundaries admits a profile in this model. There is no paired range; every original alternative remains inspectable and exportable.');
    empty.className = 'empty-family'; host.append(empty);
  }
  const alternatives = node('div'); alternatives.id = 'boundary-alternatives'; alternatives.className = 'boundary-alternatives';
  alternatives.setAttribute('role', 'group'); alternatives.setAttribute('aria-label', 'Every offered original boundary');
  r.boundaries.forEach((report, index) => {
    const button = node('button'); button.type = 'button'; button.dataset.index = String(index);
    button.dataset.split = String(report.query.splitAfterInterval); button.dataset.status = report.compatibility;
    button.setAttribute('aria-pressed', String(index === selectedBoundary));
    button.setAttribute('aria-label', 'After original interval ' + report.query.splitAfterInterval + ', ' + report.splitUtc + ', ' + report.compatibility);
    button.append(node('strong', 'After ' + report.query.splitAfterInterval), node('span', report.splitUtc.slice(5,16).replace('T',' ') + ' UTC'),
      node('span', report.compatibility === 'compatible' ? 'Compatible' : 'Incompatible'));
    button.addEventListener('click', () => chooseBoundary(index)); alternatives.append(button);
  });
  host.append(node('h3', 'Inspect an offered boundary'), alternatives);
  const label = node('label', 'Original boundary in supplied order'); label.className = 'witness-label'; const select = node('select'); select.id = 'boundary-select';
  r.boundaries.forEach((report, index) => { const option = node('option', 'After ' + report.query.splitAfterInterval + ' · ' + report.splitUtc + ' · ' + report.compatibility); option.value = String(index); select.append(option); });
  select.value = String(selectedBoundary); select.addEventListener('input', () => chooseBoundary(Number(select.value))); label.append(select); host.append(label);
  const detail = node('div'); detail.id = 'boundary-detail'; host.append(detail); drawBoundary();
  const complete = node('details'); complete.append(node('summary', 'Whole inquiry work and scope'),
    node('p', r.work.offeredBoundaries + ' offered boundaries; ' + r.work.completeBasisCourses + ' complete basis courses, of which ' + r.work.executedBasisCourses + ' were newly evaluated and ' + r.work.reusedCompleteBasisCourses + ' reused. '
      + r.work.executedWitnessCourses + ' witness courses; ' + r.work.geometryPasses + ' geometry passes.'),
    node('p', 'Admission reserved ' + r.work.reservedThermalCourses + ' total thermal courses and ' + r.work.reservedCourseIntervals + ' course intervals before execution. Every offered boundary must complete; no partial result is accepted.'),
    node('p', r.semantics)); host.append(complete);
}
drawSources(); controls();
for (const id of ['example', 'originals', 'reopen', 'splits', 'sharing']) $(id).disabled = false;
