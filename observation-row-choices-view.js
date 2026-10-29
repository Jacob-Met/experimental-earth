/** Explicit, transient row choices for the ordinary observation-table preview. */
export function createObservationRowChoices({ appendButton, list }) {
  const boxes = new Map(), selected = new Set();
  let ready = false;
  const actions = document.createElement('div');
  actions.id = 'observation-row-actions';
  const buttonRow = document.createElement('div');
  buttonRow.className = 'obs-actions';
  actions.append(buttonRow);
  actions.hidden = true;
  const all = document.createElement('button'), none = document.createElement('button');
  for (const button of [all, none]) {
    button.type = 'button';
    button.className = 'subtle';
  }
  all.id = 'select-all-observation-rows';
  all.textContent = 'Choose all rows';
  none.id = 'clear-observation-rows';
  none.textContent = 'Clear choices';
  buttonRow.append(all, none);
  const count = document.createElement('p');
  count.id = 'observation-row-count';
  count.className = 'mini-note';
  count.setAttribute('role', 'status');
  count.setAttribute('aria-live', 'polite');
  count.hidden = true;
  list.before(actions, count);
  appendButton.setAttribute('aria-describedby', count.id);

  function update() {
    const size = selected.size;
    appendButton.disabled = !ready || !size;
    appendButton.textContent = size
      ? `Add ${size} selected ${size === 1 ? 'reading' : 'readings'}`
      : 'Add selected readings';
    all.disabled = !ready || size === boxes.size;
    none.disabled = !ready || !size;
    count.textContent = ready
      ? `${size} of ${boxes.size} source rows chosen. ${size ? 'Only these rows will be added, in original table order.' : 'Choose the rows to add; nothing is selected automatically.'}`
      : '';
  }

  all.addEventListener('click', () => {
    if (!ready) return;
    for (const [line, checkbox] of boxes) { checkbox.checked = true; selected.add(line); }
    update();
  });
  none.addEventListener('click', () => {
    for (const checkbox of boxes.values()) checkbox.checked = false;
    selected.clear();
    update();
  });

  return {
    clear() {
      ready = false;
      selected.clear();
      boxes.clear();
      actions.hidden = true;
      count.hidden = true;
      update();
    },
    add(row, line) {
      const description = row.textContent;
      const label = document.createElement('label'), checkbox = document.createElement('input');
      // Reuse the existing accessible checkbox-row layout.
      label.className = 'joint-choice';
      checkbox.type = 'checkbox';
      checkbox.id = `observation-source-line-${line}`;
      checkbox.dataset.observationLine = String(line);
      const text = document.createElement('span');
      text.textContent = description;
      label.append(checkbox, text);
      row.replaceChildren(label);
      boxes.set(line, checkbox);
      checkbox.addEventListener('change', () => {
        if (!ready || boxes.get(line) !== checkbox) return;
        if (checkbox.checked) selected.add(line); else selected.delete(line);
        update();
      });
    },
    ready() {
      ready = true;
      actions.hidden = false;
      count.hidden = false;
      update();
    },
    lines() { return [...selected]; },
  };
}
