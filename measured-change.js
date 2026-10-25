/** Original four-reading contrast; intervals are declared bounds, not probabilities. */
export const CHANGE_SCHEMA = 'experimental-earth-measured-change/1';
const keys = ['treatedBefore','treatedAfter','comparisonBefore','comparisonAfter'];
function text(value, name) {
  if(typeof value !== 'string' || !value.trim() || value.length > 1000) throw Error(`Declare ${name} (1–1000 characters)`);
  return value;
}
export function validateChange(input) {
  if(!input || input.schema !== CHANGE_SCHEMA) throw Error('Unsupported measured-change schema');
  const allowed=['schema','quantity','unit','treatedPlace','comparisonPlace','association','parallelChange','before','after',...keys];
  if(Object.keys(input).some(k=>!allowed.includes(k)))throw Error('Unknown investigation field');
  for(const k of ['quantity','unit','treatedPlace','comparisonPlace','association','parallelChange']) text(input[k],k);
  if(input.treatedPlace.trim()===input.comparisonPlace.trim()) throw Error('Comparison place must be distinct');
  for(const k of ['before','after']) {
    const t=input[k];
    if(typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(t) || !Number.isFinite(Date.parse(t)) || new Date(t).toISOString().replace('.000Z','Z')!==t) throw Error('Declare exact valid UTC before/after times');
  }
  if(Date.parse(input.before)>=Date.parse(input.after)) throw Error('After time must follow before time');
  for(const key of keys) {
    const r=input[key];if(!r)throw Error(`Missing ${key}`);
    if(Object.keys(r).some(k=>!['lower','upper','source','unit','place','time'].includes(k)))throw Error('Unknown reading field');
    if(!Number.isFinite(r.lower)||!Number.isFinite(r.upper)||Math.abs(r.lower)>1e12||Math.abs(r.upper)>1e12||r.lower>r.upper)throw Error(`Invalid ${key} bounds`);
    text(r.source,`${key} original source`);
    if(r.unit!==input.unit)throw Error(`Wrong unit in ${key}; convert explicitly before comparing`);
    if(r.place!==input[key.startsWith('treated')?'treatedPlace':'comparisonPlace'])throw Error(`Wrong place in ${key}`);
    if(r.time!==input[key.endsWith('Before')?'before':'after'])throw Error(`Noncontemporaneous time in ${key}`);
  }
  return input;
}
const subtract=(a,b)=>({lower:a.lower-b.upper,upper:a.upper-b.lower});
export function compareMeasuredChange(input) {
  validateChange(input);
  const treated=subtract(input.treatedAfter,input.treatedBefore);
  const comparison=subtract(input.comparisonAfter,input.comparisonBefore);
  const contrast=subtract(treated,comparison);
  const guard=64*Number.EPSILON*Math.max(1,...keys.flatMap(k=>[Math.abs(input[k].lower),Math.abs(input[k].upper)]));
  return {treated,comparison,contrast,numericalGuard:guard,direction:contrast.upper < -guard?'negative':contrast.lower > guard?'positive':'unresolved'};
}
export function changeExample() {
  const x={schema:CHANGE_SCHEMA,quantity:'Surface temperature',unit:'°C',treatedPlace:'Authored courtyard treatment patch',comparisonPlace:'Authored unchanged comparison patch',before:'2026-06-01T12:00:00Z',after:'2026-06-02T12:00:00Z',association:'Fictional same-time surface readings; software control only.',parallelChange:'Hypothetical common weather change; not verified by these four readings.'};
  for(const [i,k] of keys.entries())x[k]={lower:[29,33,19,27][i],upper:[31,35,21,29][i],source:'Authored control, not a field measurement',unit:x.unit,place:x[k.startsWith('treated')?'treatedPlace':'comparisonPlace'],time:x[k.endsWith('Before')?'before':'after']};
  return x;
}
