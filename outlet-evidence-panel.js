import { validateProject } from './core.js';
import { appendOutletReading, compareOutletEvidence } from './outlet-evidence.js';
import { outletContext, OUTLET_UNITS } from './outlet-evidence-contract.js';
const number = n => n !== 0 && (Math.abs(n) < 0.0001 || Math.abs(n) >= 1e9)
  ? Number(n).toExponential(3) : Number(n).toLocaleString('en-US', { maximumSignificantDigits: 6 });
const node = (tag, text) => { const element = document.createElement(tag); element.textContent = text; return element; };
const defaults = [0, 0.38, 1.2];

export function mountOutletEvidence({ getProject, replaceProject, notice }) {
  const panel = document.createElement('section'); panel.id = 'outlet-evidence-panel'; panel.className = 'panel study';
  panel.innerHTML = `<div class="section-heading"><div><span class="eyebrow">COLLECTED RUNOFF</span><h2>Which outlet assumptions explain the collected water?</h2></div></div>
    <p class="muted">Compare measured volumes with the model's total edge outflow over the same collection interval. Keep the observed site and event fixed while testing explicit outlet coefficients.</p>
    <details id="outlet-entry"><summary>Add a sourced collection</summary>
    <form id="outlet-reading-form">
      <div class="input-pair"><label class="input-label">Observed scenario<select id="outlet-target"><option value="existing">Existing site</option><option value="proposal">Proposed site</option></select></label><label class="input-label">Event reference<input id="outlet-event" maxlength="200" required placeholder="Date / event record"></label></div>
      <label class="input-label">Collection arrangement / coverage source<input id="outlet-collection" maxlength="400" required placeholder="How all modeled boundary exits were collected"></label>
      <label class="mini-note outlet-coverage"><input id="outlet-coverage" type="checkbox" required> <span>This collection represents all modeled boundary exits. A single drain or partial edge collection is a different quantity.</span></label>
      <div class="input-pair"><label class="input-label">Collection start <span class="unit">minutes since event start</span><input id="outlet-start" type="number" min="0" max="720" step="any" value="0" required></label><label class="input-label">Collection end <span class="unit">minutes since event start</span><input id="outlet-end" type="number" min="0" max="720" step="any" value="60" required></label></div>
      <div class="study-fields"><label class="input-label">Collected volume<input id="outlet-volume" type="number" min="0" step="any" required></label><label class="input-label">± stated tolerance<input id="outlet-uncertainty" type="number" min="0" step="any" required></label><label class="input-label">Units for both<select id="outlet-unit"><option value="L">Liters (L)</option><option value="mL">Milliliters (mL)</option><option value="m3">Cubic meters (m³)</option></select></label></div>
      <div class="input-pair"><label class="input-label">Reading source / method<input id="outlet-source" maxlength="300" required placeholder="Collection record and measurement method"></label><label class="input-label">Evidence role<select id="outlet-use"><option value="unassigned">Notebook only</option><option value="calibration">Calibration</option><option value="challenge">Held aside</option></select></label></div>
      <button type="submit" class="primary">Retain collected volume</button>
    </form></details>
    <p id="outlet-context" class="mini-note"></p><div id="outlet-readings" class="history"></div>
    <label class="input-label">Outlet coefficients to compare <span class="unit">per hour</span><input id="outlet-rates" type="text" maxlength="150" value="0, 0.38, 1.2"></label>
    <p class="mini-note">Enter 2–9 distinct coefficients from 0 to 10. These describe the simplified model's edge sink, not a measured drain capacity. Compare uses current numerical step size; it never changes the site's outlet setting.</p>
    <button id="outlet-compare" type="button" class="primary">Compare collected-volume evidence</button>
    <p id="outlet-status" role="status" aria-live="polite"></p><div id="outlet-results"></div>
    <p class="mini-note">Volumes and source attribution are supplied by you. A stated ± band is an acceptance tolerance. Calibration RMSE orders candidates; held-aside readings never change that order. Assigning that role does not establish independent or prospective collection; using a result to choose candidates makes it part of fitting. Overlapping collection intervals are correlated. Snapshot interpolation and omitted drainage physics can cause mismatch; passing these comparisons does not establish physical calibration.</p>`;
  document.querySelector('.observations').before(panel);
  const find = id => panel.querySelector(`#${id}`);
  const rates = () => find('outlet-rates').value.split(',').map(value => value.trim() === '' ? NaN : Number(value));
  function status(state, message) {
    find('outlet-status').dataset.state = state; find('outlet-status').textContent = message;
  }
  function save(next) { validateProject(next); replaceProject(next); }
  function invalidate() {
    find('outlet-results').replaceChildren(); status('not-compared', 'Compare the saved readings with the current candidate coefficients.');
  }
  function refresh() {
    const project = getProject(), record = project.outletEvidence;
    invalidate();
    for (const id of ['outlet-target', 'outlet-event', 'outlet-collection', 'outlet-coverage']) find(id).disabled = !!record;
    find('outlet-start').max = String(record?.durationMinutes ?? project.weather.durationMinutes);
    find('outlet-end').max = String(record?.durationMinutes ?? project.weather.durationMinutes);
    if (record) {
      find('outlet-target').value = record.target; find('outlet-event').value = record.eventRef;
      find('outlet-collection').value = record.collectionSource; find('outlet-coverage').checked = true;
      find('outlet-rates').value = record.ratesPerHour.join(', ');
      find('outlet-context').textContent = `${record.eventRef} · ${record.target} site · all modeled edges · ${record.collectionSource}. Event and collection identity stay fixed while these readings are retained.`;
      if (record.contextJson !== outletContext(project, record.target)) {
        status('context-changed', 'The observed site or weather changed. The original source context is retained with these readings; comparisons and new readings are paused until that context is restored or a separate study is started. Export to keep this record.');
      }
    } else {
      find('outlet-context').textContent = 'No collected-volume evidence retained. The first reading binds this record to its declared site, event and collection arrangement.';
    }
    const host = find('outlet-readings'); host.replaceChildren();
    for (const [index, reading] of (record?.readings ?? []).entries()) {
      const row = node('article', ''); row.className = 'observation';
      const info = node('div', '');
      info.append(node('strong', `${reading.startMinute}–${reading.endMinute} min · ${number(reading.volume)} ± ${number(reading.uncertainty)} ${reading.unit}`));
      info.append(node('small', `${reading.source} · ${number(reading.volume * OUTLET_UNITS[reading.unit])} L converted`));
      const label = node('label', 'Evidence role '); const select = node('select', '');
      select.setAttribute('aria-label', `Evidence role for collection ${index + 1}`);
      for (const [value, text] of [['unassigned', 'Notebook only'], ['calibration', 'Calibration'], ['challenge', 'Held aside']]) {
        const option = node('option', text); option.value = value; select.append(option);
      }
      select.value = reading.use; select.addEventListener('change', () => {
        const next = structuredClone(getProject()); next.outletEvidence.readings[index].use = select.value; save(next);
      });
      label.append(select); info.append(label);
      const remove = node('button', 'Remove'); remove.type = 'button'; remove.setAttribute('aria-label', `Remove collection ${index + 1}`);
      remove.addEventListener('click', () => {
        const next = structuredClone(getProject()); next.outletEvidence.readings.splice(index, 1);
        if (!next.outletEvidence.readings.length) delete next.outletEvidence;
        save(next);
      });
      row.append(info, remove); host.append(row);
    }
  }
  find('outlet-rates').addEventListener('input', invalidate);
  find('outlet-reading-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const settings = { target: find('outlet-target').value, eventRef: find('outlet-event').value.trim(),
        collectionSource: find('outlet-collection').value.trim(), coverage: find('outlet-coverage').checked ? 'all-modeled-edges' : 'partial',
        ratesPerHour: rates() };
      const reading = { startMinute: Number(find('outlet-start').value), endMinute: Number(find('outlet-end').value),
        volume: Number(find('outlet-volume').value), uncertainty: Number(find('outlet-uncertainty').value), unit: find('outlet-unit').value,
        source: find('outlet-source').value.trim(), use: find('outlet-use').value };
      save(appendOutletReading(getProject(), settings, reading));
      find('outlet-volume').value = ''; find('outlet-source').value = '';
      notice('Collected volume retained with its event and collection source.');
    } catch (error) { status('error', error.message); notice(error.message); }
  });
  find('outlet-compare').addEventListener('click', () => {
    try {
      const project = getProject(), chosenRates = rates();
      const report = compareOutletEvidence(project, chosenRates);
      const next = structuredClone(project); next.outletEvidence.ratesPerHour = chosenRates; save(next);
      const messages = {
        'context-changed': 'The retained readings belong to a different site or weather context. No hypotheses were scored.',
        'work-limit': `Comparison not run: ${report.cellSteps ?? 0} estimated cell-steps exceeds the interactive limit.`,
        'need-calibration': 'No calibration readings assigned. Candidates are shown in coefficient order; held-aside values did not rank them.',
        'calibration-rejected': 'Every candidate misses at least one calibration band. The closest fit is still contradicted.',
        'challenged': 'Held-aside evidence contradicts every calibration-compatible candidate.',
        'needs-challenge': 'Calibration-compatible candidates remain; no held-aside collection has challenged them.',
        'one-survivor': 'One of these finite candidates meets all assigned bands. That does not establish a unique physical outlet condition.',
        'ambiguous': 'Several candidates meet the assigned bands. Keep that ambiguity visible.' };
      status(report.status, messages[report.status]);
      const host = find('outlet-results'); host.replaceChildren();
      if (!report.candidates.length) return;
      host.append(node('p', `${report.counts.calibration} calibration, ${report.counts.challenge} held aside, ${report.counts.ignored} notebook-only readings. Calculation interval ${report.stepMinutes} min.`));
      host.append(node('p', `Within all calibration bands: ${report.compatibleRatesPerHour.join(', ') || 'none'}. Also within every available held-aside band: ${report.survivingRatesPerHour.join(', ') || 'none'}.`));
      for (const candidate of report.candidates) {
        const card = node('article', ''); card.className = 'study-candidate'; card.dataset.outletRate = candidate.ratePerHour;
        card.append(node('h3', `${candidate.ratePerHour} per hour`));
        for (const [key, title] of [['calibration', 'Calibration'], ['challenge', 'Held aside']]) {
          const group = candidate[key]; const summary = node('p', `${title}: ${group.count} readings · RMSE ${group.rmseLiters === null ? 'unscored' : number(group.rmseLiters) + ' L'} · ${group.compatible === null ? 'unassigned' : group.compatible ? 'all within bands' : 'outside a band'}.`); card.append(summary);
          const details = node('details', ''); details.append(node('summary', `Inspect ${title.toLowerCase()} intervals`));
          for (const error of group.errors) {
            const reading = project.outletEvidence.readings[error.index];
            details.append(node('p', `${reading.startMinute}–${reading.endMinute} min · ${reading.source} · observed ${number(error.observedLiters)} ± ${number(error.uncertaintyLiters)} L; modeled ${number(error.volumeLiters)} L; observed minus modeled ${number(error.residualLiters)} L · ${error.withinBand ? 'within' : 'outside'} band. Start uses ${error.start.beforeMinute}–${error.start.afterMinute} min (${error.start.method}); end uses ${error.end.beforeMinute}–${error.end.afterMinute} min (${error.end.method}).`));
          }
          card.append(details);
        }
        host.append(card);
      }
    } catch (error) { find('outlet-results').replaceChildren(); status('error', error.message); notice(error.message); }
  });
  return { refresh };
}
