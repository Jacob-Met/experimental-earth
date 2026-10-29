import { retainedWaterValues, exactWaterNumber } from './water-history-values.js';

// The ordinary portable project is bounded to 4 MiB. Keep this export bounded
// too; the caller supplies its already validated, exact portable-project text.
const MAX_INPUT_BYTES = 4 * 1024 * 1024;
const encoder = new TextEncoder();
const header = [
  'project_title_json', 'project_input_digest', 'model_minute',
  'existing_stored_litres', 'proposed_stored_litres', 'proposed_minus_existing_litres',
];
const cell = value => '"' + String(value).replaceAll('"', '""') + '"';

function retain(comparison, projectJson) {
  if (typeof projectJson !== 'string' || !projectJson.length || projectJson.length > MAX_INPUT_BYTES) {
    throw new Error('A bounded original portable project is required');
  }
  const bytes = encoder.encode(projectJson);
  if (bytes.byteLength > MAX_INPUT_BYTES) throw new Error('Original portable project exceeds 4 MiB');
  const project = JSON.parse(projectJson);
  if (project?.schema !== 'experimental-earth-site/1' || typeof project.title !== 'string' || project.title.length > 120) {
    throw new Error('Original portable project title and schema are required');
  }
  return Object.freeze({
    rows: retainedWaterValues(comparison), bytes,
    // JSON spelling preserves quotes, newlines and even an original unpaired
    // UTF-16 code unit. Its leading quote also keeps a title from becoming a
    // spreadsheet formula after CSV decoding.
    titleJson: JSON.stringify(project.title),
  });
}

async function encode(record) {
  const digest = await crypto.subtle.digest('SHA-256', record.bytes);
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const lines = [header.join(',')];
  for (const row of record.rows) {
    lines.push([
      record.titleJson, 'sha256:' + hex,
      exactWaterNumber(row.minute), exactWaterNumber(row.existingLiters),
      exactWaterNumber(row.proposedLiters), exactWaterNumber(row.changeLiters),
    ].map(cell).join(','));
  }
  return { csv: lines.join('\r\n') + '\r\n', digest: hex };
}

/** Serialize an already accepted paired course, retaining its source before awaiting. */
export async function serializeWaterHistoryCsv(comparison, portableProjectJson) {
  return (await encode(retain(comparison, portableProjectJson))).csv;
}

export function createWaterHistoryCsv(host) {
  const document = host.ownerDocument;
  const section = document.createElement('div');
  section.id = 'water-history-export';
  const description = document.createElement('p');
  description.id = 'water-history-export-description'; description.className = 'mini-note';
  description.textContent = 'Download every retained time and both whole-site water totals. The CSV identifies the original input by SHA-256; keep Export project with it to retain the complete input.';
  const actions = document.createElement('div'); actions.className = 'obs-actions';
  const button = document.createElement('button');
  button.id = 'export-water-history-csv'; button.type = 'button'; button.className = 'subtle';
  button.textContent = 'Download water history CSV';
  button.setAttribute('aria-describedby', description.id + ' water-history-export-status');
  const status = document.createElement('p');
  status.id = 'water-history-export-status'; status.className = 'mini-note';
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  actions.append(button); section.append(description, actions, status); host.append(section);
  let accepted = null, available = false, busy = false, generation = 0;
  function refresh() {
    button.disabled = !available || !accepted || busy;
    status.textContent = busy ? 'Preparing the complete water history…'
      : available && accepted ? accepted.rows.length + ' original snapshots ready to download.'
      : 'Download is available when the current comparison is ready.';
  }
  document.defaultView.addEventListener('pagehide', () => {
    ++generation; busy = false; refresh();
  });
  button.addEventListener('click', async () => {
    if (!available || !accepted || busy) return;
    const record = accepted, request = generation;
    let url, link;
    busy = true; refresh();
    try {
      const result = await encode(record);
      if (generation !== request || !available || accepted !== record) return;
      url = URL.createObjectURL(new Blob([result.csv], { type: 'text/csv;charset=utf-8' }));
      link = document.createElement('a'); link.href = url;
      link.download = 'experimental-earth-water-history.csv';
      document.body.append(link); link.click();
      status.textContent = 'CSV download started for all ' + record.rows.length + ' original snapshots.';
    } catch (error) {
      if (generation === request && available && accepted === record) {
        status.textContent = 'CSV download could not be prepared: ' + error.message;
      }
    } finally {
      link?.remove();
      if (url) setTimeout(() => URL.revokeObjectURL(url), 500);
      if (generation === request) { busy = false; button.disabled = !available || !accepted; }
    }
  });
  refresh();
  return {
    update(comparison, portableProjectJson) {
      // Invalidate first, including a refused replacement, so an older digest
      // cannot publish after a newer source has reached this boundary.
      ++generation; busy = false;
      accepted = null;
      try { accepted = retain(comparison, portableProjectJson); }
      finally { refresh(); }
    },
    setAvailable(value) {
      if (value !== true) { ++generation; busy = false; }
      available = value === true; refresh();
    },
  };
}
