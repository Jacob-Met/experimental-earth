import {SURFACES} from './core.js';
import {DRAINING_HYPOTHESES_SCHEMA, compareDrainingHypotheses,
  serializeDrainingEvidence, parseDrainingEvidence, makeDrainingEvidenceExample} from './draining-layer-evidence.js';
import {checkDrainingFileBytes} from './draining-layer-study.js';
const node = (tag, text = '') => {const e = document.createElement(tag); e.textContent = text; return e;};
const fmt = value => value.toLocaleString('en-US', {maximumSignificantDigits: 7});
const cellName = (p, i) => String.fromCharCode(65 + i % p.width) + (1 + Math.floor(i / p.width));
const labels = {absorbedLiters: 'Water entering ground · L', storedLiters: 'Final standing water · L',
  exitLiters: 'Surface boundary outflow · L', maxDepthMm: 'Highest modeled depth · mm'};
const messages = {
  'surface-absent': 'The selected surface is absent from the observed scenario. These readings cannot distinguish its receiving properties.',
  'need-calibration': 'No original calibration readings are assigned to this scenario. No explanation is supported.',
  'calibration-rejected': 'Every offered explanation contradicts an original calibration band. No closest-fit fallback is used.',
  'needs-challenge': 'Calibration-compatible explanations remain, but no original held-aside reading challenges them yet.',
  'challenged': 'Every calibration-compatible explanation contradicts a held-aside reading. No surviving explanation is selected.',
  'one-survivor': 'One offered explanation is compatible with both original reading roles. Untested explanations may also fit.',
  'ambiguous': 'Several offered explanations remain compatible with both reading roles. The evidence does not distinguish them.',
};

/** Evidence lives inside the receiving-layer investigation and never adopts a
 * material or replaces the active project. A reopened source stays independent.
 */
export function mountDrainingEvidence({host, getProject, getLayer}) {
  const panel = node('section'); panel.id = 'dl-evidence';
  panel.innerHTML = '<h3>Which receiving explanations survive the original readings?</h3>' +
    '<p>An early depth can be explained by either storage or drainage. Offer alternatives explicitly, then challenge them with original notebook readings assigned as calibration or held aside.</p>' +
    '<p id="de-place" class="mini-note"></p>' +
    '<div class="dl-actions"><button type="button" id="de-current">Use current source and declared layer</button>' +
    '<button type="button" id="de-example" class="subtle">Try the fictional two-time reading</button></div>' +
    '<form id="de-form"><div class="input-pair"><label class="input-label">Observed scenario<select id="de-target"><option value="existing">Existing</option><option value="proposal">Proposed</option></select></label>' +
    '<label class="input-label">Surface above these layers<select id="de-surface"></select></label></div>' +
    '<div id="de-hypotheses"></div><div class="dl-actions"><button type="button" id="de-add">Add an offered explanation</button>' +
    '<button type="submit" id="de-run" class="primary">Compare with original readings</button></div></form>' +
    '<p id="de-status" role="status" aria-live="polite"></p><div id="de-results"></div>' +
    '<div class="dl-actions"><button type="button" id="de-save" disabled>Save original evidence investigation</button>' +
    '<label class="input-label">Reopen original evidence investigation<input id="de-open" type="file" accept=".json,application/json"></label></div>' +
    '<p class="mini-note">The original scenario, storm and surface infiltration rates stay fixed. These are finite offered explanations, not confidence intervals or measured soil calibration. Prediction rows reuse retained-step interpolation and the notebook evaluator’s numerical rounding guard. Held-aside readings never refit properties. Proposal consequences use the same source-supported explanation.</p>';
  host.append(panel);
  const $ = id => panel.querySelector('#de-' + id);
  for (const [id, s] of Object.entries(SURFACES)) {const option = node('option', s.label); option.value = id; $('surface').append(option);}
  $('surface').value = 'garden';
  let opened = null, accepted = null, generation = 0, key = '', nextId = 1;
  const source = () => opened ?? getProject();
  const status = (text, state) => {$('status').textContent = text; $('status').dataset.state = state;};
  function invalidate(message = 'Original assumptions changed. Compare again.') {
    generation++; accepted = null; $('results').replaceChildren(); $('save').disabled = true;
    $('run').disabled = false; status(message, 'draft');
  }
  function refresh() {
    const p = source(), next = JSON.stringify(p);
    if (next !== key) {key = next; invalidate('Offer at least two receiving explanations, then compare original readings.');}
    $('place').textContent = (opened ? 'Separate original evidence source: ' : 'Current evidence source: ') +
      p.title + ' · ' + p.observations.length + ' notebook rows. Active project unchanged.';
  }
  function addRow(h) {
    const row = node('fieldset'); row.dataset.hypothesis = h.id;
    row.append(node('legend', h.id));
    const pair = node('div'); pair.className = 'input-pair';
    for (const [field, label, type, maximum] of [
      ['label', 'Explanation label', 'text', 120], ['capacityMm', 'Total layer storage · mm', 'number', 10000],
      ['initialStoredMm', 'Initially retained water · mm', 'number', 10000], ['drainagePerHour', 'Drainage · /hour', 'number', 100]]) {
      const wrapper = node('label', label); wrapper.className = 'input-label';
      const input = node('input'); input.type = type; input.dataset.field = field; input.value = String(h[field] ?? '');
      if (type === 'number') {input.min = '0'; input.max = String(maximum); input.step = 'any';}
      else input.maxLength = maximum;
      wrapper.append(input); pair.append(wrapper);
    }
    const basis = node('label', 'Source or explicit hypothetical basis'); basis.className = 'input-label';
    const text = node('textarea'); text.dataset.field = 'source'; text.rows = 2; text.maxLength = 500; text.value = h.source ?? '';
    basis.append(text);
    const remove = node('button', 'Remove this offered explanation'); remove.type = 'button'; remove.className = 'subtle';
    remove.onclick = () => {row.remove(); invalidate();};
    row.append(pair, basis, remove); $('hypotheses').append(row);
  }
  function fill(study) {
    $('target').value = study.target; $('surface').value = study.surface; $('hypotheses').replaceChildren();
    for (const h of study.hypotheses) addRow(h);
  }
  function readStudy() {
    const hypotheses = [...$('hypotheses').children].map(row => {
      const h = {id: row.dataset.hypothesis};
      for (const field of ['label', 'capacityMm', 'initialStoredMm', 'drainagePerHour', 'source']) {
        const input = row.querySelector('[data-field="' + field + '"]');
        if (!input.value.trim()) throw Error('Complete every explanation label, numeric declaration and source basis');
        h[field] = ['label', 'source'].includes(field) ? input.value : Number(input.value);
      }
      return h;
    });
    return {schema: DRAINING_HYPOTHESES_SCHEMA, target: $('target').value, surface: $('surface').value, hypotheses};
  }
  function render() {
    const {project, report} = accepted, results = $('results'); results.replaceChildren();
    results.append(node('p', report.counts.calibration + ' calibration rows; ' + report.counts.challenge +
      ' held-aside rows; ' + report.counts.ignored + ' rows excluded by original scenario/role. ' +
      report.counts.affectedCells + ' cells have the studied surface in the observed scenario.'));
    for (const c of report.candidates) {
      const h = c.hypothesis, card = node('article'); card.dataset.hypothesis = h.id; card.className = 'de-candidate';
      card.dataset.calibration = String(c.calibration.compatible); card.dataset.challenge = String(c.challenge.compatible);
      card.append(node('h4', h.label), node('p', fmt(h.capacityMm) + ' mm total storage; ' + fmt(h.initialStoredMm) +
        ' mm initially retained; ' + fmt(h.drainagePerHour) + ' /hour drainage. ' + h.source));
      for (const [role, title] of [['calibration', 'Calibration'], ['challenge', 'Held aside']]) {
        const evaluation = c[role];
        card.append(node('p', title + ': ' + (evaluation.compatible === null ? 'no assigned original readings' :
          evaluation.compatible ? 'compatible with every original band' : 'contradicted by an original reading')));
        const details = node('details'); details.append(node('summary', title + ' original rows and predictions'));
        for (const e of evaluation.errors) {
          const r = project.observations[e.index];
          const p = node('p', 'Row ' + (e.index + 1) + ' · ' + cellName(project, r.cellIndex) + ' · minute ' + fmt(r.minute) +
            ': original ' + fmt(r.depthMm) + ' ± ' + fmt(r.uncertaintyMm) + ' mm; predicted ' + fmt(e.depthMm) +
            ' mm. ' + (e.withinBand ? 'Within the declared band.' : 'Outside the declared band.') + ' Source: ' + r.source +
            ' Prediction: ' + e.method + ', retained bracket ' + fmt(e.beforeMinute) + '–' + fmt(e.afterMinute) + ' min.');
          p.dataset.row = String(e.index); p.dataset.prediction = String(e.depthMm); details.append(p);
        }
        card.append(details);
      }
      card.append(node('p', 'Proposed minus existing final standing water: ' + fmt(c.change.storedLiters) + ' L. ' +
        'Proposed below-ground account: ' + fmt(c.proposal.receiver.initialLiters) + ' L initially; ' +
        fmt(c.proposal.receiver.retainedLiters) + ' L finally retained; ' + fmt(c.proposal.receiver.drainedLiters) + ' L drained.'));
      results.append(card);
    }
    for (const [subset, title] of [['all', 'Every offered explanation'], ['calibration', 'Calibration-compatible explanations'], ['surviving', 'Compatible with both reading roles']]) {
      const effect = report.effects[subset], section = node('section'); section.dataset.subset = subset;
      section.dataset.count = String(effect.count); section.className = 'de-effects';
      section.append(node('h4', title + ' · ' + effect.count));
      if (!effect.count) section.append(node('p', 'No supported consequence range for this group.'));
      else {
        section.append(node('p', 'Proposed minus existing, using each unchanged explanation:'));
        for (const [metric, label] of Object.entries(labels)) {
          const range = effect.metrics[metric];
          section.append(node('p', label + ': ' + fmt(range.minimum) + ' to ' + fmt(range.maximum)));
        }
      }
      results.append(section);
    }
  }
  function install(project, study, report) {accepted = {project, study, report}; render(); $('save').disabled = false;}
  $('form').addEventListener('input', () => invalidate());
  $('form').addEventListener('change', () => invalidate());
  $('add').onclick = () => {
    if ($('hypotheses').children.length >= 12) {status('Offer at most 12 receiving explanations.', 'refused'); return;}
    let id; do {id = 'h' + nextId++;} while ([...$('hypotheses').children].some(row => row.dataset.hypothesis === id));
    addRow({id, label: 'Alternative ' + id, initialStoredMm: 0}); invalidate();
  };
  $('current').onclick = () => {
    try {
      const layer = getLayer(), h = {id: 'h1', label: 'Current declared layer', capacityMm: layer.capacityMm,
        initialStoredMm: layer.initialStoredMm, drainagePerHour: layer.drainagePerHour, source: layer.source};
      opened = null; key = ''; fill({target: getProject().infiltrationStudy?.target ?? 'existing', surface: layer.surface, hypotheses: [h]});
      refresh(); invalidate('Current original source and declaration copied. Add a distinct explanation and choose the observed scenario.');
    } catch (error) {invalidate(); status(error.message, 'refused');}
  };
  $('example').onclick = () => {
    const example = makeDrainingEvidenceExample(); opened = example.project; fill(example.study); key = ''; refresh();
    invalidate('Fictional original readings and four explicit alternatives loaded. Compare to inspect the ambiguity.');
  };
  $('form').onsubmit = event => {
    event.preventDefault(); refresh(); invalidate('Comparing every offered explanation…'); const token = generation;
    let project, study;
    try {project = structuredClone(source()); study = readStudy();}
    catch (error) {status(error.message, 'refused'); return;}
    $('run').disabled = true; status('Computing original evidence and paired consequences…', 'pending');
    setTimeout(() => {
      if (token !== generation) return;
      try {const report = compareDrainingHypotheses(project, study); install(project, study, report); status(messages[report.status], report.status);}
      catch (error) {status(error.message, 'refused');}
      finally {if (token === generation) $('run').disabled = false;}
    }, 10);
  };
  $('save').onclick = () => {
    if (!accepted) return;
    try {
      const text = serializeDrainingEvidence(accepted.project, accepted.study), a = node('a');
      const url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
      a.href = url; a.download = 'experimental-earth-draining-evidence.json'; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {status(error.message, 'refused');}
  };
  $('open').onchange = async () => {
    const file = $('open').files?.[0]; if (!file) return;
    // Keep the File object, but reset the picker immediately so the same
    // original can be selected again after an edited draft retires this read.
    $('open').value = '';
    invalidate(); const token = generation; $('run').disabled = true; status('Reading original evidence inputs…', 'opening');
    try {
      checkDrainingFileBytes(file.size); const bytes = await file.arrayBuffer(); if (token !== generation) return;
      const input = parseDrainingEvidence(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
      const report = compareDrainingHypotheses(input.project, input.study); if (token !== generation) return;
      opened = input.project; key = JSON.stringify(opened); fill(input.study); install(opened, input.study, report); refresh();
      status('Recomputed from original inputs. ' + messages[report.status], report.status);
    } catch (error) {if (token === generation) status(error.message, 'refused');}
    finally {if (token === generation) $('run').disabled = false;}
  };
  refresh(); return {refresh};
}
