import { planHeatColumnQuestion } from './heat-column-question.js';
const node = (tag, text = '') => { const e = document.createElement(tag); e.textContent = text; return e; };
const format = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 4 });
export function mountHeatColumnQuestion({ getProject }) {
  const panel = node('section'); panel.className = 'panel study'; panel.id = 'heat-column-question';
  panel.innerHTML = `<span class="eyebrow">HEAT / NEXT SURFACE READING</span><h2>When could a surface reading distinguish hidden stores?</h2><p>Compare prospective instantaneous surface readings across calibration-compatible lower-store alternatives. Challenge values do not choose the question. Existing reading times and averaging windows are excluded.</p><form id="column-question-form"><label class="input-label">Window starts · minutes<input id="column-question-from" type="number" min="0" step="any" value="0" required></label><label class="input-label">Window ends · minutes<input id="column-question-to" type="number" min="0" step="any" required></label><label class="input-label">Evenly spaced candidate times<input id="column-question-count" type="number" min="2" max="241" value="121" required></label><label class="input-label">Prospective band half-width · °C<input id="column-question-width" type="number" min="0" max="100" step="any" value="0.25" required></label><button type="submit">Find a surface reading question</button></form><p id="column-question-status" role="status"></p><div id="column-question-result"></div>`;
  document.getElementById('heat-column-evidence').after(panel);
  const $ = id => panel.querySelector('#' + id); let signature = '';
  const clear = message => { $('column-question-result').replaceChildren(); $('column-question-status').textContent = message; $('column-question-status').dataset.state = 'not-compared'; };
  $('column-question-form').addEventListener('input', () => clear('Question settings changed. Compare again.'));
  $('column-question-form').onsubmit = event => {
    event.preventDefault(); clear('');
    try {
      const snapshot = JSON.stringify(getProject());
      const r = planHeatColumnQuestion(getProject(), { fromMinute: Number($('column-question-from').value), toMinute: Number($('column-question-to').value), sampleCount: Number($('column-question-count').value), halfWidthC: Number($('column-question-width').value) });
      if (snapshot !== JSON.stringify(getProject())) return clear('The original investigation changed. Compare again.');
      $('column-question-status').dataset.state = r.status;
      const messages = { 'no-evidence': 'Save the two-store surface evidence first.', 'context-changed': 'The saved evidence no longer matches this place or exposure.', 'need-calibration': 'Supply calibration readings before choosing a question.', 'calibration-rejected': 'No offered alternative agrees with calibration.', 'one-alternative': 'Only one offered alternative remains; there is no retained pair to distinguish.', 'no-unrecorded-time': 'Every requested time overlaps an existing reading.', 'no-separating-time': 'No sampled time separates a retained pair at this prospective precision.', question: 'A prospective question is available. No measurement has been created.' };
      $('column-question-status').textContent = messages[r.status] ?? r.status;
      if (!r.best) return;
      const host = $('column-question-result'), best = r.best;
      host.append(node('h3', `${format(best.minute)} minutes · ${r.target} place · cell index ${r.cellIndex}`));
      host.append(node('p', `${best.separatedCount} of ${best.pairs.length} retained pairs have disjoint prospective bands. Examined ${r.inspectedCount} times; excluded ${r.excludedCount} recorded supports. Band half-width: ${format(r.settings.halfWidthC)} °C.`));
      host.append(node('p', 'Original association: ' + r.associationSource));
      const list = node('ul');
      for (const p of best.predictions) list.append(node('li', `${p.label}: ${format(p.temperatureC)} °C; prospective band ${format(p.temperatureC-r.settings.halfWidthC)}–${format(p.temperatureC+r.settings.halfWidthC)} °C. Basis: ${p.source}`));
      host.append(list);
      const details = node('details'); details.append(node('summary', 'Inspect every retained pair'));
      const pairs = node('ul'); for (const p of best.pairs) pairs.append(node('li', `${p.labels.join(' / ')}: ${p.separated ? 'separated' : 'unresolved'}; prediction gap ${format(p.gapC)} °C; arithmetic allowance ${p.guardC} °C.`)); details.append(pairs); host.append(details, node('p', r.semantics));
      host.append(node('p', 'This is a proposed instantaneous surface reading under the original exposure and association. Use the existing evidence form only after obtaining an actual value and source. The saved project is unchanged.'));
    } catch (error) { clear(error.message); $('column-question-status').dataset.state = 'refused'; }
  };
  return { refresh() { const next = JSON.stringify(getProject()); if (next === signature) return; signature = next; const duration = getProject().heatColumnEvidence?.columnStudy.heatStudy.schedule.reduce((s, r) => s + r.minutes, 0); $('column-question-to').value = duration ?? ''; clear('Choose a window and prospective precision, then compare the saved alternatives.'); } };
}
