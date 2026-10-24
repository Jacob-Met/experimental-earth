import {parsePortableProject,serializePortableProject} from './project-portability.js';
import {SUN_PATH_MODEL} from './solar-path.js';
import {planSunBearing,inspectSunBearing} from './solar-bearing.js';

export const SUN_BEARING_KIND='experimental-earth/sun-bearing-inputs/1';
export const MAX_SUN_BEARING_BYTES=5*1024*1024;
const envelopeKeys=['kind','model','project','declaration','settings'];
const declarationKeys=['latitudeDeg','longitudeDeg','gridColumnBearingDeg','locationSource','orientationSource','startUtc','endUtc','stepMinutes'];
const exactKeys=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));

export function checkSunBearingInvestigationBytes(bytes){
  if(!Number.isSafeInteger(bytes)||bytes<0||bytes>MAX_SUN_BEARING_BYTES)throw Error('Bearing investigation exceeds the 5 MiB input limit.');
}

export function buildSunBearingInvestigation(project,input,settings){
  // Retain the maintained project admission and 4MiB limit without calculating an
  // unrelated complete time course. The selected-instant mechanism has its own
  // complete witness work preflight, including every original site column.
  const source=parsePortableProject(serializePortableProject(project));
  const plan=planSunBearing(source,input,settings);
  const envelope={kind:SUN_BEARING_KIND,model:{...SUN_PATH_MODEL},project:source,
    declaration:Object.fromEntries(declarationKeys.map(k=>[k,plan.declaration[k]])),settings:plan.settings};
  checkSunBearingInvestigationBytes(new Blob([JSON.stringify(envelope)]).size);
  return envelope;
}

export function serializeSunBearingInvestigation(project,input,settings){
  const text=JSON.stringify(buildSunBearingInvestigation(project,input,settings),null,2);
  checkSunBearingInvestigationBytes(new Blob([text]).size);return text;
}

export function reopenSunBearingInvestigation(value){
  if(!exactKeys(value,envelopeKeys)||value.kind!==SUN_BEARING_KIND)throw Error('Unsupported bearing investigation; retain inputs without cached geometry or verdicts.');
  if(!exactKeys(value.model,Object.keys(SUN_PATH_MODEL))||Object.keys(SUN_PATH_MODEL).some(k=>value.model[k]!==SUN_PATH_MODEL[k]))throw Error('The saved bearing investigation names an unsupported sun-position model.');
  if(!exactKeys(value.declaration,declarationKeys))throw Error('Retain only the original geographic, UTC and orientation declaration.');
  const envelope=buildSunBearingInvestigation(value.project,value.declaration,value.settings);
  return {envelope,report:inspectSunBearing(envelope.project,envelope.declaration,envelope.settings)};
}

export function parseSunBearingInvestigation(text){
  if(typeof text!=='string')throw TypeError('Bearing investigation must be JSON text.');
  checkSunBearingInvestigationBytes(new Blob([text]).size);let value;
  try{value=JSON.parse(text);}catch{throw Error('Bearing investigation JSON is invalid.');}
  return reopenSunBearingInvestigation(value);
}
