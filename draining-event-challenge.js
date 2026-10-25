import {validateProject} from './core.js';
import {assertMatchingEventSite} from './event-challenge.js';
import {compareDrainingHypotheses, validateDrainingHypotheses, drainingConsequences,
  makeDrainingEvidenceExample} from './draining-layer-evidence.js';
import {checkDrainingFileBytes, MAX_DRAINING_CELL_STEPS} from './draining-layer-study.js';

export const DRAINING_EVENT_SCHEMA = 'experimental-earth-draining-event-challenge/1';
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  keys.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => keys.includes(key));
const need = (condition, message) => {if (!condition) throw Error(message);};
const referenceKeys = ['calibration', 'challenge', 'independence', 'startingWater'];
const bundleKeys = ['schema', 'calibrationProject', 'challengeProject', 'study', 'references'];

export function validateDrainingEvents(input) {
  need(exactKeys(input, bundleKeys) && input.schema === DRAINING_EVENT_SCHEMA,
    'Open an original two-event receiving investigation; saved conclusions are not accepted');
  const {calibrationProject: first, challengeProject: second, study, references} = input;
  validateProject(first); validateProject(second); validateDrainingHypotheses(study);
  need(exactKeys(references, referenceKeys), 'Supply both event references, independence and matched starting-water declarations');
  for (const key of referenceKeys) need(typeof references[key] === 'string' && references[key].trim() && references[key].length <= 500,
    'Each event reference and declaration needs nonempty source text of at most 500 characters');
  need(references.calibration.trim() !== references.challenge.trim(), 'Use distinct event references; copying an event does not establish an independent challenge');
  // We compare the same original layout pair under different event forcing.
  // The common helper checks geometry, walls and time/transport assumptions.
  for (const side of ['existing', 'proposal']) assertMatchingEventSite(first, second, side);
  const selected = project => project.observations.filter(o => o.scenario === study.target);
  const initial = selected(first), later = selected(second);
  need(initial.some(o => o.use === 'calibration'), 'The first event needs original calibration readings for the selected scenario');
  need(!later.some(o => o.use === 'calibration'), 'The second event contains calibration readings; do not silently relabel them as held aside');
  need(later.some(o => o.use === 'challenge'), 'The second event needs original held-aside readings for the selected scenario');
  need(first[study.target].some(cell => cell.surface === study.surface), 'The studied receiving surface is absent from the observed scenario');
  const work = [first, second].reduce((sum, p) => sum + p.width * p.height *
    Math.ceil(p.weather.durationMinutes / p.weather.stepMinutes) * study.hypotheses.length * 2, 0);
  need(work <= MAX_DRAINING_CELL_STEPS, 'Complete two-event receiving comparison exceeds one million combined cell-steps');
  return work;
}

/** Frozen source hypotheses are initialized separately in each original event.
 * New evidence only rejects. It cannot refit a capacity, drainage rate or initial
 * store, and it cannot revive a first-event held-aside rejection.
 */
export function compareDrainingEvents(input) {
  const cellSteps = validateDrainingEvents(input);
  const {calibrationProject, challengeProject, study, references} = input;
  const first = compareDrainingHypotheses(calibrationProject, study);
  const second = compareDrainingHypotheses(challengeProject, study);
  const byId = new Map(second.candidates.map(c => [c.hypothesis.id, c]));
  const candidates = first.candidates.map(c => {
    const other = byId.get(c.hypothesis.id);
    return {...c, secondEvent: {challenge: other.challenge, existing: other.existing,
      proposal: other.proposal, change: other.change},
      survives: c.calibration.compatible === true && c.challenge.compatible !== false && other.challenge.compatible === true};
  });
  const eligible = candidates.filter(c => c.calibration.compatible === true && c.challenge.compatible !== false);
  const survivors = candidates.filter(c => c.survives);
  return {schema: 'experimental-earth-draining-event-result/1', references: structuredClone(references),
    study: structuredClone(study), cellSteps, counts: {first: first.counts, second: second.counts},
    status: !first.compatibleIds.length ? 'calibration-rejected' : !survivors.length ? 'challenged' :
      survivors.length === 1 ? 'one-survivor' : 'ambiguous', candidates,
    compatibleIds: first.compatibleIds, eligibleIds: eligible.map(c => c.hypothesis.id),
    survivingIds: survivors.map(c => c.hypothesis.id),
    effects: {first: {calibration: first.effects.calibration, surviving: drainingConsequences(survivors)},
      second: {all: second.effects.all, surviving: drainingConsequences(survivors.map(c => ({hypothesis: c.hypothesis, change: c.secondEvent.change})))}},
    meaning: 'The same complete offered hypotheses, including initial stored water, initialize each event separately. No first-event terminal water is carried forward. Both layout maps and transport assumptions match. Distinct event references, evidence independence and matched starting water are caller declarations; passing these readings is not field validation or a unique material estimate.'};
}

export function serializeDrainingEvents(input) {
  validateDrainingEvents(input);
  const text = JSON.stringify(input, null, 2); checkDrainingFileBytes(new TextEncoder().encode(text).byteLength);
  return text;
}
export function parseDrainingEvents(text) {
  need(typeof text === 'string', 'Read the original two-event JSON investigation');
  checkDrainingFileBytes(new TextEncoder().encode(text).byteLength);
  const input = JSON.parse(text); validateDrainingEvents(input); return input;
}

export function makeDrainingEventExample() {
  const {project: calibrationProject, study} = makeDrainingEvidenceExample();
  calibrationProject.title = 'Authored first event: 36 mm/hour';
  calibrationProject.observations = calibrationProject.observations.filter(o => o.use === 'calibration');
  const challengeProject = structuredClone(calibrationProject);
  challengeProject.title = 'Authored separate event: 12 mm/hour'; challengeProject.weather.rainMmHr = 12;
  challengeProject.observations = [{cellIndex: 0, minute: 60,
    depthMm: 7 * (1 - Math.log(12 / 7)), uncertaintyMm: 0.05,
    scenario: 'proposal', use: 'challenge',
    source: 'Independent analytic lower-rainfall control: supply fills the store before a 7 mm/hour surface rise. Not a field measurement.'}];
  return {schema: DRAINING_EVENT_SCHEMA, calibrationProject, challengeProject, study,
    references: {calibration: 'Authored higher-rainfall event', challenge: 'Authored lower-rainfall event',
      independence: 'Separate authored forcing and independently derived depth; no second-event value was used to change the offered hypotheses.',
      startingWater: 'Both authored events start separately with zero surface water and each hypothesis\'s declared zero receiving water. No terminal-state carryover.'}};
}
