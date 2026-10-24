import { MATERIALS, initialSession, validateSession, paintCell, compareSession, suggestMeasurement } from './water.mjs';

const $ = id => document.getElementById(id);
const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const copy = value => JSON.parse(JSON.stringify(value));
let session = initialSession();
let selectedMaterial = 'planting';
let comparisons = null;
let undoStack = [];
let lastMeasurement = null;

function message(text, error = false) {
  $('status-message').textContent = text;
  $('status-message').style.color = error ? '#ffb6a2' : '';
}
function signed(number, unit = 'L') { return `${number > .05 ? '+' : ''}${fmt.format(number)} ${unit}`; }
function showMaterials() {
  const root = $('materials'); root.replaceChildren();
  for (const [id, item] of Object.entries(MATERIALS)) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `material${selectedMaterial === id ? ' selected' : ''}`;
    button.setAttribute('aria-pressed', String(selectedMaterial === id));
    const swatch = document.createElement('i'); swatch.style.background = item.color;
    button.append(swatch, document.createTextNode(item.name));
    const info = document.createElement('small'); info.textContent = `${item.rate} mm/h assumed`;
    button.append(info);
    button.addEventListener('click', () => { selectedMaterial = id; showMaterials(); message(`Brush: ${item.name}. Click a cell in the proposal map.`); });
    root.append(button);
  }
}
function showMap(root, site, frame, editable) {
  root.style.gridTemplateColumns = `repeat(${site.cols},minmax(0,1fr))`;
  const outletSet = new Set(site.outlets.map(o => o.index));
  const frag = document.createDocumentFragment();
  site.materials.forEach((material, index) => {
    const d = frame.depthsMm[index];
    const node = document.createElement(editable ? 'button' : 'div');
    node.className = `cell${outletSet.has(index) ? ' outlet' : ''}`;
    if (editable) node.type = 'button';
    node.style.setProperty('--soil', MATERIALS[material].color);
    node.style.setProperty('--flood', String(Math.min(.92, Math.max(0, d / 43))));
    const row = Math.floor(index / site.cols) + 1, col = (index % site.cols) + 1;
    const label = `Row ${row}, column ${col}, ${MATERIALS[material].name}, ${fmt.format(d)} mm water${outletSet.has(index) ? ', outlet' : ''}`;
    node.title = label;
    node.setAttribute('aria-label', label);
    if (editable) node.addEventListener('click', () => {
      if (session.proposal.materials[index] === selectedMaterial) { message(`Row ${row}, column ${col} is already ${MATERIALS[selectedMaterial].name}.`); return; }
      undoStack.push(copy(session.proposal.materials));
      if (undoStack.length > 50) undoStack.shift();
      session = paintCell(session, index, selectedMaterial);
      recompute();
      // Replaced grid elements otherwise strand keyboard focus after each edit.
      root.querySelectorAll('button.cell')[index]?.focus({ preventScroll: true });
      message(`Updated row ${row}, column ${col} to ${MATERIALS[selectedMaterial].name}. Baseline unchanged.`);
    });
    frag.append(node);
  });
  root.replaceChildren(frag);
}
function showMeasurement() {
  if (!lastMeasurement) return;
  const { x, y, material, low, high, impactLiters, evaluatedCount, totalCount } = lastMeasurement;
  const root = $('measurement-result'); root.replaceChildren();
  const over = document.createElement('span'); over.textContent = 'SENSITIVITY CHECK / PROPOSAL';
  const title = document.createElement('strong'); title.textContent = `Measure cell ${y + 1}:${x + 1}`;
  const body = document.createElement('p');
  body.textContent = `The assumed ${MATERIALS[material].name.toLowerCase()} rate ranges from ${low} to ${high} mm/h. Changing only this input alters the modeled standing + outlet water by ${fmt.format(impactLiters)} L. This was the largest change among ${evaluatedCount} of ${totalCount} evaluated cells${evaluatedCount < totalCount ? " (a heuristic shortlist)" : ""}. A field infiltration test here could sharpen the comparison; no measurement has been performed.`;
  root.append(over, title, body);
}
function showFrame(index) {
  if (!comparisons) return;
  const { baseline, proposal } = comparisons;
  const at = Math.min(Number(index), baseline.frames.length - 1);
  const before = baseline.frames[at], after = proposal.frames[at];
  $('moment-label').textContent = `Minute ${fmt.format(after.minute)} / ${fmt.format(session.storm.durationMinutes)}`;
  showMap($('baseline-grid'), session.baseline, before, false);
  showMap($('proposal-grid'), session.proposal, after, true);
  $('baseline-depth').textContent = `Deepest: ${fmt.format(before.maxDepthMm)} mm`;
  $('proposal-depth').textContent = `Deepest: ${fmt.format(after.maxDepthMm)} mm`;
  $('baseline-water').textContent = `${fmt.format(before.storedLiters)} L standing`;
  $('proposal-water').textContent = `${fmt.format(after.storedLiters)} L standing`;
}
function setDelta(id, change, favorableWhen) {
  const el = $(id);
  el.textContent = `${signed(change)} against baseline`;
  el.classList.toggle('favorable', change * favorableWhen > .05);
}
function recompute() {
  comparisons = compareSession(session);
  const { baseline, proposal } = comparisons;
  $('rain').value = String(session.storm.intensityMmPerHour);
  $('duration').value = String(session.storm.durationMinutes);
  $('rain-value').textContent = `${session.storm.intensityMmPerHour} mm/h`;
  $('duration-value').textContent = `${session.storm.durationMinutes} min`;
  $('moment').max = String(proposal.frames.length - 1);
  $('moment').value = String(proposal.frames.length - 1);
  showFrame(proposal.frames.length - 1);
  $('metric-stored').textContent = `${fmt.format(proposal.final.storedLiters)} L`;
  $('metric-infil').textContent = `${fmt.format(proposal.final.infiltrationLiters)} L`;
  $('metric-outlet').textContent = `${fmt.format(proposal.final.outletLiters)} L`;
  setDelta('delta-stored', comparisons.deltaStoredLiters, -1);
  setDelta('delta-infil', comparisons.deltaInfiltrationLiters, 1);
  setDelta('delta-outlet', comparisons.deltaOutletLiters, -1);
  const f = proposal.final;
  $('balance').textContent = `${fmt.format(f.rainLiters)} L rain = ${fmt.format(f.infiltrationLiters)} L absorbed + ${fmt.format(f.outletLiters)} L drained + ${fmt.format(f.storedLiters)} L standing (round-off: ${fmt.format(Math.abs(f.balanceErrorLiters))} L).`;
  $('measure').disabled = false;
  lastMeasurement = null;
  const m = $('measurement-result'); m.replaceChildren();
  const text = document.createElement('p'); text.textContent = 'The proposal changed. Run the sensitivity check to refresh the suggested observation.';
  m.append(text);
}
$('rain').addEventListener('input', event => { session.storm.intensityMmPerHour = Number(event.target.value); recompute(); });
$('duration').addEventListener('input', event => { session.storm.durationMinutes = Number(event.target.value); recompute(); });
$('moment').addEventListener('input', event => showFrame(event.target.value));
$('reset').addEventListener('click', () => { undoStack.push(copy(session.proposal.materials)); session.proposal = copy(session.baseline); recompute(); message('Proposal reset. Baseline untouched.'); });
$('undo').addEventListener('click', () => {
  const previous = undoStack.pop(); if (!previous) { message('Nothing to undo.'); return; }
  session.proposal.materials = previous; recompute(); message('Last surface edit restored.');
});
$('measure').addEventListener('click', () => {
  $('measure').disabled = true;
  // Let the browser paint the pending state before 2N model evaluations.
  window.setTimeout(() => {
    try { lastMeasurement = suggestMeasurement(session.proposal, session.storm); showMeasurement(); message('Sensitivity complete. This is model input sensitivity, not a field observation.'); }
    catch (error) { message(`Sensitivity could not run: ${error.message}`, true); }
    finally { $('measure').disabled = false; }
  }, 15);
});
$('export').addEventListener('click', () => {
  const json = JSON.stringify(validateSession(session), null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'experimental-earth-rain-lab.json';
  document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  message('Exported this local experiment as a JSON session.');
});
$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  event.target.value = '';
  if (file.size > 512 * 1024) { message('Session too large; maximum 512 KiB.', true); return; }
  try {
    const candidate = validateSession(JSON.parse(await file.text()));
    session = candidate; undoStack = []; recompute();
    message(`Restored ${session.baseline.name}. All processing remains local.`);
  } catch (error) { message(`Import rejected: ${error.message}`, true); }
});
showMaterials();
recompute();
