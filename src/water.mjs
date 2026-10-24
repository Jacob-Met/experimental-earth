/** EXPERIMENTAL EARTH / rainfall lab. Deterministic illustrative surface-water account.
 * Units: millimeters of depth over equal square cells; 1 mm over 1 m² = 1 liter.
 * This is not a calibrated hydrology or flood-safety model.
 */
export const SCHEMA = 1;
export const MATERIALS = Object.freeze({
  paving: Object.freeze({ name: 'Paving', rate: 2, low: 1, high: 4, color: '#c9ced3' }),
  soil: Object.freeze({ name: 'Compacted soil', rate: 9, low: 3, high: 20, color: '#bc9977' }),
  planting: Object.freeze({ name: 'Planting bed', rate: 32, low: 12, high: 55, color: '#70a583' }),
  gravel: Object.freeze({ name: 'Gravel', rate: 18, low: 7, high: 40, color: '#d7c8a5' }),
});
const OWN = Object.prototype.hasOwnProperty;
function assert(ok, why) { if (!ok) throw new Error(why); }
function finite(v) { return typeof v === 'number' && Number.isFinite(v); }
function numeric(v, min, max, name) { assert(finite(v) && v >= min && v <= max, `${name} must be a finite number in [${min}, ${max}]`); return v; }
function copyJSON(value) { return JSON.parse(JSON.stringify(value)); }
function validMaterials(items, count) {
  assert(Array.isArray(items) && items.length === count, `materials must have ${count} cells`);
  items.forEach((id, i) => assert(OWN.call(MATERIALS, id), `unrecognized material at cell ${i}`));
  return [...items];
}
export function validateSite(site) {
  assert(site && typeof site === 'object' && !Array.isArray(site), 'site must be an object');
  assert(site.schemaVersion === SCHEMA, 'unsupported site schema');
  const cols = numeric(site.cols, 2, 36, 'cols'), rows = numeric(site.rows, 2, 36, 'rows');
  assert(Number.isInteger(cols) && Number.isInteger(rows) && cols * rows <= 640, 'grid must have <= 640 cells');
  const count = cols * rows;
  const cellSizeM = numeric(site.cellSizeM, 0.1, 20, 'cellSizeM');
  assert(Array.isArray(site.elevationMm) && site.elevationMm.length === count, 'elevationMm must match grid');
  const elevationMm = site.elevationMm.map((v, i) => numeric(v, -100000, 100000, `elevation[${i}]`));
  assert(Array.isArray(site.outlets) && site.outlets.length <= count, 'outlets must be an array');
  const outletIndices = new Set();
  const outlets = site.outlets.map((o, i) => {
    assert(o && typeof o === 'object', `outlet ${i} invalid`);
    assert(Number.isInteger(o.index) && o.index >= 0 && o.index < count, 'outlet index out of bounds');
    assert(!outletIndices.has(o.index), 'duplicate outlet index');
    outletIndices.add(o.index);
    return { index: o.index, capacityMmPerHour: numeric(o.capacityMmPerHour, 0, 2000, 'outlet capacity') };
  });
  const materials = validMaterials(site.materials, count);
  assert(typeof site.name === 'string' && site.name.length <= 140, 'name must be <= 140 characters');
  return { schemaVersion: SCHEMA, name: site.name, cols, rows, cellSizeM, elevationMm, outlets, materials };
}
export function validateStorm(storm) {
  assert(storm && typeof storm === 'object', 'storm must be an object');
  const intensityMmPerHour = numeric(storm.intensityMmPerHour, 0, 250, 'rain intensity');
  const durationMinutes = numeric(storm.durationMinutes, 1, 240, 'storm duration');
  const stepMinutes = numeric(storm.stepMinutes ?? 1, 0.25, 5, 'step duration');
  assert(durationMinutes / stepMinutes <= 1000, 'too many simulation steps');
  return { intensityMmPerHour, durationMinutes, stepMinutes };
}
function neighbors(index, cols, rows) {
  const x = index % cols, y = Math.floor(index / cols), a = [];
  if (x > 0) a.push(index - 1);
  if (x < cols - 1) a.push(index + 1);
  if (y > 0) a.push(index - cols);
  if (y < rows - 1) a.push(index + cols);
  return a;
}
/**
 * Simple demonstrator: each step adds uniform rainfall, removes bounded cell
 * infiltration and outlet discharge, then redistributes remaining free-surface
 * water along four-neighbor hydraulic-head gradients. Closed site boundaries
 * except the explicitly authored outlets; no subsurface/storage/evaporation.
 * Transfer coefficient is per minute and deliberately bounded to avoid negative
 * source depths. All transfers are simultaneous and exactly volume-conserving.
 */
export function simulateStorm(rawSite, rawStorm, options = {}) {
  const site = validateSite(rawSite), storm = validateStorm(rawStorm);
  const count = site.cols * site.rows;
  const area = site.cellSizeM ** 2;
  const depth = new Float64Array(count);
  const infiltrated = new Float64Array(count);
  const discharged = new Float64Array(count);
  const outletByIndex = new Map(site.outlets.map(o => [o.index, o.capacityMmPerHour]));
  const infiltrationRates = site.materials.map(m => MATERIALS[m].rate);
  if (options.infiltrationOverride) {
    const { index, rate } = options.infiltrationOverride;
    assert(Number.isInteger(index) && index >= 0 && index < count, 'override index invalid');
    infiltrationRates[index] = numeric(rate, 0, 2000, 'override rate');
  }
  const frames = [], edges = [];
  for (let i = 0; i < count; i++) for (const j of neighbors(i, site.cols, site.rows)) if (i < j) edges.push([i, j]);
  const totalSteps = Math.ceil(storm.durationMinutes / storm.stepMinutes);
  let elapsed = 0, totalRain = 0, totalInfil = 0, totalOut = 0, maxDepth = 0;
  function frame() {
    const stored = depth.reduce((s, n) => s + n, 0) * area;
    const balanceError = totalRain - totalInfil - totalOut - stored;
    return {
      minute: +elapsed.toFixed(5),
      depthsMm: Array.from(depth),
      rainLiters: totalRain, infiltrationLiters: totalInfil,
      outletLiters: totalOut, storedLiters: stored,
      balanceErrorLiters: balanceError,
      wetAreaM2: depth.reduce((s, d) => s + (d >= 2 ? area : 0), 0),
      maxDepthMm: Math.max(...depth),
    };
  }
  frames.push(frame());
  for (let step = 0; step < totalSteps; step++) {
    const dt = Math.min(storm.stepMinutes, storm.durationMinutes - elapsed);
    const dtH = dt / 60;
    const rain = storm.intensityMmPerHour * dtH;
    totalRain += rain * count * area;
    for (let i = 0; i < count; i++) {
      depth[i] += rain;
      const taken = Math.min(depth[i], infiltrationRates[i] * dtH);
      depth[i] -= taken;
      infiltrated[i] += taken * area;
      totalInfil += taken * area;
      const outlet = outletByIndex.get(i);
      if (outlet !== undefined) {
        const drained = Math.min(depth[i], outlet * dtH);
        depth[i] -= drained;
        discharged[i] += drained * area;
        totalOut += drained * area;
      }
    }
    // Conductance scales with cell size and time, bounded for stable local transfer.
    const alpha = Math.min(0.17, 0.17 * dt / Math.max(0.25, site.cellSizeM));
    const requested = new Float64Array(count), flows = [];
    for (const [a, b] of edges) {
      const headA = site.elevationMm[a] + depth[a];
      const headB = site.elevationMm[b] + depth[b];
      const difference = headA - headB;
      if (Math.abs(difference) < 1e-10) continue;
      const source = difference > 0 ? a : b, sink = difference > 0 ? b : a;
      const want = Math.min(depth[source], Math.abs(difference) * alpha);
      if (want > 0) { flows.push([source, sink, want]); requested[source] += want; }
    }
    const delta = new Float64Array(count);
    for (const [a, b, want] of flows) {
      const send = want * Math.min(1, depth[a] / requested[a]);
      delta[a] -= send; delta[b] += send;
    }
    for (let i = 0; i < count; i++) {
      depth[i] = Math.max(0, depth[i] + delta[i]);
      maxDepth = Math.max(maxDepth, depth[i]);
    }
    elapsed += dt;
    if (options.includeFrames !== false) frames.push(frame());
  }
  const final = frame();
  return {
    site: { name: site.name, cols: site.cols, rows: site.rows, cellSizeM: site.cellSizeM },
    storm, final, peakDepthMm: maxDepth,
    infiltratedByCellLiters: Array.from(infiltrated), outletByCellLiters: Array.from(discharged),
    frames: options.includeFrames === false ? [final] : frames,
  };
}
export function makeDemoSite() {
  const cols = 14, rows = 9, materials = [], elevationMm = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const basin = 22 * Math.exp(-((x - 7) ** 2 / 13 + (y - 4.5) ** 2 / 5));
    elevationMm.push(Math.round((cols - 1 - x) * 7 + 3 * Math.abs(y - 4) - basin));
    materials.push((x >= 3 && x <= 10 && y >= 2 && y <= 6) ? 'paving' : 'soil');
  }
  return { schemaVersion: SCHEMA, name: 'Illustrative schoolyard / authored, not surveyed',
    cols, rows, cellSizeM: 2, elevationMm, materials,
    outlets: [{ index: 4 * cols + cols - 1, capacityMmPerHour: 85 }] };
}
export function initialSession() {
  const baseline = makeDemoSite();
  return { sessionVersion: SCHEMA, baseline, proposal: copyJSON(baseline),
    storm: { intensityMmPerHour: 54, durationMinutes: 45, stepMinutes: 1 },
    notes: 'All geometry and material rates are authored illustration, not site measurements.' };
}
export function validateSession(session) {
  assert(session && session.sessionVersion === SCHEMA, 'unsupported session version');
  const baseline = validateSite(session.baseline), proposal = validateSite(session.proposal);
  assert(baseline.cols === proposal.cols && baseline.rows === proposal.rows && baseline.cellSizeM === proposal.cellSizeM, 'comparison sites must share a grid');
  assert(baseline.elevationMm.every((v, i) => v === proposal.elevationMm[i]), 'comparison elevations must match in this version');
  assert(JSON.stringify(baseline.outlets) === JSON.stringify(proposal.outlets), 'comparison outlets must match in this version');
  assert(typeof session.notes === 'string' && session.notes.length <= 2000, 'notes must be a short string');
  return { sessionVersion: SCHEMA, baseline, proposal, storm: validateStorm(session.storm), notes: session.notes };
}
export function paintCell(rawSession, index, material) {
  const session = validateSession(rawSession);
  assert(Number.isInteger(index) && index >= 0 && index < session.proposal.materials.length, 'paint cell out of bounds');
  assert(OWN.call(MATERIALS, material), 'unrecognized paint material');
  session.proposal.materials[index] = material;
  return session;
}
export function compareSession(rawSession) {
  const s = validateSession(rawSession);
  const baseline = simulateStorm(s.baseline, s.storm);
  const proposal = simulateStorm(s.proposal, s.storm);
  return { session: s, baseline, proposal,
    deltaStoredLiters: proposal.final.storedLiters - baseline.final.storedLiters,
    deltaOutletLiters: proposal.final.outletLiters - baseline.final.outletLiters,
    deltaInfiltrationLiters: proposal.final.infiltrationLiters - baseline.final.infiltrationLiters };
}
/** Local sensitivity to an uncertain material rate, not statistical uncertainty. */
export function suggestMeasurement(site, storm) {
  const s = validateSite(site), event = validateStorm(storm);
  const candidates = [];
  // Larger imported grids receive a transparent, heuristic shortlist. This
  // bounds main-thread sensitivity work without claiming a global optimum.
  const candidateIndices = Array.from({ length: s.materials.length }, (_, i) => i);
  if (candidateIndices.length > 160) {
    const base = simulateStorm(s, event, { includeFrames: false }).final;
    candidateIndices.sort((a, b) => {
      const priority = i => {
        const m = MATERIALS[s.materials[i]];
        return (m.high - m.low) * (0.1 + base.depthsMm[i] / (base.depthsMm[i] + 5));
      };
      return priority(b) - priority(a) || a - b;
    });
    candidateIndices.length = 36;
  }
  for (const i of candidateIndices) {
    const material = MATERIALS[s.materials[i]];
    if (material.high === material.low) continue;
    const low = simulateStorm(s, event, { includeFrames: false, infiltrationOverride: { index: i, rate: material.low } }).final;
    const high = simulateStorm(s, event, { includeFrames: false, infiltrationOverride: { index: i, rate: material.high } }).final;
    const impact = Math.abs((low.storedLiters + low.outletLiters) - (high.storedLiters + high.outletLiters));
    candidates.push({ index: i, x: i % s.cols, y: Math.floor(i / s.cols),
      material: s.materials[i], low: material.low, high: material.high,
      impactLiters: impact,
      lowUnabsorbedLiters: low.storedLiters + low.outletLiters,
      highUnabsorbedLiters: high.storedLiters + high.outletLiters });
  }
  candidates.sort((a, b) => b.impactLiters - a.impactLiters || a.index - b.index);
  if (!candidates.length) return null;
  return { ...candidates[0], evaluatedCount: candidates.length, totalCount: s.materials.length };
}
