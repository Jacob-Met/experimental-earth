// Shared schema checks. This module has no DOM or solver dependency.
const finiteRate = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 2000;
export const DEFAULT_STUDY = Object.freeze({ target: 'existing', surface: 'turf', ratesMmHr: Object.freeze([3, 9, 22]) });

export function validateStudy(study) {
  if (!study || !['existing', 'proposal'].includes(study.target) ||
      !['sealed', 'turf', 'garden'].includes(study.surface) ||
      !Array.isArray(study.ratesMmHr) || study.ratesMmHr.length < 2 || study.ratesMmHr.length > 9 ||
      !study.ratesMmHr.every(finiteRate) || new Set(study.ratesMmHr).size !== study.ratesMmHr.length) {
    throw new Error('Choose an observed scenario, a surface, and 2–9 distinct infiltration rates from 0 to 2000 mm/h.');
  }
  return study;
}

export function validateStudyMetadata(project) {
  if (project.infiltrationStudy !== undefined) validateStudy(project.infiltrationStudy);
  for (const reading of project.observations) {
    const scenario = reading.scenario === undefined ? 'unassigned' : reading.scenario;
    const use = reading.use === undefined ? 'unassigned' : reading.use;
    if (!['existing', 'proposal', 'unassigned'].includes(scenario) ||
        !['calibration', 'challenge', 'unassigned'].includes(use) ||
        (scenario === 'unassigned' && use !== 'unassigned')) {
      throw new Error('A calibration or held-aside reading needs an observed scenario and a valid evidence role.');
    }
  }
}
