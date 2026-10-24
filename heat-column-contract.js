import { validateSurfaceHeatStudy } from './surface-heat-contract.js';
import { heatEvidenceCurrent } from './surface-heat-evidence-contract.js';

export const HEAT_COLUMN_SCHEMA = 'experimental-earth-heat-column/1';
export const HEAT_COLUMN_MODEL = 'two-uniform-stores-forced-surface-linear-exchange';
const number = (v, low, high) => typeof v === 'number' && Number.isFinite(v) && v >= low && v <= high;

export function validateHeatColumnStudy(study) {
  if (study === undefined) return;
  if (!study || study.schema !== HEAT_COLUMN_SCHEMA || study.model !== HEAT_COLUMN_MODEL || !study.heatStudy) {
    throw Error('Retain a versioned two-layer declaration and its original surface exposure');
  }
  validateSurfaceHeatStudy(study.heatStudy);
  for (const target of ['existing', 'proposal']) {
    const p = study.lowerLayers?.[target];
    if (!p || !number(p.capacityJm2K, 1000, 1e7) || !number(p.conductanceWm2K, 0, 1000) ||
        !number(p.initialC, -100, 200) || typeof p.source !== 'string' || !p.source.trim() || p.source.length > 600) {
      throw Error('Each lower layer needs capacity 1000–10000000 J/(m²·K), conductance 0–1000 W/(m²·K), initial −100–200 °C and its source');
    }
  }
  return study;
}

// The maintained heat evidence identity already binds the whole declaration,
// selected cell, metric size and source. A new exposure must not inherit a layer.
export const heatColumnCurrent = (project, study) => heatEvidenceCurrent(project, study);
