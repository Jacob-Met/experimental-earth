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
  const strategyLabel = node('label', 'Planning method '), strategy = node('select'); strategy.id = 'complementary-strategy';
  for (const [value, label] of [['greedy', 'Greedy complementary readings'], ['exact-pair', 'Best joint plan of at most two readings']]) {
    const option = node('option', label); option.value = value; strategy.append(option);
  }
  strategyLabel.append(strategy);
  strategy.addEventListener('change', () => { budget.disabled = strategy.value === 'exact-pair'; if (budget.disabled) budget.value = '2'; });
  const scope = node('fieldset'); scope.append(node('legend', 'Optional offered acquisition scope'));
  const scopedLabel = node('label', 'Use only explicitly offered cells and times '), scoped = node('input'); scoped.type = 'checkbox'; scoped.id = 'complementary-scoped'; scopedLabel.append(scoped);
  const cellsLabel = node('label', 'Offered original cells (C2, F6; blank offers none) '), cells = node('input'); cells.id = 'complementary-cells'; cells.maxLength = 3000; cellsLabel.append(cells);
  const startLabel = node('label', 'Earliest event minute '), start = node('input'); start.id = 'complementary-start'; start.type = 'number'; start.min = '0'; start.step = 'any'; start.value = '0'; startLabel.append(start);
  const endLabel = node('label', 'Latest event minute (blank uses original event end) '), end = node('input'); end.id = 'complementary-end'; end.type = 'number'; end.min = '0'; end.step = 'any'; endLabel.append(end);
  const basisLabel = node('label', 'Reason these cells and times are offered '), basis = node('input'); basis.id = 'complementary-scope-basis'; basis.maxLength = 500; basisLabel.append(basis);
  scope.append(scopedLabel, cellsLabel, startLabel, endLabel, basisLabel, node('p', 'This is your declared acquisition availability, not verified physical access. Original native solver times only; unavailable points are not treated as recorded or indistinguishable.'));
  const readAvailability = project => {
    if (!scoped.checked) return undefined;
    if (!start.value.trim()) throw Error('Declare an earliest offered event minute');
    const cellIndices = cells.value.trim() ? cells.value.split(',').map(raw => {
      const match = /^([A-X])([1-9][0-9]?)$/.exec(raw.trim().toUpperCase());
      if (!match) throw Error('Offer original grid labels such as C2, F6');
      const col = match[1].charCodeAt(0) - 65, row = Number(match[2]) - 1;
      if (col >= project.width || row >= project.height) throw Error('An offered cell is outside the original grid');
      return row * project.width + col;
    }) : [];
    return { cellIndices, startMinute: Number(start.value), endMinute: end.value.trim() ? Number(end.value) : project.weather.durationMinutes, basis: basis.value };
  };
  const submit = node('button', 'Plan complementary readings'); submit.type = 'submit';
  form.append(toleranceLabel, strategyLabel, budgetLabel, scope, submit);
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
      const report = planInfiltrationReadings(project, { uncertaintyMm: Number(tolerance.value), maxReadings: Number(budget.value), strategy: strategy.value, availability: readAvailability(project) });
      signature = JSON.stringify(project);
      const ratePair = pair => `${number(report.ratesMmHr[pair.first])} / ${number(report.ratesMmHr[pair.second])} mm/h`;
      if (report.status === 'insufficient-alternatives') output.append(node('p', 'At least two calibration-compatible rates are needed. No reading plan was invented.'));
      else {
        output.append(node('p', `${report.separatedPairCount} of ${report.pairs.length} candidate pairs distinguished by ${report.questions.length} proposed readings at ±${number(report.uncertaintyMm)} mm. ${report.evaluatedCount} unrecorded solver points inspected; ${report.excludedCount} recorded points excluded.`));
        if (report.availability) output.append(node('p', `Declared offered scope: ${report.availability.cellIndices.length} original cells from ${number(report.availability.startMinute)} to ${number(report.availability.endMinute)} min. ${report.offeredCount} native points offered; ${report.unavailableCount} other points unavailable. Basis: ${report.availability.basis}`));
        if (report.status === 'unavailable') output.append(node('p', 'No original native solver point is offered. This does not establish that the alternatives are indistinguishable.'));
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
      if (report.exact) output.append(node('p', `Exact finite coverage optimum among plans of at most two readings: ${report.exact.evaluatedPlans} singleton/pair plans over ${report.exact.candidatePatterns} distinct separation patterns. Equal patterns retain their earliest coordinate; coverage ties prefer fewer readings, then earliest ordered times and cells. This does not optimize travel, cost, or physical feasibility.`));
      else if (strategy.value === 'greedy') output.append(node('p', 'This greedy plan adds the most previously unresolved pairs at each step; ties use earliest time then cell. It is not a global optimum.'));
      output.append(node('p', 'Neither method provides probabilities or assurance that measurements identify the physical soil. Solver time-step and model error remain outside the supplied tolerance. Held-aside values never choose the plan. Preparing a reading does not acquire one; supply its actual value and source.'));
    } catch (error) { notice(error.message); output.append(node('p', error.message)); }
  });
  return { clear };
}
