import { checkShadeHeatBytes } from './shade-heat.js';
import { createShadeHeatComputation } from './shade-heat-computation.js';

const node = (tag, text = '') => { const el = document.createElement(tag); el.textContent = text; return el; };
const number = value => value !== 0 && Math.abs(value) < .000001 ? value.toExponential(4)
  : Number(value).toLocaleString('en-US', { maximumSignificantDigits: 8 });
const signed = value => (value > 0 ? '+' : '') + number(value);
const stores = [['surfaceC', 'Ground surface'], ['subsurfaceC', 'Lower heat store']];

export function mountShadeHeatProfileRange({ host, getAccepted, cancelParentPending, notice }) {
  const style = node('link'); style.rel = 'stylesheet';
  style.href = new URL('./shade-heat-profile-range.css', import.meta.url); document.head.append(style);
  const panel = node('section'); panel.id = 'shade-profile-range';
  panel.innerHTML = '<h3>Could sky direction reverse the final heat difference?</h3>'
    + '<p>Keep the original site, materials, direct beam and total diffuse light. Find the final temperature difference across every nonnegative brightness mixture in equal sky bins, using the same profile for both designs throughout the exposure.</p>'
    + '<div class="shade-profile-actions"><label class="input-label">Equal grid-heading bins<select id="shade-profile-bins"><option>4</option><option selected>8</option><option>16</option></select></label>'
    + '<button id="shade-profile-run" type="button" disabled>Investigate all shared profiles</button>'
    + '<label class="shade-file">Reopen profile-range inputs<input id="shade-profile-import" type="file" accept=".json,application/json"></label>'
    + '<button id="shade-profile-export" type="button" disabled>Download profile-range inputs</button></div>'
    + '<p class="mini-note">Use an accepted comparison above, or reopen this inquiry’s original inputs. This asks a separate question; it preserves the parent’s declared sky profile and the working site.</p>'
    + '<p id="shade-profile-status" role="status"></p><div id="shade-profile-results"></div>';
  host.append(panel);
  const $ = id => panel.querySelector('#shade-profile-' + id);
  const computation = createShadeHeatComputation(() => new Worker(
    new URL('./shade-heat-profile-range-worker.js', import.meta.url), { type: 'module' }));
  let accepted = null, retainedSource = null, sourceMode = '', generation = 0, reading = false, selectedBin = 0;
  const pending = () => reading || computation.pending;
  const source = () => retainedSource ?? getAccepted()?.investigation ?? null;
  function state(message, kind) { $('status').textContent = message; $('status').dataset.state = kind; }
  function controls() { $('run').disabled = pending() || !source(); $('export').disabled = pending() || !accepted; }
  function invalidate(message = 'Accept a shade-and-heat comparison or reopen original profile-range inputs.', keepSource = false) {
    generation++; reading = false; computation.cancel(); accepted = null;
    if (!keepSource) { retainedSource = null; sourceMode = ''; }
    $('results').replaceChildren(); controls(); state(message, 'not-compared');
  }
  function receive(next, mode) {
    accepted = next; retainedSource = next.investigation.source; sourceMode = mode; reading = false;
    $('bins').value = String(next.investigation.query.bins);
    selectedBin = next.report.ranges.surfaceC.lower.bin; draw(); controls();
    state('Every required one-bin course completed. The final paired range retains one shared profile across both designs.', 'compared');
  }
  $('bins').addEventListener('input', () => {
    cancelParentPending();
    invalidate('Bin count changed. Recompute the range from the same original source.', true);
  });
  $('run').addEventListener('click', async () => {
    cancelParentPending();
    const original = source(); if (!original) return;
    const mode = retainedSource ? sourceMode : 'Accepted original comparison';
    retainedSource = original; sourceMode = mode;
    invalidate('Calculating every shared-profile extreme…', true);
    const request = generation;
    try {
      const promise = computation.compute({ operation: 'prepare', project: original.project,
        declaration: original.declaration, query: { bins: Number($('bins').value) } });
      controls();
      const next = await promise;
      if (request === generation) receive(next, mode);
    } catch (error) {
      if (request === generation && error.code !== 'superseded') { state(error.message, 'refused'); notice(error.message); }
    } finally { if (request === generation) controls(); }
  });
  $('import').addEventListener('change', async () => {
    const file = $('import').files?.[0]; if (!file) return; $('import').value = '';
    cancelParentPending(); computation.cancel();
    const request = ++generation; reading = true; controls();
    state('Reading and recomputing original profile-range inputs…', 'file-pending');
    try {
      checkShadeHeatBytes(file.size);
      const bytes = await file.arrayBuffer(); if (request !== generation) return;
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      const next = await computation.compute({ operation: 'parse', text });
      if (request === generation) receive(next, 'Reopened original profile-range inputs');
    } catch (error) {
      if (request === generation && error.code !== 'superseded') {
        state('File refused: ' + error.message + (accepted ? ' The prior accepted inquiry is retained.' : ' No profile range is accepted.'), 'file-refused');
        notice(error.message);
      }
    } finally { if (request === generation) { reading = false; controls(); } }
  });
  $('export').addEventListener('click', () => {
    if (!accepted || pending()) return;
    try {
      const text = JSON.stringify(accepted.investigation, null, 2); checkShadeHeatBytes(new Blob([text]).size);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = node('a'); link.href = url; link.download = 'experimental-earth-shared-sky-final-range-inputs.json';
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { state(error.message, 'refused'); notice(error.message); }
  });
  function table(caption, headings, rows) {
    const wrap = node('div'); wrap.className = 'shade-profile-table'; wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', caption);
    const el = node('table'); el.append(node('caption', caption));
    const head = node('thead'), tr = node('tr');
    for (const heading of headings) { const th = node('th', heading); th.scope = 'col'; tr.append(th); }
    head.append(tr); el.append(head); const body = node('tbody');
    for (const row of rows) { const tr = node('tr'); for (const value of row) {
      const td = node('td'); if (value instanceof Node) td.append(value); else td.textContent = String(value); tr.append(td);
    } body.append(tr); }
    el.append(body); wrap.append(el); return wrap;
  }
  function witnessButton(field, bound) {
    const r = accepted.report.ranges[field][bound], label = stores.find(s => s[0] === field)[1];
    const button = node('button', 'Bin ' + (r.bin + 1)); button.type = 'button';
    button.dataset.store = field; button.dataset.bound = bound;
    button.setAttribute('aria-label', 'Inspect ' + label.toLowerCase() + ' ' + (bound === 'lower' ? 'minimum' : 'maximum') + ' profile');
    button.addEventListener('click', () => { selectedBin = r.bin; $('witness-bin').value = String(selectedBin); drawWitness(); $('witness').scrollIntoView({ block: 'nearest' }); });
    return button;
  }
  function drawWitness() {
    const vertex = accepted.report.vertices[selectedBin], host = $('witness'); host.replaceChildren();
    host.dataset.bin = String(vertex.bin);
    host.append(node('h4', 'Bin ' + (vertex.bin + 1) + ' · ' + number(vertex.headingStartDeg) + '–' + number(vertex.headingEndDeg) + '° grid heading'),
      node('p', 'All diffuse brightness is in this bin. Shared relative weights: [' + vertex.profile.join(', ') + ']. Zero degrees is grid +X, increasing toward grid +Y; these are not geographic bearings.'));
    host.append(table('Same-profile endpoint evidence', ['Design', 'Diffuse transmission · lower / upper', 'Final surface · °C', 'Final lower store · °C'],
      ['existing', 'proposal'].map(target => {
        const v = vertex.targets[target];
        return [target === 'existing' ? 'Existing' : 'Proposal', v.transmission.map(t => number(t.transmission)).join(' / '),
          ...stores.map(([field]) => ['lower', 'upper'].map(bound => number(v.final[bound][field])).join(' / '))];
      })));
    host.append(node('p', 'Proposal minus existing for this shared profile: surface ' + vertex.difference.surfaceC.map(signed).join(' to ')
      + ' °C; lower store ' + vertex.difference.subsurfaceC.map(signed).join(' to ') + ' °C.'));
    for (const [field] of stores) {
      host.dataset[field + 'Lower'] = String(vertex.difference[field][0]);
      host.dataset[field + 'Upper'] = String(vertex.difference[field][1]);
    }
  }
  function draw() {
    const { report, investigation } = accepted, source = investigation.source, project = source.project;
    const cell = report.cellIndex, label = String.fromCharCode(65 + cell % project.width) + (Math.floor(cell / project.width) + 1);
    const host = $('results'); host.replaceChildren(); host.dataset.bins = String(report.query.bins);
    host.append(node('p', sourceMode + ' · ' + project.title + ' · ' + project.width + ' × ' + project.height
      + ' original grid · saved ground point ' + label + '. Final time: ' + report.finalUtc + ' (' + number(report.durationMinutes) + ' minutes).'));
    host.append(table('Final proposal minus existing across shared sky profiles',
      ['Temperature', 'Minimum · °C', 'Its profile', 'Maximum · °C', 'Its profile'], stores.map(([field, label]) => {
        const r = report.ranges[field];
        host.dataset[field + 'Lower'] = String(r.lower.differenceC); host.dataset[field + 'Upper'] = String(r.upper.differenceC);
        return [label, signed(r.lower.differenceC), witnessButton(field, 'lower'), signed(r.upper.differenceC), witnessButton(field, 'upper')];
      })));
    host.append(node('p', 'Negative means the proposal finishes cooler; positive means warmer. Each bound has its own shared profile. Surface and lower-store extrema need not occur together. These are final-temperature ranges, not peak-temperature ranges.'));
    const selectLabel = node('label', 'Inspect a shared one-bin profile'); selectLabel.className = 'input-label';
    const select = node('select'); select.id = 'shade-profile-witness-bin';
    for (const v of report.vertices) { const option = node('option', 'Bin ' + (v.bin + 1) + ' · ' + v.headingStartDeg + '–' + v.headingEndDeg + '°'); option.value = String(v.bin); select.append(option); }
    select.value = String(selectedBin); select.addEventListener('input', () => { selectedBin = Number(select.value); drawWitness(); });
    selectLabel.append(select); const witness = node('div'); witness.id = 'shade-profile-witness'; host.append(selectLabel, witness); drawWitness();
    const details = node('details'); details.append(node('summary', 'Original source, complete work and model limits'));
    details.append(node('p', project.source), node('p', source.declaration.path.locationSource), node('p', source.declaration.path.orientationSource),
      node('p', source.declaration.weather ? 'The complete original hourly weather JSON is retained in the download.' : source.declaration.weatherSource),
      node('p', report.work.executedThermalCourses + ' complete thermal courses; ' + report.work.courseIntervals + ' course intervals. One geometry/forcing pass reserves '
        + (report.work.estimatedRayTests + report.work.estimatedSkyFaceTests).toLocaleString('en-US') + ' ray/face checks against the shared 16 million limit. These are declared work counts, not total CPU operations.'));
    for (const target of ['existing', 'proposal']) for (const roof of ['maximumRoofs', 'minimumRoofs']) {
      const d = report.diagnostics[target][roof];
      details.append(node('p', target + ' ' + roof + ': ' + d.collapsedSectors + ' collapsed numerical sectors; '
        + number(d.omittedAngularWidthRad) + ' radians omitted.'));
    }
    const clamps = report.vertices.reduce((sum, v) => sum + ['existing', 'proposal'].reduce((s, t) => s + v.targets[t].transmission.filter(x => x.transmissionClamped).length, 0), 0);
    details.append(node('p', clamps + ' one-bin transmissions clamped at the maintained rounding limit. Exact ties select the first bin.'), node('p', report.semantics)); host.append(details);
  }
  invalidate(); return { invalidate };
}
