import test from 'node:test';
import assert from 'node:assert/strict';
import { makeThirdReceiverExample } from '../shade-heat-third-example.js';
import { prepareThirdReceiverSource, prepareThirdReceiverEvidence, parseThirdReceiverEvidence,
  THIRD_RECEIVER_LIMITS } from '../shade-heat-third-receiver.js';
import { prepareSkyBoundaryEvidence } from '../shade-heat-epoch-evidence.js';
import { buildBasis } from '../shade-heat-epoch-kernel.js';
import { intersectThreeRationalProfileBands } from '../shade-heat-profile-three-bands.js';
import { rational as q, cmp } from '../vendor/chronos/exact-halfplanes.mjs';

const exact = v => [BigInt(v.exact.numerator),BigInt(v.exact.denominator)];
const run = input => prepareThirdReceiverEvidence(input.readings,input.query);
const small = (splits=[8]) => { const i=makeThirdReceiverExample();i.query.splitAfterIntervals=splits;return i; };

test('The third original receiver excludes four offered alternatives while preserving every leading-two report',()=>{
  const input=makeThirdReceiverExample(),saved=JSON.stringify(input),r=run(input).report;
  const before=prepareSkyBoundaryEvidence(input.readings.slice(0,2),input.query).report;
  assert.deepEqual(r.firstTwoCompatibleBoundaries,[8,9,10,11,12]);assert.deepEqual(r.compatibleBoundaries,[8]);
  assert.deepEqual(r.excludedByThird,[9,10,11,12]);assert.equal(r.boundaries.length,15);
  assert.deepEqual(r.boundaries.map(b=>b.firstTwo),before.boundaries);assert.deepEqual(r.firstTwoRanges,before.ranges);
  assert.equal(r.boundaries[7].work.profileIntersection.candidates,78);
  assert.deepEqual(r.boundaries[7].witnesses.map(w=>w.id),[2,30]);
  assert.equal(r.work.executedBasisCourses,2208);assert.equal(r.work.reusedCompleteBasisCourses,672);
  assert.equal(r.work.executedJointWitnessCourses,24);assert.equal(r.work.executedPriorWitnessCourses,120);
  assert.equal(r.work.executedThermalCourses,2352);assert.equal(r.work.geometryPasses,3);
  assert.equal(r.work.jointIntersectionsExcludedByLeadingTwo,10);assert.equal(JSON.stringify(input),saved);
  for(const store of ['surfaceC','subsurfaceC'])for(const bound of ['lower','upper']) {
    const e=r.ranges[store][bound],b=r.boundaries[e.boundaryIndex],w=b.witnesses.find(w=>w.id===e.witnessId);
    assert.equal(b.query.splitAfterInterval,e.splitAfterInterval);assert.equal(e.splitAfterInterval,8);assert.ok(w);
    assert.deepEqual(w.differenceC[store][bound==='lower'?0:1],e.differenceC);
    const order=cmp(exact(e.differenceC),exact(r.firstTwoRanges[store][bound].differenceC));
    assert.ok(bound==='lower'?order>=0:order<=0);
  }
});

test('An already empty leading-two family proves joint emptiness without omitting the third complete basis',()=>{
  const input=small([1]),r=run(input).report,b=r.boundaries[0];
  assert.equal(b.firstTwo.compatibility,'incompatible');assert.equal(b.compatibility,'incompatible');
  assert.equal(b.work.profileIntersection.emptyByLeadingTwoSubset,true);assert.equal(b.numericalEvidence.points.length,3);
  assert.equal(r.work.completeBasisCourses,192);assert.equal(r.work.executedBasisCourses,192);
  const bases=input.readings.map(reading=>buildBasis(reading,1));
  const raw=intersectThreeRationalProfileBands(bases.map(b=>b.coefficients.map(v=>v.final.existing.lower.surfaceC)),
    input.readings.map(i=>({temperatureC:i.query.reading.temperatureC,halfWidthC:i.query.reading.halfWidthC})));
  assert.equal(raw.status,'incompatible');assert.deepEqual(raw.candidates,[]);
});

test('A wide third original band preserves the exact leading-two consequence bounds',()=>{
  const input=small([8,12]);input.readings[2].query.reading.halfWidthC=100;
  const r=run(input).report;assert.deepEqual(r.compatibleBoundaries,[8,12]);assert.deepEqual(r.excludedByThird,[]);
  for(const b of r.boundaries)for(const store of ['surfaceC','subsurfaceC'])for(const bound of ['lower','upper'])
    assert.deepEqual(b.ranges[store][bound].differenceC,b.firstTwo.ranges[store][bound].differenceC);
});

test('An inconsistent third band retains the compatible first-two comparison and every original input',()=>{
  const input=small([9,8]);input.readings[2].query.reading.temperatureC=50;
  const {investigation,report:r}=run(input);assert.equal(r.compatibility,'incompatible');assert.equal(r.ranges,null);
  assert.deepEqual(r.firstTwoCompatibleBoundaries,[9,8]);assert.deepEqual(r.excludedByThird,[9,8]);
  assert.ok(r.firstTwoRanges);assert.equal(investigation.readings.length,3);
  assert.deepEqual(investigation.query.splitAfterIntervals,[9,8]);
});

test('Strict source-only fresh parsing preserves the original3 readings and reruns a new private inquiry',()=>{
  const input=small(),first=run(input),second=parseThirdReceiverEvidence(JSON.stringify(first.investigation));
  assert.deepEqual(second,first);assert.equal(second.report.work.geometryPasses,3);
  first.report.boundaries[0].numericalEvidence.points[2].pairs[0].originalFinalC.existing.lower.surfaceC=-999;
  assert.deepEqual(run(input),second);
  for(const raw of [{...input,report:{}},{...input,reuse:{}},{...input,model:{...input.model,arithmetic:'relaxed'}},
    {...input,readings:input.readings.slice(0,2)}])assert.throws(()=>parseThirdReceiverEvidence(JSON.stringify(raw)));
});

test('Source identity, distinctness, missing members and every offered boundary admit before any result',()=>{
  const base=small();
  for(const originals of [[base.readings[0],,base.readings[2]],[...base.readings,base.readings[0]],
    [base.readings[0],base.readings[1],base.readings[1]]])assert.throws(()=>prepareThirdReceiverSource(originals,base.query));
  const shifted=structuredClone(base);shifted.readings[2].source.declaration.diffuseHorizontalWm2+=1;
  assert.throws(()=>run(shifted),/agree exactly/);
  const forged=structuredClone(base);forged.readings[2].report={};assert.throws(()=>run(forged));
  for(const splits of [[1,,8],[8,8],[],[16],[0],[1.5],Array.from({length:24},(_,i)=>i+1)])
    assert.throws(()=>prepareThirdReceiverSource(base.readings,{...base.query,splitAfterIntervals:splits}));
});

test('Zero-effect ties retain the first supplied boundary and exact zero consequences',()=>{
  const input=small([9,3,8]);input.readings.forEach(r=>{
    r.source.declaration.diffuseHorizontalWm2=0;r.source.declaration.directNormalWm2=0;
    r.query.reading.temperatureC=20;r.query.reading.halfWidthC=0;
  });
  const r=run(input).report;assert.deepEqual(r.compatibleBoundaries,[9,3,8]);
  for(const store of ['surfaceC','subsurfaceC'])for(const bound of ['lower','upper']) {
    assert.equal(r.ranges[store][bound].splitAfterInterval,9);assert.equal(cmp(exact(r.ranges[store][bound].differenceC),q(0)),0);
  }
});

test('Every complete3-receiver24-interval course fits the actual23-boundary maximum',()=>{
  const input=small(Array.from({length:23},(_,i)=>i+1));
  input.readings.forEach(reading=>{
    reading.source.declaration.path.endUtc='2026-06-21T16:00:00.000Z';reading.query.reading.utc='2026-06-21T16:00:00.000Z';
    reading.query.reading.temperatureC=50;
  });
  const r=run(input).report;assert.equal(r.intervalCount,24);assert.equal(r.boundaries.length,23);
  assert.equal(r.compatibility,'incompatible');assert.equal(r.work.completeBasisCourses,4416);
  assert.equal(r.work.executedBasisCourses,3360);assert.equal(r.work.reusedCompleteBasisCourses,1056);
  assert.equal(r.work.executedCourseIntervals,80640);assert.equal(r.work.reservedCourseIntervals,124800);
  assert.equal(r.work.reservedThermalCourses,THIRD_RECEIVER_LIMITS.maxCourses);assert.equal(r.work.reservedThermalCourses,5200);
  assert.equal(r.work.reservedCandidates,575736);assert.equal(r.work.jointIntersectionsExcludedByLeadingTwo,23);
});
