const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const bounded = (value, limit) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= limit;

export const MAX_WETTING_FRONT_CELL_STEPS = 1_000_000;
export const DEFAULT_WETTING_FRONT_STUDY = Object.freeze({
  target: 'existing', surface: 'turf', basis: 'Illustrative alternatives; no measured soil parameters',
  hypotheses: Object.freeze([
    Object.freeze({ conductivityMmHr: 9, capillaryDriveMm: 0 }),
    Object.freeze({ conductivityMmHr: 9, capillaryDriveMm: 30 }),
    Object.freeze({ conductivityMmHr: 9, capillaryDriveMm: 90 }),
  ]),
});

export function validateWettingFrontModel(model, surfaces) {
  if (!model || Array.isArray(model) || !own(surfaces, model.surface) ||
      !bounded(model.conductivityMmHr, 2000) || !bounded(model.capillaryDriveMm, 5000)) {
    throw new Error('A soil hypothesis needs a known surface, conductivity 0–2000 mm/h and capillary drive 0–5000 mm');
  }
  return model;
}

export function validateWettingFrontStudy(study, surfaces) {
  if (study === undefined) return null;
  if (!study || Array.isArray(study) || !['existing', 'proposal'].includes(study.target) ||
      !own(surfaces, study.surface) || typeof study.basis !== 'string' ||
      !study.basis.trim() || study.basis.length > 400 || !Array.isArray(study.hypotheses) ||
      study.hypotheses.length < 2 || study.hypotheses.length > 9) {
    throw new Error('Choose a scenario, surface, basis and 2–9 distinct soil hypotheses');
  }
  const pairs = new Set();
  for (const hypothesis of study.hypotheses) {
    if (!hypothesis || Array.isArray(hypothesis)) throw new Error('Invalid soil hypothesis');
    validateWettingFrontModel({ ...hypothesis, surface: study.surface }, surfaces);
    const key = `${hypothesis.conductivityMmHr}:${hypothesis.capillaryDriveMm}`;
    if (pairs.has(key)) throw new Error('Soil hypotheses must be distinct');
    pairs.add(key);
  }
  validateWettingFrontQuestion(study.question);
  return study;
}

/** Optional planning inputs only; calculated questions are never persisted. */
export function validateWettingFrontQuestion(question) {
  if (question === undefined) return null;
  if (!question || Array.isArray(question) ||
      Object.keys(question).some(key => !['scope', 'fromMinute', 'toMinute', 'uncertaintyMm'].includes(key)) ||
      !['selected', 'grid'].includes(question.scope) || !bounded(question.fromMinute, 720) ||
      !bounded(question.toMinute, 720) || question.fromMinute > question.toMinute ||
      !bounded(question.uncertaintyMm, 1000)) {
    throw new Error('A reading question needs selected-cell or grid scope, an ordered 0–720 minute window, and uncertainty 0–1000 mm');
  }
  return question;
}
