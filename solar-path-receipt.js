import {compareSunPath, validateSunPath, SUN_PATH_MODEL} from './solar-path.js';
import {serializePortableProject, parsePortableProject} from './project-portability.js';

export const SUN_PATH_INVESTIGATION_KIND = 'experimental-earth/sun-path-inputs/1';
export const MAX_SUN_PATH_INVESTIGATION_BYTES = 5 * 1024 * 1024;
export const SUN_PATH_INVESTIGATION_LIMITS = 'This file retains declared inputs, including the original site and geographic location. '
  + 'Reopening calculates a new comparison with this application and its pinned sun-position model; no saved verdict is trusted. '
  + 'It does not authenticate sources or observations, establish physical accuracy, or replace the active project. '
  + 'Discrete samples do not establish continuous hours of sunlight or shade.';

const envelopeKeys = ['kind', 'model', 'project', 'declaration', 'selectedCellIndex'];
const declarationKeys = ['latitudeDeg', 'longitudeDeg', 'gridColumnBearingDeg', 'locationSource',
  'orientationSource', 'startUtc', 'endUtc', 'stepMinutes'];

function hasKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key));
}

export function checkSunPathInvestigationBytes(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_SUN_PATH_INVESTIGATION_BYTES) {
    throw Error('Sun-path investigation exceeds the 5 MiB file limit.');
  }
}

function prepare(project, input, selectedCellIndex) {
  // Use the maintained full-project admission and byte limit before copying it.
  const source = parsePortableProject(serializePortableProject(project));
  const validated = validateSunPath(input);
  const declaration = Object.fromEntries(declarationKeys.map(key => [key, validated[key]]));
  if (!Number.isInteger(selectedCellIndex) || selectedCellIndex < 0
    || selectedCellIndex >= source.width * source.height) {
    throw Error('The selected ground sample must belong to the retained source grid.');
  }
  // Admission includes retained-source equality and the complete calculation budget.
  const report = compareSunPath(source, declaration);
  const investigation = {kind: SUN_PATH_INVESTIGATION_KIND, model: {...SUN_PATH_MODEL},
    project: source, declaration, selectedCellIndex};
  checkSunPathInvestigationBytes(new Blob([JSON.stringify(investigation)]).size);
  return {investigation, report};
}

export function buildSunPathInvestigation(project, input, selectedCellIndex = 0) {
  return prepare(project, input, selectedCellIndex).investigation;
}

/** Input-only export: never take an already-computed or caller-edited verdict. */
export function serializeSunPathInvestigation(project, input, selectedCellIndex = 0) {
  const text = JSON.stringify(buildSunPathInvestigation(project, input, selectedCellIndex), null, 2);
  checkSunPathInvestigationBytes(new Blob([text]).size);
  return text;
}

export function reopenSunPathInvestigation(value) {
  if (!hasKeys(value, envelopeKeys) || value.kind !== SUN_PATH_INVESTIGATION_KIND) {
    throw Error('Unsupported sun-path investigation envelope; only retained inputs are accepted.');
  }
  if (!hasKeys(value.model, Object.keys(SUN_PATH_MODEL))
    || Object.keys(SUN_PATH_MODEL).some(key => value.model[key] !== SUN_PATH_MODEL[key])) {
    throw Error('This investigation names an unsupported sun-position model.');
  }
  if (!hasKeys(value.declaration, declarationKeys)) {
    throw Error('Sun-path declarations must contain only the supported geographic and UTC inputs.');
  }
  return prepare(value.project, value.declaration, value.selectedCellIndex);
}

export function parseSunPathInvestigation(text) {
  if (typeof text !== 'string') throw TypeError('Sun-path investigation must be JSON text.');
  checkSunPathInvestigationBytes(new Blob([text]).size);
  let value;
  try { value = JSON.parse(text); }
  catch { throw Error('Sun-path investigation JSON is invalid.'); }
  return reopenSunPathInvestigation(value);
}
