import { runRain, validateProject, SURFACES } from './core.js';
import { evaluateReadings } from './infiltration-study.js';
import { validateWettingFrontStudy, MAX_WETTING_FRONT_CELL_STEPS } from './wetting-front-contract.js';
import { planWettingFrontQuestion } from './wetting-front-question.js';

export const WETTING_FRONT_MEANING = 'Declared homogeneous sharp-front event hypotheses. K is conductivity; A is wetting-front suction × initial moisture deficit. No moisture recovery, ponding-head correction or field calibration. Held-aside readings never rank the hypotheses; agreement cannot identify suction and deficit separately.';

function summary(result, cellIndex) {
  return {
    rainLiters: result.rainLiters, absorbedLiters: result.absorbedLiters,
    exitLiters: result.exitLiters, storedLiters: result.storedLiters,
    peakPondingLiters: result.peakPondingLiters, maxDepthMm: result.maxDepthMm,
    massErrorLiters: result.massErrorLiters,
    selectedCell: { cellIndex, depths: result.snapshots.map(snapshot => ({
      minute: snapshot.minute, depthMm: snapshot.depthsMm[cellIndex],
    })) },
  };
}

function admittedWork(project, study) {
  validateProject(project);
  if (!validateWettingFrontStudy(study, SURFACES)) throw new Error('Choose a wetting-front study first');
  if (study.question?.toMinute > project.weather.durationMinutes) {
    throw new Error('The reading-question window must fit inside the modeled event');
  }
  const cellSteps = project.width * project.height * Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes) *
    2 * (study.hypotheses.length + 1);
  if (cellSteps > MAX_WETTING_FRONT_CELL_STEPS) {
    throw new Error(`Soil comparison exceeds ${MAX_WETTING_FRONT_CELL_STEPS.toLocaleString('en-US')} cell-steps; reduce the candidate count, grid or duration, or increase the calculation interval`);
  }
  return cellSteps;
}

/** Same site/rain and finite declared explanations; no fitted parameter is adopted. */
export function compareWettingFront(project, study = project.wettingFrontStudy) {
  const cellSteps = admittedWork(project, study);
  const { target, surface } = study;
  const { width, height, weather } = project;
  const selectedIndex = project.selectedIndex ?? 0;
  const all = project.observations.map((reading, index) => ({ reading, index }));
  const calibration = all.filter(({ reading }) => reading.scenario === target && reading.use === 'calibration');
  const challenge = all.filter(({ reading }) => reading.scenario === target && reading.use === 'challenge');
  const counts = { calibration: calibration.length, challenge: challenge.length,
    ignored: all.length - calibration.length - challenge.length,
    affectedExisting: project.existing.filter(cell => cell.surface === surface).length,
    affectedProposal: project.proposal.filter(cell => cell.surface === surface).length };
  const supportedRuns = [];
  const runPair = (model, id) => {
    const options = model ? { surfaceWettingFront: { surface,
      conductivityMmHr: model.conductivityMmHr, capillaryDriveMm: model.capillaryDriveMm } } : {};
    const existing = runRain(project.existing, width, height, weather, options);
    const proposal = runRain(project.proposal, width, height, weather, options);
    const scored = target === 'existing' ? existing : proposal;
    const scoredCalibration = evaluateReadings(scored, calibration);
    if (study.question && id !== undefined && scoredCalibration.compatible === true) {
      supportedRuns.push({ id, conductivityMmHr: model.conductivityMmHr,
        capillaryDriveMm: model.capillaryDriveMm, snapshots: scored.snapshots });
    }
    return { existing: summary(existing, selectedIndex), proposal: summary(proposal, selectedIndex),
      calibration: scoredCalibration, challenge: evaluateReadings(scored, challenge),
      change: { exitLiters: proposal.exitLiters - existing.exitLiters,
        storedLiters: proposal.storedLiters - existing.storedLiters,
        peakPondingLiters: proposal.peakPondingLiters - existing.peakPondingLiters,
        maxDepthMm: proposal.maxDepthMm - existing.maxDepthMm } };
  };
  const baseline = runPair(null);
  const candidates = study.hypotheses.map((model, index) => ({ id: index + 1,
    conductivityMmHr: model.conductivityMmHr, capillaryDriveMm: model.capillaryDriveMm,
    ...runPair(model, index + 1) }));
  candidates.sort((a, b) => (a.calibration.rmseMm ?? 0) - (b.calibration.rmseMm ?? 0) || a.id - b.id);
  const supported = candidates.filter(row => row.calibration.compatible === true);
  const surviving = supported.filter(row => row.challenge.compatible !== false);
  const affectedTarget = target === 'existing' ? counts.affectedExisting : counts.affectedProposal;
  let status = 'ambiguous';
  if (!affectedTarget) status = 'surface-absent';
  else if (!calibration.length) status = 'need-calibration';
  else if (!supported.length) status = 'calibration-rejected';
  else if (!challenge.length) status = 'needs-challenge';
  else if (!surviving.length) status = 'challenged';
  else if (surviving.length === 1) status = 'one-survivor';
  // An absent source surface cannot supply evidence about its parameters.
  return { schema: 'experimental-earth-wetting-front-comparison/1', sourceSignature: JSON.stringify(project),
    study: structuredClone(study), selectedIndex, cellSteps, counts, status, baseline, candidates,
    compatibleIds: affectedTarget ? supported.map(row => row.id) : [],
    survivingIds: affectedTarget ? surviving.map(row => row.id) : [],
    ...(study.question ? { question: planWettingFrontQuestion(project, study, affectedTarget ? supportedRuns : []) } : {}),
    meaning: WETTING_FRONT_MEANING };
}

export const WETTING_FRONT_FILE_LIMIT = 5 * 1024 * 1024;
export function serializeWettingFrontInvestigation(project, study = project.wettingFrontStudy) {
  admittedWork(project, study);
  const text = JSON.stringify({ schema: 'experimental-earth-wetting-front-investigation/1', project, study }, null, 2);
  if (new TextEncoder().encode(text).byteLength > WETTING_FRONT_FILE_LIMIT) throw new Error('Soil investigation exceeds the 5 MiB file limit');
  return text;
}

/** Reopen only declared inputs. Never admit a saved result as computed evidence. */
export function parseWettingFrontInvestigation(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > WETTING_FRONT_FILE_LIMIT) {
    throw new Error('Soil investigation exceeds the 5 MiB file limit');
  }
  const bundle = JSON.parse(text);
  if (!bundle || bundle.schema !== 'experimental-earth-wetting-front-investigation/1' ||
      Object.keys(bundle).some(key => !['schema', 'project', 'study'].includes(key))) {
    throw new Error('Unsupported soil investigation; saved conclusions are not accepted');
  }
  admittedWork(bundle.project, bundle.study);
  return bundle;
}
