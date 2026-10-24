import { validateProject } from './core.js';
import { advanceHeatColumn } from './heat-column-step.js';
import { compareSurfaceHeat, inspectSurfaceHeat } from './surface-heat.js';
import { surfaceHeatContext } from './surface-heat-contract.js';
import { HEAT_COLUMN_SCHEMA, HEAT_COLUMN_MODEL, validateHeatColumnStudy, heatColumnCurrent } from './heat-column-contract.js';

const targets = ['existing', 'proposal'];
export function prepareHeatColumnStudy(project, lowerLayers) {
  validateProject(project);
  if (!project.surfaceHeatStudy || project.surfaceHeatStudy.contextJson !== surfaceHeatContext(project, project.surfaceHeatStudy.cellIndex)) {
    throw Error('Retain a sourced heat exposure for the current selected place first');
  }
  if (project.heatColumnStudy && !heatColumnCurrent(project, project.heatColumnStudy)) {
    throw Error('The retained two-layer study belongs to another heat declaration. Export it before clearing and declaring a new study');
  }
  return validateHeatColumnStudy({ schema: HEAT_COLUMN_SCHEMA, model: HEAT_COLUMN_MODEL,
    heatStudy: structuredClone(project.surfaceHeatStudy), lowerLayers: structuredClone(lowerLayers) });
}

function course(study, target) {
  const surface = study.heatStudy[target], lower = study.lowerLayers[target];
  let initial = { surfaceC: surface.initialC, subsurfaceC: lower.initialC }, elapsed = 0;
  const intervals = [], critical = { surface: [], subsurface: [] };
  for (const forcing of study.heatStudy.schedule) {
    const end = elapsed + forcing.minutes;
    const step = advanceHeatColumn(surface, lower, forcing, initial, forcing.minutes * 60);
    for (const name of ['surface', 'subsurface']) {
      for (const seconds of step.stationarySeconds[name]) {
        // Receive the interior state too, rather than assuming monotone depth
        // temperatures from the old one-store experiment.
        advanceHeatColumn(surface, lower, forcing, initial, seconds);
        critical[name].push(elapsed + seconds / 60);
      }
    }
    intervals.push({ from: elapsed, to: end, forcing, initial, step });
    initial = { surfaceC: step.surfaceC, subsurfaceC: step.subsurfaceC }; elapsed = end;
  }
  return { surface, lower, intervals, critical, duration: elapsed };
}

function inspectCourse(c, minute) {
  let state = { surfaceC: c.surface.initialC, subsurfaceC: c.lower.initialC };
  let inputJm2 = 0, exchangeOutJm2 = 0, transferDownJm2 = 0;
  for (const interval of c.intervals) {
    if (minute <= interval.from) break;
    const used = Math.min(interval.to, minute) - interval.from;
    const step = minute >= interval.to ? interval.step :
      advanceHeatColumn(c.surface, c.lower, interval.forcing, interval.initial, used * 60);
    inputJm2 += step.inputJm2; exchangeOutJm2 += step.exchangeOutJm2; transferDownJm2 += step.transferDownJm2;
    state = { surfaceC: step.surfaceC, subsurfaceC: step.subsurfaceC };
    if (minute <= interval.to) break;
  }
  const surfaceStoredJm2 = c.surface.capacityJm2K * (state.surfaceC - c.surface.initialC);
  const subsurfaceStoredJm2 = c.lower.capacityJm2K * (state.subsurfaceC - c.lower.initialC);
  const totalStoredJm2 = surfaceStoredJm2 + subsurfaceStoredJm2;
  return { minute, ...state, inputJm2, exchangeOutJm2, transferDownJm2, surfaceStoredJm2, subsurfaceStoredJm2,
    totalStoredJm2, balanceResidualJm2: inputJm2 - exchangeOutJm2 - totalStoredJm2,
    surfaceBalanceResidualJm2: inputJm2 - exchangeOutJm2 - transferDownJm2 - surfaceStoredJm2,
    subsurfaceBalanceResidualJm2: transferDownJm2 - subsurfaceStoredJm2 };
}

export function inspectHeatColumn(study, minute) {
  validateHeatColumnStudy(study);
  if (!study) throw Error('No retained two-layer study');
  const duration = study.heatStudy.schedule.reduce((sum, row) => sum + row.minutes, 0);
  if (typeof minute !== 'number' || !Number.isFinite(minute) || minute < 0 || minute > duration) {
    throw Error('Inspect a time within the retained heat exposure');
  }
  return Object.fromEntries(targets.map(target => [target, inspectCourse(course(study, target), minute)]));
}

export function compareHeatColumn(project) {
  validateProject(project);
  const study = project.heatColumnStudy;
  if (!study) return { status: 'no-study' };
  if (!heatColumnCurrent(project, study)) return { status: 'context-changed' };
  const courses = Object.fromEntries(targets.map(target => [target, course(study, target)]));
  const durationMinutes = courses.existing.duration, summary = {};
  const boundaries = [0, ...courses.existing.intervals.map(row => row.to)];
  const times = new Set([...boundaries, ...Array.from({ length: Math.ceil(durationMinutes) }, (_, i) => i)]);
  for (const target of targets) {
    const c = courses[target]; summary[target] = { final: inspectCourse(c, durationMinutes), stationaryMinutes: c.critical };
    for (const [name, field] of [['surface', 'surfaceC'], ['subsurface', 'subsurfaceC']]) {
      const rows = [...boundaries, ...c.critical[name]].map(minute => inspectCourse(c, minute));
      const maximum = rows.reduce((a, b) => a[field] >= b[field] ? a : b);
      const minimum = rows.reduce((a, b) => a[field] <= b[field] ? a : b);
      summary[target][name] = { maximumC: maximum[field], maximumMinute: maximum.minute,
        minimumC: minimum[field], minimumMinute: minimum.minute };
      for (const minute of c.critical[name]) times.add(minute);
    }
  }
  let uniform = { status: 'available' };
  try { compareSurfaceHeat(project); } catch (error) { uniform = { status: 'unavailable', reason: error.message }; }
  const trajectory = [...times].sort((a, b) => a - b).map(minute => {
    const row = { minute };
    for (const target of targets) row[target] = inspectCourse(courses[target], minute);
    if (uniform.status === 'available') {
      const original = inspectSurfaceHeat(study.heatStudy, minute);
      row.uniformExistingC = original.existing.temperatureC; row.uniformProposalC = original.proposal.temperatureC;
    }
    return row;
  });
  return { status: 'compared', durationMinutes, summary, trajectory, uniform,
    semantics: 'Two declared internally uniform stores, surface-only absorbed input and linear ambient exchange, one internal conductance and an insulated bottom. No resolved depth, lateral conduction, moisture, nonlinear radiation or site calibration. Stationary times and energy residuals are floating-point engineering results, not certified bounds.' };
}
