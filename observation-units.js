export const DEPTH_UNITS = Object.freeze({ mm: 1, cm: 10, in: 25.4 });
const owns = (o, key) => Object.prototype.hasOwnProperty.call(o, key);

export function decimalValue(text, name) {
  if (typeof text !== 'string' || text.length > 64 ||
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text.trim())) {
    throw new Error(`${name} must be a finite decimal number`);
  }
  const value = Number(text);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite decimal number`);
  return value;
}

export function validateObservationOrigin(reading) {
  if (reading.tableSource === undefined) return;
  const source = reading.tableSource;
  if (!source || typeof source.fileName !== 'string' || !source.fileName.trim() || source.fileName.length > 160 ||
      !Number.isInteger(source.line) || source.line < 2 || source.line > 128000 ||
      typeof source.unit !== 'string' || !owns(DEPTH_UNITS, source.unit)) {
    throw new Error('Invalid observation table source');
  }
  for (const [key, actual] of [['depthValue', reading.depthMm], ['uncertaintyValue', reading.uncertaintyMm]]) {
    const expected = decimalValue(source[key], key) * DEPTH_UNITS[source.unit];
    const tolerance = Number.EPSILON * 32 * Math.max(1, Math.abs(expected));
    if (!Number.isFinite(expected) || Math.abs(expected - actual) > tolerance) {
      throw new Error('Observation value does not match its retained unit conversion');
    }
  }
}
