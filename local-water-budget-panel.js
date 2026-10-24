import { compareLocalWaterBudget, inspectLocalWaterBudget, inspectRegionalWaterBudget,
  localBudgetRegion, localBudgetInputKey } from './local-water-budget.js';

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

export function mountLocalWaterBudget({ getProject, selectCell }) {
  const panel = document.createElement('section'); panel.className = 'panel study local-budget';
  panel.id = 'local-budget-panel'; panel.setAttribute('aria-labelledby', 'local-budget-title');
  panel.innerHTML = `<div class="section-heading"><div><span class="eyebrow">FOLLOW THE WATER</span><h2 id="local-budget-title">Why does this place get wetter?</h2></div></div>
    <p>Follow the modeled water arriving, moving onward, soaking in and leaving the site. Compare a cell, the edited footprint or the whole site across the saved existing and proposed plans.</p>
    <label class="input-label">Area to inspect<select id="local-budget-scope"><option value="cell">Selected cell</option><option value="edited">Directly edited footprint</option><option value="site">Whole site</option></select></label>
    <button type="button" id="trace-local-budget" class="primary">Trace both scenarios</button>
    <p id="local-budget-status" role="status" aria-live="polite"></p>
    <div id="local-budget-results"></div>
    <p class="mini-note">Whole-event totals use the saved surface rates and weather, without fitting hypotheses to readings. Neighbor crossings can count the same water repeatedly, including a return in the opposite direction; they do not identify the original source of a water parcel. Accounting closes the numerical model, not a measured field budget.</p>`;
  document.querySelector('section.results').after(panel);
  const find = id => panel.querySelector(`#${id}`);
  let comparison = null, sourceKey = null;
  const label = i => `${String.fromCharCode(65 + i % comparison.width)}${Math.floor(i / comparison.width) + 1}`;

  function render() {
    const project = getProject();
    const scope = find('local-budget-scope').value;
    const members = localBudgetRegion(project, scope);
    const host = find('local-budget-results'); host.replaceChildren();
    host.dataset.scope = scope; host.dataset.cellCount = String(members.length);
    delete host.dataset.cellIndex;
    if (!members.length) {
      find('local-budget-status').dataset.state = 'no-edits';
      find('local-budget-status').textContent = 'The two plans have identical elevations and surfaces. There is no edited footprint to compare; choose a cell or the whole site.';
      return;
    }
    const selected = scope === 'cell' ? inspectLocalWaterBudget(comparison, members[0]) :
      inspectRegionalWaterBudget(comparison, members);
    if (scope === 'cell') host.dataset.cellIndex = String(members[0]);
    const place = scope === 'cell' ? `Cell ${label(members[0])}` :
      `${scope === 'edited' ? 'Edited footprint' : 'Whole site'} · ${members.length} cells`;
    find('local-budget-status').dataset.state = 'computed';
    find('local-budget-status').textContent = `${place} · ${comparison.durationMinutes} modeled minutes · all quantities in liters. ${scope === 'cell' ? 'Select another map cell or a neighbor below to follow the flow.' : 'Choose another area above or inspect an outside neighbor below.'}`;
    if (scope !== 'cell') {
      const membership = node('details', ''); membership.append(node('summary', `Inspect the same ${members.length} cells in both scenarios`), node('p', members.map(label).join(', ')));
      host.append(membership);
      if (scope === 'edited') host.append(node('p', 'This footprint includes directly changed elevations or surfaces. Downstream locations affected by those edits may lie outside it.', 'mini-note'));
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
      button.addEventListener('click', () => { find('local-budget-scope').value = 'cell'; selectCell(neighbor.cellIndex); });
      const destination = scope === 'cell' ? label(selected.cellIndex) : 'area';
      card.append(button,
        node('p', `${label(neighbor.cellIndex)} → ${destination}: ${number(neighbor.existing.incomingLiters)} → ${number(neighbor.proposal.incomingLiters)} L (${signed(neighbor.incomingChangeLiters)}).`),
        node('p', `${destination} → ${label(neighbor.cellIndex)}: ${number(neighbor.existing.outgoingLiters)} → ${number(neighbor.proposal.outgoingLiters)} L (${signed(neighbor.outgoingChangeLiters)}).`));
      neighbors.append(card);
    }
    host.append(node('p', 'Each line shows existing → proposal and its signed change. Both travel directions are retained, including zero transfers.', 'mini-note'), neighbors);
    if (!selected.neighbors.length) host.append(node('p', 'There are no modeled cells outside this region. Site-boundary exits are still accounted for in the table above.', 'mini-note'));
  }
  find('local-budget-scope').addEventListener('change', () => { if (comparison) render(); });
  function clear(state, message) {
    comparison = null; sourceKey = null;
    const host = find('local-budget-results'); host.replaceChildren(); delete host.dataset.cellIndex;
    delete host.dataset.scope; delete host.dataset.cellCount;
    find('local-budget-status').dataset.state = state;
    find('local-budget-status').textContent = message;
  }
  function refresh() {
    if (comparison && sourceKey === localBudgetInputKey(getProject())) render();
    else clear(comparison ? 'stale' : 'not-computed', comparison ?
      'The site or weather changed. Trace again to inspect the new water balance.' :
      'Trace the current plans, then choose a cell or area to inspect its water balance.');
  }
  find('trace-local-budget').addEventListener('click', () => {
    try {
      const project = getProject(), result = compareLocalWaterBudget(project);
      if (result.status !== 'computed') {
        clear(result.status, `This comparison needs ${result.cellSteps.toLocaleString('en-US')} cell-steps, above the ${result.limit.toLocaleString('en-US')} interactive limit. Reduce the grid or event duration, or choose a coarser interval with its numerical limits in mind.`);
        return;
      }
      comparison = result; sourceKey = localBudgetInputKey(project); render();
    } catch (error) { clear('error', error.message); }
  });
  return { refresh };
}
