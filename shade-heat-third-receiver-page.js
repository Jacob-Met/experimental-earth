import { node, number, signed, point, table, locationFigure, drawEpochWitness } from './shade-heat-epoch-view.js';
import { parseSpatialOriginalReading } from './shade-heat-spatial-evidence.js';
import { checkShadeHeatBytes } from './shade-heat.js';
import { createShadeHeatComputation } from './shade-heat-computation.js';

const $ = id => document.querySelector('#third-' + id);
const computation = createShadeHeatComputation(() => new Worker(new URL('./shade-heat-third-receiver-worker.js', import.meta.url), { type: 'module' }));
let originals = null, primary = 0, accepted = null, generation = 0, reading = false, selectedBoundary = 0, selectedWitness = null, selectedScope = 'joint';
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
  const context = originals;
  originals.forEach((input, index) => {
    const p = input.source.project, r = input.query.reading, card = node('article');
    card.className = 'source-card'; card.dataset.primary = String(index === primary);
    card.dataset.additional = String(index === 2); card.dataset.cell = String(r.cellIndex);
    const badge = node('p', index === 2 ? 'Added reading' : 'First-two comparison'); badge.className = 'role-badge'; card.append(badge);
    if (index < 2) {
      const label = node('label'), radio = node('input'); radio.type = 'radio'; radio.name = 'comparison-point';
      radio.value = String(index); radio.checked = index === primary;
      radio.addEventListener('input', () => {
        if (!radio.checked || originals !== context) return; primary = index;
        invalidate('Comparison point changed within the same first two readings. Compare again.'); drawSources();
      });
      label.append(radio, node('span', 'Compare designs at ' + point(input))); card.append(label);
    } else card.append(node('h3', 'Additional receiver ' + point(input)));
    card.append(node('p', p.title), node('strong', String(r.temperatureC) + ' ± ' + String(r.halfWidthC) + ' °C'),
      node('p', 'Original existing-surface reading · ' + r.utc), node('p', r.source));
    const detail = node('p', p.width + ' × ' + p.height + ' original grid · original inquiry used ' + input.query.bins + ' sky bins.');
    detail.className = 'quiet'; card.append(detail);
    if (index < 2) {
      const button = node('button', 'Use this as the added reading'); button.type = 'button'; button.dataset.added = String(index);
      button.addEventListener('click', () => {
        if (originals !== context) return;
        originals = [...context.filter((_, i) => i !== index), input]; primary = 0;
        invalidate('Added reading changed. The other two now form the baseline; all original input records are preserved.'); drawSources();
      }); card.append(button);
    }
    host.append(card);
  });
}
function receive(next) {
  selectedScope = 'joint'; accepted = next; originals = next.investigation.readings; primary = 0; reading = false;
  $('splits').value = next.investigation.query.splitAfterIntervals.join(', ');
  $('sharing').value = next.investigation.query.sharingSource;
  const first = next.report.boundaries.findIndex(report => report.compatibility === 'compatible' || report.firstTwo.compatibility === 'compatible');
  selectedBoundary = Math.max(0, first);
  selectedWitness = next.report.boundaries[selectedBoundary].ranges?.surfaceC.lower.witnessId ?? null;
  drawSources(); draw(); controls();
  state(next.report.compatibility === 'compatible'
    ? next.report.compatibleBoundaries.length + ' offered boundaries fit all three readings; ' + next.report.firstTwoCompatibleBoundaries.length + ' fit the first two. This is a conditional model result, not an identified physical change time.'
    : 'No offered boundary admits a two-epoch profile in this declared model. Every alternative, the first-two comparison and all three original inputs are retained.', next.report.compatibility);
}
for (const id of ['splits', 'sharing']) $(id).addEventListener('input', () => { invalidate('Shared conditions changed. Compare again using all three original readings.'); updateBoundaryHint(); });
$('originals').addEventListener('change', async () => {
  const files = [...($('originals').files ?? [])]; if (!files.length) return; $('originals').value = '';
  const request = startFile('Reading all three original temperature-band files…');
  try {
    if (files.length !== 3) throw Error('Choose exactly three original reading-input files together');
    checkShadeHeatBytes(files.reduce((total, file) => total + file.size, 0));
    const inputs = await Promise.all(files.map(async file => {
      checkShadeHeatBytes(file.size); const bytes = await file.arrayBuffer();
      return parseSpatialOriginalReading(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
    }));
    if (request !== generation) return;
    originals = inputs; primary = 0; clearResult(); drawSources();
    state('Three original readings are loaded. The last card is the added reading; the first two form the baseline. Check these roles, then compare.', 'inputs-ready');
  } catch (error) {
    if (request === generation) state('Files refused: ' + error.message + (accepted ? ' The prior accepted inquiry is retained.' : ''), 'file-refused');
  } finally { if (request === generation) { reading = false; controls(); } }
});
$('form').addEventListener('submit', async event => {
  event.preventDefault(); if (!originals || pending()) return;
  const ordered = primary === 0 ? originals : [originals[1], originals[0], originals[2]];
  const query = { bins: 4, splitAfterIntervals: offered(), sharingSource: $('sharing').value };
  invalidate('Comparing the first two and all three readings across every offered boundary; complete original courses and witnesses may take a moment…'); const request = generation;
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
    const { makeThirdReceiverExample } = await import('./shade-heat-third-example.js');
    const text = JSON.stringify(makeThirdReceiverExample()); checkShadeHeatBytes(new Blob([text]).size); await parseIntoWorker(text, request);
  } catch (error) { if (request === generation && error.code !== 'superseded') state('Example refused: ' + error.message, 'file-refused'); }
  finally { if (request === generation) { reading = false; controls(); } }
});
$('export').addEventListener('click', () => {
  if (!accepted || pending()) return;
  const text = JSON.stringify(accepted.investigation); checkShadeHeatBytes(new Blob([text]).size);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), link = node('a');
  link.href = url; link.download = 'experimental-earth-three-receiver-inputs.json'; link.click();
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
const activeReport = () => selectedScope === 'prior' ? accepted.report.boundaries[selectedBoundary].firstTwo : accepted.report.boundaries[selectedBoundary];
function chooseBoundary(index, witnessId = null, scope = selectedScope) {
  if (!accepted || !Number.isInteger(index) || index < 0 || index >= accepted.report.boundaries.length) return;
  selectedScope = scope; selectedBoundary = index;
  const report = activeReport(); selectedWitness = witnessId ?? report.ranges?.surfaceC.lower.witnessId ?? null;
  $('select').value = String(index); $('scope').value = selectedScope;
  for (const button of $('alternatives').querySelectorAll('button'))
    button.setAttribute('aria-pressed', String(Number(button.dataset.index) === index));
  drawBoundary();
}
function extremeButton(field, bound, scope) {
  const context = accepted, ranges = scope === 'prior' ? accepted.report.firstTwoRanges : accepted.report.ranges;
  const range = ranges[field][bound], button = node('button',
    (bound === 'lower' ? 'Inspect minimum' : 'Inspect maximum') + ' · after ' + range.splitAfterInterval);
  button.type = 'button'; Object.assign(button.dataset, { store: field, bound, scope });
  button.setAttribute('aria-label', (scope === 'prior' ? 'First two readings, ' : 'All three readings, ')
    + stores.find(row => row[0] === field)[1].toLowerCase() + ' ' + bound);
  button.addEventListener('click', () => {
    if (accepted !== context) return;
    chooseBoundary(range.boundaryIndex, range.witnessId, scope); $('detail').scrollIntoView({ block: 'nearest' });
  }); return button;
}
function drawBoundary() {
  const context = accepted, r = activeReport(), host = $('detail'); host.replaceChildren();
  const label = selectedScope === 'prior' ? 'First two readings' : 'All three readings';
  Object.assign(host.dataset, { index: String(selectedBoundary), split: String(r.query.splitAfterInterval),
    scope: selectedScope, status: r.compatibility, originalStatic: r.originalStatic.compatibility, additiveStatic: r.additiveStatic.compatibility });
  host.append(node('h3', label + ' · change after interval ' + r.query.splitAfterInterval),
    node('p', r.splitUtc + ' · original final reading ' + r.finalUtc));
  const comparisons = node('div'); comparisons.className = 'model-grid';
  for (const [label, report] of [['Original static model', r.originalStatic], ['Additive static model', r.additiveStatic], ['Two-epoch additive model', r]]) {
    const card = node('section'); card.className = 'model-card'; card.dataset.status = report.compatibility;
    card.append(node('h4', label), node('strong', report.compatibility === 'compatible' ? 'Compatible' : 'No compatible profile')); comparisons.append(card);
  }
  host.append(comparisons);
  if (!r.staticCompatibilityAgrees) host.append(node('p', 'The two static comparisons disagree. A numerical coefficient-model difference is present; this cannot be attributed only to allowing a sky change.'));
  if (r.ranges) {
    host.append(table(label + ' · paired consequences at this boundary, approximately °C', ['Component', 'Minimum', 'Maximum'],
      stores.map(([field, title]) => [title, signed(r.ranges[field].lower.differenceC.lower), signed(r.ranges[field].upper.differenceC.upper)])));
    const witnessLabel = node('label', 'Inspect an extremal profile for this comparison'); witnessLabel.className = 'witness-label';
    const select = node('select'); select.id = 'third-witness-select';
    r.witnesses.forEach(witness => { const option = node('option', 'Extremum ' + (witness.id + 1)); option.value = String(witness.id); select.append(option); });
    select.value = String(selectedWitness);
    const witnessHost = node('div'); witnessHost.id = 'third-witness';
    const readings = selectedScope === 'prior' ? accepted.investigation.readings.slice(0, 2) : accepted.investigation.readings;
    const show = () => drawEpochWitness(witnessHost, { report: r, readings, witnessId: selectedWitness, prefix: 'third' });
    select.addEventListener('input', () => { if (accepted !== context) return; selectedWitness = Number(select.value); show(); });
    witnessLabel.append(select); host.append(witnessLabel, witnessHost); show();
  } else {
    const empty = node('p', 'No common profile satisfies ' + label.toLowerCase() + ' at this offered boundary. The complete original courses and the other comparison remain inspectable.');
    empty.className = 'empty-family'; host.append(empty);
  }
  const work = node('details'); work.append(node('summary', 'Complete evidence for this comparison'),
    node('p', r.work.completeBasisCourses + ' complete basis courses; ' + r.work.executedWitnessCourses + ' full witness courses; '
      + r.work.profileIntersection.candidates + ' exact feasible vertices. Leading-two basis courses are shared with the three-reading comparison, not repeated.'),
    node('p', r.numericalEvidence.scope), node('p', r.semantics));
  if (r.work.profileIntersection.emptyByLeadingTwoSubset) work.append(node('p', 'The completed first-two intersection is empty. A third constraint cannot restore feasibility, so the joint intersection is proved empty without enumerating additional vertices. Every third-point original basis course still completed.'));
  host.append(work);
  const numerical = node('details'); numerical.append(node('summary', 'Every original pair course and additive discrepancy'),
    node('pre', JSON.stringify(r.numericalEvidence.points, null, 2))); host.append(numerical);
}
function rangeGroup(scope, title, ranges) {
  const group = node('section'); group.className = 'comparison-ranges'; group.dataset.scope = scope;
  group.append(node('h3', title));
  if (!ranges) { group.append(node('p', 'No compatible offered boundary, so there is no paired consequence range.')); return group; }
  for (const [field, label] of stores) {
    const range = ranges[field], card = node('section'); card.className = 'range-card';
    card.append(node('h4', label), node('strong', '≈ ' + compactSigned(range.lower.differenceC.lower) + ' to ' + compactSigned(range.upper.differenceC.upper) + ' °C'),
      node('p', 'Outer bounds · proposal minus existing at ' + point(accepted.investigation.readings[0])),
      extremeButton(field, 'lower', scope), extremeButton(field, 'upper', scope)); group.append(card);
  }
  return group;
}
function draw() {
  const context = accepted, r = accepted.report, host = $('results'); host.hidden = false; host.replaceChildren(); resetResultData();
  Object.assign(host.dataset, { status: r.compatibility, cell: String(r.cellIndex), offered: String(r.boundaries.length),
    compatible: r.compatibleBoundaries.join(','), prior: r.firstTwoCompatibleBoundaries.join(','), excluded: r.excludedByThird.join(','),
    basis: String(r.work.executedBasisCourses), reused: String(r.work.reusedCompleteBasisCourses) });
  if (r.ranges) for (const [field] of stores) for (const bound of ['lower', 'upper'])
    host.dataset[field + bound[0].toUpperCase() + bound.slice(1)] = String(r.ranges[field][bound].differenceC[bound]);
  host.append(node('p', '03 / What does the added reading change?'), node('h2', 'Keep the comparison before and after'),
    node('p', 'Same original final time: ' + r.finalUtc + '. Shared conditions: ' + r.query.sharingSource));
  const counts = node('div'); counts.className = 'boundary-counts';
  for (const [label, value] of [['Offered boundaries', r.boundaries.length], ['Fit the first two', r.firstTwoCompatibleBoundaries.length],
    ['Fit all three', r.compatibleBoundaries.length], ['Excluded by the third', r.excludedByThird.length]]) {
    const card = node('section'); card.append(node('strong', String(value)), node('span', label)); counts.append(card);
  }
  host.append(counts);
  const notice = node('p', r.compatibleBoundaries.length === 1
    ? 'One offered boundary remains compatible under these declared assumptions. This does not identify a measured or physical change time.'
    : 'The added reading may narrow the possibilities, leave them unchanged, or reject them all. Compatibility is conditional on the declared model and original inputs.');
  notice.className = 'scope-notice'; host.append(notice);
  const ranges = node('div'); ranges.className = 'third-range-comparison';
  ranges.append(rangeGroup('prior', 'First two readings', r.firstTwoRanges), rangeGroup('joint', 'All three readings', r.ranges)); host.append(ranges);
  host.append(node('p', 'Negative means cooler in the proposal; positive means warmer. Outer bounds enclose the compatible offered alternatives and do not assert that every intermediate value is attainable. Each component extreme can use a different profile.'),
    locationFigure(accepted.investigation.readings));
  const alternatives = node('div'); alternatives.id = 'third-alternatives'; alternatives.className = 'boundary-alternatives';
  alternatives.setAttribute('role', 'group'); alternatives.setAttribute('aria-label', 'Every original boundary and both comparisons');
  r.boundaries.forEach((report, index) => {
    const button = node('button'); button.type = 'button';
    Object.assign(button.dataset, { index: String(index), split: String(report.query.splitAfterInterval),
      status: report.compatibility, prior: report.firstTwo.compatibility });
    button.setAttribute('aria-pressed', String(index === selectedBoundary));
    button.setAttribute('aria-label', 'After interval ' + report.query.splitAfterInterval + ', first two ' + report.firstTwo.compatibility + ', all three ' + report.compatibility);
    button.append(node('strong', 'After ' + report.query.splitAfterInterval), node('span', report.splitUtc.slice(5,16).replace('T',' ') + ' UTC'),
      node('span', 'First two: ' + (report.firstTwo.compatibility === 'compatible' ? 'fits' : 'no profile')),
      node('span', 'All three: ' + (report.compatibility === 'compatible' ? 'fits' : 'no profile')));
    button.addEventListener('click', () => { if (accepted === context) chooseBoundary(index); }); alternatives.append(button);
  });
  host.append(node('h3', 'Inspect every offered alternative'), alternatives);
  const label = node('label', 'Original boundary in supplied order'); label.className = 'witness-label'; const select = node('select'); select.id = 'third-select';
  r.boundaries.forEach((report, index) => { const option = node('option', 'After ' + report.query.splitAfterInterval + ' · ' + report.splitUtc); option.value = String(index); select.append(option); });
  select.value = String(selectedBoundary); select.addEventListener('input', () => { if (accepted === context) chooseBoundary(Number(select.value)); }); label.append(select); host.append(label);
  const scopeLabel = node('label', 'Reading comparison to inspect'); scopeLabel.className = 'witness-label'; const scope = node('select'); scope.id = 'third-scope';
  for (const [value, text] of [['joint','All three original readings'],['prior','First two original readings']]) { const option = node('option', text); option.value = value; scope.append(option); }
  scope.value = selectedScope; scope.addEventListener('input', () => { if (accepted === context) chooseBoundary(selectedBoundary, null, scope.value); });
  scopeLabel.append(scope); host.append(scopeLabel);
  const detail = node('div'); detail.id = 'third-detail'; host.append(detail); drawBoundary();
  const complete = node('details'); complete.append(node('summary', 'Whole inquiry work and scope'),
    node('p', r.work.completeBasisCourses + ' complete three-point basis courses: ' + r.work.executedBasisCourses + ' newly evaluated and ' + r.work.reusedCompleteBasisCourses + ' static courses reused. '
      + r.work.executedJointWitnessCourses + ' all-three witness courses plus ' + r.work.executedPriorWitnessCourses + ' first-two witness courses; '
      + r.work.geometryPasses + ' geometry passes.'),
    node('p', 'Before execution, the entire query reserved ' + r.work.reservedThermalCourses + ' thermal courses and ' + r.work.reservedCourseIntervals + ' course intervals. A failed course refuses the whole new inquiry.'),
    node('p', r.semantics)); host.append(complete);
}
drawSources(); controls();
for (const id of ['example', 'originals', 'reopen', 'splits', 'sharing']) $(id).disabled = false;
