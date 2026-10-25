import { validateProject } from './core.js';
import { compareOutletEvidence, OUTLET_WORK_LIMIT } from './outlet-evidence.js';
import { outletContext, validateOutletRates } from './outlet-evidence-contract.js';

// A complete finite diagnostic, not a convergence estimate or setting selection.
export function compareOutletResolution(project, rates = project.outletEvidence?.ratesPerHour) {
  validateProject(project);
  if (!project.outletEvidence) throw Error('Retain sourced collection evidence first.');
  validateOutletRates(rates);
  const record = project.outletEvidence;
  const steps = [...new Set([1, 2, 4].map(divisor => Math.max(1, project.weather.stepMinutes / divisor)))];
  const cellSteps = project.width * project.height * rates.length * steps.reduce((sum, step) => sum + Math.ceil(project.weather.durationMinutes / step), 0);
  const base = { steps, cellSteps, workLimit: OUTLET_WORK_LIMIT, reports: [] };
  if (record.contextJson !== outletContext(project, record.target) || record.durationMinutes !== project.weather.durationMinutes) return { ...base, status: 'context-changed' };
  if (steps.length < 2) return { ...base, status: 'minimum-step' };
  if (!record.readings.some(reading => reading.use === 'calibration')) return { ...base, status: 'need-calibration' };
  if (cellSteps > OUTLET_WORK_LIMIT) return { ...base, status: 'work-limit' };
  const reports = steps.map(stepMinutes => {
    const copy = structuredClone(project);
    copy.weather.stepMinutes = stepMinutes;
    return compareOutletEvidence(copy, rates);
  });
  const fields = ['compatibleRatesPerHour', 'survivingRatesPerHour', 'closestCalibrationRatesPerHour'];
  const sameSet = (a, b) => a.length === b.length && a.every(value => b.includes(value));
  const changedSets = fields.filter(key => reports.some(report => !sameSet(report[key], reports[0][key])));
  return { ...base, status: 'computed', reports, changedSets };
}
