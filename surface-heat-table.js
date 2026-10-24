import { records } from './csv-records.js';
import { decimalValue } from './observation-units.js';

const columns = ['minutes', 'incident_w_m2', 'reservoir_c', 'source'];
export function parseHeatSchedule(text) {
  const rows = records(text, { maxRows: 24, label: 'Heat exposure table', rowLabel: 'exposure' });
  const header = rows.shift()?.fields.map(s => s.trim().toLowerCase());
  if (!header || header.length !== columns.length || new Set(header).size !== columns.length || columns.some(k => !header.includes(k))) {
    throw Error('Exposure columns must be minutes, incident_w_m2, reservoir_c, source');
  }
  if (!rows.length) throw Error('Supply at least one exposure interval');
  return rows.map(row => {
    if (row.fields.length !== header.length) throw Error(`Line ${row.line}: exposure column count differs from header`);
    const data = Object.fromEntries(header.map((k, i) => [k, row.fields[i]]));
    return { minutes: decimalValue(data.minutes.trim(), 'duration'), incidentWm2: decimalValue(data.incident_w_m2.trim(), 'incident flux'),
      reservoirC: decimalValue(data.reservoir_c.trim(), 'reservoir temperature'), source: data.source };
  });
}
export function formatHeatSchedule(rows) {
  const quote = s => /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  return columns.join(',') + '\n' + rows.map(r => [r.minutes, r.incidentWm2, r.reservoirC, quote(r.source)].join(',')).join('\n');
}
