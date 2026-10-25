import { planInfiltrationReadings } from './complementary-infiltration.js';

const node = (tag, text) => {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  return result;
};
const number = value => Number(value.toPrecision(5)).toString();

/** This optional query is ephemeral; saved evidence is never edited here. */
export function mountComplementaryDepthPanel({ getProject, prepareReading, notice }) {
  const host = node('details'); host.id = 'complementary-depth-plan';
  host.append(node('summary', 'Plan complementary depth readings'));
  host.append(node('p', 'A large overall depth difference can leave two alternatives indistinguishable. Choose a prospective precision and reading budget to seek complementary distinctions among calibration-compatible rates.'));
  const form = node('form');
  const toleranceLabel = node('label', 'Prospective depth tolerance ± mm ');
  const tolerance = node('input'); tolerance.type = 'number'; tolerance.min = '0'; tolerance.max = '1000'; tolerance.step = 'any'; tolerance.value = '1'; tolerance.required = true;
  tolerance.id = 'complementary-tolerance'; toleranceLabel.append(tolerance);
  const budgetLabel = node('label', 'Maximum readings '), budget = node('select'); budget.id = 'complementary-budget';
  for (const value of [1, 2, 3]) { const option = node('option', String(value)); option.value = String(value); budget.append(option); }
  budget.value = '2'; budgetLabel.append(budget);
  const submit = node('button', 'Plan complementary readings'); submit.type = 'submit';
  form.append(toleranceLabel, budgetLabel, submit);
  const output = node('div'); output.id = 'complementary-results'; output.setAttribute('aria-live', 'polite');
  host.append(form, output);
  document.getElementById('infiltration-question').after(host);
  let signature = null;
  const clear = () => { signature = null; output.replaceChildren(); };
  form.addEventListener('input', clear);
  form.addEventListener('change', clear);
  form.addEventListener('submit', event => {
    event.preventDefault(); clear();
    try {
      const project = getProject();
      if (!tolerance.value.trim()) throw Error('Supply a prospective depth tolerance');
      const report = planInfiltrationReadings(project, { uncertaintyMm: Number(tolerance.value), maxReadings: Number(budget.value) });
      signature = JSON.stringify(project);
      const ratePair = pair => `${number(report.ratesMmHr[pair.first])} / ${number(report.ratesMmHr[pair.second])} mm/h`;
      if (report.status === 'insufficient-alternatives') output.append(node('p', 'At least two calibration-compatible rates are needed. No reading plan was invented.'));
      else {
        output.append(node('p', `${report.separatedPairCount} of ${report.pairs.length} candidate pairs distinguished by ${report.questions.length} proposed readings at ±${number(report.uncertaintyMm)} mm. ${report.evaluatedCount} unrecorded solver points inspected; ${report.excludedCount} recorded points excluded.`));
        for (const [index, question] of report.questions.entries()) {
          const article = node('article');
          const cell = `${String.fromCharCode(65 + question.cellIndex % project.width)}${Math.floor(question.cellIndex / project.width) + 1}`;
          article.append(node('h4', `${index + 1}. ${cell} at ${number(question.minute)} min · ${report.target}`));
          article.append(node('p', `Adds ${question.newlySeparatedPairs.length} pair distinctions: ${question.newlySeparatedPairs.map(i => ratePair(report.pairs[i])).join('; ')}.`));
          article.append(node('p', `Predicted depths: ${question.depthsMm.map((depth, i) => `${number(report.ratesMmHr[i])} mm/h → ${number(depth)} mm`).join('; ')}.`));
          const prepare = node('button', `Prepare reading ${index + 1}`); prepare.type = 'button';
          prepare.addEventListener('click', () => {
            if (signature !== JSON.stringify(getProject())) { clear(); notice('The project changed; plan readings again.'); return; }
            prepareReading({ ...question, target: report.target, uncertaintyMm: report.uncertaintyMm });
          });
          article.append(prepare); output.append(article);
        }
        output.append(node('p', report.unresolvedPairs.length ? `Still unresolved within this plan: ${report.unresolvedPairs.map(ratePair).join('; ')}. They remain alternatives; no candidate was removed.` : 'Every pair has disjoint predicted bands at at least one proposed point under the declared precision.'));
      }
      output.append(node('p', 'This greedy plan adds the most previously unresolved pairs at each step; ties use earliest time then cell. It is not a global optimum, probability, or assurance that a measurement will identify the physical soil. Solver time-step and model error remain outside the supplied tolerance. Held-aside values never choose the plan. Preparing a reading does not acquire one; supply its actual value and source.'));
    } catch (error) { notice(error.message); output.append(node('p', error.message)); }
  });
  return { clear };
}
