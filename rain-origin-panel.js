import { compareRainOrigins, rainOriginSignature } from './rain-origin-study.js';
const format = value => (Math.abs(value) < 1e-9 ? 0 : value).toLocaleString('en-US', { maximumSignificantDigits: 4 });
const labels = { stored: 'on the surface at the modeled end', absorbed: 'infiltrated during the event', exit: 'left through the boundary during the event' };

export function mountRainOrigins({ host, getProject, changed, notice }) {
  const panel = document.createElement('details'); panel.id = 'rain-origin'; panel.className = 'rain-origin';
  panel.innerHTML = `
    <summary>Which areas supplied water here?</summary>
    <p class="muted">Choose a destination and a water fate to see where its rain originated. The same destination cells and storm are used for both sites.</p>
    <p class="mini-note">Inspect a cell on either site map above, then use or add it here. Boundary outflow belongs to the edge cell where it left the site.</p>
    <div class="trace-actions"><button id="origin-use-selected" type="button" class="subtle">Use inspected cell</button><button id="origin-add-selected" type="button" class="subtle">Add inspected cell</button><button id="origin-clear" type="button" class="subtle">Clear destinations</button></div>
    <div id="origin-targets" class="trace-sources" aria-label="Chosen water destination cells"></div>
    <label class="input-label trace-fate">Explain water that<select id="origin-fate"><option value="absorbed">Infiltrated during the event</option><option value="stored">Remains on the surface at the modeled end</option><option value="exit">Left through the boundary during the event</option></select></label>
    <button id="origin-run" class="primary" type="button" disabled>Explain rainfall origins in both sites</button>
    <p id="origin-status" class="next-reading" role="status" aria-live="polite" data-state="not-explained"></p>
    <div id="origin-results" hidden>
      <p id="origin-total" class="trace-total"></p>
      <div id="origin-summary" class="trace-totals"></div>
      <p id="origin-scale" class="mini-note"></p>
      <div class="trace-maps"><div><h3>Existing-site origins</h3><div id="origin-existing-map" class="trace-map" role="group" aria-label="Rainfall origins for the existing destination"></div></div><div><h3>Proposed-site origins</h3><div id="origin-proposal-map" class="trace-map" role="group" aria-label="Rainfall origins for the proposed destination"></div></div></div>
      <p id="origin-source" class="selection" aria-live="polite"></p>
      <details><summary>Inspect every rainfall origin</summary><div class="trace-table-wrap" tabindex="0" aria-label="Rainfall origin table"><table id="origin-table"></table></div></details>
      <p id="origin-balance" class="mini-note"></p>
    </div>
    <p class="mini-note">Origins describe the current conceptual simulation with complete mixing in each cell. They do not identify measured catchments or predict what removing a source would do to the flow. Any water present at the start is accounted for separately from rainfall.</p>`;
  host.append(panel);
  const $ = id => panel.querySelector('#' + id);
  let result = null, signature = null, source = 0, preferredFate = 'absorbed';
  const name = i => `${String.fromCharCode(65 + i % getProject().width)}${Math.floor(i / getProject().width) + 1}`;
  const targets = () => getProject().rainOriginStudy?.targetCells ?? [];
  function setTargets(cells) {
    const p = getProject();
    if (cells.length) p.rainOriginStudy = { targetCells: [...new Set(cells)].sort((a,b) => a-b), fate: $('origin-fate').value };
    else delete p.rainOriginStudy;
    changed();
  }
  $('origin-use-selected').addEventListener('click', () => setTargets([getProject().selectedIndex ?? 0]));
  $('origin-add-selected').addEventListener('click', () => setTargets([...targets(), getProject().selectedIndex ?? 0]));
  $('origin-clear').addEventListener('click', () => setTargets([]));
  $('origin-fate').addEventListener('change', () => {
    preferredFate = $('origin-fate').value;
    if (targets().length) setTargets(targets());
  });
  function renderMaps() {
    const maximum = Math.max(...result.existing.bySourceLiters, ...result.proposal.bySourceLiters);
    $('origin-scale').textContent = `Rain from each origin reaching the chosen destination and fate: 0–${format(maximum)} L per cell, with the same color scale in both maps. Dark outlines mark the chosen destination; gold marks the inspected origin. Select an origin to inspect its contribution.`;
    for (const scenario of ['existing','proposal']) {
      const grid = $('origin-' + scenario + '-map');
      grid.style.gridTemplateColumns = `repeat(${getProject().width}, minmax(0, 1fr))`;
      grid.classList.toggle('trace-dense', getProject().width > 12);
      const children = document.createDocumentFragment();
      result[scenario].bySourceLiters.forEach((value,i) => {
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'trace-cell' + (result.targetCells.includes(i) ? ' trace-source' : '');
        button.dataset.cellIndex = String(i); button.textContent = name(i);
        button.style.setProperty('--trace-alpha', String(maximum > 0 ? 0.15 + 0.7 * value / maximum : 0));
        button.setAttribute('aria-label', `${scenario} origin ${name(i)} supplied ${format(value)} liters of rain to the chosen destination`);
        button.setAttribute('aria-pressed', String(i === source));
        button.addEventListener('click', () => { source = i; renderMaps(); });
        children.append(button);
      });
      grid.replaceChildren(children);
    }
    const a = result.existing.bySourceLiters[source], b = result.proposal.bySourceLiters[source];
    $('origin-source').textContent = `Rain from ${name(source)} reaching this destination: existing ${format(a)} L; proposal ${format(b)} L; change ${b-a > 1e-9 ? '+' : ''}${format(b-a)} L.`;
    const table = $('origin-table'); table.replaceChildren();
    const head = document.createElement('thead');
    head.innerHTML = '<tr><th scope="col">Origin</th><th scope="col">Existing · L</th><th scope="col">Proposal · L</th><th scope="col">Change · L</th></tr>';
    const body = document.createElement('tbody');
    result.existing.bySourceLiters.forEach((value,i) => {
      const row = document.createElement('tr');
      for (const [j,text] of [name(i),format(value),format(result.proposal.bySourceLiters[i]),format(result.proposal.bySourceLiters[i]-value)].entries()) {
        const cell = document.createElement(j ? 'td' : 'th');cell.textContent = text;
        if (!j) cell.scope = 'row';row.append(cell);
      }
      body.append(row);
    });
    table.append(head,body);
  }
  function render() {
    $('origin-total').textContent = `Rainfall ${labels[result.fate]} in ${result.targetCells.length} chosen destination cell${result.targetCells.length === 1 ? '' : 's'}, through ${format(result.durationMinutes)} minutes.`;
    const summary = $('origin-summary');summary.replaceChildren();
    for (const [scenario,label] of [['existing','Existing site'],['proposal','Proposed change']]) {
      const r = result[scenario], card = document.createElement('div');card.className = 'trace-total-card';
      const heading = document.createElement('strong');heading.textContent = label;
      const main = document.createElement('p');main.textContent = `${format(r.rainfallLiters)} L supplied by rainfall`;
      const detail = document.createElement('small');detail.textContent = `${format(r.targetTotalLiters)} L total at this destination and fate; ${format(r.initialWaterLiters)} L from water present at the start.`;
      card.append(heading,main,detail);summary.append(card);
    }
    $('origin-balance').textContent = `Rainfall origins plus starting water account for the selected water fate. Residual: existing ${format(result.existing.balanceErrorLiters)} L; proposal ${format(result.proposal.balanceErrorLiters)} L. Change in rain contribution: ${result.deltaLiters > 1e-9 ? '+' : ''}${format(result.deltaLiters)} L.`;
    $('origin-results').hidden = false;renderMaps();
  }
  $('origin-run').addEventListener('click', () => {
    try {
      result = compareRainOrigins(getProject());signature = rainOriginSignature(getProject());source = result.targetCells[0];
      render();$('origin-status').dataset.state = 'explained';
      $('origin-status').textContent = result.existing.rainfallLiters + result.proposal.rainfallLiters > 1e-9
        ? 'Rainfall origins calculated for the chosen destination and fate.'
        : 'No rainfall reaches this destination and fate in either modeled alternative.';
    } catch (error) {
      result = null;signature = null;$('origin-results').hidden = true;
      $('origin-status').dataset.state = 'error';$('origin-status').textContent = error.message;notice(error.message);
    }
  });
  function refresh() {
    const p = getProject(),selected = p.selectedIndex ?? 0,chosen = targets();
    $('origin-fate').value = p.rainOriginStudy?.fate ?? preferredFate;
    $('origin-use-selected').textContent = `Use inspected cell ${name(selected)}`;
    $('origin-add-selected').textContent = `Add inspected cell ${name(selected)}`;
    $('origin-add-selected').disabled = chosen.includes(selected);
    $('origin-clear').disabled = !chosen.length;$('origin-run').disabled = !chosen.length;
    $('origin-targets').replaceChildren();
    for (const i of chosen) {
      const button = document.createElement('button');button.type = 'button';button.className = 'trace-chip';
      button.textContent = `${name(i)} ×`;button.setAttribute('aria-label', `Remove destination cell ${name(i)}`);
      button.addEventListener('click', () => setTargets(targets().filter(value => value !== i)));
      $('origin-targets').append(button);
    }
    if (result && signature !== rainOriginSignature(p)) {
      result = null;signature = null;$('origin-results').hidden = true;
      $('origin-status').textContent = 'The site, storm, destination or fate changed. Explain origins again to update the contributions.';
    } else if (!result) {
      $('origin-status').textContent = chosen.length ? `${chosen.length} destination cell${chosen.length === 1 ? '' : 's'} chosen. Explain its rainfall origins.` : 'Choose at least one destination cell to begin.';
    }
    if (!result) $('origin-status').dataset.state = 'not-explained';
  }
  return { refresh };
}
