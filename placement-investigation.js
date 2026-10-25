import {validatePlacementQuery} from './placement-search.js';
import {validatePlacementTradeoffs} from './placement-tradeoffs.js';

export const PLACEMENT_INVESTIGATION_SCHEMA = 'experimental-earth-placement-investigation/1';
export const RECEIVING_PLACEMENT_INVESTIGATION_SCHEMA = 'experimental-earth-placement-investigation/2';
export const PLACEMENT_FILE_LIMIT = 5 * 1024 * 1024;
const keys = ['eligibleCells','maxEdits','surface','metric','subset','study','targets','durationGoal','drainingLayer','receivingStudy'];
function admit(project, query, tradeoffs) {
  if (!query || Object.keys(query).some(key => !keys.includes(key))) throw Error('Open original placement inputs, not saved conclusions');
  const normalized = validatePlacementQuery(project, query);
  return {project:structuredClone(project),query:normalized,
    tradeoffs:tradeoffs === null ? null : validatePlacementTradeoffs(project, normalized, tradeoffs)};
}
function checkBytes(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > PLACEMENT_FILE_LIMIT) throw Error('Placement investigation exceeds the 5 MiB input limit');
}
export function serializePlacementInvestigation(project, query, tradeoffs = null) {
  const input = admit(project, query, tradeoffs);
  const text = JSON.stringify({schema:input.query.receivingStudy?RECEIVING_PLACEMENT_INVESTIGATION_SCHEMA:PLACEMENT_INVESTIGATION_SCHEMA,...input},null,2);
  checkBytes(new TextEncoder().encode(text).length);return text;
}
export function parsePlacementInvestigation(text) {
  if (typeof text !== 'string') throw Error('Read an original placement investigation');
  checkBytes(new TextEncoder().encode(text).length);
  const value = JSON.parse(text), names = ['schema','project','query','tradeoffs'];
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![PLACEMENT_INVESTIGATION_SCHEMA,RECEIVING_PLACEMENT_INVESTIGATION_SCHEMA].includes(value.schema) || Object.keys(value).some(key => !names.includes(key)) ||
      names.some(key => !Object.hasOwn(value,key))) throw Error('Open original placement inputs, not saved conclusions');
  if((value.schema===RECEIVING_PLACEMENT_INVESTIGATION_SCHEMA)!==Boolean(value.query&&Object.hasOwn(value.query,'receivingStudy')))
    throw Error('Receiving placement inputs require their explicit version 2 model contract');
  return admit(value.project,value.query,value.tradeoffs);
}
