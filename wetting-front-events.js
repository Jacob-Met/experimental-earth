import { runRain, validateProject } from './core.js';
import { evaluateReadings } from './infiltration-study.js';
import { compareWettingFront, wettingFrontWork, summarizeWettingFront,
  WETTING_FRONT_FILE_LIMIT } from './wetting-front-study.js';
import { MAX_WETTING_FRONT_CELL_STEPS } from './wetting-front-contract.js';

export const WETTING_FRONT_EVENTS_SCHEMA = 'experimental-earth-wetting-front-events/1';
export const WETTING_FRONT_EVENTS_MEANING = 'The second event challenges the same finite conductivity explanations with separately declared initial capillary drives. It does not fit the second readings, infer moisture recovery, carry standing water between events, or identify a unique soil property. Both modeled events start with zero cumulative infiltration and zero standing water. Agreement is conditional on the declared homogeneous sharp-front model.';

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
function exactObject(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !own(value, key))) {
    throw new Error(label + ' must contain exactly ' + keys.join(', '));
  }
}
function nonempty(value, maximum, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(label + ' must be nonempty text of at most ' + maximum + ' characters');
  }
}
function sameValue(first, second) {
  if (Object.is(first, second)) return true;
  if (!first || !second || typeof first !== 'object' || typeof second !== 'object' ||
      Array.isArray(first) !== Array.isArray(second)) return false;
  const a = Object.keys(first).sort(), b = Object.keys(second).sort();
  return a.length === b.length && a.every((key, index) =>
    key === b[index] && sameValue(first[key], second[key]));
}

/** Validate the complete two-event request before any simulation is started. */
export function admitWettingFrontEvents(calibrationProject, challengeProject,
    study = calibrationProject?.wettingFrontStudy, references, initialConditions) {
  const firstCellSteps = wettingFrontWork(calibrationProject, study);
  validateProject(challengeProject);
  exactObject(references, ['calibration', 'challenge'], 'Event references');
  nonempty(references.calibration, 200, 'First-event reference');
  nonempty(references.challenge, 200, 'Second-event reference');
  if (references.calibration.trim() === references.challenge.trim()) {
    throw new Error('Use distinct references for the two events');
  }
  exactObject(initialConditions, ['basis', 'challengeDrivesMm'], 'Initial conditions');
  nonempty(initialConditions.basis, 600, 'Second-event starting-condition basis');
  const drives = initialConditions.challengeDrivesMm;
  if (!Array.isArray(drives) || drives.length !== study.hypotheses.length) {
    throw new Error('Declare one second-event capillary drive for every original explanation');
  }
  for (let index = 0; index < drives.length; index++) {
    if (!own(drives, index) || typeof drives[index] !== 'number' ||
        !Number.isFinite(drives[index]) || drives[index] < 0 || drives[index] > 5000) {
      throw new Error('Each second-event capillary drive must be a finite number from 0 to 5000 mm');
    }
  }
  if (calibrationProject.width !== challengeProject.width ||
      calibrationProject.height !== challengeProject.height ||
      !sameValue(calibrationProject[study.target], challengeProject[study.target])) {
    throw new Error('The observed site grid, cell declarations and material assignments must match across events');
  }
  for (const key of ['cellSizeM', 'mobilityPerHour', 'boundaryExitPerHour', 'stepMinutes']) {
    if (!Object.is(calibrationProject.weather[key], challengeProject.weather[key])) {
      throw new Error('Keep the same numerical and routing assumption across events: ' + key);
    }
  }
  const selected = project => project.observations.map((reading, index) => ({ reading, index }))
    .filter(({ reading }) => reading.scenario === study.target);
  const first = selected(calibrationProject), second = selected(challengeProject);
  const firstCalibration = first.filter(({ reading }) => reading.use === 'calibration');
  const firstChallenge = first.filter(({ reading }) => reading.use === 'challenge');
  const secondCalibration = second.filter(({ reading }) => reading.use === 'calibration');
  const secondChallenge = second.filter(({ reading }) => reading.use === 'challenge');
  if (!calibrationProject[study.target].some(cell => cell.surface === study.surface)) {
    throw new Error('The investigated material must be present in the observed site');
  }
  if (!firstCalibration.length) throw new Error('Assign calibration readings to the first event');
  if (secondCalibration.length) {
    throw new Error('The second event is held aside: its selected-scenario readings cannot be calibration readings');
  }
  if (!secondChallenge.length) throw new Error('Assign at least one held-aside reading to the second event');
  const secondCellSteps = challengeProject.width * challengeProject.height *
    Math.ceil(challengeProject.weather.durationMinutes / challengeProject.weather.stepMinutes) *
    study.hypotheses.length;
  const cellSteps = firstCellSteps + secondCellSteps;
  if (!Number.isFinite(cellSteps) || cellSteps > MAX_WETTING_FRONT_CELL_STEPS) {
    throw new Error('The combined two-event comparison exceeds ' +
      MAX_WETTING_FRONT_CELL_STEPS.toLocaleString('en-US') + ' cell-steps');
  }
  return { cellSteps, firstCellSteps, secondCellSteps, secondChallenge,
    counts: { firstCalibration: firstCalibration.length, firstChallenge: firstChallenge.length,
      firstIgnored: calibrationProject.observations.length - firstCalibration.length - firstChallenge.length,
      secondChallenge: secondChallenge.length,
      secondIgnored: challengeProject.observations.length - secondChallenge.length } };
}

/** Keep first-event ranking and every original identity; the second event only challenges. */
export function compareWettingFrontEvents(calibrationProject, challengeProject,
    study = calibrationProject?.wettingFrontStudy, references, initialConditions) {
  const admitted = admitWettingFrontEvents(calibrationProject, challengeProject, study, references, initialConditions);
  const firstStudy = structuredClone(study);
  // Planning a new reading is separate from scoring the original evidence.
  delete firstStudy.question;
  const firstReport = compareWettingFront(calibrationProject, firstStudy);
  const candidates = firstReport.candidates.map(first => {
    const capillaryDriveMm = initialConditions.challengeDrivesMm[first.id - 1];
    const run = runRain(challengeProject[study.target], challengeProject.width, challengeProject.height,
      challengeProject.weather, { surfaceWettingFront: { surface: study.surface,
        conductivityMmHr: first.conductivityMmHr, capillaryDriveMm } });
    const challenge = evaluateReadings(run, admitted.secondChallenge);
    return { id: first.id, conductivityMmHr: first.conductivityMmHr,
      firstCapillaryDriveMm: first.capillaryDriveMm, challengeCapillaryDriveMm: capillaryDriveMm,
      first, second: { model: summarizeWettingFront(run, challengeProject.selectedIndex ?? 0), challenge },
      survives: first.calibration.compatible === true && first.challenge.compatible !== false &&
        challenge.compatible === true };
  });
  const survivingIds = candidates.filter(row => row.survives).map(row => row.id);
  const firstSurvivingIds = firstReport.survivingIds.slice();
  const status = !firstReport.compatibleIds.length ? 'calibration-rejected' :
    !firstSurvivingIds.length ? 'first-event-challenged' :
    !survivingIds.length ? 'challenged' : survivingIds.length === 1 ? 'one-survivor' : 'ambiguous';
  return { schema: 'experimental-earth-wetting-front-event-comparison/1',
    study: structuredClone(study), references: structuredClone(references),
    initialConditions: structuredClone(initialConditions), firstReport, candidates,
    firstSurvivingIds, survivingIds, status, counts: admitted.counts,
    cellSteps: admitted.cellSteps, firstCellSteps: admitted.firstCellSteps,
    secondCellSteps: admitted.secondCellSteps, meaning: WETTING_FRONT_EVENTS_MEANING };
}

export function serializeWettingFrontEvents(calibrationProject, challengeProject,
    study = calibrationProject?.wettingFrontStudy, references, initialConditions) {
  admitWettingFrontEvents(calibrationProject, challengeProject, study, references, initialConditions);
  const text = JSON.stringify({ schema: WETTING_FRONT_EVENTS_SCHEMA,
    calibrationProject, challengeProject, study, references, initialConditions }, null, 2);
  if (new TextEncoder().encode(text).byteLength > WETTING_FRONT_FILE_LIMIT) {
    throw new Error('Two-event investigation exceeds the 5 MiB file limit');
  }
  return text;
}
export function parseWettingFrontEvents(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > WETTING_FRONT_FILE_LIMIT) {
    throw new Error('Two-event investigation exceeds the 5 MiB file limit');
  }
  const bundle = JSON.parse(text);
  exactObject(bundle, ['schema', 'calibrationProject', 'challengeProject', 'study',
    'references', 'initialConditions'], 'Two-event inputs; saved conclusions are not accepted');
  if (bundle.schema !== WETTING_FRONT_EVENTS_SCHEMA) throw new Error('Unsupported two-event investigation schema');
  admitWettingFrontEvents(bundle.calibrationProject, bundle.challengeProject, bundle.study,
    bundle.references, bundle.initialConditions);
  return bundle;
}
export function reopenWettingFrontEvents(bundle) {
  exactObject(bundle, ['schema', 'calibrationProject', 'challengeProject', 'study',
    'references', 'initialConditions'], 'Two-event inputs; saved conclusions are not accepted');
  if (bundle.schema !== WETTING_FRONT_EVENTS_SCHEMA) throw new Error('Unsupported two-event investigation schema');
  return compareWettingFrontEvents(bundle.calibrationProject, bundle.challengeProject, bundle.study,
    bundle.references, bundle.initialConditions);
}
