import { observationMinute, timestampMillis } from './observation-clock.js';
import { records } from './csv-records.js';
import { validateProject } from './core.js';
import { DEPTH_UNITS, decimalValue } from './observation-units.js';

const REQUIRED = ['cell', 'depth', 'uncertainty', 'unit', 'source'];
const OPTIONAL = ['scenario', 'use'];
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function appendObservations(project, readings) {
  validateProject(project);
  if (!Array.isArray(readings) || !readings.length) throw new Error('No observation rows to append');
  if (project.observations.length + readings.length > 100) throw new Error('Import would exceed the notebook limit of 100 observations');
  const originKey = reading => reading.tableSource ? JSON.stringify([
    reading.tableSource.fileName, reading.tableSource.line, reading.tableSource.unit,
    reading.tableSource.depthValue, reading.tableSource.uncertaintyValue,
    reading.cellIndex, reading.minute, reading.source,
    ...(reading.tableSource.timestamp === undefined ? [] : [
      timestampMillis(reading.tableSource.timestamp), timestampMillis(reading.tableSource.eventStart),
    ]),
  ]) : null;
  const seen = new Set(project.observations.map(originKey).filter(Boolean));
  for (const reading of readings) {
    const key = originKey(reading);
    if (key && seen.has(key)) throw new Error(`Line ${reading.tableSource.line}: this table reading is already in the notebook or repeated in the import`);
    if (key) seen.add(key);
  }
  const next = structuredClone(project);
  next.observations.push(...structuredClone(readings));
  validateProject(next);
  return next;
}

export function commitObservationPreview(project, preview) {
  if (!preview || preview.context !== JSON.stringify(project)) throw new Error('The site or notebook changed; preview the table again');
  return appendObservations(project, preview.readings);
}

export function previewObservationTable(text, project, fileName = 'observations.csv') {
  validateProject(project);
  if (typeof fileName !== 'string' || !fileName.trim() || fileName.length > 160) throw new Error('Supply a table filename of 1–160 characters');
  const rows = records(text);
  if (!rows.length) throw new Error('The observation table is empty');
  const headers = rows.shift().fields.map(h => h.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate observation table header');
  const clock = headers.includes('timestamp') || headers.includes('event_start');
  const timeHeaders = clock ? ['timestamp', 'event_start'] : ['minute'];
  if (timeHeaders.some(h => !headers.includes(h)) || (clock && headers.includes('minute'))) throw new Error('Use either minute or both timestamp and event_start clock columns');
  if (REQUIRED.some(h => !headers.includes(h))) throw new Error(`Required columns: ${REQUIRED.join(', ')}`);
  if (headers.some(h => !REQUIRED.includes(h) && !OPTIONAL.includes(h) && !timeHeaders.includes(h))) throw new Error('Unknown column; optional columns are scenario and use');
  if (!rows.length) throw new Error('The table contains a header but no observations');
  if (project.observations.length + rows.length > 100) throw new Error('Import would exceed the notebook limit of 100 observations');
  const readings = rows.map(row => {
    try {
      if (row.fields.length !== headers.length) throw new Error('column count does not match the header');
      const data = Object.fromEntries(headers.map((key, i) => [key, row.fields[i].trim()]));
      const match = /^([A-Z])([1-9]\d*)$/i.exec(data.cell);
      const x = match ? match[1].toUpperCase().charCodeAt(0) - 65 : -1;
      const y = match ? Number(match[2]) - 1 : -1;
      if (x < 0 || x >= project.width || y < 0 || y >= project.height) throw new Error('cell is outside the current grid');
      const unit = data.unit.toLowerCase();
      if (!owns(DEPTH_UNITS, unit)) throw new Error('unit must be mm, cm or in');
      const reading = {
        cellIndex: y * project.width + x,
        minute: clock ? observationMinute(data.timestamp, data.event_start) : decimalValue(data.minute, 'minute'),
        depthMm: decimalValue(data.depth, 'depth') * DEPTH_UNITS[unit],
        uncertaintyMm: decimalValue(data.uncertainty, 'uncertainty') * DEPTH_UNITS[unit],
        source: data.source,
        scenario: data.scenario || 'unassigned', use: data.use || 'unassigned',
        tableSource: { fileName, line: row.line, unit, depthValue: data.depth, uncertaintyValue: data.uncertainty, ...(clock ? {timestamp: data.timestamp, eventStart: data.event_start} : {}) },
      };
      validateProject({ ...project, observations: [reading] });
      return reading;
    } catch (error) { throw new Error(`Line ${row.line}: ${error.message}`); }
  });
  if (clock && new Set(readings.map(r => timestampMillis(r.tableSource.eventStart))).size !== 1) throw new Error('Every row must declare the same event-start instant');
  // Reuse the same transactional gate as commit, including local duplicate rows.
  appendObservations(project, readings);
  return { fileName, readings, context: JSON.stringify(project), convertedCount: readings.filter(o => o.tableSource.unit !== 'mm').length,
    unassignedCount: readings.filter(o => o.scenario === 'unassigned' || o.use === 'unassigned').length };
}
