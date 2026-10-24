/** An authored project must remain importable after its own Export action. */
import { validateProject } from './core.js';

export const MAX_PROJECT_FILE_BYTES = 4 * 1024 * 1024;

export function checkProjectFileBytes(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_PROJECT_FILE_BYTES) {
    throw new Error('Project file exceeds 4 MiB limit');
  }
}

export function serializePortableProject(project) {
  validateProject(project);
  const json = JSON.stringify(project, null, 2);
  checkProjectFileBytes(new Blob([json]).size);
  return json;
}

export function parsePortableProject(json) {
  if (typeof json !== 'string') throw new TypeError('Project JSON must be text');
  checkProjectFileBytes(new Blob([json]).size);
  return validateProject(JSON.parse(json));
}
