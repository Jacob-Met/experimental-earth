import { decimalValue } from './observation-units.js';
const units = new Set(['L','mL','m3']);
const roles = new Set(['','unassigned','calibration','challenge']);
export function validateOutletTableOrigin(reading) {
  if (!reading || reading.tableSource === undefined) return;
  const s = reading.tableSource;
  if (!s || typeof s.fileName !== 'string' || !s.fileName.trim() || s.fileName.length > 160 ||
      !Number.isInteger(s.line) || s.line < 2 || s.line > 128000 || !units.has(s.unit) || s.unit !== reading.unit ||
      typeof s.sourceText !== 'string' || s.sourceText.length > 300 || s.sourceText.trim() !== reading.source ||
      typeof s.useValue !== 'string' || s.useValue.length > 64 || !roles.has(s.useValue.trim())) throw Error('Invalid original collection table source.');
  for (const [key,actual] of [['startMinuteValue',reading.startMinute],['endMinuteValue',reading.endMinute],['volumeValue',reading.volume],['uncertaintyValue',reading.uncertainty]]) {
    if (decimalValue(s[key],key) !== actual) throw Error('Collection quantity differs from its original table value.');
  }
}
export function outletTableOriginKey(reading) {
  return reading.tableSource ? JSON.stringify([reading.tableSource.fileName,reading.tableSource.line,reading.tableSource.startMinuteValue,
    reading.tableSource.endMinuteValue,reading.tableSource.volumeValue,reading.tableSource.uncertaintyValue,reading.tableSource.unit,reading.tableSource.sourceText]) : null;
}
