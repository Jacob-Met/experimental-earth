import { sameInternalBarriers } from './internal-barriers.js';
import { validateProject } from './core.js';
import { compareInfiltration } from './infiltration-study.js';
import { validateStudy } from './study-contract.js';

function identity(value, name) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) throw Error(`${name} needs a nonempty reference of at most 200 characters`);
  return value.trim();
}

/** Shared site and model admission for fixed hypotheses transferred across events. */
export function assertMatchingEventSite(calibrationProject, challengeProject, target, {explicitOutletPairs = false} = {}) {
  if (calibrationProject.width !== challengeProject.width || calibrationProject.height !== challengeProject.height) throw Error('Event grids must match');
  for (const key of ['cellSizeM', 'mobilityPerHour', 'stepMinutes', ...(explicitOutletPairs ? [] : ['boundaryExitPerHour'])]) {
    if (calibrationProject.weather[key] !== challengeProject.weather[key]) throw Error(`Event modeling assumptions must match: ${key}`);
  }
  if (!sameInternalBarriers(calibrationProject[target], challengeProject[target])) throw Error('Observed scenario internal walls and openings must match across events');
  if (calibrationProject[target].some((cell, i) => cell.surface !== challengeProject[target][i].surface || cell.elevationM !== challengeProject[target][i].elevationM)) throw Error('Observed scenario geometry and surfaces must match across events');
}

/** Independent event identity is a user declaration, never inferred from weather. */
export function compareEvents(calibrationProject, challengeProject, study, references) {
  validateProject(calibrationProject);
  validateProject(challengeProject);
  validateStudy(study);
  const calibrationReference = identity(references?.calibration, 'Calibration event');
  const challengeReference = identity(references?.challenge, 'Challenge event');
  if (calibrationReference === challengeReference) throw Error('Use distinct event references; a second copy is not a held-aside event');
  const target = study.target;
  assertMatchingEventSite(calibrationProject, challengeProject, target);
  const selected = challengeProject.observations.filter(o => o.scenario === target);
  if (selected.some(o => o.use === 'calibration')) throw Error('The second event contains calibration readings; explicitly mark held-aside evidence before transfer');
  if (!selected.some(o => o.use === 'challenge')) throw Error('The second event needs held-aside readings for the selected scenario');
  const calibration = compareInfiltration(calibrationProject, study);
  if (!calibration.counts.calibration) throw Error('The first event needs calibration readings');
  if (!calibration.counts.affectedCells) throw Error('The investigated surface is absent');
  const second = compareInfiltration(challengeProject, study);
  const byRate = new Map(second.candidates.map(candidate => [candidate.rateMmHr, candidate]));
  // Original calibration ordering and its same-event holdout both survive.
  const candidates = calibration.candidates.map(candidate => ({ ...candidate,
    secondEvent: byRate.get(candidate.rateMmHr).challenge,
    survives: candidate.calibration.compatible === true && candidate.challenge.compatible !== false && byRate.get(candidate.rateMmHr).challenge.compatible === true,
  }));
  const survivingRatesMmHr = candidates.filter(c => c.survives).map(c => c.rateMmHr);
  return { calibrationReference, challengeReference, candidates, survivingRatesMmHr,
    status: survivingRatesMmHr.length === 0 ? 'challenged' : survivingRatesMmHr.length === 1 ? 'one-survivor' : 'ambiguous',
    counts: { first: calibration.counts, second: second.counts },
    limitation: 'Event identities and evidence independence are declared by you. Agreement is bounded by these readings and assumptions; it is not field validation or an inferred soil property.' };
}

export function makeEventChallenge(calibrationProject, challengeProject, study, references) {
  const bundle = structuredClone({ schema: 'experimental-earth-event-challenge/1', calibrationProject, challengeProject, study, references });
  compareEvents(bundle.calibrationProject, bundle.challengeProject, bundle.study, bundle.references);
  return bundle;
}

export function reopenEventChallenge(bundle) {
  if (!bundle || bundle.schema !== 'experimental-earth-event-challenge/1') throw Error('Unsupported event challenge');
  return compareEvents(bundle.calibrationProject, bundle.challengeProject, bundle.study, bundle.references);
}
