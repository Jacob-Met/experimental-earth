import { runRain, validateProject } from './core.js';
import { validateRainTraceStudy, MAX_TRACE_CELL_STEPS } from './rain-tracer.js';

export function compareRainTrace(project, options = {}) {
  validateProject(project);
  if (options.timeline !== undefined && typeof options.timeline !== 'boolean') throw new Error('Timeline selection must be a boolean');
  const sourceCells = validateRainTraceStudy(project.rainTraceStudy, project.width * project.height);
  if (!sourceCells) throw new Error('Choose a source area before tracing rain');
  const requestedCellSteps = project.width * project.height * (Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes) + 1);
  const captureSteps = options.timeline === true && requestedCellSteps <= MAX_TRACE_CELL_STEPS;
  const timeline = options.timeline === true ? { status: captureSteps ? 'retained' : 'not-retained',
    requestedCellSteps, maximumCellStepsPerScenario: MAX_TRACE_CELL_STEPS,
    reason: captureSteps ? null : 'This grid and time interval are too detailed for a retained timeline. Showing final destinations.' } : null;
  const run = cells => runRain(cells, project.width, project.height, project.weather,
    { rainTrace: { sourceCells, captureSteps } }).rainTrace;
  const existing = run(project.existing), proposal = run(project.proposal);
  const delta = {};
  for (const key of ['rainLiters', 'absorbedLiters', 'exitLiters', 'storedLiters']) delta[key] = proposal[key] - existing[key];
  return { sourceCells, sourceAreaM2: sourceCells.length * project.weather.cellSizeM ** 2,
    durationMinutes: project.weather.durationMinutes, existing, proposal, delta,
    ...(timeline ? { timeline, cellAreaM2: project.weather.cellSizeM ** 2 } : {}) };
}

export function rainTraceSignature(project) {
  return JSON.stringify({ width: project.width, height: project.height,
    weather: project.weather, existing: project.existing, proposal: project.proposal,
    sourceCells: project.rainTraceStudy?.sourceCells });
}
