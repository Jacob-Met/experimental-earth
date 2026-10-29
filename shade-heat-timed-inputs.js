import { checkShadeHeatBytes } from './shade-heat.js';
import { parseTimedSkyReadingSource } from './shade-heat-timed-reading-source.js';
import { TIMED_SKY_COURSE_KIND, parseTimedSkyCourseSource, prepareTimedSkyCourseSource } from './shade-heat-timed-course.js';
import { parseJointOriginals } from './shade-heat-joint-inputs.js';

export function parseTimedOriginals(texts) {
  if (!Array.isArray(texts) || ![1,3].includes(texts.length) || !Array.from(texts).every(text=>typeof text==='string'))
    throw Error('Choose three original reading files or one saved three-reading inquiry');
  checkShadeHeatBytes(texts.reduce((sum,text)=>sum+new Blob([text]).size,0));
  if (texts.length===3) {
    const readings=texts.map(parseTimedSkyReadingSource);
    // Admission only. These temporary declaration fields are neither returned
    // nor evaluated; intake does not choose the user's new change boundary.
    const checked=prepareTimedSkyCourseSource(readings,{bins:4,splitAfterInterval:1,
      sharingSource:'Original evidence intake validation only; no change choice is adopted.'});
    return {readings:checked.readings,sharingSource:null};
  }
  let raw;try{raw=JSON.parse(texts[0]);}catch{throw Error('Invalid original evidence JSON');}
  if(raw?.kind===TIMED_SKY_COURSE_KIND){const source=parseTimedSkyCourseSource(texts[0]);return {readings:source.readings,sharingSource:source.query.sharingSource};}
  return parseJointOriginals(texts);
}
