import { previewTerrainTable, applyTerrainPreview } from './terrain-import.js';
import { mountTerrainRasterImport } from './terrain-raster-panel.js';

const $ = id => document.getElementById(id);
export function mountTerrainImport({ getProject, replaceProject, notice }) {
  const rasterImporter = mountTerrainRasterImport({ getProject, replaceProject, notice });
  let preview = null, generation = 0;
  function clear() {
    generation++; preview = null;
    $('apply-terrain').disabled = true;
    $('terrain-preview').replaceChildren();
  }
  function refresh() {
    clear();
    rasterImporter.refresh();
    $('terrain-status').textContent = 'Preview a complete table for the current grid. A changed project clears the preview.';
  }
  for (const id of ['terrain-datum', 'terrain-spacing']) $(id).addEventListener('input', refresh);
  $('terrain-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    clear();
    const ticket = generation, project = getProject();
    const options = { fileName: file.name, datum: $('terrain-datum').value.trim(), cellSizeM: Number($('terrain-spacing').value) };
    try {
      if (file.size > 128000) throw new Error('Terrain table exceeds the 128 KB limit');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      if (ticket !== generation || project !== getProject()) return;
      preview = previewTerrainTable(text, project, options);
      $('terrain-status').textContent = `${preview.cells.length} supplied elevations ready, relative to “${options.datum}”, ${options.cellSizeM} m cell spacing. No grid has changed.`;
      for (let index = 0; index < preview.cells.length; index++) {
        const cell = preview.cells[index], origin = cell.terrainSource;
        const item = document.createElement('li');
        item.textContent = `${String.fromCharCode(65 + index % project.width)}${Math.floor(index / project.width) + 1}: ${cell.elevationM} m (supplied ${origin.elevationValue} ± ${origin.uncertaintyValue} ${origin.unit}) · line ${origin.line} · ${origin.source}`;
        $('terrain-preview').append(item);
      }
      $('apply-terrain').disabled = false;
    } catch (error) {
      if (ticket === generation) { clear(); $('terrain-status').textContent = `Import refused: ${error.message}`; }
    } finally { event.target.value = ''; }
  });
  $('apply-terrain').addEventListener('click', () => {
    if (!preview) return;
    try {
      const target = $('terrain-target').value;
      const next = applyTerrainPreview(getProject(), preview, target);
      replaceProject(next);
      notice(`Supplied elevations applied to ${target}. Check that retained readings still describe this geometry.`);
    } catch (error) { refresh(); $('terrain-status').textContent = error.message; }
  });
  return { refresh };
}
