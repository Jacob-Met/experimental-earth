import { previewObservationTable, commitObservationPreview } from './observation-table.js';

const $ = id => document.getElementById(id);
const number = value => value.toLocaleString('en-US', { maximumSignificantDigits: 6 });

export function mountObservationImport({ getProject, replaceProject, notice }) {
  let preview = null, generation = 0;
  function refresh() {
    generation++;
    preview = null;
    $('append-observation-table').disabled = true;
    $('observation-table-preview').replaceChildren();
    $('observation-table-status').textContent = 'Choose a UTF-8 CSV to preview interpreted units and evidence roles before adding any readings. A changed site or notebook clears the preview.';
  }
  $('observation-station-map').addEventListener('input', refresh);
  $('observation-table-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    refresh();
    const ticket = generation, project = getProject();
    $('observation-table-status').textContent = 'Reading the observation table…';
    try {
      if (file.size > 128000) throw new Error('Observation table exceeds the 128 KB file limit');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      if (ticket !== generation || project !== getProject()) return;
      const mappingText=$('observation-station-map').value.trim();
      if(mappingText.length>32000)throw new Error('Station map exceeds 32 KB');
      preview = previewObservationTable(text, project, file.name, mappingText?JSON.parse(mappingText):undefined);
      $('observation-table-status').textContent = `${preview.readings.length} rows ready from ${preview.fileName}; ${preview.convertedCount} converted to millimetres; ${preview.unassignedCount} notebook-only or unassigned. Nothing has been added yet.`;
      const list = $('observation-table-preview');
      for (const reading of preview.readings) {
        const row = document.createElement('li');
        const cell = `${String.fromCharCode(65 + reading.cellIndex % project.width)}${Math.floor(reading.cellIndex / project.width) + 1}`;
        row.textContent = `Line ${reading.tableSource.line} · ${cell}, ${reading.minute} min · ${number(reading.depthMm)} ± ${number(reading.uncertaintyMm)} mm (supplied ${reading.tableSource.depthValue} ± ${reading.tableSource.uncertaintyValue} ${reading.tableSource.unit}) · ${reading.scenario}, ${reading.use === 'challenge' ? 'held aside' : reading.use === 'unassigned' ? 'notebook only' : reading.use} · ${reading.source}${reading.tableSource.stationMapping ? ` · original station token ${JSON.stringify(reading.tableSource.stationValue)}; station ${reading.tableSource.stationMapping.station} → ${reading.tableSource.stationMapping.cell}; mapping source: ${reading.tableSource.stationMapping.source}` : ''}${reading.tableSource.timestamp ? ` · original ${reading.tableSource.timestamp}; declared event start ${reading.tableSource.eventStart} (clock synchronization not verified)` : ''}`;
        list.append(row);
      }
      $('append-observation-table').disabled = false;
    } catch (error) {
      if (ticket === generation) {
        preview = null; $('append-observation-table').disabled = true;
        $('observation-table-status').textContent = `Import refused: ${error.message}. Existing readings are unchanged.`;
      }
    } finally { event.target.value = ''; }
  });
  $('append-observation-table').addEventListener('click', () => {
    if (!preview) return;
    try {
      const count = preview.readings.length;
      const next = commitObservationPreview(getProject(), preview);
      replaceProject(next);
      notice(`${count} table readings added locally with their supplied units and source rows.`);
    } catch (error) { refresh(); $('observation-table-status').textContent = error.message; }
  });
  return { refresh };
}
