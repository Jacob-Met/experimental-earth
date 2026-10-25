import {makeExample, SURFACES} from './core.js';
import {INFILTRATION_STORAGE_MODEL} from './infiltration-storage.js';
import {
  compareInfiltrationStorage, serializeInfiltrationStorage, parseInfiltrationStorage,
  checkStorageFileBytes, STORAGE_MEANING,
} from './infiltration-storage-study.js';

const node = (tag, text = '') => { const e = document.createElement(tag); e.textContent = text; return e; };
const svg = (tag, attributes) => {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) e.setAttribute(key, String(value));
  return e;
};
const number = value => value !== 0 && Math.abs(value) < 0.0001
  ? Number(value).toExponential(3) : Number(value).toLocaleString('en-US', {maximumSignificantDigits: 6});
const cellName = (project, i) => String.fromCharCode(65 + i % project.width) + (1 + Math.floor(i / project.width));
const sides = ['existing', 'proposal'];
const kinds = ['unlimited', 'limited'];

export function mountInfiltrationStorage({getProject}) {
  const link = node('link'); link.rel = 'stylesheet';
  link.href = new URL('./infiltration-storage.css', import.meta.url); document.head.append(link);
  const panel = node('section'); panel.id = 'infiltration-storage'; panel.className = 'panel study';
  panel.innerHTML = '<span class="eyebrow">WATER / ROOM BELOW THE SURFACE</span>' +
    '<h2>What changes when the ground has no more room?</h2>' +
    '<p>A shallow receiving layer can fill. Compare the same place and storm with a declared limit on the water that can enter, and follow the water that stays above ground.</p>' +
    '<p id="is-place" class="mini-note"></p>' +
    '<div class="is-actions"><button id="is-current" type="button">Use current site</button><button id="is-example" type="button" class="subtle">Try a fictional shallow bed</button></div>' +
    '<form id="is-form"><div class="input-pair">' +
    '<label class="input-label">Surface with a closed receiving layer<select id="is-surface"></select></label>' +
    '<label class="input-label">Space remaining at event start · mm<input id="is-capacity" type="number" min="0" max="10000" step="any" required></label></div>' +
    '<label class="input-label">Source or explicit hypothetical assumption<textarea id="is-source" rows="2" maxlength="500" required></textarea></label>' +
    '<p class="mini-note">The same remaining space applies separately to each selected-surface cell in both maps. No drainage or recovery occurs in this receiving layer during the event. Other surfaces keep their original infiltration assumptions.</p>' +
    '<button id="is-run" type="submit" class="primary">Compare receiving capacity</button></form>' +
    '<p id="is-status" role="status" aria-live="polite"></p><div id="is-results"></div>' +
    '<div class="is-actions"><button id="is-save" type="button" disabled>Save original investigation</button>' +
    '<label class="input-label">Reopen original investigation<input id="is-open" type="file" accept=".json,application/json"></label></div>' +
    '<details><summary>What this comparison assumes</summary><p id="is-meaning" class="mini-note"></p></details>';
  document.querySelector('.observations').before(panel);
  const $ = id => panel.querySelector('#is-' + id);
  for (const [key, value] of Object.entries(SURFACES)) {
    const option = node('option', value.label); option.value = key; $('surface').append(option);
  }
  $('surface').value = 'garden';
  $('meaning').textContent = STORAGE_MEANING;
  let opened = null, accepted = null, generation = 0, key = '';
  const source = () => opened ?? getProject();
  const status = (message, state) => { $('status').textContent = message; $('status').dataset.state = state; };
  function invalidate(message) {
    generation++; accepted = null; $('save').disabled = true; $('run').disabled = false;
    $('results').replaceChildren(); status(message, 'draft');
  }
  function refresh() {
    const project = source(), next = JSON.stringify(project);
    if (next !== key) { key = next; invalidate('Compare the declared capacity with this original site.'); }
    $('place').textContent = (opened ? 'Separate original site: ' : 'Current site: ') +
      project.title + ' · ' + project.width + ' × ' + project.height +
      ' cells. This investigation does not replace the working site.';
  }
  function readStorage() {
    if (!$('capacity').value.trim()) throw Error('Enter the space remaining at event start');
    return {schema: INFILTRATION_STORAGE_MODEL, surface: $('surface').value,
      remainingCapacityMm: Number($('capacity').value), source: $('source').value};
  }
  function fill(storage) {
    $('surface').value = storage.surface; $('capacity').value = String(storage.remainingCapacityMm);
    $('source').value = storage.source;
  }
  function inspect(index) {
    if (!accepted) return;
    const {project, report} = accepted;
    $('cell').value = String(index);
    const host = $('cell-account'); host.replaceChildren(node('h4', cellName(project, index) + ' · original cell account'));
    for (const side of sides) {
      const r = report[side].limited, budget = r.waterBudget.cells[index], retained = r.infiltrationStorage.retainedMm[index];
      const p = node('p', (side === 'existing' ? 'Existing' : 'Proposed') + ': ' +
        SURFACES[project[side][index].surface].label + '. ' +
        number(r.finalDepthMm[index]) + ' mm standing at event end; ' +
        number(budget.absorbedLiters) + ' L entered the ground; ' +
        number(budget.incomingLiters) + ' L arrived from neighbors, ' +
        number(budget.outgoingLiters) + ' L went to neighbors and ' +
        number(budget.boundaryExitLiters) + ' L left the boundary. ' +
        (retained === null ? 'The declared receiving limit does not apply to this surface.' :
          number(retained) + ' mm used of ' + number(accepted.storage.remainingCapacityMm) + ' mm receiving space.'));
      p.dataset.side = side; p.dataset.finalDepth = String(r.finalDepthMm[index]); host.append(p);
      host.append(node('p', 'Cell source: ' + project[side][index].provenance));
    }
    for (const button of panel.querySelectorAll('[data-is-cell]')) {
      const selected = Number(button.dataset.isCell) === index;
      button.setAttribute('aria-pressed', String(selected));
    }
  }
  function draw() {
    const {project, storage, report} = accepted, host = $('results');
    host.replaceChildren(node('h3', number(storage.remainingCapacityMm) + ' mm of remaining receiving space'));
    host.append(node('p', report.status === 'surface-absent'
      ? 'This surface is absent from both original maps. The declaration changes no cell.'
      : 'The receiving limit applies to ' + report.affectedCellCount.existing + ' existing and ' +
        report.affectedCellCount.proposal + ' proposed cells. All four calculations use the same original storm.'));
    host.append(node('p', 'Capacity source: ' + storage.source));
    const wrapper = node('div'); wrapper.className = 'is-table-scroll'; wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region'); wrapper.setAttribute('aria-label', 'Full-site water comparison');
    const table = node('table'), caption = node('caption', 'Whole-site quantities · liters except maximum depth');
    table.append(caption);
    const header = node('tr');
    for (const text of ['Quantity', 'Existing · no receiving limit', 'Existing · closed layer', 'Proposed · no receiving limit', 'Proposed · closed layer']) {
      const th = node('th', text); th.scope = 'col'; header.append(th);
    }
    const thead = node('thead'); thead.append(header); table.append(thead);
    const body = node('tbody');
    for (const [metric, label] of [
      ['rainLiters', 'Rain entering the site'], ['absorbedLiters', 'Water entering the ground'],
      ['storedLiters', 'Standing water at event end'], ['exitLiters', 'Water leaving the boundary'],
      ['maxDepthMm', 'Highest modeled depth · mm'], ['massErrorLiters', 'Water-account residual'],
    ]) {
      const tr = node('tr'), th = node('th', label); th.scope = 'row'; tr.append(th);
      for (const side of sides) for (const kind of kinds) {
        const td = node('td', number(report[side][kind][metric]));
        td.dataset.side = side; td.dataset.kind = kind; td.dataset.metric = metric;
        td.dataset.label = (side === 'existing' ? 'Existing' : 'Proposed') + (kind === 'limited' ? ' · closed layer' : ' · no receiving limit');
        td.dataset.value = String(report[side][kind][metric]); tr.append(td);
      }
      body.append(tr);
    }
    table.append(body); wrapper.append(table); host.append(wrapper);
    const consequence = report.change.storedLiters;
    host.append(node('p', 'Proposed minus existing standing water: ' + number(consequence.unlimited) +
      ' L without a receiving limit; ' + number(consequence.limited) + ' L with the closed layer. ' +
      'Negative means less water remains on the surface in the proposal; boundary flow is reported separately.'));
    const figure = node('figure'), chart = svg('svg', {viewBox: '0 0 680 270', role: 'img',
      'aria-label': 'Whole-site standing water through modeled time, existing amber and proposed green; solid unlimited receiving and dashed closed layer'});
    chart.id = 'is-chart';
    const max = Math.max(1, ...sides.flatMap(side => kinds.flatMap(kind => report[side][kind].snapshots.map(row => row.storedLiters))));
    const end = project.weather.durationMinutes, x = t => 65 + 590 * t / end, y = v => 220 - 185 * v / max;
    for (let i = 0; i <= 4; i++) {
      chart.append(svg('line', {x1: 65, x2: 655, y1: y(max * i / 4), y2: y(max * i / 4), stroke: '#d6e1de'}));
      const label = svg('text', {x: 58, y: y(max * i / 4) + 4, 'text-anchor': 'end'}); label.textContent = number(max * i / 4); chart.append(label);
      const time = svg('text', {x: x(end * i / 4), y: 242, 'text-anchor': 'middle'}); time.textContent = number(end * i / 4); chart.append(time);
    }
    for (const [i, side] of sides.entries()) for (const kind of kinds) {
      const attrs = {points: report[side][kind].snapshots.map(row => x(row.minute) + ',' + y(row.storedLiters)).join(' '),
        stroke: i ? '#167c68' : '#a65b26', fill: 'none', 'stroke-width': 2.5};
      if (kind === 'limited') attrs['stroke-dasharray'] = '8 4';
      chart.append(svg('polyline', attrs));
    }
    const yl = svg('text', {x: 10, y: 18}); yl.textContent = 'Standing water · L'; chart.append(yl);
    const xl = svg('text', {x: 360, y: 265, 'text-anchor': 'middle'}); xl.textContent = 'Minutes from event start'; chart.append(xl);
    figure.append(chart, node('figcaption', 'Amber: existing · green: proposed. Solid: no receiving limit · dashed: declared closed layer. Lines join the retained calculation steps; they do not reveal unmodeled peaks between steps.'));
    host.append(figure);
    const maps = node('div'); maps.className = 'is-maps';
    const depthScale = Math.max(1, ...sides.flatMap(side => report[side].limited.finalDepthMm));
    for (const side of sides) {
      const section = node('div'); section.append(node('h4', (side === 'existing' ? 'Existing' : 'Proposed') + ' · closed layer'));
      const grid = node('div'); grid.className = 'is-grid'; grid.style.gridTemplateColumns = 'repeat(' + project.width + ', minmax(0, 1fr))';
      grid.setAttribute('aria-label', side + ' final standing depths with receiving limit');
      for (let i = 0; i < project[side].length; i++) {
        const depth = report[side].limited.finalDepthMm[i], button = node('button', cellName(project, i));
        button.type = 'button'; button.dataset.isCell = String(i);
        button.style.backgroundColor = 'rgba(49, 119, 153, ' + (.08 + .62 * depth / depthScale) + ')';
        button.setAttribute('aria-label', side + ' ' + cellName(project, i) + ', final standing depth ' + number(depth) + ' mm');
        button.onclick = () => inspect(i); grid.append(button);
      }
      section.append(grid); maps.append(section);
    }
    host.append(node('p', 'Inspect final standing water in the original cells. Both maps share one color scale; darker blue means greater modeled depth.'), maps);
    const label = node('label', 'Inspect an original cell'); label.className = 'input-label';
    const select = node('select'); select.id = 'is-cell';
    for (let i = 0; i < project.existing.length; i++) { const option = node('option', cellName(project, i)); option.value = String(i); select.append(option); }
    select.onchange = () => inspect(Number(select.value)); label.append(select);
    const account = node('div'); account.id = 'is-cell-account'; account.setAttribute('aria-live', 'polite');
    host.append(label, account);
    inspect(project.selectedIndex ?? 0);
  }
  function install(project, storage, report) {
    accepted = {project, storage, report}; draw(); $('save').disabled = false;
  }
  $('form').addEventListener('input', () => invalidate('Capacity declaration changed. Compare again.'));
  $('current').onclick = () => { opened = null; key = ''; refresh(); };
  $('example').onclick = () => {
    const p = makeExample(); p.title = 'Fictional shallow-bed comparison';
    p.width = p.height = 2; p.selectedIndex = 0;
    p.source = 'Authored closed flat site; no field measurements';
    p.existing = Array.from({length: 4}, () => ({elevationM: 0, surface: 'sealed', provenance: p.source}));
    p.proposal = p.existing.map(cell => ({...cell, surface: 'garden', provenance: 'Hypothetical shallow lined receiving bed'}));
    Object.assign(p.weather, {rainMmHr: 36, stormMinutes: 60, durationMinutes: 240,
      cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0});
    opened = p; key = ''; refresh();
    fill({surface: 'garden', remainingCapacityMm: 5, source: 'Authored remaining space: 5 mm per garden cell in a closed layer with no drainage during this event.'});
    invalidate('Fictional shallow-bed inputs loaded. Review the declaration, then compare.');
  };
  $('form').onsubmit = event => {
    event.preventDefault(); refresh(); invalidate('Comparing the original site with both receiving assumptions…');
    const token = generation; let project, storage;
    try { project = structuredClone(source()); storage = readStorage(); }
    catch (error) { status(error.message, 'refused'); return; }
    $('run').disabled = true; status('Computing the four original-source water accounts…', 'pending');
    setTimeout(() => {
      if (token !== generation) return;
      try { install(project, storage, compareInfiltrationStorage(project, storage)); status('Compared from original inputs. No site or soil property was adopted.', 'computed'); }
      catch (error) { status(error.message, 'refused'); }
      finally { if (token === generation) $('run').disabled = false; }
    }, 10);
  };
  $('save').onclick = () => {
    if (!accepted) return;
    try {
      const text = serializeInfiltrationStorage(accepted.project, accepted.storage);
      const url = URL.createObjectURL(new Blob([text], {type: 'application/json'})), a = node('a');
      a.href = url; a.download = 'experimental-earth-closed-store.json'; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { status(error.message, 'refused'); }
  };
  $('open').onchange = async () => {
    const file = $('open').files?.[0]; if (!file) return;
    invalidate('Checking the original investigation…'); const token = generation;
    $('run').disabled = true; status('Reading original inputs…', 'opening');
    try {
      checkStorageFileBytes(file.size);
      const bytes = await file.arrayBuffer();
      if (token !== generation) return;
      const input = parseInfiltrationStorage(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
      const report = compareInfiltrationStorage(input.project, input.storage);
      if (token !== generation) return;
      opened = input.project; key = JSON.stringify(opened); fill(input.storage);
      install(opened, input.storage, report); refresh();
      status('Recomputed from the file’s original site and capacity declaration. Working site unchanged.', 'reopened');
    } catch (error) { if (token === generation) status(error.message, 'refused'); }
    finally { if (token === generation) { $('run').disabled = false; $('open').value = ''; } }
  };
  refresh();
  return {refresh};
}
