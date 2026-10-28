import { validateProject } from './core.js';
import { advanceHeatColumn } from './heat-column-step.js';
import { validateHeatColumnStudy } from './heat-column-contract.js';
import { sampleShadeHeatForcing, normalizeShadeHeat, prepareShadeHeatSource, parseShadeHeatSource,
  checkShadeHeatBytes, SHADE_HEAT_HOURLY_KIND, SHADE_HEAT_HOURLY_MODEL, SHADE_HEAT_LIMITS } from './shade-heat.js';

export const SHADE_HEAT_SAMPLING_KIND = 'experimental-earth/shade-heat-sampling/1';
export const SHADE_HEAT_SAMPLING_MODEL = Object.freeze({ ...SHADE_HEAT_HOURLY_MODEL,
  name: 'mapped-shade-sampling-sensitivity', version: 1, solarMinutes: '60,30,15',
  differenceSamples: 'integer minutes, including both day endpoints' });
export const SHADE_HEAT_SAMPLING_STEPS = Object.freeze([60, 30, 15]);
const targets = ['existing', 'proposal'], bounds = ['lower', 'upper'];
const stores = [['surface', 'surfaceC'], ['subsurface', 'subsurfaceC']];
const exactKeys = (v, keys) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
export const SHADE_HEAT_SAMPLING_SEMANTICS = 'The same original one-hour weather values are held over each original hour. '
  + 'Only the solar and mapped-shadow midpoint grid changes: 60, 30 and 15 minutes. No subhourly weather was observed or interpolated. '
  + 'Each course retains its own beam-ambiguity envelope. Grid differences are not added to those envelopes as an error bound. '
  + 'The largest reported difference is over common integer-minute samples, not a continuous-time maximum. '
  + 'Thermal extrema use the maintained propagator and its stationary times. Differences may reverse direction; '
  + 'neither convergence, finest-grid superiority, physical accuracy nor a continuous shadow bound is established.';

/** Compose already admitted forcing with the maintained exact-real thermal
 * step. Initial declaration bounds stay unchanged; carried states are passed
 * directly to the step's existing state contract, never redeclared as inputs.
 */
function evaluateDerivedCourse(study, target, bound, intervals) {
  const surface = study.heatStudy[target], lower = study.lowerLayers[target];
  const initial = { surfaceC: surface.initialC, subsurfaceC: lower.initialC };
  let state = { ...initial }, inputJm2 = 0, exchangeOutJm2 = 0, transferDownJm2 = 0;
  let surfaceDegreeMinutes = 0, subsurfaceDegreeMinutes = 0;
  const trajectory = [{ minute: 0, ...initial }];
  const extrema = Object.fromEntries(stores.map(([name, field]) => [name, {
    maximumC: initial[field], maximumMinute: 0, minimumC: initial[field], minimumMinute: 0 }]));
  const durationMinutes = intervals.at(-1).toMinute;
  for (const row of intervals) {
    const minutes = row.toMinute - row.fromMinute;
    const forcing = { minutes, incidentWm2: row[target].irradiance[bound],
      reservoirC: row.weather.reservoirC, source: 'Original hourly weather; derived solar midpoint ' + row.sampleUtc };
    const step = advanceHeatColumn(surface, lower, forcing, state, minutes * 60);
    const samples = new Set([minutes * 60, ...step.stationarySeconds.surface, ...step.stationarySeconds.subsurface]);
    for (let minute = 1; minute <= minutes; minute++) samples.add(minute * 60);
    for (const seconds of [...samples].sort((a, b) => a - b)) {
      const point = seconds === minutes * 60 ? step : advanceHeatColumn(surface, lower, forcing, state, seconds);
      const minute = row.fromMinute + seconds / 60;
      trajectory.push({ minute, surfaceC: point.surfaceC, subsurfaceC: point.subsurfaceC });
      for (const [name, field] of stores) {
        const e = extrema[name];
        if (point[field] > e.maximumC) { e.maximumC = point[field]; e.maximumMinute = minute; }
        if (point[field] < e.minimumC) { e.minimumC = point[field]; e.minimumMinute = minute; }
      }
    }
    inputJm2 += step.inputJm2; exchangeOutJm2 += step.exchangeOutJm2; transferDownJm2 += step.transferDownJm2;
    surfaceDegreeMinutes += step.surfaceMeanC * minutes;
    subsurfaceDegreeMinutes += step.subsurfaceMeanC * minutes;
    state = { surfaceC: step.surfaceC, subsurfaceC: step.subsurfaceC };
  }
  const surfaceStoredJm2 = surface.capacityJm2K * (state.surfaceC - initial.surfaceC);
  const subsurfaceStoredJm2 = lower.capacityJm2K * (state.subsurfaceC - initial.subsurfaceC);
  const totalStoredJm2 = surfaceStoredJm2 + subsurfaceStoredJm2;
  return { trajectory, ...extrema,
    means: { surfaceC: surfaceDegreeMinutes / durationMinutes, subsurfaceC: subsurfaceDegreeMinutes / durationMinutes },
    final: { minute: durationMinutes, ...state, inputJm2, exchangeOutJm2, transferDownJm2,
      surfaceStoredJm2, subsurfaceStoredJm2, totalStoredJm2,
      balanceResidualJm2: inputJm2 - exchangeOutJm2 - totalStoredJm2,
      surfaceBalanceResidualJm2: inputJm2 - exchangeOutJm2 - transferDownJm2 - surfaceStoredJm2,
      subsurfaceBalanceResidualJm2: transferDownJm2 - subsurfaceStoredJm2 } };
}

export function compareShadeHeatSampling(project, input) {
  validateProject(project);
  const declaration = normalizeShadeHeat(input);
  if (!declaration.weather) throw Error('Attach one complete original hourly weather day before comparing solar sample grids');
  validateHeatColumnStudy(project.heatColumnStudy);
  const cells = project.width * project.height;
  const estimatedRayTests = 6 * (cells - 1) *
    SHADE_HEAT_SAMPLING_STEPS.reduce((sum, step) => sum + 1440 / step, 0);
  // One selected ground receiver: two scenarios × three rayColumn tests
  // per other cell. Charge every midpoint, including skipped night/low sun.
  // Thermal lower/upper courses reuse forcing and add no geometry rays.
  // One shared budget for all three grids, before any solar course is run.
  if (estimatedRayTests > SHADE_HEAT_LIMITS.maxRayTests) {
    throw Error('The complete 60/30/15 minute comparison exceeds the shared 16 million ray-check budget; use a smaller original grid');
  }
  const courses = [];
  let cellIndex, weatherSource;
  for (const solarStepMinutes of SHADE_HEAT_SAMPLING_STEPS) {
    const sampled = sampleShadeHeatForcing(project, declaration, solarStepMinutes);
    cellIndex = sampled.cellIndex; weatherSource = sampled.weather.source;
    const result = { solarStepMinutes, intervals: sampled.intervals,
      estimatedRayTests: sampled.estimatedRayTests, targets: {} };
    for (const target of targets) result.targets[target] = Object.fromEntries(bounds.map(bound =>
      [bound, evaluateDerivedCourse(project.heatColumnStudy, target, bound, sampled.intervals)]));
    courses.push(result);
  }
  const differences = [];
  for (let i = 1; i < courses.length; i++) {
    const coarse = courses[i - 1], fine = courses[i];
    for (const target of targets) for (const bound of bounds) {
      const a = coarse.targets[target][bound], b = fine.targets[target][bound];
      const am = new Map(a.trajectory.filter(r => Number.isInteger(r.minute)).map(r => [r.minute, r]));
      const bm = new Map(b.trajectory.filter(r => Number.isInteger(r.minute)).map(r => [r.minute, r]));
      const difference = { coarseMinutes: coarse.solarStepMinutes, fineMinutes: fine.solarStepMinutes, target, bound };
      for (const [name, field] of stores) {
        let maxSampledDifferenceC = 0, atMinute = 0;
        for (let minute = 0; minute <= 1440; minute++) {
          const old = am.get(minute), next = bm.get(minute);
          if (!old || !next) throw Error('The complete common-minute comparison could not be evaluated');
          const delta = Math.abs(next[field] - old[field]);
          if (delta > maxSampledDifferenceC) { maxSampledDifferenceC = delta; atMinute = minute; }
        }
        difference[name] = { maxSampledDifferenceC, atMinute,
          finalDifferenceC: b.final[field] - a.final[field],
          meanDifferenceC: b.means[field] - a.means[field],
          maximumDifferenceC: b[name].maximumC - a[name].maximumC };
      }
      differences.push(difference);
    }
  }
  return { status: 'compared', model: SHADE_HEAT_SAMPLING_MODEL, declaration, cellIndex,
    durationMinutes: 1440, weatherSource, estimatedRayTests, courses, differences,
    semantics: SHADE_HEAT_SAMPLING_SEMANTICS };
}

export function prepareShadeHeatSampling(project, input) {
  const source = prepareShadeHeatSource(project, input);
  if (source.kind !== SHADE_HEAT_HOURLY_KIND) throw Error('Sampling comparison requires original hourly weather');
  const report = compareShadeHeatSampling(source.project, source.declaration);
  const investigation = { kind: SHADE_HEAT_SAMPLING_KIND, model: { ...SHADE_HEAT_SAMPLING_MODEL }, source };
  checkShadeHeatBytes(new Blob([JSON.stringify(investigation)]).size);
  return { investigation, report };
}

export function serializeShadeHeatSampling(project, input) {
  const text = JSON.stringify(prepareShadeHeatSampling(project, input).investigation, null, 2);
  checkShadeHeatBytes(new Blob([text]).size);
  return text;
}

export function parseShadeHeatSampling(text) {
  if (typeof text !== 'string') throw TypeError('Sampling inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);
  let value;
  try { value = JSON.parse(text); } catch { throw Error('Invalid sampling input JSON'); }
  const expected = SHADE_HEAT_SAMPLING_MODEL;
  if (!exactKeys(value, ['kind', 'model', 'source']) || value.kind !== SHADE_HEAT_SAMPLING_KIND
    || !exactKeys(value.model, Object.keys(expected))
    || Object.keys(expected).some(k => value.model[k] !== expected[k])) {
    throw Error('Unsupported sampling input envelope; derived result fields are not accepted');
  }
  const source = parseShadeHeatSource(JSON.stringify(value.source));
  return prepareShadeHeatSampling(source.project, source.declaration);
}

