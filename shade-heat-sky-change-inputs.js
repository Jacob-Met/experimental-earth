import {checkShadeHeatBytes} from './shade-heat.js';
import {parseThreeEpochOriginals} from './shade-heat-three-epoch-inputs.js';
import {SKY_CHANGE_KIND,parseSkyChangeSource} from './shade-heat-sky-change-course.js';
import {SKY_COURSE_TARGET_KIND,parseSkyCourseTargetSource} from './shade-heat-course-targets.js';
import {SKY_TARGET_CONFLICT_KIND,parseSkyTargetConflictSource} from './shade-heat-course-target-conflicts.js';

export function parseSkyChangeOriginals(texts){
  if(Array.isArray(texts)&&texts.length===1&&typeof texts[0]==='string'){
    checkShadeHeatBytes(new Blob(texts).size);let raw;
    try{raw=JSON.parse(texts[0]);}catch{throw Error('Invalid original evidence JSON');}
    const parser=new Map([[SKY_CHANGE_KIND,parseSkyChangeSource],[SKY_COURSE_TARGET_KIND,parseSkyCourseTargetSource],
      [SKY_TARGET_CONFLICT_KIND,parseSkyTargetConflictSource]]).get(raw?.kind);
    if(parser){
      const source=parser(texts[0]);
      return {readings:source.readings,sharingSource:source.query.sharingSource,
        ownQuery:source.kind===SKY_CHANGE_KIND?source.query:null};
    }
  }
  return {...parseThreeEpochOriginals(texts),ownQuery:null};
}
