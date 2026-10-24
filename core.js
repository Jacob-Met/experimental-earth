import {validateThresholdEvidence} from './threshold-evidence-contract.js';
import { validateInternalBarriers, internalEdgeClosed } from './internal-barriers.js';
import { createRainOriginTracer, validateRainOriginStudy } from './rain-origins.js';
/**
 * EXPERIMENTAL EARTH / rain experiment core.
 * Deliberately modest conservation-based conceptual grid model, NOT a calibrated
 * hydrologic or flood-risk predictor. All quantities retain their units.
 */
import { validateStudyMetadata } from './study-contract.js';
import { validateObservationOrigin } from './observation-units.js';
import { validateOutletEvidence } from './outlet-evidence-contract.js';
import { validateJointStudy } from './joint-evidence-contract.js';
import { createRainTracer, validateRainTraceStudy } from './rain-tracer.js';
import { validateTerrainOrigin } from './terrain-contract.js';
export const WIDTH = 8;
export const HEIGHT = 6;
export const SURFACES = Object.freeze({
  sealed: { label: 'Sealed paving', infiltrationMmHr: 1, rangeLowMmHr: 0.2, rangeHighMmHr: 4, color: '#aeb8bb' },
  turf: { label: 'Turf', infiltrationMmHr: 9, rangeLowMmHr: 3, rangeHighMmHr: 22, color: '#b6c990' },
  garden: { label: 'Rain garden', infiltrationMmHr: 24, rangeLowMmHr: 12, rangeHighMmHr: 55, color: '#478e79' },
});
export const DEFAULT_WEATHER = Object.freeze({
  rainMmHr: 36, stormMinutes: 60, durationMinutes: 240,
  stepMinutes: 5, cellSizeM: 2, mobilityPerHour: 0.5,
  boundaryExitPerHour: 0.38,
});
const OWN = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const within = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;

export function makeExample() {
  const existing = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const trough = Math.abs(x - 3.5) <= 1.5 ? -0.035 : 0;
      const elevationM = Number((0.05 + 0.009 * (HEIGHT - 1 - y) + trough + (x === 7 ? 0.012 : 0)).toFixed(3));
      const surface = x >= 2 && x <= 5 && y >= 2 && y <= 4 ? 'sealed' : 'turf';
      existing.push({ elevationM, surface, provenance: 'illustrative assumption' });
    }
  }
  const proposal = structuredClone(existing);
  for (let y = 2; y <= 4; y++) for (let x = 3; x <= 4; x++) {
    proposal[y * WIDTH + x] = { ...proposal[y * WIDTH + x], surface: 'garden', provenance: 'proposed hypothetical change' };
  }
  return {
    schema: 'experimental-earth-site/1', title: 'Example courtyard · fictional',
    width: WIDTH, height: HEIGHT, weather: { ...DEFAULT_WEATHER },
    existing, proposal, observations: [], selectedIndex: 27,
    source: 'Illustrative geometry and rates; no site measurements',
  };
}

export function validateProject(project) {
  if (!project || project.schema !== 'experimental-earth-site/1' || typeof project.title !== 'string' || project.title.length > 120) throw new Error('Unsupported or invalid site project');
  const { width, height, existing, proposal, weather, observations } = project;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width > 24 || height > 24) throw new Error('Grid dimensions out of bounds');
  if (!Array.isArray(existing) || !Array.isArray(proposal) || existing.length !== width * height || proposal.length !== width * height) throw new Error('Grid cell count does not match dimensions');
  for (const cells of [existing, proposal]) {
    for (const cell of cells) {
      if (!cell || !within(cell.elevationM, -10, 10) || !OWN(SURFACES, cell.surface) || typeof cell.provenance !== 'string' || cell.provenance.length > 240) throw new Error('Invalid elevation, surface or source in a grid cell');
    }
  }
  for (const cells of [existing, proposal]) validateInternalBarriers(cells, width, height);
  if (!weather || !within(weather.rainMmHr, 0, 250) || !within(weather.stormMinutes, 0, 720) || !within(weather.durationMinutes, 5, 720) || !within(weather.stepMinutes, 1, 30) || !within(weather.cellSizeM, 0.25, 100) || !within(weather.mobilityPerHour, 0, 10) || !within(weather.boundaryExitPerHour, 0, 10) || weather.durationMinutes < weather.stormMinutes) throw new Error('Weather or modeling parameters out of bounds');
  for (const cells of [existing, proposal]) for (const cell of cells) validateTerrainOrigin(cell, weather.cellSizeM);
  if (!Array.isArray(observations) || observations.length > 100) throw new Error('Invalid observation history');
  for (const o of observations) {
    if (!Number.isInteger(o.cellIndex) || o.cellIndex < 0 || o.cellIndex >= width * height || !within(o.minute, 0, weather.durationMinutes) || !within(o.depthMm, 0, 1000) || !within(o.uncertaintyMm, 0, 1000) || typeof o.source !== 'string' || o.source.trim().length === 0 || o.source.length > 200) throw new Error('Invalid observation. A source and bounded measurement are required');
    validateObservationOrigin(o);
  }
  if (project.selectedIndex !== undefined && (!Number.isInteger(project.selectedIndex) || project.selectedIndex < 0 || project.selectedIndex >= width * height)) throw new Error('Selected cell out of range');
  validateStudyMetadata(project);
  validateOutletEvidence(project.outletEvidence);
  validateThresholdEvidence(project.thresholdEvidence);
  validateJointStudy(project.jointEvidenceStudy);
  validateRainTraceStudy(project.rainTraceStudy, width * height);
  validateRainOriginStudy(project.rainOriginStudy, width * height);
  return project;
}

export function runRain(cells, width, height, weather, options = {}) {
  validateProject({ schema: 'experimental-earth-site/1', title: 'model', width, height,
    existing: cells, proposal: cells, weather, observations: [] });
  const n = width * height;
  const water = Array(n).fill(0);
  const peak = Array(n).fill(0);
  const cellArea = weather.cellSizeM ** 2;
  const tracer = createRainTracer(n, cellArea, options?.rainTrace, Math.ceil(weather.durationMinutes / weather.stepMinutes) + 1);
  const override = options?.infiltrationOverride;
  const surfaceOverride = options?.surfaceInfiltrationOverride;
  if (options?.traceBudget !== undefined && typeof options.traceBudget !== 'boolean') {
    throw new Error('Water-budget tracing must be explicitly enabled or disabled');
  }
  const traceBudget = options?.traceBudget === true;
  if (surfaceOverride !== undefined && (!surfaceOverride ||
      !OWN(SURFACES, surfaceOverride.surface) || !within(surfaceOverride.rateMmHr, 0, 2000))) {
    throw new Error('Invalid surface infiltration override');
  }
  if (override !== undefined && surfaceOverride !== undefined) throw new Error('Choose one infiltration override scope');
  if (override !== undefined && (!override || !Number.isInteger(override.cellIndex) ||
      override.cellIndex < 0 || override.cellIndex >= n ||
      !within(override.rateMmHr, 0, 2000))) {
    throw new Error('Invalid infiltration override');
  }
  const boundaries = [];
  const pairs = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (x + 1 < width) pairs.push([i, i + 1]);
    if (y + 1 < height) pairs.push([i, i + width]);
    const exits = Number(x === 0) + Number(x === width - 1) + Number(y === 0) + Number(y === height - 1);
    if (exits) boundaries.push([i, exits]);
  }
  const origins = createRainOriginTracer(n, cellArea, options?.rainOrigins,
    Math.ceil(weather.durationMinutes / weather.stepMinutes) + 1, pairs, water);
  // Optional accounting of the same accepted fluxes used below. This does not
  // alter the hydraulic calculation or infer the origin of individual parcels.
  const budgetCells = traceBudget ? Array.from({ length: n }, (_, cellIndex) => ({
    cellIndex, rainLiters: 0, absorbedLiters: 0, boundaryExitLiters: 0,
    incomingLiters: 0, outgoingLiters: 0,
  })) : null;
  const budgetEdges = traceBudget ? pairs.map(([a, b]) => ({
    a, b, aToBLiters: 0, bToALiters: 0,
  })) : null;
  let rainLiters = 0, absorbedLiters = 0, exitLiters = 0;
  const snapshots = [{ minute: 0, depthsMm: water.slice(), storedLiters: 0, absorbedLiters: 0, exitLiters: 0 }];
  for (let start = 0; start < weather.durationMinutes - 1e-10; start += weather.stepMinutes) {
    const dtMinutes = Math.min(weather.stepMinutes, weather.durationMinutes - start);
    const dtHours = dtMinutes / 60;
    const rainOverlap = Math.max(0, Math.min(start + dtMinutes, weather.stormMinutes) - Math.min(start, weather.stormMinutes));
    const rainMm = weather.rainMmHr * rainOverlap / 60;
    tracer?.rain(rainMm);
    origins?.rain(rainMm);
    for (let i = 0; i < n; i++) {
      water[i] += rainMm;
      const rate = override?.cellIndex === i ? override.rateMmHr :
        surfaceOverride?.surface === cells[i].surface ? surfaceOverride.rateMmHr : SURFACES[cells[i].surface].infiltrationMmHr;
      const absorb = Math.min(water[i], rate * dtHours);
      tracer?.absorb(i, absorb, water[i]);
      origins?.absorb(i, absorb, water[i]);
      water[i] -= absorb;
      absorbedLiters += absorb * cellArea;
      if (traceBudget) {
        budgetCells[i].rainLiters += rainMm * cellArea;
        budgetCells[i].absorbedLiters += absorb * cellArea;
      }
      peak[i] = Math.max(peak[i], water[i]);
    }
    rainLiters += rainMm * cellArea * n;
    // Explicit finite-volume pair transfers. Simultaneously cap each source's
    // total proposed outflux to available depth; no neighbor creation/loss.
    const links = [];
    const proposedOut = Array(n).fill(0);
    for (let edgeIndex = 0; edgeIndex < pairs.length; edgeIndex++) {
      const [a, b] = pairs[edgeIndex];
      // Keep every edge index for accounting/tracing, including zero-flux walls.
      if (internalEdgeClosed(cells, a, b, width)) continue;
      const headA = cells[a].elevationM * 1000 + water[a];
      const headB = cells[b].elevationM * 1000 + water[b];
      const delta = headA - headB;
      if (Math.abs(delta) < 1e-12) continue;
      const src = delta > 0 ? a : b;
      const dst = delta > 0 ? b : a;
      const requested = Math.abs(delta) * weather.mobilityPerHour * dtHours;
      if (requested > 0) { links.push({ src, dst, requested, edgeIndex }); proposedOut[src] += requested; }
    }
    for (const [i, count] of boundaries) {
      // Exterior outlet stage: cell ground minus a declared 10 mm drop.
      // Only depth already inside the cell is eligible to leave.
      const requested = (water[i] + 10) * weather.boundaryExitPerHour * dtHours * count;
      if (requested > 0) { links.push({ src: i, dst: -1, requested }); proposedOut[i] += requested; }
    }
    const movement = Array(n).fill(0);
    for (const { src, dst, requested, edgeIndex } of links) {
      const capped = requested * Math.min(1, water[src] / proposedOut[src]);
      tracer?.transfer(src, dst, capped, water[src]);
      origins?.transfer(src, dst, capped, water[src], edgeIndex);
      movement[src] -= capped;
      if (dst >= 0) movement[dst] += capped;
      else exitLiters += capped * cellArea;
      if (traceBudget) {
        const liters = capped * cellArea;
        if (dst >= 0) {
          budgetCells[src].outgoingLiters += liters;
          budgetCells[dst].incomingLiters += liters;
          const edge = budgetEdges[edgeIndex];
          if (src === edge.a) edge.aToBLiters += liters;
          else edge.bToALiters += liters;
        } else budgetCells[src].boundaryExitLiters += liters;
      }
    }
    for (let i = 0; i < n; i++) {
      water[i] = Math.max(0, water[i] + movement[i]);
      peak[i] = Math.max(peak[i], water[i]);
    }
    const minute = Math.min(weather.durationMinutes, start + dtMinutes);
    tracer?.endStep(minute);
    origins?.endStep();
    snapshots.push({ minute, depthsMm: water.slice(), storedLiters: water.reduce((a, b) => a + b, 0) * cellArea, absorbedLiters, exitLiters });
  }
  const storedLiters = water.reduce((a, b) => a + b, 0) * cellArea;
  const massErrorLiters = rainLiters - absorbedLiters - exitLiters - storedLiters;
  const result = {
    rainLiters, absorbedLiters, exitLiters, storedLiters, massErrorLiters,
    maxDepthMm: Math.max(...peak), peakDepthMm: peak, finalDepthMm: water.slice(), snapshots,
    peakPondingLiters: Math.max(...snapshots.map(s => s.storedLiters)),
    cellsOver10Mm: peak.filter(d => d >= 10).length,
    ...(tracer ? { rainTrace: tracer.finish() } : {}),
    ...(origins ? { rainOrigins: origins.finish(water) } : {}),
  };
  if (traceBudget) {
    for (const cell of budgetCells) {
      cell.storedLiters = water[cell.cellIndex] * cellArea;
      cell.balanceErrorLiters = cell.rainLiters + cell.incomingLiters - cell.outgoingLiters -
        cell.absorbedLiters - cell.boundaryExitLiters - cell.storedLiters;
    }
    result.waterBudget = { schema: 'experimental-earth-water-budget/1', unit: 'liters',
      cells: budgetCells, edges: budgetEdges };
  }
  return result;
}

export function compare(project) {
  validateProject(project);
  return {
    existing: runRain(project.existing, project.width, project.height, project.weather),
    proposal: runRain(project.proposal, project.width, project.height, project.weather),
  };
}

export function depthAtMinute(result, cellIndex, minute) {
  const snaps = result.snapshots;
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= snaps[0].depthsMm.length || !within(minute, 0, snaps[snaps.length - 1].minute)) throw new Error('Observation time or cell out of range');
  let nearest = snaps[0];
  for (const s of snaps) if (Math.abs(s.minute - minute) < Math.abs(nearest.minute - minute)) nearest = s;
  return { depthMm: nearest.depthsMm[cellIndex], minute: nearest.minute };
}

export function chooseNextObservation(project, results) {
  // Sensitivity heuristic, not a statistical information-gain claim. Suggest
  // where the two *simulations* disagree most at the end of the storm.
  const at = project.weather.stormMinutes;
  let best = { cellIndex: 0, differenceMm: -1 };
  for (let i = 0; i < project.existing.length; i++) {
    const a = depthAtMinute(results.existing, i, at).depthMm;
    const b = depthAtMinute(results.proposal, i, at).depthMm;
    const diff = Math.abs(a - b);
    if (diff > best.differenceMm) best = { cellIndex: i, differenceMm: diff };
  }
  return { ...best, minute: at, reason: 'Largest simulated baseline/proposal ponding difference at storm end; validate local conditions before treating it as meaningful.' };
}

/**
 * One-input-at-a-time local sensitivity on an authored, *not measured* range.
 * Distinct from chooseNextObservation (which finds scenario disagreement).
 * Ranking is by final water not absorbed (storage + modeled edge outflow).
 * On grids >96 cells, a cheap, explicitly labeled heuristic chooses 36
 * candidates instead of blocking browser input on 2N full solver runs.
 */
export function chooseInfiltrationObservation(project, target = 'proposal') {
  validateProject(project);
  if (target !== 'proposal' && target !== 'existing') throw new Error('Unknown scenario');
  const cells = project[target], n = cells.length, {width,height,weather} = project;
  const indices = Array.from({length:n},(_,i)=>i);
  if (n > 96) {
    const reference = runRain(cells,width,height,weather);
    const priority = i => {
      const m = SURFACES[cells[i].surface];
      const depth = reference.finalDepthMm[i];
      return (m.rangeHighMmHr-m.rangeLowMmHr) * (0.2+depth/(depth+5));
    };
    indices.sort((a,b)=>priority(b)-priority(a)||a-b);
    indices.length = 36;
  }
  let winner = null;
  for(const cellIndex of indices) {
    const surface = cells[cellIndex].surface;
    const m = SURFACES[surface];
    const low=runRain(cells,width,height,weather,{infiltrationOverride:{cellIndex,rateMmHr:m.rangeLowMmHr}});
    const high=runRain(cells,width,height,weather,{infiltrationOverride:{cellIndex,rateMmHr:m.rangeHighMmHr}});
    const lowUnabsorbed = low.storedLiters + low.exitLiters;
    const highUnabsorbed = high.storedLiters + high.exitLiters;
    const impactLiters = Math.abs(highUnabsorbed - lowUnabsorbed);
    if (!winner || impactLiters > winner.impactLiters + 1e-9) {
      winner={target,cellIndex,surface,rangeLowMmHr:m.rangeLowMmHr,
        rangeHighMmHr:m.rangeHighMmHr,impactLiters,
        lowUnabsorbedLiters:lowUnabsorbed,highUnabsorbedLiters:highUnabsorbed};
    }
  }
  // A dry event or a fully absorbing site cannot justify a measurement
  // based on the tested output; never claim one is informative.
  return winner && winner.impactLiters > 1e-9
    ? {...winner,evaluatedCount:indices.length,totalCount:n}
    : null;
}
