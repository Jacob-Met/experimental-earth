import { compareInfiltrationResolution } from './infiltration-resolution.js';
const $ = id => document.getElementById(id);
const number = value => value.toLocaleString('en-US', { maximumSignificantDigits: 6 });
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
const statuses = {
  'step-sensitive': 'A reading-band result or candidate decision changes when only the calculation interval changes. Treat the original comparison as numerically sensitive.',
  'no-decision-change': 'Reading-band results and candidate decisions agree across these tested intervals. Their numerical agreement does not establish convergence or physical accuracy.',
  'minimum-step': 'The saved model already uses the solver’s minimum interval of 1 minute. No finer supported interval is available for this comparison.',
  'no-assigned-readings': 'Assign calibration or held-aside readings to this scenario before checking their numerical sensitivity.',
  'surface-absent': 'The chosen surface is absent from this scenario. Choose a surface that is present.',
  'work-limit': 'This comparison exceeds the interactive work limit. Use a smaller grid, shorter modeled event or fewer candidate rates before trying again.',
};

function show(report, project, host) {
  host.append(element('p', `Tested ${report.stepsMinutes.map(number).join(' → ')} minute intervals. The saved interval remains ${number(report.baseStepMinutes)} minutes. The same site, weather event, candidate rates, readings and stated ± bands are used in every run.`, 'mini-note'));
  const table = element('table', undefined, 'resolution-table');
  table.append(element('caption', 'Candidate decisions by calculation interval'));
  const head = element('thead'), headings = element('tr');
  for (const title of ['Interval (min)', 'Closest on calibration (mm/h)', 'Within all calibration bands (mm/h)', 'Still compatible after held-aside readings (mm/h)']) {
    const th = element('th', title); th.scope = 'col'; headings.append(th);
  }
  head.append(headings); table.append(head); const body = element('tbody');
  for (const run of report.runs) {
    const row = element('tr'), label = element('th', number(run.stepMinutes)); label.scope = 'row'; row.append(label);
    for (const key of ['closestCalibrationRatesMmHr', 'compatibleRatesMmHr', 'survivingRatesMmHr']) {
      row.append(element('td', run[key].length ? run[key].slice().sort((a,b)=>a-b).map(number).join(', ') : 'none'));
    }
    body.append(row);
  }
  table.append(body); host.append(table);
  const flags = [['closestCalibration', 'closest calibration candidates'], ['calibrationCompatible', 'calibration-compatible candidates'], ['surviving', 'surviving candidates'], ['readingBands', 'individual reading bands']];
  const changed = flags.filter(([key]) => report.changes[key]).map(([,label]) => label);
  host.append(element('p', changed.length ? `Changed: ${changed.join('; ')}.` : 'No candidate decision or reading-band classification changed at these intervals.', changed.length ? 'study-mismatch' : 'study-score'));
  for (const candidate of report.candidates) {
    const details = element('details', undefined, 'resolution-candidate'); details.dataset.rate = String(candidate.rateMmHr);
    const count = candidate.readings.filter(r => r.bandChanged).length;
    details.append(element('summary', `${number(candidate.rateMmHr)} mm/h · ${count} reading-band ${count === 1 ? 'change' : 'changes'} · inspect interval predictions`));
    const list = element('ul');
    for (const result of candidate.readings) {
      const reading = project.observations[result.index];
      const cell = `${String.fromCharCode(65 + reading.cellIndex % project.width)}${Math.floor(reading.cellIndex / project.width) + 1}`;
      const item = element('li');
      item.append(element('p', `${result.role === 'challenge' ? 'Held aside' : 'Calibration'} · ${cell} at ${reading.minute} min: observed ${reading.depthMm} ± ${reading.uncertaintyMm} mm. Prediction spread ${number(result.spreadMm)} mm. Source: ${reading.source}`));
      // Full numerical values and interpolation brackets remain inspectable.
      for (const p of result.predictions) item.append(element('p', `${p.stepMinutes} min interval → ${p.depthMm} mm predicted; observed − predicted ${p.residualMm} mm; ${p.withinBand ? 'inside' : 'outside'} the stated band. ${p.method === 'snapshot' ? 'Solver snapshot.' : `Linear interpolation between ${p.beforeMinute} and ${p.afterMinute} min.`}`, 'mini-note'));
      list.append(item);
    }
    details.append(list); host.append(details);
  }
  host.append(element('p', 'Prediction spread is a difference between these runs, not an error bound or measurement uncertainty. Finer intervals can change both surface transfers and interpolation across changes in rainfall. Held-aside values never choose the closest calibration candidate. No rate or reading is changed.', 'mini-note'));
}

export function mountResolutionPanel({ getProject, notice }) {
  const button = $('compare-resolution'), status = $('resolution-status'), host = $('resolution-results');
  function clear() {
    button.disabled = true; status.textContent = ''; status.dataset.state = 'not-compared'; host.replaceChildren();
  }
  button.addEventListener('click', () => {
    if (button.disabled) return;
    button.disabled = true; host.replaceChildren();
    try {
      const project = getProject(), report = compareInfiltrationResolution(project);
      status.dataset.state = report.status; status.textContent = statuses[report.status];
      if (report.runs.length) show(report, project, host);
    } catch (error) { status.dataset.state = 'error'; status.textContent = 'The numerical comparison could not be completed.'; notice(error.message); }
    finally { button.disabled = false; }
  });
  return { clear, enable() { button.disabled = false; } };
}
