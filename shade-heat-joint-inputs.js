import { checkShadeHeatBytes } from './shade-heat.js';
import { parseCourseOriginals } from './shade-heat-course-inputs.js';
import { SKY_COURSE_KIND, SKY_COURSE_MODEL, prepareSkyCourseSource } from './shade-heat-course-evidence.js';
import { SKY_JOINT_KIND, parseSkyJointSource } from './shade-heat-joint-course.js';

const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

// Reusing evidence never adopts a previous inquiry's desired limits or boundary.
export function parseJointOriginals(texts) {
  if (!Array.isArray(texts) || ![1, 3].includes(texts.length) || Array.from(texts).some(text => typeof text !== 'string'))
    throw Error('Choose three original readings or one saved three-reading inquiry');
  checkShadeHeatBytes(texts.reduce((sum, text) => sum + new Blob([text]).size, 0));
  if (texts.length === 3) return parseCourseOriginals(texts);
  let raw;
  try { raw = JSON.parse(texts[0]); } catch { throw Error('Invalid original evidence JSON'); }
  if (raw?.kind === SKY_JOINT_KIND) {
    const source = parseSkyJointSource(texts[0]);
    return { readings: source.readings, sharingSource: source.query.sharingSource };
  }
  if (raw?.kind !== SKY_COURSE_KIND) return parseCourseOriginals(texts);
  if (!exactKeys(raw, ['kind', 'model', 'readings', 'query'])
      || !exactKeys(raw.model, Object.keys(SKY_COURSE_MODEL))
      || Object.keys(SKY_COURSE_MODEL).some(key => raw.model[key] !== SKY_COURSE_MODEL[key]))
    throw Error('Use the original course inputs without saved results or model changes');
  const source = prepareSkyCourseSource(raw.readings, raw.query);
  return { readings: source.readings, sharingSource: source.query.sharingSource };
}
