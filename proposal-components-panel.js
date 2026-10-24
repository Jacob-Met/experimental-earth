import { componentEditIndices, compareProposalComponents, compareComponentHypotheses } from './proposal-components.js';

export function mountProposalComponents({ getProject }) {
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.id = 'proposal-components';
  panel.innerHTML = `<h2>Which parts of the proposal work together?</h2>
    <p>Choose some edited cells as component A. All remaining edits become B.
    Compare the existing site, A only, B only and the full proposal under the same storm.</p>
    <p>Each selected cell carries all its authored changes together, including its canonical east/south internal edges.
    An edge shared with a neighboring cell belongs to its west/north cell. This experiment separates
    modeled effects; it does not establish real-world causality or recommend construction.</p>
    <p>Choose default surface capacities or explicitly propagate the saved infiltration hypotheses below.
    All combinations share the site's authored weather.</p>
    <label>Assumptions for the experiment<select data-component-mode>
      <option value="default">Default surface capacities</option>
      <option value="all">All saved infiltration hypotheses</option>
      <option value="calibration">Calibration-compatible hypotheses</option>
      <option value="surviving">Calibration and held-aside compatible hypotheses</option>
    </select></label>
    <p data-component-study></p><p>Evidence filters use the numeric-depth notebook study only. Separate threshold and collected-runoff records are not silently combined.</p>
    <fieldset><legend>Edited cells in component A</legend><div data-component-cells></div></fieldset>
    <button type="button" data-component-run>Compare four combinations</button>
    <p role="status" data-component-status></p><div data-component-results></div>`;
  document.querySelector('.observations').before(panel);
  const list = panel.querySelector('[data-component-cells]');
  const status = panel.querySelector('[data-component-status]');
  const output = panel.querySelector('[data-component-results]');
  const run = panel.querySelector('[data-component-run]');
  const mode = panel.querySelector('[data-component-mode]');
  mode.addEventListener('change', () => invalidate());
  const selected = new Set();
  let fingerprint;
  const fmt = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 3 });
  const signed = n => `${n > 0 ? '+' : ''}${fmt(n)}`;
  const cellName = (i, width) => `${String.fromCharCode(65 + i % width)}${Math.floor(i / width) + 1}`;
  const text = (tag, value) => { const el = document.createElement(tag); el.textContent = value; return el; };
  function invalidate() {
    output.replaceChildren();
    status.textContent = 'Choose at least one edited cell for A and leave at least one for B, then compare.';
  }
  function refresh() {
    const project = getProject();
    const next = JSON.stringify(project);
    if (fingerprint === next) return;
    fingerprint = next;
    const study = project.infiltrationStudy ?? { target: 'existing', surface: 'turf', ratesMmHr: [3, 9, 22] };
    panel.querySelector('[data-component-study]').textContent = `Current study hypotheses: ${study.surface} at ${study.ratesMmHr.join(', ')} mm/h; evidence scenario ${study.target}. Rates are selected from the unchanged observed source before the four combinations. Each rate is applied consistently to matching surfaces in all four cases; other surfaces retain defaults.`;
    invalidate();
    list.replaceChildren();
    const edits = componentEditIndices(project);
    for (const i of [...selected]) if (!edits.includes(i)) selected.delete(i);
    for (const i of edits) {
      const label = document.createElement('label');
      label.style.cssText = 'display:inline-flex;align-items:center;gap:.35rem;margin:.35rem .8rem .35rem 0';
      const input = document.createElement('input');
      input.type = 'checkbox'; input.checked = selected.has(i); input.value = String(i);
      input.addEventListener('change', () => {
        if (input.checked) selected.add(i); else selected.delete(i);
        invalidate();
      });
      label.append(input, document.createTextNode(cellName(i, project.width))); list.append(label);
    }
    run.disabled = edits.length < 2;
    if (edits.length < 2) status.textContent = 'This experiment needs changes in at least two cells. Edit the proposal to define two separable parts.';
  }
  run.addEventListener('click', () => {
    try {
      const project = getProject();
      const hypothesis = mode.value === 'default' ? null : compareComponentHypotheses(project, [...selected], { subset: mode.value });
      if (hypothesis && hypothesis.status !== 'compared') {
        const reasons = { 'need-calibration': 'Assign calibration readings before filtering hypotheses.',
          'need-challenge': 'Assign held-aside readings before requesting survivors.',
          'no-compatible-rates': 'No hypotheses satisfy the requested evidence bands. No replacement fit was substituted.',
          'surface-absent': 'The selected surface is absent from both scenarios.',
          'surface-absent-in-observed-source': 'The selected surface is absent from the observed source scenario, so these readings cannot constrain its rate.' };
        output.replaceChildren(); status.textContent = reasons[hypothesis.status]; return;
      }
      function drawCandidate(candidateIndex = 0) {
      const result = hypothesis ? hypothesis.candidates[candidateIndex].result : compareProposalComponents(project, [...selected]);
      output.replaceChildren();
      if (hypothesis) {
        output.append(text('h3', 'Interaction across source hypotheses'));
        output.append(text('p', 'Each range spans only the retained rates. Different metric endpoints may come from different hypotheses and must not be combined as one water budget. Inspect a single rate for a consistent four-case calculation.'));
        for (const m of hypothesis.interactions) output.append(text('p', `${m.label}: ${signed(m.min)} to ${signed(m.max)} ${m.unit}; ${m.direction}. Finite model alternatives, not a confidence interval.`));
        const detail = document.createElement('details'); detail.append(text('summary', 'Every retained hypothesis'));
        for (const candidate of hypothesis.candidates) {
          detail.append(text('h4', `${hypothesis.surface} ${candidate.rateMmHr} mm/h`));
          for (const m of candidate.result.metrics) detail.append(text('p', `${m.label}: A effect ${signed(m.selectedEffect)}, B effect ${signed(m.remainingEffect)}, full effect ${signed(m.fullEffect)}, interaction ${signed(m.interaction)} ${m.unit}.`));
        }
        output.append(detail);
        const label = text('label', 'Inspect four combinations and local depths for rate ');
        const picker = document.createElement('select'); picker.dataset.componentRate = '';
        hypothesis.candidates.forEach((candidate, index) => {
          const option = text('option', `${candidate.rateMmHr} mm/h`); option.value = String(index); picker.append(option);
        });
        picker.value = String(candidateIndex); picker.addEventListener('change', () => drawCandidate(Number(picker.value)));
        label.append(picker); output.append(label);
        output.append(text('p', 'Choosing a rate here only changes the displayed diagnostic. It does not adopt a hypothesis or modify the saved project.'));
      }
      output.append(text('p', `A: ${result.selectedIndices.map(i => cellName(i, project.width)).join(', ')}. B: ${result.remainingIndices.map(i => cellName(i, project.width)).join(', ')}.`));
      output.append(text('p', 'Effects are signed changes from existing. Interaction = full effect − A effect − B effect. Zero means additive for that quantity; a negative interaction reduces it beyond the sum of separate changes. Whether reduction is desirable depends on the quantity and location. For maxima, nonzero interaction can arise solely from a change in which cell or time supplies the maximum; it does not by itself establish water exchange between components.'));
      const wrap = document.createElement('div'); wrap.className = 'component-table-wrap'; wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'Four-case model comparison; scroll horizontally to inspect all columns');
      const table = document.createElement('table');
      const head = document.createElement('tr');
      for (const h of ['Quantity', 'Existing', 'A only', 'B only', 'Full', 'A effect', 'B effect', 'Full effect', 'Interaction']) head.append(text('th', h));
      const thead = document.createElement('thead'); thead.append(head); table.append(thead);
      const body = document.createElement('tbody');
      for (const metric of result.metrics) {
        const row = document.createElement('tr'); row.append(text('th', `${metric.label} (${metric.unit})`));
        for (const key of ['existing', 'selected', 'remaining', 'full']) row.append(text('td', fmt(metric[key])));
        for (const key of ['selectedEffect', 'remainingEffect', 'fullEffect', 'interaction']) row.append(text('td', signed(metric[key])));
        body.append(row);
      }
      table.append(body); wrap.append(table); output.append(wrap);
      const details = document.createElement('details'); details.append(text('summary', 'Inspect final depth at every cell'));
      for (const cell of result.finalDepths) details.append(text('p', `${cellName(cell.cellIndex, project.width)}: existing ${fmt(cell.existing)}; A ${fmt(cell.selected)}; B ${fmt(cell.remaining)}; full ${fmt(cell.full)} mm. Full effect ${signed(cell.fullEffect)} mm; interaction ${signed(cell.interaction)} mm.`));
      output.append(details);
      const error = Math.max(...(hypothesis ? hypothesis.candidates.map(c => c.result) : [result]).flatMap(r => Object.values(r.balances).map(b => Math.abs(b.massErrorLiters))));
      status.textContent = `${hypothesis ? hypothesis.candidates.length + ' hypothesis sets of four combinations' : 'Four combinations'} computed; ${(hypothesis?.estimatedCellSteps ?? result.estimatedCellSteps).toLocaleString()} estimated cell-steps. Largest absolute water-balance residual ${error.toExponential(2)} L. Input plans and observations remain unchanged. Results are temporary and must be recomputed after edits or reopening.`;
      }
      drawCandidate();
    } catch (error) { output.replaceChildren(); status.textContent = error.message; }
  });
  return { refresh };
}
