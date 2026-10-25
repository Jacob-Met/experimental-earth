import { parseTerrainRaster, previewTerrainRaster, applyTerrainRasterPreview } from './terrain-raster-import.js';
import { TERRAIN_RASTER_MAX_BYTES } from './terrain-raster-contract.js';

const $ = id => document.getElementById(`raster-${id}`);
const units = '<option value="">Choose source units</option><option value="m">Metres</option><option value="cm">Centimetres</option><option value="mm">Millimetres</option>';

export function mountTerrainRasterImport({ getProject, replaceProject, notice }) {
  const host = document.createElement('details'); host.id = 'terrain-raster-import';
  host.innerHTML = `<summary>Import an elevation raster (.asc)</summary>
    <p class="mini-note">Read the original grid instead of transcribing each elevation. Select a rectangle matching this site's cells. The source's first data row is the top of the map; missing cells stay unavailable.</p>
    <label class="input-label">Original ASCII grid file<input id="raster-file" type="file" accept=".asc,.txt,text/plain"></label>
    <p id="raster-file-status" class="mini-note" role="status">Choose a file to read its grid dimensions and spacing.</p>
    <div class="input-pair"><label class="input-label">Source or dataset reference<input id="raster-source" maxlength="240" placeholder="Dataset title or original download URL"></label><label class="input-label">Source coordinate reference<input id="raster-crs" maxlength="240" placeholder="Named reference, or explicitly “not supplied”"></label></div>
    <div class="input-pair"><label class="input-label">Horizontal units<select id="raster-horizontal">${units}</select></label><label class="input-label">Elevation units<select id="raster-vertical">${units}</select></label></div>
    <div class="input-pair"><label class="input-label">First source row (top = 1)<input id="raster-row" type="number" min="1" step="1" value="1"></label><label class="input-label">First source column (left = 1)<input id="raster-column" type="number" min="1" step="1" value="1"></label></div>
    <label class="input-label">Optional local zero, in original elevation units<input id="raster-reference" type="number" step="any" placeholder="Blank: use the first selected source sample"></label>
    <p class="mini-note">The local zero shifts all selected elevations equally. Use the same reference for plans you compare, including any declared barrier crests. Spacing must match the current site; coordinates are retained without reprojection. The file does not supply measurement uncertainty.</p>
    <label class="input-label">Receive elevations in<select id="raster-target"><option value="existing">Existing site only</option><option value="proposal">Proposed site only</option><option value="both">Both grids, keeping their different surfaces</option></select></label>
    <div class="obs-actions"><button id="raster-preview-button" type="button" class="subtle" disabled>Preview original window</button><button id="raster-apply" type="button" class="subtle" disabled>Apply raster elevations</button></div>
    <p id="raster-status" class="mini-note" role="status" style="overflow-wrap:anywhere"></p>
    <ol id="raster-preview" style="max-height:16rem;overflow:auto;overflow-wrap:anywhere" tabindex="0" aria-label="Original elevation window"></ol>`;
  document.getElementById('terrain-status').closest('section').append(host);
  let rawText = null, fileName = null, preview = null, generation = 0;
  function refresh() {
    generation++; preview = null; $('apply').disabled = true; $('preview').replaceChildren();
    $('preview-button').disabled = rawText === null;
    if (rawText === null) $('file-status').textContent = 'Choose a file to read its grid dimensions and spacing.';
    $('status').textContent = 'Preview the selected source window before changing the site. Changed inputs or a changed site retire this preview.';
  }
  for (const id of ['source', 'crs', 'horizontal', 'vertical', 'row', 'column', 'reference', 'target']) $(id).addEventListener('input', refresh);
  $('file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    rawText = null; fileName = null; refresh(); const ticket = generation;
    $('file-status').textContent = 'Reading the original raster…';
    try {
      if (file.size > TERRAIN_RASTER_MAX_BYTES) throw Error('Original raster exceeds 8 MiB');
      const original = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
      if (ticket !== generation) return;
      const { header } = parseTerrainRaster(original);
      rawText = original; fileName = file.name;
      $('file-status').textContent = `${fileName}: ${header.ncols} columns × ${header.nrows} rows; spacing ${header.cellSize} in source horizontal units; lower-left ${header.origin} (${header.xll}, ${header.yll}). NoData = ${header.noDataValue}.`;
      refresh();
    } catch (error) {
      if (ticket === generation) { rawText = null; refresh(); $('file-status').textContent = `Raster refused: ${error.message}`; }
    } finally { event.target.value = ''; }
  });
  $('preview-button').addEventListener('click', async () => {
    refresh(); if (rawText === null) return;
    const ticket = generation, project = getProject(); $('preview-button').disabled = true;
    try {
      const reference = $('reference').value.trim();
      const candidate = await previewTerrainRaster(rawText, project, { fileName,
        source: $('source').value, coordinateReference: $('crs').value,
        horizontalUnit: $('horizontal').value, verticalUnit: $('vertical').value,
        row: Number($('row').value), column: Number($('column').value),
        referenceValue: reference === '' ? null : Number(reference) });
      if (ticket !== generation || project !== getProject() || candidate.context !== JSON.stringify(getProject())) return;
      preview = candidate;
      $('status').textContent = `${preview.cells.length} original elevations ready. ${preview.datum}. Sample coordinates and source identity will be retained. No elevations have changed; uncertainty remains unspecified.`;
      for (const [i, cell] of preview.cells.entries()) {
        const item = document.createElement('li'), s = cell.rasterSource;
        item.textContent = `${String.fromCharCode(65 + i % project.width)}${Math.floor(i / project.width) + 1}: ${cell.elevationM.toLocaleString('en-US', {maximumSignificantDigits: 8})} m locally · original row ${s.row}, column ${s.column}, line ${s.line}: ${s.originalValue} ${s.verticalUnit} · source center (${s.x}, ${s.y}) ${s.horizontalUnit}`;
        $('preview').append(item);
      }
      $('apply').disabled = false;
    } catch (error) {
      if (ticket === generation) { preview = null; $('apply').disabled = true; $('status').textContent = `Preview refused: ${error.message}`; }
    } finally { if (ticket === generation) $('preview-button').disabled = rawText === null; }
  });
  $('apply').addEventListener('click', () => {
    if (!preview) return;
    try {
      const target = $('target').value;
      replaceProject(applyTerrainRasterPreview(getProject(), preview, target));
      notice(`Original raster elevations applied to ${target === 'both' ? 'both grids' : target}. Surfaces and notebook readings were retained; check that they still describe this geometry.`);
    } catch (error) { refresh(); $('status').textContent = `Apply refused: ${error.message}`; }
  });
  refresh();
  return { refresh };
}
