import {checkShadeHeatBytes} from './shade-heat.js';
import {parseTimedSkyReadingSource} from './shade-heat-timed-reading-source.js';
import {MANY_SKY_COURSE_KIND,parseManySkyCourseSource,prepareManySkyCourseSource} from './shade-heat-many-course.js';
import {parseTimedOriginals} from './shade-heat-timed-inputs.js';

export function parseManyOriginals(texts){
  if(!Array.isArray(texts)||!(texts.length===1||(texts.length>=3&&texts.length<=24))
      ||!Array.from(texts).every(text=>typeof text==='string'))
    throw Error('Choose three to 24 original reading files or one saved original-reading inquiry');
  checkShadeHeatBytes(texts.reduce((sum,text)=>sum+new Blob([text]).size,0));
  if(texts.length>1){
    const originals=texts.map(parseTimedSkyReadingSource);
    const source=prepareManySkyCourseSource(originals,{bins:4,splitAfterInterval:1,
      sharingSource:'Original evidence intake validation only; no change choice is adopted.'});
    return {readings:source.readings,sharingSource:null};
  }
  let raw;try{raw=JSON.parse(texts[0]);}catch{throw Error('Invalid original evidence JSON');}
  if(raw?.kind===MANY_SKY_COURSE_KIND){
    const source=parseManySkyCourseSource(texts[0]);return {readings:source.readings,sharingSource:source.query.sharingSource};
  }
  return parseTimedOriginals(texts);
}
