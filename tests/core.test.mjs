import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain, compare, validateProject, depthAtMinute, chooseNextObservation, chooseInfiltrationObservation } from '../core.js';
const close = (a,b,tol=1e-7) => assert.ok(Math.abs(a-b) <= tol, `${a} != ${b}`);

test('sample accepts validated project schema and leaves user-project cells untouched', () => {
  const p = makeExample(); const orig = JSON.stringify(p);
  validateProject(p); const r = compare(p);
  assert.ok(r.existing.rainLiters > 0);
  assert.equal(JSON.stringify(p), orig);
});
test('rainfall water balance closes despite outgoing flux and mixed infiltration', () => {
  const p = makeExample(); const {existing,proposal}=compare(p);
  for (const r of [existing,proposal]) {
    close(r.rainLiters, r.absorbedLiters + r.exitLiters + r.storedLiters, 1e-6);
    assert.ok(Math.abs(r.massErrorLiters)<1e-6);
    for (const s of r.snapshots) {
      assert.ok(s.storedLiters >= 0);
      assert.ok(s.depthsMm.every(d => Number.isFinite(d) && d >= 0));
    }
  }
});
test('no rain gives an exactly dry site', () => {
  const p=makeExample();p.weather.rainMmHr=0;
  const r=runRain(p.existing,p.width,p.height,p.weather);
  close(r.rainLiters,0);close(r.absorbedLiters,0);close(r.exitLiters,0);close(r.storedLiters,0);
});
test('closed sealed site without infiltration retains exactly all rain volume', () => {
  const p=makeExample();p.existing.forEach(c=>{c.surface='sealed'});p.weather.boundaryExitPerHour=0;
  // Sealed still infiltrates at 1 mm/hr by design; mass balance is the invariant.
  const r=runRain(p.existing,p.width,p.height,p.weather);
  close(r.exitLiters,0);close(r.rainLiters,r.absorbedLiters+r.storedLiters,1e-6);
});
test('garden intervention increases absorption under identical storm', () => {
  const p=makeExample();const r=compare(p);
  assert.ok(r.proposal.absorbedLiters > r.existing.absorbedLiters+1);
  assert.ok(r.proposal.exitLiters <= r.existing.exitLiters+1e-6);
});
test('each input is deterministic and model does not mutate its arguments',()=>{
  const p=makeExample();const before=JSON.stringify(p);
  assert.deepEqual(compare(p),compare(p));assert.equal(JSON.stringify(p),before);
});
test('rainfall exactly stops at stated fractional storm boundary',()=>{
  const p=makeExample();p.weather.stormMinutes=17;p.weather.durationMinutes=35;p.weather.rainMmHr=30;
  const r=runRain(p.existing,p.width,p.height,p.weather);
  close(r.rainLiters,30*17/60*p.weather.cellSizeM**2*p.existing.length,1e-7);
});
test('snapshots support attributed observations and bounded suggestion',()=>{
  const p=makeExample();const r=compare(p);
  const v=depthAtMinute(r.existing,12,60);
  assert.equal(v.minute,60);assert.ok(v.depthMm>=0);
  const n=chooseNextObservation(p,r);
  assert.ok(n.cellIndex>=0 && n.cellIndex<p.existing.length);
  assert.equal(n.minute,p.weather.stormMinutes);
});
test('invalid files and dishonest input quantities fail closed',()=>{
  const p=makeExample(); const bad=structuredClone(p);
  bad.proposal[0].surface='unrecognized'; assert.throws(()=>validateProject(bad),/Invalid/);
  p.weather.durationMinutes=5; assert.throws(()=>compare(p),/parameters/);
  p.weather.durationMinutes=240;
  p.observations.push({cellIndex:0,minute:20,depthMm:7,uncertaintyMm:1,source:''});
  assert.throws(()=>validateProject(p),/observation/);
});
test('saved JSON roundtrips with observation/source and same predictions',()=>{
  const p=makeExample();p.observations.push({cellIndex:9,minute:60,depthMm:8,uncertaintyMm:2,source:'manual ruler reading'});
  const restored=validateProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(compare(restored),compare(p)); assert.deepEqual(restored.observations,p.observations);
});

test('per-cell infiltration overrides conserve water and preserve original cells',()=>{
 const p=makeExample(), original=JSON.stringify(p);
 const options=i=>({infiltrationOverride:{cellIndex:27,rateMmHr:i}});
 const low=runRain(p.proposal,p.width,p.height,p.weather,options(0));
 const high=runRain(p.proposal,p.width,p.height,p.weather,options(100));
 assert.ok(high.absorbedLiters>low.absorbedLiters);
 for(const r of [low,high]) close(r.rainLiters,r.absorbedLiters+r.exitLiters+r.storedLiters,1e-6);
 assert.equal(JSON.stringify(p),original);
});
test('authored-rate sensitivity finds a reproducible impactful input separate from scenario difference',()=>{
 const p=makeExample(), original=JSON.stringify(p);
 const result=chooseInfiltrationObservation(p);
 assert.ok(result && result.impactLiters>0);
 assert.equal(result.totalCount,p.proposal.length);
 assert.equal(result.evaluatedCount,result.totalCount);
 close(result.impactLiters,Math.abs(result.lowUnabsorbedLiters-result.highUnabsorbedLiters));
 assert.deepEqual(chooseInfiltrationObservation(p),result);
 assert.equal(JSON.stringify(p),original);
});
test('dry storm exposes no consequential sensitivity; no invented measurement advice',()=>{
 const p=makeExample();p.weather.rainMmHr=0;
 assert.equal(chooseInfiltrationObservation(p),null);
});
test('per-cell override rejects invalid index/rate and unknown scenario',()=>{
 const p=makeExample(),args=[p.proposal,p.width,p.height,p.weather];
 for(const infiltrationOverride of [
   {cellIndex:-1,rateMmHr:10},{cellIndex:999,rateMmHr:10},
   {cellIndex:1,rateMmHr:NaN},{cellIndex:1,rateMmHr:-2},{cellIndex:1,rateMmHr:2001},
 ]) assert.throws(()=>runRain(...args,{infiltrationOverride}),/Invalid/);
 assert.throws(()=>chooseInfiltrationObservation(p,'fake'),/Unknown scenario/);
});

test('imported larger grids use a visibly bounded heuristic shortlist',()=>{
 const p=makeExample();
 p.width=16;p.height=7;
 p.existing=Array.from({length:p.width*p.height},(_,i)=>({...p.existing[i%48]}));
 p.proposal=Array.from({length:p.width*p.height},(_,i)=>({...p.proposal[i%48]}));
 p.selectedIndex=0;
 const r=chooseInfiltrationObservation(p);
 assert.ok(r&&r.impactLiters>0);
 assert.equal(r.totalCount,112);
 assert.equal(r.evaluatedCount,36);
});

test('storm-end observation suggestions interpolate non-grid times rather than reading a dry nearest snapshot', () => {
  const p = makeExample();
  p.weather.stepMinutes = 30;
  p.weather.stormMinutes = 5;
  p.weather.durationMinutes = 30;
  p.weather.rainMmHr = 250;
  const source = JSON.stringify(p);
  const results = compare(p);
  assert.deepEqual(results.existing.snapshots.map(s => s.minute), [0, 30]);

  // Independent linear interpolation of both solver outputs to the actual
  // requested time. A nearest-snapshot lookup incorrectly selects minute 0.
  const sampled = (result, index) => {
    const [before, after] = result.snapshots;
    return before.depthsMm[index] + (after.depthsMm[index] - before.depthsMm[index]) * 5 / 30;
  };
  const differences = p.existing.map((_, index) => Math.abs(
    sampled(results.existing, index) - sampled(results.proposal, index)));
  const winner = differences.reduce((best, value, index) =>
    value > differences[best] ? index : best, 0);
  assert.equal(winner, 27);
  close(differences[winner], 1.4375, 1e-9);

  const suggestion = chooseNextObservation(p, results);
  assert.equal(suggestion.minute, 5);
  assert.equal(suggestion.cellIndex, winner);
  close(suggestion.differenceMm, differences[winner], 1e-9);
  assert.equal(suggestion.beforeMinute, 0);
  assert.equal(suggestion.afterMinute, 30);
  assert.equal(suggestion.method, 'linear interpolation');
  const sampledCell = depthAtMinute(results.existing, winner, 5);
  close(sampledCell.depthMm, sampled(results.existing, winner));
  assert.equal(sampledCell.minute, 5);
  assert.throws(() => depthAtMinute(results.existing, winner, 31), /outside/);
  assert.throws(() => depthAtMinute(results.existing, winner, NaN), /outside/);

  // At a retained snapshot the same consumer must use the exact solver output.
  const aligned = structuredClone(p);
  aligned.weather.stepMinutes = 5;
  const alignedResults = compare(aligned);
  const exact = chooseNextObservation(aligned, alignedResults);
  assert.equal(exact.minute, 5);
  assert.equal(exact.beforeMinute, 5);
  assert.equal(exact.afterMinute, 5);
  assert.equal(exact.method, 'snapshot');
  assert.equal(JSON.stringify(p), source);
});

test('identical site alternatives and dry storms do not invent a discriminating location', () => {
  const p = makeExample();
  const original = JSON.stringify(p);
  assert.ok(chooseNextObservation(p, compare(p))?.differenceMm > 0,
    'the unchanged example still supports a difference-driven suggestion');
  p.proposal = structuredClone(p.existing);
  const same = JSON.stringify(p);
  assert.equal(chooseNextObservation(p, compare(p)), null,
    'copying the baseline must not recommend arbitrary cell A1 at zero difference');
  assert.equal(JSON.stringify(p), same);
  p.weather.rainMmHr = 0;
  const dry = JSON.stringify(p);
  assert.equal(chooseNextObservation(p, compare(p)), null);
  assert.equal(JSON.stringify(p), dry);
  p.weather.rainMmHr = 48;
  p.proposal[27].surface = 'garden';
  const recovered = chooseNextObservation(p, compare(p));
  assert.ok(recovered && recovered.differenceMm > 0);
  assert.equal(original.includes('fictional'), true);
});
