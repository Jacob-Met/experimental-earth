import {startSkyCourseTargetPage} from './shade-heat-course-target-controller.js';
import {prepareSkyTargetConflictSource,parseSkyTargetConflictSource,serializeSkyTargetConflictSource,SKY_TARGET_CONFLICT_KIND} from './shade-heat-course-target-conflicts.js';
import {parseSkyCourseTargetSource,SKY_COURSE_TARGET_KIND} from './shade-heat-course-targets.js';
import {parseThreeEpochSkySource} from './shade-heat-three-epoch-course.js';
import {makeSkyCourseTargetExample} from './shade-heat-course-target-example.js';
import {drawTargetConflictReport} from './shade-heat-course-target-conflict-view.js';

startSkyCourseTargetPage({prepareSource:prepareSkyTargetConflictSource,serializeSource:serializeSkyTargetConflictSource,
  makeExample:makeSkyCourseTargetExample,drawReport:drawTargetConflictReport,
  workerUrl:new URL('./shade-heat-course-target-conflict-worker.js',import.meta.url),downloadName:'sky-target-conflict-inputs.json',
  readSource:(text,kind)=>{
    if(kind===SKY_TARGET_CONFLICT_KIND)return {source:parseSkyTargetConflictSource(text),isTarget:true};
    if(kind===SKY_COURSE_TARGET_KIND){const s=parseSkyCourseTargetSource(text);return {source:prepareSkyTargetConflictSource(s.readings,s.query),isTarget:true};}
    return {source:parseThreeEpochSkySource(text),isTarget:false};
  },
  calculationMessage:'Checking the complete target conflict and every necessary removal profile…',
  appliedMessage:'Desired targets applied. Explain their compatibility using the complete original record.',
  statusMessage:r=>r.observationCompatibility==='incompatible'
    ?'The original observations admit no common three-profile history. A target conflict or removal profile cannot substitute for that incompatible record.'
    :r.targetCompatibility==='compatible'
      ?'One shared profile meets every declared ceiling. No conflicting target group is needed; the common profile and separate numerical replay are available below.'
      :'A group of '+r.conflict.targetIndices.length+' desired ceilings cannot hold together. Each member is necessary within this group; inspect its removal profile below.'});
