import {compareReceivingEvidenceComponents} from './component-receiving-evidence.js';
import {parseDrainingEvidence, serializeDrainingEvidence, DRAINING_EVIDENCE_SCHEMA} from './draining-layer-evidence.js';
import { compareReceivingComponents } from './component-receiving-layer.js';
import { parseDrainingLayer, serializeDrainingLayer, checkDrainingFileBytes, DRAINING_MEANING } from './draining-layer-study.js';
import { DEFAULT_STUDY } from './study-contract.js';
import { compareThreeFactors, compareThreeFactorHypotheses } from './proposal-factorial.js';
import { componentEditIndices, edgeGroundEdits, compareEdgesGround, surfaceElevationEdits, compareProposalComponents, compareSurfaceElevation, compareComponentHypotheses } from './proposal-components.js';

export function mountProposalComponents({ getProject }) {
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.id = 'proposal-components';
  panel.innerHTML = `<h2>Which parts of the proposal work together?</h2>
    <p data-component-intro>Compare the existing site, A only, B only and the full proposal under the same storm.</p>
    <label>Separate the proposal by<select data-component-partition>
      <option value="cells">Groups of edited cells</option>
      <option value="surface-elevation">Surface versus elevation edits</option>
      <option value="edges-ground">Internal edges versus surface and elevation edits</option>
      <option value="three-factors">Surface, elevation and internal edges separately</option>
    </select></label>
    <p data-component-partition-help></p>
    <fieldset data-component-receiving hidden><legend>Compare receiving assumptions from an original investigation</legend>
      <p>Open original JSON saved by the draining receiving-layer or receiving-evidence investigation. Its own plans, storm and layer are compared here without replacing the active site. A single declared layer admits default capacities or all declared rates. A receiving-evidence file admits its own offered, calibration-compatible or surviving receiving explanations. Switching to another proposal partition closes this original source.</p>
      <label>Original receiving investigation<input type="file" accept=".json,application/json" data-component-receiving-file></label>
      <p data-component-receiving-source>No receiving investigation open; using the active site and unlimited receiving.</p>
      <button type="button" data-component-receiving-save disabled>Save original receiving investigation</button>
      <button type="button" data-component-receiving-clear disabled>Return to active site</button>
    </fieldset>
    <p data-cell-explanation>Each selected cell carries all its authored changes together, including its canonical east/south internal edges.
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
  const partition = panel.querySelector('[data-component-partition]');
  mode.addEventListener('change', () => { invalidate(); updatePartitionControls(); });
  partition.addEventListener('change', () => { if (partition.value !== 'three-factors') { ++receivingGeneration; receivingSource = null; fingerprint = undefined; describeReceiving(); refresh(); } invalidate(); updatePartitionControls(); });
  const selected = new Set();
  let fingerprint, receivingSource = null, receivingGeneration = 0;
  const receivingFile = panel.querySelector('[data-component-receiving-file]');
  const receivingSave = panel.querySelector('[data-component-receiving-save]');
  const receivingClear = panel.querySelector('[data-component-receiving-clear]');
  function sourceProject() { return receivingSource?.project ?? getProject(); }
  function describeReceiving() {
    const item = receivingSource;
    const evidence = !!item?.study;
    mode.querySelector('[value="default"]').disabled = evidence;
    mode.querySelector('[value="all"]').textContent = evidence ? 'All offered receiving explanations' : 'All saved infiltration hypotheses';
    mode.querySelector('[value="calibration"]').textContent = evidence ? 'Original calibration-compatible receiving explanations' : 'Calibration-compatible hypotheses';
    mode.querySelector('[value="surviving"]').textContent = evidence ? 'Original calibration and held-aside surviving receiving explanations' : 'Calibration and held-aside compatible hypotheses';
    panel.querySelector('[data-component-receiving-source]').textContent = item
      ? item.study ? `Original receiving evidence: ${item.project.title}; ${item.project.width} × ${item.project.height} cells; ${item.study.hypotheses.length} offered ${item.study.surface} receiving explanations, observed scenario ${item.study.target}. Support is computed only on that unchanged original source. Active site remains separate.` : `Original source: ${item.project.title}; ${item.project.width} × ${item.project.height} cells. ${item.layer.surface}: capacity ${item.layer.capacityMm} mm, initially ${item.layer.initialStoredMm} mm, drainage ${item.layer.drainagePerHour} /hour. Declaration: ${item.layer.source}. Active site remains separate.`
      : 'No receiving investigation open; using the active site and unlimited receiving.';
    receivingSave.disabled = receivingClear.disabled = !item;
  }
  receivingFile.addEventListener('change', async () => {
    const generation = ++receivingGeneration, file = receivingFile.files[0];
    if (!file) return;
    try {
      checkDrainingFileBytes(file.size);
      const content = await file.text();
      const parsed = JSON.parse(content)?.schema === DRAINING_EVIDENCE_SCHEMA ? parseDrainingEvidence(content) : parseDrainingLayer(content);
      if (generation !== receivingGeneration) return;
      receivingSource = parsed; if (parsed.study) mode.value = 'all'; fingerprint = undefined; refresh(); describeReceiving();
      status.textContent = parsed.study ? 'Original receiving evidence opened. Choose all offered or original-supported explanations, then propagate them through all eight worlds.' : 'Original receiving investigation opened. Choose default capacities or all declared rates, then compare both receiving assumptions.';
    } catch (error) { if (generation === receivingGeneration) { invalidate(); status.textContent = `Original investigation not opened: ${error.message}. Previous source retained.`; } }
    finally { if (generation === receivingGeneration) receivingFile.value = ''; }
  });
  receivingClear.addEventListener('click', () => { ++receivingGeneration; receivingSource = null; fingerprint = undefined; describeReceiving(); refresh(); });
  receivingSave.addEventListener('click', () => {
    if (!receivingSource) return;
    const url = URL.createObjectURL(new Blob([receivingSource.study ? serializeDrainingEvidence(receivingSource.project, receivingSource.study) : serializeDrainingLayer(receivingSource.project, receivingSource.layer)], {type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = 'original-component-receiving-investigation.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const fmt = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 3 });
  const signed = n => `${n > 0 ? '+' : ''}${fmt(n)}`;
  const cellName = (i, width) => `${String.fromCharCode(65 + i % width)}${Math.floor(i / width) + 1}`;
  const text = (tag, value) => { const el = document.createElement(tag); el.textContent = value; return el; };
  function invalidate() {
    output.replaceChildren();
    status.textContent = partition.value === 'three-factors' ? 'Compare all eight combinations of surface, elevation and internal edges.' : partition.value === 'cells' ? 'Choose at least one edited cell for A and leave at least one for B, then compare.' : partition.value === 'edges-ground' ? 'Compare proposed internal edges as A and proposed surfaces/elevations as B.' : 'Compare all proposed surface edits as A and all proposed elevation edits as B. The two factors can share cells.';
  }
  function updatePartitionControls() {
    const project = sourceProject(), propertyPartition = partition.value !== 'cells';
    const threeFactors = partition.value === 'three-factors';
    panel.querySelector('[data-component-receiving]').hidden = !threeFactors;
    run.textContent = threeFactors ? receivingSource ? receivingSource.study ? 'Compare receiving explanations' : 'Compare sixteen combinations' : 'Compare eight combinations' : 'Compare four combinations';
    panel.querySelector('[data-component-intro]').textContent = threeFactors ? 'Compare all eight combinations under the same storm and see how each pair interaction changes when the third change is present.' : 'Compare the existing site, A only, B only and the full proposal under the same storm.';
    list.closest('fieldset').hidden = propertyPartition;
    panel.querySelector('[data-cell-explanation]').hidden = propertyPartition;
    panel.querySelector('[data-component-partition-help]').textContent = propertyPartition
      ? threeFactors ? 'S changes surfaces, G changes elevations and E changes canonical internal edges. Ground heights and survey records remain together; crest elevations retain the source datum. All eight combinations are hypothetical model worlds.' : partition.value === 'edges-ground' ? 'A changes only canonical internal edges; B changes surfaces and elevations. Edge labels name the west/north owner cell. Ground and survey records travel together; absolute crest elevations remain in the declared datum. These are modeled combinations, not observed interventions.' : 'A changes only surfaces; B changes only elevations. Both can affect the same cell, and together they reproduce the full proposal. Internal walls and crests must remain unchanged between the source plans. This is a rain-model comparison; solar declarations are not evaluated here.'
      : 'Choose some edited cells as A. All remaining edits become B; each cell carries all its changes together.';
    if (threeFactors) {
      const ground = surfaceElevationEdits(project), edge = edgeGroundEdits(project);
      run.disabled = !ground.surfaceIndices.length || !ground.elevationIndices.length || !edge.edgeIndices.length;
      if (run.disabled) status.textContent = 'Add a surface edit, an elevation edit and an internal-edge edit. They may share a cell.';
    } else if (partition.value === 'edges-ground') {
      const edits = edgeGroundEdits(project);
      run.disabled = !edits.edgeIndices.length || !edits.groundIndices.length;
      if (run.disabled) status.textContent = 'Add both an internal edge change and a surface or elevation change.';
    } else if (propertyPartition) {
      const edits = surfaceElevationEdits(project);
      run.disabled = edits.barriersChanged || !edits.surfaceIndices.length || !edits.elevationIndices.length;
      if (edits.barriersChanged) status.textContent = 'Changed walls or crests are a third factor. Use Groups of edited cells, or keep edge conditions unchanged before separating surface and elevation.';
      else if (run.disabled) status.textContent = 'Add both a surface change and an elevation change. They may share one cell.';
    } else {
      run.disabled = componentEditIndices(project).length < 2;
      if (run.disabled) status.textContent = 'This experiment needs changes in at least two cells. Edit the proposal to define two separable parts.';
    }
  }
  function refresh() {
    const project = sourceProject();
    const next = JSON.stringify(project);
    if (fingerprint === next) return;
    fingerprint = next;
    const study = project.infiltrationStudy ?? { target: 'existing', surface: 'turf', ratesMmHr: [3, 9, 22] };
    panel.querySelector('[data-component-study]').textContent = receivingSource?.study ? 'Receiving evidence uses its original storage, initial-water and drainage alternatives at default surface capacities. Infiltration-rate evidence is not combined with this study.' : receivingSource ? `Original study declarations: ${study.surface} at ${study.ratesMmHr.join(', ')} mm/h. All offered rates are compared; evidence-compatible subsets from the unlimited model are not transferred.` : `Current study hypotheses: ${study.surface} at ${study.ratesMmHr.join(', ')} mm/h; evidence scenario ${study.target}. Rates are selected from the unchanged observed source before constructing hypothetical combinations. Each rate is applied consistently to matching surfaces in all compared cases; other surfaces retain defaults.`;
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
    updatePartitionControls();
  }
  function renderThreeFactors(project) {
    const supported = receivingSource?.study ? compareReceivingEvidenceComponents(project, receivingSource.study, {subset: mode.value === 'default' ? 'all' : mode.value}) : null;
    if (supported && supported.status !== 'compared') { output.replaceChildren(); const reasons = {'surface-absent':'The receiving surface is absent from the original observed scenario; these readings cannot support its receiving explanation.','need-calibration':'Assign original calibration readings before selecting supported receiving explanations.','need-challenge':'Assign original held-aside readings before selecting surviving receiving explanations.','no-supported-explanations':'No receiving explanations satisfy the requested original evidence. No offered-family fallback was substituted.'}; status.textContent = reasons[supported.status]; return; }
    const receiving = receivingSource?.layer ? compareReceivingComponents(project, receivingSource.layer, {study: mode.value === 'default' ? null : project.infiltrationStudy ?? DEFAULT_STUDY, subset: mode.value === 'default' ? 'all' : mode.value}) : null;
    if (receiving && receiving.status !== 'compared') { output.replaceChildren(); status.textContent = receiving.status === 'layer-surface-absent' ? 'The declared receiving surface is absent from both original plans.' : 'The declared rate surface is absent from both original plans.'; return; }
    const hypothesis = receiving || supported ? null : mode.value === 'default' ? null : compareThreeFactorHypotheses(project, { subset: mode.value });
    if (hypothesis && hypothesis.status !== 'compared') {
      const reasons = { 'need-calibration': 'Assign calibration readings before filtering hypotheses.',
        'need-challenge': 'Assign held-aside readings before requesting survivors.',
        'no-compatible-rates': 'No hypotheses satisfy the requested evidence bands. No replacement fit was substituted.',
        'surface-absent': 'The selected surface is absent from both scenarios.',
        'surface-absent-in-observed-source': 'The selected surface is absent from the observed source scenario.' };
      output.replaceChildren(); status.textContent = reasons[hypothesis.status]; return;
    }
    const candidates = supported ? supported.candidates : receiving ? receiving.candidates.map(c => ({...c, result: c.draining})) : hypothesis?.candidates ?? [{ result: compareThreeFactors(project) }];
    let receivingKind = 'draining';
    const names = ['Existing', 'S only', 'G only', 'S + G', 'E only', 'S + E', 'G + E', 'Full S + G + E'];
    function table(headers, rows, label) {
      const wrap = document.createElement('div'); wrap.className = 'component-table-wrap'; wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', label);
      const element = document.createElement('table'), head = document.createElement('thead'), hr = document.createElement('tr');
      for (const value of headers) hr.append(text('th', value)); head.append(hr); element.append(head);
      const body = document.createElement('tbody');
      for (const values of rows) { const row = document.createElement('tr'); values.forEach((value, i) => row.append(text(i ? 'td' : 'th', value))); body.append(row); }
      element.append(body); wrap.append(element); output.append(wrap);
    }
    function draw(index = 0) {
      output.replaceChildren();
      output.append(text('h3', 'Surface, elevation and edge interactions'));
      output.append(text('p', 'S = proposed surfaces; G = proposed elevations; E = proposed internal edges. A world includes only the listed proposed factors. Original source plans and evidence remain unchanged.'));
      if (supported || hypothesis || (receiving && candidates[0].rateMmHr !== null)) {
        const label = text('label', supported ? 'Inspect all eight combinations for receiving explanation ' : 'Inspect all eight combinations for rate '), picker = document.createElement('select'); picker.dataset.componentRate = '';
        candidates.forEach((candidate, i) => { const option = text('option', supported ? `${candidate.hypothesis.id}: ${candidate.hypothesis.label}` : `${candidate.rateMmHr} mm/h`); option.value = String(i); picker.append(option); });
        picker.value = String(index); picker.addEventListener('change', () => { draw(Number(picker.value)); output.querySelector('[data-component-rate]').focus({ preventScroll: true }); });
        label.append(picker); output.append(label);
        const detail = document.createElement('details'); detail.append(text('summary', supported ? 'Every retained receiving explanation’s three-way term' : receiving ? 'Every declared rate’s finite-layer three-way term' : 'Every retained rate’s three-way term'));
        for (const candidate of candidates) for (const metric of candidate.result.metrics) detail.append(text('p', `${supported ? candidate.hypothesis.id : `${candidate.rateMmHr} mm/h`} — ${metric.label}: ${signed(metric.effects[7])} ${metric.unit}.`));
        output.append(detail);
      }
      if (supported) {
        output.append(text('p', DRAINING_MEANING));
        output.append(text('p', 'Original calibration and held-aside support is evaluated once on the original observed scenario. No hypothetical world refits that support. All offered explanations remain below, including rejected alternatives; no parameter or layout is adopted.'));
        const state = evidence => evidence.compatible === true ? 'Compatible' : evidence.compatible === false ? 'Contradicted' : 'No readings';
        table(['Offered explanation', 'Capacity (mm)', 'Initial water (mm)', 'Drainage (/hour)', 'Calibration', 'Held-aside'], supported.inference.candidates.map(c => [c.hypothesis.id,fmt(c.hypothesis.capacityMm),fmt(c.hypothesis.initialStoredMm),fmt(c.hypothesis.drainagePerHour),state(c.calibration),state(c.challenge)]), 'All original receiving explanations and source support');
        const h = candidates[index].hypothesis;
        output.append(text('p', `Selected original declaration ${h.id}: ${h.label}. Capacity ${h.capacityMm} mm; initial water ${h.initialStoredMm} mm; drainage ${h.drainagePerHour} /hour. Source: ${h.source}`));
      }
      if (receiving) {
        output.append(text('p', DRAINING_MEANING));
        output.append(text('p', 'Both receiving assumptions use the same original plans and storm. Every declared rate is an offered alternative; no unlimited-model evidence filter is transferred and no result is adopted.'));
        const label = text('label', 'Inspect eight worlds under receiving assumption '), picker = document.createElement('select'); picker.dataset.componentReceiver = '';
        for (const [value, name] of [['draining','Original finite draining layer'],['unlimited','Unlimited receiving baseline']]) { const option = text('option', name); option.value = value; picker.append(option); }
        picker.value = receivingKind; picker.addEventListener('change', () => { receivingKind = picker.value; draw(index); output.querySelector('[data-component-receiver]').focus({preventScroll:true}); }); label.append(picker); output.append(label);
        table(['Quantity', 'Unlimited full change', 'Finite full change', 'Difference', 'Unlimited three-way', 'Finite three-way', 'Difference'], candidates[index].changes.map(m => [`${m.label} (${m.unit})`, ...[m.unlimitedFullEffect,m.drainingFullEffect,m.fullEffectDifference,m.unlimitedThreeWay,m.drainingThreeWay,m.threeWayDifference].map(signed)]), 'Same intervention under two receiving assumptions');
      }
      const result = receiving ? candidates[index][receivingKind] : candidates[index].result;
      output.append(text('p', 'On a narrow screen, scroll each table sideways to inspect every combination and contrast.'));
      output.append(text('h4', 'Every modeled world'));
      table(['Quantity', ...names], result.metrics.map(m => [`${m.label} (${m.unit})`, ...m.values.map(fmt)]), 'Eight modeled combinations; scroll horizontally');
      output.append(text('h4', 'Terms relative to the existing site'));
      output.append(text('p', 'The three single terms, three pair terms and three-way term sum to the full change. Each pair term here uses the existing setting of the third factor. The three-way term is the change in any pair interaction when its third factor is added. These are signed model contrasts, not measured causal effects.'));
      table(['Quantity', 'S', 'G', 'S × G', 'E', 'S × E', 'G × E', 'S × G × E', 'Full change'], result.metrics.map(m => [`${m.label} (${m.unit})`, ...m.effects.slice(1).map(signed), signed(m.values[7] - m.values[0])]), 'Factor terms and full change; scroll horizontally');
      output.append(text('h4', 'Does each pair depend on the third change?'));
      const label = { 1: 'S', 2: 'G', 4: 'E' };
      table(['Quantity / pair', 'Third factor', 'Without third', 'With third', 'Difference'], result.metrics.flatMap(m => m.conditionalPairs.map(p => [`${m.label} (${m.unit}): ${label[p.a]} × ${label[p.b]}`, label[p.third], signed(p.without), signed(p.with), signed(p.with - p.without)])), 'Pair interactions with and without the third change');
      output.append(text('p', 'A maximum can change its location or time between worlds. Its interaction does not by itself establish water exchange. Signs depend on the chosen quantity and offered rate; no rate is adopted and finite alternatives are not confidence intervals. Source-project export/reopen preserves the original plans; select this mode again to recompute.'));
      const residual = Math.max(...candidates.flatMap(c => receiving ? [...c.unlimited.balances,...c.draining.balances].map(Math.abs) : c.result.balances.map(Math.abs)));
      status.textContent = `${candidates.length} set(s) of ${receiving ? 'sixteen' : 'eight'} combinations computed; ${(supported?.estimatedCellSteps ?? receiving?.estimatedCellSteps ?? hypothesis?.estimatedCellSteps ?? result.estimatedCellSteps).toLocaleString()} estimated cell-steps. Largest absolute water-balance residual ${residual.toExponential(2)} L. Original plans and observations unchanged.`;
    }
    draw();
  }
  run.addEventListener('click', () => {
    try {
      const project = sourceProject();
      if (partition.value === 'three-factors') { renderThreeFactors(project); return; }
      const propertyPartition = partition.value !== 'cells';
      const hypothesis = mode.value === 'default' ? null : compareComponentHypotheses(project, [...selected], { subset: mode.value, partition: partition.value });
      if (hypothesis && hypothesis.status !== 'compared') {
        const reasons = { 'need-calibration': 'Assign calibration readings before filtering hypotheses.',
          'need-challenge': 'Assign held-aside readings before requesting survivors.',
          'no-compatible-rates': 'No hypotheses satisfy the requested evidence bands. No replacement fit was substituted.',
          'surface-absent': 'The selected surface is absent from both scenarios.',
          'surface-absent-in-observed-source': 'The selected surface is absent from the observed source scenario, so these readings cannot constrain its rate.' };
        output.replaceChildren(); status.textContent = reasons[hypothesis.status]; return;
      }
      function drawCandidate(candidateIndex = 0) {
      const result = hypothesis ? hypothesis.candidates[candidateIndex].result : partition.value === 'edges-ground' ? compareEdgesGround(project) : propertyPartition ? compareSurfaceElevation(project) : compareProposalComponents(project, [...selected]);
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
        picker.value = String(candidateIndex); picker.addEventListener('change', () => {
          drawCandidate(Number(picker.value));
          output.querySelector('[data-component-rate]').focus({ preventScroll: true });
        });
        label.append(picker); output.append(label);
        output.append(text('p', 'Choosing a rate here only changes the displayed diagnostic. It does not adopt a hypothesis or modify the saved project.'));
      }
      output.append(text('p', `A${partition.value === 'edges-ground' ? ' (internal edge owner cells)' : propertyPartition ? ' (surface edits)' : ''}: ${result.selectedIndices.map(i => cellName(i, project.width)).join(', ')}. B${partition.value === 'edges-ground' ? ' (surface/elevation edits)' : propertyPartition ? ' (elevation edits)' : ''}: ${result.remainingIndices.map(i => cellName(i, project.width)).join(', ')}.`));
      if (propertyPartition) output.append(text('p', 'Each derived case retains its heights and supplied survey records from the same source plan. Original plans and readings stay unchanged. These mixed cases are explicit model assumptions, not new observations.'));
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

