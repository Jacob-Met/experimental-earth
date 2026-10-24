import { validateHeatColumnStudy, heatColumnCurrent } from './heat-column-contract.js';
import { heatDeclarationIdentity } from './surface-heat-evidence-contract.js';

export const HEAT_COLUMN_EVIDENCE_SCHEMA = 'experimental-earth-heat-column-evidence/1';
const number = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const text = (v, limit) => typeof v === 'string' && !!v.trim() && v.length <= limit;
const fields = (value, allowed) => Object.keys(value).every(key => allowed.includes(key));

export function validateHeatColumnEvidence(evidence) {
  if (evidence === undefined) return;
  if (!evidence || evidence.schema !== HEAT_COLUMN_EVIDENCE_SCHEMA ||
      evidence.quantity !== 'surface-temperature' || !['existing', 'proposal'].includes(evidence.target) ||
      !text(evidence.associationSource, 600)) {
    throw Error('Retain a surface-temperature investigation, selected place and source association');
  }
  validateHeatColumnStudy(evidence.columnStudy);
  if (!evidence.columnStudy) throw Error('Retain the original two-store declaration');
  if (!Array.isArray(evidence.hypotheses) || evidence.hypotheses.length < 2 || evidence.hypotheses.length > 12) {
    throw Error('Supply 2–12 explicit lower-store capacity/conductance alternatives');
  }
  const labels = new Set();
  for (const h of evidence.hypotheses) {
    if (!h || !fields(h, ['label', 'capacityJm2K', 'conductanceWm2K', 'source']) ||
        !text(h.label, 60) || labels.has(h.label) || !text(h.source, 600) ||
        !number(h.capacityJm2K, 1000, 1e7) || !number(h.conductanceWm2K, 0, 1000)) {
      throw Error('Alternatives need distinct labels, supported lower capacity/conductance and sources; initial temperature and surface properties stay fixed');
    }
    labels.add(h.label);
  }
  if (!Array.isArray(evidence.readings) || evidence.readings.length > 100) throw Error('Retain at most 100 sourced surface readings');
  const duration = evidence.columnStudy.heatStudy.schedule.reduce((sum, row) => sum + row.minutes, 0);
  const times = new Set();
  for (const r of evidence.readings) {
    if (!r || !fields(r, ['minute', 'temperatureC', 'halfWidthC', 'use', 'source']) ||
        !number(r.minute, 0, duration) || times.has(r.minute) || !number(r.temperatureC, -100, 500) ||
        !number(r.halfWidthC, 0, 100) || !['calibration', 'challenge'].includes(r.use) || !text(r.source, 600)) {
      throw Error('Surface readings need unique times within the exposure, −100–500 °C, a 0–100 °C half-width, calibration/challenge use and sources');
    }
    times.add(r.minute);
  }
  return evidence;
}

export function heatColumnEvidenceCurrent(project, evidence) {
  return !!project.heatColumnStudy && heatColumnCurrent(project, evidence.columnStudy) &&
    heatDeclarationIdentity(evidence.columnStudy) === heatDeclarationIdentity(project.heatColumnStudy);
}
