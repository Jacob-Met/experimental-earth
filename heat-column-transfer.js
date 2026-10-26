import {validateProject} from './core.js';
import {prepareHeatColumnEvidence,compareHeatColumnEvidence} from './heat-column-evidence.js';
import {heatColumnCurrent} from './heat-column-contract.js';
import {previewTemperatureTable} from './temperature-table.js';
import {MAX_PROJECT_FILE_BYTES,serializePortableProject} from './project-portability.js';

export const HEAT_TRANSFER_SCHEMA='experimental-earth-heat-column-transfer/1';
export const MAX_TRANSFER_CSV_BYTES=128000;
// Two admitted original projects, worst-case JSON escaping of the original CSV,
// and bounded association/file-name fields. Export and reopen use one limit.
export const MAX_TRANSFER_FILE_BYTES=2*MAX_PROJECT_FILE_BYTES+6*MAX_TRANSFER_CSV_BYTES+8192;
const bytes=s=>new TextEncoder().encode(s).length;
const only=(o,names)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>names.includes(k));
const sourced=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;

export function prepareHeatColumnTransfer(originalProject,challengeProject,readingFile,associationSource){
 const bundle={schema:HEAT_TRANSFER_SCHEMA,originalProject:structuredClone(originalProject),challengeProject:structuredClone(challengeProject),readingFile:structuredClone(readingFile),associationSource};
 validateHeatColumnTransfer(bundle);return bundle;
}

export function validateHeatColumnTransfer(bundle){
 if(!only(bundle,['schema','originalProject','challengeProject','readingFile','associationSource'])||bundle.schema!==HEAT_TRANSFER_SCHEMA||!sourced(bundle.associationSource,600))throw Error('Retain both original investigations and explain the unchanged material association');
 for(const project of [bundle.originalProject,bundle.challengeProject]){validateProject(project);serializePortableProject(project);}
 const {originalProject:first,challengeProject:next,readingFile:file}=bundle;
 const evidence=first.heatColumnEvidence;
 if(!evidence||!first.heatColumnStudy||!next.heatColumnStudy)throw Error('Retain original surface evidence and both complete two-store declarations');
 if(!heatColumnCurrent(first,evidence.columnStudy)||!heatColumnCurrent(next,next.heatColumnStudy))throw Error('An original place or exposure changed; use its complete original source');
 if(evidence.columnStudy.heatStudy.contextJson!==next.heatColumnStudy.heatStudy.contextJson)throw Error('The two exposures must refer to the same original place, scale and source');
 const target=evidence.target;
 for(const key of ['absorptivity','capacityJm2K','exchangeWm2K'])if(evidence.columnStudy.heatStudy[target][key]!==next.heatColumnStudy.heatStudy[target][key])throw Error('Changed surface physics cannot challenge the same frozen heat-store family');
 if(!only(file,['name','text'])||!sourced(file.name,160)||typeof file.text!=='string'||bytes(file.text)>MAX_TRANSFER_CSV_BYTES)throw Error('Retain an original temperature CSV of at most128KB and its file name');
 const duration=next.heatColumnStudy.heatStudy.schedule.reduce((sum,r)=>sum+r.minutes,0);
 const preview=previewTemperatureTable(file.text,duration,file.name);
 if(preview.readings.some(r=>r.use!=='challenge'))throw Error('The separate exposure is held aside: every original reading must declare challenge use; no relabeling or fitting occurs');
 return {evidence,preview,duration};
}

export function compareHeatColumnTransfer(bundle){
 const {evidence,preview,duration}=validateHeatColumnTransfer(bundle);
 const first=bundle.originalProject,next=structuredClone(bundle.challengeProject);
 const baseline=compareHeatColumnEvidence(first);
 if(baseline.status==='context-changed')throw Error('The original calibration investigation changed');
 // Keep the retained challenge project intact. This ephemeral comparison carries
 // the original complete finite family into the separate exposure, without
 // changing any property from its new readings or reusing its own alternatives.
 delete next.heatColumnEvidence;
 next.heatColumnEvidence=prepareHeatColumnEvidence(next,{target:evidence.target,associationSource:bundle.associationSource,hypotheses:structuredClone(evidence.hypotheses),readings:structuredClone(preview.readings)});
 const comparison=compareHeatColumnEvidence(next);
 const originalLabels=baseline.survivingLabels;
 const candidates=comparison.candidates.map(c=>({...c,retainedOriginally:originalLabels.includes(c.label)}));
 const supported=baseline.counts.calibration>0&&originalLabels.length>0&&preview.readings.length>0;
 const labels=supported?candidates.filter(c=>c.retainedOriginally&&c.challenge.compatible===true).map(c=>c.label):null;
 const status=!baseline.counts.calibration?'need-original-calibration':!originalLabels.length?'original-family-rejected':!labels.length?'transfer-rejected':labels.length===1?'one-finite-alternative':'ambiguous';
 return {status,durationMinutes:duration,originalStatus:baseline.status,originalCalibrationLabels:baseline.calibrationLabels,originalSurvivingLabels:originalLabels,transferLabels:labels,candidates,readings:preview.readings,originalRows:preview.originals,
 semantics:'Fixed original finite alternatives challenged on a separately declared exposure. Original calibration and challenge outcomes are unchanged. Surface material properties stay fixed; each exposure retains its explicit initial temperatures, forcing and sources. Roles and source association do not establish independent acquisition or unchanged physical material. No fitting, unique identification or physical validation.'};
}

export function serializeHeatColumnTransfer(bundle){validateHeatColumnTransfer(bundle);const text=JSON.stringify(bundle);if(bytes(text)>MAX_TRANSFER_FILE_BYTES)throw Error('Original transfer bundle exceeds its reopen limit');return text;}
export function parseHeatColumnTransfer(text){if(typeof text!=='string'||bytes(text)>MAX_TRANSFER_FILE_BYTES)throw Error('Original transfer bundle exceeds its reopen limit');const bundle=JSON.parse(text);validateHeatColumnTransfer(bundle);return bundle;}
