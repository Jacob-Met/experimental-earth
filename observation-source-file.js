/** Original observation-file custody; interpretation stays in observation-table.js. */
export const OBSERVATION_SOURCE_FORMAT = 'experimental-earth-observation-source/1';
export const MAX_OBSERVATION_CSV_BYTES = 128000;
export const MAX_OBSERVATION_SOURCE_BYTES = 512000;
export const MAX_STATION_MAP_CHARACTERS = 32000;
const encoder = new TextEncoder();
const decoder = () => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const ownKeys = (value, keys, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join('\0') !== [...keys].sort().join('\0')) {
    throw new Error('Invalid ' + label + ' fields');
  }
};
const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
const digest = bytes => crypto.subtle.digest('SHA-256', bytes).then(hex);
function boundedName(name) {
  if (typeof name !== 'string' || !name.trim() || name.length > 160 ||
      decoder().decode(encoder.encode(name)) !== name) throw new Error('Supply a table filename of 1–160 Unicode characters');
}
function boundedMap(text) {
  if (typeof text !== 'string' || text.length > MAX_STATION_MAP_CHARACTERS ||
      decoder().decode(encoder.encode(text)) !== text) throw new Error('Station map exceeds 32 KB or contains invalid Unicode');
}
function encodeBytes(bytes) {
  let value = '';
  for (let i = 0; i < bytes.length; i += 8192) value += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(value);
}
function decodeBytes(table) {
  ownKeys(table, ['fileName', 'byteLength', 'sha256', 'base64'], 'original table');
  boundedName(table.fileName);
  if (!Number.isSafeInteger(table.byteLength) || table.byteLength < 1 || table.byteLength > MAX_OBSERVATION_CSV_BYTES) {
    throw new Error('Observation table exceeds the 128 KB file limit or is empty');
  }
  if (typeof table.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(table.sha256)) throw new Error('Invalid original table SHA-256');
  if (typeof table.base64 !== 'string' || table.base64.length !== 4 * Math.ceil(table.byteLength / 3) ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(table.base64)) {
    throw new Error('Invalid bounded original table bytes');
  }
  const bytes = Uint8Array.from(atob(table.base64), value => value.charCodeAt(0));
  if (bytes.byteLength !== table.byteLength || encodeBytes(bytes) !== table.base64) throw new Error('Original table byte count or base64 differs');
  return bytes;
}
async function receiveTable(table) {
  ownKeys(table, ['fileName', 'byteLength', 'sha256', 'base64'], 'original table');
  const record = { ...table };
  const bytes = decodeBytes(record);
  const text = decoder().decode(bytes);
  if (await digest(bytes) !== record.sha256) throw new Error('Original table SHA-256 differs');
  return Object.freeze({ table: Object.freeze(record), text });
}
/** Copy before awaiting so a caller cannot change the original under its digest. */
export async function admitObservationCsv(input, fileName) {
  boundedName(fileName);
  if (!(input instanceof ArrayBuffer) && !(input instanceof Uint8Array)) throw new Error('Original CSV bytes are required');
  const length = input.byteLength;
  if (length < 1 || length > MAX_OBSERVATION_CSV_BYTES) throw new Error('Observation table exceeds the 128 KB file limit or is empty');
  const bytes = input instanceof Uint8Array ? Uint8Array.from(input) : new Uint8Array(input.slice(0));
  const text = decoder().decode(bytes);
  const table = Object.freeze({ fileName, byteLength: bytes.byteLength, sha256: await digest(bytes), base64: encodeBytes(bytes) });
  return Object.freeze({ table, text });
}
export function originalObservationCsvBytes(source) {
  return decodeBytes(source?.table);
}
/** Map text is retained literally, including an unfinished map awaiting correction. */
export async function serializeObservationSource(source, stationMapText) {
  boundedMap(stationMapText);
  const accepted = await receiveTable(source?.table);
  const json = JSON.stringify({ format: OBSERVATION_SOURCE_FORMAT, table: accepted.table, stationMapText }, null, 2);
  if (encoder.encode(json).byteLength > MAX_OBSERVATION_SOURCE_BYTES) throw new Error('Saved observation source exceeds 512 KB');
  return json;
}
export async function parseObservationSource(json) {
  if (typeof json !== 'string' || encoder.encode(json).byteLength > MAX_OBSERVATION_SOURCE_BYTES) throw new Error('Saved observation source exceeds 512 KB');
  const packet = JSON.parse(json.replace(/^\uFEFF/, ''));
  ownKeys(packet, ['format', 'table', 'stationMapText'], 'saved observation source');
  if (packet.format !== OBSERVATION_SOURCE_FORMAT) throw new Error('Unsupported saved observation source');
  boundedMap(packet.stationMapText);
  return { source: await receiveTable(packet.table), stationMapText: packet.stationMapText };
}
