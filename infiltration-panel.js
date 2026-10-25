import { renderEvidenceConflict } from './evidence-conflict-panel.js';
import { SURFACES } from './core.js';
import { DEFAULT_STUDY, validateStudy } from './study-contract.js';
import { compareInfiltration } from './infiltration-study.js';
import { chooseInfiltrationQuestion } from './infiltration-question.js';
import { mountResolutionPanel } from './infiltration-resolution-panel.js';
import { mountComplementaryDepthPanel } from './complementary-depth-panel.js';

const $ = id => document.getElementById(id);
const number = n => n === null ? '—' : n.toLocaleString('en-US', {
  maximumSignificantDigits: 5, notation: n !== 0 && Math.abs(n) < 0.001 ? 'scientific' : 'standard',
});
const errorNumber = n => n !== null && n !== 0 && Math.abs(n) < 1e-9 ? '≈ 0' : number(n);
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
const statuses = {
  'surface-absent': 'This surface is absent from the selected scenario. Choose a surface that is actually present.',
  'need-calibration': 'No calibration readings for this scenario. The candidates are unranked evidence-wise; no rate is supported yet.',
  'calibration-rejected': 'Every candidate misses at least one calibration band. Consider missing physics, input errors, or a different candidate set; the closest fit is still contradicted.',
  'needs-challenge': 'Calibration alone cannot check prediction. Keep the compatible alternatives and collect or assign readings held aside from fitting.',
  'challenged': 'Every calibration-compatible candidate misses a held-aside reading. The tested assumptions have been challenged; no replacement rate has been adopted.',
  'ambiguous': 'Multiple candidates survive these readings. The evidence does not distinguish them within the stated bands.',
  'one-survivor': 'One tested candidate stays within every calibration and held-aside band. This bounded agreement does not validate the physical model or establish a unique soil property.',
};

/** Legacy readings keep their source and value while the user explicitly assigns a role. */
export function evidenceControls(reading, changed) {
  const row = element('div', undefined, 'evidence-controls');
  const choices = [
    ['Observed scenario', 'scenario', [['unassigned', 'Unassigned'], ['existing', 'Existing site'], ['proposal', 'Proposed site']]],
    ['Evidence role', 'use', [['unassigned', 'Notebook only'], ['calibration', 'Calibration'], ['challenge', 'Held aside']]],
  ];
  for (const [label, key, options] of choices) {
    const wrapper = element('label', label);
    const select = element('select');
    select.dataset.evidenceField = key;
    for (const [value, title] of options) { const option = element('option', title); option.value = value; select.append(option); }
    select.value = reading[key] ?? 'unassigned';
    select.disabled = key === 'use' && (!reading.scenario || reading.scenario === 'unassigned');
    select.addEventListener('change', () => {
      reading[key] = select.value;
      if (reading.scenario === 'unassigned') reading.use = 'unassigned';
      changed();
    });
    wrapper.append(select); row.append(wrapper);
  }
  return row;
}

export function mountInfiltrationPanel({ getProject, changed, notice, prepareReading }) {
  const button = $('compare-infiltration');
  const resolution = mountResolutionPanel({ getProject, notice });
  const complementary = mountComplementaryDepthPanel({ getProject, prepareReading, notice });
  let question = null;
  function clearQuestion() {
    resolution.clear();
    complementary.clear();
    question = null;
    $('find-infiltration-reading').disabled = true;
    $('prepare-infiltration-reading').hidden = true;
    $('infiltration-question').textContent = '';
  }
  $('infiltration-form').addEventListener('input', () => {
    clearQuestion();
    $('study-results').replaceChildren();
    $('study-status').dataset.state = 'not-compared';
    $('study-status').textContent = 'Choices changed. Compare again to evaluate these candidates; the site parameters remain unchanged.';
  });
  function refresh() {
    clearQuestion();
    const study = getProject().infiltrationStudy ?? DEFAULT_STUDY;
    $('study-target').value = study.target;
    $('study-surface').value = study.surface;
    $('study-rates').value = study.ratesMmHr.join(', ');
    $('study-status').textContent = 'Assign readings below to a scenario and evidence role, then compare the candidate rates against the current site and weather assumptions.';
    $('study-status').dataset.state = 'not-compared';
    $('study-results').replaceChildren();
  }
  function show(report, project, study) {
    resolution.enable();
    $('find-infiltration-reading').disabled = false;
    $('study-status').textContent = statuses[report.status];
    $('study-status').dataset.state = report.status;
    const host = $('study-results'); host.replaceChildren();
    const { calibration, challenge, ignored, affectedCells } = report.counts;
    host.append(element('p', `${calibration} calibration · ${challenge} held aside · ${ignored} excluded readings. Each candidate changes all ${affectedCells} ${SURFACES[study.surface].label.toLowerCase()} cells in the ${study.target} scenario. Other inputs stay fixed.`, 'study-counts'));
    if (report.closestCalibrationRatesMmHr.length) {
      host.append(element('p', `Closest on calibration alone: ${report.closestCalibrationRatesMmHr.map(number).join(', ')} mm/h. Calibration-compatible rates: ${report.compatibleRatesMmHr.length ? report.compatibleRatesMmHr.map(number).join(', ') : 'none'}. Ordering never uses the held-aside residuals.`, 'mini-note'));
    }
    const cards = element('div', undefined, 'study-candidates');
    for (const candidate of report.candidates) {
      const card = element('article', undefined, 'study-candidate');
      card.dataset.rate = String(candidate.rateMmHr);
      card.append(element('h3', `${number(candidate.rateMmHr)} mm/h`));
      for (const [key, name] of [['calibration', 'Calibration'], ['challenge', 'Held aside']]) {
        const metric = candidate[key];
        card.append(element('p', `${name}: ${metric.count ? `${errorNumber(metric.rmseMm)} mm RMSE · ${metric.withinCount}/${metric.count} inside ± bands` : 'no assigned readings'}`, metric.compatible === false ? 'study-mismatch' : 'study-score'));
      }
      card.append(element('p', `Run totals: ${number(candidate.absorbedLiters)} L infiltrated · ${number(candidate.exitLiters)} L edge outflow · ${number(candidate.storedLiters)} L stored.`, 'mini-note'));
      const errors = [...candidate.calibration.errors, ...candidate.challenge.errors];
      if (errors.length) {
        const details = element('details'); details.append(element('summary', 'Inspect reading residuals'));
        const list = element('ul');
        for (const error of errors) {
          const reading = project.observations[error.index];
          const cell = `${String.fromCharCode(65 + reading.cellIndex % project.width)}${Math.floor(reading.cellIndex / project.width) + 1}`;
          list.append(element('li', `${reading.use === 'challenge' ? 'Held aside' : 'Calibration'} · ${cell} at ${reading.minute} min: observed ${number(reading.depthMm)} ± ${number(reading.uncertaintyMm)} mm; predicted ${number(error.depthMm)} mm; observed − predicted ${number(error.residualMm)} mm. ${error.method === 'snapshot' ? 'Solver snapshot.' : `Linear interpolation between ${error.beforeMinute} and ${error.afterMinute} min.`} Source: ${reading.source}`));
        }
        details.append(list); card.append(details);
      }
      cards.append(card);
    }
    host.append(cards);
    host.append(renderEvidenceConflict(project, study, report));
  }
  $('infiltration-form').addEventListener('submit', event => {
    event.preventDefault();
    const text = $('study-rates').value.trim();
    const parts = text.split(',').map(part => part.trim());
    const study = { target: $('study-target').value, surface: $('study-surface').value,
      ratesMmHr: parts.map(part => part === '' ? NaN : Number(part)) };
    try {
      validateStudy(study);
      const project = getProject();
      project.infiltrationStudy = study;
      changed();
      button.disabled = true;
      show(compareInfiltration(project, study), project, study);
    } catch (error) { notice(error.message); }
    finally { button.disabled = false; }
  });
  $('find-infiltration-reading').addEventListener('click', () => {
    try {
      const project = getProject();
      const result = chooseInfiltrationQuestion(project);
      const output = $('infiltration-question');
      question = result.status === 'question' ? result : null;
      $('prepare-infiltration-reading').hidden = !question;
      if (!question) {
        output.textContent = result.status === 'insufficient-alternatives'
          ? 'A separating question needs at least two calibration-compatible rates. Assign calibration readings or revise contradicted assumptions first.'
          : result.status === 'all-recorded'
            ? 'Every retained solver cell/time point has an assigned reading for this scenario. No new point is suggested.'
            : 'The compatible candidates predict the same depths at all evaluated points. This modeled event cannot distinguish those rates.';
        return;
      }
      const cell = `${String.fromCharCode(65 + question.cellIndex % project.width)}${Math.floor(question.cellIndex / project.width) + 1}`;
      output.textContent = `Compare a reading at ${cell}, ${question.minute} min in the ${question.target} scenario. Calibration-compatible predictions span ${number(question.minDepthMm)}–${number(question.maxDepthMm)} mm (${number(question.spanMm)} mm difference): ${question.predictions.map(p => `${number(p.rateMmHr)} mm/h → ${number(p.depthMm)} mm depth`).join('; ')}. Largest difference among ${question.evaluatedCount} unrecorded cell/time points on the ${question.stepMinutes}-minute solver grid; ${question.excludedCount} already recorded points excluded. This is a disagreement heuristic, not expected information gain. Held-aside values do not choose this question. A measurement still needs an appropriate source and tolerance.`;
    } catch (error) { notice(error.message); }
  });
  $('prepare-infiltration-reading').addEventListener('click', () => {
    if (question) prepareReading(question);
  });
  return { refresh };
}


