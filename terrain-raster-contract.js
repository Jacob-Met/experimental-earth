const finite = value => typeof value === 'number' && Number.isFinite(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

export const TERRAIN_RASTER_MAX_BYTES = 8 * 1024 * 1024;
export const TERRAIN_RASTER_MAX_CELLS = 1024 * 1024;

export function validateRasterHeader(header) {
  if (!header || !Number.isSafeInteger(header.ncols) || header.ncols < 1 ||
      !Number.isSafeInteger(header.nrows) || header.nrows < 1 ||
      header.ncols * header.nrows > TERRAIN_RASTER_MAX_CELLS ||
      !['corner', 'center'].includes(header.origin) ||
      !finite(header.xll) || !finite(header.yll) ||
      !finite(header.cellSize) || header.cellSize <= 0 || !finite(header.noDataValue)) {
    throw Error('Invalid or oversized elevation raster header');
  }
}

/** Original samples identify an input; no measurement error is inferred. */
export function validateRasterOrigin(cell, cellSizeM, units) {
  const origin = cell.rasterSource;
  if (origin === undefined) return;
  if (cell.terrainSource !== undefined) throw Error('A cell cannot have both survey and raster elevation origins');
  if (!origin || origin.kind !== 'supplied-elevation-raster/1' ||
      !text(origin.fileName, 200) || !text(origin.source, 240) ||
      !text(origin.coordinateReference, 240) || !text(origin.datum, 160) ||
      typeof origin.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(origin.sha256) ||
      !Number.isSafeInteger(origin.byteLength) || origin.byteLength < 1 || origin.byteLength > TERRAIN_RASTER_MAX_BYTES ||
      !Object.hasOwn(units, origin.horizontalUnit) || !Object.hasOwn(units, origin.verticalUnit) ||
      !finite(origin.referenceValue) || !finite(origin.originalValue) ||
      !Number.isSafeInteger(origin.line) || origin.line < 6) {
    throw Error('Invalid original raster elevation source');
  }
  validateRasterHeader(origin.header);
  const h = origin.header;
  if (!Number.isSafeInteger(origin.row) || origin.row < 1 || origin.row > h.nrows ||
      !Number.isSafeInteger(origin.column) || origin.column < 1 || origin.column > h.ncols ||
      origin.originalValue === h.noDataValue ||
      h.cellSize * units[origin.horizontalUnit] !== cellSizeM ||
      (origin.originalValue - origin.referenceValue) * units[origin.verticalUnit] !== cell.elevationM) {
    throw Error('Terrain elevation or spacing disagrees with its original raster sample');
  }
  const half = h.origin === 'corner' ? 0.5 : 0;
  const x = h.xll + (origin.column - 1 + half) * h.cellSize;
  const y = h.yll + (h.nrows - origin.row + half) * h.cellSize;
  if (!finite(x) || !finite(y) || origin.x !== x || origin.y !== y) {
    throw Error('Raster source coordinates disagree with its original header and sample');
  }
}
