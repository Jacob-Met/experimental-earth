import { prepareShadeHeatSource, parseShadeHeatSource, checkShadeHeatBytes } from './shade-heat.js';
import { normalizeProfileRangeQuery } from './shade-heat-profile-range.js';
import { prepareShadeHeatProfileEvidenceSource, SHADE_HEAT_PROFILE_EVIDENCE_KIND,
  SHADE_HEAT_PROFILE_EVIDENCE_MODEL } from './shade-heat-profile-evidence.js';

export const TIMED_SKY_READING_KIND = 'experimental-earth/shared-sky-original-time-reading-inputs/1';
export const TIMED_SKY_READING_MODEL = Object.freeze({ name: 'shared-sky-original-time-temperature-reading', version: 1,
  observation: 'one instantaneous original existing-surface or lower-store band at its saved receiver and exact original boundary UTC',
  source: 'complete unchanged original site, thermal declarations, forcing and time grid',
  arithmetic: 'exact represented original-band endpoints; no inferred interval mean or nearest-time substitution' });
export const exactSkyKeys = (v, keys) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
export const sameSkyData = (a, b) => {
  if (Object.is(a,b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b,key) && sameSkyData(a[key],b[key]));
};

// Mirrors only the original source clock construction, without geometry/thermal
// execution. Evaluation verifies every identity against the maintained adapter.
export function originalSkyReadingTimes(source) {
  const path = source.declaration.path, start = Date.parse(path.startUtc), end = Date.parse(path.endUtc);
  const count = Math.ceil((end-start)/(path.stepMinutes*60000));
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isInteger(count) || count < 1 || count > 24)
    throw Error('Retain a complete bounded original clock');
  let elapsed = 0;
  return [{index:0,utc:path.startUtc,minute:0,thermalMinute:0}, ...Array.from({length:count},(_,i) => {
    const from = start + i*path.stepMinutes*60000, to = Math.min(end,from+path.stepMinutes*60000);
    const fromMinute = (from-start)/60000, minute = (to-start)/60000;
    elapsed += minute-fromMinute;
    return {index:i+1,utc:new Date(to).toISOString(),minute,thermalMinute:elapsed};
  })];
}

function queryFor(source, query) {
  if (!exactSkyKeys(query,['bins','reading'])) throw Error('Retain only the original bin declaration and attributed reading');
  const {bins} = normalizeProfileRangeQuery({bins:query.bins}), r = query.reading;
  if (!exactSkyKeys(r,['target','store','aggregation','cellIndex','utc','temperatureC','halfWidthC','source'])
      || r.target !== 'existing' || !['surfaceC','subsurfaceC'].includes(r.store) || r.aggregation !== 'instant'
      || r.cellIndex !== source.project.heatColumnStudy.heatStudy.cellIndex
      || !originalSkyReadingTimes(source).some(time => time.utc === r.utc))
    throw Error('Bind the original instant reading to its saved receiver, existing temperature component and exact original boundary UTC');
  if (!Number.isFinite(r.temperatureC) || r.temperatureC < -100 || r.temperatureC > 500
      || !Number.isFinite(r.halfWidthC) || r.halfWidthC < 0 || r.halfWidthC > 600)
    throw Error('Use an original temperature from -100 to 500 C and half-width from 0 to 600 C');
  if (typeof r.source !== 'string' || !r.source.trim() || r.source.length > 400)
    throw Error('Attribute the original reading using 1 to 400 source characters');
  return {bins,reading:{...r}};
}

export function prepareTimedSkyReadingSource(project, declaration, query) {
  const source = prepareShadeHeatSource(project,declaration);
  const result = {kind:TIMED_SKY_READING_KIND,model:{...TIMED_SKY_READING_MODEL},source,query:queryFor(source,query)};
  checkShadeHeatBytes(new Blob([JSON.stringify(result)]).size);
  return result;
}

export function normalizeTimedSkyOriginal(raw) {
  checkShadeHeatBytes(new Blob([JSON.stringify(raw)]).size);
  if (!exactSkyKeys(raw,['kind','model','source','query'])) throw Error('Supply original reading inputs without calculated result fields');
  const old = raw.kind === SHADE_HEAT_PROFILE_EVIDENCE_KIND;
  const model = old ? SHADE_HEAT_PROFILE_EVIDENCE_MODEL : TIMED_SKY_READING_MODEL;
  if ((!old && raw.kind !== TIMED_SKY_READING_KIND) || !sameSkyData(raw.model,model))
    throw Error('Unsupported original reading model');
  const source = parseShadeHeatSource(JSON.stringify(raw.source));
  // Legacy final-only records keep their original kind, model, UTC and bin history.
  return old ? prepareShadeHeatProfileEvidenceSource(source.project,source.declaration,raw.query)
    : prepareTimedSkyReadingSource(source.project,source.declaration,raw.query);
}

export function parseTimedSkyReadingSource(text) {
  if (typeof text !== 'string') throw TypeError('Original reading inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);
  let raw;try {raw=JSON.parse(text);} catch {throw Error('Invalid original reading JSON');}
  return normalizeTimedSkyOriginal(raw);
}

export function sharedSkySite(source) {
  const {selectedIndex,surfaceHeatStudy,heatColumnStudy,...place} = source.project;
  return {place,declaration:source.declaration};
}
