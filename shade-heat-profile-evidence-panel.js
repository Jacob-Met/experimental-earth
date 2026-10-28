import { checkShadeHeatBytes } from './shade-heat.js';
import { createShadeHeatComputation } from './shade-heat-computation.js';

const node = (tag, text = '') => { const el = document.createElement(tag); el.textContent = text; return el; };
const number = value => value !== 0 && Math.abs(value) < .000001 ? value.toExponential(5)
  : Number(value).toLocaleString('en-US', { maximumSignificantDigits: 8 });
const signed = value => (value > 0 ? '+' : '') + number(value);
const stores = [['surfaceC', 'Ground surface'], ['subsurfaceC', 'Lower heat store']];

export function mountShadeHeatProfileEvidence({ host, getAccepted, cancelParentPending, notice }) {
  const style = node('link'); style.rel = 'stylesheet';
  style.href = new URL('./shade-heat-profile-evidence.css', import.meta.url); document.head.append(style);
  const panel = node('section'); panel.id = 'shade-profile-evidence';
  panel.innerHTML = '<h4>Constrain the sky with a temperature reading</h4>'
    + '<p>Supply one attributed surface-temperature band for the existing design at this investigation’s saved receiver and final time. Keep every shared sky mixture compatible with that band, then compare both designs under those same mixtures.</p>'
    + '<p id="shade-profile-evidence-source" class="mini-note"></p>'
    + '<div class="profile-evidence-fields"><label class="input-label">Original surface reading · °C<input id="shade-profile-evidence-temperature" type="number" step="any" min="-100" max="500" required></label>'
    + '<label class="input-label">Original half-width · ±°C<input id="shade-profile-evidence-width" type="number" step="any" min="0" max="600" required></label>'
    + '<label class="input-label">Equal sky bins<select id="shade-profile-evidence-bins"><option>4</option><option selected>8</option><option>16</option></select></label>'
    + '<label class="input-label profile-evidence-attribution">Original reading source<input id="shade-profile-evidence-attribution" maxlength="400" required placeholder="Record, sensor, date and basis for this band; label authored controls"></label></div>'
    + '<div class="profile-evidence-actions"><button id="shade-profile-evidence-run" type="button" disabled>Compare supplied band</button>'
    + '<label class="shade-file">Reopen original reading inquiry<input id="shade-profile-evidence-import" type="file" accept=".json,application/json"></label>'
    + '<button id="shade-profile-evidence-export" type="button" disabled>Download original reading inputs</button></div>'
    + '<p class="mini-note">Use a completed shared-profile inquiry above, or reopen this inquiry’s original inputs. Fixed materials, starting temperatures and weather remain part of the model; this is a compatibility test, not a measured-sky reconstruction.</p>'
    + '<p class="mini-note"><a href="sky-spatial-evidence.html" target="_blank" rel="noopener">Use two original readings to constrain one shared sky ↗</a></p>'
    + '<p id="shade-profile-evidence-status" role="status"></p><div id="shade-profile-evidence-results"></div>';
  host.append(panel);
  const $ = id => panel.querySelector('#shade-profile-evidence-' + id);
  const computation = createShadeHeatComputation(() => new Worker(
    new URL('./shade-heat-profile-evidence-worker.js', import.meta.url), { type: 'module' }));
  let accepted = null, retainedSource = null, sourceMode = '', generation = 0, reading = false, selected = 0;
  const pending = () => reading || computation.pending;
  const source = () => retainedSource ?? getAccepted()?.investigation.source ?? null;
  function state(message, kind) { $('status').textContent = message; $('status').dataset.state = kind; }
  function labelSource(original) {
    if (!original) return 'Complete a shared-profile comparison or reopen original reading inputs.';
    const p = original.project, cell = p.heatColumnStudy.heatStudy.cellIndex;
    const label = String.fromCharCode(65 + cell % p.width) + (Math.floor(cell / p.width) + 1);
    return p.title + ' · ' + p.width + ' × ' + p.height + ' original grid · existing ground surface at saved point '
      + label + ' · final UTC ' + original.declaration.path.endUtc + '.';
  }
  function controls() {
    $('run').disabled = pending() || !source(); $('export').disabled = pending() || !accepted;
    $('source').textContent = labelSource(source());
  }
  function invalidate(message = 'Supply the original temperature band and attribution.', keepSource = false) {
    generation++; reading = false; computation.cancel(); accepted = null; selected = 0;
    if (!keepSource) {
      retainedSource = null; sourceMode = '';
      for (const field of ['temperature', 'width', 'attribution']) $(field).value = '';
      $('bins').value = String(getAccepted()?.investigation.query.bins ?? 8);
    }
    $('results').replaceChildren(); controls(); state(message, 'not-compared');
  }
  function receive(next, mode) {
    accepted = next; retainedSource = next.investigation.source; sourceMode = mode; reading = false;
    const q = next.investigation.query;
    $('temperature').value = String(q.reading.temperatureC); $('width').value = String(q.reading.halfWidthC);
    $('attribution').value = q.reading.source; $('bins').value = String(q.bins);
    selected = next.report.ranges?.surfaceC.lower.witnessId ?? 0;
    draw(); controls();
    state(next.report.compatibility === 'compatible'
      ? 'Shared sky mixtures are compatible with the supplied band. The same mixtures constrain both design comparisons.'
      : 'No shared sky profile in this declared coefficient family meets the supplied band. The original reading and model are retained.', next.report.compatibility);
  }
  function readQuery(original) {
    if (!$('temperature').value.trim() || !$('width').value.trim() || !$('attribution').value.trim())
      throw Error('Enter the original temperature, half-width and reading source');
    return { bins: Number($('bins').value), reading: {
      target: 'existing', store: 'surfaceC', aggregation: 'instant',
      cellIndex: original.project.heatColumnStudy.heatStudy.cellIndex,
      utc: original.declaration.path.endUtc, temperatureC: Number($('temperature').value),
      halfWidthC: Number($('width').value), source: $('attribution').value,
    } };
  }
  for (const field of ['temperature', 'width', 'attribution', 'bins']) $(field).addEventListener('input', () => {
    cancelParentPending();
    if (!retainedSource) { retainedSource = source(); sourceMode = 'Accepted original shared-profile source'; }
    invalidate('Reading inputs changed. Compare again using the same original source.', true);
  });
  $('run').addEventListener('click', async () => {
    cancelParentPending();
    const original = source(); if (!original) return;
    const mode = retainedSource ? sourceMode : 'Accepted original shared-profile source';
    retainedSource = original; sourceMode = mode;
    try {
      const query = readQuery(original);
      invalidate('Recomputing the complete original basis and every compatible profile intersection…', true);
      const request = generation;
      try {
        const promise = computation.compute({ operation: 'prepare', project: original.project,
          declaration: original.declaration, query }); controls();
        const next = await promise;
        if (request === generation) receive(next, mode);
      } catch (error) {
        if (request === generation && error.code !== 'superseded') { state(error.message, 'refused'); notice(error.message); }
      } finally { if (request === generation) controls(); }
    } catch (error) { invalidate(error.message, true); state(error.message, 'refused'); notice(error.message); }
  });
  $('import').addEventListener('change', async () => {
    const file = $('import').files?.[0]; if (!file) return; $('import').value = '';
    cancelParentPending(); computation.cancel();
    const request = ++generation; reading = true; controls();
    state('Reading and recomputing original temperature-band inputs…', 'file-pending');
    try {
      checkShadeHeatBytes(file.size);
      const bytes = await file.arrayBuffer(); if (request !== generation) return;
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      const next = await computation.compute({ operation: 'parse', text });
      if (request === generation) receive(next, 'Reopened original reading inquiry');
    } catch (error) {
      if (request === generation && error.code !== 'superseded') {
        state('File refused: ' + error.message + (accepted ? ' The prior accepted inquiry is retained.' : ' No reading inquiry is accepted.'), 'file-refused');
        notice(error.message);
      }
    } finally { if (request === generation) { reading = false; controls(); } }
  });
  $('export').addEventListener('click', () => {
    if (!accepted || pending()) return;
    try {
      const text = JSON.stringify(accepted.investigation, null, 2); checkShadeHeatBytes(new Blob([text]).size);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = node('a'); link.href = url; link.download = 'experimental-earth-shared-sky-final-reading-inputs.json';
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { state(error.message, 'refused'); notice(error.message); }
  });
  function table(caption, headings, rows) {
    const wrap = node('div'); wrap.className = 'profile-evidence-table'; wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', caption);
    const el = node('table'); el.append(node('caption', caption)); const head = node('thead'), tr = node('tr');
    for (const heading of headings) { const th = node('th', heading); th.scope = 'col'; tr.append(th); }
    head.append(tr); el.append(head); const body = node('tbody');
    for (const row of rows) { const tr = node('tr'); for (const value of row) {
      const td = node('td'); if (value instanceof Node) td.append(value); else td.textContent = String(value); tr.append(td);
    } body.append(tr); }
    el.append(body); wrap.append(el); return wrap;
  }
  function witnessButton(store, bound) {
    const id = accepted.report.ranges[store][bound].witnessId, button = node('button', 'Inspect mixture ' + (id + 1)); button.type = 'button';
    button.dataset.store = store; button.dataset.bound = bound;
    button.setAttribute('aria-label', 'Inspect ' + stores.find(s => s[0] === store)[1].toLowerCase() + ' ' + (bound === 'lower' ? 'minimum' : 'maximum') + ' compatible profile');
    button.addEventListener('click', () => { selected = id; $('witness-select').value = String(id); drawWitness(); $('witness').scrollIntoView({ block: 'nearest' }); });
    return button;
  }
  function drawWitness() {
    const r = accepted.report, w = r.witnesses[selected], host = $('witness'); host.replaceChildren();
    host.dataset.witness = String(w.id); host.dataset.support = w.support.join(',');
    host.append(node('h5', 'Compatible mixture ' + (w.id + 1)), node('p', 'Computed existing reading: approximately '
      + number(w.observedC.lower) + ' °C. One shared profile supplies every endpoint below.'));
    host.append(table('Nonzero shared sky masses', ['Bin · grid heading', 'Fraction of diffuse brightness · approximately'], w.support.map(bin => [
      (bin + 1) + ' · ' + bin * 360 / r.query.bins + '–' + (bin + 1) * 360 / r.query.bins + '°', number(w.weights[bin].lower),
    ])));
    host.append(table('Same-profile final temperatures · approximately °C', ['Design', 'Ground surface · lower / upper', 'Lower store · lower / upper'],
      ['existing', 'proposal'].map(target => [target === 'existing' ? 'Existing' : 'Proposal',
        ...stores.map(([field]) => ['lower', 'upper'].map(bound => number(w.targets[target][bound][field][bound])).join(' / '))])));
    const exact = node('details'); exact.append(node('summary', 'Exact mixture fractions and outward numeric endpoints'));
    for (const bin of w.support) exact.append(node('p', 'Bin ' + (bin + 1) + ': ' + w.weights[bin].exact.numerator + ' / '
      + w.weights[bin].exact.denominator + '; binary64 display bracket [' + w.weights[bin].lower + ', ' + w.weights[bin].upper + '].'));
    for (const [field, label] of stores) exact.append(node('p', label + ' proposal minus existing: ['
      + w.difference[field][0].lower + ', ' + w.difference[field][1].upper + '] °C.'));
    host.append(exact);
  }
  function draw() {
    const { report: r, investigation } = accepted, host = $('results'); host.replaceChildren();
    host.dataset.status = r.compatibility; host.dataset.bins = String(r.query.bins);
    host.append(node('p', sourceMode + ' · ' + labelSource(investigation.source)),
      node('p', 'Original reading: ' + number(r.query.reading.temperatureC) + ' ± ' + number(r.query.reading.halfWidthC) + ' °C. Source: ' + r.query.reading.source),
      node('p', 'The complete original profile family predicts approximately ' + number(r.originalObservationRangeC.lower.lower)
        + ' to ' + number(r.originalObservationRangeC.upper.upper) + ' °C for this existing surface.'));
    if (r.compatibility === 'compatible') {
      const summary = node('div'); summary.className = 'profile-evidence-summary';
      for (const [field, label] of stores) {
        const card = node('div'), range = r.ranges[field];
        card.append(node('h5', label), node('strong', signed(range.lower.differenceC.lower) + ' to '
          + signed(range.upper.differenceC.upper) + ' °C'),
        node('p', 'Compatible proposal minus existing · approximately'));
        summary.append(card);
      }
      host.append(summary);
      host.append(table('Paired final temperature differences · approximately °C',
        ['Temperature', 'All profiles · minimum', 'All profiles · maximum', 'Compatible · minimum', 'Its profile', 'Compatible · maximum', 'Its profile'],
        stores.map(([field, label]) => {
          const range = r.ranges[field]; host.dataset[field + 'Lower'] = String(range.lower.differenceC.lower); host.dataset[field + 'Upper'] = String(range.upper.differenceC.upper);
          return [label, signed(r.originalRanges[field].lower.differenceC), signed(r.originalRanges[field].upper.differenceC),
            signed(range.lower.differenceC.lower), witnessButton(field, 'lower'), signed(range.upper.differenceC.upper), witnessButton(field, 'upper')];
        })));
      host.append(node('p', 'Negative means cooler in the proposal; positive means warmer. Each bound has its own compatible profile. Surface and lower-store bounds need not occur together.'));
      const label = node('label', 'Inspect a compatible profile'); label.className = 'input-label';
      const select = node('select'); select.id = 'shade-profile-evidence-witness-select';
      for (const w of r.witnesses) { const option = node('option', 'Mixture ' + (w.id + 1) + ' · ' + w.support.map(i => 'bin ' + (i + 1)).join(' + ')); option.value = String(w.id); select.append(option); }
      select.value = String(selected); select.addEventListener('input', () => { selected = Number(select.value); drawWitness(); });
      label.append(select); const witness = node('div'); witness.id = 'shade-profile-evidence-witness'; host.append(label, witness); drawWitness();
    } else host.append(node('p', 'The band and this model’s original existing-surface range do not meet. No paired range is reported from an empty compatible family.'));
    const details = node('details'); details.append(node('summary', 'Complete work, source and interpretation'));
    const work = r.work.profileIntersection;
    details.append(node('p', r.work.executedThermalCourses + ' complete thermal courses; ' + work.examinedPairs + ' bin pairs checked. '
      + work.admittedOriginalVertices + ' admitted one-bin profiles and ' + work.mixedVertices + ' mixture vertices. Every required basis course and exact intersection completed.'),
      node('p', 'The source-only download retains the original site, full weather, original authored sky and this attributed reading. No compatible profile or calculated result is saved.'),
      node('p', r.semantics)); host.append(details);
  }
  invalidate(); return { invalidate };
}
