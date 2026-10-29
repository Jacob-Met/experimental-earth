import { parseWettingFrontInvestigation, WETTING_FRONT_FILE_LIMIT } from './wetting-front-study.js';
import { compareWettingFrontEvents, serializeWettingFrontEvents,
  parseWettingFrontEvents, reopenWettingFrontEvents } from './wetting-front-events.js';

function node(tag, text, className) {
  const value = document.createElement(tag);
  if (text !== undefined) value.textContent = text;
  if (className) value.className = className;
  return value;
}
const number = value => {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (n !== 0 && (Math.abs(n) < 0.0001 || Math.abs(n) >= 1e7)) {
    return Number(n.toPrecision(6)).toExponential();
  }
  return n.toLocaleString('en-US', { maximumSignificantDigits: 6 });
};
const cellLabel = (index, width) => String.fromCharCode(65 + index % width) + (1 + Math.floor(index / width));
const scoreLabel = score => score.compatible === null ? 'No assigned readings' :
  (score.compatible ? 'All bands met' : 'Band missed') + ' · ' + number(score.rmseMm) + ' mm RMSE';
const messages = {
  'calibration-rejected': 'Every declared explanation misses a first-event calibration band.',
  'first-event-challenged': 'Every calibration-compatible explanation misses a first-event held-aside band.',
  'challenged': 'Every explanation that survived the first event misses a second-event band.',
  'one-survivor': 'One of the declared explanations survives all assigned bands under these starting assumptions.',
  'ambiguous': 'Several declared explanations survive. These events do not distinguish them.',
};
function svgNode(tag, attributes, text) {
  const value = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, item] of Object.entries(attributes)) value.setAttribute(key, String(item));
  if (text !== undefined) value.textContent = text;
  return value;
}
function addModelView(host, model, project, target, title) {
  const section = node('section', undefined, 'wfe-model');
  const selected = model.selectedCell.cellIndex;
  section.append(node('h5', title + ' · cell ' + cellLabel(selected, project.width)),
    node('p', 'Modeled standing-water depth · mm', 'mini-note'));
  const readings = project.observations.filter(reading => reading.cellIndex === selected &&
    reading.scenario === target && ['calibration', 'challenge'].includes(reading.use));
  const depths = model.selectedCell.depths;
  const maximum = Math.max(1, ...depths.map(row => row.depthMm),
    ...readings.map(row => row.depthMm + row.uncertaintyMm));
  const left = 100, right = 445, top = 18, bottom = 172;
  const x = minute => left + (right - left) * minute / project.weather.durationMinutes;
  const y = depth => bottom - (bottom - top) * depth / maximum;
  const svg = svgNode('svg', { viewBox: '0 0 460 210', role: 'img',
    'aria-label': title + ', modeled standing-water depth and original reading bands at cell ' +
      cellLabel(selected, project.width), class: 'wfe-chart' });
  for (let i = 0; i <= 4; i++) {
    const depth = maximum * i / 4;
    svg.append(svgNode('line', { x1: left, x2: right, y1: y(depth), y2: y(depth), stroke: '#d5e1da' }),
      svgNode('text', { x: left - 6, y: y(depth) + 4, 'text-anchor': 'end',
        fill: '#425850', 'font-size': 11 }, number(depth)));
  }
  svg.append(svgNode('polyline', { points: depths.map(row => x(row.minute) + ',' + y(row.depthMm)).join(' '),
    fill: 'none', stroke: '#286e65', 'stroke-width': 2.5 }));
  for (const reading of readings) {
    svg.append(svgNode('line', { x1: x(reading.minute), x2: x(reading.minute),
      y1: y(Math.max(0, reading.depthMm - reading.uncertaintyMm)),
      y2: y(reading.depthMm + reading.uncertaintyMm), stroke: '#375f91', 'stroke-width': 2 }));
    const mark = svgNode('circle', { cx: x(reading.minute), cy: y(reading.depthMm), r: 4,
      fill: reading.use === 'calibration' ? '#375f91' : 'white', stroke: '#375f91', 'stroke-width': 2 });
    mark.append(svgNode('title', {}, reading.use + ': ' + reading.depthMm + ' ± ' +
      reading.uncertaintyMm + ' mm at ' + reading.minute + ' min. Source: ' + reading.source));
    svg.append(mark);
  }
  svg.append(svgNode('text', { x: left, y: 198, 'font-size': 11, fill: '#425850' }, '0 min'),
    svgNode('text', { x: right, y: 198, 'text-anchor': 'end', 'font-size': 11, fill: '#425850' },
      number(project.weather.durationMinutes) + ' min'));
  section.append(svg, node('p', 'Filled markers: calibration. Open markers: held aside. Bars are declared reading bands. Each event has its own vertical scale; exact values follow.', 'mini-note'));
  const exact = node('details');
  exact.append(node('summary', 'Exact modeled depths and water budget'));
  let built = false;
  exact.addEventListener('toggle', () => {
    if (!exact.open || built) return;
    built = true;
    const table = node('table'), head = node('tr');
    for (const label of ['Minute', 'Modeled depth · mm']) {
      const cell = node('th', label); cell.scope = 'col'; head.append(cell);
    }
    table.append(head);
    for (const row of depths) {
      const tr = node('tr'); tr.append(node('td', String(row.minute)), node('td', String(row.depthMm))); table.append(tr);
    }
    const wrap = node('div', undefined, 'wfe-exact-table'); wrap.append(table);
    exact.append(wrap, node('p', number(model.rainLiters) + ' L rain · ' + number(model.absorbedLiters) +
      ' L absorbed · ' + number(model.exitLiters) + ' L boundary outflow · ' + number(model.storedLiters) +
      ' L final standing water. Balance residual: ' + number(model.massErrorLiters) + ' L.'));
  });
  section.append(exact); host.append(section);
}
function addOriginalReadings(host, project, target, scores, title) {
  const details = node('details'); details.append(node('summary', title + ' · original readings and residuals'));
  let built = false;
  details.addEventListener('toggle', () => {
    if (!details.open || built) return;
    built = true;
    const errors = new Map(scores.flatMap(score => score.errors).map(error => [error.index, error]));
    const list = node('ol');
    project.observations.forEach((reading, index) => {
      const error = errors.get(index);
      let text = cellLabel(reading.cellIndex, project.width) + ', ' + reading.scenario + ', ' +
        (reading.use || 'unassigned role') + ', original minute ' + reading.minute + ': ' +
        reading.depthMm + ' ± ' + reading.uncertaintyMm + ' mm. ';
      if (error) text += 'Predicted ' + number(error.depthMm) + ' mm; observed − predicted ' +
        number(error.residualMm) + ' mm. ' + (error.withinBand ? 'Inside' : 'Outside') + ' the band. ' +
        (error.method === 'snapshot' ? 'Saved model time. ' :
          'Interpolated between ' + error.beforeMinute + ' and ' + error.afterMinute + ' min. ');
      else text += 'Context only; not used in the selected ' + target + ' comparison. ';
      list.append(node('li', text + 'Source: ' + reading.source));
    });
    if (project.observations.length) details.append(list);
    else details.append(node('p', 'No original readings in this event.'));
  });
  host.append(details);
}

function showComparison(host, report, inputs, title) {
  host.replaceChildren(); host.dataset.status = report.status;
  const sourceContext = (label, project) => label + ': ' + project.title + ' · ' +
    project.width + ' × ' + project.height + ' cells. Rain ' + number(project.weather.rainMmHr) +
    ' mm/h · storm ' + number(project.weather.stormMinutes) + ' min · run ' +
    number(project.weather.durationMinutes) + ' min.';
  host.append(node('h4', title), node('p', messages[report.status], 'wfe-result-summary'),
    node('p', sourceContext('First source', inputs.calibrationProject), 'wfe-source-context'),
    node('p', sourceContext('Second source', inputs.challengeProject), 'wfe-source-context'),
    node('p', 'First event: ' + report.references.calibration + '. Second event: ' +
      report.references.challenge + '. ' + report.cellSteps.toLocaleString('en-US') +
      ' admitted cell-steps.', 'mini-note'),
    node('p', 'First event: ' + report.counts.firstCalibration + ' calibration, ' +
      report.counts.firstChallenge + ' held aside, ' + report.counts.firstIgnored +
      ' context readings. Second event: ' + report.counts.secondChallenge + ' held aside, ' +
      report.counts.secondIgnored + ' context readings.', 'mini-note'),
    node('p', 'First-event hypothesis basis: ' + report.study.basis),
    node('p', 'Second-event starting basis: ' + report.initialConditions.basis),
    node('p', 'The order below is fixed by first-event calibration. Select an original explanation to inspect both events. On a narrow screen, scroll the table horizontally.', 'mini-note'));
  const wrap = node('div', undefined, 'wfe-comparison');
  wrap.tabIndex = 0; wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', 'Soil explanations across two events; scroll horizontally for every column');
  const table = node('table'), head = node('tr'), body = node('tbody');
  table.append(node('caption', 'Original explanations · first-event order retained'));
  for (const label of ['Explanation', 'K · mm/h', 'First A · mm', 'Second A · mm',
    'First calibration', 'First held aside', 'Second held aside', 'Combined result']) {
    const cell = node('th', label); cell.scope = 'col'; head.append(cell);
  }
  const thead = node('thead'); thead.append(head); table.append(thead, body);
  const detail = node('div', undefined, 'wfe-detail'); detail.setAttribute('aria-live', 'polite');
  const buttons = [];
  const select = candidate => {
    for (const button of buttons) button.setAttribute('aria-pressed', String(Number(button.dataset.hypothesis) === candidate.id));
    detail.replaceChildren();
    detail.append(node('h4', 'Original explanation ' + candidate.id),
      node('p', 'K = ' + number(candidate.conductivityMmHr) + ' mm/h. First A = ' +
        number(candidate.firstCapillaryDriveMm) + ' mm; separately declared second A = ' +
        number(candidate.challengeCapillaryDriveMm) + ' mm.'));
    const plots = node('div', undefined, 'wfe-plots');
    addModelView(plots, candidate.first[report.study.target], inputs.calibrationProject,
      report.study.target, 'First event');
    addModelView(plots, candidate.second.model, inputs.challengeProject,
      report.study.target, 'Second event');
    detail.append(plots);
    addOriginalReadings(detail, inputs.calibrationProject, report.study.target,
      [candidate.first.calibration, candidate.first.challenge], 'First event');
    addOriginalReadings(detail, inputs.challengeProject, report.study.target,
      [candidate.second.challenge], 'Second event');
  };
  for (const candidate of report.candidates) {
    const tr = node('tr'); tr.dataset.hypothesis = String(candidate.id);
    const cell = node('td'), button = node('button', 'Explanation ' + candidate.id, 'subtle wfe-compare-label');
    button.type = 'button'; button.dataset.hypothesis = String(candidate.id);
    button.setAttribute('aria-pressed', 'false'); button.addEventListener('click', () => select(candidate));
    buttons.push(button); cell.append(button); tr.append(cell);
    for (const value of [number(candidate.conductivityMmHr), number(candidate.firstCapillaryDriveMm),
      number(candidate.challengeCapillaryDriveMm), scoreLabel(candidate.first.calibration),
      scoreLabel(candidate.first.challenge), scoreLabel(candidate.second.challenge),
      candidate.survives ? 'Survives these bands' : 'Contradicted']) tr.append(node('td', value));
    body.append(tr);
  }
  wrap.append(table); host.append(wrap, detail, node('p', report.meaning, 'mini-note'));
  select(report.candidates.find(candidate => candidate.survives) || report.candidates[0]);
}

export function mountWettingFrontEvents({ host, getProject }) {
  const section = node('section', undefined, 'wfe-section'); section.id = 'wetting-front-events';
  section.setAttribute('aria-labelledby', 'wfe-heading');
  section.innerHTML = [
    '<style>',
    '#wetting-front-events{min-width:0;margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid #bdcec5}',
    '#wetting-front-events .wfe-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:.8rem}',
    '#wetting-front-events label{display:grid;gap:.35rem;min-width:0}',
    '#wetting-front-events input,#wetting-front-events textarea{box-sizing:border-box;min-width:0;width:100%;max-width:100%}',
    '#wetting-front-events .wfe-initial-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(130px,1fr);align-items:center;gap:1rem;padding:.65rem 0;border-bottom:1px solid #d5e1da}',
    '#wetting-front-events .wfe-actions{display:flex;gap:.65rem;flex-wrap:wrap;margin-block:1rem}',
    '#wetting-front-events .wfe-comparison{box-sizing:border-box;min-width:0;max-width:100%;overflow-x:auto;overscroll-behavior-inline:contain}',
    '#wetting-front-events .wfe-comparison table{width:100%;min-width:64rem;table-layout:auto;border-collapse:collapse;word-break:normal;overflow-wrap:normal}',
    '#wetting-front-events .wfe-comparison th,#wetting-front-events .wfe-comparison td{padding:.6rem;text-align:left;vertical-align:top;word-break:normal;overflow-wrap:normal}',
    '#wetting-front-events .wfe-compare-label{white-space:nowrap}',
    '#wetting-front-events .wfe-detail{box-sizing:border-box;min-width:0;padding:1rem;margin-top:1rem;border:1px solid #bdcec5;border-radius:10px;background:#f6faf7}',
    '#wetting-front-events .wfe-plots{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:1rem}',
    '#wetting-front-events .wfe-model{min-width:0}',
    '#wetting-front-events .wfe-chart{display:block;width:100%;height:auto}',
    '#wetting-front-events .wfe-chart text{font:11px system-ui,sans-serif}',
    '@media(max-width:480px){#wetting-front-events .wfe-chart text{font-size:18px}}',
    '#wetting-front-events .wfe-exact-table{max-width:100%;overflow:auto}',
    '#wetting-front-events .wfe-result-summary{font-weight:650}',
    '#wetting-front-events details{margin-block:.8rem}',
    '#wetting-front-events .wfe-replay{margin-top:1.5rem;padding-top:1rem;border-top:1px solid #bdcec5}',
    '</style>',
    '<h3 id="wfe-heading">Do these soil explanations survive another event?</h3>',
    '<p>Keep the first event as the calibration source. Use the current working site as a separate event held aside from fitting, with an explicit starting capillary drive for every original explanation.</p>',
    '<ol><li>Compare and save a first-event soil investigation above, with calibration readings.</li><li>Prepare the second rain event and held-aside readings in the working site. Keep its observed grid and numerical assumptions the same.</li><li>Load the first investigation here, identify the events and declare the second starting conditions.</li></ol>',
    '<label>First-event soil investigation<input id="wfe-first-file" type="file" accept="application/json,.json"></label>',
    '<p id="wfe-first-source" class="mini-note">No first event loaded.</p>',
    '<p id="wfe-working-source" class="mini-note"></p>',
    '<form id="wfe-form" novalidate>',
    '<div class="wfe-fields"><label>First event reference<input id="wfe-first-reference" type="text" maxlength="200" required></label>',
    '<label>Second event reference<input id="wfe-second-reference" type="text" maxlength="200" required></label></div>',
    '<fieldset><legend>Second-event starting conditions</legend>',
    '<p>A combines wetting-front suction with initial moisture deficit. Declare it independently for this event; this comparison does not infer moisture recovery between events.</p>',
    '<div id="wfe-initial-values"><p>Load the first event to see its original explanations.</p></div>',
    '<div class="wfe-actions"><button id="wfe-copy-starts" type="button" class="subtle" disabled>Use first-event A values</button></div>',
    '<label>Basis for these second-event starts<textarea id="wfe-starting-basis" rows="3" maxlength="600" required></textarea></label>',
    '<p class="mini-note">Copying values is an explicit assumption. Explain why it is appropriate. Both modeled events start with zero cumulative infiltration and zero standing water.</p></fieldset>',
    '<div class="wfe-actions"><button id="wfe-run" type="submit">Challenge across events</button>',
    '<button id="wfe-save" type="button" class="subtle" disabled>Save two-event inputs</button></div>',
    '</form>',
    '<p id="wfe-status" role="status" aria-live="polite">Load the first event, prepare the second and declare its starting conditions.</p>',
    '<div id="wfe-live"></div>',
    '<div class="wfe-replay"><h4>Reopen a two-event comparison</h4>',
    '<label>Saved two-event inputs<input id="wfe-replay-file" type="file" accept="application/json,.json"></label>',
    '<p id="wfe-replay-status" role="status" aria-live="polite"></p><div id="wfe-replay-result"></div></div>',
  ].join('\n');
  host.append(section);
  const $ = name => section.querySelector('#wfe-' + name);
  let firstBundle = null, firstEpoch = 0, runEpoch = 0, replayEpoch = 0, retained = null;
  let workingSignature = JSON.stringify(getProject());
  const clearLive = message => {
    runEpoch++; retained = null; $('save').disabled = true; $('run').disabled = false;
    $('live').replaceChildren(); delete $('live').dataset.status;
    if (message) $('status').textContent = message;
  };
  const draftSignature = () => JSON.stringify({
    firstBundle, working: getProject(), firstReference: $('first-reference').value,
    secondReference: $('second-reference').value, basis: $('starting-basis').value,
    drives: [...section.querySelectorAll('[data-second-drive]')].map(input => input.value),
  });
  const readInputs = () => {
    if (!firstBundle) throw new Error('Load a first-event soil investigation');
    const drives = [...section.querySelectorAll('[data-second-drive]')].map(input => {
      if (!input.value.trim()) throw new Error('Declare every second-event starting capillary drive');
      const value = Number(input.value);
      if (!Number.isFinite(value)) throw new Error('Declare finite second-event capillary drives');
      return value;
    });
    return { calibrationProject: structuredClone(firstBundle.project), challengeProject: structuredClone(getProject()),
      study: structuredClone(firstBundle.study),
      references: { calibration: $('first-reference').value, challenge: $('second-reference').value },
      initialConditions: { basis: $('starting-basis').value, challengeDrivesMm: drives } };
  };
  const inputArgs = inputs => [inputs.calibrationProject, inputs.challengeProject, inputs.study,
    inputs.references, inputs.initialConditions];

  let firstLoading = false;
  const draftChanged = () => {
    clearLive('Inputs changed. Compare the current declarations before saving.');
    if (firstLoading) $('run').disabled = true;
  };
  $('form').addEventListener('input', draftChanged);
  $('form').addEventListener('change', draftChanged);
  $('first-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    const epoch = ++firstEpoch;
    clearLive('Reading the first-event investigation…');
    firstLoading = true; $('run').disabled = true; $('copy-starts').disabled = true;
    try {
      if (file.size > WETTING_FRONT_FILE_LIMIT) throw new Error('Soil investigation exceeds the 5 MiB file limit');
      const text = await file.text();
      if (epoch !== firstEpoch) return;
      const bundle = parseWettingFrontInvestigation(text);
      if (epoch !== firstEpoch) return;
      firstBundle = structuredClone(bundle);
      $('first-reference').value = (file.name || 'First event').slice(0, 200);
      $('starting-basis').value = '';
      $('initial-values').replaceChildren();
      firstBundle.study.hypotheses.forEach((hypothesis, index) => {
        const row = node('div', undefined, 'wfe-initial-row');
        row.append(node('p', 'Explanation ' + (index + 1) + ' · K ' + number(hypothesis.conductivityMmHr) +
          ' mm/h · first A ' + number(hypothesis.capillaryDriveMm) + ' mm'));
        const label = node('label', 'Second-event A · mm'), input = node('input');
        input.type = 'number'; input.min = '0'; input.max = '5000'; input.step = 'any';
        input.required = true; input.value = ''; input.dataset.secondDrive = String(index + 1);
        input.id = 'wfe-second-drive-' + (index + 1);
        label.append(input); row.append(label); $('initial-values').append(row);
      });
      $('first-source').textContent = 'Accepted first source: ' + file.name + '. ' +
        firstBundle.study.hypotheses.length + ' original explanations for ' + firstBundle.study.surface +
        ' in the ' + firstBundle.study.target + ' scenario. Your working site is unchanged.';
      clearLive('First event loaded. Declare the second-event starts and their basis, then compare.');
      refreshWorkingLabel();
    } catch (error) {
      if (epoch === firstEpoch) $('status').textContent = 'First event refused: ' + error.message +
        (firstBundle ? ' The previous accepted first source and declarations remain available.' : '');
    } finally {
      if (epoch === firstEpoch) {
        firstLoading = false; $('run').disabled = false; $('copy-starts').disabled = !firstBundle;
        event.target.value = '';
      }
    }
  });
  $('copy-starts').addEventListener('click', () => {
    if (!firstBundle || firstLoading) return;
    [...section.querySelectorAll('[data-second-drive]')].forEach((input, index) => {
      input.value = String(firstBundle.study.hypotheses[index].capillaryDriveMm);
    });
    clearLive('First-event A values copied explicitly. Explain why these starts apply to the second event.');
  });
  $('form').addEventListener('submit', event => {
    event.preventDefault();
    if (firstLoading) { $('status').textContent = 'Wait for the first-event file to finish reading.'; return; }
    clearLive();
    const epoch = runEpoch, signature = draftSignature();
    $('run').disabled = true; $('status').textContent = 'Checking both events and comparing the original explanations…';
    setTimeout(() => {
      if (epoch !== runEpoch) return;
      try {
        if (signature !== draftSignature()) throw new Error('Inputs changed; compare again');
        const inputs = readInputs(), args = inputArgs(inputs);
        const serialized = serializeWettingFrontEvents(...args);
        const report = compareWettingFrontEvents(...args);
        if (epoch !== runEpoch || signature !== draftSignature()) return;
        showComparison($('live'), report, inputs, 'Current two-event comparison');
        retained = { signature, serialized };
        $('save').disabled = false;
        $('status').textContent = 'Comparison ready. ' + messages[report.status];
      } catch (error) {
        if (epoch === runEpoch) $('status').textContent = 'Comparison refused: ' + error.message;
      } finally {
        if (epoch === runEpoch) $('run').disabled = false;
      }
    }, 0);
  });
  $('save').addEventListener('click', () => {
    try {
      if (!retained || firstLoading || retained.signature !== draftSignature()) {
        throw new Error('Compare the current event inputs before saving');
      }
      const blob = new Blob([retained.serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob), anchor = node('a');
      anchor.href = url; anchor.download = 'experimental-earth-soil-events.json';
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) { $('status').textContent = 'Save refused: ' + error.message; }
  });
  $('replay-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    const epoch = ++replayEpoch;
    $('replay-result').replaceChildren(); delete $('replay-result').dataset.status;
    $('replay-status').textContent = 'Reading saved two-event inputs…';
    try {
      if (file.size > WETTING_FRONT_FILE_LIMIT) throw new Error('Two-event investigation exceeds the 5 MiB file limit');
      const text = await file.text();
      if (epoch !== replayEpoch) return;
      const bundle = parseWettingFrontEvents(text), report = reopenWettingFrontEvents(bundle);
      if (epoch !== replayEpoch) return;
      showComparison($('replay-result'), report, bundle, 'Saved two-event comparison · recomputed');
      $('replay-status').textContent = 'Saved inputs recomputed. Your working site is unchanged.';
    } catch (error) {
      if (epoch === replayEpoch) $('replay-status').textContent = 'Saved comparison refused: ' + error.message;
    } finally { if (epoch === replayEpoch) event.target.value = ''; }
  });
  function refreshWorkingLabel() {
    const project = getProject();
    $('working-source').textContent = 'Current working second event: ' + project.title + ' · ' +
      number(project.weather.rainMmHr) + ' mm/h rain · ' + number(project.weather.stormMinutes) +
      ' rainy minutes · ' + number(project.weather.durationMinutes) + ' modeled minutes. ' +
      'Its selected-scenario readings must be held aside.';
  }
  function refresh() {
    const current = JSON.stringify(getProject());
    if (current !== workingSignature) {
      workingSignature = current;
      clearLive('Working event changed. Compare again to refresh the two-event findings.');
      if (firstLoading) $('run').disabled = true;
    }
    refreshWorkingLabel();
  }
  refresh();
  return { refresh };
}
