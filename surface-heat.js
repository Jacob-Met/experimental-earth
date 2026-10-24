import { validateProject } from './core.js';
import { SURFACE_HEAT_SCHEMA, SURFACE_HEAT_MODEL, surfaceHeatContext, validateSurfaceHeatStudy } from './surface-heat-contract.js';

export function prepareSurfaceHeatStudy(project, input) {
  validateProject(project);
  if (!Number.isInteger(input?.cellIndex) || input.cellIndex < 0 || input.cellIndex >= project.width * project.height) {
    throw Error('Select an existing site cell for the heat experiment');
  }
  return validateSurfaceHeatStudy({ schema: SURFACE_HEAT_SCHEMA, model: SURFACE_HEAT_MODEL,
    cellIndex: input.cellIndex, contextJson: surfaceHeatContext(project, input.cellIndex),
    existing: structuredClone(input.existing), proposal: structuredClone(input.proposal), schedule: structuredClone(input.schedule) });
}

// Entire functions evaluated without subtracting nearly equal exponentials.
// phi = (1 - exp(-x))/x, complement = 1 - phi.
function decayFactors(x) {
  if (x === 0) return { phi: 1, complement: 0 };
  const phi = -Math.expm1(-x) / x;
  const complement = x < .001 ? x * (.5 + x * (-1 / 6 + x * (1 / 24 + x * (-1 / 120 + x / 720)))) : 1 - phi;
  return { phi, complement };
}

/** Exact forced uniform-layer step. Positive exchange energy leaves the layer. */
export function advanceSurfaceHeat(layer, interval, initialC, seconds) {
  const C = layer.capacityJm2K, h = layer.exchangeWm2K;
  const inputWm2 = layer.absorptivity * interval.incidentWm2;
  const theta = initialC - interval.reservoirC;
  const { phi, complement } = decayFactors(h * seconds / C);
  const temperatureC = initialC + (inputWm2 - h * theta) * seconds / C * phi;
  // Analytic integral of h*(T-Ta), independent of subtracting input from stored energy.
  const exchangedJm2 = h * theta * seconds * phi + inputWm2 * seconds * complement;
  const inputJm2 = inputWm2 * seconds;
  const storedJm2 = C * (temperatureC - initialC);
  if (![temperatureC, exchangedJm2, inputJm2, storedJm2].every(Number.isFinite) || temperatureC < -100 || temperatureC > 500) {
    throw Error('Predicted layer temperature leaves the supported −100–500 °C calculation range; revise the declared model');
  }
  return { temperatureC, inputJm2, exchangedJm2, storedJm2,
    balanceResidualJm2: inputJm2 - exchangedJm2 - storedJm2 };
}

function evaluateLayer(study, target, minute) {
  const layer = study[target];
  let elapsed = 0, temperatureC = layer.initialC, inputJm2 = 0, exchangedJm2 = 0;
  for (const row of study.schedule) {
    const used = Math.min(row.minutes, Math.max(0, minute - elapsed));
    if (used > 0) {
      const step = advanceSurfaceHeat(layer, row, temperatureC, used * 60);
      temperatureC = step.temperatureC; inputJm2 += step.inputJm2; exchangedJm2 += step.exchangedJm2;
    }
    elapsed += row.minutes;
    if (elapsed >= minute) break;
  }
  const storedJm2 = layer.capacityJm2K * (temperatureC - layer.initialC);
  return { minute, temperatureC, inputJm2, exchangedJm2, storedJm2,
    balanceResidualJm2: inputJm2 - exchangedJm2 - storedJm2 };
}

export function inspectSurfaceHeat(study, minute) {
  validateSurfaceHeatStudy(study);
  if (!study) throw Error('No retained surface heat study');
  const duration = study.schedule.reduce((sum, row) => sum + row.minutes, 0);
  if (typeof minute !== 'number' || !Number.isFinite(minute) || minute < 0 || minute > duration) throw Error('Inspection time must be inside the supplied exposure schedule');
  const existing = evaluateLayer(study, 'existing', minute), proposal = evaluateLayer(study, 'proposal', minute);
  return { minute, existing, proposal, differenceC: proposal.temperatureC - existing.temperatureC };
}

/** Absorbed incident input over a declared interval, in J/m².
 * Sum local schedule overlaps; subtracting large cumulative totals can erase
 * a short late reading. This is neither incident energy nor net stored heat.
 */
export function absorbedSurfaceHeatEnergy(study, target, fromMinute, toMinute) {
  validateSurfaceHeatStudy(study);
  if (!study || !['existing', 'proposal'].includes(target)) throw Error('Select a retained heat layer for absorbed-energy comparison');
  const duration = study.schedule.reduce((sum, row) => sum + row.minutes, 0);
  if (![fromMinute, toMinute].every(Number.isFinite) || fromMinute < 0 || toMinute > duration || fromMinute >= toMinute) {
    throw Error('Absorbed-energy interval must have ordered start/end times inside the retained exposure');
  }
  let elapsed = 0, energyJm2 = 0;
  for (const row of study.schedule) {
    const end = elapsed + row.minutes;
    const minutes = Math.max(0, Math.min(toMinute, end) - Math.max(fromMinute, elapsed));
    energyJm2 += study[target].absorptivity * row.incidentWm2 * (minutes * 60);
    elapsed = end;
    if (elapsed >= toMinute) break;
  }
  return energyJm2;
}

export function compareSurfaceHeat(project) {
  validateProject(project);
  const study = project.surfaceHeatStudy;
  if (!study) return { status: 'no-study' };
  if (study.contextJson !== surfaceHeatContext(project, study.cellIndex)) return { status: 'context-changed' };
  const durationMinutes = study.schedule.reduce((sum, row) => sum + row.minutes, 0);
  // Segment endpoints give exact extrema for this monotone-within-interval model.
  const endpoints = [0];
  for (const row of study.schedule) endpoints.push(endpoints.at(-1) + row.minutes);
  const times = [...new Set([...endpoints, ...Array.from({ length: Math.ceil(durationMinutes) }, (_, i) => i).filter(t => t < durationMinutes)])].sort((a, b) => a - b);
  const trajectory = times.map(minute => ({ minute, existing: evaluateLayer(study, 'existing', minute), proposal: evaluateLayer(study, 'proposal', minute) }));
  const summary = {};
  for (const target of ['existing', 'proposal']) {
    const boundaryRows = endpoints.map(minute => evaluateLayer(study, target, minute));
    summary[target] = { final: boundaryRows.at(-1), maximumC: Math.max(...boundaryRows.map(r => r.temperatureC)),
      minimumC: Math.min(...boundaryRows.map(r => r.temperatureC)),
      timeConstantMinutes: study[target].exchangeWm2K === 0 ? null : study[target].capacityJm2K / study[target].exchangeWm2K / 60 };
  }
  return { status: 'compared', durationMinutes, trajectory, summary,
    semantics: 'Conditional uniform-layer temperatures under declared incident input and linear exchange. Nonlinear radiation, evaporation, internal gradients, spatial heat transport and human comfort are not modeled. Surface labels and geometric sun obstruction do not supply thermal properties or irradiance.' };
}
