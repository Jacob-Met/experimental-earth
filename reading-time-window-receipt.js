import {compareReadingWindows} from './reading-time-windows.js';
import {DEFAULT_STUDY} from './study-contract.js';
export const READING_WINDOW_KIND='experimental-earth/reading-time-windows/1';
export const READING_WINDOW_BYTES=4*1024*1024;
export function checkReadingWindowBytes(bytes){if(!Number.isSafeInteger(bytes)||bytes<0||bytes>READING_WINDOW_BYTES)throw Error('Reading-window file exceeds 4 MiB');}
export function recomputeReadingWindowReceipt(receipt){
 if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||Object.keys(receipt).sort().join(',')!=='kind,project,windows'||receipt.kind!==READING_WINDOW_KIND)throw Error('Unsupported reading-window input envelope');
 const comparison=compareReadingWindows(receipt.project,receipt.windows,receipt.project.infiltrationStudy??DEFAULT_STUDY);
 if(comparison.status!=='compared')throw Error('Reading-window comparison unavailable: '+comparison.status);
 return {receipt:structuredClone(receipt),comparison};
}
export function buildReadingWindowReceipt(project,windows){return recomputeReadingWindowReceipt({kind:READING_WINDOW_KIND,project,windows});}
export function serializeReadingWindowReceipt(receipt){const checked=recomputeReadingWindowReceipt(receipt).receipt;const text=JSON.stringify(checked,null,2);checkReadingWindowBytes(new TextEncoder().encode(text).length);return text;}
export function parseReadingWindowReceipt(text){if(typeof text!=='string')throw Error('Expected JSON input text');checkReadingWindowBytes(new TextEncoder().encode(text).length);let input;try{input=JSON.parse(text);}catch{throw Error('Invalid reading-window JSON');}return recomputeReadingWindowReceipt(input);}
