import { compareRainTrace, rainTraceSignature } from './rain-trace-study.js';

const format = value => (Math.abs(value) < 1e-9 ? 0 : value).toLocaleString('en-US', { maximumSignificantDigits: 4 });
const fateKeys = { stored: 'storedByCellLiters', absorbed: 'absorbedByCellLiters', exit: 'exitByCellLiters' };
const fateLabels = { stored: 'Still on the surface at the end', absorbed: 'Infiltrated during the run', exit: 'Left through the boundary here' };

export function mountRainTrace({ getProject, changed, notice }) {
  const panel = document.createElement('section');
  panel.className = 'panel rain-trace'; panel.id = 'rain-trace';
  panel.setAttribute('aria-labelledby', 'rain-trace-title');
  panel.innerHTML = `
    <div class="section-heading"><div><span class="eyebrow">FOLLOW THE WATER</span><h2 id="rain-trace-title">Where does rain from this area end up?</h2></div></div>
    <p class="muted">Choose an area that contributes rain, then compare where that water infiltrates, remains on the surface or leaves the boundary in each alternative.</p>
    <p class="mini-note">Use the Inspect brush on the site maps above, then add that cell to your source area. The same source cells are used for both sites.</p>
    <div class="trace-actions"><button id="trace-use-selected" type="button" class="subtle">Use inspected cell</button><button id="trace-add-selected" type="button" class="subtle">Add inspected cell</button><button id="trace-clear" type="button" class="subtle">Clear source area</button></div>
    <div id="trace-sources" class="trace-sources" aria-label="Chosen rain source cells"></div>
    <button id="trace-run" type="button" class="primary" disabled>Trace this rain in both sites</button>
    <p id="trace-status" class="next-reading" role="status" aria-live="polite" data-state="not-traced"></p>
    <div id="trace-results" hidden>
      <div id="trace-summary"></div>
      <label class="input-label trace-fate">Show where the source rain ends up<select id="trace-fate"><option value="absorbed">Infiltrated during the run</option><option value="stored">Still on the surface at the end</option><option value="exit">Left through the boundary here</option></select></label>
      <p id="trace-map-scale" class="mini-note"></p>
      <div class="trace-maps"><div><h3>Existing site</h3><div id="trace-existing-map" class="trace-map" role="group" aria-label="Existing-site source-water destinations"></div></div><div><h3>Proposed change</h3><div id="trace-proposal-map" class="trace-map" role="group" aria-label="Proposed-site source-water destinations"></div></div></div>
      <p id="trace-destination" class="selection" aria-live="polite"></p>
      <details><summary>Inspect every destination</summary><div class="trace-table-wrap" tabindex="0" aria-label="Source-water destination table"><table id="trace-table"></table></div></details>
      <p id="trace-balance" class="mini-note"></p>
    </div>
    <p class="mini-note">This is attribution within the conceptual model, using complete mixing inside each cell and the existing water transfers. It does not establish measured flow paths, physical travel times or real intervention effects. Your source selection is retained with the project; results are recomputed after reopening.</p>`;
  document.querySelector('.results').after(panel);
  const $ = id => panel.querySelector('#' + id);
  let result = null, resultSignature = null, destination = 0;
  const name = index => {
    const { width } = getProject();
    return `${String.fromCharCode(65 + index % width)}${Math.floor(index / width) + 1}`;
  };
  const sources = () => getProject().rainTraceStudy?.sourceCells ?? [];
  function setSources(indices) {
    const project = getProject();
    if (indices.length) project.rainTraceStudy = { sourceCells: [...new Set(indices)].sort((a, b) => a - b) };
    else delete project.rainTraceStudy;
    changed();
  }
  $('trace-use-selected').addEventListener('click', () => setSources([getProject().selectedIndex ?? 0]));
  $('trace-add-selected').addEventListener('click', () => setSources([...sources(), getProject().selectedIndex ?? 0]));
  $('trace-clear').addEventListener('click', () => setSources([]));

  function renderMaps() {
    if (!result) return;
    const key = fateKeys[$('trace-fate').value], label = fateLabels[$('trace-fate').value];
    const maximum = Math.max(...result.existing[key], ...result.proposal[key]);
    $('trace-map-scale').textContent = `Darker cells contain more of this contribution: 0–${format(maximum)} L per cell, with the same scale in both maps. Outlined cells are the rain source area. Select a destination to inspect its values.`;
    for (const target of ['existing', 'proposal']) {
      const grid = $('trace-' + target + '-map');
      grid.style.gridTemplateColumns = `repeat(${getProject().width}, minmax(0, 1fr))`;
      grid.classList.toggle('trace-dense', getProject().width > 12);
      const fragment = document.createDocumentFragment();
      result[target][key].forEach((value, i) => {
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'trace-cell' + (result.sourceCells.includes(i) ? ' trace-source' : '');
        button.style.setProperty('--trace-alpha', String(maximum > 0 ? 0.15 + 0.7 * value / maximum : 0));
        button.dataset.cellIndex = String(i); button.textContent = name(i);
        button.setAttribute('aria-label', `${target} ${name(i)}: ${format(value)} liters of source rain; ${label.toLowerCase()}`);
        button.setAttribute('aria-pressed', String(i === destination));
        button.addEventListener('click', () => { destination = i; renderMaps(); });
        fragment.append(button);
      });
      grid.replaceChildren(fragment);
    }
    const a = result.existing[key][destination], b = result.proposal[key][destination];
    $('trace-destination').textContent = `${name(destination)} · ${label}: existing ${format(a)} L; proposal ${format(b)} L; change ${b - a > 1e-9 ? '+' : ''}${format(b - a)} L from the chosen source area.`;
    const table = $('trace-table'); table.replaceChildren();
    const head = document.createElement('thead');
    head.innerHTML = '<tr><th scope="col">Cell</th><th scope="col">Existing · L</th><th scope="col">Proposal · L</th><th scope="col">Change · L</th></tr>';
    const body = document.createElement('tbody');
    result.existing[key].forEach((value, i) => {
      const row = document.createElement('tr');
      for (const [j, text] of [name(i), format(value), format(result.proposal[key][i]), format(result.proposal[key][i] - value)].entries()) {
        const cell = document.createElement(j ? 'td' : 'th'); cell.textContent = text;
        if (!j) cell.scope = 'row'; row.append(cell);
      }
      body.append(row);
    });
    table.append(head, body);
  }

  function renderResult() {
    const summary = $('trace-summary'); summary.replaceChildren();
    const intro = document.createElement('p');
    intro.className = 'trace-total';
    intro.textContent = `${format(result.existing.rainLiters)} L of rain from ${result.sourceCells.length} source cell${result.sourceCells.length === 1 ? '' : 's'} (${format(result.sourceAreaM2)} m²), followed through ${result.durationMinutes} minutes.`;
    summary.append(intro);
    const totals = document.createElement('div'); totals.className = 'trace-totals';
    for (const [label, key] of [['Infiltrated', 'absorbedLiters'], ['Left the boundary', 'exitLiters'], ['Still on the surface', 'storedLiters']]) {
      const card = document.createElement('div'); card.className = 'trace-total-card';
      const title = document.createElement('strong'); title.textContent = label;
      const values = document.createElement('p'); values.textContent = `Existing ${format(result.existing[key])} L → proposal ${format(result.proposal[key])} L`;
      const delta = document.createElement('small'); delta.textContent = `Change ${result.delta[key] > 1e-9 ? '+' : ''}${format(result.delta[key])} L`;
      card.append(title, values, delta); totals.append(card);
    }
    summary.append(totals);
    $('trace-balance').textContent = `Source rain = infiltrated + boundary outflow + final surface water. Attribution residual: existing ${format(result.existing.massErrorLiters)} L; proposal ${format(result.proposal.massErrorLiters)} L. All values refer only to rain from the chosen area. A destination may also contain rain from elsewhere.`;
    $('trace-results').hidden = false;
    renderMaps();
  }

  $('trace-run').addEventListener('click', () => {
    try {
      result = compareRainTrace(getProject()); resultSignature = rainTraceSignature(getProject());
      destination = result.sourceCells[0]; renderResult();
      $('trace-status').dataset.state = 'traced';
      $('trace-status').textContent = 'Source-water attribution calculated for the current site and storm.';
    } catch (error) {
      result = null; resultSignature = null; $('trace-results').hidden = true;
      $('trace-status').dataset.state = 'error'; $('trace-status').textContent = error.message; notice(error.message);
    }
  });
  $('trace-fate').addEventListener('change', renderMaps);
  function refresh() {
    const project = getProject(), selected = project.selectedIndex ?? 0, chosen = sources();
    $('trace-use-selected').textContent = `Use inspected cell ${name(selected)}`;
    $('trace-add-selected').textContent = `Add inspected cell ${name(selected)}`;
    $('trace-add-selected').disabled = chosen.includes(selected);
    $('trace-clear').disabled = chosen.length === 0; $('trace-run').disabled = chosen.length === 0;
    $('trace-sources').replaceChildren();
    for (const i of chosen) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'trace-chip';
      button.textContent = `${name(i)} ×`; button.setAttribute('aria-label', `Remove source cell ${name(i)}`);
      button.addEventListener('click', () => setSources(sources().filter(value => value !== i)));
      $('trace-sources').append(button);
    }
    if (result && resultSignature !== rainTraceSignature(project)) {
      result = null; resultSignature = null; $('trace-results').hidden = true;
      $('trace-status').textContent = 'The site, storm or source area changed. Trace again to update the destinations.';
    } else if (!result) {
      $('trace-status').textContent = chosen.length ? `${chosen.length} source cell${chosen.length === 1 ? '' : 's'} selected. Trace to inspect where this rain ends up.` : 'Choose at least one source cell to begin.';
    }
    if (!result) $('trace-status').dataset.state = 'not-traced';
  }
  return { refresh };
}
