import { runRain, validateProject } from './core.js';
import { validateRainTraceStudy } from './rain-tracer.js';

export function compareRainTrace(project) {
  validateProject(project);
  const sourceCells = validateRainTraceStudy(project.rainTraceStudy, project.width * project.height);
  if (!sourceCells) throw new Error('Choose a source area before tracing rain');
  const run = cells => runRain(cells, project.width, project.height, project.weather,
    { rainTrace: { sourceCells } }).rainTrace;
  const existing = run(project.existing), proposal = run(project.proposal);
  const delta = {};
  for (const key of ['rainLiters', 'absorbedLiters', 'exitLiters', 'storedLiters']) delta[key] = proposal[key] - existing[key];
  return { sourceCells, sourceAreaM2: sourceCells.length * project.weather.cellSizeM ** 2,
    durationMinutes: project.weather.durationMinutes, existing, proposal, delta };
}

export function rainTraceSignature(project) {
  return JSON.stringify({ width: project.width, height: project.height,
    weather: project.weather, existing: project.existing, proposal: project.proposal,
    sourceCells: project.rainTraceStudy?.sourceCells });
}
