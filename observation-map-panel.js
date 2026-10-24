import { renderObservationConsistency } from './observation-consistency-panel.js';
import { mapObservations } from './observation-map.js';

export function mountObservationMap({ getProject, getResults, selectCell }) {
  const host = document.getElementById('observation-map');
  host.innerHTML = `<h3>Where do readings challenge this model?</h3>
    <p class="mini-note">Compare sourced depths with the current authored model at their recorded times. These are baseline predictions, not fitted infiltration hypotheses. Unobserved cells are unknown; agreement is not field validation.</p>
    <div class="input-pair"><label class="input-label">Observed scenario<select id="evidence-map-scenario"><option value="existing">Existing site</option><option value="proposal">Proposed site</option></select></label>
    <label class="input-label">Evidence role<select id="evidence-map-role"><option value="all">All roles (kept distinct)</option><option value="calibration">Calibration</option><option value="challenge">Held aside</option><option value="unassigned">Notebook only</option></select></label></div>
    <p id="evidence-map-summary" class="mini-note" role="status"></p>
    <p class="mini-note">— no readings · ✓ all within stated bands · ! all outside · ± mixed agreement. Select a cell to inspect every reading; opposite errors are never averaged away.</p>
    <div id="evidence-map-grid" class="evidence-map-grid" aria-label="Spatial depth evidence"></div>
    <div id="evidence-map-details" class="evidence-map-details"></div>`;
  const scenario = host.querySelector('#evidence-map-scenario');
  const role = host.querySelector('#evidence-map-role');
  const format = n => Number(n).toLocaleString('en-US', { maximumSignificantDigits: 6 });
  const node = (tag, text, cls) => { const el = document.createElement(tag); el.textContent = text; if (cls) el.className = cls; return el; };
  function refresh() {
    const project = getProject();
    const report = mapObservations(project, getResults(), scenario.value, role.value);
    const name = i => `${String.fromCharCode(65 + i % project.width)}${Math.floor(i / project.width) + 1}`;
    host.querySelector('#evidence-map-summary').textContent = `${report.readingCount} readings across ${report.observedCells}/${report.cells.length} cells; ${report.mismatchedCells} cells have an outside-band reading. ${report.excludedScenario} readings belong to another or unassigned scenario; ${report.excludedRole} excluded by role.`;
    const grid = host.querySelector('#evidence-map-grid');
    grid.style.gridTemplateColumns = `repeat(${project.width}, minmax(28px, 1fr))`;
    grid.replaceChildren();
    for (const cell of report.cells) {
      const symbol = { unobserved: '—', within: '✓', outside: '!', mixed: '±' }[cell.status];
      const button = node('button', `${name(cell.cellIndex)} ${symbol}`, `evidence-map-cell ${cell.status}`);
      button.type = 'button'; button.dataset.cellIndex = cell.cellIndex;
      button.setAttribute('aria-label', `${name(cell.cellIndex)}: ${cell.readings.length} readings, ${cell.withinCount} within band, ${cell.outsideCount} outside band`);
      button.setAttribute('aria-pressed', String(project.selectedIndex === cell.cellIndex));
      button.addEventListener('click', () => selectCell(cell.cellIndex));
      grid.append(button);
    }
    const detail = host.querySelector('#evidence-map-details');
    const cell = report.cells[project.selectedIndex ?? 0];
    detail.replaceChildren(node('h4', `${name(cell.cellIndex)} · ${scenario.options[scenario.selectedIndex].text}`));
    if (!cell.readings.length) detail.append(node('p', 'No readings match this scenario and role at this cell. Its modeled response is untested here.', 'mini-note'));
    if (cell.opposingMismatches) detail.append(node('p', 'Readings disagree with this model in both directions. A mean residual could hide this disagreement.', 'mini-note'));
    for (const item of cell.readings) {
      const r = item.reading;
      const row = node('div', '', 'evidence-map-reading');
      const text = node('div', '');
      text.append(node('strong', `${format(r.minute)} min · ${format(r.depthMm)} ± ${format(r.uncertaintyMm)} mm · ${r.use || 'unassigned'}`));
      text.append(node('small', `Predicted ${format(item.depthMm)} mm; observed − predicted ${format(item.residualMm)} mm. ${item.withinBand ? 'Within stated band' : item.direction === 'underprediction' ? 'Model below observed band' : 'Model above observed band'}.`));
      text.append(node('small', `${item.method}; solver brackets ${format(item.beforeMinute)}–${format(item.afterMinute)} min. Source: ${r.source}`));
      if (r.tableSource) text.append(node('small', `Original table: ${r.tableSource.fileName}, line ${r.tableSource.line}; ${r.tableSource.depthValue} ± ${r.tableSource.uncertaintyValue} ${r.tableSource.unit}`));
      row.append(text); detail.append(row);
    }
    detail.append(renderObservationConsistency(project, report.target, project.selectedIndex ?? 0));
  }
  scenario.addEventListener('change', refresh); role.addEventListener('change', refresh);
  return { refresh };
}
