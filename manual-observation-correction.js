// Manual notebook corrections preserve the accepted reading's identity and context.
const fields = ['minute', 'depthMm', 'uncertaintyMm', 'source'];
export function commitManualCorrection(project, reading, original, values, validate) {
  if (!project.observations.includes(reading) || reading.tableSource !== undefined ||
      JSON.stringify(reading) !== original) throw new Error('This reading changed. Open its editor again.');
  const candidate = { ...reading };
  for (const key of fields) {
    if (typeof values[key] !== 'string' || !values[key].trim()) throw new Error('Complete every correction field.');
    candidate[key] = key === 'source' ? values[key].trim() : Number(values[key]);
  }
  validate({ ...project, observations: project.observations.map(row => row === reading ? candidate : row) });
  // Validation is synchronous and precedes every accepted-field mutation.
  for (const key of fields) reading[key] = candidate[key];
}

export function mountManualObservationCorrection({ list, getProject, validate, changed, available }) {
  const document = list.ownerDocument;
  const panel = document.createElement('section');
  panel.id = 'manual-observation-correction';
  panel.setAttribute('aria-labelledby', 'manual-correction-heading');
  const heading = document.createElement('h3'); heading.id = 'manual-correction-heading';
  heading.textContent = 'Correct a manually entered reading';
  const status = document.createElement('p'); status.id = 'manual-correction-status'; status.setAttribute('role', 'status');
  const help = document.createElement('p'); help.className = 'mini-note';
  help.textContent = 'Save replaces this manual notebook entry, not its cell or evidence role. Imported table readings retain their original source values and cannot be corrected here.';
  const form = document.createElement('form'); form.hidden = true;
  panel.append(heading, help, status, form); list.after(panel);
  let active = null;
  const bindings = new Map();
  function current(record) {
    return record && getProject() === record.project && record.project.observations.includes(record.reading) &&
      record.reading.tableSource === undefined && JSON.stringify(record.reading) === record.original;
  }
  function end(message) { active = null; form.hidden = true; form.replaceChildren(); status.textContent = message; refresh(); }
  function refresh() {
    if (active && !current(active)) end('Correction draft retired because its original reading or project changed.');
    for (const [reading, binding] of bindings) {
      if (!binding.button.isConnected) { bindings.delete(reading); continue; }
      binding.button.disabled = !available() || Boolean(active);
    }
    if (active) {
      active.fieldset.disabled = !available();
      active.inputs.minute.max = String(active.project.weather.durationMinutes);
    }
  }
  function open(reading) {
    if (!available() || active || reading.tableSource !== undefined || !getProject().observations.includes(reading)) return;
    const record = { project: getProject(), reading, original: JSON.stringify(reading), inputs: {} };
    active = record; form.replaceChildren(); form.hidden = false;
    const cell = String.fromCharCode(65 + reading.cellIndex % record.project.width) + (Math.floor(reading.cellIndex / record.project.width) + 1);
    const scenarioLabel = { existing: 'Existing site', proposal: 'Proposed site' }[reading.scenario] || 'Unassigned';
    const role = { calibration: 'Calibration', challenge: 'Held aside' }[reading.use] || 'Notebook only';
    status.textContent = 'Editing ' + cell + ' · ' + scenarioLabel + ' · ' + role + ' · ' + reading.minute + ' min. Changes are drafts until Save correction.';
    const fieldset = document.createElement('fieldset'); record.fieldset = fieldset;
    const legend = document.createElement('legend'); legend.textContent = 'Manual reading correction'; fieldset.append(legend);
    for (const [key, label, max] of [['minute', 'Time after start · min', record.project.weather.durationMinutes], ['depthMm', 'Observed depth · mm', 1000], ['uncertaintyMm', '± uncertainty · mm', 1000], ['source', 'Source / measurement method', 200]]) {
      const wrapper = document.createElement('label'); wrapper.className = 'input-label'; wrapper.textContent = label;
      const input = document.createElement('input'); input.id = 'manual-correction-' + key; input.required = true;
      input.type = key === 'source' ? 'text' : 'number';
      if (key === 'source') input.maxLength = max;
      else { input.min = '0'; input.max = String(max); input.step = 'any'; }
      input.value = String(reading[key]); record.inputs[key] = input; wrapper.append(input); fieldset.append(wrapper);
    }
    const save = document.createElement('button'); save.type = 'submit'; save.className = 'primary'; save.textContent = 'Save correction'; save.id = 'manual-correction-save';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.id = 'manual-correction-cancel';
    cancel.addEventListener('click', () => {
      if (active !== record) return;
      const button = bindings.get(reading)?.button; end('Correction canceled. Accepted reading unchanged.');
      if (button?.isConnected && !button.disabled) button.focus();
    });
    fieldset.append(save, cancel); form.append(fieldset);
    form.onsubmit = event => {
      event.preventDefault();
      if (active !== record || event.submitter !== save || !available()) return;
      if (!current(record)) { refresh(); return; }
      try {
        const values = Object.fromEntries(fields.map(key => [key, record.inputs[key].value]));
        commitManualCorrection(record.project, reading, record.original, values, validate);
      } catch (error) { status.textContent = 'Correction not saved: ' + error.message; return; }
      const scenario = bindings.get(reading)?.row.querySelector('[data-evidence-field="scenario"]');
      end('Manual reading corrected. Cell, evidence role and other retained fields are unchanged.');
      // Use the existing observation focus contract; do not add a parallel policy.
      if (scenario?.isConnected && !scenario.disabled) scenario.focus();
      try { changed(); }
      catch (error) { status.textContent = 'The correction was accepted in the current input, but comparison refresh failed: ' + error.message + '. Check the comparison status and export the current workspace before leaving.'; }
    };
    refresh(); record.inputs.minute.focus();
  }
  return {
    refresh,
    mount(row, reading) {
      if (reading.tableSource !== undefined) return;
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Edit'; button.dataset.manualObservationEdit = '';
      button.addEventListener('click', () => { if (bindings.get(reading)?.button === button && row.isConnected) open(reading); });
      bindings.set(reading, { row, button }); row.append(button);
      button.disabled = !available() || Boolean(active);
    },
  };
}
