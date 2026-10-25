import { validateProject } from './core.js';
import { validateHeatColumnStudy, heatColumnCurrent } from './heat-column-contract.js';
import { evaluateHeatColumnTarget } from './heat-column.js';
import { advanceHeatColumnWithBottom } from './heat-column-step.js';

export const BOTTOM_HEAT_SCHEMA = 'experimental-earth-bottom-heat/1';
const targets = ['existing', 'proposal'];
const finite = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;

export function validateBottomHeatStudy(study) {
  if (!study || study.schema !== BOTTOM_HEAT_SCHEMA || !study.heatColumnStudy) {
    throw Error('Retain a versioned bottom-exchange investigation and original two-store source');
  }
  validateHeatColumnStudy(study.heatColumnStudy);
  for (const target of targets) {
    const b = study.bottoms?.[target];
    if (!b || !finite(b.conductanceWm2K, 0, 1000) || !finite(b.reservoirC, -100, 200) ||
        typeof b.source !== 'string' || !b.source.trim() || b.source.length > 600) {
      throw Error('Each bottom needs conductance 0–1000 W/(m²·K), reservoir −100–200 °C and a source of at most 600 characters');
    }
  }
  return study;
}

/** Retain all supported original declarations, never derived reports. */
export function canonicalBottomHeatStudy(study) {
  validateBottomHeatStudy(study);
  const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, structuredClone(o[k])]));
  const h = study.heatColumnStudy.heatStudy;
  return {
    schema: BOTTOM_HEAT_SCHEMA,
    heatColumnStudy: {
      schema: study.heatColumnStudy.schema, model: study.heatColumnStudy.model,
      heatStudy: {
        ...pick(h, ['schema', 'model', 'cellIndex', 'contextJson']),
        ...Object.fromEntries(targets.map(t => [t, pick(h[t],
          ['absorptivity', 'capacityJm2K', 'exchangeWm2K', 'initialC', 'source'])])),
        schedule: h.schedule.map(r => pick(r, ['minutes', 'incidentWm2', 'reservoirC', 'source']))
      },
      lowerLayers: Object.fromEntries(targets.map(t => [t, pick(study.heatColumnStudy.lowerLayers[t],
        ['capacityJm2K', 'conductanceWm2K', 'initialC', 'source'])]))
    },
    bottoms: Object.fromEntries(targets.map(t => [t, pick(study.bottoms[t],
      ['conductanceWm2K', 'reservoirC', 'source'])]))
  };
}

export function prepareBottomHeatStudy(project, bottoms) {
  validateProject(project);
  if (!project.heatColumnStudy || !heatColumnCurrent(project, project.heatColumnStudy)) {
    throw Error('Save a current two-store heat declaration first');
  }
  return canonicalBottomHeatStudy({
    schema: BOTTOM_HEAT_SCHEMA, heatColumnStudy: project.heatColumnStudy, bottoms
  });
}

function course(study, target) {
  const original = study.heatColumnStudy, surface = original.heatStudy[target];
  const lower = original.lowerLayers[target], bottom = study.bottoms[target];
  let initial = { surfaceC: surface.initialC, subsurfaceC: lower.initialC }, elapsed = 0;
  const intervals = [], critical = { surface: [], subsurface: [] };
  for (const forcing of original.heatStudy.schedule) {
    const end = elapsed + forcing.minutes;
    const step = advanceHeatColumnWithBottom(surface, lower, forcing, initial, forcing.minutes * 60, bottom);
    for (const name of ['surface', 'subsurface']) {
      for (const seconds of step.stationarySeconds[name]) {
        advanceHeatColumnWithBottom(surface, lower, forcing, initial, seconds, bottom);
        critical[name].push(elapsed + seconds / 60);
      }
    }
    intervals.push({ from: elapsed, to: end, forcing, initial, step });
    initial = { surfaceC: step.surfaceC, subsurfaceC: step.subsurfaceC }; elapsed = end;
  }
  return { surface, lower, bottom, intervals, critical, duration: elapsed };
}

function inspect(c, minute) {
  let state = { surfaceC: c.surface.initialC, subsurfaceC: c.lower.initialC };
  let inputJm2 = 0, exchangeOutJm2 = 0, transferDownJm2 = 0, bottomOutJm2 = 0;
  for (const row of c.intervals) {
    if (minute <= row.from) break;
    const step = minute >= row.to ? row.step :
      advanceHeatColumnWithBottom(c.surface, c.lower, row.forcing, row.initial, (minute - row.from) * 60, c.bottom);
    inputJm2 += step.inputJm2; exchangeOutJm2 += step.exchangeOutJm2;
    transferDownJm2 += step.transferDownJm2; bottomOutJm2 += step.bottomOutJm2;
    state = { surfaceC: step.surfaceC, subsurfaceC: step.subsurfaceC };
    if (minute <= row.to) break;
  }
  const surfaceStoredJm2 = c.surface.capacityJm2K * (state.surfaceC - c.surface.initialC);
  const subsurfaceStoredJm2 = c.lower.capacityJm2K * (state.subsurfaceC - c.lower.initialC);
  const totalStoredJm2 = surfaceStoredJm2 + subsurfaceStoredJm2;
  return { minute, ...state, inputJm2, exchangeOutJm2, transferDownJm2, bottomOutJm2,
    surfaceStoredJm2, subsurfaceStoredJm2, totalStoredJm2,
    balanceResidualJm2: inputJm2 - exchangeOutJm2 - bottomOutJm2 - totalStoredJm2,
    surfaceBalanceResidualJm2: inputJm2 - exchangeOutJm2 - transferDownJm2 - surfaceStoredJm2,
    subsurfaceBalanceResidualJm2: transferDownJm2 - bottomOutJm2 - subsurfaceStoredJm2 };
}

export function inspectBottomHeatStudy(study, minute) {
  validateBottomHeatStudy(study);
  const duration = study.heatColumnStudy.heatStudy.schedule.reduce((n, r) => n + r.minutes, 0);
  if (!finite(minute, 0, duration)) throw Error('Inspect a finite time within the retained exposure');
  return Object.fromEntries(targets.map(target => [target, inspect(course(study, target), minute)]));
}

export function compareBottomHeatStudy(study) {
  validateBottomHeatStudy(study);
  const courses = Object.fromEntries(targets.map(target => [target, course(study, target)]));
  const durationMinutes = courses.existing.duration;
  const times = new Set([0, ...courses.existing.intervals.map(r => r.to),
    ...Array.from({ length: Math.ceil(durationMinutes) }, (_, i) => i)]);
  const baseline = Object.fromEntries(targets.map(target =>
    [target, evaluateHeatColumnTarget(study.heatColumnStudy, target)]));
  for (const target of targets) for (const name of ['surface', 'subsurface']) {
    for (const t of courses[target].critical[name]) times.add(t);
    for (const t of baseline[target].summary.stationaryMinutes[name]) times.add(t);
  }
  const sorted = [...times].sort((a, b) => a - b);
  for (const target of targets) baseline[target] = evaluateHeatColumnTarget(study.heatColumnStudy, target, sorted);
  const maps = Object.fromEntries(targets.map(t => [t, new Map(baseline[t].trajectory.map(r => [r.minute, r]))]));
  const trajectory = sorted.map(minute => ({ minute, ...Object.fromEntries(targets.map(target =>
    [target, { exchanging: inspect(courses[target], minute), insulated: maps[target].get(minute) }])) }));
  const summary = {};
  for (const target of targets) {
    const c = courses[target], entry = { final: inspect(c, durationMinutes),
      insulated: baseline[target].summary, stationaryMinutes: c.critical };
    for (const [name, field] of [['surface', 'surfaceC'], ['subsurface', 'subsurfaceC']]) {
      const rows = [0, ...c.intervals.map(r => r.to), ...c.critical[name]].map(t => inspect(c, t));
      const maximum = rows.reduce((a, b) => a[field] >= b[field] ? a : b);
      const minimum = rows.reduce((a, b) => a[field] <= b[field] ? a : b);
      entry[name] = { maximumC: maximum[field], maximumMinute: maximum.minute,
        minimumC: minimum[field], minimumMinute: minimum.minute };
    }
    summary[target] = entry;
  }
  return { status: 'compared', durationMinutes, summary, trajectory,
    semantics: 'Two uniform stores with an explicitly declared constant deep reservoir. Positive bottom exchange leaves the lower store; negative exchange supplies heat. Conditional model response, not inferred depth, soil properties, physical calibration or field validation.' };
}
