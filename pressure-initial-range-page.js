import { parsePressureBatches, PRESSURE_BATCH_FILE_LIMIT } from './pressure-batches.js';
import { inspectPressureInitialRange, normalizePressureInitialRange, parsePressureInitialRange,
  serializePressureInitialRange, PRESSURE_INITIAL_RANGE_SCHEMA, PRESSURE_INITIAL_RANGE_FILE_LIMIT } from './pressure-initial-range.js';
import { pressureInitialRangeExample, pressureInitialRangeConflictExample } from './pressure-initial-range-example.js';

const $ = id => document.getElementById('range-' + id), form = $('form');
const element = (tag, text, className) => { const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
const number = (value, digits = 8) => Number(value).toLocaleString('en-US', { maximumSignificantDigits: digits,
  notation: value !== 0 && (Math.abs(value) < .001 || Math.abs(value) >= 1e6) ? 'scientific' : 'standard' });
const original = value => number(value, 21);
const interval = (range, exact = false) => range ? '[' + range.map(v => exact ? original(v) : number(v)).join(', ') + '] L' : 'No common interval';
const phase = value => ({ before: 'Before the addition', after: 'After the addition', 'no-addition': 'No addition at this time' })[value];
const meaning = {
  retained: 'A common starting amount is consistent with the original bands.',
  'numerical-contact': 'Possible only at unresolved numerical contact; this is not an identified starting amount.',
  unresolved: 'Boundary brackets overlap, but no common passing amount was resolved at the requested width.',
  rejected: 'No common starting amount in the tested range fits all these readings.',
  'no-calibration': 'No calibration readings were assigned. The declared range remains a conditional input.',
  'no-challenge': 'No held-aside readings were assigned.',
  'not-applied-calibration-rejected': 'Calibration already rejected this explanation. Later readings cannot restore it.',
};
let source = null, epoch = 0, controller = null, retained = null;
function stopPending() { epoch++; controller?.abort(); controller = null; $('cancel').disabled = true; $('run').disabled = !source; return epoch; }
function invalidate(message) {
  stopPending(); retained = null; $('download').disabled = true; $('results').replaceChildren();
  $('status').textContent = message; $('import-status').textContent = '';
}
function sourceView(study) {
  const f = document.createDocumentFragment(), p = study.protocol;
  f.append(element('h3', study.title), element('p', study.place), element('p', study.source, 'source-note'));
  f.append(element('p', 'Original nominal starting water: ' + original(p.initialSurface.volume) + ' ' + p.initialSurface.unit + '.', 'range-original'));
  f.append(element('p', p.initialSurface.source, 'source-note'));
  f.append(element('p', study.hypotheses.length + ' offered explanations; ' + study.readings.filter(r => r.role === 'calibration').length +
    ' calibration and ' + study.readings.filter(r => r.role === 'challenge').length + ' held-aside readings.'));
  const details = element('details'); details.append(element('summary', 'Original protocol and water additions'));
  details.append(element('p', 'Area: ' + original(p.areaM2) + ' m². Source: ' + p.areaSource),
    element('p', 'Duration: ' + original(p.durationMinutes) + ' minutes. ' + p.assumptionsSource));
  for (const a of p.additions) details.append(element('p', a.id + ' · minute ' + original(a.minute) + ' · ' + original(a.volume) + ' ' + a.unit + '. Source: ' + a.source));
  f.append(details); return f;
}
function populate(inquiry) {
  source = structuredClone(inquiry.study); $('source').replaceChildren(sourceView(source));
  const values = { lower: inquiry.initialWater.lower, upper: inquiry.initialWater.upper, unit: inquiry.initialWater.unit,
    rangeSource: inquiry.initialWater.source, resolutionVolume: inquiry.resolution.volume, resolutionUnit: inquiry.resolution.unit };
  for (const [name, value] of Object.entries(values)) form.elements.namedItem(name).value = String(value);
  $('run').disabled = false;
}
function readEditor() {
  if (!source) throw Error('Open original batch-course inputs first.');
  const value = name => form.elements.namedItem(name).value;
  const numeric = name => value(name).trim() === '' ? NaN : Number(value(name));
  return normalizePressureInitialRange({ schema: PRESSURE_INITIAL_RANGE_SCHEMA, study: source,
    initialWater: { lower: numeric('lower'), upper: numeric('upper'), unit: value('unit'), source: value('rangeSource') },
    resolution: { volume: numeric('resolutionVolume'), unit: value('resolutionUnit') } });
}
const svgNode = (tag, attributes, text) => { const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attributes)) n.setAttribute(k, String(v)); if (text !== undefined) n.textContent = text; return n; };
function rangeChart(stage, inquiry, label) {
  const factor = inquiry.initialWater.unit === 'mL' ? .001 : 1;
  const low = inquiry.initialWater.lower * factor, high = inquiry.initialWater.upper * factor;
  const nominal = inquiry.study.protocol.initialSurface.volume * (inquiry.study.protocol.initialSurface.unit === 'mL' ? .001 : 1);
  const x = v => high === low ? 320 : 24 + 592 * (v - low) / (high - low);
  const wrap = element('div', undefined, 'range-chart'), svg = svgNode('svg', { viewBox: '0 0 640 112', role: 'img',
    'aria-label': label + '. Original range ' + interval([low, high], true) + '. Computed outer bracket ' + interval(stage.outerRangeLiters, true) });
  svg.append(svgNode('line', { x1: 24, x2: 616, y1: 38, y2: 38, stroke: '#d9e2d8', 'stroke-width': 20 }));
  if (stage.outerRangeLiters) {
    const [a, b] = stage.outerRangeLiters;
    svg.append(svgNode('line', { x1: x(a), x2: x(b), y1: 38, y2: 38, stroke: '#43775d', 'stroke-width': 20 }));
    if (a === b) svg.append(svgNode('circle', { cx: x(a), cy: 38, r: 11, fill: '#43775d' }));
  }
  const nominalLine = svgNode('line', { x1: x(nominal), x2: x(nominal), y1: 18, y2: 58, stroke: '#172f28', 'stroke-width': 4 });
  nominalLine.append(svgNode('title', {}, 'Original nominal start: ' + original(nominal) + ' L')); svg.append(nominalLine);
  svg.append(svgNode('text', { x: 24, y: 94, 'text-anchor': 'start', 'font-size': 24, fill: '#243b30' }, number(low, 5) + ' L'));
  svg.append(svgNode('text', { x: 616, y: 94, 'text-anchor': 'end', 'font-size': 24, fill: '#243b30' }, number(high, 5) + ' L'));
  wrap.append(svg); return wrap;
}
function stageView(stage, inquiry, title) {
  const box = element('div', undefined, 'range-stage'); box.dataset.status = stage.status;
  box.append(element('h3', title), element('p', meaning[stage.status]));
  if (stage.status === 'no-calibration' || stage.status === 'no-challenge') return box;
  if (stage.outerRangeLiters) {
    box.append(element('p', 'Computed outer bracket: ≈ ' + interval(stage.outerRangeLiters), 'range-summary'));
    box.append(rangeChart(stage, inquiry, title), element('p', 'Gray: declared range. Green: computed outer bracket. Dark line: original nominal start.', 'small'));
  }
  if (stage.numericalResolutionLimited) box.append(element('p', 'Floating-point spacing or the search bound prevented the requested width. The wider brackets remain explicit.'));
  if (stage.rejection?.kind === 'no-common-starting-amount') {
    box.append(element('p', 'The lower requirement is bracketed by ' + interval(stage.rejection.lowerBoundaryLiters) +
      ', while the upper requirement is bracketed by ' + interval(stage.rejection.upperBoundaryLiters) + '. Those requirements do not overlap.'));
    const witness = stage.rejection.separatingWitness;
    if (witness) {
      const evidence = element('section'); evidence.className = 'range-separating-witness';
      evidence.append(element('h4', 'Original readings behind this conflict'),
        element('p', 'At one checked starting amount of ' + original(witness.initialLiters) + ' L, these readings require opposite changes:'));
      for (const [direction, r] of [['larger', witness.requiresMore], ['smaller', witness.requiresLess]]) {
        const row = element('article'); row.dataset.separatingReading = r.id;
        row.append(element('h4', r.id + ' · minute ' + original(r.minute) + ' · ' + phase(r.phase)),
          element('p', (r.role === 'calibration' ? 'Calibration' : 'Held aside') + '. Original: ' + original(r.volume) +
            ' ± ' + original(r.uncertainty) + ' ' + r.unit + '.'),
          element('p', 'Modeled surface water: ' + original(r.predictedSurfaceLiters) + ' L. This reading requires a ' +
            direction + ' starting amount under the fixed numerical comparison allowance.'),
          element('p', 'Original band: ' + interval(r.originalBandLiters, true) +
            '. Separate range-comparison allowance: ' + original(r.rangeArithmeticAllowanceLiters) + ' L.', 'small'),
          element('p', r.source, 'source-note'));
        evidence.append(row);
      }
      evidence.append(element('p', 'These two readings cannot share a starting amount under this explanation and declared protocol. Their original evidence roles remain in force.'));
      box.append(evidence);
    }
  } else if (stage.rejection) {
    box.append(element('p', 'Even at the ' + (stage.rejection.kind.startsWith('below') ? 'largest' : 'smallest') +
      ' tested starting amount, these original readings fail: ' + stage.rejection.readings.map(r => r.id).join(', ') + '.'));
  }
  if (stage.outerRangeLiters) {
    const details = element('details'); details.append(element('summary', 'Exact numerical brackets and a checked example'));
    details.append(element('p', 'Outer bracket: ' + interval(stage.outerRangeLiters, true)),
      element('p', 'Inner bracket: ' + interval(stage.innerRangeLiters, true)),
      element('p', 'Lower boundary: ' + interval(stage.lowerBoundaryLiters, true)),
      element('p', 'Upper boundary: ' + interval(stage.upperBoundaryLiters, true)));
    if (stage.witness) {
      details.append(element('p', 'One checked starting amount: ' + original(stage.witness.initialLiters) + ' L. This is a computed example, not a unique estimate.'));
      for (const r of stage.witness.predictions) details.append(element('p', r.id + ': modeled ' + original(r.predictedSurfaceLiters) +
        ' L; original ' + original(r.volume) + ' ± ' + original(r.uncertainty) + ' ' + r.unit + '.'));
    }
    box.append(details);
  }
  return box;
}
function detailView(host, candidate, report) {
  host.replaceChildren(); host.append(element('h3', candidate.id));
  const h = candidate.hypothesis;
  host.append(element('p', 'K ' + original(h.conductivityMmHr) + ' mm/h; A ' + original(h.capillaryDriveMm) + ' mm; deficit ' +
    original(h.moistureDeficit) + '; initial cumulative infiltration ' + original(h.initialCumulativeMm) + ' mm.'), element('p', h.source, 'source-note'));
  host.append(stageView(candidate.calibration, report.inquiry, 'Calibration: one shared starting amount'));
  host.append(stageView(candidate.challenge, report.inquiry, report.hasCalibration
    ? 'Held-aside readings: keep the calibration constraints' : 'Held-aside readings under the original declared range'));
  host.append(element('h3', 'Original readings and conditional predictions'));
  if (!candidate.readings.length) host.append(element('p', 'No original readings were supplied. This is a prediction-only range.'));
  for (const r of candidate.readings) {
    const card = element('article', undefined, 'reading-result'); card.dataset.readingId = r.id;
    card.append(element('h3', r.id + ' · minute ' + original(r.minute) + ' · ' + phase(r.phase)));
    card.append(element('p', (r.role === 'calibration' ? 'Calibration' : 'Held aside') + '. Original: ' + original(r.volume) + ' ± ' + original(r.uncertainty) + ' ' + r.unit + '.'));
    card.append(element('p', 'Model at the original nominal start: ' + number(r.nominalPredictionLiters) + ' L.'));
    card.append(element('p', 'Model range over the declared starting interval: ≈ ' + interval(r.declaredRangePredictionLiters)));
    if (report.hasCalibration && r.calibrationRangePredictionLiters) card.append(element('p', 'Model range over the calibration outer bracket: ≈ ' + interval(r.calibrationRangePredictionLiters)));
    card.append(element('p', 'Source: ' + r.source, 'source-note'));
    card.append(element('p', 'Original band in liters: ' + interval(r.originalBandLiters, true) + '. Separate arithmetic allowance: ' + original(r.arithmeticAllowanceLiters) + ' L.', 'small'));
    host.append(card);
  }
}
function resultView(report) {
  const f = document.createDocumentFragment(); f.append(element('h2', 'Which explanations retain a common starting amount?'));
  f.append(element('p', 'Every offered explanation remains visible in its original order. A separate initial amount cannot be chosen for each calibration reading.'));
  if (!report.hasCalibration) f.append(element('p', 'No calibration evidence was assigned. These are conditional ranges, not supported soil properties.'));
  f.append(element('p', 'Declared starting range: ' + original(report.inquiry.initialWater.lower) + '–' + original(report.inquiry.initialWater.upper) +
    ' ' + report.inquiry.initialWater.unit + '. Source: ' + report.inquiry.initialWater.source, 'source-note'));
  const choices = element('div'), detail = element('div'); detail.id = 'range-detail';
  f.append(choices, detail); const buttons = [];
  for (const c of report.candidates) {
    const b = element('button', undefined, 'result-choice'); b.type = 'button'; b.dataset.candidateId = c.id; b.setAttribute('aria-pressed', 'false');
    b.append(element('strong', c.id), element('p', 'Calibration: ' + meaning[c.calibration.status]),
      element('p', 'Held aside: ' + meaning[c.challenge.status]), element('span', 'Inspect shared ranges and original readings', 'small'));
    b.addEventListener('click', () => { buttons.forEach(x => x.setAttribute('aria-pressed', String(x === b))); detailView(detail, c, report); });
    buttons.push(b); choices.append(b);
  }
  buttons[0].setAttribute('aria-pressed', 'true'); detailView(detail, report.candidates[0], report);
  f.append(element('p', 'Requested numerical width: ' + original(report.requestedWidthLiters) + ' L. The arithmetic allowance remains separate from original measurement uncertainty.', 'small'));
  f.append(element('p', report.qualification, 'small range-qualification')); return f;
}
function adopt(serialized, report, view, message) {
  retained = serialized; $('results').replaceChildren(view); $('download').disabled = false;
  $('cancel').disabled = true; $('run').disabled = false; controller = null; $('status').textContent = message;
}
async function runInquiry(inquiry, message) {
  const token = stopPending(); controller = new AbortController();
  $('run').disabled = true; $('cancel').disabled = false; $('status').textContent = 'Checking shared starting amounts…';
  try {
    const serialized = serializePressureInitialRange(inquiry);
    const report = await inspectPressureInitialRange(inquiry, { signal: controller.signal, yieldControl: () => new Promise(resolve => setTimeout(resolve, 0)) });
    const view = resultView(report); if (token !== epoch) return;
    adopt(serialized, report, view, message);
  } catch (error) {
    if (token !== epoch) return;
    controller = null; $('cancel').disabled = true; $('run').disabled = !source;
    $('status').textContent = 'Inquiry refused: ' + error.message;
  }
}
form.addEventListener('input', () => invalidate('Inputs changed. Inspect the current range again.'));
form.addEventListener('change', () => invalidate('Inputs changed. Inspect the current range again.'));
form.addEventListener('submit', event => { event.preventDefault(); if (!form.reportValidity()) return;
  try { const inquiry = readEditor(); runInquiry(inquiry, 'Inquiry complete. The original course is unchanged; only original inputs are saved.'); }
  catch (error) { $('status').textContent = 'Inquiry refused: ' + error.message; } });
$('cancel').addEventListener('click', () => invalidate('Calculation stopped. Original inputs remain available.'));
for (const [id, example] of [['example', pressureInitialRangeExample], ['conflict-example', pressureInitialRangeConflictExample]]) {
  $(id).addEventListener('click', () => {
    const inquiry = example(); invalidate('Loading an authored mathematical control…'); populate(inquiry);
    runInquiry(inquiry, 'Authored mathematical control complete. These readings and uncertainty are fictional, not acquired measurements.');
  });
}
$('study-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return; const token = stopPending();
  $('import-status').textContent = 'Reading original batch inputs…';
  try {
    if (file.size > PRESSURE_BATCH_FILE_LIMIT) throw Error('Original batch inputs exceed 220000 UTF-8 bytes.');
    const raw = await file.text(); if (token !== epoch) return;
    const next = parsePressureBatches(raw), view = sourceView(next);
    source = next; $('source').replaceChildren(view);
    for (const name of ['lower', 'upper', 'rangeSource']) form.elements.namedItem(name).value = '';
    form.elements.namedItem('unit').value = next.protocol.initialSurface.unit;
    invalidate('Original batch course opened. Declare its starting-water range and source.');
    $('import-status').textContent = 'Opened ' + file.name + '. No initial uncertainty was inferred.';
  } catch (error) { if (token === epoch) {
    $('import-status').textContent = 'Open refused: ' + error.message + ' The previous source and editor remain in place.';
    $('status').textContent = retained ? 'Previous accepted inquiry retained.' : 'No completed inquiry for these inputs. Inspect the current range again.';
  } }
});
$('inquiry-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return; const token = stopPending(); controller = new AbortController();
  $('import-status').textContent = 'Reading saved initial-water inputs…'; $('cancel').disabled = false;
  try {
    if (file.size > PRESSURE_INITIAL_RANGE_FILE_LIMIT) throw Error('Initial-water inputs exceed 240000 UTF-8 bytes.');
    const raw = await file.text(); if (token !== epoch) return;
    const inquiry = parsePressureInitialRange(raw), serialized = serializePressureInitialRange(inquiry);
    const report = await inspectPressureInitialRange(inquiry, { signal: controller.signal, yieldControl: () => new Promise(resolve => setTimeout(resolve, 0)) });
    const view = resultView(report); if (token !== epoch) return;
    populate(inquiry); adopt(serialized, report, view, 'Recomputed from original saved inputs. No site or soil explanation was adopted.');
    $('import-status').textContent = 'Opened ' + file.name + '. Calibration remains separate from held-aside readings.';
  } catch (error) { if (token === epoch) {
    controller = null; $('cancel').disabled = true; $('run').disabled = !source;
    $('import-status').textContent = 'Open refused: ' + error.message + ' The previous source, editor and accepted result remain in place.';
    $('status').textContent = retained ? 'Previous accepted inquiry retained.' : 'No completed inquiry for these inputs. Inspect the current range again.';
  } }
});
$('download').addEventListener('click', () => {
  if (!retained) return;
  const url = URL.createObjectURL(new Blob([retained], { type: 'application/json' })), link = element('a');
  link.href = url; link.download = 'experimental-earth-pressure-initial-range.json'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
