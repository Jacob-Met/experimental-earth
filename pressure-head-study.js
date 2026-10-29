import { runRain, runPressureHeadRain, validateProject, SURFACES } from './core.js';
import { evaluateReadings } from './infiltration-study.js';
import { validatePressureHeadStudy, PRESSURE_HEAD_MODEL_SCHEMA,
  MAX_PRESSURE_HEAD_CELL_STEPS } from './pressure-head-contract.js';

export const PRESSURE_HEAD_MEANING = 'Declared homogeneous sharp-front event models. Standing-water pressure uses an explicitly supplied volumetric moisture deficit. Zero is the head-neglected mathematical control; A alone does not determine the deficit. No moisture recovery or field validation is inferred. Calibration readings alone order candidates; held-aside readings only challenge them.';

function summarize(result, cellIndex) {
  return { rainLiters: result.rainLiters, absorbedLiters: result.absorbedLiters,
    exitLiters: result.exitLiters, storedLiters: result.storedLiters,
    peakPondingLiters: result.peakPondingLiters, maxDepthMm: result.maxDepthMm,
    massErrorLiters: result.massErrorLiters,
    selectedCell: { cellIndex, depths: result.snapshots.map(snapshot => ({
      minute: snapshot.minute, depthMm: snapshot.depthsMm[cellIndex] })) } };
}

function admittedWork(project, study) {
  validateProject(project);
  validatePressureHeadStudy(study, SURFACES);
  const cellSteps = project.width * project.height *
    Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes) *
    2 * (study.hypotheses.length + 1);
  if (cellSteps > MAX_PRESSURE_HEAD_CELL_STEPS)
    throw Error('Pressure-head comparison exceeds one million cell-steps; reduce the grid, duration or candidate count, or increase the calculation interval');
  return cellSteps;
}

/** Same project and rain for every explicit hypothesis; no result is adopted. */
export function comparePressureHead(project, study) {
  const cellSteps = admittedWork(project, study);
  const { target, surface } = study, { width, height, weather } = project;
  const selectedIndex = project.selectedIndex ?? 0;
  const readings = project.observations.map((reading, index) => ({ reading, index }));
  const calibration = readings.filter(({ reading }) => reading.scenario === target && reading.use === 'calibration');
  const challenge = readings.filter(({ reading }) => reading.scenario === target && reading.use === 'challenge');
  const counts = { calibration: calibration.length, challenge: challenge.length,
    ignored: readings.length - calibration.length - challenge.length,
    affectedExisting: project.existing.filter(cell => cell.surface === surface).length,
    affectedProposal: project.proposal.filter(cell => cell.surface === surface).length };
  const runPair = hypothesis => {
    const model = hypothesis && { schema: PRESSURE_HEAD_MODEL_SCHEMA, surface, ...hypothesis };
    const run = cells => model ? runPressureHeadRain(cells, width, height, weather, model) :
      runRain(cells, width, height, weather);
    const existing = run(project.existing), proposal = run(project.proposal);
    const scored = target === 'existing' ? existing : proposal;
    return { existing: summarize(existing, selectedIndex), proposal: summarize(proposal, selectedIndex),
      calibration: evaluateReadings(scored, calibration), challenge: evaluateReadings(scored, challenge),
      change: { exitLiters: proposal.exitLiters - existing.exitLiters,
        storedLiters: proposal.storedLiters - existing.storedLiters,
        peakPondingLiters: proposal.peakPondingLiters - existing.peakPondingLiters,
        maxDepthMm: proposal.maxDepthMm - existing.maxDepthMm } };
  };
  const baseline = runPair(null);
  const candidates = study.hypotheses.map((hypothesis, index) => ({
    id: index + 1, ...hypothesis,
    headTreatment: hypothesis.moistureDeficit === 0 ? 'head-neglected control' : 'explicit standing-water head',
    ...runPair(hypothesis) }));
  candidates.sort((a, b) => (a.calibration.rmseMm ?? 0) - (b.calibration.rmseMm ?? 0) || a.id - b.id);
  const supported = candidates.filter(row => row.calibration.compatible === true);
  const surviving = supported.filter(row => row.challenge.compatible !== false);
  const affected = target === 'existing' ? counts.affectedExisting : counts.affectedProposal;
  let status = 'ambiguous';
  if (!affected) status = 'surface-absent';
  else if (!calibration.length) status = 'need-calibration';
  else if (!supported.length) status = 'calibration-rejected';
  else if (!challenge.length) status = 'needs-challenge';
  else if (!surviving.length) status = 'challenged';
  else if (surviving.length === 1) status = 'one-survivor';
  return { schema: 'experimental-earth-pressure-head-comparison/1',
    sourceSignature: JSON.stringify({ project, study }), study: structuredClone(study),
    selectedIndex, cellSteps, counts, status, baseline, candidates,
    compatibleIds: affected ? supported.map(row => row.id) : [],
    survivingIds: affected ? surviving.map(row => row.id) : [], meaning: PRESSURE_HEAD_MEANING };
}

export const PRESSURE_HEAD_FILE_LIMIT = 5 * 1024 * 1024;
export function serializePressureHeadInvestigation(project, study) {
  admittedWork(project, study);
  const text = JSON.stringify({
    schema: 'experimental-earth-pressure-head-investigation/1', project, study
  }, null, 2);
  if (new TextEncoder().encode(text).length > PRESSURE_HEAD_FILE_LIMIT)
    throw Error('Pressure-head investigation exceeds the 5 MiB file limit');
  return text;
}

export function parsePressureHeadInvestigation(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > PRESSURE_HEAD_FILE_LIMIT)
    throw Error('Choose a pressure-head investigation up to 5 MiB');
  const bundle = JSON.parse(text);
  if (!bundle || Array.isArray(bundle) ||
      bundle.schema !== 'experimental-earth-pressure-head-investigation/1' ||
      Object.keys(bundle).some(key => !['schema', 'project', 'study'].includes(key)))
    throw Error('Unsupported pressure-head investigation; saved conclusions are not accepted');
  admittedWork(bundle.project, bundle.study);
  return bundle;
}
