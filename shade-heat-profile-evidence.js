import { prepareShadeHeatSource, parseShadeHeatSource, checkShadeHeatBytes } from './shade-heat.js';
import { normalizeProfileRangeQuery, compareShadeHeatProfileRange } from './shade-heat-profile-range.js';
import { intersectProfileBand, evaluateProfileMixture, profileFraction, describeProfileCandidate } from './shade-heat-profile-band.js';
import { sub, cmp } from './vendor/chronos/exact-halfplanes.mjs';

export const SHADE_HEAT_PROFILE_EVIDENCE_KIND = 'experimental-earth/shared-sky-final-reading-inputs/1';
export const SHADE_HEAT_PROFILE_EVIDENCE_MODEL = Object.freeze({
  name: 'shared-sky-final-surface-reading', version: 1,
  observation: 'one instantaneous existing-surface band at the original receiver and final UTC',
  domain: 'one static nonnegative equal-bin profile shared by both designs and all original intervals',
  arithmetic: 'exact intersection and linear objectives over represented final-temperature coefficients',
});
export const SHADE_HEAT_PROFILE_EVIDENCE_SEMANTICS = 'Compatibility concerns the affine model formed from every complete one-bin thermal course. '
  + 'The original existing-surface endpoint must have one computed value under both forcing endpoints in every bin. '
  + 'An admitted profile is shared by the observation, both designs, all thermal endpoints and every original weather interval. '
  + 'A one-band simplex intersection can have two-bin mixture vertices even when every one-bin profile is excluded. '
  + 'Exact fractions and outward binary64 displays concern the represented coefficient problem; the geometry, thermal integration, omitted sectors and physical model remain approximate. '
  + 'The original attributed reading is never widened or fitted. A compatible result does not identify the actual sky or validate fixed materials, starting temperatures, weather or omitted mechanisms. '
  + 'An incompatible result rejects this declared coefficient family against this band, not two-store physics or the reading generally. '
  + 'Proposal and other-store forcing envelopes retain their original conservative meaning; component extrema need not occur together. No daily-peak inference or physical-validation claim is made.';

const stores = ['surfaceC', 'subsurfaceC'], targets = ['existing', 'proposal'], bounds = ['lower', 'upper'];
const exactKeys = (v, keys) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));

function normalizeQuery(query, source) {
  if (!exactKeys(query, ['bins', 'reading'])) throw Error('Provide only the bin count and original attributed reading');
  const { bins } = normalizeProfileRangeQuery({ bins: query.bins }), r = query.reading;
  if (!exactKeys(r, ['target', 'store', 'aggregation', 'cellIndex', 'utc', 'temperatureC', 'halfWidthC', 'source'])
      || r.target !== 'existing' || r.store !== 'surfaceC' || r.aggregation !== 'instant'
      || r.cellIndex !== source.project.heatColumnStudy.heatStudy.cellIndex
      || r.utc !== source.declaration.path.endUtc)
    throw Error('The reading must identify the original existing surface, saved receiver and final UTC exactly');
  if (!Number.isFinite(r.temperatureC) || r.temperatureC < -100 || r.temperatureC > 500
      || !Number.isFinite(r.halfWidthC) || r.halfWidthC < 0 || r.halfWidthC > 600)
    throw Error('Use an original temperature from −100 to 500 °C and half-width from 0 to 600 °C');
  if (typeof r.source !== 'string' || !r.source.trim() || r.source.length > 400)
    throw Error('Attribute the original reading with 1 to 400 characters of source information');
  return { bins, reading: { ...r } };
}

function evaluate(investigation) {
  const { source, query } = investigation;
  const basis = compareShadeHeatProfileRange(source.project, source.declaration, { bins: query.bins });
  if (!basis.vertices.every(v => v.targets.existing.final.lower.surfaceC === v.targets.existing.final.upper.surfaceC))
    throw Error('The existing final surface has unresolved forcing endpoints. This observation inquiry requires one computed observation value in every sky bin; no endpoint is silently selected.');
  const observed = basis.vertices.map(v => v.targets.existing.final.lower.surfaceC);
  const slice = intersectProfileBand(observed, { temperatureC: query.reading.temperatureC, halfWidthC: query.reading.halfWidthC });
  // Complete every exact candidate before returning a result or selecting bounds.
  const evaluated = slice.candidates.map(candidate => {
    const final = {};
    for (const target of targets) {
      final[target] = {};
      for (const bound of bounds) {
        final[target][bound] = {};
        for (const store of stores) final[target][bound][store] = evaluateProfileMixture(candidate,
          basis.vertices.map(v => v.targets[target].final[bound][store]));
      }
    }
    const differences = Object.fromEntries(stores.map(store => [store, [
      sub(final.proposal.lower[store], final.existing.upper[store]),
      sub(final.proposal.upper[store], final.existing.lower[store]),
    ]]));
    return { candidate, final, differences };
  });
  const witnesses = evaluated.map((v, index) => ({ id: index,
    ...describeProfileCandidate(v.candidate, query.bins),
    targets: Object.fromEntries(targets.map(target => [target,
      Object.fromEntries(bounds.map(bound => [bound,
        Object.fromEntries(stores.map(store => [store, profileFraction(v.final[target][bound][store])]))]))])),
    difference: Object.fromEntries(stores.map(store => [store, v.differences[store].map(profileFraction)])),
  }));
  let ranges = null;
  if (evaluated.length) ranges = Object.fromEntries(stores.map(store => [store,
    Object.fromEntries(bounds.map((bound, side) => {
      let selected = 0;
      for (let i = 1; i < evaluated.length; i++) {
        const order = cmp(evaluated[i].differences[store][side], evaluated[selected].differences[store][side]);
        if (side === 0 ? order < 0 : order > 0) selected = i;
      }
      return [bound, { differenceC: profileFraction(evaluated[selected].differences[store][side]), witnessId: selected }];
    }))]));
  return { status: 'compared', compatibility: slice.status, model: { ...SHADE_HEAT_PROFILE_EVIDENCE_MODEL },
    cellIndex: basis.cellIndex, finalUtc: basis.finalUtc, durationMinutes: basis.durationMinutes,
    query: { bins: query.bins, reading: { ...query.reading } },
    originalObservationRangeC: Object.fromEntries(bounds.map(bound => [bound, profileFraction(slice.originalObservationRange[bound])])),
    readingBandC: Object.fromEntries(bounds.map(bound => [bound, profileFraction(slice.band[bound])])),
    originalRanges: basis.ranges, ranges, witnesses,
    diagnostics: basis.diagnostics, work: { ...basis.work, profileIntersection: slice.work },
    semantics: SHADE_HEAT_PROFILE_EVIDENCE_SEMANTICS };
}

export function prepareShadeHeatProfileEvidenceSource(project, declaration, query) {
  const source = prepareShadeHeatSource(project, declaration), normalized = normalizeQuery(query, source);
  const investigation = { kind: SHADE_HEAT_PROFILE_EVIDENCE_KIND, model: { ...SHADE_HEAT_PROFILE_EVIDENCE_MODEL }, source, query: normalized };
  checkShadeHeatBytes(new Blob([JSON.stringify(investigation)]).size);
  return investigation;
}

export function prepareShadeHeatProfileEvidence(project, declaration, query) {
  const investigation = prepareShadeHeatProfileEvidenceSource(project, declaration, query);
  return { investigation, report: evaluate(investigation) };
}

export function serializeShadeHeatProfileEvidence(project, declaration, query) {
  const text = JSON.stringify(prepareShadeHeatProfileEvidence(project, declaration, query).investigation, null, 2);
  checkShadeHeatBytes(new Blob([text]).size); return text;
}

export function parseShadeHeatProfileEvidence(text) {
  if (typeof text !== 'string') throw TypeError('Original profile-reading inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);
  let raw;
  try { raw = JSON.parse(text); } catch { throw Error('Invalid profile-reading input JSON'); }
  const model = SHADE_HEAT_PROFILE_EVIDENCE_MODEL;
  if (!exactKeys(raw, ['kind', 'model', 'source', 'query']) || raw.kind !== SHADE_HEAT_PROFILE_EVIDENCE_KIND
      || !exactKeys(raw.model, Object.keys(model)) || Object.keys(model).some(key => raw.model[key] !== model[key]))
    throw Error('Unsupported profile-reading model or envelope; saved results are not accepted');
  const source = parseShadeHeatSource(JSON.stringify(raw.source)), query = normalizeQuery(raw.query, source);
  const investigation = { kind: SHADE_HEAT_PROFILE_EVIDENCE_KIND, model: { ...model }, source, query };
  return { investigation, report: evaluate(investigation) };
}
