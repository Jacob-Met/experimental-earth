import {parsePortableProject,serializePortableProject} from './project-portability.js';
import {SUN_PATH_MODEL} from './solar-path.js';
import {planSunBearingEvidence,inspectSunBearingEvidence} from './solar-bearing-evidence.js';

export const SUN_BEARING_EVIDENCE_KIND='experimental-earth/sun-bearing-evidence-inputs/1';
export const MAX_SUN_BEARING_EVIDENCE_BYTES=5*1024*1024;
const declarationKeys=['latitudeDeg','longitudeDeg','gridColumnBearingDeg','locationSource','orientationSource','startUtc','endUtc','stepMinutes'];
const observationKeys=['utc','scenario','state','source'];
const exactKeys=(v,ks)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));
export function checkSunBearingEvidenceInvestigationBytes(bytes){if(!Number.isSafeInteger(bytes)||bytes<0||bytes>MAX_SUN_BEARING_EVIDENCE_BYTES)throw Error('Bearing-evidence investigation exceeds the5MiB input limit.');}
export function buildSunBearingEvidenceInvestigation(project,declaration,settings,observations){
  const source=parsePortableProject(serializePortableProject(project)),plan=planSunBearingEvidence(source,declaration,settings,observations);
  const envelope={kind:SUN_BEARING_EVIDENCE_KIND,model:{...SUN_PATH_MODEL},project:source,declaration:Object.fromEntries(declarationKeys.map(k=>[k,plan.declaration[k]])),settings:plan.settings,
    observations:plan.observations.map(o=>Object.fromEntries(observationKeys.map(k=>[k,o[k]])))};
  checkSunBearingEvidenceInvestigationBytes(new Blob([JSON.stringify(envelope)]).size);return envelope;
}
export function serializeSunBearingEvidenceInvestigation(project,declaration,settings,observations){
  const text=JSON.stringify(buildSunBearingEvidenceInvestigation(project,declaration,settings,observations),null,2);checkSunBearingEvidenceInvestigationBytes(new Blob([text]).size);return text;
}
export function reopenSunBearingEvidenceInvestigation(value){
  if(!exactKeys(value,['kind','model','project','declaration','settings','observations'])||value.kind!==SUN_BEARING_EVIDENCE_KIND)throw Error('Unsupported bearing-evidence inputs; cached regions and verdicts are refused.');
  if(!exactKeys(value.model,Object.keys(SUN_PATH_MODEL))||Object.keys(SUN_PATH_MODEL).some(k=>value.model[k]!==SUN_PATH_MODEL[k]))throw Error('The saved obstruction evidence names an unsupported sun-position model.');
  if(!exactKeys(value.declaration,declarationKeys))throw Error('Retain only the original geographic/UTC declaration.');
  const envelope=buildSunBearingEvidenceInvestigation(value.project,value.declaration,value.settings,value.observations);
  return {envelope,report:inspectSunBearingEvidence(envelope.project,envelope.declaration,envelope.settings,envelope.observations)};
}
export function parseSunBearingEvidenceInvestigation(text){
  if(typeof text!=='string')throw TypeError('Bearing-evidence investigation must be JSON text.');checkSunBearingEvidenceInvestigationBytes(new Blob([text]).size);
  let value;try{value=JSON.parse(text);}catch{throw Error('Bearing-evidence investigation JSON is invalid.');}return reopenSunBearingEvidenceInvestigation(value);
}
