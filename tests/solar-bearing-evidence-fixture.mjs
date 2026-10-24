import {bearingCourseFixture} from './solar-bearing-course-fixture.mjs';
export function bearingEvidenceFixture(){
  const fixture=bearingCourseFixture(),start=Date.parse(fixture.declaration.startUtc);
  const observations=Array.from({length:9},(_,i)=>({utc:new Date(start+i*1800000).toISOString(),scenario:'proposal',state:i<7?'blocked':'no-mapped-blocker',source:'Authored original-kernel pattern control, not a field observation'}));
  return {...fixture,observations};
}
