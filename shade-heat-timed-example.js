import { makeJointCourseExample } from './shade-heat-joint-example.js';
import { prepareTimedSkyReadingSource } from './shade-heat-timed-reading-source.js';

// Values come from the complete authored original D2 course with early bin1,
// late bin2 and the original08:00 change. They are numerical controls only.
export function makeTimedSkyExample() {
  const original=makeJointCourseExample().readings[0],source=original.source;
  const readings=[['2026-06-21T10:00:00.000Z',26.18913653295379],
    ['2026-06-21T12:00:00.000Z',26.189136986396296],
    ['2026-06-21T06:00:00.000Z',26.168026334165262]].map(([utc,temperatureC])=>
    prepareTimedSkyReadingSource(source.project,source.declaration,{bins:4,reading:{
      target:'existing',store:'surfaceC',aggregation:'instant',cellIndex:7,utc,temperatureC,halfWidthC:0.001,
      source:'Authored complete original D2 course: bin1 before08:00 UTC and bin2 afterwards; numerical control, not field observations.'}}));
  return {readings,query:{bins:4,splitAfterInterval:8,
    sharingSource:'Authored unchanged D2 site and thermal declarations across all three original instants, with one common early/late sky for both designs; no measured sky history.'}};
}
