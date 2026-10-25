import {mountSoilSearch} from './wetting-front-search-panel.js';
import { SURFACES, validateProject } from './core.js';
import { DEFAULT_WETTING_FRONT_STUDY } from './wetting-front-contract.js';
import { compareWettingFront, serializeWettingFrontInvestigation,
  parseWettingFrontInvestigation, WETTING_FRONT_FILE_LIMIT } from './wetting-front-study.js';

const number = value => value === null ? '—' : Number(value).toLocaleString('en-US', {
  maximumSignificantDigits: 5, notation: value !== 0 && Math.abs(value) < 0.001 ? 'scientific' : 'standard',
});
const signed = value => (value > 0 ? '+' : '') + number(value);
const labelCell = (index, width) => String.fromCharCode(65 + index % width) + (1 + Math.floor(index / width));
function node(tag, text, className) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
}
const statuses = {
  'surface-absent': 'The investigated material is absent from the scenario with readings. These readings cannot identify its soil parameters.',
  'need-calibration': 'No calibration readings are assigned to this scenario. Compare the consequences; none of these explanations has evidence support yet.',
  'calibration-rejected': 'Every declared explanation misses a calibration band. The closest fit is still contradicted.',
  'needs-challenge': 'Some explanations agree with calibration. Readings held aside from fitting are needed to challenge their predictions.',
  'challenged': 'Every calibration-compatible explanation misses a held-aside band. Keep this contradiction when revisiting the assumptions.',
  'one-survivor': 'One of these finite explanations agrees with all assigned bands. This does not establish a unique soil property or field accuracy.',
  'ambiguous': 'Multiple explanations survive the assigned readings. The available evidence does not distinguish them.',
};

export function mountWettingFrontPanel({ getProject, replaceProject, prepareReading }) {
  const host = node('section', undefined, 'panel'); host.id = 'wetting-front-study';
  host.setAttribute('aria-labelledby', 'wetting-front-heading');
  host.innerHTML = `<style>
    #wetting-front-study{min-width:0;overflow-wrap:anywhere}
    #wetting-front-study .wf-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:.8rem}
    #wetting-front-study label{display:grid;gap:.35rem;min-width:0}
    #wetting-front-study input,#wetting-front-study select,#wetting-front-study textarea{box-sizing:border-box;width:100%;max-width:100%;min-width:0}
    #wetting-front-study .wf-hypothesis{display:grid;grid-template-columns:1fr 1fr auto;gap:.6rem;align-items:end;padding:.7rem 0;border-bottom:1px solid #d5e1da}
    #wetting-front-study .wf-actions{display:flex;gap:.6rem;flex-wrap:wrap;margin-block:1rem}
    #wetting-front-study .wf-choice{min-width:0;padding:1rem;border:1px solid #bdcec5;border-radius:12px;background:#f6faf7}
    #wetting-front-study .wf-choice[aria-pressed=true]{outline:2px solid #28706b}
    #wetting-front-study .wf-choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:.75rem}
    #wetting-front-study svg{display:block;width:100%;height:auto;margin-block:1rem}
    #wetting-front-study .wf-table{max-width:100%;overflow:auto}
    #wetting-front-study table{width:100%;border-collapse:collapse}
    #wetting-front-study th,#wetting-front-study td{padding:.4rem;text-align:left;border-bottom:1px solid #d5e1da}
    #wetting-front-study li{margin-block:.5rem}
    #wetting-front-study fieldset{min-width:0;border:1px solid #bdcec5;border-radius:8px;padding:.8rem;margin-block:.8rem}
    #wetting-front-study .wf-question-toggle{display:flex;align-items:center;gap:.6rem}
    #wetting-front-study .wf-question-toggle input{width:auto}
    #wetting-front-study .wf-question{padding:1rem;border-left:4px solid #28766b;background:#f2f8f5;margin-block:1rem}
    @media(max-width:480px){#wetting-front-study .wf-hypothesis{grid-template-columns:1fr 1fr}#wetting-front-study .wf-remove{grid-column:1/-1;justify-self:start}}
  </style>
  <div class="section-heading"><div><span class="eyebrow">SOIL RESPONSE / EVIDENCE CHALLENGE</span>
    <h2 id="wetting-front-heading">What changes as the soil wets?</h2></div></div>
  <p>Try soil explanations that start absorbing quickly, then slow as a wetting front advances. Compare the same site and rain, and inspect which explanations agree with your readings.</p>
  <form id="wetting-front-form">
    <div class="wf-fields"><label>Readings from<select id="wetting-front-target"><option value="existing">Existing site</option><option value="proposal">Proposed site</option></select></label>
    <label>Material to investigate<select id="wetting-front-surface"></select></label></div>
    <div id="wetting-front-hypotheses"></div>
    <div class="wf-actions"><button id="wetting-front-add" type="button" class="subtle">Add explanation</button></div>
    <label>Basis for these choices<textarea id="wetting-front-basis" rows="2" maxlength="400" required></textarea></label>
    <details><summary>What do K and A mean?</summary><p>K is the saturated conductivity in mm/hour. A combines wetting-front suction with the initial moisture deficit, in mm. A = 0 gives a constant-rate explanation. Separate suction and moisture values cannot be recovered from their product alone.</p>
    <p>This event model assumes a homogeneous sharp wetting front. It has no soil-moisture recovery or ponding-head correction. Geometry, surface routing and other materials keep their current assumptions. Use calibration and held-aside roles in the observation notebook below.</p></details>
    <label class="wf-question-toggle"><input id="wetting-front-question-enabled" type="checkbox">Include a question for a depth reading</label>
    <fieldset id="wetting-front-question-fields" disabled><legend>Where and when could a reading be available?</legend>
    <div class="wf-fields"><label>Places to compare<select id="wetting-front-question-scope"><option value="selected">Selected map cell</option><option value="grid">Any cell in this grid</option></select></label>
    <label>Earliest event time · min<input id="wetting-front-question-from" type="number" min="0" max="720" step="any" required></label>
    <label>Latest event time · min<input id="wetting-front-question-to" type="number" min="0" max="720" step="any" required></label>
    <label>Declared reading uncertainty · ± mm<input id="wetting-front-question-uncertainty" type="number" min="0" max="1000" step="any" required></label></div>
    <p class="mini-note">Compare retained model times inside this window. An earlier time is a question for existing timed evidence or a comparable event; it cannot create a past measurement. Only calibration values choose the alternatives.</p></fieldset>
    <div class="wf-actions"><button id="wetting-front-run" type="submit">Compare soil explanations</button>
    <button id="wetting-front-download" type="button" class="subtle" disabled>Save investigation</button></div>
  </form>
  <p id="wetting-front-status" role="status" aria-live="polite" class="mini-note"></p>
  <div id="wetting-front-results"></div>
  <details><summary>Reopen an investigation</summary><p>Recalculate its saved site, readings and soil choices here. Your working site stays in place. Source descriptions remain declarations.</p>
    <label>Saved soil investigation · JSON, up to 5 MiB<input id="wetting-front-import" type="file" accept=".json,application/json"></label>
    <div id="wetting-front-replay" aria-live="polite"></div></details>`;
  const anchor = document.getElementById('infiltration-form')?.closest('.panel');
  if (!anchor) throw new Error('The soil observation workbench is unavailable');
  anchor.after(host);
  const $ = id => host.querySelector('#wetting-front-' + id);
  for (const [value, material] of Object.entries(SURFACES)) {
    const option = node('option', material.label); option.value = value; $('surface').append(option);
  }
  let generation = 0, retained = null;
  function clear(message) {
    generation++; retained = null; $('download').disabled = true; $('run').disabled = false;
    $('results').replaceChildren(); $('replay').replaceChildren(); $('status').textContent = message;
  }
  function addHypothesis(hypothesis) {
    const row = node('div', undefined, 'wf-hypothesis');
    for (const [key, title, limit] of [['conductivityMmHr', 'Long-run rate K · mm/h', 2000],
      ['capillaryDriveMm', 'Wetting-front pull A · mm', 5000]]) {
      const label = node('label', title), input = node('input');
      input.type = 'number'; input.step = 'any'; input.min = '0'; input.max = String(limit);
      input.required = true; input.value = String(hypothesis[key]); input.dataset.parameter = key;
      label.append(input); row.append(label);
    }
    const remove = node('button', 'Remove', 'subtle wf-remove'); remove.type = 'button';
    remove.addEventListener('click', () => {
      if ($('hypotheses').children.length <= 2) return;
      row.remove(); updateButtons(); clear('Soil choices changed. Compare again.');
    }); row.append(remove); $('hypotheses').append(row);
  }
  function updateButtons() {
    const rows = [...$('hypotheses').children]; $('add').disabled = rows.length >= 9;
    rows.forEach((row, index) => {
      row.querySelector('button').disabled = rows.length <= 2;
      row.querySelector('button').setAttribute('aria-label', `Remove explanation ${index + 1}`);
      row.querySelectorAll('input').forEach(input => input.setAttribute('aria-label',
        `Explanation ${index + 1}, ${input.dataset.parameter === 'conductivityMmHr' ? 'conductivity in millimeters per hour' : 'capillary drive in millimeters'}`));
    });
  }
  let soilSearch;
  function refresh() {
    soilSearch?.refresh();
    clear('Choose soil explanations and compare. Use a site map to choose the cell shown in the depth curve.');
    const study = getProject().wettingFrontStudy ?? DEFAULT_WETTING_FRONT_STUDY;
    $('target').value = study.target; $('surface').value = study.surface; $('basis').value = study.basis;
    $('hypotheses').replaceChildren(); study.hypotheses.forEach(addHypothesis); updateButtons();
    const question = study.question ?? { scope: 'selected', fromMinute: 0,
      toMinute: getProject().weather.durationMinutes, uncertaintyMm: 1 };
    $('question-enabled').checked = Boolean(study.question); $('question-fields').disabled = !study.question;
    $('question-scope').value = question.scope; $('question-from').value = question.fromMinute;
    $('question-to').value = question.toMinute; $('question-uncertainty').value = question.uncertaintyMm;
  }
  function readStudy() {
    const numericInput = name => $(name).value.trim() === '' ? NaN : Number($(name).value);
    return { target: $('target').value, surface: $('surface').value, basis: $('basis').value.trim(),
      hypotheses: [...$('hypotheses').children].map(row => Object.fromEntries(
        [...row.querySelectorAll('input')].map(input => [input.dataset.parameter,
          input.value.trim() === '' ? NaN : Number(input.value)]))),
      ...($('question-enabled').checked ? { question: { scope: $('question-scope').value,
        fromMinute: numericInput('question-from'), toMinute: numericInput('question-to'),
        uncertaintyMm: numericInput('question-uncertainty') } } : {}) };
  }
  function showQuestion(container, question, report, project, replay) {
    const section = node('section', undefined, 'wf-question'); section.dataset.state = question.status;
    section.append(node('h3', 'A reading to test these explanations'));
    const messages = {
      'insufficient-alternatives': 'At least two calibration-compatible declared explanations are needed to compare their predictions. A single compatible choice still needs independent evidence.',
      'no-supported-times': 'This window contains no retained model time after the initial state. Widen the window or inspect a supported calculation interval.',
      'all-recorded': 'Every eligible cell and time already has a reading for this scenario. No replacement reading is suggested.',
      'indistinguishable': 'The compatible explanations predict the same depths at the available points. This event and window do not distinguish them.',
    };
    if (question.status !== 'question') section.append(node('p', messages[question.status]));
    else {
      section.dataset.disjointPairs = String(question.disjointPairCount);
      section.append(node('p', `Compare a reading at ${labelCell(question.cellIndex, project.width)}, minute ${number(question.minute)} in the ${question.target} scenario. ` +
        `Predicted depths span ${number(question.minDepthMm)}–${number(question.maxDepthMm)} mm, a ${number(question.spanMm)} mm difference.`));
      section.append(node('p', question.allPairsDisjoint
        ? `All ${question.pairCount} tested pairs have disjoint reading bands at ±${number(question.uncertaintyMm)} mm.`
        : `${question.disjointPairCount} of ${question.pairCount} tested pairs have disjoint reading bands at ±${number(question.uncertaintyMm)} mm. Overlapping pairs remain unresolved by this reading.`));
      const predictions = node('ol', undefined, 'wf-question-predictions');
      for (const prediction of question.predictions) {
        const row = node('li', `Explanation ${prediction.id} · K ${number(prediction.conductivityMmHr)} mm/h, A ${number(prediction.capillaryDriveMm)} mm: ` +
          `predicted ${number(prediction.depthMm)} mm; reading band ${number(prediction.lowMm)}–${number(prediction.highMm)} mm.`);
        row.dataset.hypothesis = String(prediction.id); predictions.append(row);
      }
      section.append(predictions);
      if (!question.allPairsDisjoint) {
        const unresolved = node('details'); unresolved.append(node('summary', 'Inspect overlapping pairs'));
        const pairs = node('ul');
        question.pairs.filter(pair => !pair.disjoint).forEach(pair =>
          pairs.append(node('li', `Explanations ${pair.firstId} and ${pair.secondId} have overlapping or touching bands.`)));
        unresolved.append(pairs); section.append(unresolved);
      }
      section.append(node('p', `Largest predicted range among ${question.evaluatedCount} unrecorded cell/time points from ${number(question.fromMinute)} to ${number(question.toMinute)} min. ` +
        `${question.excludedCount} already recorded points excluded. Scope: ${question.scope === 'selected' ? 'selected map cell' : 'whole declared grid'}; calculation interval ${number(question.stepMinutes)} min.`, 'mini-note'));
      if (!replay && typeof prepareReading === 'function') {
        const prepare = node('button', 'Prepare held-aside reading', 'subtle'); prepare.type = 'button';
        prepare.id = 'wetting-front-prepare-reading';
        prepare.addEventListener('click', () => {
          if (JSON.stringify(getProject()) !== report.sourceSignature) {
            clear('The source changed. Compare again before preparing a reading.'); return;
          }
          prepareReading(question);
        });
        section.append(prepare);
      }
    }
    section.append(node('p', 'This is finite model disagreement, not expected information gain or a guarantee that a real reading identifies soil properties. Held-aside values never choose this question. Only explicit notebook submission retains a measured value and source.', 'mini-note'));
    container.append(section);
  }
  function show(container, report, project, replay = false) {
    container.replaceChildren();
    container.append(node('h3', replay ? 'Recomputed from saved inputs' : 'Same site and rain, different soil response'));
    container.append(node('p', statuses[report.status]));
    container.append(node('p', `Basis: ${report.study.basis}`, 'mini-note'));
    container.append(node('p', `${report.counts.calibration} calibration · ${report.counts.challenge} held aside · ${report.counts.ignored} unused readings. ` +
      `${report.counts.affectedExisting} existing and ${report.counts.affectedProposal} proposed ${SURFACES[report.study.surface].label.toLowerCase()} cells use each declared explanation.`, 'mini-note'));
    if (report.question) showQuestion(container, report.question, report, project, replay);
    const base = report.baseline;
    container.append(node('p', `Current fixed-rate reference: ${number(base.existing.storedLiters)} L standing at the end in the existing site; ${number(base.proposal.storedLiters)} L in the proposal. ` +
      `Calibration ${base.calibration.withinCount}/${base.calibration.count}; held aside ${base.challenge.withinCount}/${base.challenge.count} inside declared bands.`, 'mini-note'));
    const choices = node('div', undefined, 'wf-choices'), detail = node('div', undefined, 'wf-detail');
    container.append(choices, detail);
    const buttons = [];
    for (const candidate of report.candidates) {
      const button = node('button', undefined, 'wf-choice'); button.type = 'button';
      button.dataset.hypothesis = String(candidate.id); button.setAttribute('aria-pressed', 'false');
      button.append(node('strong', `Explanation ${candidate.id}: K ${number(candidate.conductivityMmHr)} · A ${number(candidate.capillaryDriveMm)}`));
      for (const [key, title] of [['calibration', 'Calibration'], ['challenge', 'Held aside']]) {
        const score = candidate[key];
        button.append(node('p', `${title}: ${score.count ? `${score.withinCount}/${score.count} inside bands; ${number(score.rmseMm)} mm RMSE` : 'no assigned readings'}`));
      }
      button.append(node('p', `Proposed − existing: ${signed(candidate.change.storedLiters)} L final standing water; ${signed(candidate.change.exitLiters)} L boundary outflow.`));
      button.append(node('span', 'Inspect curve and readings', 'mini-note'));
      button.addEventListener('click', () => { buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        drawDetail(detail, candidate, report, project); });
      choices.append(button); buttons.push(button);
    }
    buttons[0]?.click();
    container.append(node('p', `All ${report.candidates.length} declared explanations are retained. Ordering uses calibration error only. ` +
      `Calculation interval: ${number(project.weather.stepMinutes)} min; routing still occurs at step boundaries. ${number(report.cellSteps)} estimated cell-steps.`, 'mini-note'));
  }
  $('add').addEventListener('click', () => {
    if ($('hypotheses').children.length >= 9) return;
    addHypothesis({ conductivityMmHr: 9, capillaryDriveMm: 0 }); updateButtons(); clear('New explanation added. Give it distinct values and compare.');
  });
  $('form').addEventListener('input', () => clear('Soil choices changed. Compare again; saved site properties have not been changed.'));
  $('question-enabled').addEventListener('change', () => {
    $('question-fields').disabled = !$('question-enabled').checked;
  });
  $('form').addEventListener('submit', event => {
    event.preventDefault(); clear('Comparing the declared soil explanations…');
    const epoch = generation, original = JSON.stringify(getProject());
    let next;
    try { next = structuredClone(getProject()); next.wettingFrontStudy = readStudy(); validateProject(next); }
    catch (error) { $('status').textContent = 'Comparison refused: ' + error.message; return; }
    $('run').disabled = true;
    setTimeout(() => {
      if (epoch !== generation) return;
      try {
        if (JSON.stringify(getProject()) !== original) throw new Error('Site changed; compare again');
        const report = compareWettingFront(next);
        if (epoch !== generation || JSON.stringify(getProject()) !== original) return;
        replaceProject(next); // Saves inputs only; refresh retires every stale derived panel.
        retained = { project: structuredClone(next), study: structuredClone(next.wettingFrontStudy), signature: JSON.stringify(next) };
        show($('results'), report, next); $('download').disabled = false;
        $('status').textContent = 'Comparison ready. ' + statuses[report.status];
      } catch (error) { $('status').textContent = 'Comparison refused: ' + error.message; }
      finally { $('run').disabled = false; }
    }, 0);
  });
  $('download').addEventListener('click', () => {
    try {
      if (!retained || retained.signature !== JSON.stringify(getProject())) throw new Error('Compare the current inputs before saving');
      const blob = new Blob([serializeWettingFrontInvestigation(retained.project, retained.study)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), anchor = node('a'); anchor.href = url;
      anchor.download = 'experimental-earth-soil-investigation.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) { $('status').textContent = 'Save refused: ' + error.message; }
  });
  $('import').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    clear('Reopening declared inputs…');
    const epoch = generation, original = JSON.stringify(getProject());
    try {
      if (file.size > WETTING_FRONT_FILE_LIMIT) throw new Error('Soil investigation exceeds the 5 MiB file limit');
      const text = await file.text();
      if (epoch !== generation || JSON.stringify(getProject()) !== original) return;
      const bundle = parseWettingFrontInvestigation(text), report = compareWettingFront(bundle.project, bundle.study);
      if (epoch !== generation || JSON.stringify(getProject()) !== original) return;
      show($('replay'), report, bundle.project, true);
      $('status').textContent = 'Saved investigation recomputed. Your working site is unchanged.';
    } catch (error) { if (epoch === generation) $('replay').textContent = 'Investigation refused: ' + error.message; }
    finally { if (epoch === generation) event.target.value = ''; }
  });
  soilSearch = mountSoilSearch({host, getProject, setDraft(study) {
    clear('Search pairs copied to draft. Compare the declared explanations.');
    $('target').value = study.target; $('surface').value = study.surface; $('basis').value = study.basis;
    $('hypotheses').replaceChildren(); study.hypotheses.forEach(addHypothesis); updateButtons();
  }});
  refresh();
  return { refresh };
}

function drawDetail(container, candidate, report, project) {
  container.replaceChildren();
  const cell = labelCell(report.selectedIndex, project.width);
  container.append(node('h3', `Explanation ${candidate.id} · modeled water depth at ${cell}`));
  const width = 680, height = 220, left = 52, right = 16, top = 20, bottom = 32;
  const observations = project.observations.filter(reading => reading.cellIndex === report.selectedIndex &&
    ['existing', 'proposal'].includes(reading.scenario) && ['calibration', 'challenge'].includes(reading.use));
  const maximum = Math.max(1, ...candidate.existing.selectedCell.depths.map(row => row.depthMm),
    ...candidate.proposal.selectedCell.depths.map(row => row.depthMm), ...observations.map(row => row.depthMm + row.uncertaintyMm));
  const x = minute => left + (width - left - right) * minute / project.weather.durationMinutes;
  const y = depth => height - bottom - (height - top - bottom) * depth / maximum;
  const svgNode = (tag, attributes, text) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img',
    'aria-label': `Explanation ${candidate.id}, existing and proposed depth in millimeters at cell ${cell}. Exact times and readings follow.` });
  for (let i = 0; i <= 4; i++) {
    const depth = maximum * i / 4;
    svg.append(svgNode('line', { x1: left, x2: width - right, y1: y(depth), y2: y(depth), stroke: '#d7e2dc' }));
    svg.append(svgNode('text', { x: left - 8, y: y(depth) + 4, 'text-anchor': 'end', fill: '#52635f', 'font-size': 12 }, number(depth)));
  }
  for (const [key, color, dash] of [['existing', '#275e9e', ''], ['proposal', '#28766b', '7 4']]) {
    const values = candidate[key].selectedCell.depths;
    svg.append(svgNode('polyline', { points: values.map(row => `${x(row.minute)},${y(row.depthMm)}`).join(' '),
      fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-dasharray': dash }));
  }
  for (const reading of observations) {
    const color = reading.scenario === 'existing' ? '#275e9e' : '#28766b';
    svg.append(svgNode('line', { x1: x(reading.minute), x2: x(reading.minute),
      y1: y(Math.max(0, reading.depthMm - reading.uncertaintyMm)), y2: y(reading.depthMm + reading.uncertaintyMm), stroke: color }));
    const mark = svgNode('circle', { cx: x(reading.minute), cy: y(reading.depthMm), r: 4,
      fill: reading.use === 'challenge' ? 'white' : color, stroke: color, 'stroke-width': 2 });
    mark.append(svgNode('title', {}, `${reading.use}: ${reading.depthMm} ± ${reading.uncertaintyMm} mm at ${reading.minute} min. Source: ${reading.source}`)); svg.append(mark);
  }
  svg.append(svgNode('text', { x: left, y: height - 8, 'font-size': 12, fill: '#52635f' }, '0 min'));
  svg.append(svgNode('text', { x: width - right, y: height - 8, 'text-anchor': 'end', 'font-size': 12, fill: '#52635f' }, `${number(project.weather.durationMinutes)} min`));
  container.append(svg, node('p', `Blue solid: existing · green dashed: proposal · filled markers: calibration · open markers: held aside. Scores use the ${report.study.target} scenario only; other-scenario markers are context. Bars show declared reading bands. Curves join saved solver steps, not an exact continuous surface-flow solution.`, 'mini-note'));
  const exact = node('details'); exact.append(node('summary', 'Inspect exact modeled times and water totals'));
  const wrap = node('div', undefined, 'wf-table'), table = node('table'), head = node('tr');
  for (const label of ['Minute', 'Existing · mm', 'Proposal · mm']) { const th = node('th', label); th.scope = 'col'; head.append(th); }
  table.append(head);
  candidate.existing.selectedCell.depths.forEach((row, index) => {
    const tr = node('tr'); for (const value of [row.minute, row.depthMm, candidate.proposal.selectedCell.depths[index].depthMm]) tr.append(node('td', String(value)));
    table.append(tr);
  }); wrap.append(table); exact.append(wrap);
  for (const key of ['existing', 'proposal']) {
    const result = candidate[key];
    exact.append(node('p', `${key}: ${number(result.rainLiters)} L rain; ${number(result.absorbedLiters)} L absorbed; ${number(result.exitLiters)} L boundary outflow; ${number(result.storedLiters)} L final standing. Balance residual ${number(result.massErrorLiters)} L.`));
  } container.append(exact);
  const evidence = node('details'); evidence.append(node('summary', 'Inspect original readings and residuals'));
  const list = node('ol');
  for (const [role, score] of [['Calibration', candidate.calibration], ['Held aside', candidate.challenge]]) {
    for (const error of score.errors) {
      const reading = project.observations[error.index];
      list.append(node('li', `${role}, ${labelCell(reading.cellIndex, project.width)} at original minute ${reading.minute}: ` +
        `observed ${number(reading.depthMm)} ± ${number(reading.uncertaintyMm)} mm, predicted ${number(error.depthMm)} mm, ` +
        `observed − predicted ${signed(error.residualMm)} mm. ${error.withinBand ? 'Inside' : 'Outside'} the band. ` +
        `${error.method === 'snapshot' ? 'Saved model time.' : `Interpolated between ${error.beforeMinute} and ${error.afterMinute} min.`} Source: ${reading.source}`));
    }
  }
  if (!list.children.length) evidence.append(node('p', 'No readings assigned to this scenario for calibration or held-aside comparison.'));
  else evidence.append(list);
  container.append(evidence);
}
