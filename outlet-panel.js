import { compareOutletScenarios, defaultOutletRates } from './outlet-study.js';
import { INTERVENTION_METRICS } from './intervention-study.js';

const format = n => Number(n.toPrecision(5)).toLocaleString('en-US', { maximumSignificantDigits: 5 });
const node = (tag, value) => {
  const el = document.createElement(tag); el.textContent = value; return el;
};
const locationName = (index, width) =>
  String.fromCharCode(65 + index % width) + (Math.floor(index / width) + 1);

export function mountOutletPanel({ getProject, notice }) {
  const panel = document.createElement('section');
  panel.className = 'panel study';
  panel.id = 'outlet-panel';
  panel.innerHTML = '<h2>Does drainage at the edge change the answer?</h2>' +
    '<p>Try competing <em>hypothetical</em> exterior outlet coefficients under the same storm and two unmodified site arrangements. These coefficients describe a simplified edge sink, not an observed drain capacity.</p>' +
    '<form id="outlet-form"><label class="input-label">Candidate outlet coefficients <span class="unit">per hour</span>' +
    '<input id="outlet-rates" required type="text" maxlength="90" aria-describedby="outlet-help"></label>' +
    '<p id="outlet-help" class="mini-note">Enter 2–7 distinct numbers from 0 to 10, comma-separated. Zero means a modeled closed edge. Every candidate is applied to both sites; the saved project remains untouched.</p>' +
    '<button id="compare-outlets" class="primary" type="submit">Compare edge conditions</button></form>' +
    '<p id="outlet-status" role="status" aria-live="polite"></p><div id="outlet-results"></div>' +
    '<p class="mini-note">Only these declared hypotheses are compared; ranges are not confidence intervals. All values are conceptual model outputs, not evidence of actual drainage or a safe physical intervention. A measurement of the real outlet would be a separate evidence step.</p>';
  document.querySelector('.observations').before(panel);
  const find = id => panel.querySelector('#' + id);
  let lastAuthored;
  function refresh() {
    const current = getProject().weather.boundaryExitPerHour;
    if (lastAuthored !== current) {
      find('outlet-rates').value = defaultOutletRates(getProject().weather).join(', ');
      lastAuthored = current;
    }
    find('outlet-results').replaceChildren();
    find('outlet-status').dataset.state = 'not-compared';
    find('outlet-status').textContent = 'Saved edge coefficient: ' + format(current) +
      '/h. Compare hypotheses to examine whether the proposed effects depend on that assumption.';
  }
  find('outlet-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const raw = find('outlet-rates').value.split(',');
      if (raw.some(s => !s.trim())) throw new Error('Enter comma-separated numeric coefficients without empty entries');
      const ratesPerHour = raw.map(s => Number(s.trim()));
      const report = compareOutletScenarios(getProject(), { ratesPerHour });
      const host = find('outlet-results'); host.replaceChildren();
      find('outlet-status').dataset.state = report.status;
      find('outlet-status').textContent = report.candidateCount +
        ' matched-storm comparisons. Signed effects are proposal minus existing; no coefficient was adopted.';
      const directions = node('ul', '');
      for (const [key, metric] of Object.entries(INTERVENTION_METRICS)) {
        const range = report.metrics[key];
        directions.append(node('li', metric.label + ': ' + format(range.min) +
          ' to ' + format(range.max) + ' ' + metric.unit + '; ' + range.direction + '.'));
      }
      host.append(directions);
      const details = node('details', ''); details.append(node('summary', 'Inspect each modeled outlet condition'));
      for (const candidate of report.candidates) {
        const article = node('article', ''); article.className = 'study-candidate';
        article.dataset.outletRate = String(candidate.ratePerHour);
        article.append(node('h3', format(candidate.ratePerHour) + '/h'));
        for (const [key, metric] of Object.entries(INTERVENTION_METRICS)) {
          const data = candidate.metrics[key];
          article.append(node('p', metric.label + ': existing ' + format(data.existing) +
            ', proposal ' + format(data.proposal) + ' ' + metric.unit +
            '; change ' + format(data.delta) + '.'));
        }
        details.append(article);
      }
      host.append(details);
      host.append(node('h3', report.potentiallyWorseCells.length +
        ' cells have higher modeled peak depth under at least one outlet hypothesis'));
      if (report.potentiallyWorseCells.length) {
        const list = node('details', ''); list.append(node('summary', 'Inspect local depth changes'));
        for (const c of report.potentiallyWorseCells) {
          list.append(node('p', locationName(c.cellIndex, getProject().width) +
            ': ' + format(c.min) + ' to ' + format(c.max) + ' mm; ' + c.direction + '.'));
        }
        host.append(list);
      }
    } catch (error) {
      find('outlet-results').replaceChildren();
      find('outlet-status').dataset.state = 'error';
      find('outlet-status').textContent = error.message;
      notice(error.message);
    }
  });
  return { refresh };
}
