import {parsePortableProject,serializePortableProject} from './project-portability.js';
import {SUN_PATH_MODEL} from './solar-path.js';
import {planSunBearingCourse,inspectSunBearingCourse} from './solar-bearing-course.js';

export const SUN_BEARING_COURSE_KIND='experimental-earth/sun-bearing-course-inputs/1';
export const MAX_SUN_BEARING_COURSE_BYTES=5*1024*1024;
const envelopeKeys=['kind','model','project','declaration','settings'];
const declarationKeys=['latitudeDeg','longitudeDeg','gridColumnBearingDeg','locationSource','orientationSource','startUtc','endUtc','stepMinutes'];
const exactKeys=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));

export function checkSunBearingCourseInvestigationBytes(bytes){
  if(!Number.isSafeInteger(bytes)||bytes<0||bytes>MAX_SUN_BEARING_COURSE_BYTES)throw Error('Bearing-course investigation exceeds the 5 MiB input limit.');
}
export function buildSunBearingCourseInvestigation(project,input,settings){
  const source=parsePortableProject(serializePortableProject(project)),plan=planSunBearingCourse(source,input,settings);
  const envelope={kind:SUN_BEARING_COURSE_KIND,model:{...SUN_PATH_MODEL},project:source,
    declaration:Object.fromEntries(declarationKeys.map(k=>[k,plan.declaration[k]])),settings:plan.settings};
  checkSunBearingCourseInvestigationBytes(new Blob([JSON.stringify(envelope)]).size);return envelope;
}
export function serializeSunBearingCourseInvestigation(project,input,settings){
  const text=JSON.stringify(buildSunBearingCourseInvestigation(project,input,settings),null,2);
  checkSunBearingCourseInvestigationBytes(new Blob([text]).size);return text;
}
export function reopenSunBearingCourseInvestigation(value){
  if(!exactKeys(value,envelopeKeys)||value.kind!==SUN_BEARING_COURSE_KIND)throw Error('Unsupported bearing-course investigation; retain original inputs without cached profiles or count verdicts.');
  if(!exactKeys(value.model,Object.keys(SUN_PATH_MODEL))||Object.keys(SUN_PATH_MODEL).some(k=>value.model[k]!==SUN_PATH_MODEL[k]))throw Error('The saved bearing course names an unsupported sun-position model.');
  if(!exactKeys(value.declaration,declarationKeys))throw Error('Retain only the original geographic, UTC and orientation declaration.');
  const envelope=buildSunBearingCourseInvestigation(value.project,value.declaration,value.settings);
  return {envelope,report:inspectSunBearingCourse(envelope.project,envelope.declaration,envelope.settings)};
}
export function parseSunBearingCourseInvestigation(text){
  if(typeof text!=='string')throw TypeError('Bearing-course investigation must be JSON text.');
  checkSunBearingCourseInvestigationBytes(new Blob([text]).size);let value;
  try{value=JSON.parse(text);}catch{throw Error('Bearing-course investigation JSON is invalid.');}
  return reopenSunBearingCourseInvestigation(value);
}
