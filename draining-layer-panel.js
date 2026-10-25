import {SURFACES} from './core.js';
import {DRAINING_LAYER_SCHEMA} from './draining-infiltration.js';
import {compareDrainingLayer, serializeDrainingLayer, parseDrainingLayer,
  checkDrainingFileBytes, makeDrainingExample, DRAINING_MEANING} from './draining-layer-study.js';
const node = (tag, text = '') => {const e = document.createElement(tag); e.textContent = text; return e;};
const number = value => value !== 0 && Math.abs(value) < 0.0001
  ? value.toExponential(3) : value.toLocaleString('en-US', {maximumSignificantDigits: 6});
const cellName = (p, i) => String.fromCharCode(65 + i % p.width) + (1 + Math.floor(i / p.width));
const sides = ['existing', 'proposal'];
const kinds = ['unlimited', 'closed', 'draining'];
const names = {unlimited: 'No receiving limit', closed: 'Closed layer', draining: 'Draining layer'};
const sideName = side => side === 'existing' ? 'Existing' : 'Proposed';
function svg(tag, attrs) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) e.setAttribute(key, String(value));
  return e;
}

export function mountDrainingLayer({getProject}) {
  const link = node('link'); link.rel = 'stylesheet';
  link.href = new URL('./draining-layer.css', import.meta.url); document.head.append(link);
  const panel = node('section'); panel.id = 'draining-layer'; panel.className = 'panel study';
  panel.innerHTML = '<span class="eyebrow">WATER / RECEIVING SPACE THROUGH TIME</span>' +
    '<h2>Can drainage keep receiving space available?</h2>' +
    '<p>Water leaving a finite layer can make room for more infiltration. Compare the same site with unlimited receiving, a closed layer and a layer that drains, while following the water left above ground.</p>' +
    '<p id="dl-place" class="mini-note"></p>' +
    '<div class="dl-actions"><button id="dl-current" type="button">Use current site</button><button id="dl-example" type="button" class="subtle">Try a fictional draining bed</button></div>' +
    '<form id="dl-form"><div class="input-pair">' +
    '<label class="input-label">Surface over the receiving layer<select id="dl-surface"></select></label>' +
    '<label class="input-label">Total layer storage · mm<input id="dl-capacity" type="number" min="0" max="10000" step="any" required></label></div>' +
    '<div class="input-pair"><label class="input-label">Water already in the layer · mm<input id="dl-initial" type="number" min="0" max="10000" step="any" required></label>' +
    '<label class="input-label">Drainage coefficient · /hour<input id="dl-drainage" type="number" min="0" max="100" step="any" required></label></div>' +
    '<p class="mini-note">At 1 /hour, an isolated layer retains about 37% of its water after one hour without incoming water. Zero means a closed layer. These values apply separately to every selected-surface cell in both maps.</p>' +
    '<label class="input-label">Source or explicit hypothetical basis<textarea id="dl-source" rows="2" maxlength="500" required></textarea></label>' +
    '<button id="dl-run" type="submit" class="primary">Compare drainage and ponding</button></form>' +
    '<p id="dl-status" role="status" aria-live="polite"></p><div id="dl-results"></div>' +
    '<div class="dl-actions"><button id="dl-save" type="button" disabled>Save original investigation</button>' +
    '<label class="input-label">Reopen original investigation<input id="dl-open" type="file" accept=".json,application/json"></label></div>' +
    '<details><summary>Model and source assumptions</summary><p id="dl-meaning" class="mini-note"></p></details>';
  document.querySelector('.observations').before(panel);
  const $ = id => panel.querySelector('#dl-' + id);
  for (const [key, surface] of Object.entries(SURFACES)) {
    const option = node('option', surface.label); option.value = key; $('surface').append(option);
  }
  $('surface').value = 'garden'; $('meaning').textContent = DRAINING_MEANING;
  let opened = null, accepted = null, generation = 0, key = '';
  const source = () => opened ?? getProject();
  const status = (message, state) => {$('status').textContent = message; $('status').dataset.state = state;};
  function invalidate(message) {
    generation++; accepted = null; $('save').disabled = true; $('run').disabled = false;
    $('results').replaceChildren(); status(message, 'draft');
  }
  function refresh() {
    const p = source(), next = JSON.stringify(p);
    if (next !== key) {key = next; invalidate('Declare the receiving layer, then compare.');}
    $('place').textContent = (opened ? 'Separate original site: ' : 'Current site: ') +
      p.title + ' · ' + p.width + ' × ' + p.height + ' cells. Working site unchanged.';
  }
  function readLayer() {
    for (const id of ['capacity', 'initial', 'drainage']) if (!$(id).value.trim())
      throw Error('Enter total storage, initial retained water and drainage coefficient explicitly');
    return {schema: DRAINING_LAYER_SCHEMA, surface: $('surface').value,
      capacityMm: Number($('capacity').value), initialStoredMm: Number($('initial').value),
      drainagePerHour: Number($('drainage').value), source: $('source').value};
  }
  function fill(layer) {
    $('surface').value = layer.surface; $('capacity').value = String(layer.capacityMm);
    $('initial').value = String(layer.initialStoredMm); $('drainage').value = String(layer.drainagePerHour);
    $('source').value = layer.source;
  }
  function inspect() {
    if (!accepted) return;
    const {project, report} = accepted, index = Number($('cell').value);
    const host = $('cell-account'); host.replaceChildren(node('h4', cellName(project, index) + ' · original cell'));
    for (const side of sides) {
      const result = report[side].draining, budget = result.waterBudget.cells[index];
      const layer = result.drainingLayer, retained = layer.retainedMm[index];
      const p = node('p', sideName(side) + ': ' + SURFACES[project[side][index].surface].label + '. ' +
        number(result.finalDepthMm[index]) + ' mm standing; ' + number(budget.absorbedLiters) +
        ' L entered the ground; ' + number(budget.incomingLiters) + ' L arrived from neighbors, ' +
        number(budget.outgoingLiters) + ' L went to neighbors and ' + number(budget.boundaryExitLiters) +
        ' L left the surface boundary. ' + (retained === null ? 'This cell has no declared receiving layer.' :
        'The layer began with ' + number(accepted.layer.initialStoredMm) + ' mm, retains ' + number(retained) +
        ' mm, and drained ' + number(layer.drainedMm[index]) + ' mm.'));
      p.dataset.side = side; p.dataset.finalDepth = String(result.finalDepthMm[index]); host.append(p);
    }
  }
  function drawCourse() {
    const {project, report} = accepted, side = $('side').value;
    const figure = $('course'); figure.replaceChildren();
    const chart = svg('svg', {viewBox: '0 0 680 260', role: 'img',
      'aria-label': sideName(side) + ' standing water: unlimited receiving, closed layer and draining layer'});
    chart.id = 'dl-chart';
    const maximum = Math.max(1, ...kinds.flatMap(kind => report[side][kind].snapshots.map(row => row.storedLiters)));
    const end = project.weather.durationMinutes, x = t => 65 + 590 * t / end, y = v => 210 - 175 * v / maximum;
    for (let i = 0; i <= 4; i++) {
      chart.append(svg('line', {x1: 65, x2: 655, y1: y(maximum * i / 4), y2: y(maximum * i / 4), stroke: '#d6e1de'}));
      const a = svg('text', {x: 57, y: y(maximum * i / 4) + 4, 'text-anchor': 'end'});
      a.textContent = number(maximum * i / 4); chart.append(a);
      const t = svg('text', {x: x(end * i / 4), y: 231, 'text-anchor': 'middle'});
      t.textContent = number(end * i / 4); chart.append(t);
    }
    for (const kind of kinds) {
      const attrs = {points: report[side][kind].snapshots.map(row => x(row.minute) + ',' + y(row.storedLiters)).join(' '),
        stroke: {unlimited: '#596b73', closed: '#a65b26', draining: '#087865'}[kind], fill: 'none', 'stroke-width': 3};
      if (kind === 'unlimited') attrs['stroke-dasharray'] = '3 4';
      if (kind === 'closed') attrs['stroke-dasharray'] = '9 4';
      chart.append(svg('polyline', attrs));
    }
    const yl = svg('text', {x: 10, y: 18}); yl.textContent = 'Standing water · L'; chart.append(yl);
    const xl = svg('text', {x: 360, y: 254, 'text-anchor': 'middle'}); xl.textContent = 'Minutes from event start'; chart.append(xl);
    figure.append(chart, node('figcaption', sideName(side) + ': dotted gray · unlimited; dashed amber · closed; solid green · draining. Lines join retained routing steps; they do not resolve peaks between steps.'));
  }
  function draw() {
    const {project, layer, report} = accepted, host = $('results'); host.replaceChildren();
    host.append(node('h3', 'The same source, three receiving assumptions'),
      node('p', layer.source), node('p', report.status === 'surface-absent'
        ? 'The selected surface is absent from both maps; the declaration changes no cells.'
        : 'The closed counterpart has the same initial remaining space. Original readings are retained; they do not fit these declared properties.'));
    const wrap = node('div'); wrap.className = 'dl-table'; wrap.tabIndex = 0;
    wrap.setAttribute('aria-label', 'Scrollable comparison table');
    const table = node('table'), caption = node('caption', 'Original site and proposal · liters unless marked mm');
    const head = node('thead'), header = node('tr'); header.append(node('th', 'Quantity'));
    for (const side of sides) for (const kind of kinds) {
      const th = node('th', sideName(side) + ' · ' + names[kind]); th.scope = 'col'; header.append(th);
    }
    head.append(header); table.append(caption, head); const body = node('tbody');
    for (const [metric, label] of [['rainLiters', 'Rain entering site'], ['absorbedLiters', 'Water entering ground'],
      ['storedLiters', 'Final standing water'], ['exitLiters', 'Surface boundary outflow'],
      ['maxDepthMm', 'Highest modeled depth · mm'], ['massErrorLiters', 'Surface water-account residual']]) {
      const tr = node('tr'), th = node('th', label); th.scope = 'row'; tr.append(th);
      for (const side of sides) for (const kind of kinds) {
        const value = report[side][kind][metric], td = node('td', number(value));
        Object.assign(td.dataset, {side, kind, metric, value: String(value)}); tr.append(td);
      }
      body.append(tr);
    }
    table.append(body); wrap.append(table); host.append(wrap);
    const change = report.change.storedLiters;
    const consequence = node('p', 'Proposed minus existing final standing water: ' +
      kinds.map(kind => number(change[kind]) + ' L · ' + names[kind].toLowerCase()).join('; ') +
      '. A negative value means less surface water in the proposal. Surface outflow and below-ground drainage are separate.');
    consequence.className = 'dl-consequence'; host.append(consequence);
    const accounts = node('div'); accounts.className = 'dl-accounts';
    for (const side of sides) {
      const r = report[side].draining.drainingLayer, section = node('section');
      section.dataset.side = side; section.dataset.drained = String(r.drainedLiters);
      section.dataset.retained = String(r.retainedLiters); section.dataset.initial = String(r.initialLiters);
      section.append(node('h4', sideName(side) + ' · below-ground water account'),
        node('p', number(r.initialLiters) + ' L initially retained + ' + number(r.infiltratedLiters) +
          ' L entering the layer = ' + number(r.retainedLiters) + ' L finally retained + ' +
          number(r.drainedLiters) + ' L drained. Residual: ' + number(r.balanceErrorLiters) + ' L.'),
        node('p', 'Applies to ' + r.affectedCellCount + ' cells. Drainage includes any original retained water; it is not all attributed to this rainfall.'));
      accounts.append(section);
    }
    host.append(accounts);
    const sideLabel = node('label', 'Inspect the standing-water course'); sideLabel.className = 'input-label';
    const sideSelect = node('select'); sideSelect.id = 'dl-side';
    for (const side of sides) {const option = node('option', sideName(side)); option.value = side; sideSelect.append(option);}
    sideSelect.value = 'proposal'; sideSelect.onchange = drawCourse; sideLabel.append(sideSelect);
    const course = node('figure'); course.id = 'dl-course'; host.append(sideLabel, course); drawCourse();
    const label = node('label', 'Inspect an original cell'); label.className = 'input-label';
    const select = node('select'); select.id = 'dl-cell';
    for (let i = 0; i < project.existing.length; i++) {const option = node('option', cellName(project, i)); option.value = String(i); select.append(option);}
    select.value = String(project.selectedIndex ?? 0); select.onchange = inspect; label.append(select);
    const account = node('div'); account.id = 'dl-cell-account'; account.setAttribute('aria-live', 'polite');
    host.append(label, account); inspect();
  }
  function install(project, layer, report) {accepted = {project, layer, report}; draw(); $('save').disabled = false;}
  $('form').addEventListener('input', () => invalidate('Layer declaration changed. Compare again.'));
  $('current').onclick = () => {opened = null; key = ''; refresh();};
  $('example').onclick = () => {
    const example = makeDrainingExample(); opened = example.project; key = ''; refresh(); fill(example.layer);
    invalidate('Fictional inputs loaded. Review the declaration, then compare.');
  };
  $('form').onsubmit = event => {
    event.preventDefault(); refresh(); invalidate('Comparing the three receiving assumptions…');
    const token = generation; let project, layer;
    try {project = structuredClone(source()); layer = readLayer();}
    catch (error) {status(error.message, 'refused'); return;}
    $('run').disabled = true; status('Computing the paired source courses…', 'pending');
    setTimeout(() => {
      if (token !== generation) return;
      try {install(project, layer, compareDrainingLayer(project, layer)); status('Compared from original inputs. No site or material property adopted.', 'computed');}
      catch (error) {status(error.message, 'refused');}
      finally {if (token === generation) $('run').disabled = false;}
    }, 10);
  };
  $('save').onclick = () => {
    if (!accepted) return;
    try {
      const text = serializeDrainingLayer(accepted.project, accepted.layer);
      const url = URL.createObjectURL(new Blob([text], {type: 'application/json'})), a = node('a');
      a.href = url; a.download = 'experimental-earth-draining-layer.json'; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {status(error.message, 'refused');}
  };
  $('open').onchange = async () => {
    const file = $('open').files?.[0]; if (!file) return;
    invalidate('Checking the original investigation…'); const token = generation;
    $('run').disabled = true; status('Reading original inputs…', 'opening');
    try {
      checkDrainingFileBytes(file.size); const bytes = await file.arrayBuffer();
      if (token !== generation) return;
      const input = parseDrainingLayer(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
      const report = compareDrainingLayer(input.project, input.layer);
      if (token !== generation) return;
      opened = input.project; key = JSON.stringify(opened); fill(input.layer);
      install(opened, input.layer, report); refresh(); status('Recomputed from original inputs. Working site unchanged.', 'reopened');
    } catch (error) {if (token === generation) status(error.message, 'refused');}
    finally {if (token === generation) {$('run').disabled = false; $('open').value = '';}}
  };
  refresh(); return {refresh};
}
