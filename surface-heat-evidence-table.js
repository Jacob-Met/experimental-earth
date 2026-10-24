import { records } from './csv-records.js';
import { decimalValue } from './observation-units.js';

const hypothesisColumns = ['label', 'absorptivity', 'capacity_j_m2_k', 'exchange_w_m2_k', 'initial_c', 'source'];
const readingColumns = ['minute', 'temperature_c', 'half_width_c', 'use', 'source'];
function table(text, columns, maxRows, label) {
  const rows = records(text, { maxRows, label, rowLabel: label.toLowerCase() });
  const header = rows.shift()?.fields.map(s => s.trim().toLowerCase());
  if (!header || header.length !== columns.length || new Set(header).size !== columns.length || columns.some(k => !header.includes(k))) {
    throw Error(`${label} columns must be ${columns.join(', ')}.`);
  }
  return rows.map(row => {
    if (row.fields.length !== header.length) throw Error(`Line ${row.line}: ${label.toLowerCase()} column count differs from header.`);
    return Object.fromEntries(header.map((key, i) => [key, row.fields[i]]));
  });
}
export function parseHeatHypotheses(text) {
  return table(text, hypothesisColumns, 12, 'Heat hypotheses').map(r => ({ label: r.label,
    absorptivity: decimalValue(r.absorptivity, 'absorptivity'), capacityJm2K: decimalValue(r.capacity_j_m2_k, 'heat capacity'),
    exchangeWm2K: decimalValue(r.exchange_w_m2_k, 'exchange'), initialC: decimalValue(r.initial_c, 'initial temperature'), source: r.source }));
}
export function parseHeatReadings(text) {
  return table(text, readingColumns, 100, 'Temperature readings').map(r => ({ minute: decimalValue(r.minute, 'elapsed minute'),
    temperatureC: decimalValue(r.temperature_c, 'temperature'), halfWidthC: decimalValue(r.half_width_c, 'half-width'), use: r.use.trim(), source: r.source }));
}
const quote = value => { const s = String(value); return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
const csv = (columns, rows) => columns.join(',') + '\n' + rows.map(r => r.map(quote).join(',')).join('\n');
export const formatHeatHypotheses = rows => csv(hypothesisColumns, rows.map(r => [r.label, r.absorptivity, r.capacityJm2K, r.exchangeWm2K, r.initialC, r.source]));
export const formatHeatReadings = rows => csv(readingColumns, rows.map(r => [r.minute, r.temperatureC, r.halfWidthC, r.use, r.source]));
