import { decimalValue as decimal } from './observation-units.js';
import { records } from './csv-records.js';
import { validateSurfaceTemperatureReadings } from './surface-temperature-readings.js';

const columns = ['minute', 'from_minute', 'aggregation', 'temperature', 'half_width', 'unit', 'use', 'source'];

/** Explicit original-unit intake; does not infer units, roles, or observation times.
 * Provenance stays in the existing editable source field, with no new evidence type. */
export function previewTemperatureTable(text, durationMinutes, fileName) {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) throw Error('Save a supported thermal exposure before importing readings');
  if (typeof fileName !== 'string' || !fileName.trim() || fileName.length > 160) throw Error('Retain a file name of 1–160 characters');
  const rows = records(text, { maxRows: 100, label: 'Temperature table', rowLabel: 'temperature' });
  const header = rows.shift()?.fields.map(x => x.trim().toLowerCase());
  if (!header || header.length !== columns.length || new Set(header).size !== columns.length || columns.some(x => !header.includes(x))) throw Error(`Temperature columns must be ${columns.join(', ')}`);
  if (!rows.length) throw Error('Supply at least one original temperature reading');
  const originals = [], readings = rows.map(row => {
    if (row.fields.length !== columns.length) throw Error(`Line ${row.line}: column count differs from header`);
    const raw = Object.fromEntries(header.map((key, i) => [key, row.fields[i]]));
    const unit = raw.unit.trim();
    if (!['C', 'F', 'K'].includes(unit)) throw Error(`Line ${row.line}: explicitly declare C, F or K`);
    const value = decimal(raw.temperature, 'Temperature'), halfWidth = decimal(raw.half_width, 'Half-width');
    if (halfWidth < 0) throw Error(`Line ${row.line}: half-width must be nonnegative`);
    if (!raw.source.trim()) throw Error(`Line ${row.line}: retain the original source`);
    const aggregation = raw.aggregation.trim();
    if (!['instant', 'interval-mean'].includes(aggregation)) throw Error(`Line ${row.line}: declare instant or interval-mean`);
    if (aggregation === 'instant' && raw.from_minute.trim()) throw Error(`Line ${row.line}: an instantaneous reading cannot have an interval start`);
    const original = { fileName, line: row.line, ...raw };
    const source = 'Original temperature CSV: ' + JSON.stringify(original);
    if (source.length > 600) throw Error(`Line ${row.line}: original provenance exceeds the 600-character source limit; shorten the file name/source without discarding its basis`);
    const reading = { minute: decimal(raw.minute, 'Elapsed minute'), temperatureC: unit === 'F' ? (value - 32) * 5 / 9 : unit === 'K' ? value - 273.15 : value,
      halfWidthC: unit === 'F' ? halfWidth * 5 / 9 : halfWidth, use: raw.use.trim(), source };
    if (aggregation === 'interval-mean') { reading.aggregation = aggregation; reading.fromMinute = decimal(raw.from_minute, 'Interval start'); }
    originals.push(original);
    return reading;
  });
  validateSurfaceTemperatureReadings(readings, durationMinutes);
  return { fileName, durationMinutes, originals, readings };
}
