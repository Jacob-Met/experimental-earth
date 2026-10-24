import { runRain, validateProject } from './core.js';
import { validateRainOriginStudy } from './rain-origins.js';

export function compareRainOrigins(project) {
  validateProject(project);
  const study = validateRainOriginStudy(project.rainOriginStudy, project.width * project.height, project.weather.durationMinutes);
  if (!study) throw new Error('Choose a destination before explaining its rainfall origins');
  const run = cells => runRain(cells, project.width, project.height, project.weather,
    { rainOrigins: study });
  const existingRun = run(project.existing), proposalRun = run(project.proposal);
  const existing = existingRun.rainOrigins, proposal = proposalRun.rainOrigins;
  return { ...study, durationMinutes: project.weather.durationMinutes,
    minute: existing.minute ?? existingRun.snapshots.at(-1).minute,
    availableMinutes: existingRun.snapshots.map(snapshot => snapshot.minute),
    existing, proposal, deltaLiters: proposal.rainfallLiters - existing.rainfallLiters };
}

export function rainOriginSignature(project) {
  return JSON.stringify({ width: project.width, height: project.height, weather: project.weather,
    existing: project.existing, proposal: project.proposal, study: project.rainOriginStudy });
}
