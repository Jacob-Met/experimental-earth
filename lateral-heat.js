import { advanceSurfaceHeat } from './surface-heat.js';
import { validateProject } from './core.js';
import { validateSurfaceHeatStudy, surfaceHeatContext } from './surface-heat-contract.js';

export const LATERAL_HEAT_SCHEMA = 'experimental-earth-lateral-heat/1';
const targets = ['existing', 'proposal'];
const finite = (x, lo, hi) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
const attributed = s => typeof s === 'string' && s.trim() && s.length <= 600;

/** This declaration binds BOTH places and the complete original exposure. */
export function prepareLateralHeatStudy(project, input) {
  validateProject(project);
  const heatStudy = project.surfaceHeatStudy;
  validateSurfaceHeatStudy(heatStudy);
  if (!heatStudy || heatStudy.contextJson !== surfaceHeatContext(project, heatStudy.cellIndex)) {
    throw Error('Save a surface heat declaration for the current place first');
  }
  const i = input?.neighborIndex, selected = heatStudy.cellIndex;
  if (!Number.isInteger(i) || i < 0 || i >= project.width * project.height ||
      Math.abs(i % project.width - selected % project.width) +
      Math.abs(Math.floor(i / project.width) - Math.floor(selected / project.width)) !== 1) {
    throw Error('Select one edge-adjacent neighbor of the saved heat cell');
  }
  return validateLateralHeatStudy({schema: LATERAL_HEAT_SCHEMA,
    heatStudy: structuredClone(heatStudy), neighborIndex: i,
    neighborContextJson: surfaceHeatContext(project, i),
    neighbor: structuredClone(input.neighbor), conductanceWK: input.conductanceWK,
    source: input.source});
}

export function validateLateralHeatStudy(study) {
  if (!study || study.schema !== LATERAL_HEAT_SCHEMA || !study.heatStudy) throw Error('Retain a versioned lateral heat declaration');
  validateSurfaceHeatStudy(study.heatStudy);
  let a, b;
  try { a = JSON.parse(study.heatStudy.contextJson); b = JSON.parse(study.neighborContextJson); }
  catch { throw Error('Retain both original cell contexts'); }
  if (!Number.isInteger(study.neighborIndex) || b?.cellIndex !== study.neighborIndex ||
      b.width !== a.width || b.height !== a.height || b.cellSizeM !== a.cellSizeM || b.source !== a.source ||
      study.neighborIndex < 0 || study.neighborIndex >= a.width * a.height ||
      Math.abs(a.cellIndex % a.width - b.cellIndex % a.width) + Math.abs(Math.floor(a.cellIndex / a.width) - Math.floor(b.cellIndex / a.width)) !== 1) {
    throw Error('Retained cells must share one edge, metric scale and source');
  }
  // Reuse the complete maintained layer and context admission, including source limits.
  validateSurfaceHeatStudy({...study.heatStudy, cellIndex: study.neighborIndex,
    contextJson: study.neighborContextJson, existing: study.neighbor, proposal: study.neighbor});
  if (!finite(study.conductanceWK, 0, 1000) || !attributed(study.source)) throw Error('Declare edge conductance 0–1000 W/K and its source');
  return study;
}

export function lateralHeatCurrent(project, study) {
  return JSON.stringify(project.surfaceHeatStudy) === JSON.stringify(study.heatStudy) &&
    study.heatStudy.contextJson === surfaceHeatContext(project, study.heatStudy.cellIndex) &&
    study.neighborContextJson === surfaceHeatContext(project, study.neighborIndex);
}

/** Exact isolated exchange: Q is signed energy traveling from A to B. */
export function exchangeHeatPair(aC, bC, capacityAJK, capacityBJK, conductanceWK, seconds) {
  // These are the total-capacity limits of the admitted 0.25–100 m cells
  // and 1000–1e7 J/(m²·K) layers, not arbitrary subnormal numbers.
  if (![aC,bC].every(x => finite(x,-100,500)) || ![capacityAJK,capacityBJK].every(x => finite(x,62.5,1e11)) ||
      !finite(conductanceWK,0,1000) || !finite(seconds,0,86400)) throw Error('Invalid two-cell exchange state');
  const smaller = Math.min(capacityAJK,capacityBJK), larger = Math.max(capacityAJK,capacityBJK);
  const reducedCapacity = smaller / (1 + smaller / larger);
  const transferredJ = (aC - bC) * reducedCapacity * -Math.expm1(-conductanceWK * seconds / reducedCapacity);
  return {aC: aC - transferredJ / capacityAJK, bC: bC + transferredJ / capacityBJK, transferredJ};
}

function course(study, target, maxStepSeconds, conductanceWK) {
  const layers = [study.heatStudy[target], study.neighbor];
  const areaM2 = JSON.parse(study.heatStudy.contextJson).cellSizeM ** 2;
  const capacity = layers.map(x => x.capacityJm2K * areaM2);
  let temperaturesC = layers.map(x => x.initialC), elapsed = 0, transferJ = 0;
  const inputJ = [0,0], exchangeOutJ = [0,0], trajectory = [];
  function snapshot() {
    const storedJ = layers.map((x,i) => capacity[i] * (temperaturesC[i] - x.initialC));
    const residualJ = storedJ.map((s,i) => inputJ[i] - exchangeOutJ[i] + (i ? transferJ : -transferJ) - s);
    trajectory.push({minute: elapsed / 60, temperaturesC: [...temperaturesC], inputJ: [...inputJ],
      exchangeOutJ: [...exchangeOutJ], storedJ, transferJ, residualJ,
      totalResidualJ: inputJ[0] + inputJ[1] - exchangeOutJ[0] - exchangeOutJ[1] - storedJ[0] - storedJ[1]});
  }
  snapshot();
  let steps = 0;
  for (const row of study.heatStudy.schedule) {
    const duration = row.minutes * 60, count = Math.ceil(duration / maxStepSeconds), dt = duration / count;
    const start = elapsed;
    for (let step = 0; step < count; step++) {
      // Strang composition: external forcing half, exact conserved exchange, external half.
      for (let half = 0; half < 2; half++) {
        for (let i = 0; i < 2; i++) {
          const r = advanceSurfaceHeat(layers[i], row, temperaturesC[i], dt / 2);
          temperaturesC[i] = r.temperatureC;
          inputJ[i] += r.inputJm2 * areaM2; exchangeOutJ[i] += r.exchangedJm2 * areaM2;
        }
        if (half === 0) {
          const r = exchangeHeatPair(...temperaturesC, ...capacity, conductanceWK, dt);
          temperaturesC = [r.aC, r.bC]; transferJ += r.transferredJ;
        }
      }
      steps++;
    }
    elapsed = start + duration;
    snapshot();
  }
  return {target, areaM2, steps, maxStepSeconds, trajectory, final: trajectory.at(-1)};
}

/** Matched two-plan experiment with an explicit zero-coupling counterfactual.
 * Every schedule boundary is reached exactly. Numerical sensitivity is the
 * endpoint difference from halving the step, NOT a certified error bound.
 */
export function compareLateralHeat(project, study, maxStepSeconds = 30) {
  validateProject(project);
  validateLateralHeatStudy(study);
  if (!lateralHeatCurrent(project, study)) return {status: 'context-changed'};
  if (!finite(maxStepSeconds, 1, 300)) throw Error('Choose a maximum split step of 1–300 seconds');
  // Two saturated split steps can misleadingly agree while missing coupling.
  // Resolve each decay scale and refuse excessive work before any course runs.
  const areaM2 = JSON.parse(study.heatStudy.contextJson).cellSizeM ** 2;
  const effectiveSteps = Object.fromEntries(targets.map(target => {
    const a=study.heatStudy[target],b=study.neighbor;
    const fastestRate = Math.max(a.exchangeWm2K/a.capacityJm2K,
      b.exchangeWm2K/b.capacityJm2K,
      study.conductanceWK/areaM2*(1/a.capacityJm2K+1/b.capacityJm2K));
    return [target,Math.min(maxStepSeconds,fastestRate===0?maxStepSeconds:.25/fastestRate)];
  }));
  const estimatedSteps = targets.reduce((total,target) => total + study.heatStudy.schedule.reduce((n,r) =>
    n + Math.ceil(r.minutes*60/effectiveSteps[target]) + Math.ceil(r.minutes*120/effectiveSteps[target]),0),0);
  if (estimatedSteps > 200000) throw Error('Lateral heat request exceeds 200000 paired steps');
  const results = {};
  for (const target of targets) {
    const coarse = course(study,target,effectiveSteps[target],study.conductanceWK);
    const refined = course(study,target,effectiveSteps[target]/2,study.conductanceWK);
    const isolated = course(study,target,86400,0);
    const differenceC = refined.final.temperaturesC.map((v,i) => v - coarse.final.temperaturesC[i]);
    const maximumBoundaryDifferenceC = Math.max(...refined.trajectory.flatMap((r,j) =>
      r.temperaturesC.map((v,i) => Math.abs(v-coarse.trajectory[j].temperaturesC[i]))));
    results[target] = {coarse, refined, isolated, differenceC, maximumBoundaryDifferenceC};
  }
  return {status:'compared',maxStepSeconds, estimatedSteps,
    durationMinutes: study.heatStudy.schedule.reduce((n,r)=>n+r.minutes,0), results,
    proposalMinusExistingC: results.proposal.refined.final.temperaturesC.map((v,i)=>v-results.existing.refined.final.temperaturesC[i]),
    semantics: 'Two equal-area, internally uniform adjacent cells; declared constant lateral conductance and common exposure. One unchanged neighbor in both plans. Schedule-boundary samples are not extrema. Symmetric split integration; half-step differences are sensitivity, not an error bound. No field calibration, comfort or safety prediction.'};
}
