import { canonicalLongwaveHeat } from './longwave-heat.js';

// The admitted canonical shape has at most 46,400 UTF-16 source/context
// code units. JSON can expand each to six ASCII bytes (including lone
// surrogates/control escapes): <=278,400 payload bytes. Fixed keys, schema
// labels, indentation and <=107 finite numbers add less than 10,000 bytes.
// 320 KiB covers that complete shape while retaining a bounded raw import.
// The write-time check remains authoritative if a future schema grows.
export const LONGWAVE_FILE_MAX_BYTES = 320 * 1024;
const byteLength = text => new TextEncoder().encode(text).byteLength;

export function serializeLongwaveHeat(input) {
  const text = JSON.stringify(canonicalLongwaveHeat(input), null, 2);
  if (byteLength(text) > LONGWAVE_FILE_MAX_BYTES) throw Error('Original longwave investigation exceeds the 320 KiB transfer limit');
  return text;
}

export function parseLongwaveHeat(text) {
  if (typeof text !== 'string' || byteLength(text) > LONGWAVE_FILE_MAX_BYTES) {
    throw Error('Choose original longwave JSON no larger than 320 KiB');
  }
  return canonicalLongwaveHeat(JSON.parse(text));
}
