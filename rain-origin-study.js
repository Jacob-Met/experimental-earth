import { runRain, validateProject } from './core.js';
import { validateRainOriginStudy } from './rain-origins.js';

export function compareRainOrigins(project) {
  validateProject(project);
  const study = validateRainOriginStudy(project.rainOriginStudy, project.width * project.height);
  if (!study) throw new Error('Choose a destination before explaining its rainfall origins');
  const run = cells => runRain(cells, project.width, project.height, project.weather,
    { rainOrigins: study }).rainOrigins;
  const existing = run(project.existing), proposal = run(project.proposal);
  return { ...study, durationMinutes: project.weather.durationMinutes,
    existing, proposal, deltaLiters: proposal.rainfallLiters - existing.rainfallLiters };
}

export function rainOriginSignature(project) {
  return JSON.stringify({ width: project.width, height: project.height, weather: project.weather,
    existing: project.existing, proposal: project.proposal, study: project.rainOriginStudy });
}
