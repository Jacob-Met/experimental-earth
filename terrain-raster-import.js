import { validateProject } from './core.js';
import { ELEVATION_UNITS } from './terrain-contract.js';
import { TERRAIN_RASTER_MAX_BYTES, TERRAIN_RASTER_MAX_CELLS, validateRasterHeader } from './terrain-raster-contract.js';

const decimal = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const number = token => {
  if (!decimal.test(token) || !Number.isFinite(Number(token))) throw Error('Raster values must be finite decimal numbers');
  return Number(token);
};
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const headerKeys = new Set(['ncols', 'nrows', 'xllcorner', 'yllcorner', 'xllcenter', 'yllcenter', 'cellsize', 'nodata_value']);

/** ESRI row order is north/top first, regardless of physical line wrapping. */
export function parseTerrainRaster(rawText) {
  if (typeof rawText !== 'string' || !rawText.length || rawText.length > TERRAIN_RASTER_MAX_BYTES || /[^\x09\x0a\x0d\x20-\x7e]/.test(rawText)) {
    throw Error('Use a nonempty ASCII elevation raster of at most 8 MiB');
  }
  const fields = {}, lines = rawText.split('\n');
  let offset = 0, firstDataLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim(), parts = line.split(/\s+/), key = parts[0].toLowerCase();
    if (!line) { offset += lines[i].length + 1; continue; }
    if (!headerKeys.has(key)) { firstDataLine = i + 1; break; }
    if (parts.length !== 2 || Object.hasOwn(fields, key)) throw Error('Each raster header field must occur once with one value');
    fields[key] = number(parts[1]); offset += lines[i].length + 1;
  }
  const corner = Object.hasOwn(fields, 'xllcorner') && Object.hasOwn(fields, 'yllcorner');
  const center = Object.hasOwn(fields, 'xllcenter') && Object.hasOwn(fields, 'yllcenter');
  if (corner === center || (corner && ('xllcenter' in fields || 'yllcenter' in fields)) ||
      (center && ('xllcorner' in fields || 'yllcorner' in fields))) throw Error('Use matching lower-left corner or center coordinates');
  const header = { ncols: fields.ncols, nrows: fields.nrows, origin: corner ? 'corner' : 'center',
    xll: fields[corner ? 'xllcorner' : 'xllcenter'], yll: fields[corner ? 'yllcorner' : 'yllcenter'],
    cellSize: fields.cellsize, noDataValue: fields.nodata_value ?? -9999 };
  validateRasterHeader(header);
  if (!firstDataLine || firstDataLine < 6) throw Error('The original raster has no sample data after its header');
  const count = header.ncols * header.nrows;
  if (count > TERRAIN_RASTER_MAX_CELLS) throw Error('Raster exceeds the supported original sample count');
  const values = new Float64Array(count), sourceLines = new Uint32Array(count);
  let index = 0, line = firstDataLine, cursor = offset;
  const pattern = /\S+/g; pattern.lastIndex = offset;
  for (let match; (match = pattern.exec(rawText));) {
    if (index >= count) throw Error('Raster contains more samples than its original dimensions');
    for (let i = cursor; i < match.index; i++) if (rawText[i] === '\n') line++;
    values[index] = number(match[0]); sourceLines[index] = line;
    cursor = pattern.lastIndex; index++;
  }
  if (index !== count) throw Error('Raster sample count does not match its original dimensions; no samples are filled');
  return { header, values, sourceLines, rawText };
}

export async function previewTerrainRaster(rawText, project, options) {
  validateProject(project);
  project = structuredClone(project);
  const context = JSON.stringify(project);
  const { fileName, source, coordinateReference, horizontalUnit, verticalUnit,
    row = 1, column = 1, referenceValue = null } = options ?? {};
  if (!text(fileName, 200) || !text(source, 240) || !text(coordinateReference, 240) ||
      !Object.hasOwn(ELEVATION_UNITS, horizontalUnit) || !Object.hasOwn(ELEVATION_UNITS, verticalUnit)) {
    throw Error('Provide the file source, coordinate reference and explicit horizontal/vertical length units');
  }
  const parsed = parseTerrainRaster(rawText), h = parsed.header;
  if (h.cellSize * ELEVATION_UNITS[horizontalUnit] !== project.weather.cellSizeM) {
    throw Error(`Original spacing is ${h.cellSize * ELEVATION_UNITS[horizontalUnit]} m; it must match this site's ${project.weather.cellSizeM} m cells. No resampling is performed`);
  }
  if (!Number.isSafeInteger(row) || row < 1 || !Number.isSafeInteger(column) || column < 1 ||
      row + project.height - 1 > h.nrows || column + project.width - 1 > h.ncols) {
    throw Error('The selected original window must contain every current site cell');
  }
  const firstIndex = (row - 1) * h.ncols + column - 1;
  const reference = referenceValue === null ? parsed.values[firstIndex] : referenceValue;
  if (typeof reference !== 'number' || !Number.isFinite(reference)) throw Error('The vertical reference must be a finite original-unit value');
  if (referenceValue === null && reference === h.noDataValue) throw Error('The first selected source sample is NoData; it cannot define a local zero');
  const datum = referenceValue === null
    ? `Local zero at original raster row ${row}, column ${column}: ${reference} ${verticalUnit}`
    : `Declared local zero: ${reference} ${verticalUnit} in the source vertical reference`;
  const bytes = new TextEncoder().encode(rawText);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
  const half = h.origin === 'corner' ? 0.5 : 0;
  const cells = Array.from({ length: project.width * project.height }, (_, i) => {
    const sourceRow = row + Math.floor(i / project.width), sourceColumn = column + i % project.width;
    const index = (sourceRow - 1) * h.ncols + sourceColumn - 1, value = parsed.values[index];
    if (value === h.noDataValue) throw Error(`NoData at original row ${sourceRow}, column ${sourceColumn}; missing terrain is not filled`);
    const elevationM = (value - reference) * ELEVATION_UNITS[verticalUnit];
    if (!Number.isFinite(elevationM) || elevationM < -10 || elevationM > 10) throw Error('Selected local elevations must lie between −10 and 10 m; choose a suitable source window/reference');
    return { elevationM, provenance: source.trim(), rasterSource: {
      kind: 'supplied-elevation-raster/1', fileName, source: source.trim(), coordinateReference: coordinateReference.trim(),
      horizontalUnit, verticalUnit, referenceValue: reference, originalValue: value,
      datum, sha256, byteLength: bytes.byteLength, header: { ...h }, row: sourceRow, column: sourceColumn,
      line: parsed.sourceLines[index], x: h.xll + (sourceColumn - 1 + half) * h.cellSize,
      y: h.yll + (h.nrows - sourceRow + half) * h.cellSize,
    } };
  });
  // Validate the prepared source through the same contract used by a reopened site.
  const prepared = { ...project, existing: cells.map((cell, i) => {
    const next = { ...project.existing[i], ...cell }; delete next.terrainSource; return next;
  }) };
  validateProject(prepared);
  return { context, cells, header: h, datum, sha256, row, column };
}

export function applyTerrainRasterPreview(project, preview, target) {
  validateProject(project);
  if (!['existing', 'proposal', 'both'].includes(target)) throw Error('Choose which site grids receive the original elevations');
  if (!preview || preview.context !== JSON.stringify(project)) throw Error('Project changed since preview. Preview the original raster again.');
  if (!Array.isArray(preview.cells) || preview.cells.length !== project.width * project.height) throw Error('Invalid original raster preview');
  const next = structuredClone(project);
  for (const name of target === 'both' ? ['existing', 'proposal'] : [target]) {
    next[name] = next[name].map((cell, i) => {
      const result = { ...cell, ...structuredClone(preview.cells[i]) }; delete result.terrainSource; return result;
    });
  }
  return validateProject(next);
}
