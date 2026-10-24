import {validateProject} from './core.js';
import {compareClockOffsets} from './clock-study.js';
import {validateStudy, DEFAULT_STUDY} from './study-contract.js';

export const CLOCK_RECEIPT_KIND='experimental-earth/clock-diagnostic/1';
export const MAX_CLOCK_RECEIPT_BYTES=8*1024*1024;
export const CLOCK_RECEIPT_LIMITS='An internally consistent saved diagnostic does not authenticate supplied readings, timing, field observations, local datum, infiltration rates or the physical model. No clock hypothesis or model result is adopted into the active project.';

export function checkClockReceiptBytes(bytes){
 if(!Number.isSafeInteger(bytes)||bytes<0||bytes>MAX_CLOCK_RECEIPT_BYTES)throw Error('Clock diagnostic exceeds 8 MiB limit');
}

function rationale(reason){
 if(typeof reason!=='string'||!reason.trim())throw Error('Describe why these timing offsets are being considered.');
 if(reason.trim().length>200)throw Error('Timing hypothesis source must not exceed 200 characters');
 return reason.trim();
}

function ownKeysEqual(a,b){
 const aKeys=Object.keys(a).sort(),bKeys=Object.keys(b).sort();
 return aKeys.length===bKeys.length&&aKeys.every((key,i)=>key===bKeys[i]);
}

function exactlySame(a,b){
 if(a===b)return true;
 if(a===null||b===null||typeof a!==typeof b)return false;
 if(typeof a!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 if(!ownKeysEqual(a,b))return false;
 return Object.keys(a).every(key=>exactlySame(a[key],b[key]));
}

export function buildClockReceipt(project,offsetsMinutes,reason,study=project?.infiltrationStudy??DEFAULT_STUDY){
 validateProject(project);validateStudy(study);
 if(!exactlySame(study,project.infiltrationStudy??DEFAULT_STUDY))throw Error('Clock diagnostic study must match the included project study selection');
 const declaration=rationale(reason);
 const comparison=compareClockOffsets(project,offsetsMinutes,study);
 if(comparison.status!=='compared')throw Error('Assign at least one calibration or held-aside reading before exporting a clock diagnostic');
 const receipt={
  kind:CLOCK_RECEIPT_KIND,
  project:structuredClone(project),
  study:structuredClone(study),
  offsetsMinutes:[...offsetsMinutes],
  reason:declaration,
  comparison,
  limitations:CLOCK_RECEIPT_LIMITS
 };
 checkClockReceiptBytes(new Blob([JSON.stringify(receipt)]).size);
 return receipt;
}

export function serializeClockReceipt(receipt){
 // Recompute even for locally created objects: callers cannot download cached or edited verdicts.
 const checked=verifyClockReceipt(receipt);
 const text=JSON.stringify(checked,null,2);
 checkClockReceiptBytes(new Blob([text]).size);
 return text;
}

export function verifyClockReceipt(receipt){
 if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||
   !ownKeysEqual(receipt,{kind:0,project:0,study:0,offsetsMinutes:0,reason:0,comparison:0,limitations:0})||
   receipt.kind!==CLOCK_RECEIPT_KIND||receipt.limitations!==CLOCK_RECEIPT_LIMITS){
  throw Error('Unsupported or altered clock diagnostic envelope');
 }
 // A source may itself be fictional or forged. This is deterministic recomputation only.
 const recalculated=buildClockReceipt(receipt.project,receipt.offsetsMinutes,receipt.reason,receipt.study);
 if(!exactlySame(receipt,recalculated))throw Error('Saved clock conclusions or declarations do not match recomputed source and assumptions');
 return recalculated;
}

export function parseClockReceipt(text){
 if(typeof text!=='string')throw TypeError('Clock diagnostic must be JSON text');
 checkClockReceiptBytes(new Blob([text]).size);
 let parsed;
 try{parsed=JSON.parse(text);}catch{throw Error('Clock diagnostic JSON is invalid');}
 return verifyClockReceipt(parsed);
}
