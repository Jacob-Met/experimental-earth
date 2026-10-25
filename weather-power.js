export const POWER_HOURLY_FORMAT = 'nasa-power-hourly-point-json/1';
export const POWER_HOURLY_MAX_BYTES = 256 * 1024;
const parameters = ['ALLSKY_SFC_SW_DNI', 'ALLSKY_SFC_SW_DIFF', 'T2M'];
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const text = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 400;

export function checkPowerHourlyBytes(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > POWER_HOURLY_MAX_BYTES) {
    throw Error('The original hourly weather JSON must be at most 256 KiB');
  }
}

function utcDay(day) {
  if (typeof day !== 'string' || !/^\d{8}$/.test(day)) throw Error('The weather header must declare one UTC calendar date');
  const iso = `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T00:00:00.000Z`;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== iso
      || Number(day.slice(0, 4)) < 2001 || Number(day.slice(0, 4)) > 2100) {
    throw Error('The weather header date must exist within the supported years 2001–2100');
  }
  return ms;
}

/** Receive a complete single UTC day from an original POWER hourly point JSON.
 * Its hourly radiation unit is energy per area. Divide by the original one-hour
 * interval to obtain mean flux; equal numeric values do not mean equal units.
 * Local file metadata identifies a source, but does not authenticate that source.
 */
export function parsePowerHourly(rawText) {
  if (typeof rawText !== 'string') throw TypeError('Hourly weather must be original JSON text');
  checkPowerHourlyBytes(new TextEncoder().encode(rawText).byteLength);
  let value;
  try { value = JSON.parse(rawText); } catch { throw Error('Invalid hourly weather JSON'); }
  if (!record(value) || value.type !== 'Feature' || value.geometry?.type !== 'Point') {
    throw Error('Use the original NASA POWER hourly point JSON response');
  }
  const coordinates = value.geometry.coordinates, header = value.header;
  if (!Array.isArray(coordinates) || ![2, 3].includes(coordinates.length)
      || !finite(coordinates[0], -180, 180) || !finite(coordinates[1], -90, 90)
      || Math.abs(coordinates[1]) === 90
      || (coordinates.length === 3 && !finite(coordinates[2], -12000, 12000))) {
    throw Error('The weather point requires a supported longitude and non-polar latitude');
  }
  if (!record(header) || header.time_standard !== 'UTC') {
    throw Error('Request time-standard=UTC; local solar time is not silently relabeled as UTC');
  }
  if (header.api?.name !== 'POWER Hourly API' || !text(header.api?.version)
      || !text(header.title) || !Array.isArray(header.sources) || !header.sources.length
      || !header.sources.every(text) || !finite(header.fill_value, -1e20, 1e20)) {
    throw Error('Retain the original hourly API, source and missing-value header');
  }
  if (header.start !== header.end) throw Error('Request one complete UTC day; multi-day files are not truncated');
  const start = utcDay(header.start), keys = Array.from({ length: 24 }, (_, hour) => header.start + String(hour).padStart(2, '0'));
  const data = value.properties?.parameter;
  if (!record(data) || !record(value.parameters)) throw Error('The original parameter data and unit metadata are required');
  for (const parameter of parameters) {
    const expectedUnit = parameter === 'T2M' ? 'C' : 'Wh/m^2';
    if (value.parameters[parameter]?.units !== expectedUnit) {
      throw Error(`${parameter} must retain the supported original unit ${expectedUnit}`);
    }
    if (!record(data[parameter]) || Object.keys(data[parameter]).length !== 24
        || !keys.every(key => Object.hasOwn(data[parameter], key))) {
      throw Error(`${parameter} must contain all 24 matching start-of-hour UTC records; missing hours are not filled`);
    }
  }
  const intervals = keys.map((key, hour) => {
    const original = Object.fromEntries(parameters.map(parameter => [parameter, data[parameter][key]]));
    if (parameters.some(parameter => original[parameter] === header.fill_value)) {
      throw Error(`Missing weather at ${key}: the declared fill value is not zero`);
    }
    if (!finite(original.ALLSKY_SFC_SW_DNI, 0, 2000) || !finite(original.ALLSKY_SFC_SW_DIFF, 0, 2000)
        || original.ALLSKY_SFC_SW_DNI + original.ALLSKY_SFC_SW_DIFF > 2000
        || !finite(original.T2M, -100, 200)) {
      throw Error(`Unsupported weather value at ${key}; values are not clamped or converted from strings`);
    }
    const from = start + hour * 3600000, to = from + 3600000, durationHours = (to - from) / 3600000;
    return { sourceKey: key, fromUtc: new Date(from).toISOString(), toUtc: new Date(to).toISOString(),
      durationHours, original,
      directNormalWm2: original.ALLSKY_SFC_SW_DNI / durationHours,
      diffuseHorizontalWm2: original.ALLSKY_SFC_SW_DIFF / durationHours,
      reservoirC: original.T2M };
  });
  return { format: POWER_HOURLY_FORMAT, rawText,
    latitudeDeg: coordinates[1], longitudeDeg: coordinates[0],
    startUtc: intervals[0].fromUtc, endUtc: intervals.at(-1).toUtc, stepMinutes: 60,
    source: { title: header.title, api: structuredClone(header.api), sources: [...header.sources],
      timeStandard: header.time_standard, fillValue: header.fill_value,
      units: Object.fromEntries(parameters.map(parameter => [parameter, value.parameters[parameter].units])) },
    intervals };
}
