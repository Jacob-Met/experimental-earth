import { prepareShadeHeatProfileEvidenceSource, SHADE_HEAT_PROFILE_EVIDENCE_KIND,
  SHADE_HEAT_PROFILE_EVIDENCE_MODEL } from './shade-heat-profile-evidence.js';
import { parseShadeHeatSource, checkShadeHeatBytes, SHADE_HEAT_LIMITS } from './shade-heat.js';
import { normalizeProfileRangeQuery, compareShadeHeatProfileRange, SHADE_HEAT_PROFILE_RANGE_LIMITS } from './shade-heat-profile-range.js';
import { intersectProfileBand, evaluateProfileMixture, profileFraction } from './shade-heat-profile-band.js';
import { sub, cmp, rational as q } from './vendor/chronos/exact-halfplanes.mjs';
import { intersectTwoProfileBands } from './shade-heat-profile-two-bands.js';

export const SPATIAL_PROFILE_KIND = 'experimental-earth/shared-sky-spatial-reading-inputs/1';
export const SPATIAL_PROFILE_MODEL = Object.freeze({ name: 'two-original-points-one-static-sky', version: 1,
  observation: 'two instantaneous original existing-surface bands at distinct saved receivers and one final UTC',
  consequence: 'paired final surface and lower-store temperatures at the first original receiver',
  sharing: 'an explicitly declared common static equal-bin sky over the same original site and forcing',
  arithmetic: 'exact simplex intersection and linear objectives over represented original temperature coefficients' });
export const SPATIAL_PROFILE_LIMITS = Object.freeze({ sources: 2,
  maxGeometryChecks: SHADE_HEAT_LIMITS.maxRayTests,
  maxCourses: 2 * SHADE_HEAT_PROFILE_RANGE_LIMITS.maxCourses,
  maxCourseIntervals: 2 * SHADE_HEAT_PROFILE_RANGE_LIMITS.maxCourseIntervals,
  maxCandidates: 2736 });
const targets = ['existing', 'proposal'], bounds = ['lower', 'upper'], stores = ['surfaceC', 'subsurfaceC'];
const exactKeys = (v, keys) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const sameData = (a, b) => {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameData(a[key], b[key]));
};
function originalReading(raw) {
  const model = SHADE_HEAT_PROFILE_EVIDENCE_MODEL;
  if (!exactKeys(raw, ['kind', 'model', 'source', 'query']) || raw.kind !== SHADE_HEAT_PROFILE_EVIDENCE_KIND
      || !exactKeys(raw.model, Object.keys(model)) || !Object.keys(model).every(key => raw.model[key] === model[key]))
    throw Error('Supply an original reading-input file; derived results and unknown reading models are not accepted');
  const source = parseShadeHeatSource(JSON.stringify(raw.source));
  return prepareShadeHeatProfileEvidenceSource(source.project, source.declaration, raw.query);
}
function sharedSiteProjection(source) {
  const { selectedIndex, surfaceHeatStudy, heatColumnStudy, ...place } = source.project;
  return { place, declaration: source.declaration };
}
function normalize(originals, query) {
  if (!Array.isArray(originals) || originals.length !== 2 || Array.from(originals).some(v => !v))
    throw Error('Supply exactly two complete original reading inputs');
  if (!exactKeys(query, ['bins', 'sharingSource']) || typeof query.sharingSource !== 'string'
      || !query.sharingSource.trim() || query.sharingSource.length > 400)
    throw Error('Declare why one static sky profile is being shared using 1 to 400 source characters');
  const { bins } = normalizeProfileRangeQuery({ bins: query.bins });
  checkShadeHeatBytes(new Blob([JSON.stringify({ originals, query })]).size);
  const readings = originals.map(originalReading);
  if (readings[0].query.reading.cellIndex === readings[1].query.reading.cellIndex)
    throw Error('The spatial inquiry requires two distinct original receiver cells');
  if (!sameData(sharedSiteProjection(readings[0].source), sharedSiteProjection(readings[1].source)))
    throw Error('The original site, geometry, orientation, forcing and dated course must agree exactly; titles alone do not bind places');
  return { readings, query: { bins, sharingSource: query.sharingSource } };
}
function preflight(investigation) {
  const bins = investigation.query.bins;
  const sources = investigation.readings.map(({ source }) => {
    const cells = source.project.width * source.project.height, path = source.declaration.path;
    const intervals = Math.ceil((Date.parse(path.endUtc) - Date.parse(path.startUtc)) / (path.stepMinutes * 60000));
    return { geometryPasses: 1, estimatedRayTests: 6 * (cells - 1) * intervals,
      estimatedSkyFaceTests: 4 * (4 * (cells - 1) + bins) * (cells - 1),
      thermalCourses: 4 * bins, courseIntervals: 4 * bins * intervals };
  });
  const sum = key => sources.reduce((total, source) => total + source[key], 0);
  const work = Object.fromEntries(Object.keys(sources[0]).map(key => [key, sum(key)]));
  if (work.estimatedRayTests + work.estimatedSkyFaceTests > SPATIAL_PROFILE_LIMITS.maxGeometryChecks
      || work.thermalCourses > SPATIAL_PROFILE_LIMITS.maxCourses
      || work.courseIntervals > SPATIAL_PROFILE_LIMITS.maxCourseIntervals)
    throw Error('The complete two-source inquiry exceeds its shared geometry or thermal-course allowance');
  return { ...work, sources };
}
function consequences(candidates, basis, observationCount) {
  const evaluated = candidates.map((candidate, index) => {
    const final = Object.fromEntries(targets.map(target => [target,
      Object.fromEntries(bounds.map(bound => [bound,
        Object.fromEntries(stores.map(store => [store, evaluateProfileMixture(candidate,
          basis.vertices.map(v => v.targets[target].final[bound][store]))]))]))]));
    const difference = Object.fromEntries(stores.map(store => [store, [
      sub(final.proposal.lower[store], final.existing.upper[store]),
      sub(final.proposal.upper[store], final.existing.lower[store]),
    ]]));
    return { candidate, index, final, difference };
  });
  const selected = new Set();
  const ranges = evaluated.length ? Object.fromEntries(stores.map(store => [store,
    Object.fromEntries(bounds.map((bound, side) => {
      let best = evaluated[0];
      for (const item of evaluated) {
        const order = cmp(item.difference[store][side], best.difference[store][side]);
        if (side === 0 ? order < 0 : order > 0) best = item;
      }
      selected.add(best.index);
      return [bound, { differenceC: profileFraction(best.difference[store][side]), witnessId: best.index }];
    }))])) : null;
  const witnesses = [...selected].map(index => {
    const item = evaluated[index], candidate = item.candidate;
    return { id: index, support: [...candidate.support],
      weights: Array.from({ length: basis.query.bins }, (_, bin) => {
        const position = candidate.support.indexOf(bin);
        return profileFraction(position < 0 ? q(0) : candidate.weights[position]);
      }),
      observedC: (observationCount === 2 ? candidate.observed : [candidate.observed]).map(profileFraction),
      targets: Object.fromEntries(targets.map(target => [target,
        Object.fromEntries(bounds.map(bound => [bound,
          Object.fromEntries(stores.map(store => [store, profileFraction(item.final[target][bound][store])]))]))])),
      difference: Object.fromEntries(stores.map(store => [store, item.difference[store].map(profileFraction)])) };
  });
  return { ranges, witnesses };
}
function evaluate(investigation) {
  const work = preflight(investigation), bins = investigation.query.bins;
  // Both complete original bases precede either observation constraint.
  const bases = investigation.readings.map(({ source }) => compareShadeHeatProfileRange(source.project, source.declaration, { bins }));
  for (let i = 0; i < bases.length; i++)
    if (!bases[i].vertices.every(v => v.targets.existing.final.lower.surfaceC === v.targets.existing.final.upper.surfaceC))
      throw Error('Original reading ' + (i + 1) + ' has unresolved existing observation endpoints; no favorable endpoint is selected');
  const rows = bases.map(basis => basis.vertices.map(v => v.targets.existing.final.lower.surfaceC));
  const bands = investigation.readings.map(value => ({ temperatureC: value.query.reading.temperatureC,
    halfWidthC: value.query.reading.halfWidthC }));
  const slice = intersectTwoProfileBands(rows, bands);
  if (slice.candidates.length > SPATIAL_PROFILE_LIMITS.maxCandidates) throw Error('Complete joint candidate allowance exhausted');
  const joint = consequences(slice.candidates, bases[0], 2);
  const first = intersectProfileBand(rows[0], bands[0]);
  const firstOnly = consequences(first.candidates, bases[0], 1);
  return { status: 'compared', compatibility: slice.status, model: { ...SPATIAL_PROFILE_MODEL },
    query: { ...investigation.query }, cellIndex: bases[0].cellIndex, finalUtc: bases[0].finalUtc,
    readings: investigation.readings.map((input, index) => ({ ...input.query.reading,
      originalBins: input.query.bins, activeCommonBins: bins,
      bandC: Object.fromEntries(bounds.map(bound => [bound, profileFraction(slice.bands[index][bound])])) })),
    originalRanges: bases[0].ranges, firstReadingOnly: { compatibility: first.status, ...firstOnly, work: first.work },
    ...joint, work: { ...work, executedThermalCourses: bases.reduce((sum, basis) => sum + basis.work.executedThermalCourses, 0),
      actualSkyFaceTests: bases.reduce((sum, basis) => sum + basis.work.actualSkyFaceTests, 0), profileIntersection: slice.work },
    diagnostics: bases.map(basis => basis.diagnostics),
    semantics: 'Both original receiver bands constrain one explicitly shared static sky. Every original basis course is completed; per-point thermal parameters remain fixed and independently attributed. '
      + 'Three-bin mixtures can be required even when every one- and two-bin profile is excluded. All candidates enter each paired component objective; only the distinct extremal witnesses are displayed. '
      + 'Original bin choices remain in each source while this inquiry uses the explicitly chosen common bins. '
      + 'Exact fractions concern represented thermal coefficients, not certified geometry or thermal integration, authenticated common conditions, an identified sky or a physically validated intervention.' };
}
export function prepareSpatialProfileEvidenceSource(originals, query) {
  const normalized = normalize(originals, query);
  const investigation = { kind: SPATIAL_PROFILE_KIND, model: { ...SPATIAL_PROFILE_MODEL }, ...normalized };
  checkShadeHeatBytes(new Blob([JSON.stringify(investigation)]).size); preflight(investigation);
  return investigation;
}
export function prepareSpatialProfileEvidence(originals, query) {
  const investigation = prepareSpatialProfileEvidenceSource(originals, query);
  return { investigation, report: evaluate(investigation) };
}
export function parseSpatialProfileEvidence(text) {
  if (typeof text !== 'string') throw TypeError('Spatial reading inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);
  let raw;
  try { raw = JSON.parse(text); } catch { throw Error('Invalid spatial reading-input JSON'); }
  if (!exactKeys(raw, ['kind', 'model', 'readings', 'query']) || raw.kind !== SPATIAL_PROFILE_KIND
      || !exactKeys(raw.model, Object.keys(SPATIAL_PROFILE_MODEL)) || !sameData(raw.model, SPATIAL_PROFILE_MODEL))
    throw Error('Unsupported spatial reading model or saved results');
  return prepareSpatialProfileEvidence(raw.readings, raw.query);
}

export function parseSpatialOriginalReading(text) {
  if (typeof text !== "string") throw TypeError("Original reading inputs must be JSON text");
  checkShadeHeatBytes(new Blob([text]).size);
  let raw;
  try { raw = JSON.parse(text); } catch { throw Error("Invalid original reading-input JSON"); }
  return originalReading(raw);
}
