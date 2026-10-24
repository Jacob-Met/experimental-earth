import { validateProject } from './core.js';
import { ELEVATION_UNITS } from './terrain-contract.js';
import { records } from './csv-records.js';

const number = value => {
  if (typeof value !== 'string' || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) throw new Error('Expected a finite decimal quantity');
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error('Expected a finite decimal quantity');
  return n;
};

export function previewTerrainTable(text, project, options) {
  const rows = records(text, { maxRows: 576, label: 'Terrain table', rowLabel: 'terrain' });
  const required = ['cell', 'elevation', 'uncertainty', 'unit', 'source'];
  if (!rows.length) throw new Error('Terrain table is empty');
  const headers = rows.shift().fields.map(value => value.trim().toLowerCase());
  if (headers.length !== required.length || new Set(headers).size !== headers.length || required.some(key => !headers.includes(key))) throw new Error(`Required columns: ${required.join(', ')}`);
  return previewTerrainRows(project, rows.map(row => {
    if (row.fields.length !== headers.length) throw new Error(`Line ${row.line}: column count does not match header`);
    return { line: row.line, values: Object.fromEntries(headers.map((key, i) => [key, row.fields[i]])) };
  }), options);
}

/** Rows carry parser-provided physical line numbers and header-keyed values. */
export function previewTerrainRows(project, rows, { fileName, datum, cellSizeM }) {
  validateProject(project);
  if (typeof fileName !== 'string' || !fileName.trim() || fileName.length > 200 ||
      typeof datum !== 'string' || !datum.trim() || datum.length > 160) throw new Error('Filename and common local elevation datum are required');
  if (cellSizeM !== project.weather.cellSizeM) throw new Error('Survey cell spacing must match the current grid cell width');
  if (!Array.isArray(rows) || rows.length !== project.width * project.height) throw new Error('Supply exactly one elevation for every current grid cell');
  const cells = new Array(rows.length);
  for (const { line, values } of rows) {
    if (!Number.isInteger(line) || line < 2 || !values) throw new Error('Invalid terrain table row');
    const match = /^([A-X])([1-9]\d*)$/i.exec(values.cell?.trim() ?? '');
    if (!match) throw new Error(`Line ${line}: invalid grid cell`);
    const x = match[1].toUpperCase().charCodeAt(0) - 65, y = Number(match[2]) - 1;
    if (x >= project.width || y >= project.height) throw new Error(`Line ${line}: cell outside the current grid`);
    const index = y * project.width + x;
    if (cells[index]) throw new Error(`Line ${line}: duplicate cell`);
    const unit = values.unit?.trim();
    if (!Object.hasOwn(ELEVATION_UNITS, unit)) throw new Error(`Line ${line}: elevation units must be m, cm or mm`);
    const elevationValue = number(values.elevation), uncertaintyValue = number(values.uncertainty);
    const elevationM = elevationValue * ELEVATION_UNITS[unit];
    if (elevationM < -10 || elevationM > 10 || uncertaintyValue < 0 || uncertaintyValue * ELEVATION_UNITS[unit] > 10) throw new Error(`Line ${line}: local elevation or uncertainty out of bounds`);
    const source = values.source?.trim();
    if (!source || source.length > 240) throw new Error(`Line ${line}: source is required (maximum 240 characters)`);
    cells[index] = { elevationM, provenance: source, terrainSource: {
      kind: 'supplied-elevation-table/1', fileName, line, datum: datum.trim(), source,
      unit, elevationValue, uncertaintyValue, cellSizeM,
    } };
  }
  return { context: JSON.stringify(project), cells };
}

export function applyTerrainPreview(project, preview, target) {
  validateProject(project);
  if (!['existing', 'proposal'].includes(target)) throw new Error('Choose the existing or proposed grid');
  if (!preview || preview.context !== JSON.stringify(project)) throw new Error('Project changed since preview. Preview the table again.');
  if (!Array.isArray(preview.cells) || preview.cells.length !== project.width * project.height) throw new Error('Invalid terrain preview');
  const next = structuredClone(project);
  next[target] = next[target].map((cell, i) => ({ ...cell, ...structuredClone(preview.cells[i]) }));
  return validateProject(next);
}
