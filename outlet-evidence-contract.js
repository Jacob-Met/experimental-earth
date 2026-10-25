import { validateOutletTableOrigin } from './outlet-table-origin.js';
// Source-bound collected volumes. No solver or DOM dependency.
export const OUTLET_EVIDENCE_SCHEMA = 'experimental-earth-outlet-evidence/1';
export const OUTLET_UNITS = Object.freeze({ L: 1, mL: 0.001, m3: 1000 });
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const bounded = (n, lo, hi) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
const text = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;

export function validateOutletRates(rates) {
  if (!Array.isArray(rates) || rates.length < 2 || rates.length > 9 ||
      !rates.every(n => bounded(n, 0, 10)) || new Set(rates).size !== rates.length) {
    throw new Error('Choose 2–9 distinct outlet coefficients from 0 to 10 per hour.');
  }
  return rates;
}

export function canonicalEvidence(value, depth = 0) {
  if (depth > 12) throw new Error('Event metadata is too deeply nested.');
  if (Array.isArray(value)) return value.map(item => canonicalEvidence(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonicalEvidence(value[key], depth + 1)]));
  return value;
}

/** Keep the observed scenario/forcing fixed. Rates and numerical interval may vary. */
export function outletContext(project, target) {
  if (!['existing', 'proposal'].includes(target)) throw new Error('Choose the observed scenario.');
  const weather = Object.fromEntries(Object.entries(project.weather).filter(
    ([key]) => !['boundaryExitPerHour', 'stepMinutes'].includes(key)));
  return JSON.stringify(canonicalEvidence({ target, width: project.width, height: project.height,
    source: project.source ?? '', cells: project[target], weather }));
}

export function validateOutletEvidence(record) {
  if (record === undefined) return;
  if (!record || record.schema !== OUTLET_EVIDENCE_SCHEMA ||
      !['existing', 'proposal'].includes(record.target) || !text(record.eventRef, 200) ||
      record.coverage !== 'all-modeled-edges' || !text(record.collectionSource, 400) ||
      !text(record.contextJson, 400000) || !bounded(record.durationMinutes, 5, 720) ||
      !Array.isArray(record.readings) || record.readings.length > 80) {
    throw new Error('Outflow evidence needs an event, an entire-boundary collection source and a retained site context.');
  }
  validateOutletRates(record.ratesPerHour);
  for (const reading of record.readings) {
    validateOutletTableOrigin(reading);
    if (!reading || !bounded(reading.startMinute, 0, record.durationMinutes) ||
        !bounded(reading.endMinute, 0, record.durationMinutes) || reading.endMinute <= reading.startMinute ||
        !own(OUTLET_UNITS, reading.unit) || !bounded(reading.volume, 0, 1e15) ||
        !bounded(reading.uncertainty, 0, 1e15) ||
        reading.volume * OUTLET_UNITS[reading.unit] > 1e12 || reading.uncertainty * OUTLET_UNITS[reading.unit] > 1e12 ||
        !text(reading.source, 300) || !['calibration', 'challenge', 'unassigned'].includes(reading.use)) {
      throw new Error('Each volume needs a valid interval, source, role and bounded L, mL or m3 quantities.');
    }
  }
  return record;
}
