import { validateSurfaceHeatStudy } from './surface-heat-contract.js';

export const LONGWAVE_HEAT_SCHEMA = 'experimental-earth-longwave-heat/1';
export const STEFAN_BOLTZMANN = 5.6703744191844314e-8;
const finite = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const sourced = v => typeof v === 'string' && v.trim() && v.length <= 600;
const targets = ['existing', 'proposal'];

export function validateLongwaveHeat(input) {
  if (!input || input.schema !== LONGWAVE_HEAT_SCHEMA || !input.heatStudy) throw Error('Supply a retained longwave heat investigation');
  validateSurfaceHeatStudy(input.heatStudy);
  if (input.exchangeBasis !== 'excludes-longwave') throw Error('Explicitly declare that linear exchange excludes the separately modeled longwave term');
  for (const target of targets) {
    if (!finite(input[target]?.emissivity, 0, 1) || !sourced(input[target]?.source)) {
      throw Error('Each layer needs longwave emissivity 0–1 and its source; shortwave absorption does not supply emissivity');
    }
  }
  if (!Array.isArray(input.radiationSchedule) || input.radiationSchedule.length !== input.heatStudy.schedule.length) {
    throw Error('Declare one complete radiative environment for every original exposure interval');
  }
  for (const row of input.radiationSchedule) {
    if (!finite(row?.skyC, -150, 200) || !sourced(row?.source)) throw Error('Each interval needs effective radiative environment −150–200 °C and a source');
  }
  return input;
}

/** Retain declared original fields only; uploaded result-like fields never
 * acquire provenance by passing validation or surviving a source-only download. */
export function canonicalLongwaveHeat(input) {
  validateLongwaveHeat(input);
  const pick = (value, keys) => Object.fromEntries(keys.map(key => [key, value[key]]));
  const study = input.heatStudy;
  const heatStudy = pick(study, ['schema', 'model', 'cellIndex', 'contextJson']);
  for (const target of targets) heatStudy[target] = pick(study[target],
    ['absorptivity', 'capacityJm2K', 'exchangeWm2K', 'initialC', 'source']);
  heatStudy.schedule = study.schedule.map(row => pick(row, ['minutes', 'incidentWm2', 'reservoirC', 'source']));
  return {schema: LONGWAVE_HEAT_SCHEMA, exchangeBasis: 'excludes-longwave', heatStudy,
    existing: pick(input.existing, ['emissivity', 'source']),
    proposal: pick(input.proposal, ['emissivity', 'source']),
    radiationSchedule: input.radiationSchedule.map(row => pick(row, ['skyC', 'source']))};
}

// Factored fourth-power difference avoids cancellation near thermal equilibrium.
export function longwaveFluxWm2(temperatureC, skyC, emissivity) {
  const t = temperatureC + 273.15, s = skyC + 273.15;
  return emissivity * STEFAN_BOLTZMANN * (t - s) * (t + s) * (t * t + s * s);
}

function derivatives(layer, forcing, emissivity, skyC, t) {
  const convection = layer.exchangeWm2K * (t - forcing.reservoirC);
  const radiation = longwaveFluxWm2(t, skyC, emissivity);
  return [(layer.absorptivity * forcing.incidentWm2 - convection - radiation) / layer.capacityJm2K, convection, radiation];
}
function rk4(layer, forcing, emissivity, skyC, temperatureC, seconds) {
  const f = t => derivatives(layer, forcing, emissivity, skyC, t);
  const a = f(temperatureC), b = f(temperatureC + seconds * a[0] / 2);
  const c = f(temperatureC + seconds * b[0] / 2), d = f(temperatureC + seconds * c[0]);
  return a.map((v, i) => seconds * (v + 2 * b[i] + 2 * c[i] + d[i]) / 6);
}

/** Temperature and both signed outgoing energies use the same RK stages.
 * Input and stored energy are computed independently. Step doubling estimates
 * local temperature error; a conservative derivative-based cap avoids explicit
 * instability even at the admitted smallest capacity/largest conductance.
 */
function advance(layer, forcing, emissivity, skyC, initialC, seconds, budget, toleranceC) {
  let temperatureC = initialC, elapsed = 0, convectionJm2 = 0, radiationJm2 = 0;
  const stiffness = layer.exchangeWm2K + 4 * emissivity * STEFAN_BOLTZMANN * 773.15 ** 3;
  let step = Math.min(60, stiffness ? .5 * layer.capacityJm2K / stiffness : 60, seconds);
  while (elapsed < seconds) {
    if (++budget.used > budget.limit) throw Error('Longwave comparison exceeds its integration-attempt budget; reduce duration or stiffness');
    const dt = Math.min(step, seconds - elapsed);
    if (!(dt > 0) || elapsed + dt === elapsed) throw Error('Longwave integration cannot resolve the declared interval');
    const whole = rk4(layer, forcing, emissivity, skyC, temperatureC, dt);
    const first = rk4(layer, forcing, emissivity, skyC, temperatureC, dt / 2);
    const second = rk4(layer, forcing, emissivity, skyC, temperatureC + first[0], dt / 2);
    const fine = first.map((v, i) => v + second[i]);
    const errorC = Math.abs(fine[0] - whole[0]) / 15;
    if (!fine.every(Number.isFinite) || !Number.isFinite(errorC)) throw Error('Nonfinite longwave integration refused');
    if (errorC > toleranceC) { step = dt * Math.max(.1, .8 * (toleranceC / errorC) ** .2); continue; }
    temperatureC += fine[0];
    if (!finite(temperatureC, -100, 500)) throw Error('Predicted layer temperature leaves the supported −100–500 °C range');
    convectionJm2 += fine[1]; radiationJm2 += fine[2]; elapsed += dt;
    step = Math.min(60, stiffness ? .5 * layer.capacityJm2K / stiffness : 60,
      dt * Math.min(2, errorC ? .9 * (toleranceC / errorC) ** .2 : 2));
  }
  return {temperatureC, convectionJm2, radiationJm2};
}

/** Lower bound only: adaptive rejection and query boundaries can cost more. */
export function minimumLongwaveAttempts(input) {
  validateLongwaveHeat(input);
  const study = input.heatStudy;
  const durationMinutes = study.schedule.reduce((sum, row) => sum + row.minutes, 0);
  let minimumAttempts = 0;
  for (const target of targets) {
    const layer = study[target], e = input[target].emissivity;
    const stiffness = layer.exchangeWm2K + 4 * e * STEFAN_BOLTZMANN * 773.15 ** 3;
    minimumAttempts += durationMinutes * 60 / Math.min(60, stiffness ? .5 * layer.capacityJm2K / stiffness : 60);
  }
  return minimumAttempts;
}

export function compareLongwaveHeat(input, {sampleMinutes = [], toleranceC = 1e-8, workLimit = 100000} = {}) {
  validateLongwaveHeat(input);
  const study = input.heatStudy, budget = {used: 0, limit: workLimit}, results = {};
  if (!Number.isSafeInteger(workLimit) || workLimit < 1 || workLimit > 100000) throw Error('Unsupported integration work limit');
  if (![1e-8, 1e-10].includes(toleranceC)) throw Error('Unsupported integration tolerance');
  // Lower bound on mandatory stable steps, before allocating/running either layer.
  const durationMinutes = study.schedule.reduce((sum, row) => sum + row.minutes, 0);
  if (!Array.isArray(sampleMinutes) || sampleMinutes.length > 100 || !sampleMinutes.every(v => finite(v, 0, durationMinutes))) throw Error('Supply at most 100 reading times inside the original exposure');
  const queries = [...new Set(sampleMinutes)].sort((a,b) => a-b);
  const minimumAttempts = minimumLongwaveAttempts(input);
  if (minimumAttempts > workLimit) throw Error('Longwave comparison exceeds the integration work budget before execution');
  for (const target of targets) {
    const layer = study[target];
    let temperatureC = layer.initialC, minute = 0, inputJm2 = 0, convectionJm2 = 0, radiationJm2 = 0;
    const snapshot = () => ({minute, temperatureC, inputJm2, convectionJm2, radiationJm2,
      storedJm2: layer.capacityJm2K * (temperatureC - layer.initialC),
      balanceResidualJm2: inputJm2 - convectionJm2 - radiationJm2 - layer.capacityJm2K * (temperatureC - layer.initialC)});
    const trajectory = [snapshot()];
    study.schedule.forEach((forcing, index) => {
      const end = minute + forcing.minutes;
      while (minute < end) {
        const query = queries.find(value => value > minute);
        const next = Math.min(end, minute + 1, query ?? end), seconds = (next - minute) * 60;
        const step = advance(layer, forcing, input[target].emissivity, input.radiationSchedule[index].skyC, temperatureC, seconds, budget, toleranceC);
        temperatureC = step.temperatureC;
        convectionJm2 += step.convectionJm2; radiationJm2 += step.radiationJm2;
        inputJm2 += layer.absorptivity * forcing.incidentWm2 * seconds;
        minute = next; trajectory.push(snapshot());
      }
    });
    // Autonomous monotone temperature within each constant-forcing interval:
    // endpoints include all extrema, unlike a generic sampled nonlinear model.
    results[target] = {trajectory, final: trajectory.at(-1), minimumC: Math.min(...trajectory.map(r => r.temperatureC)),
      maximumC: Math.max(...trajectory.map(r => r.temperatureC))};
  }
  return {schema: LONGWAVE_HEAT_SCHEMA, durationMinutes, ...results, integrationAttempts: budget.used,
    semantics: 'Conditional uniform-layer model with explicit gray-body exchange to one effective radiative environment. Linear exchange must exclude this longwave term to avoid double counting. No evaporation, internal/spatial gradients, view-factor geometry, atmospheric inference, or human-comfort prediction.'};
}
