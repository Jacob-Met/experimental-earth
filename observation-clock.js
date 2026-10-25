// Explicit declared clock conversion; this does not establish sensor synchronization.
export function timestampMillis(value) {
  const m = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) throw new Error('Clock times require ISO date/time, seconds and explicit Z or ±HH:MM offset');
  const [, y, mo, d, h, mi, s, fraction, zone] = m;
  const year = Number(y), month = Number(mo), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]
    || Number(h) > 23 || Number(mi) > 59 || Number(s) > 59
    || zone === '-00:00' || (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)))
    throw new Error('Invalid calendar time or unknown clock offset');
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new Error('Invalid clock time');
  return result;
}
export function observationMinute(timestamp, eventStart) {
  const minute = (timestampMillis(timestamp) - timestampMillis(eventStart)) / 60000;
  if (minute < 0) throw new Error('Observation timestamp precedes declared event start');
  return minute;
}
