import {validateProject} from './core.js';
import {compareLocalWaterBudget, MAX_LOCAL_BUDGET_CELL_STEPS} from './local-water-budget.js';
import {validateRootZone, validateDrySchedule, runRootZone} from './root-zone.js';
export const ROOT_ZONE_FILE_LIMIT = 5 * 1024 * 1024;
export const ROOT_ZONE_MEANING = 'Whole-event modeled infiltration is applied as one recharge pulse before the dry period. Excess above declared field capacity drains immediately. The dry period has transpiration only: no further rain, irrigation, soil evaporation, capillary rise, root growth or lateral soil flow. This is a declared model, not a measured soil state or irrigation recommendation.';
const keys = ['schema','cellIndex','rechargeBasis','associationSource','existing','proposal','schedule'];
function plain(x) {return x && typeof x === 'object' && !Array.isArray(x);}
export function validateRootZoneStudy(project, study) {
  validateProject(project);
  if (!plain(study) || study.schema !== 'experimental-earth-root-zone-study/1' ||
      Object.keys(study).some(k => !keys.includes(k)) || keys.some(k => !Object.hasOwn(study,k))) throw Error('Unsupported root-zone study fields');
  if (!Number.isInteger(study.cellIndex) || study.cellIndex < 0 || study.cellIndex >= project.width * project.height) throw Error('Choose one source cell in the saved site');
  if (study.rechargeBasis !== 'modeled-event-infiltration-pulse') throw Error('Choose the explicit whole-event modeled-infiltration pulse');
  if (typeof study.associationSource !== 'string' || !study.associationSource.trim() || study.associationSource.length > 500) throw Error('Attribute the association of modeled infiltration with this rooted store');
  validateRootZone(study.existing); validateRootZone(study.proposal); validateDrySchedule(study.schedule);
  const cellSteps = 2 * project.width * project.height * Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes);
  if (cellSteps > MAX_LOCAL_BUDGET_CELL_STEPS) throw Error('Root-zone recharge exceeds the existing ' + MAX_LOCAL_BUDGET_CELL_STEPS + ' cell-step water-budget limit');
  return {cellSteps};
}
export function compareRootZone(project, study) {
  const {cellSteps} = validateRootZoneStudy(project, study);
  const budget = compareLocalWaterBudget(project);
  if (budget.status !== 'computed') throw Error('Original infiltration budget was not computed');
  const cellAreaM2 = project.weather.cellSizeM ** 2, i = study.cellIndex;
  const side = target => {
    const originalBudget = structuredClone(budget[target].cells[i]);
    return {...runRootZone(study[target], originalBudget.absorbedLiters / cellAreaM2, study.schedule),
      originalCell: structuredClone(project[target][i]), originalBudget};
  };
  const existing = side('existing'), proposal = side('proposal');
  return {schema: 'experimental-earth-root-zone-comparison/1', sourceSignature: JSON.stringify(project),
    study: structuredClone(study), cellSteps, cellAreaM2, cellIndex: i,
    originalWeather: structuredClone(project.weather), existing, proposal,
    change: Object.fromEntries(['rechargeMm','drainageMm','availableMm','suppliedMm','unmetMm','demandLimitedDays']
      .map(key => [key, proposal[key] - existing[key]])), meaning: ROOT_ZONE_MEANING};
}
export function checkRootZoneFileBytes(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > ROOT_ZONE_FILE_LIMIT) throw Error('Root-zone investigation exceeds the 5 MiB file limit');
}
export function serializeRootZoneInvestigation(project, study) {
  validateRootZoneStudy(project, study);
  const text = JSON.stringify({schema:'experimental-earth-root-zone-investigation/1', project, study},null,2);
  checkRootZoneFileBytes(new TextEncoder().encode(text).byteLength);
  return text;
}
export function parseRootZoneInvestigation(text) {
  if (typeof text !== 'string') throw Error('Root-zone file must be UTF-8 JSON text');
  checkRootZoneFileBytes(new TextEncoder().encode(text).byteLength);
  const value = JSON.parse(text);
  if (!plain(value) || value.schema !== 'experimental-earth-root-zone-investigation/1' ||
      Object.keys(value).some(k => !['schema','project','study'].includes(k))) throw Error('Unsupported root-zone investigation; saved conclusions are not accepted');
  validateRootZoneStudy(value.project, value.study);
  return value;
}
