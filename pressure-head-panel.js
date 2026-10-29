import { SURFACES } from './core.js';
import { drawDetail } from './wetting-front-panel.js';
import { comparePressureHead, serializePressureHeadInvestigation,
  parsePressureHeadInvestigation, PRESSURE_HEAD_FILE_LIMIT } from './pressure-head-study.js';

const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const number = value => value === null ? '—' : Number(value).toLocaleString('en-US', {
  maximumSignificantDigits: 5, notation: value !== 0 && Math.abs(value) < .001 ? 'scientific' : 'standard',
});
const messages = {
  'surface-absent': 'The investigated material is absent from the scenario with readings. Those readings cannot identify these parameters.',
  'need-calibration': 'No calibration readings are assigned. These are consequences of declared choices, with no evidence support yet.',
  'calibration-rejected': 'Every declared explanation misses a calibration band. The closest fit remains contradicted.',
  'needs-challenge': 'Some explanations agree with calibration. Independent held-aside readings are still needed.',
  'challenged': 'Every calibration-compatible explanation misses a held-aside band.',
  'one-survivor': 'One declared explanation agrees with all assigned bands. This does not establish unique soil properties or field accuracy.',
  'ambiguous': 'Multiple declared explanations remain compatible. These readings do not distinguish them.',
};

/** A separate, input-only investigation: never adopts a saved project or fitted soil. */
export function mountPressureHeadPanel({ getProject }) {
  const host = node('section', undefined, 'panel');
  host.id = 'pressure-head-study'; host.setAttribute('aria-labelledby', 'pressure-head-heading');
  host.innerHTML = `<style>
    #pressure-head-study{min-width:0;overflow-wrap:anywhere}
    #pressure-head-study label{display:grid;gap:.35rem;min-width:0}
    #pressure-head-study input,#pressure-head-study select,#pressure-head-study textarea{box-sizing:border-box;width:100%;max-width:100%;min-width:0}
    #pressure-head-study .ph-fields,#pressure-head-study .ph-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:.7rem}
    #pressure-head-study .ph-row{border-bottom:1px solid #cbd8d1;padding:1rem 0;align-items:end}
    #pressure-head-study .ph-actions{display:flex;flex-wrap:wrap;gap:.6rem;margin-block:1rem}
    #pressure-head-study .ph-choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:.7rem}
    #pressure-head-study .ph-choice{text-align:left;padding:1rem;min-width:0;white-space:normal}
    #pressure-head-study .ph-choice[aria-pressed=true]{outline:2px solid #28766b}
    #pressure-head-study svg{display:block;width:100%;height:auto;margin-block:1rem}
    #pressure-head-study .wf-table{max-width:100%;overflow:auto}
    #pressure-head-study table{min-width:360px;border-collapse:collapse}
    #pressure-head-study th,#pressure-head-study td{padding:.4rem;text-align:left;border-bottom:1px solid #d5e1da;white-space:nowrap}
    #pressure-head-study li{margin-block:.5rem}
    @media(max-width:480px){
      #pressure-head-study svg text{font-size:24px}
    }
  </style>
  <div class="section-heading"><div><span class="eyebrow">STANDING WATER / DECLARED SOIL RESPONSE</span>
    <h2 id="pressure-head-heading">Does standing water change the soil explanation?</h2></div></div>
  <p>Compare explicit moisture-deficit choices with a head-neglected control under the same site and rain. No soil parameters or working-site inputs are adopted.</p>
  <p>For a separate local test with timed water additions, <a id="pressure-batches-open" href="./pressure-batches.html">compare a batch-water course</a>.</p>
  <form id="pressure-head-form">
    <div class="ph-fields"><label>Readings from<select id="pressure-head-target"><option value="existing">Existing site</option><option value="proposal">Proposed site</option></select></label>
    <label>Material to investigate<select id="pressure-head-surface"></select></label></div>
    <div id="pressure-head-hypotheses"></div>
    <div class="ph-actions"><button type="button" id="pressure-head-add" class="subtle">Add explanation</button></div>
    <label>Basis for the conductivity, capillary drive and moisture-deficit choices<textarea id="pressure-head-basis" maxlength="1000" rows="3" required placeholder="State the source or authored assumption for these choices"></textarea></label>
    <details><summary>What does the moisture deficit mean?</summary>
      <p>Deficit is a separately declared volumetric fraction from 0 to 1. It multiplies standing-water depth in the infiltration equation. A remains suction times initial moisture deficit; A alone cannot identify the deficit.</p>
      <p>Enter 0 explicitly for a head-neglected mathematical control. When A is nonzero, that control does not imply physically zero moisture deficit. Positive values include standing-water pressure. These homogeneous sharp-front event calculations do not establish field accuracy, moisture recovery or biological effects.</p></details>
    <div class="ph-actions"><button type="submit" id="pressure-head-run">Compare declared explanations</button>
      <button type="button" id="pressure-head-download" class="subtle" disabled>Save investigation</button></div>
  </form>
  <p id="pressure-head-status" role="status" aria-live="polite"></p>
  <div id="pressure-head-results"></div>
  <details><summary>Reopen a pressure-head investigation</summary>
    <p>Recalculate its exact saved site, readings and declared choices in this separate view. Your working project and draft stay in place. Saved conclusions are never adopted.</p>
    <label>Saved investigation · JSON<input type="file" id="pressure-head-import" accept=".json,application/json"></label>
    <p id="pressure-head-replay-status" role="status" aria-live="polite"></p>
    <button type="button" id="pressure-head-replay-download" disabled>Save reopened inputs</button>
    <div id="pressure-head-replay"></div>
  </details>`;
  const anchor = document.getElementById('wetting-front-study');
  if (!anchor) throw Error('The maintained soil comparison is unavailable');
  anchor.after(host);
  const $ = name => host.querySelector('#pressure-head-' + name);
  const mobileChart = window.matchMedia('(max-width:480px)');
  // Presentation-only left gutter for larger mobile labels; curve coordinates,
  // original readings and the maintained renderer remain unchanged.
  function chartViewport(svg) {
    svg.setAttribute('viewBox', mobileChart.matches ? '-64 0 744 220' : '0 0 680 220');
  }
  mobileChart.addEventListener('change', () => host.querySelectorAll('svg').forEach(chartViewport));
  function drawPressureDetail(container, candidate, report, project) {
    drawDetail(container, candidate, report, project);
    container.querySelectorAll('svg').forEach(chartViewport);
  }
  for (const [key, value] of Object.entries(SURFACES)) {
    const option = node('option', value.label); option.value = key; $('surface').append(option);
  }
  let epoch = 0, replayEpoch = 0, retained = null, replay = null;
  let projectSignature = JSON.stringify(getProject());
  function invalidate(message) {
    epoch++; retained = null; $('results').replaceChildren();
    $('download').disabled = true; $('run').disabled = false; $('status').textContent = message;
  }
  function updateButtons() {
    const rows = [...$('hypotheses').children]; $('add').disabled = rows.length >= 9;
    rows.forEach((row, i) => {
      row.querySelector('button').disabled = rows.length <= 2;
      row.querySelector('button').setAttribute('aria-label', `Remove explanation ${i + 1}`);
      row.querySelectorAll('input').forEach(input => input.setAttribute('aria-label', `Explanation ${i + 1}, ${input.dataset.title}`));
    });
  }
  function addHypothesis() {
    const row = node('div', undefined, 'ph-row');
    for (const [key, title, max, initial] of [
      ['conductivityMmHr', 'Conductivity K · mm/h', 2000, '9'],
      ['capillaryDriveMm', 'Capillary drive A · mm', 5000, '20'],
      ['moistureDeficit', 'Declared moisture deficit · fraction', 1, ''],
    ]) {
      const label = node('label', title), input = node('input');
      input.type = 'number'; input.min = '0'; input.max = String(max); input.step = 'any'; input.required = true;
      input.value = initial; input.dataset.parameter = key; input.dataset.title = title;
      label.append(input); row.append(label);
    }
    const remove = node('button', 'Remove', 'subtle'); remove.type = 'button';
    remove.addEventListener('click', () => {
      if ($('hypotheses').children.length <= 2) return;
      row.remove(); updateButtons(); invalidate('Explanation removed. Compare again.');
    });
    row.append(remove); $('hypotheses').append(row); updateButtons();
  }
  function readStudy() {
    return { schema: 'experimental-earth-pressure-head-study/1', target: $('target').value,
      surface: $('surface').value, basis: $('basis').value.trim(),
      hypotheses: [...$('hypotheses').children].map(row => Object.fromEntries(
        [...row.querySelectorAll('input')].map(input => [input.dataset.parameter,
          input.value.trim() === '' ? NaN : Number(input.value)]))) };
  }
  function show(report, project, reopened) {
    const fragment = document.createDocumentFragment();
    fragment.append(node('h3', reopened ? 'Recomputed from saved inputs' : 'Declared explanations under the same site and rain'));
    const context = node('p', `Source site: ${project.title} · ${project.width} × ${project.height} cells. ` +
      `Rain ${number(project.weather.rainMmHr)} mm/h · storm ${number(project.weather.stormMinutes)} min · run ${number(project.weather.durationMinutes)} min.`, 'ph-source-context');
    fragment.append(context);
    fragment.append(node('p', messages[report.status] ?? report.status));
    fragment.append(node('p', `Basis: ${report.study.basis}`));
    fragment.append(node('p', `${report.counts.calibration} calibration · ${report.counts.challenge} held aside · ${report.counts.ignored} unused readings. All ${report.candidates.length} explanations remain visible; calibration alone determines ordering.`, 'mini-note'));
    fragment.append(node('p', `${report.counts.affectedExisting} existing and ${report.counts.affectedProposal} proposed ${SURFACES[report.study.surface].label.toLowerCase()} cells use each declared explanation. Other materials keep their current rates.`, 'mini-note'));
    const baseline = report.baseline;
    fragment.append(node('p', `Current fixed-rate reference: existing ${number(baseline.existing.storedLiters)} L and proposal ${number(baseline.proposal.storedLiters)} L final standing water. ` +
      `Calibration ${baseline.calibration.withinCount}/${baseline.calibration.count}; held aside ${baseline.challenge.withinCount}/${baseline.challenge.count} inside declared bands. This reference uses this investigation's fixed material rates, separately from the zero-deficit wetting-front control.`, 'mini-note'));
    const choices = node('div', undefined, 'ph-choices'), detail = node('div', undefined, 'ph-detail'); fragment.append(choices, detail);
    const buttons = [];
    for (const candidate of report.candidates) {
      const button = node('button', undefined, 'ph-choice'); button.type = 'button';
      button.dataset.hypothesis = String(candidate.id); button.setAttribute('aria-pressed', 'false');
      button.append(node('strong', `Explanation ${candidate.id}: K ${number(candidate.conductivityMmHr)} mm/h · A ${number(candidate.capillaryDriveMm)} mm · deficit ${number(candidate.moistureDeficit)}`));
      button.append(node('p', candidate.moistureDeficit === 0 ? 'Head-neglected mathematical control' : 'Standing-water pressure included'));
      for (const [key, label] of [['calibration', 'Calibration'], ['challenge', 'Held aside']]) {
        const score = candidate[key];
        button.append(node('p', `${label}: ${score.count ? `${score.withinCount}/${score.count} inside bands; ${number(score.rmseMm)} mm RMSE` : 'no assigned readings'}`));
      }
      button.append(node('p', `Final standing water: existing ${number(candidate.existing.storedLiters)} L; proposal ${number(candidate.proposal.storedLiters)} L.`));
      button.append(node('span', 'Inspect curve, exact times and original reading sources', 'mini-note'));
      button.addEventListener('click', () => {
        if (!reopened && (!retained || retained.signature !== JSON.stringify(getProject()))) {
          invalidate('Working project changed. Compare again.'); return;
        }
        buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        drawPressureDetail(detail, candidate, report, project);
      });
      choices.append(button); buttons.push(button);
    }
    // Render before adopting the result; this path has no live-state callback.
    if (report.candidates.length) {
      buttons[0].setAttribute('aria-pressed', 'true'); drawPressureDetail(detail, report.candidates[0], report, project);
    }
    fragment.append(node('p', `Calculation interval ${number(project.weather.stepMinutes)} min; routing remains at step boundaries. ${number(report.cellSteps)} estimated cell-steps. Agreement with declared bands is conditional model compatibility, not field validation.`, 'mini-note'));
    return fragment;
  }
  function download(text, filename) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = node('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('form').addEventListener('input', () => invalidate('Declared choices changed. Compare again.'));
  $('form').addEventListener('change', () => invalidate('Declared choices changed. Compare again.'));
  $('add').addEventListener('click', () => {
    if ($('hypotheses').children.length >= 9) return;
    addHypothesis(); invalidate('Enter the new deficit explicitly and compare again.');
  });
  $('form').addEventListener('submit', event => {
    event.preventDefault(); invalidate('Comparing declared explanations…');
    const ticket = epoch, project = structuredClone(getProject()), signature = JSON.stringify(project), study = readStudy();
    $('run').disabled = true;
    setTimeout(() => {
      if (ticket !== epoch) return;
      if (signature !== JSON.stringify(getProject())) { invalidate('Working project changed. Compare again.'); return; }
      try {
        const report = comparePressureHead(project, study), fragment = show(report, project, false);
        if (ticket !== epoch || signature !== JSON.stringify(getProject())) { invalidate('Inputs changed. Compare again.'); return; }
        retained = { project, study, signature }; $('results').replaceChildren(fragment);
        $('download').disabled = false; $('status').textContent = 'Comparison complete. Working project unchanged.';
      } catch (error) { if (ticket === epoch) $('status').textContent = 'Comparison refused: ' + error.message; }
      finally { if (ticket === epoch) $('run').disabled = false; }
    }, 0);
  });
  $('download').addEventListener('click', () => {
    if (!retained) return;
    if (retained.signature !== JSON.stringify(getProject()) || JSON.stringify(retained.study) !== JSON.stringify(readStudy())) {
      invalidate('Inputs changed. Compare again before saving.'); return;
    }
    try { download(serializePressureHeadInvestigation(retained.project, retained.study), 'experimental-earth-pressure-head.json'); }
    catch (error) { $('status').textContent = 'Save refused: ' + error.message; }
  });
  $('import').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    const ticket = ++replayEpoch; $('replay-download').disabled = true;
    $('replay-status').textContent = 'Reading saved inputs; any prior accepted replay remains below.';
    try {
      if (file.size > PRESSURE_HEAD_FILE_LIMIT) throw Error('Investigation exceeds the file-size limit');
      const text = await file.text(); if (ticket !== replayEpoch) return;
      const bundle = parsePressureHeadInvestigation(text), report = comparePressureHead(bundle.project, bundle.study);
      const fragment = show(report, bundle.project, true);
      if (ticket !== replayEpoch) return;
      replay = bundle; $('replay').replaceChildren(fragment);
      $('replay-status').textContent = 'Recomputed saved inputs in a separate view. Working site and current draft unchanged.';
    } catch (error) { if (ticket === replayEpoch) $('replay-status').textContent = 'Reopen refused; previous accepted replay retained: ' + error.message; }
    finally { if (ticket === replayEpoch) { $('replay-download').disabled = !replay; event.target.value = ''; } }
  });
  $('replay-download').addEventListener('click', () => {
    if (!replay || $('replay-download').disabled) return;
    try { download(serializePressureHeadInvestigation(replay.project, replay.study), 'experimental-earth-pressure-head-reopened.json'); }
    catch (error) { $('replay-status').textContent = 'Save refused: ' + error.message; }
  });
  function refresh() {
    const next = JSON.stringify(getProject());
    if (next !== projectSignature) { projectSignature = next; invalidate('Working project changed. Your declared choices remain; compare again.'); }
  }
  addHypothesis(); addHypothesis();
  const preferred = getProject().wettingFrontStudy?.surface;
  if (preferred && SURFACES[preferred]) $('surface').value = preferred;
  $('status').textContent = 'Enter each moisture deficit and its basis explicitly. Zero selects the head-neglected control.';
  return { refresh };
}
