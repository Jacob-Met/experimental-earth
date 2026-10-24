import { validateProject } from './core.js';
import { makeEventChallenge, reopenEventChallenge } from './event-challenge.js';

const node = (tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n; };
export function mountEventChallengePanel({ getProject }) {
  const root = node('section'); root.className = 'panel study'; root.id = 'event-challenge';
  root.innerHTML = `<h2>Do the hypotheses survive another storm?</h2>
    <p>Compare the current calibration event with a saved second project from the same observed scenario. Mark its readings “Held aside” before exporting it. Terrain, surface and non-weather modeling assumptions must match. Distinct references are your declaration of separate events, not verified independence.</p>
    <div class="input-pair"><label class="input-label">Current calibration event reference<input id="event-first-ref" maxlength="200" placeholder="Site log / date / storm ID"></label><label class="input-label">Second event reference<input id="event-second-ref" maxlength="200" placeholder="Separate site log / date / storm ID"></label></div>
    <label class="input-label">Second storm project JSON<input id="event-project-file" type="file" accept=".json,application/json"></label>
    <p id="event-file-name" class="mini-note">No second event loaded.</p>
    <div class="obs-actions"><button id="event-compare" type="button">Challenge current hypotheses</button><button id="event-export" type="button" disabled>Export two-event evidence</button></div>
    <label class="input-label">Reopen two-event evidence JSON<input id="event-bundle-file" type="file" accept=".json,application/json"></label>
    <p id="event-status" role="status" aria-live="polite"></p><div id="event-results"></div>`;
  document.querySelector('.observations').before(root);
  const $ = id => root.querySelector(`#${id}`);
  let second = null, bundle = null, context = JSON.stringify(getProject()), generation = 0;
  function clear(message) {
    bundle = null; $('event-export').disabled = true; $('event-results').replaceChildren(); $('event-status').textContent = message;
  }
  function render(value, historical = false) {
    const result = reopenEventChallenge(value);
    bundle = value; $('event-export').disabled = false;
    $('event-status').textContent = `${historical ? 'Reopened saved evidence (separate from the current workspace). ' : ''}${result.survivingRatesMmHr.length} candidate(s) survive both events: ${result.survivingRatesMmHr.join(', ') || 'none'} mm/h. ${result.limitation}`;
    const out = $('event-results'); out.replaceChildren();
    out.append(node('p', `${result.calibrationReference} → ${result.challengeReference}. Order is determined only by first-event calibration. ${result.counts.second.challenge} second-event readings used; ${result.counts.second.ignored} excluded.`));
    for (const c of result.candidates) {
      const detail = node('details'); detail.append(node('summary', `${c.rateMmHr} mm/h · first-event calibration RMSE ${c.calibration.rmseMm.toFixed(3)} mm · second-event RMSE ${c.secondEvent.rmseMm.toFixed(3)} mm · ${c.survives ? 'survives stated bands' : 'contradicted'}`));
      detail.append(node('p', `Readings within stated bands: first-event calibration ${c.calibration.withinCount}/${c.calibration.count}; first-event holdout ${c.challenge.withinCount}/${c.challenge.count}; second-event holdout ${c.secondEvent.withinCount}/${c.secondEvent.count}. A failed band in any used group rejects the candidate; RMSE alone does not establish compatibility.`));
      for (const e of c.secondEvent.errors) {
        const reading = value.challengeProject.observations[e.index];
        detail.append(node('p', `Cell ${reading.cellIndex + 1}, ${reading.minute} min: observed ${reading.depthMm} ± ${reading.uncertaintyMm} mm; predicted ${e.depthMm.toFixed(3)} mm; observed minus predicted ${e.residualMm.toFixed(3)} mm (${e.withinBand ? 'within' : 'outside'} band). ${e.method}, bracket ${e.beforeMinute}–${e.afterMinute} min. Source: ${reading.source}`));
      }
      out.append(detail);
    }
  }
  async function readFile(event, accept) {
    const file = event.target.files?.[0]; if (!file) return;
    const ticket = ++generation, before = JSON.stringify(getProject());
    try {
      if (file.size > 2_000_000) throw Error('File exceeds 2 MB limit');
      const parsed = JSON.parse(await file.text());
      if (ticket !== generation || before !== JSON.stringify(getProject())) throw Error('Workspace changed while reading; select the file again');
      accept(parsed, file.name);
    } catch (error) { if (ticket === generation) $('event-status').textContent = `Import refused: ${error.message}. Previously accepted evidence remains unchanged.`; }
    finally { if (ticket === generation) event.target.value = ''; }
  }
  $('event-project-file').addEventListener('change', e => readFile(e, (p, name) => {
    validateProject(p); second = structuredClone(p); clear('Second event loaded. Compare to check compatibility.'); $('event-file-name').textContent = name;
  }));
  $('event-bundle-file').addEventListener('change', e => readFile(e, p => { reopenEventChallenge(p); render(structuredClone(p), true); }));
  for (const id of ['event-first-ref', 'event-second-ref']) $(id).addEventListener('input', () => { generation++; clear('References changed. Compare again.'); });
  $('event-compare').addEventListener('click', () => {
    generation++;
    clear('');
    try {
      if (!second) throw Error('Load a second storm project first');
      const p = getProject();
      if (!p.infiltrationStudy) throw Error('Compare rate hypotheses above to choose the calibration study first');
      render(makeEventChallenge(p, second, p.infiltrationStudy, { calibration: $('event-first-ref').value, challenge: $('event-second-ref').value }));
    } catch (error) { $('event-status').textContent = `Comparison refused: ${error.message}`; }
  });
  $('event-export').addEventListener('click', () => {
    if (!bundle) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], {type:'application/json'}));
    const link = node('a'); link.href = url; link.download = 'experimental-earth-two-events.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(url), 500);
  });
  return { refresh() {
    const next = JSON.stringify(getProject());
    if (context !== next) { context = next; generation++; clear('Workspace changed. Compare again to use current assumptions.'); }
  } };
}
