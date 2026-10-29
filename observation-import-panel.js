import { previewObservationChoices, commitObservationChoices } from './observation-row-choice.js';
import { createObservationRowChoices } from './observation-row-choices-view.js';
import { admitObservationCsv, originalObservationCsvBytes, serializeObservationSource, parseObservationSource,
  MAX_OBSERVATION_CSV_BYTES, MAX_OBSERVATION_SOURCE_BYTES } from './observation-source-file.js';

const $ = id => document.getElementById(id);
const number = value => value.toLocaleString('en-US', { maximumSignificantDigits: 6 });
const chooseTable = 'Choose a UTF-8 CSV to preview interpreted units and evidence roles before adding any readings. Or open a saved original table and station map. Check the preview before adding it to the notebook.';

export function mountObservationImport({ getProject, replaceProject, notice }) {
  let preview = null, previewSource = null, selectedTable = null, retainedSource = null, reading = false;
  let fileGeneration = 0, previewGeneration = 0, saveGeneration = 0;
  const fileInput = $('observation-table-file');
  const appendButton = $('append-observation-table');
  const rowChoices = createObservationRowChoices({ appendButton, list: $('observation-table-preview') });
  const mapInput = $('observation-station-map');
  const button = (id, text) => {
    const element = document.createElement('button');
    element.id = id; element.type = 'button'; element.className = 'subtle'; element.textContent = text;
    return element;
  };
  const previewButton = button('preview-observation-table', 'Preview selected table');
  appendButton.before(previewButton);
  const rawButton = button('download-observation-csv', 'Download original CSV');
  const saveButton = button('save-observation-source', 'Save original table + map');
  const openLabel = document.createElement('label');
  openLabel.className = 'light file-label';
  openLabel.append('Open saved table + map');
  const sourceInput = document.createElement('input');
  sourceInput.id = 'observation-source-file'; sourceInput.type = 'file'; sourceInput.accept = '.json,application/json';
  openLabel.append(sourceInput);
  appendButton.parentElement.append(rawButton, saveButton, openLabel);
  const selectedLabel = document.createElement('p');
  selectedLabel.id = 'observation-table-selected'; selectedLabel.className = 'mini-note';
  appendButton.parentElement.after(selectedLabel);
  const retainedLabel = document.createElement('p');
  retainedLabel.id = 'observation-source-retained'; retainedLabel.className = 'mini-note';
  selectedLabel.after(retainedLabel);

  function sourceForDownload() {
    return selectedTable ? { source: selectedTable, stationMapText: mapInput.value } : retainedSource;
  }
  function downloadControls() {
    const disabled = reading || !sourceForDownload();
    rawButton.disabled = disabled; saveButton.disabled = disabled;
  }
  function invalidatePreview() {
    previewGeneration++; saveGeneration++;
    preview = null; previewSource = null; rowChoices.clear(); appendButton.disabled = true;
    $('observation-table-preview').replaceChildren();
  }
  function refresh() {
    fileGeneration++; saveGeneration++; reading = false;
    selectedTable = null; retainedSource = null;
    invalidatePreview(); previewButton.disabled = true; downloadControls();
    selectedLabel.hidden = true; selectedLabel.textContent = '';
    retainedLabel.hidden = true; retainedLabel.textContent = '';
    fileInput.value = ''; sourceInput.value = '';
    $('observation-table-status').textContent = chooseTable;
  }
  function previewSelectedTable() {
    if (!selectedTable || reading) return;
    invalidatePreview();
    const project = getProject();
    try {
      const originalMapText = mapInput.value;
      const mappingText = originalMapText.trim();
      if (originalMapText.length > 32000) throw new Error('Station map exceeds 32 KB');
      preview = previewObservationChoices(selectedTable.text, project, selectedTable.table.fileName, mappingText ? JSON.parse(mappingText) : undefined);
      previewSource = { source: selectedTable, stationMapText: originalMapText };
      $('observation-table-status').textContent = preview.readings.length + ' source rows previewed from ' + preview.fileName + '; ' + preview.convertedCount + ' converted to millimetres; ' + preview.unassignedCount + ' notebook-only or unassigned. Choose the rows to add. Nothing has been added yet.';
      const list = $('observation-table-preview');
      for (const reading of preview.readings) {
        const row = document.createElement('li');
        const cell = String.fromCharCode(65 + reading.cellIndex % project.width) + (Math.floor(reading.cellIndex / project.width) + 1);
        row.textContent = 'Line ' + reading.tableSource.line + ' · ' + cell + ', ' + reading.minute + ' min · ' + number(reading.depthMm) + ' ± ' + number(reading.uncertaintyMm) + ' mm (supplied ' + reading.tableSource.depthValue + ' ± ' + reading.tableSource.uncertaintyValue + ' ' + reading.tableSource.unit + ') · ' + reading.scenario + ', ' + (reading.use === 'challenge' ? 'held aside' : reading.use === 'unassigned' ? 'notebook only' : reading.use) + ' · ' + reading.source + (reading.tableSource.stationMapping ? ' · original station token ' + JSON.stringify(reading.tableSource.stationValue) + '; station ' + reading.tableSource.stationMapping.station + ' → ' + reading.tableSource.stationMapping.cell + '; mapping source: ' + reading.tableSource.stationMapping.source : '') + (reading.tableSource.timestamp ? ' · original ' + reading.tableSource.timestamp + '; declared event start ' + reading.tableSource.eventStart + ' (clock synchronization not verified)' : '');
        rowChoices.add(row, reading.tableSource.line);
        list.append(row);
      }
      rowChoices.ready();
    } catch (error) {
      preview = null; previewSource = null; appendButton.disabled = true;
      $('observation-table-status').textContent = 'Import refused: ' + error.message + '. Existing readings are unchanged. Correct the station map and preview the selected table again, or choose another CSV.';
    }
  }
  mapInput.addEventListener('input', () => {
    invalidatePreview();
    $('observation-table-status').textContent = reading
      ? 'Station map changed while the table is being read. Preview the selected table when reading finishes.'
      : selectedTable ? 'Station map changed. Preview ' + selectedTable.table.fileName + ' again before adding any readings.' : chooseTable;
  });
  previewButton.addEventListener('click', previewSelectedTable);

  async function receiveFile(event, saved) {
    const file = event.target.files?.[0];
    if (!file) return;
    const priorSource = sourceForDownload();
    const fileTicket = ++fileGeneration, project = getProject();
    invalidatePreview();
    const previewTicket = previewGeneration;
    reading = true; previewButton.disabled = true; downloadControls();
    $('observation-table-status').textContent = saved ? 'Reading the saved original table and station map…' : 'Reading the observation table…';
    try {
      const limit = saved ? MAX_OBSERVATION_SOURCE_BYTES : MAX_OBSERVATION_CSV_BYTES;
      if (file.size > limit) throw new Error(saved ? 'Saved observation source exceeds 512 KB' : 'Observation table exceeds the 128 KB file limit');
      const bytes = await file.arrayBuffer();
      if (fileTicket !== fileGeneration || project !== getProject()) return;
      const received = saved
        ? await parseObservationSource(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
        : { source: await admitObservationCsv(bytes, file.name) };
      if (fileTicket !== fileGeneration || project !== getProject()) return;
      if (saved && previewTicket !== previewGeneration) throw new Error('Station map changed while opening the saved source; select it again to restore its map');
      selectedTable = received.source; retainedSource = null;
      retainedLabel.hidden = true; retainedLabel.textContent = '';
      if (saved) mapInput.value = received.stationMapText;
      reading = false; previewButton.disabled = false; downloadControls();
      selectedLabel.hidden = false;
      selectedLabel.textContent = 'Selected table: ' + selectedTable.table.fileName + '. Original bytes are retained. Save the original table and map before leaving this project.';
      if (saved) {
        $('observation-table-status').textContent = 'Original table and supplied map restored: ' + selectedTable.table.fileName + '. Preview the selected table against the current project before adding readings. Nothing has been added.';
      } else if (previewTicket === previewGeneration) previewSelectedTable();
      else $('observation-table-status').textContent = 'Table ready: ' + selectedTable.table.fileName + '. Preview the selected table to use the current station map. Nothing has been added yet.';
    } catch (error) {
      if (fileTicket === fileGeneration) {
        reading = false; selectedTable = null; retainedSource = priorSource;
        previewButton.disabled = true; selectedLabel.hidden = true; selectedLabel.textContent = '';
        retainedLabel.hidden = !retainedSource;
        retainedLabel.textContent = retainedSource ? 'Previously accepted original: ' + retainedSource.source.table.fileName + '. It remains available for download. Re-select or reopen this source before previewing it again.' : '';
        downloadControls();
        $('observation-table-status').textContent = 'Import refused: ' + error.message + '. Existing readings are unchanged. The previous selection is retired; any retained original is available only for download.';
      }
    } finally {
      if (fileTicket === fileGeneration) event.target.value = '';
    }
  }
  fileInput.addEventListener('change', event => receiveFile(event, false));
  sourceInput.addEventListener('change', event => receiveFile(event, true));

  function download(data, name, type) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const link = document.createElement('a');
    link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }
  rawButton.addEventListener('click', () => {
    const accepted = sourceForDownload();
    if (reading || !accepted) return;
    try { download(originalObservationCsvBytes(accepted.source), accepted.source.table.fileName, 'text/csv;charset=utf-8'); }
    catch (error) { $('observation-table-status').textContent = 'Download refused: ' + error.message; }
  });
  saveButton.addEventListener('click', async () => {
    const accepted = sourceForDownload();
    if (reading || !accepted) return;
    const ticket = ++saveGeneration, fileTicket = fileGeneration, project = getProject();
    try {
      const json = await serializeObservationSource(accepted.source, accepted.stationMapText);
      const current = sourceForDownload();
      if (ticket !== saveGeneration || fileTicket !== fileGeneration || project !== getProject() ||
          current?.source !== accepted.source || current.stationMapText !== accepted.stationMapText) return;
      download(json, 'experimental-earth-observation-source.json', 'application/json');
      $('observation-table-status').textContent = 'Original CSV and supplied station-map text downloaded. Reopen this source in the matching site, then explicitly preview it. The site itself is saved with Export project.';
    } catch (error) {
      if (ticket === saveGeneration && fileTicket === fileGeneration) $('observation-table-status').textContent = 'Save refused: ' + error.message + '. Current source and readings are unchanged.';
    }
  });
  appendButton.addEventListener('click', () => {
    if (!preview || reading) return;
    const lines = rowChoices.lines(), accepted = previewSource;
    let next;
    try {
      next = commitObservationChoices(getProject(), preview, lines);
    } catch (error) {
      if (preview?.context !== JSON.stringify(getProject())) refresh();
      $('observation-table-status').textContent = 'No readings added: ' + error.message + '. Review the chosen rows and try again.';
      return;
    }
    // Only the pure gate above may report that no readings were added.
    // Keep the complete original source and exact preview map after a subset.
    replaceProject(next);
    refresh();
    retainedSource = accepted; downloadControls();
    retainedLabel.hidden = false;
    retainedLabel.textContent = 'Added ' + lines.length + ' selected readings from ' + accepted.source.table.fileName + '. Download the complete original file and the map used for these readings before leaving this project.';
    notice(lines.length + ' table readings added locally with their supplied units and source rows.');
  });
  refresh();
  return { refresh };
}
