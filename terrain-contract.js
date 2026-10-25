import { validateRasterOrigin } from './terrain-raster-contract.js';
/** Supplied survey provenance, not independent verification of site geometry. */
export const ELEVATION_UNITS = Object.freeze({ m: 1, cm: 0.01, mm: 0.001 });
const finite = value => typeof value === 'number' && Number.isFinite(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

export function validateTerrainOrigin(cell, cellSizeM) {
  validateRasterOrigin(cell, cellSizeM, ELEVATION_UNITS);
  if (cell.terrainSource === undefined) return;
  const origin = cell.terrainSource;
  if (!origin || origin.kind !== 'supplied-elevation-table/1' ||
      !text(origin.fileName, 200) || !Number.isInteger(origin.line) || origin.line < 2 ||
      !text(origin.datum, 160) || !text(origin.source, 240) ||
      !Object.hasOwn(ELEVATION_UNITS, origin.unit) ||
      !finite(origin.elevationValue) || !finite(origin.uncertaintyValue) || origin.uncertaintyValue < 0 ||
      !finite(origin.cellSizeM) || origin.cellSizeM !== cellSizeM) {
    throw new Error('Invalid supplied terrain origin or grid spacing');
  }
  const scale = ELEVATION_UNITS[origin.unit];
  if (Math.abs(origin.elevationValue * scale - cell.elevationM) > 1e-10 ||
      origin.uncertaintyValue * scale > 10) {
    throw new Error('Terrain elevation disagrees with supplied original quantities');
  }
}
