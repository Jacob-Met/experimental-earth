import { previewObservationTable, commitObservationPreview } from './observation-table.js';

const $ = id => document.getElementById(id);
const number = value => value.toLocaleString('en-US', { maximumSignificantDigits: 6 });
const chooseTable = 'Choose a UTF-8 CSV to preview interpreted units and evidence roles before adding any readings. Check the preview before adding it to the notebook.';

export function mountObservationImport({ getProject, replaceProject, notice }) {
  let preview = null, selectedTable = null, reading = false;
  let fileGeneration = 0, previewGeneration = 0;
  const fileInput = $('observation-table-file');
  const appendButton = $('append-observation-table');
  const previewButton = document.createElement('button');
  previewButton.id = 'preview-observation-table';
  previewButton.type = 'button';
  previewButton.className = 'subtle';
  previewButton.textContent = 'Preview selected table';
  previewButton.disabled = true;
  appendButton.before(previewButton);
  const selectedLabel = document.createElement('p');
  selectedLabel.id = 'observation-table-selected';
  selectedLabel.className = 'mini-note';
  selectedLabel.hidden = true;
  appendButton.parentElement.after(selectedLabel);

  function invalidatePreview() {
    previewGeneration++;
    preview = null;
    appendButton.disabled = true;
    $('observation-table-preview').replaceChildren();
  }

  function refresh() {
    fileGeneration++;
    reading = false;
    selectedTable = null;
    invalidatePreview();
    previewButton.disabled = true;
    selectedLabel.hidden = true;
    selectedLabel.textContent = '';
    fileInput.value = '';
    $('observation-table-status').textContent = chooseTable;
  }

  function previewSelectedTable() {
    if (!selectedTable) return;
    invalidatePreview();
    const project = getProject();
    try {
      const mappingText = $('observation-station-map').value.trim();
      if (mappingText.length > 32000) throw new Error('Station map exceeds 32 KB');
      preview = previewObservationTable(selectedTable.text, project, selectedTable.fileName, mappingText ? JSON.parse(mappingText) : undefined);
      $('observation-table-status').textContent = `${preview.readings.length} rows ready from ${preview.fileName}; ${preview.convertedCount} converted to millimetres; ${preview.unassignedCount} notebook-only or unassigned. Nothing has been added yet.`;
      const list = $('observation-table-preview');
      for (const reading of preview.readings) {
        const row = document.createElement('li');
        const cell = `${String.fromCharCode(65 + reading.cellIndex % project.width)}${Math.floor(reading.cellIndex / project.width) + 1}`;
        row.textContent = `Line ${reading.tableSource.line} · ${cell}, ${reading.minute} min · ${number(reading.depthMm)} ± ${number(reading.uncertaintyMm)} mm (supplied ${reading.tableSource.depthValue} ± ${reading.tableSource.uncertaintyValue} ${reading.tableSource.unit}) · ${reading.scenario}, ${reading.use === 'challenge' ? 'held aside' : reading.use === 'unassigned' ? 'notebook only' : reading.use} · ${reading.source}${reading.tableSource.stationMapping ? ` · original station token ${JSON.stringify(reading.tableSource.stationValue)}; station ${reading.tableSource.stationMapping.station} → ${reading.tableSource.stationMapping.cell}; mapping source: ${reading.tableSource.stationMapping.source}` : ''}${reading.tableSource.timestamp ? ` · original ${reading.tableSource.timestamp}; declared event start ${reading.tableSource.eventStart} (clock synchronization not verified)` : ''}`;
        list.append(row);
      }
      appendButton.disabled = false;
    } catch (error) {
      preview = null;
      appendButton.disabled = true;
      $('observation-table-status').textContent = `Import refused: ${error.message}. Existing readings are unchanged. Correct the station map and preview the selected table again, or choose another CSV.`;
    }
  }

  $('observation-station-map').addEventListener('input', () => {
    invalidatePreview();
    $('observation-table-status').textContent = selectedTable
      ? `Station map changed. Preview ${selectedTable.fileName} again before adding any readings.`
      : reading
        ? 'Station map changed while the table is being read. Preview the selected table when reading finishes.'
        : chooseTable;
  });
  previewButton.addEventListener('click', previewSelectedTable);

  fileInput.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    refresh();
    if (!file) return;
    const fileTicket = fileGeneration, previewTicket = previewGeneration, project = getProject();
    reading = true;
    $('observation-table-status').textContent = 'Reading the observation table…';
    try {
      if (file.size > 128000) throw new Error('Observation table exceeds the 128 KB file limit');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      if (fileTicket !== fileGeneration || project !== getProject()) return;
      selectedTable = { text, fileName: file.name };
      reading = false;
      previewButton.disabled = false;
      selectedLabel.hidden = false;
      selectedLabel.textContent = `Selected table: ${file.name}. You can correct the station map and preview this file again. The selected CSV is kept only in this tab.`;
      if (previewTicket === previewGeneration) previewSelectedTable();
      else $('observation-table-status').textContent = `Table ready: ${file.name}. Preview the selected table to use the current station map. Nothing has been added yet.`;
    } catch (error) {
      if (fileTicket === fileGeneration) {
        reading = false;
        selectedTable = null;
        previewButton.disabled = true;
        $('observation-table-status').textContent = `Import refused: ${error.message}. Existing readings are unchanged. Choose another CSV.`;
      }
    } finally {
      if (fileTicket === fileGeneration) fileInput.value = '';
    }
  });
  appendButton.addEventListener('click', () => {
    if (!preview) return;
    try {
      const count = preview.readings.length;
      const next = commitObservationPreview(getProject(), preview);
      replaceProject(next);
      refresh();
      notice(`${count} table readings added locally with their supplied units and source rows.`);
    } catch (error) { refresh(); $('observation-table-status').textContent = error.message; }
  });
  refresh();
  return { refresh };
}
