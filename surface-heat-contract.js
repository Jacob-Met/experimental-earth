import { canonicalEvidence } from './outlet-evidence-contract.js';

export const SURFACE_HEAT_SCHEMA = 'experimental-earth-surface-heat/1';
export const SURFACE_HEAT_MODEL = 'uniform-layer-forced-linear-exchange';
const finite = (v, low, high) => typeof v === 'number' && Number.isFinite(v) && v >= low && v <= high;
const source = (v, limit = 600) => typeof v === 'string' && v.trim().length > 0 && v.length <= limit;

export function surfaceHeatContext(project, cellIndex) {
  return JSON.stringify(canonicalEvidence({ width: project.width, height: project.height,
    cellSizeM: project.weather.cellSizeM, source: project.source ?? '', cellIndex,
    existing: project.existing[cellIndex], proposal: project.proposal[cellIndex] }));
}

export function validateSurfaceHeatStudy(study) {
  if (study === undefined) return;
  if (!study || study.schema !== SURFACE_HEAT_SCHEMA || study.model !== SURFACE_HEAT_MODEL ||
      !Number.isInteger(study.cellIndex) || !source(study.contextJson, 20000)) {
    throw Error('Retain a source-bound surface heat declaration');
  }
  let context;
  try { context = JSON.parse(study.contextJson); } catch { throw Error('Invalid retained heat-study place context'); }
  if (!context || !Number.isInteger(context.width) || !Number.isInteger(context.height) ||
      !finite(context.width, 2, 24) || !finite(context.height, 2, 24) ||
      !finite(context.cellSizeM, .25, 100) || typeof context.source !== 'string' ||
      context.cellIndex !== study.cellIndex || study.cellIndex < 0 || study.cellIndex >= context.width * context.height ||
      !['existing', 'proposal'].every(k => context[k] && finite(context[k].elevationM, -10, 10) &&
        typeof context[k].surface === 'string' && typeof context[k].provenance === 'string')) {
    throw Error('Retain the original selected place and metric cell for heat comparison');
  }
  for (const target of ['existing', 'proposal']) {
    const p = study[target];
    if (!p || !finite(p.absorptivity, 0, 1) || !finite(p.capacityJm2K, 1000, 10000000) ||
        !finite(p.exchangeWm2K, 0, 1000) || !finite(p.initialC, -100, 200) || !source(p.source)) {
      throw Error('Each layer needs absorption 0–1, capacity 1000–10000000 J/(m²·K), exchange 0–1000 W/(m²·K), initial −100–200 °C, and a source');
    }
  }
  if (!Array.isArray(study.schedule) || study.schedule.length < 1 || study.schedule.length > 24) {
    throw Error('Supply 1–24 consecutive exposure intervals');
  }
  let duration = 0;
  for (const row of study.schedule) {
    if (!row || !finite(row.minutes, .1, 720) || !finite(row.incidentWm2, 0, 2000) ||
        !finite(row.reservoirC, -100, 200) || !source(row.source, 400)) {
      throw Error('Each interval needs duration 0.1–720 min, incident input 0–2000 W/m², reservoir −100–200 °C, and a source');
    }
    duration += row.minutes;
  }
  if (duration > 1440) throw Error('Heat experiment exceeds the 1440-minute horizon');
  return study;
}
