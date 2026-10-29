import { SOIL_AIR_ASSUMPTIONS, SOIL_AIR_SCHEMA, SOIL_AIR_FILE_LIMIT,
  normalizeSoilAirBoundary, parseSoilAirBoundary, serializeSoilAirBoundary, inspectSoilAirBoundary } from './soil-air-boundary.js';
import { soilAirBoundaryExample } from './soil-air-boundary-example.js';

const $ = id => document.querySelector('#air-' + id), form = $('form');
const f = name => form.elements.namedItem(name);
const colors = ['#155f51', '#aa4f30', '#5453a3', '#1c6f9e', '#884a75', '#77711e', '#337b38', '#9c4451', '#415e67'];
let generation = 0, accepted = null;
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function number(value) { return new Intl.NumberFormat('en', { maximumSignificantDigits: 7 }).format(value); }
function percent(value) { return number(value * 100) + '%'; }
function field(label, name, value = '', type = 'text') {
  const host = el('label', label), input = el(type === 'textarea' ? 'textarea' : 'input');
  input.name = name; input.value = value; input.required = true;
  if (type === 'textarea') { input.rows = 2; input.maxLength = 1000; }
  else { input.type = type; if (type === 'number') { input.min = 0; input.step = 'any'; } else input.maxLength = 120; }
  host.append(input); return host;
}
function unitField(name, value = 'mm') {
  const host = el('label', 'Original unit'), select = el('select'); select.name = name;
  for (const value of ['mm', 'cm', 'm']) { const option = el('option', value); option.value = value; select.append(option); }
  select.value = value; host.append(select); return host;
}
function addAlternative(row = { id: '', capillaryHead: '', unit: 'mm', source: '' }) {
  const host = el('div', undefined, 'air-alternative'), fields = el('div', undefined, 'fields');
  fields.append(field('Alternative name', 'alternativeId', row.id), field('Capillary head', 'capillaryHead', row.capillaryHead, 'number'), unitField('capillaryUnit', row.unit));
  const remove = el('button', 'Remove alternative', 'secondary'); remove.type = 'button';
  remove.addEventListener('click', () => { invalidate(); host.remove(); syncAdd(); });
  const actions = el('div', undefined, 'actions'); actions.append(remove);
  host.append(fields, field('Original source or hypothesis', 'capillarySource', row.source, 'textarea'), actions);
  $('hypotheses').append(host); syncAdd();
}
function syncAdd() { $('add').disabled = $('hypotheses').children.length >= 9; }
function fill(source) {
  f('title').value = source.title;
  for (const name of ['depth', 'initialFront']) f(name).value = source.column[name];
  f('columnUnit').value = source.column.unit; f('columnSource').value = source.column.source;
  for (const name of ['pondingHead', 'atmosphericHead']) f(name).value = source.boundary[name];
  f('boundaryUnit').value = source.boundary.unit; f('boundarySource').value = source.boundary.source;
  f('targetFront').value = source.target.front; f('targetUnit').value = source.target.unit; f('targetSource').value = source.target.source;
  f('assumptions').checked = true;
  $('hypotheses').replaceChildren(); source.hypotheses.forEach(addAlternative);
}
function numeric(element) {
  if (element.value.trim() === '') throw new TypeError('Every physical value must be explicitly declared.');
  return Number(element.value);
}
function read() {
  return normalizeSoilAirBoundary({ schema: SOIL_AIR_SCHEMA, title: f('title').value,
    column: { depth: numeric(f('depth')), initialFront: numeric(f('initialFront')), unit: f('columnUnit').value, source: f('columnSource').value },
    boundary: { pondingHead: numeric(f('pondingHead')), atmosphericHead: numeric(f('atmosphericHead')), unit: f('boundaryUnit').value, source: f('boundarySource').value },
    target: { front: numeric(f('targetFront')), unit: f('targetUnit').value, source: f('targetSource').value },
    hypotheses: [...$('hypotheses').children].map(row => {
      const input = name => row.querySelector('[name=' + name + ']');
      return { id: input('alternativeId').value, capillaryHead: numeric(input('capillaryHead')), unit: input('capillaryUnit').value, source: input('capillarySource').value };
    }), assumptions: Object.fromEntries(SOIL_AIR_ASSUMPTIONS.map(name => [name, f('assumptions').checked])) });
}
function invalidate() {
  generation++; accepted = null; $('results').replaceChildren(); $('download').disabled = true;
  $('status').textContent = 'Inputs changed. Compare again to update the physical limits.';
}
function svgElement(tag, attributes, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}
function chart(result) {
  const host = el('figure', undefined, 'air-chart');
  const svg = svgElement('svg', { viewBox: '0 0 720 400', role: 'img', 'aria-label': 'Necessary fraction of initial connected gas removed as front depth increases. Dashed line is the declared target. The base endpoint is a limit only.' });
  const { depthMm: L, initialFrontMm: z0, targetMm } = result.geometry;
  const x = z => 110 + 578 * (z - z0) / (L - z0), y = v => 310 - 240 * v;
  for (const fraction of [0, .5, 1]) {
    svg.append(svgElement('line', { x1: 110, x2: 688, y1: y(fraction), y2: y(fraction), stroke: '#d7e2da' }),
      svgElement('text', { x: 98, y: y(fraction) + 6, 'text-anchor': 'end' }, fraction * 100 + '%'));
  }
  svg.append(svgElement('text', { x: 110, y: 34 }, 'Minimum initial gas amount removed'),
    svgElement('line', { x1: x(targetMm), x2: x(targetMm), y1: 60, y2: 310, stroke: '#65746c', 'stroke-dasharray': '6 5' }));
  result.alternatives.forEach((row, i) => {
    let path = '', active = false;
    const points = [...row.profile, { frontMm: row.closedAir.limitingFrontMm, minimumRemovedFraction: 0 }];
    if (row.target.minimumRemovedFraction !== null) points.push(row.target);
    points.sort((a, b) => a.frontMm - b.frontMm);
    for (const point of points) {
      if (point.minimumRemovedFraction === null) { active = false; continue; }
      path += (active ? ' L' : ' M') + x(point.frontMm) + ',' + y(point.minimumRemovedFraction); active = true;
    }
    svg.append(svgElement('path', { d: path, fill: 'none', stroke: colors[i], 'stroke-width': 3 }));
    if (row.target.minimumRemovedFraction !== null) svg.append(svgElement('circle', { cx: x(targetMm), cy: y(row.target.minimumRemovedFraction), r: 5, fill: colors[i] }));
  });
  for (const [z, anchor] of [[z0, 'start'], [(z0 + L) / 2, 'middle'], [L, 'end']]) {
    svg.append(svgElement('text', { x: x(z), y: 346, 'text-anchor': anchor }, number(z)));
  }
  svg.append(svgElement('text', { x: 388, y: 384, 'text-anchor': 'middle' }, 'Front depth below soil surface · mm'));
  const legend = el('ul', undefined, 'air-legend');
  result.alternatives.forEach((row, i) => {
    const item = el('li'), swatch = el('span', undefined, 'air-swatch'); swatch.style.backgroundColor = colors[i];
    item.append(swatch, document.createTextNode(row.id)); legend.append(item);
  });
  host.append(svg, legend, el('figcaption', 'Curves connect sampled static states. The 100% value at the packed base is a mathematical limit, not a finite-pressure gas state.'));
  return host;
}
function originalValue(row, name) { return String(row[name]) + ' ' + row.unit; }
function sourceDetail(source) {
  const detail = el('details'), summary = el('summary', 'Original declarations and full precision'); detail.append(summary);
  const lines = [
    ['Packed depth', originalValue(source.column, 'depth')], ['Initial front', originalValue(source.column, 'initialFront')],
    ['Column source', source.column.source], ['Ponding head', originalValue(source.boundary, 'pondingHead')],
    ['Atmospheric absolute head', originalValue(source.boundary, 'atmosphericHead')], ['Boundary source', source.boundary.source],
    ['Target front', originalValue(source.target, 'front')], ['Target source', source.target.source],
  ];
  for (const h of source.hypotheses) lines.push([h.id, originalValue(h, 'capillaryHead')], [h.id + ' source', h.source]);
  for (const [name, value] of lines) detail.append(el('h4', name), el('p', value, 'air-source'));
  return detail;
}
function display(result) {
  const host = document.createDocumentFragment();
  host.append(el('h2', result.source.title), el('p', 'At the declared target: ' + String(result.source.target.front) + ' ' + result.source.target.unit));
  const cards = el('div', undefined, 'air-limit-grid');
  const vented = el('div', undefined, 'air-limit-card');
  vented.append(el('h3', 'Freely vented air'), el('p', 'No internal air-pressure stall', 'air-main-value'),
    el('p', 'Gas stays at atmospheric pressure. This says nothing about elapsed time or what happens when the front reaches the sealed base.'));
  cards.append(vented);
  const fixed = el('div', undefined, 'air-limit-card');
  fixed.append(el('h3', 'All original gas retained'), el('p', 'A pressure-balance limit for each capillary choice'),
    el('p', 'Beyond that limit, keeping the whole initial gas amount would oppose forward water flow. A different gas-exchange model is needed.'));
  cards.append(fixed); host.append(cards, chart(result));
  host.append(el('p', 'The percentages refer to gas amount (moles, or mass at fixed composition), not emptied pore volume. For targets beyond the closed-air limit, equality at the positive removal threshold gives zero driving force; more release is needed for positive flow. Before that limit, zero removal can still permit positive flow. No release schedule, arrival time or measured release is inferred.', 'air-note'));
  result.alternatives.forEach(row => {
    const detail = el('article', undefined, 'air-detail'); detail.dataset.alternativeId = row.id;
    detail.append(el('h3', row.id));
    const fraction = row.target.minimumRemovedFraction;
    if (fraction === null) {
      detail.append(el('p', 'Target is in the numerical contact band', 'air-main-value'),
        el('p', 'The target is too close to the computed equilibrium for this calculation to report a positive release requirement. This is arithmetic resolution, not measurement uncertainty.'));
    } else if (fraction === 0) {
      detail.append(el('p', 'No gas removal required by this balance', 'air-main-value'),
        el('p', 'The target lies before the closed-air pressure limit. This does not establish whether a real column releases air.'));
    } else {
      detail.append(el('p', 'At least ' + percent(fraction) + ' of the initial gas amount', 'air-main-value'),
        el('p', 'must have left the modeled pocket to avoid a negative water-driving head at the target. This is conditional on every declared assumption.'));
    }
    const dl = el('dl');
    for (const [label, value] of [
      ['Closed-air limiting front', number(row.closedAir.limitingFrontMm) + ' mm'],
      ['Advance from the declared initial front', number(row.closedAir.advancementMm) + ' mm'],
      ['Gas gauge head at that limit', number(row.closedAir.gaugeHeadMm) + ' mm of water'],
      ['Target zero-flow gas gauge head', number(row.target.zeroFlowGaugeHeadMm) + ' mm of water'],
      ['Counterfactual target head if all gas remained', number(row.target.closedGaugeHeadMm) + ' mm of water'],
    ]) dl.append(el('dt', label), el('dd', value));
    detail.append(dl);
    const exact = el('details'); exact.append(el('summary', 'Computed values and arithmetic contact'));
    const exactValues = el('dl');
    for (const [label, value] of [
      ['Limiting front · mm', row.closedAir.limitingFrontMm], ['Front advance · mm', row.closedAir.advancementMm],
      ['Remaining gas-depth factor · mm', row.closedAir.remainingGasDepthMm], ['Gas-volume fraction at limit', row.closedAir.gasVolumeFraction],
      ['Absolute gas head at limit · mm', row.closedAir.absoluteHeadMm], ['Pressure-balance residual · mm', row.closedAir.balanceResidualMm],
      ['Minimum removed fraction', fraction === null ? 'Unresolved at numerical contact' : fraction],
      ['Numerical contact half-width · mm', row.target.numericalContactMm],
    ]) { const valueNode = el('dd'); valueNode.append(el('code', String(value))); exactValues.append(el('dt', label), valueNode); }
    exact.append(exactValues, el('p', 'The contact guard and residual describe floating-point arithmetic. They are not a certified interval or a physical uncertainty estimate.'));
    detail.append(exact); host.append(detail);
  });
  host.append(sourceDetail(result.source));
  return host;
}
function prepare(source) {
  const result = inspectSoilAirBoundary(source), content = serializeSoilAirBoundary(result.source);
  return { source: result.source, content, fragment: display(result) };
}
function commit(prepared, message, fillEditor = false) {
  if (fillEditor) fill(prepared.source);
  $('results').replaceChildren(prepared.fragment); accepted = prepared; $('download').disabled = false; $('status').textContent = message;
}
form.addEventListener('input', invalidate);
form.addEventListener('change', invalidate);
form.addEventListener('submit', event => {
  event.preventDefault(); generation++; accepted = null; $('download').disabled = true; $('results').replaceChildren();
  try { commit(prepare(read()), 'Computed from the original declarations. No physical validation or time prediction.'); }
  catch (error) { $('status').textContent = 'Comparison refused: ' + error.message; }
});
$('add').addEventListener('click', () => { invalidate(); addAlternative(); });
$('example').addEventListener('click', () => {
  generation++; commit(prepare(soilAirBoundaryExample()), 'Authored mathematical example. All parameters and the target are declarations, not observations.', true);
  $('import-status').textContent = '';
});
$('import').addEventListener('change', async () => {
  const ticket = ++generation, file = $('import').files[0]; if (!file) return;
  try {
    if (file.size > SOIL_AIR_FILE_LIMIT) throw new RangeError('Original inquiry exceeds ' + SOIL_AIR_FILE_LIMIT + ' bytes.');
    const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    if (ticket !== generation) return;
    const prepared = prepare(parseSoilAirBoundary(content));
    if (ticket !== generation) return;
    commit(prepared, 'Recomputed the static limits from saved original inputs.', true);
    $('import-status').textContent = 'Opened ' + file.name + '.';
  } catch (error) { if (ticket === generation) $('import-status').textContent = 'Open refused: ' + error.message; }
  finally { if (ticket === generation) $('import').value = ''; }
});
$('download').addEventListener('click', () => {
  if (!accepted) return;
  const url = URL.createObjectURL(new Blob([accepted.content], { type: 'application/json' }));
  const link = el('a'); link.href = url; link.download = 'experimental-earth-soil-air-boundary.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});
addAlternative();
