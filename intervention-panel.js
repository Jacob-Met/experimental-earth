import { compareIntervention, INTERVENTION_METRICS } from './intervention-study.js';
import { DEFAULT_STUDY } from './study-contract.js';
const number = n => Number(n.toPrecision(5)).toLocaleString('en-US', { maximumSignificantDigits: 5 });
const node = (tag, text) => { const e = document.createElement(tag); e.textContent = text; return e; };
export function mountInterventionPanel({ getProject, notice }) {
  const panel = document.createElement('section'); panel.className = 'panel study'; panel.id = 'intervention-panel';
  panel.innerHTML = `<h2>Does the proposal still help?</h2><p>Carry the saved infiltration hypotheses into paired existing/proposed simulations. Each rate applies to that surface in both places; other surface rates and the weather stay fixed. This assumes the same surface capacity transfers between scenarios.</p><label class="input-label">Hypotheses to compare<select id="intervention-subset"><option value="all">All saved candidates (no evidence filter)</option><option value="calibration">Within all calibration bands</option><option value="surviving">Within calibration and held-aside bands</option></select></label><p id="intervention-choices" class="mini-note"></p><button type="button" id="compare-intervention" class="primary">Compare proposal across rates</button><p id="intervention-status" role="status"></p><div id="intervention-results"></div><p class="mini-note">Ranges span only these finite hypotheses, not confidence intervals or bounds on reality. Lower outflow, storage and depth are separate objectives; no overall winner is declared. Peak depths may occur at different times. Changed soils, unmodeled processes and numerical time-step sensitivity remain outside this comparison. No rate is adopted.</p>`;
  document.querySelector('.observations').before(panel);
  const find = id => panel.querySelector(`#${id}`);
  function refresh() {
    const study = getProject().infiltrationStudy ?? DEFAULT_STUDY;
    find('intervention-choices').textContent = `Saved ${study.surface} candidates: ${study.ratesMmHr.join(', ')} mm/h. Evidence scenario: ${study.target}. Change and compare the investigation above to save different choices.`;
    find('intervention-results').replaceChildren(); find('intervention-status').dataset.state = 'not-compared';
    find('intervention-status').textContent = 'Compare the current proposal to inspect effects across hypotheses.';
  }
  find('intervention-subset').addEventListener('change', refresh);
  find('compare-intervention').addEventListener('click', () => {
    try {
      const project = getProject(); const report = compareIntervention(project, { subset: find('intervention-subset').value });
      const host = find('intervention-results'); host.replaceChildren();
      find('intervention-status').dataset.state = report.status;
      const refusals = { 'need-calibration': 'Assign calibration readings before filtering.', 'need-challenge': 'Assign held-aside readings before requiring a held-aside check.', 'no-compatible-rates': 'No rates meet these evidence bands. Do not substitute the closest fit.', 'surface-absent': 'This surface is absent from both scenarios.' };
      find('intervention-status').textContent = refusals[report.status] ?? `${report.candidates.length} paired hypotheses compared. Signed effects are proposal minus existing.`;
      if (report.status !== 'compared') return;
      host.append(node('p', `${report.affected.existing} existing and ${report.affected.proposal} proposed ${report.surface} cells receive each rate. Evidence filters refer only to the ${report.evidenceTarget} scenario.`));
      const list = node('ul', '');
      for (const [key, metric] of Object.entries(INTERVENTION_METRICS)) {
        const range = report.metrics[key]; list.append(node('li', `${metric.label}: ${number(range.min)} to ${number(range.max)} ${metric.unit}; ${range.direction}.`));
      }
      host.append(list);
      const details = node('details', ''); details.append(node('summary', 'Inspect each paired hypothesis'));
      for (const c of report.candidates) {
        const card = node('article', ''); card.className = 'study-candidate'; card.dataset.rate = c.rateMmHr;
        card.append(node('h3', `${c.rateMmHr} mm/h`));
        for (const [key, metric] of Object.entries(INTERVENTION_METRICS)) card.append(node('p', `${metric.label}: ${number(c.metrics[key].existing)} → ${number(c.metrics[key].proposal)} ${metric.unit}; change ${number(c.metrics[key].delta)}.`));
        details.append(card);
      }
      host.append(details);
      host.append(node('h3', `${report.cells.length} cells deepen under at least one hypothesis`));
      host.append(node('p', 'Local peak-depth changes can differ from site totals. All listed locations are model outputs.'));
      const cells = node('details', ''); cells.append(node('summary', 'Inspect affected cells'));
      for (const c of report.cells) cells.append(node('p', `${String.fromCharCode(65 + c.cellIndex % project.width)}${Math.floor(c.cellIndex / project.width) + 1}: ${number(c.min)} to ${number(c.max)} mm; ${c.direction}.`));
      host.append(cells);
    } catch (error) { find('intervention-results').replaceChildren(); find('intervention-status').dataset.state = 'error'; find('intervention-status').textContent = error.message; notice(error.message); }
  });
  return { refresh };
}
