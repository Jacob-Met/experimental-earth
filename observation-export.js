import { validateProject } from './core.js';

const HEADER = 'cell,minute,depth,uncertainty,unit,source,scenario,use';

function hasUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) return true;
      index += 1;
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      return true;
    }
  }
  return false;
}

function quoteCSV(value) {
  return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}

const numberToken = value => Object.is(value, -0) ? '-0' : String(value);

/** A normalized notebook table; original source metadata stays in the project. */
export function serializeObservationCSV(project) {
  validateProject(project);
  if (project.observations.length === 0) {
    throw new Error('Add a reading to the notebook before exporting observation CSV.');
  }
  const rows = project.observations.map((reading, index) => {
    if (hasUnpairedSurrogate(reading.source)) {
      throw new Error('Observation row ' + (index + 1) +
        ' has source text that cannot be saved faithfully as UTF-8 CSV. ' +
        'Use Export JSON to preserve the original text.');
    }
    const column = reading.cellIndex % project.width;
    const row = Math.floor(reading.cellIndex / project.width) + 1;
    return [
      String.fromCharCode(65 + column) + row,
      numberToken(reading.minute), numberToken(reading.depthMm),
      numberToken(reading.uncertaintyMm), 'mm', reading.source,
      reading.scenario === undefined ? 'unassigned' : reading.scenario,
      reading.use === undefined ? 'unassigned' : reading.use,
    ].map(quoteCSV).join(',');
  });
  return [HEADER, ...rows].join('\r\n') + '\r\n';
}
