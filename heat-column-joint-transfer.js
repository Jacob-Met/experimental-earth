import {validateHeatColumnTransfer,compareHeatColumnTransfer,MAX_TRANSFER_FILE_BYTES} from './heat-column-transfer.js';

export const HEAT_JOINT_TRANSFER_SCHEMA='experimental-earth-heat-column-joint-transfer/1';
export const MAX_JOINT_EXPOSURES=8;
export const MAX_JOINT_FILE_BYTES=16000000;
const bytes=text=>new TextEncoder().encode(text).length;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const only=(value,keys)=>object(value)&&Object.keys(value).every(key=>keys.includes(key));
// Key ordering is not evidence. Values and every retained original field are.
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':object(value)?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);

export function validateJointHeatTransfer(input){
 if(!only(input,['schema','exposures'])||input.schema!==HEAT_JOINT_TRANSFER_SCHEMA||!Array.isArray(input.exposures)||input.exposures.length<2||input.exposures.length>MAX_JOINT_EXPOSURES)throw Error('Retain two to eight original transfer investigations');
 const refs=new Set();let original;
 for(const exposure of input.exposures){
  if(!only(exposure,['reference','transfer'])||typeof exposure.reference!=='string'||!exposure.reference.trim()||exposure.reference.length>160)throw Error('Give every original exposure a distinct reference');
  const reference=exposure.reference.trim();if(refs.has(reference))throw Error('Every exposure reference must be distinct');refs.add(reference);
  const text=JSON.stringify(exposure.transfer);if(bytes(text)>MAX_TRANSFER_FILE_BYTES)throw Error('An original transfer exceeds its maintained reopen limit');
  validateHeatColumnTransfer(exposure.transfer);
  const source=canonical(exposure.transfer.originalProject);
  if(original!==undefined&&source!==original)throw Error('Every exposure must challenge the same complete original investigation and candidate family');original=source;
 }
 if(bytes(JSON.stringify(input))>MAX_JOINT_FILE_BYTES)throw Error('The complete original collection exceeds its 16 MB work and reopen bound');
 return input;
}

export function prepareJointHeatTransfer(exposures){
 const input={schema:HEAT_JOINT_TRANSFER_SCHEMA,exposures:structuredClone(exposures)};validateJointHeatTransfer(input);return input;
}

/** Exhaust the bounded finite source population; do not infer outside it. */
export function compareJointHeatTransfer(input){
 // Admit the complete collection before evaluating any subset.
 validateJointHeatTransfer(input);
 const results=input.exposures.map(({reference,transfer})=>({reference,result:compareHeatColumnTransfer(transfer)}));
 const original=results[0].result,labels=original.originalSurvivingLabels;
 const supported=results.every(({result})=>result.transferLabels!==null);
 const retained=indices=>labels.filter(label=>indices.every(i=>results[i].result.transferLabels.includes(label)));
 const all=results.map((_,i)=>i),jointLabels=supported?retained(all):null;
 const conflicts=[];
 if(supported&&jointLabels.length===0){
  for(let mask=1;mask<2**results.length;mask++){
   const indices=all.filter(i=>mask&(1<<i));
   if(retained(indices).length!==0)continue;
   // A conflict is inclusion-minimal only if removing any one source restores
   // at least one original candidate. This is not a diagnosis of a faulty file.
   if(indices.every(removed=>retained(indices.filter(i=>i!==removed)).length>0))conflicts.push(indices);
  }
  conflicts.sort((a,b)=>a.length-b.length||a.join(',').localeCompare(b.join(',')));
 }
 const candidates=original.candidates.map(candidate=>({label:candidate.label,retainedOriginally:candidate.retainedOriginally,
  exposures:results.map(({reference,result})=>{const c=result.candidates.find(c=>c.label===candidate.label);return{reference,compatible:c.challenge.compatible,rows:c.challenge.rows};}),
  retainedJointly:jointLabels===null?null:jointLabels.includes(candidate.label)}));
 return {status:!supported?original.status:jointLabels.length===0?'joint-transfer-rejected':jointLabels.length===1?'one-common-finite-alternative':'joint-ambiguity',
  originalCalibrationLabels:original.originalCalibrationLabels,originalSurvivingLabels:labels,jointLabels,results,candidates,
  minimalConflicts:conflicts.map(indices=>({indices,references:indices.map(i=>results[i].reference)})),
  semantics:'Common support among the same frozen original finite alternatives across all retained exposures. Minimal conflicts identify source subsets that no offered originally retained alternative satisfies; they do not identify a faulty observation, changed material, independence, or physical truth. No refitting, relabeling, source removal or candidate adoption occurs.'};
}

export function serializeJointHeatTransfer(input){validateJointHeatTransfer(input);return JSON.stringify(input);}
export function parseJointHeatTransfer(text){if(typeof text!=='string'||bytes(text)>MAX_JOINT_FILE_BYTES)throw Error('Use an original joint transfer collection within 16 MB');const input=JSON.parse(text);validateJointHeatTransfer(input);return input;}
