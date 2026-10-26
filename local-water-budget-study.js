const SCHEMA = 'experimental-earth-local-water-budget/1';
const FIELDS = ['schema', 'scope', 'width', 'height', 'cellIndices'];
const SCOPES = ['cell', 'edited', 'site', 'custom'];
const validDimension = value => Number.isSafeInteger(value) && value >= 2 && value <= 24;

/** Validate persisted area controls without changing their membership or order. */
export function validateLocalWaterBudgetStudy(study, width, height) {
  if (study === undefined) return study;
  if (!study || typeof study !== 'object' || Array.isArray(study)) {
    throw new Error('Invalid local water budget study');
  }
  const fields = Reflect.ownKeys(study);
  if (fields.length !== FIELDS.length || fields.some(field => !FIELDS.includes(field)) ||
      study.schema !== SCHEMA || !SCOPES.includes(study.scope)) {
    throw new Error('Invalid local water budget study fields or scope');
  }
  if (!validDimension(width) || !validDimension(height) ||
      study.width !== width || study.height !== height) {
    throw new Error('Local water budget study dimensions must match the site grid');
  }
  const members = study.cellIndices, count = width * height;
  if (!Array.isArray(members) || members.length > count) {
    throw new Error('Local water budget study must contain distinct cells within the site grid');
  }
  const seen = new Set();
  for (const member of members) {
    if (!Number.isSafeInteger(member) || member < 0 || member >= count || seen.has(member)) {
      throw new Error('Local water budget study must contain distinct cells within the site grid');
    }
    seen.add(member);
  }
  // An empty custom selection is saved deliberately, including while another
  // scope is active; the consumer presents it as no area rather than a budget.
  return study;
}
