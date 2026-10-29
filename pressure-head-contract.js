const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const bounded = (value, maximum) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, allowed) => object(value) && allowed.every(key => own(value, key)) &&
  Object.keys(value).every(key => allowed.includes(key));

export const PRESSURE_HEAD_MODEL_SCHEMA = 'experimental-earth-pressure-head-model/1';
export const PRESSURE_HEAD_STUDY_SCHEMA = 'experimental-earth-pressure-head-study/1';
export const MAX_PRESSURE_HEAD_CELL_STEPS = 1_000_000;

export function validatePressureHeadModel(model, surfaces) {
  if (!keys(model, ['schema', 'surface', 'conductivityMmHr', 'capillaryDriveMm', 'moistureDeficit']) ||
      model.schema !== PRESSURE_HEAD_MODEL_SCHEMA || typeof model.surface !== 'string' || !own(surfaces, model.surface) ||
      !bounded(model.conductivityMmHr, 2000) || !bounded(model.capillaryDriveMm, 5000) ||
      !bounded(model.moistureDeficit, 1)) {
    throw Error('Declare a pressure-head model version, known surface, K 0–2000 mm/h, A 0–5000 mm and moisture deficit 0–1');
  }
  return model;
}

export function validatePressureHeadStudy(study, surfaces) {
  if (!keys(study, ['schema', 'target', 'surface', 'basis', 'hypotheses']) ||
      study.schema !== PRESSURE_HEAD_STUDY_SCHEMA ||
      !['existing', 'proposal'].includes(study.target) || typeof study.surface !== 'string' || !own(surfaces, study.surface) ||
      typeof study.basis !== 'string' || !study.basis.trim() || study.basis.length > 1000 ||
      !Array.isArray(study.hypotheses) || study.hypotheses.length < 2 || study.hypotheses.length > 9) {
    throw Error('Declare a pressure-head study, scenario, surface, basis and 2–9 distinct soil hypotheses');
  }
  const tuples = new Set();
  for (const hypothesis of study.hypotheses) {
    if (!keys(hypothesis, ['conductivityMmHr', 'capillaryDriveMm', 'moistureDeficit']))
      throw Error('Soil hypotheses contain declared K, A and moisture deficit only');
    validatePressureHeadModel({ schema: PRESSURE_HEAD_MODEL_SCHEMA, surface: study.surface, ...hypothesis }, surfaces);
    const tuple = [hypothesis.conductivityMmHr, hypothesis.capillaryDriveMm, hypothesis.moistureDeficit].join(':');
    if (tuples.has(tuple)) throw Error('Pressure-head soil hypotheses must be distinct');
    tuples.add(tuple);
  }
  return study;
}
