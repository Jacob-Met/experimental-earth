import { retainedWaterValues, exactWaterNumber } from './water-history-values.js';

const signOf = value => value > 0 ? 'more' : value < 0 ? 'less' : 'equal';
const signLabel = { more: 'More proposed water', less: 'Less proposed water', equal: 'Equal surface water' };

/** Describe only original paired samples; no duration or crossing interpolation. */
export function summarizeWaterTradeoffs(comparison) {
  const rows = retainedWaterValues(comparison);
  const counts = { more: 0, less: 0, equal: 0 }, groups = [];
  let increase = null, decrease = null;
  for (const [index, row] of rows.entries()) {
    const sign = signOf(row.changeLiters); ++counts[sign];
    const last = groups.at(-1);
    if (last?.sign === sign) last.lastIndex = index;
    else groups.push({ sign, firstIndex: index, lastIndex: index });
    if (row.changeLiters > 0) {
      if (!increase || row.changeLiters > increase.changeLiters) increase = { changeLiters: row.changeLiters, indices: [index] };
      else if (row.changeLiters === increase.changeLiters) increase.indices.push(index);
    }
    if (row.changeLiters < 0) {
      if (!decrease || row.changeLiters < decrease.changeLiters) decrease = { changeLiters: row.changeLiters, indices: [index] };
      else if (row.changeLiters === decrease.changeLiters) decrease.indices.push(index);
    }
  }
  const extreme = value => value && Object.freeze({ ...value, indices: Object.freeze(value.indices) });
  return Object.freeze({
    rows, counts: Object.freeze(counts), increase: extreme(increase), decrease: extreme(decrease),
    groups: Object.freeze(groups.map(group => Object.freeze(group))),
    transitions: Object.freeze(groups.slice(1).map(group => Object.freeze({
      beforeIndex: group.firstIndex - 1, afterIndex: group.firstIndex,
    }))),
  });
}

export function createWaterTradeoffs(host, inspectMinute) {
  const document = host.ownerDocument;
  const section = document.createElement('section');
  section.id = 'water-tradeoffs'; section.setAttribute('aria-labelledby', 'water-tradeoff-title');
  const title = document.createElement('h3'); title.id = 'water-tradeoff-title'; title.textContent = 'Across the whole event';
  const source = document.createElement('p'); source.id = 'water-tradeoff-source'; source.className = 'mini-note';
  const summary = document.createElement('p'); summary.id = 'water-tradeoff-summary';
  const extremes = document.createElement('div'); extremes.id = 'water-tradeoff-extremes';
  const details = document.createElement('details'); details.id = 'water-tradeoff-groups';
  const groupsTitle = document.createElement('summary');
  const help = document.createElement('p'); help.className = 'mini-note';
  help.textContent = 'These groups contain consecutive original model snapshots. The time between adjacent samples is not resolved; a group boundary is not an exact crossing time. More or less surface water does not by itself rank a proposal.';
  const groups = document.createElement('ol');
  details.append(groupsTitle, help, groups);
  const status = document.createElement('p'); status.id = 'water-tradeoff-status'; status.className = 'mini-note'; status.setAttribute('role', 'status');
  section.append(title, source, summary, extremes, details, status);
  host.insertBefore(section, host.querySelector('#water-history-values'));
  let accepted = null, available = false, hasShown = false;

  function refresh() {
    const ready = available && accepted !== null;
    section.dataset.state = ready ? 'ready' : 'unavailable';
    for (const control of section.querySelectorAll('button, select')) control.disabled = !ready;
    status.textContent = ready ? '' : hasShown
      ? 'Showing the last completed comparison. Inspection is unavailable until the current comparison is ready.'
      : 'The event comparison will be available when the current comparison is ready.';
  }
  function inspectButton(label, getIndex, record) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'subtle'; button.textContent = label;
    button.addEventListener('click', () => {
      // Detached buttons belong to their original accepted course, even when
      // the newer course happens to contain the same minute or row index.
      if (!available || accepted !== record) return;
      const index = getIndex();
      if (!Number.isInteger(index) || index < 0 || index >= record.rows.length) return;
      const minute = record.rows[index].minute;
      if (inspectMinute(minute)) status.textContent = 'Showing paired values at ' + exactWaterNumber(minute) + ' min.';
    });
    return button;
  }
  function renderExtreme(record, kind, label, absent) {
    const card = document.createElement('div'); card.className = 'water-tradeoff-extreme'; card.dataset.extreme = kind;
    const heading = document.createElement('h4'); heading.textContent = label; card.append(heading);
    const value = record[kind];
    if (!value) {
      const note = document.createElement('p'); note.textContent = absent; card.append(note); return card;
    }
    const number = document.createElement('p'); number.className = 'water-tradeoff-value';
    number.textContent = exactWaterNumber(value.changeLiters, true) + ' L'; card.append(number);
    const actions = document.createElement('div'); actions.className = 'water-tradeoff-actions';
    if (value.indices.length === 1) {
      const index = value.indices[0];
      actions.append(inspectButton('Inspect ' + exactWaterNumber(record.rows[index].minute) + ' min', () => index, record));
    } else {
      const label = document.createElement('label'); label.textContent = value.indices.length + ' tied original snapshots ';
      const select = document.createElement('select'); select.setAttribute('aria-label', heading.textContent + ' time');
      for (const index of value.indices) {
        const option = document.createElement('option'); option.textContent = exactWaterNumber(record.rows[index].minute) + ' min'; select.append(option);
      }
      label.append(select); actions.append(label, inspectButton('Inspect selected time', () => value.indices[select.selectedIndex], record));
    }
    card.append(actions); return card;
  }
  function render(record, projectTitle) {
    hasShown = true; source.textContent = 'Completed comparison: ' + projectTitle;
    const { more, less, equal } = record.counts;
    summary.textContent = `Of ${record.rows.length} original snapshots: ${more} have more proposed surface water, ${less} have less, and ${equal} have the same amount.`;
    extremes.replaceChildren(
      renderExtreme(record, 'increase', 'Greatest increase (proposed − existing)', 'No retained snapshot has more proposed surface water.'),
      renderExtreme(record, 'decrease', 'Greatest decrease (proposed − existing)', 'No retained snapshot has less proposed surface water.'),
    );
    groupsTitle.textContent = 'Inspect ' + record.groups.length + ' groups of original snapshots'; groups.replaceChildren();
    for (const [groupIndex, group] of record.groups.entries()) {
      const item = document.createElement('li'); item.dataset.sign = group.sign;
      const first = record.rows[group.firstIndex], last = record.rows[group.lastIndex], count = group.lastIndex - group.firstIndex + 1;
      const name = document.createElement('strong'); name.textContent = signLabel[group.sign];
      const span = document.createElement('p'); span.textContent = count + (count === 1 ? ' original snapshot at ' : ' consecutive original snapshots, from ') +
        exactWaterNumber(first.minute) + (count === 1 ? ' min.' : ' to ' + exactWaterNumber(last.minute) + ' min.');
      const actions = document.createElement('div'); actions.className = 'water-tradeoff-actions';
      actions.append(inspectButton('Inspect ' + exactWaterNumber(first.minute) + ' min', () => group.firstIndex, record));
      if (count > 1) actions.append(inspectButton('Inspect ' + exactWaterNumber(last.minute) + ' min', () => group.lastIndex, record));
      item.append(name, span, actions);
      if (groupIndex > 0) {
        const before = record.rows[group.firstIndex - 1];
        const bracket = document.createElement('p'); bracket.className = 'mini-note';
        bracket.textContent = 'Adjacent samples at this boundary: ' + exactWaterNumber(before.minute) + ' and ' + exactWaterNumber(first.minute) + ' min.';
        item.append(bracket);
      }
      groups.append(item);
    }
  }
  refresh();
  return {
    update(comparison, projectTitle) {
      accepted = null;
      try { accepted = summarizeWaterTradeoffs(comparison); render(accepted, projectTitle); }
      finally { refresh(); }
    },
    setAvailable(value) { available = value === true; refresh(); },
  };
}
