import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSkyBoundaryExample } from '../shade-heat-boundary-example.js';
import { prepareEpochSkyEvidence, prepareSkyBoundarySource, prepareSkyBoundaryEvidence,
  parseSkyBoundaryEvidence, SKY_BOUNDARY_LIMITS } from '../shade-heat-epoch-evidence.js';
import { cmp } from '../vendor/chronos/exact-halfplanes.mjs';
const raw = makeSkyBoundaryExample(), before = JSON.stringify(raw);
const complete = prepareSkyBoundaryEvidence(raw.readings, raw.query);
const fraction = value => [BigInt(value.exact.numerator), BigInt(value.exact.denominator)];
const numeric = report => { const { work, ...rest } = report; return rest; };
const single = (input, split) => prepareEpochSkyEvidence(input.readings, { bins:4,
  splitAfterInterval:split, sharingSource:input.query.sharingSource }).report;

test('all fifteen original alternatives complete with shared work and five compatible boundaries', () => {
  const r = complete.report;
  assert.equal(r.status, 'compared'); assert.equal(r.boundaries.length,15);
  assert.deepEqual(r.compatibleBoundaries,[8,9,10,11,12]);
  assert.deepEqual(r.boundaries.map(b=>b.query.splitAfterInterval),raw.query.splitAfterIntervals);
  assert.equal(r.work.geometryPasses,2); assert.equal(r.work.completeBasisCourses,1920);
  assert.equal(r.work.executedBasisCourses,1472); assert.equal(r.work.reusedCompleteBasisCourses,448);
  assert.equal(r.work.executedWitnessCourses,120); assert.equal(r.work.executedThermalCourses,1592);
  assert.equal(r.work.reservedThermalCourses,1952); assert.equal(r.work.reservedCourseIntervals,31232);
  assert.equal(r.ranges.subsurfaceC.lower.splitAfterInterval,9);
  assert.equal(r.ranges.surfaceC.lower.splitAfterInterval,11);
  assert.equal(JSON.stringify(raw),before);
});

test('every complete per-boundary numeric report matches its independent single inquiry', () => {
  for (const report of complete.report.boundaries) assert.deepEqual(numeric(report),numeric(single(raw,report.query.splitAfterInterval)));
  const reversed = makeSkyBoundaryExample(); reversed.readings.reverse(); reversed.query.splitAfterIntervals=[13,3,8];
  const r = prepareSkyBoundaryEvidence(reversed.readings,reversed.query).report;
  assert.deepEqual(r.boundaries.map(b=>b.query.splitAfterInterval),[13,3,8]);
  for (const report of r.boundaries) assert.deepEqual(numeric(report),numeric(single(reversed,report.query.splitAfterInterval)));
});

test('exact union bounds retain the original boundary and its correct component witness', () => {
  const r = complete.report;
  for (const field of ['surfaceC','subsurfaceC']) for (const [side,bound] of ['lower','upper'].entries()) {
    const range=r.ranges[field][bound], source=r.boundaries[range.boundaryIndex];
    assert.equal(source.query.splitAfterInterval,range.splitAfterInterval); assert.equal(source.splitUtc,range.splitUtc);
    const witness=source.witnesses.find(w=>w.id===range.witnessId); assert.ok(witness);
    assert.equal(cmp(fraction(range.differenceC),fraction(witness.differenceC[field][side])),0);
    for (const candidate of r.boundaries.filter(b=>b.compatibility==='compatible')) {
      const order=cmp(fraction(range.differenceC),fraction(candidate.ranges[field][bound].differenceC));
      assert.ok(side===0?order<=0:order>=0);
    }
  }
});

test('a static-compatible original control remains compatible at every offered boundary', () => {
  const input=makeSkyBoundaryExample(), basis=complete.report.boundaries[0].numericalEvidence.points;
  input.readings.forEach((reading,i)=>{reading.query.reading.temperatureC=basis[i].pairs[0].originalFinalC.existing.lower.surfaceC;reading.query.reading.halfWidthC=.001;});
  const r=prepareSkyBoundaryEvidence(input.readings,input.query).report;
  assert.deepEqual(r.compatibleBoundaries,input.query.splitAfterIntervals);
  r.boundaries.forEach(report=>{assert.equal(report.originalStatic.compatibility,'compatible');assert.equal(report.additiveStatic.compatibility,'compatible');});
});

test('exactly tied consequences retain the first supplied boundary without ordering it by time', () => {
  const input=makeSkyBoundaryExample(); input.query.splitAfterIntervals=[10,8,9];
  input.readings.forEach(reading=>{reading.source.project.solarStudy.proposal=structuredClone(reading.source.project.solarStudy.existing);});
  const r=prepareSkyBoundaryEvidence(input.readings,input.query).report;
  assert.equal(r.compatibleBoundaries.length,3);
  for(const field of ['surfaceC','subsurfaceC']) for(const bound of ['lower','upper']) {
    assert.equal(r.ranges[field][bound].splitAfterInterval,10);
    assert.equal(r.ranges[field][bound].differenceC.exact.numerator,'0');
  }
});

test('incompatible offered boundaries retain all complete bases and no invented range', () => {
  const input=makeSkyBoundaryExample();input.query.splitAfterIntervals=[13,3,8];input.readings[1].query.reading.temperatureC=50;
  const result=prepareSkyBoundaryEvidence(input.readings,input.query),r=result.report;
  assert.equal(r.compatibility,'incompatible');assert.equal(r.ranges,null);assert.deepEqual(r.compatibleBoundaries,[]);
  assert.equal(r.boundaries.length,3);assert.equal(r.work.completeBasisCourses,384);
  assert.equal(r.work.executedBasisCourses,320);assert.equal(r.work.reusedCompleteBasisCourses,64);
  assert.equal(r.work.executedWitnessCourses,0);r.boundaries.forEach(b=>assert.equal(b.compatibility,'incompatible'));
  assert.deepEqual(parseSkyBoundaryEvidence(JSON.stringify(result.investigation)),result);
});

test('sparse, missing, repeated, unoriginal or over-capacity offers refuse as a whole', () => {
  const invalid=[[],[1,,2],[1,,],[,1,2],Array(3),[1,undefined,2],[1,1],[0,8],[1.5],[16],[Infinity],Array.from({length:24},(_,i)=>i+1)];
  for(const splitAfterIntervals of invalid) assert.throws(()=>prepareSkyBoundarySource(raw.readings,{...raw.query,splitAfterIntervals}),/dense list|original interval boundary/);
  assert.throws(()=>prepareSkyBoundarySource(raw.readings,{...raw.query,bins:8}),/dense list/);
  assert.throws(()=>prepareSkyBoundarySource(raw.readings,{...raw.query,splitUtc:'2026-06-21T08:00:00Z'}),/dense list/);
  assert.throws(()=>prepareSkyBoundarySource(raw.readings,{...raw.query,sharingSource:' '}),/shared conditions/);
});

test('source-only reopening preserves all originals and never adopts saved results or changed models', () => {
  assert.deepEqual(Object.keys(complete.investigation),['kind','model','readings','query']);
  assert.deepEqual(parseSkyBoundaryEvidence(JSON.stringify(complete.investigation)),complete);
  for(const mutate of [value=>{value.report={};},value=>{value.model.version=2;},value=>{value.query.splitAfterIntervals[1]=null;},
    value=>{value.readings[1].source.declaration.directNormalWm2+=1;},value=>{value.readings[1].query.reading.target='proposal';}]) {
    const input=structuredClone(complete.investigation);mutate(input);assert.throws(()=>parseSkyBoundaryEvidence(JSON.stringify(input)));
  }
  const input=makeSkyBoundaryExample();input.query.splitAfterIntervals=[8];
  const first=prepareSkyBoundaryEvidence(input.readings,input.query);first.report.boundaries[0].numericalEvidence.points[0].pairs[0].originalFinalC.existing.lower.surfaceC=-999;
  assert.deepEqual(numeric(prepareSkyBoundaryEvidence(input.readings,input.query).report.boundaries[0]),numeric(single(input,8)));
});

test('the largest original24-interval list reserves and completes the whole bounded query', () => {
  const input=makeSkyBoundaryExample();input.query.splitAfterIntervals=Array.from({length:23},(_,i)=>i+1);
  input.readings.forEach(reading=>{reading.source.declaration.path.endUtc='2026-06-21T16:00:00.000Z';reading.query.reading.utc='2026-06-21T16:00:00.000Z';reading.query.reading.temperatureC=50;});
  const r=prepareSkyBoundaryEvidence(input.readings,input.query).report;
  assert.equal(r.intervalCount,24);assert.equal(r.boundaries.length,23);assert.equal(r.compatibility,'incompatible');
  assert.equal(r.work.completeBasisCourses,2944);assert.equal(r.work.executedBasisCourses,2240);
  assert.equal(r.work.reservedWitnessCourses,736);assert.equal(r.work.reservedThermalCourses,2976);
  assert.equal(r.work.reservedCourseIntervals,71424);assert.equal(r.work.executedCourseIntervals,53760);
  assert.equal(r.work.reservedThermalCourses,SKY_BOUNDARY_LIMITS.maxCourses);
});
