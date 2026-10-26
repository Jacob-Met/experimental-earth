import { compareLocalWaterBudget, inspectLocalWaterBudget, inspectRegionalWaterBudget,
  localBudgetRegion, localBudgetInputKey } from './local-water-budget.js';
import { arrowGridIndex } from './grid-keyboard.js';

const number = n => Number(n.toPrecision(6)).toLocaleString('en-US', { maximumSignificantDigits: 6 });
const signed = n => `${n > 0 ? '+' : ''}${number(n)}`;
const node = (tag, text, className) => {
  const el = document.createElement(tag); el.textContent = text;
  if (className) el.className = className;
  return el;
};
const COMPONENTS = [
  ['rainLiters', 'Rain onto this cell', 1],
  ['incomingLiters', 'Arriving from neighbors', 1],
  ['outgoingLiters', 'Moving to neighbors', -1],
  ['absorbedLiters', 'Infiltrating here', -1],
  ['boundaryExitLiters', 'Leaving the site here', -1],
  ['storedLiters', 'Remaining at the end', 0],
];

export function mountLocalWaterBudget({ getProject, selectCell, saveStudy }) {
  const panel = document.createElement('section'); panel.className = 'panel study local-budget';
  panel.id = 'local-budget-panel'; panel.setAttribute('aria-labelledby', 'local-budget-title');
  panel.innerHTML = `<div class="section-heading"><div><span class="eyebrow">FOLLOW THE WATER</span><h2 id="local-budget-title">Why does this place get wetter?</h2></div></div>
    <p>Follow the modeled water arriving, moving onward, soaking in and leaving the site. Compare a cell, the edited footprint, a custom area or the whole site across the saved existing and proposed plans.</p>
    <label class="input-label">Area to inspect<select id="local-budget-scope"><option value="cell">Selected cell</option><option value="edited">Directly edited footprint</option><option value="custom">Custom area</option><option value="site">Whole site</option></select></label>
    <fieldset id="local-budget-custom-area" class="local-budget-custom-area" hidden>
      <legend>Pick custom area cells</legend>
      <p id="local-budget-area-help" class="mini-note">Toggle cells to include them in the same area in both scenarios. Use arrow keys to move and Enter or Space to toggle. Highlighted cells are included. This picker changes the inspection area only.</p>
      <div class="local-budget-area-shortcuts">
        <button type="button" id="local-budget-use-cell" class="subtle">Use selected cell</button>
        <button type="button" id="local-budget-use-edits" class="subtle">Use edited footprint</button>
        <button type="button" id="local-budget-select-all" class="subtle">Select all</button>
        <button type="button" id="local-budget-clear-area" class="subtle">Clear</button>
      </div>
      <div class="local-budget-area-scroll"><div id="local-budget-area-grid" class="local-budget-area-grid" role="group" aria-label="Custom water-budget area cells" aria-describedby="local-budget-area-help"></div></div>
      <details class="local-budget-area-members"><summary>Custom area membership</summary><p id="local-budget-area-members"></p></details>
    </fieldset>
    <p id="local-budget-area-summary" class="local-budget-area-summary" aria-live="polite"></p>
    <button type="button" id="trace-local-budget" class="primary">Trace both scenarios</button>
    <p id="local-budget-status" role="status" aria-live="polite"></p>
    <div id="local-budget-results"></div>
    <p class="mini-note">Whole-event totals use the saved surface rates and weather, without fitting hypotheses to readings. Neighbor crossings can count the same water repeatedly, including a return in the opposite direction; they do not identify the original source of a water parcel. Accounting closes the numerical model, not a measured field budget.</p>`;
  document.querySelector('section.results').after(panel);
  const find = id => panel.querySelector(`#${id}`);
  let comparison = null, sourceKey = null;
  let gridDimensions = '', focusedIndex = getProject().selectedIndex ?? 0;
  const label = i => `${String.fromCharCode(65 + i % getProject().width)}${Math.floor(i / getProject().width) + 1}`;
  const study = project => project.localWaterBudgetStudy ?? {
    schema: 'experimental-earth-local-water-budget/1', scope: 'cell',
    width: project.width, height: project.height, cellIndices: [],
  };
  const scopeName = scope => ({ cell: 'Selected cell', edited: 'Edited footprint',
    custom: 'Custom area', site: 'Whole site' })[scope];

  function saveSelection(scope, cellIndices = study(getProject()).cellIndices) {
    const project = getProject();
    saveStudy({ schema: 'experimental-earth-local-water-budget/1', scope,
      width: project.width, height: project.height,
      cellIndices: [...new Set(cellIndices)].sort((a, b) => a - b) });
    // The app updates getProject synchronously and persists without running a solver.
    refresh();
  }

  function updateRovingFocus() {
    for (const button of find('local-budget-area-grid').children) {
      button.tabIndex = Number(button.dataset.cellIndex) === focusedIndex ? 0 : -1;
    }
  }

  function updateArea(project) {
    const saved = study(project), count = project.width * project.height;
    const members = localBudgetRegion(project, saved.scope);
    const included = new Set(saved.cellIndices), grid = find('local-budget-area-grid');
    find('local-budget-scope').value = saved.scope;
    find('local-budget-custom-area').hidden = saved.scope !== 'custom';
    const dimensions = `${project.width}x${project.height}`;
    if (gridDimensions !== dimensions) {
      const restoreFocus = grid.contains(document.activeElement);
      focusedIndex = Math.max(0, Math.min(focusedIndex, count - 1));
      const fragment = document.createDocumentFragment();
      grid.style.gridTemplateColumns = `repeat(${project.width}, minmax(2.75rem, 1fr))`;
      for (let index = 0; index < count; index++) {
        const button = node('button', label(index), 'local-budget-area-cell');
        button.type = 'button'; button.dataset.cellIndex = String(index);
        button.setAttribute('aria-label', `Cell ${label(index)}`);
        button.addEventListener('focus', () => { focusedIndex = index; updateRovingFocus(); });
        button.addEventListener('keydown', event => {
          const next = arrowGridIndex(index, project.width, count, event.key);
          if (next === null) return;
          event.preventDefault();
          grid.children[next].focus();
        });
        // Native buttons supply Enter/Space activation without duplicate key handlers.
        button.addEventListener('click', () => {
          focusedIndex = index;
          const selected = new Set(study(getProject()).cellIndices);
          if (selected.has(index)) selected.delete(index); else selected.add(index);
          saveSelection('custom', [...selected]);
        });
        fragment.append(button);
      }
      grid.replaceChildren(fragment); gridDimensions = dimensions;
      if (restoreFocus && saved.scope === 'custom') grid.children[focusedIndex].focus();
    }
    for (const button of grid.children) {
      button.setAttribute('aria-pressed', String(included.has(Number(button.dataset.cellIndex))));
    }
    updateRovingFocus();
    find('local-budget-area-members').textContent = saved.cellIndices.length ?
      [...saved.cellIndices].sort((a, b) => a - b).map(label).join(', ') : 'No cells selected.';
    const area = members.length * project.weather.cellSizeM ** 2;
    find('local-budget-area-summary').textContent = `${scopeName(saved.scope)} · ${members.length} ${members.length === 1 ? 'cell' : 'cells'} · ${number(area)} m² modeled area`;
    find('trace-local-budget').disabled = members.length === 0;
    return { scope: saved.scope, members };
  }

  function showNoArea(scope) {
    const host = find('local-budget-results'); host.replaceChildren();
    host.dataset.scope = scope; host.dataset.cellCount = '0'; delete host.dataset.cellIndex;
    find('local-budget-status').dataset.state = scope === 'custom' ? 'no-area' : 'no-edits';
    find('local-budget-status').textContent = scope === 'custom' ?
      'No custom area is selected. Choose one or more cells above to inspect their water balance; tracing is unavailable until an area is selected.' :
      'The two plans have identical elevations, surfaces and internal connectivity. There is no edited footprint to compare; choose a cell, a custom area or the whole site.';
  }

  function render() {
    const project = getProject();
    const scope = study(project).scope;
    const members = localBudgetRegion(project, scope);
    const host = find('local-budget-results'); host.replaceChildren();
    host.dataset.scope = scope; host.dataset.cellCount = String(members.length);
    delete host.dataset.cellIndex;
    if (!members.length) {
      showNoArea(scope);
      return;
    }
    const selected = scope === 'cell' ? inspectLocalWaterBudget(comparison, members[0]) :
      inspectRegionalWaterBudget(comparison, members);
    if (scope === 'cell') host.dataset.cellIndex = String(members[0]);
    const place = scope === 'cell' ? `Cell ${label(members[0])}` :
      `${scopeName(scope)} · ${members.length} ${members.length === 1 ? 'cell' : 'cells'}`;
    find('local-budget-status').dataset.state = 'computed';
    find('local-budget-status').textContent = `${place} · ${comparison.durationMinutes} modeled minutes · all quantities in liters. ${scope === 'cell' ? 'Select another map cell or a neighbor below to follow the flow.' : 'Choose another area above or inspect an outside neighbor below.'}`;
    if (scope !== 'cell') {
      const membership = node('details', ''); membership.append(node('summary', `Inspect the same ${members.length} cells in both scenarios`), node('p', members.map(label).join(', ')));
      host.append(membership);
      if (scope === 'edited') host.append(node('p', 'This footprint includes directly changed elevations or surfaces, plus both cells adjoining a changed wall or finite crest or opening. Downstream locations affected by those edits may lie outside it.', 'mini-note'));
    }
    const table = document.createElement('table'); table.className = 'local-budget-table';
    const caption = node('caption', `Whole-event ${scope === 'cell' ? 'cell' : 'area'} water balance`); table.append(caption);
    const head = document.createElement('thead'), header = document.createElement('tr');
    for (const title of ['Water component', 'Existing', 'Proposal', 'Change']) {
      const th = node('th', title); th.scope = 'col'; header.append(th);
    }
    head.append(header); table.append(head);
    const body = document.createElement('tbody');
    for (const [key, title, sign] of COMPONENTS) {
      const row = document.createElement('tr'); row.dataset.component = key;
      if (sign === 0) row.className = 'budget-total';
      const shownTitle = scope === 'cell' ? title : title.replace('this cell', 'this area').replace('from neighbors', 'from outside cells').replace('to neighbors', 'to outside cells');
      const th = node('th', `${sign > 0 ? '+ ' : sign < 0 ? '− ' : '= '}${shownTitle}`); th.scope = 'row';
      row.append(th, node('td', number(selected.existing[key])), node('td', number(selected.proposal[key])),
        node('td', signed(selected.changes[key])));
      body.append(row);
    }
    table.append(body); host.append(table);
    const diff = selected.changes.storedLiters;
    host.append(node('p', Math.abs(diff) < 1e-8 ?
      'Final storage is unchanged here; the component totals can still reveal different routing.' :
      `The proposal leaves ${number(Math.abs(diff))} L ${diff > 0 ? 'more' : 'less'} water here at the end. Changes in incoming water add to storage; changes in outgoing, infiltrated and boundary water subtract from it.`, 'local-budget-explanation'));
    const maxError = Math.max(Math.abs(selected.existing.balanceErrorLiters),
      Math.abs(selected.proposal.balanceErrorLiters), Math.abs(selected.changeBalanceErrorLiters));
    host.append(node('p', `Largest ${scope === 'cell' ? 'cell' : 'area'}/change accounting residual: ${maxError.toExponential(2)} L. Export the ordinary site project to preserve these assumptions; reopening and tracing recomputes this view.`, 'mini-note'));
    if (scope !== 'cell') host.append(node('p', `Transfers between selected cells: ${number(selected.existing.internalCrossingLiters)} → ${number(selected.proposal.internalCrossingLiters)} L (existing → proposal). These internal crossings cancel and are excluded from the area's incoming and outgoing totals.`, 'mini-note'));
    host.append(node('h3', scope === 'cell' ? 'Follow a neighboring cell' : 'Water crossing the selected boundary'));
    const neighbors = node('div', '', 'local-budget-neighbors');
    for (const neighbor of selected.neighbors) {
      const card = node('article', '', 'local-budget-neighbor'); card.dataset.neighbor = String(neighbor.cellIndex);
      const button = node('button', `Inspect ${label(neighbor.cellIndex)}`, 'subtle'); button.type = 'button';
      button.addEventListener('click', () => { selectCell(neighbor.cellIndex); saveSelection('cell'); });
      const destination = scope === 'cell' ? label(selected.cellIndex) : 'area';
      card.append(button,
        node('p', `${label(neighbor.cellIndex)} → ${destination}: ${number(neighbor.existing.incomingLiters)} → ${number(neighbor.proposal.incomingLiters)} L (${signed(neighbor.incomingChangeLiters)}).`),
        node('p', `${destination} → ${label(neighbor.cellIndex)}: ${number(neighbor.existing.outgoingLiters)} → ${number(neighbor.proposal.outgoingLiters)} L (${signed(neighbor.outgoingChangeLiters)}).`));
      neighbors.append(card);
    }
    host.append(node('p', 'Each line shows existing → proposal and its signed change. Both travel directions are retained, including zero transfers.', 'mini-note'), neighbors);
    if (!selected.neighbors.length) host.append(node('p', 'There are no modeled cells outside this region. Site-boundary exits are still accounted for in the table above.', 'mini-note'));
  }
  find('local-budget-scope').addEventListener('change', event => saveSelection(event.target.value));
  find('local-budget-use-cell').addEventListener('click', () => saveSelection('custom', localBudgetRegion(getProject(), 'cell')));
  find('local-budget-use-edits').addEventListener('click', () => saveSelection('custom', localBudgetRegion(getProject(), 'edited')));
  find('local-budget-select-all').addEventListener('click', () => saveSelection('custom', localBudgetRegion(getProject(), 'site')));
  find('local-budget-clear-area').addEventListener('click', () => saveSelection('custom', []));
  function clear(state, message) {
    comparison = null; sourceKey = null;
    const host = find('local-budget-results'); host.replaceChildren(); delete host.dataset.cellIndex;
    delete host.dataset.scope; delete host.dataset.cellCount;
    find('local-budget-status').dataset.state = state;
    find('local-budget-status').textContent = message;
  }
  function refresh() {
    const project = getProject(), { scope, members } = updateArea(project);
    const stale = comparison && sourceKey !== localBudgetInputKey(project);
    if (stale) { comparison = null; sourceKey = null; }
    // An empty area does not destroy a current ledger or start an expensive trace.
    if (!members.length) { showNoArea(scope); return; }
    if (comparison) render();
    else clear(stale ? 'stale' : 'not-computed', stale ?
      'The site or weather changed. Trace again to inspect the new water balance.' :
      'Trace the current plans, then choose a cell or area to inspect its water balance.');
  }
  find('trace-local-budget').addEventListener('click', () => {
    try {
      const project = getProject(), { scope, members } = updateArea(project);
      if (!members.length) { showNoArea(scope); return; }
      const result = compareLocalWaterBudget(project);
      if (result.status !== 'computed') {
        clear(result.status, `This comparison needs ${result.cellSteps.toLocaleString('en-US')} cell-steps, above the ${result.limit.toLocaleString('en-US')} interactive limit. Reduce the grid or event duration, or choose a coarser interval with its numerical limits in mind.`);
        return;
      }
      comparison = result; sourceKey = localBudgetInputKey(project); render();
    } catch (error) { clear('error', error.message); }
  });
  refresh();
  return { refresh };
}
