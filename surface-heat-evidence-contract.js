import { validateSurfaceHeatStudy, surfaceHeatContext } from './surface-heat-contract.js';
import { canonicalEvidence } from './outlet-evidence-contract.js';

export const HEAT_EVIDENCE_SCHEMA = 'experimental-earth-surface-heat-evidence/1';
export const heatDeclarationIdentity = study => JSON.stringify(canonicalEvidence(study));
const number = (v, low, high) => typeof v === 'number' && Number.isFinite(v) && v >= low && v <= high;
const text = (s, limit) => typeof s === 'string' && s.trim().length > 0 && s.length <= limit;

export function validateHeatEvidence(evidence) {
  if (evidence === undefined) return;
  if (!evidence || evidence.schema !== HEAT_EVIDENCE_SCHEMA ||
      !['existing', 'proposal'].includes(evidence.target) || !text(evidence.associationSource, 600)) {
    throw Error('Retain the selected layer and a source explaining how these readings belong to its exposure.');
  }
  validateSurfaceHeatStudy(evidence.heatStudy);
  if (!evidence.heatStudy) throw Error('Retain the original source-bound heat exposure.');
  if (!Array.isArray(evidence.hypotheses) || evidence.hypotheses.length < 2 || evidence.hypotheses.length > 12) {
    throw Error('Supply 2–12 explicit layer hypotheses.');
  }
  const labels = new Set();
  for (const h of evidence.hypotheses) {
    if (!h || !text(h.label, 60) || labels.has(h.label)) throw Error('Hypotheses need distinct nonempty labels of at most 60 characters.');
    labels.add(h.label);
    // The existing model owns all material bounds and source admission.
    validateSurfaceHeatStudy({ ...evidence.heatStudy, existing: h, proposal: h });
  }
  if (!Array.isArray(evidence.readings) || evidence.readings.length > 100) throw Error('At most 100 temperature readings may be retained.');
  const duration = evidence.heatStudy.schedule.reduce((sum, row) => sum + row.minutes, 0), times = new Set();
  for (const r of evidence.readings) {
    if (!r || !number(r.minute, 0, duration) || !number(r.temperatureC, -100, 500) || !number(r.halfWidthC, 0, 100) ||
        !['calibration', 'challenge'].includes(r.use) || !text(r.source, 600) || times.has(r.minute)) {
      throw Error('Readings need distinct times within the exposure, −100–500 °C, a 0–100 °C half-width, calibration/challenge use and a source.');
    }
    times.add(r.minute);
  }
  return evidence;
}

export function heatEvidenceCurrent(project, evidence) {
  return !!project.surfaceHeatStudy &&
    evidence.heatStudy.contextJson === surfaceHeatContext(project, evidence.heatStudy.cellIndex) &&
    heatDeclarationIdentity(evidence.heatStudy) === heatDeclarationIdentity(project.surfaceHeatStudy);
}
