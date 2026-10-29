import { checkShadeHeatBytes } from './shade-heat.js';
import { parseSpatialOriginalReading } from './shade-heat-spatial-evidence.js';
import { THIRD_RECEIVER_KIND, THIRD_RECEIVER_MODEL, prepareThirdReceiverSource } from './shade-heat-third-receiver.js';
import { sub } from './vendor/chronos/exact-halfplanes.mjs';
import { profileFraction } from './shade-heat-profile-band.js';

const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

/** Extract original evidence only. A previous offered list never selects the new change boundary. */
export function parseCourseOriginals(texts) {
  if (!Array.isArray(texts) || ![1, 3].includes(texts.length) || Array.from(texts).some(text => typeof text !== 'string'))
    throw Error('Choose three original reading files, or one saved three-reading boundary inquiry');
  checkShadeHeatBytes(texts.reduce((total, text) => total + new Blob([text]).size, 0));
  if (texts.length === 3) return { readings: texts.map(parseSpatialOriginalReading), sharingSource: null };
  let raw;
  try { raw = JSON.parse(texts[0]); } catch { throw Error('Invalid three-reading boundary input JSON'); }
  if (!exactKeys(raw, ['kind', 'model', 'readings', 'query']) || raw.kind !== THIRD_RECEIVER_KIND
      || !exactKeys(raw.model, Object.keys(THIRD_RECEIVER_MODEL))
      || Object.keys(THIRD_RECEIVER_MODEL).some(key => raw.model[key] !== THIRD_RECEIVER_MODEL[key]))
    throw Error('Use an original three-reading boundary inquiry without saved results or model changes');
  const source = prepareThirdReceiverSource(raw.readings, raw.query);
  return { readings: source.readings, sharingSource: source.query.sharingSource };
}

/** Exact paired endpoint differences of one fixed profile, never a rounded temperature subtraction. */
export function courseWitnessDifferences(witness, receiver = 0) {
  const replay = witness.originalReplays[receiver];
  if (!replay) throw Error('The original receiver does not belong to this witness');
  const fraction = value => [BigInt(value.exact.numerator), BigInt(value.exact.denominator)];
  return replay.originalCourse.map(row => ({ index: row.index, utc: row.utc, minute: row.minute,
    thermalMinute: row.thermalMinute,
    differenceC: Object.fromEntries(['surfaceC', 'subsurfaceC'].map(store => [store,
      Object.fromEntries([['lower', 'upper'], ['upper', 'lower']].map(([bound, other]) => [bound,
        profileFraction(sub(fraction(row.additiveC.proposal[bound][store]), fraction(row.additiveC.existing[other][store])))]))])),
    originalDifferenceC: Object.fromEntries(['surfaceC', 'subsurfaceC'].map(store => [store,
      { lower: row.originalC.proposal.lower[store] - row.originalC.existing.upper[store],
        upper: row.originalC.proposal.upper[store] - row.originalC.existing.lower[store] }])) }));
}
