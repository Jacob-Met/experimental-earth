import { canonicalEvidence } from './outlet-evidence-contract.js';

export const JOINT_EVIDENCE_SCHEMA = 'experimental-earth-joint-evidence/1';
const bounded = (n, lo, hi) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
const text = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
export const readingIdentity = reading => JSON.stringify(canonicalEvidence(reading));

export function outletEventIdentity(record) {
  if (!record) throw new Error('Retain an outlet event before associating joint evidence.');
  const { target, eventRef, coverage, collectionSource, contextJson, durationMinutes } = record;
  return readingIdentity({ target, eventRef, coverage, collectionSource, contextJson, durationMinutes });
}

/** A saved association preserves evidence identity; it does not verify acquisition. */
export function validateJointStudy(study) {
  if (study === undefined) return;
  if (!study || study.schema !== JOINT_EVIDENCE_SCHEMA ||
      !['existing', 'proposal'].includes(study.target) || !['sealed', 'turf', 'garden'].includes(study.surface) ||
      !text(study.outletIdentity, 500000) || !Array.isArray(study.pairs) || study.pairs.length < 2 || study.pairs.length > 12 ||
      !Array.isArray(study.depthReferences) || study.depthReferences.length > 100 ||
      typeof study.depthAssociation !== 'string' || study.depthAssociation.length > 400 ||
      (study.depthReferences.length && !study.depthAssociation.trim())) {
    throw new Error('A joint comparison needs an outlet event, surface, 2–12 explicit pairs and a source statement for any associated depths.');
  }
  const labels = new Set(), pairs = new Set(), indices = new Set();
  for (const pair of study.pairs) {
    if (!pair || !text(pair.label, 60) || !bounded(pair.infiltrationMmHr, 0, 2000) || !bounded(pair.outletPerHour, 0, 10) ||
        labels.has(pair.label) || pairs.has(`${pair.infiltrationMmHr}/${pair.outletPerHour}`)) {
      throw new Error('Pairs need distinct labels and distinct infiltration/outlet values within 0–2000 mm/h and 0–10 per hour.');
    }
    labels.add(pair.label); pairs.add(`${pair.infiltrationMmHr}/${pair.outletPerHour}`);
  }
  let referenceBytes = 0;
  for (const ref of study.depthReferences) {
    if (!ref || !Number.isInteger(ref.index) || ref.index < 0 || ref.index >= 100 ||
        indices.has(ref.index) || !text(ref.readingJson, 10000)) throw new Error('Selected depth references must be distinct, bounded notebook entries.');
    indices.add(ref.index); referenceBytes += ref.readingJson.length;
  }
  if (referenceBytes > 200000) throw new Error('Selected depth source metadata exceeds the comparison limit.');
  return study;
}
