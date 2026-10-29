import {
  SOIL_AIR_BOX_SCHEMA, SOIL_AIR_BOX_FILE_LIMIT, SOIL_AIR_BOX_ASSUMPTIONS, SOIL_AIR_BOX_PARAMETERS,
  inspectSoilAirBox, parseSoilAirBox, serializeSoilAirBox,
} from './soil-air-box.js';
import { makeSoilAirBoxExample } from './soil-air-box-example.js';

const $ = id => document.getElementById(id);
const node = (tag, text) => { const value = document.createElement(tag); if (text !== undefined) value.textContent = text; return value; };
const labels = {
  columnDepth: ['Packed column depth · L', 'Positive depth from surface to packed base.'],
  initialFront: ['Initial front depth · z₀', 'The connected gas pocket starts below this fully wet front.'],
  pondingHead: ['Constant ponding head · h', 'Positive surface water depth held constant; no batch history is inferred.'],
  capillaryHead: ['Capillary head · ψ', 'A nonnegative offered head; the range is not fitted from a reading.'],
  atmosphericHead: ['Atmospheric absolute head · H', 'Initially ambient gas pressure expressed as an absolute water head.'],
  targetFront: ['Target front depth · z', 'A separately declared depth inside every offered packed column.'],
};
const assumptionLabels = {
  constantPonding: 'The surface ponding head is constant for each offered condition.',
  rigidUniformColumn: 'The modeled column is rigid and homogeneous.',
  fullyWetSharpFront: 'A fully wet sharp front leaves a connected gas pocket ahead of it.',
  positiveConductivity: 'Water conductivity is positive; its value and elapsed time are not inferred.',
  isothermalIdealGas: 'The connected gas follows the isothermal ideal-gas relation.',
  initiallyAmbientAir: 'The initial connected gas is at the declared ambient absolute pressure.',
  noOtherGasStorage: 'There is no extra gas volume, retained gas behind the front or dissolved-gas storage.',
  releaseOnlyGasExchange: 'Gas can leave the modeled pocket; no additional gas enters it.',
  allRangeCombinations: 'Every combination in these ranges is offered. No correlations or probability distribution are inferred.',
};
let generation = 0, accepted = null, pending = false;

for (const name of SOIL_AIR_BOX_PARAMETERS) {
  const fieldset = node('fieldset'); fieldset.dataset.parameter = name;
  fieldset.append(node('legend', labels[name][0]));
  const note = node('p', labels[name][1]); note.className = 'field-note'; fieldset.append(note);
  const row = node('div'); row.className = 'endpoints';
  for (const bound of ['lower', 'upper']) {
    const label = node('label', bound === 'lower' ? 'Lower endpoint' : 'Upper endpoint');
    const input = node('input'); input.id = `${name}-${bound}`; input.type = 'number'; input.step = 'any'; input.required = true;
    label.append(input); row.append(label);
  }
  const unitLabel = node('label', 'Unit'), select = node('select'); select.id = `${name}-unit`;
  for (const unit of ['mm', 'cm', 'm']) { const option = node('option', unit); option.value = unit; select.append(option); }
  unitLabel.append(select); row.append(unitLabel); fieldset.append(row);
  const sourceLabel = node('label', 'Original source or basis'), text = node('textarea');
  sourceLabel.className = 'source-label'; text.id = `${name}-source`; text.maxLength = 1000; text.rows = 2; text.required = true;
  sourceLabel.append(text); fieldset.append(sourceLabel); $('ranges').append(fieldset);
}
for (const name of SOIL_AIR_BOX_ASSUMPTIONS) {
  const label = node('label'); label.className = 'assumption';
  const input = node('input'); input.type = 'checkbox'; input.id = `assumption-${name}`; input.required = true;
  label.append(input, node('span', assumptionLabels[name])); $('assumptions').append(label);
}
function status(message, state) { $('status').textContent = message; $('status').dataset.state = state; }
function controls() { $('inspect').disabled = pending; $('export').disabled = pending || !accepted; }
function clearResult() {
  accepted = null; $('results').hidden = true; $('results').replaceChildren();
  for (const key of Object.keys($('results').dataset)) delete $('results').dataset[key];
}
function invalidate() {
  generation++; pending = false; clearResult(); controls();
  status('Original ranges changed. Inspect them again before saving an accepted inquiry.', 'changed');
}
$('form').addEventListener('input', invalidate);
function readNumber(id) {
  const value = $(id).value;
  if (!value.trim()) throw new TypeError('Every range needs both original numeric endpoints.');
  const number = Number(value); if (!Number.isFinite(number)) throw new TypeError('Every endpoint must be a finite number.');
  return number;
}
function readSource() {
  return { schema: SOIL_AIR_BOX_SCHEMA, title: $('title').value,
    parameters: Object.fromEntries(SOIL_AIR_BOX_PARAMETERS.map(name => [name, {
      lower: readNumber(`${name}-lower`), upper: readNumber(`${name}-upper`),
      unit: $(`${name}-unit`).value, source: $(`${name}-source`).value,
    }])), assumptions: Object.fromEntries(SOIL_AIR_BOX_ASSUMPTIONS.map(name => [name, $(`assumption-${name}`).checked])) };
}
function fill(source) {
  $('title').value = source.title;
  for (const name of SOIL_AIR_BOX_PARAMETERS) {
    for (const field of ['lower', 'upper', 'unit', 'source']) $(`${name}-${field}`).value = String(source.parameters[name][field]);
  }
  for (const name of SOIL_AIR_BOX_ASSUMPTIONS) $(`assumption-${name}`).checked = source.assumptions[name];
}
function ratio(value) { return `${value.numerator} / ${value.denominator}`; }
function drawWitness(which, witness) {
  const card = node('article'); card.className = 'witness'; card.dataset.witness = which;
  card.append(node('h3', which === 'lower' ? 'A condition attaining the minimum' : 'A condition attaining the maximum'));
  const list = node('dl');
  for (const name of SOIL_AIR_BOX_PARAMETERS) {
    const row = witness.parameters[name]; list.append(node('dt', labels[name][0]), node('dd', `${String(row.value)} ${row.unit} · ${row.bound}`));
  }
  card.append(list);
  const fraction = node('p', `Exact removed fraction: ${ratio(witness.minimumRemovedFraction)}`); fraction.className = 'ratio'; card.append(fraction);
  card.append(node('p', witness.driveAtRequiredRemoval === 'positive'
    ? 'At this corner, zero removal leaves positive water drive.'
    : 'At this corner, the removal threshold gives exactly zero water drive.'));
  const details = node('details'); details.append(node('summary', 'Inspect exact converted values and balance'));
  const exact = node('ul'); exact.className = 'exact-list';
  for (const name of SOIL_AIR_BOX_PARAMETERS) exact.append(node('li', `${labels[name][0]}: ${ratio(witness.parameters[name].exactMM)} mm`));
  exact.append(node('li', `Unclipped balance: ${ratio(witness.unclippedBalance)}`)); details.append(exact); card.append(details);
  return card;
}
function draw(result) {
  const host = $('results'); host.replaceChildren(); host.hidden = false; host.dataset.classification = result.classification;
  const heading = {
    'all-require-removal': 'Every offered combination needs some gas to leave.',
    'mixed-requirement': 'The ranges include both zero-required and positive-required conditions.',
    'none-forced': 'This balance constraint forces no gas removal in the offered box.',
  }[result.classification];
  const kicker = node('p', 'Complete declared range · exact stored-number model'); kicker.className = 'result-kicker'; host.append(kicker, node('h2', heading));
  host.append(node('p', 'The exact minimum and maximum are attained by the corner conditions below. The percentages shown are outward-rounded bounds on the necessary removed fraction of the initial connected gas amount; they are not a probability interval.'));
  const bounds = node('div'); bounds.className = 'bounds';
  for (const [which, label, direction] of [['lower', 'Smallest requirement', 'Rounded downward'], ['upper', 'Largest requirement', 'Rounded upward']]) {
    const box = node('div'); box.className = 'bound';
    const name = node('span', label); name.className = 'bound-label';
    const value = node('strong', result.display[`${which}Percent`] + '%'); value.className = 'bound-value'; value.dataset.bound = which;
    const note = node('span', direction + ' to 0.0001 percentage point'); note.className = 'bound-direction';
    box.append(name, value, note); bounds.append(box);
  }
  host.append(bounds);
  const figure = node('figure'); figure.className = 'range-figure'; figure.append(node('figcaption', 'Required gas amount as a share of the initial pocket'));
  const track = node('div'); track.className = 'bound-track'; track.setAttribute('aria-hidden', 'true');
  const interval = node('span'); interval.className = 'bound-interval';
  const lower = Number(result.display.lowerPercent), upper = Number(result.display.upperPercent);
  interval.style.left = `${lower}%`; interval.style.width = `${Math.max(0, upper - lower)}%`; track.append(interval);
  for (const endpoint of [lower, upper]) { const marker = node('span'); marker.className = 'bound-marker'; marker.style.left = `${endpoint}%`; track.append(marker); }
  const ticks = node('div'); ticks.className = 'ticks'; ticks.append(node('span', '0%'), node('span', '50%'), node('span', '100%')); figure.append(track, ticks); host.append(figure);
  if (result.display.positiveLowerBelowDisplay) {
    const note = node('p', 'The exact minimum is strictly positive and below 0.0001% display resolution. The displayed 0.0000% is outward rounding, not an exact zero.');
    note.className = 'notice'; note.dataset.notice = 'positive-below-display'; host.append(note);
  }
  if (result.display.upperRoundedTo100) {
    const note = node('p', 'The exact maximum is below 100%. The displayed 100.0000% is an outward ceiling; every offered target remains above the packed base.');
    note.className = 'notice'; note.dataset.notice = 'rounded-to-100'; host.append(note);
  }
  const grid = node('div'); grid.className = 'witness-grid'; grid.append(drawWitness('lower', result.lower), drawWitness('upper', result.upper)); host.append(grid);
  const limits = node('p', 'At a positive threshold, equality gives zero drive. No arrival time, dynamically sufficient release schedule, verified measurement coverage or empirical validation follows.'); limits.className = 'quiet'; host.append(limits);
}
function receive(result, message) {
  accepted = result; pending = false; fill(result.source); draw(result); controls(); status(message, 'ready');
}
$('form').addEventListener('submit', event => {
  event.preventDefault(); generation++; pending = false; clearResult();
  try { receive(inspectSoilAirBox(readSource()), 'Every combination in the declared box is admitted. Exact bounds and their original corner conditions are ready.'); }
  catch (error) { controls(); status('Ranges refused: ' + error.message, 'refused'); }
});
$('example').addEventListener('click', () => {
  generation++; pending = false;
  try { receive(inspectSoilAirBox(makeSoilAirBoxExample()), 'Authored example opened and recomputed. These ranges are not acquired measurements.'); }
  catch (error) { clearResult(); controls(); status(error.message, 'refused'); }
});
$('reopen').addEventListener('change', async () => {
  const file = $('reopen').files?.[0]; if (!file) return; $('reopen').value = '';
  const token = ++generation; pending = true; controls(); status('Reading original ranges and checking the complete box…', 'pending');
  try {
    if (file.size > SOIL_AIR_BOX_FILE_LIMIT) throw new RangeError(`Original file must be within ${SOIL_AIR_BOX_FILE_LIMIT} bytes.`);
    const bytes = await file.arrayBuffer(); if (token !== generation) return;
    const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    const result = inspectSoilAirBox(parseSoilAirBox(content)); if (token !== generation) return;
    receive(result, 'Original ranges reopened. Exact bounds were recomputed independently from these inputs.');
  } catch (error) {
    if (token === generation) status('File refused: ' + error.message + (accepted ? ' The prior accepted inquiry is retained.' : ''), 'refused');
  } finally { if (token === generation) { pending = false; controls(); } }
});
$('export').addEventListener('click', () => {
  if (!accepted || pending) return;
  const url = URL.createObjectURL(new Blob([serializeSoilAirBox(accepted.source)], { type: 'application/json' }));
  const link = node('a'); link.href = url; link.download = 'experimental-earth-soil-air-ranges.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
controls();
