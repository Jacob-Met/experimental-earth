import {chooseDrainingQuestion} from './draining-question.js';
import {validateProject, runRain, SURFACES} from './core.js';
import {evaluateReadings} from './infiltration-study.js';
import {DRAINING_LAYER_SCHEMA, validateDrainingLayer} from './draining-infiltration.js';
import {checkDrainingFileBytes, makeDrainingExample, MAX_DRAINING_CELL_STEPS} from './draining-layer-study.js';

export const DRAINING_EVIDENCE_SCHEMA = 'experimental-earth-draining-evidence/1';
export const DRAINING_HYPOTHESES_SCHEMA = 'experimental-earth-draining-hypotheses/1';
const sides = ['existing', 'proposal'];
const metrics = ['absorbedLiters', 'storedLiters', 'exitLiters', 'maxDepthMm'];
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  keys.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => keys.includes(key));
const nonempty = (value, maximum) => typeof value === 'string' && value.trim() && value.length <= maximum;
const dense = values => Array.isArray(values) && Array.from({length: values.length}, (_, i) => Object.hasOwn(values, i)).every(Boolean) && Object.keys(values).length === values.length;

export function hypothesisLayer(study, hypothesis) {
  return {schema: DRAINING_LAYER_SCHEMA, surface: study.surface,
    capacityMm: hypothesis.capacityMm, initialStoredMm: hypothesis.initialStoredMm,
    drainagePerHour: hypothesis.drainagePerHour, source: hypothesis.source};
}

export function validateDrainingHypotheses(study) {
  if (!exactKeys(study, ['schema', 'target', 'surface', 'hypotheses']) ||
      study.schema !== DRAINING_HYPOTHESES_SCHEMA || !sides.includes(study.target) ||
      !Object.hasOwn(SURFACES, study.surface) || !dense(study.hypotheses) ||
      study.hypotheses.length < 2 || study.hypotheses.length > 12) {
    throw Error('Choose an observed scenario and known surface with 2–12 explicitly offered receiving hypotheses');
  }
  const ids = new Set(), parameters = new Set();
  for (const h of study.hypotheses) {
    if (!exactKeys(h, ['id', 'label', 'capacityMm', 'initialStoredMm', 'drainagePerHour', 'source']) ||
        typeof h.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(h.id) || ids.has(h.id) ||
        !nonempty(h.label, 120)) throw Error('Each receiving hypothesis needs a distinct short ID and a label');
    validateDrainingLayer(hypothesisLayer(study, h), SURFACES);
    const key = JSON.stringify([h.capacityMm, h.initialStoredMm, h.drainagePerHour]);
    if (parameters.has(key)) throw Error('Offer distinct storage, initial-water and drainage combinations');
    ids.add(h.id); parameters.add(key);
  }
  return study;
}

function admit(project, study) {
  validateProject(project); validateDrainingHypotheses(study);
  // Both unchanged maps are evaluated once for each offered hypothesis. The
  // evidence target reuses its own run; no hypothetical layout refits evidence.
  const cellSteps = project.width * project.height *
    Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes) * study.hypotheses.length * 2;
  if (cellSteps > MAX_DRAINING_CELL_STEPS) throw Error('Complete receiving-hypothesis comparison exceeds one million cell-steps');
  return cellSteps;
}

function summarize(result) {
  const layer = result.drainingLayer;
  return {...Object.fromEntries(metrics.map(key => [key, result[key]])),
    rainLiters: result.rainLiters, massErrorLiters: result.massErrorLiters,
    receiver: {initialLiters: layer.initialLiters, retainedLiters: layer.retainedLiters,
      drainedLiters: layer.drainedLiters, balanceErrorLiters: layer.balanceErrorLiters}};
}

export function drainingConsequences(candidates) {
  return {count: candidates.length, ids: candidates.map(c => c.hypothesis.id),
    metrics: Object.fromEntries(metrics.map(key => [key, candidates.length ? {
      minimum: Math.min(...candidates.map(c => c.change[key])),
      maximum: Math.max(...candidates.map(c => c.change[key])),
    } : null]))};
}

/** Every offered explanation survives as a row. Only original calibration
 * readings admit it; held-aside readings can contradict but cannot refit it.
 * Finite support is not continuous uncertainty, likelihood or a winning model.
 */
export function compareDrainingHypotheses(project, study) {
  const cellSteps = admit(project, study);
  const readings = project.observations.map((reading, index) => ({reading, index}));
  const calibration = readings.filter(({reading}) => reading.scenario === study.target && reading.use === 'calibration');
  const challenge = readings.filter(({reading}) => reading.scenario === study.target && reading.use === 'challenge');
  const affectedCells = project[study.target].filter(cell => cell.surface === study.surface).length;
  const counts = {calibration: calibration.length, challenge: challenge.length,
    ignored: readings.length - calibration.length - challenge.length, affectedCells};
  const empty = {candidates: [], compatibleIds: [], survivingIds: [],
    effects: {all: drainingConsequences([]), calibration: drainingConsequences([]), surviving: drainingConsequences([])}};
  if (!affectedCells) return {status: 'surface-absent', counts, cellSteps, study: structuredClone(study), ...empty};
  const questionRuns = [];
  const candidates = study.hypotheses.map(hypothesis => {
    const layer = hypothesisLayer(study, hypothesis), runs = {};
    for (const side of sides) runs[side] = runRain(project[side], project.width, project.height, project.weather, {drainingLayer: layer});
    const observed = runs[study.target];
    const calibrationResult = evaluateReadings(observed, calibration);
    if (calibrationResult.compatible === true) questionRuns.push({id: hypothesis.id, result: observed});
    return {hypothesis: structuredClone(hypothesis),
      calibration: calibrationResult, challenge: evaluateReadings(observed, challenge),
      existing: summarize(runs.existing), proposal: summarize(runs.proposal),
      change: Object.fromEntries(metrics.map(key => [key, runs.proposal[key] - runs.existing[key]]))};
  });
  const compatible = candidates.filter(c => c.calibration.compatible === true);
  const survivors = compatible.filter(c => c.challenge.compatible === true);
  const status = !calibration.length ? 'need-calibration' : !compatible.length ? 'calibration-rejected' :
    !challenge.length ? 'needs-challenge' : !survivors.length ? 'challenged' :
    survivors.length === 1 ? 'one-survivor' : 'ambiguous';
  return {status, counts, cellSteps, study: structuredClone(study), candidates,
    question: chooseDrainingQuestion(questionRuns, Math.max(0, ...calibration.map(({reading}) => reading.uncertaintyMm)),
      project.observations.filter(reading => reading.scenario === study.target)),
    compatibleIds: compatible.map(c => c.hypothesis.id), survivingIds: survivors.map(c => c.hypothesis.id),
    effects: {all: drainingConsequences(candidates), calibration: drainingConsequences(compatible), surviving: drainingConsequences(survivors)}};
}

export function serializeDrainingEvidence(project, study) {
  admit(project, study);
  const text = JSON.stringify({schema: DRAINING_EVIDENCE_SCHEMA, project, study}, null, 2);
  checkDrainingFileBytes(new TextEncoder().encode(text).byteLength);
  return text;
}

export function parseDrainingEvidence(text) {
  if (typeof text !== 'string') throw Error('Read an original receiving-evidence JSON investigation');
  checkDrainingFileBytes(new TextEncoder().encode(text).byteLength);
  const input = JSON.parse(text);
  if (!exactKeys(input, ['schema', 'project', 'study']) || input.schema !== DRAINING_EVIDENCE_SCHEMA) {
    throw Error('Unsupported receiving-evidence input; saved conclusions are not accepted');
  }
  admit(input.project, input.study);
  return input;
}

export function makeDrainingEvidenceExample() {
  const {project} = makeDrainingExample();
  project.title = 'Fictional readings: storage can mimic drainage at one time';
  const enteredByHour = 5 + 19 * Math.log(24 / 19), firstDepth = 36 - enteredByHour;
  project.observations = [
    {cellIndex: 0, minute: 60, depthMm: firstDepth, uncertaintyMm: 0.1,
      scenario: 'proposal', use: 'calibration', source: 'Authored analytic 5 mm, 1/hour model control; not a field reading'},
    {cellIndex: 0, minute: 180, depthMm: firstDepth - 10, uncertaintyMm: 0.1,
      scenario: 'proposal', use: 'challenge', source: 'Separate authored late control; value not used to choose the hypotheses'},
  ];
  const source = 'Explicit authored alternative for the fictional bed; no measured material calibration';
  const hypotheses = [
    ['draining', '5 mm store with drainage', 5, 1],
    ['closed-matched', 'Closed store matching the early depth', enteredByHour, 0],
    ['closed-small', '5 mm closed store', 5, 0],
    ['draining-large', 'Larger, more slowly draining store', 10, 0.5],
  ].map(([id, label, capacityMm, drainagePerHour]) => ({id, label, capacityMm,
    initialStoredMm: 0, drainagePerHour, source}));
  return {project, study: {schema: DRAINING_HYPOTHESES_SCHEMA, target: 'proposal', surface: 'garden', hypotheses}};
}
