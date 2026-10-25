import {compareCommonClock} from './common-clock-feasibility.js';
import {DEFAULT_STUDY} from './study-contract.js';
export const COMMON_CLOCK_KIND='experimental-earth/common-clock-feasibility/1';
export const COMMON_CLOCK_BYTES=4*1024*1024;
export function checkCommonClockBytes(bytes){if(!Number.isSafeInteger(bytes)||bytes<0||bytes>COMMON_CLOCK_BYTES)throw Error('Common-clock input exceeds 4 MiB');}
export function recomputeCommonClockReceipt(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='declaration,kind,project'||input.kind!==COMMON_CLOCK_KIND)throw Error('Unsupported common-clock input envelope');
 const comparison=compareCommonClock(input.project,input.declaration,input.project.infiltrationStudy??DEFAULT_STUDY);
 if(comparison.status!=='compared')throw Error('Common-clock comparison unavailable: '+comparison.status);
 return {receipt:structuredClone(input),comparison};
}
export function buildCommonClockReceipt(project,declaration){return recomputeCommonClockReceipt({kind:COMMON_CLOCK_KIND,project,declaration});}
export function serializeCommonClockReceipt(input){const text=JSON.stringify(recomputeCommonClockReceipt(input).receipt,null,2);checkCommonClockBytes(new TextEncoder().encode(text).length);return text;}
export function parseCommonClockReceipt(text){if(typeof text!=='string')throw Error('Expected common-clock JSON text');checkCommonClockBytes(new TextEncoder().encode(text).length);let input;try{input=JSON.parse(text);}catch{throw Error('Invalid common-clock JSON');}return recomputeCommonClockReceipt(input);}
