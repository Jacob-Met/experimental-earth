import {startSkyCourseTargetPage} from './shade-heat-course-target-controller.js';
import {prepareSkyCourseTargetSource,parseSkyCourseTargetSource,serializeSkyCourseTargetSource,SKY_COURSE_TARGET_KIND} from './shade-heat-course-targets.js';
import {parseThreeEpochSkySource} from './shade-heat-three-epoch-course.js';
import {makeSkyCourseTargetExample} from './shade-heat-course-target-example.js';
import {drawTargetReport} from './shade-heat-course-target-view.js';

startSkyCourseTargetPage({prepareSource:prepareSkyCourseTargetSource,serializeSource:serializeSkyCourseTargetSource,
  makeExample:makeSkyCourseTargetExample,drawReport:drawTargetReport,
  workerUrl:new URL('./shade-heat-course-target-worker.js',import.meta.url),downloadName:'sky-course-target-inputs.json',
  readSource:(text,kind)=>kind===SKY_COURSE_TARGET_KIND?{source:parseSkyCourseTargetSource(text),isTarget:true}:{source:parseThreeEpochSkySource(text),isTarget:false},
  calculationMessage:'Calculating one common profile from every original observation and declared target…',
  appliedMessage:'Desired targets applied. Calculate their best common profile from the complete original record.',
  statusMessage:r=>r.observationCompatibility==='incompatible'
    ?'The original record admits no shared three-profile history at these changes. No target optimization or substitute profile is shown.'
    :r.targetCompatibility==='compatible'
      ?'One shared profile meets every declared ceiling in the exact additive model. Inspect the separate original numerical replay below.'
      :'The original record is compatible, but no shared profile meets every declared ceiling in the exact additive model. The best common compromise and its numerical replay are shown.'});
