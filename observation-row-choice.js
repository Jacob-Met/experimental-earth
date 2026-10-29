import { validateProject } from './core.js';
import { previewObservationTable, commitObservationPreview } from './observation-table.js';

/**
 * Admit the complete original table without reserving notebook capacity or
 * selecting rows. The ordinary all-row preview API retains its existing gates.
 */
export function previewObservationChoices(text, project, fileName, mapping) {
  validateProject(project);
  const admitted = previewObservationTable(text, { ...project, observations: [] }, fileName, mapping);
  return { ...admitted, context: JSON.stringify(project) };
}

/** Commit explicit original record-start lines, in their original source order. */
export function commitObservationChoices(project, preview, selectedLines) {
  if (!Array.isArray(selectedLines) || selectedLines.length === 0) {
    throw new Error('Choose at least one source row');
  }
  const wanted = new Set();
  for (const line of selectedLines) {
    if (!Number.isSafeInteger(line) || line <= 0 || wanted.has(line)) {
      throw new Error('Source row choices must be unique positive line numbers');
    }
    wanted.add(line);
  }
  if (!preview || !Array.isArray(preview.readings)) {
    throw new Error('Preview the original table before choosing rows');
  }
  const available = new Set();
  for (const reading of preview.readings) {
    const line = reading?.tableSource?.line;
    if (!Number.isSafeInteger(line) || line <= 0 || available.has(line)) {
      throw new Error('The source preview has invalid or ambiguous row identities');
    }
    available.add(line);
  }
  for (const line of wanted) {
    if (!available.has(line)) throw new Error('A chosen source row is absent from the preview');
  }
  const readings = preview.readings.filter(reading => wanted.has(reading.tableSource.line));
  return commitObservationPreview(project, { ...preview, readings });
}
