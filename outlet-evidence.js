import { runRain, validateProject } from './core.js';
import { OUTLET_EVIDENCE_SCHEMA, OUTLET_UNITS, outletContext, validateOutletEvidence, validateOutletRates } from './outlet-evidence-contract.js';

export const OUTLET_WORK_LIMIT = 2_000_000;

export function appendOutletReading(project, settings, reading) {
  validateProject(project);
  const next = structuredClone(project);
  const contextJson = outletContext(project, settings.target);
  if (next.outletEvidence) {
    const old = next.outletEvidence;
    if (old.contextJson !== contextJson || old.target !== settings.target || old.eventRef !== settings.eventRef ||
        old.collectionSource !== settings.collectionSource || settings.coverage !== old.coverage) {
      throw new Error('This record belongs to a different site, event or collection. Keep its evidence separate.');
    }
  } else {
    next.outletEvidence = { schema: OUTLET_EVIDENCE_SCHEMA, target: settings.target,
      eventRef: settings.eventRef, collectionSource: settings.collectionSource, coverage: settings.coverage,
      ratesPerHour: settings.ratesPerHour.slice(), durationMinutes: project.weather.durationMinutes,
      contextJson, readings: [] };
  }
  next.outletEvidence.ratesPerHour = settings.ratesPerHour.slice();
  next.outletEvidence.readings.push(structuredClone(reading));
  validateProject(next);
  return next;
}

/** Interpolate cumulative volume; subtract endpoints, never an instantaneous rate. */
export function cumulativeExitAt(result, minute) {
  const snapshots = result.snapshots;
  if (!Array.isArray(snapshots) || !snapshots.length || !Number.isFinite(minute) ||
      minute < snapshots[0].minute || minute > snapshots.at(-1).minute) {
    throw new Error('Collection time is outside the modeled event.');
  }
  let lo = 0, hi = snapshots.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (snapshots[mid].minute < minute) lo = mid + 1; else hi = mid;
  }
  const after = snapshots[lo];
  if (after.minute === minute) return { liters: after.exitLiters, beforeMinute: minute, afterMinute: minute, method: 'snapshot' };
  const before = snapshots[lo - 1];
  const fraction = (minute - before.minute) / (after.minute - before.minute);
  return { liters: before.exitLiters + fraction * (after.exitLiters - before.exitLiters),
    beforeMinute: before.minute, afterMinute: after.minute, method: 'linear interpolation' };
}

export function predictCollectedVolume(result, reading) {
  if (!Number.isFinite(reading.startMinute) || !Number.isFinite(reading.endMinute) || reading.startMinute >= reading.endMinute) {
    throw new Error('A collection needs a positive time interval.');
  }
  const start = cumulativeExitAt(result, reading.startMinute);
  const end = cumulativeExitAt(result, reading.endMinute);
  return { volumeLiters: end.liters - start.liters, start, end };
}

function score(result, entries) {
  const errors = entries.map(({ reading, index }) => {
    const prediction = predictCollectedVolume(result, reading);
    const observedLiters = reading.volume * OUTLET_UNITS[reading.unit];
    const uncertaintyLiters = reading.uncertainty * OUTLET_UNITS[reading.unit];
    const residualLiters = observedLiters - prediction.volumeLiters;
    const roundoff = 1e-9 * Math.max(1, observedLiters, prediction.volumeLiters);
    return { index, ...prediction, observedLiters, uncertaintyLiters, residualLiters,
      withinBand: Math.abs(residualLiters) <= uncertaintyLiters + roundoff };
  });
  return { count: errors.length, compatible: errors.length ? errors.every(e => e.withinBand) : null,
    rmseLiters: errors.length ? Math.sqrt(errors.reduce((sum, e) => sum + e.residualLiters ** 2, 0) / errors.length) : null,
    errors };
}

export function compareOutletEvidence(project, rates = project.outletEvidence?.ratesPerHour) {
  validateProject(project);
  const record = project.outletEvidence;
  if (!record) throw new Error('Retain a sourced collected-volume observation first.');
  validateOutletEvidence(record); validateOutletRates(rates);
  const readings = record.readings.map((reading, index) => ({ reading, index }));
  const calibration = readings.filter(e => e.reading.use === 'calibration');
  const challenge = readings.filter(e => e.reading.use === 'challenge');
  const counts = { calibration: calibration.length, challenge: challenge.length,
    ignored: readings.length - calibration.length - challenge.length };
  const empty = { counts, candidates: [], compatibleRatesPerHour: [], survivingRatesPerHour: [], closestCalibrationRatesPerHour: [] };
  if (record.contextJson !== outletContext(project, record.target) || record.durationMinutes !== project.weather.durationMinutes) {
    return { ...empty, status: 'context-changed' };
  }
  const cellSteps = project.width * project.height * Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes) * rates.length;
  if (cellSteps > OUTLET_WORK_LIMIT) return { ...empty, status: 'work-limit', cellSteps, workLimit: OUTLET_WORK_LIMIT };
  const candidates = rates.map(ratePerHour => {
    const result = runRain(project[record.target], project.width, project.height,
      { ...project.weather, boundaryExitPerHour: ratePerHour });
    return { ratePerHour, calibration: score(result, calibration), challenge: score(result, challenge),
      totalExitLiters: result.exitLiters, massErrorLiters: result.massErrorLiters };
  });
  candidates.sort((a, b) => (a.calibration.rmseLiters ?? 0) - (b.calibration.rmseLiters ?? 0) || a.ratePerHour - b.ratePerHour);
  const compatible = candidates.filter(c => c.calibration.compatible === true);
  const surviving = compatible.filter(c => c.challenge.compatible !== false);
  const best = candidates[0].calibration.rmseLiters;
  const closest = best === null ? [] : candidates.filter(c => Math.abs(c.calibration.rmseLiters - best) <= 1e-9 * Math.max(1, best));
  let status = 'ambiguous';
  if (!calibration.length) status = 'need-calibration';
  else if (!compatible.length) status = 'calibration-rejected';
  else if (challenge.length && !surviving.length) status = 'challenged';
  else if (!challenge.length) status = 'needs-challenge';
  else if (surviving.length === 1) status = 'one-survivor';
  return { status, counts, candidates, cellSteps, stepMinutes: project.weather.stepMinutes,
    compatibleRatesPerHour: compatible.map(c => c.ratePerHour), survivingRatesPerHour: surviving.map(c => c.ratePerHour),
    closestCalibrationRatesPerHour: closest.map(c => c.ratePerHour).sort((a, b) => a - b) };
}
