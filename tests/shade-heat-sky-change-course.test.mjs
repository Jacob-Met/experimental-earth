import test from 'node:test';
import assert from 'node:assert/strict';
import {makeThreeEpochSkyExample} from '../shade-heat-three-epoch-example.js';
import {prepareSkyChangeEvidence,prepareSkyChangeSource,parseSkyChangeSource,serializeSkyChangeSource,inspectSkyChangeWork,SKY_CHANGE_LIMITS} from '../shade-heat-sky-change-course.js';
import {prepareThreeEpochSkySource} from '../shade-heat-three-epoch-course.js';
import {prepareSkyCourseTargetSource} from '../shade-heat-course-targets.js';
import {prepareSkyTargetConflictSource} from '../shade-heat-course-target-conflicts.js';
import {makeSkyCourseTargetExample} from '../shade-heat-course-target-example.js';
import {parseSkyChangeOriginals} from '../shade-heat-sky-change-inputs.js';
import {originalSkyReadingTimes,prepareTimedSkyReadingSource} from '../shade-heat-timed-reading-source.js';
import {createShadeHeatComputation} from '../shade-heat-computation.js';
import {rational as q,add,sub,cmp} from '../vendor/chronos/exact-halfplanes.mjs';
const query={bins:4,maximumChanges:2,sharingSource:'Authored common conditions across every original receiver',searchSource:'Explicit original-clock zero/one/two-change model comparison'};
let baseline;
const authored=()=>baseline??=prepareSkyChangeEvidence(makeThreeEpochSkyExample().readings,query);
const fraction=v=>[BigInt(v.exact.numerator),BigInt(v.exact.denominator)];
function shortOriginals(){
  const original=makeThreeEpochSkyExample().readings[0],source=structuredClone(original.source);
  Object.assign(source.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T04:19:37.000Z',stepMinutes:13});
  return [[0,'surfaceC'],[1,'subsurfaceC'],[2,'surfaceC']].map(([index,store])=>prepareTimedSkyReadingSource(source.project,source.declaration,{bins:4,
    reading:{...original.query.reading,utc:originalSkyReadingTimes(source)[index].utc,store,temperatureC:25,halfWidthC:100,source:'Authored broad bands on an unfamiliar short original clock'}}));
}
test('complete original thermal search finds the minimum class without receiving the authored change times',()=>{
  const raw=makeThreeEpochSkyExample(),before=JSON.stringify(raw),result=prepareSkyChangeEvidence(raw.readings,query);baseline=result;
  assert.equal(JSON.stringify(raw),before);const r=result.report;
  assert.equal(r.status,'compared');assert.equal(r.minimumChanges,2);assert.deepEqual(r.alternatives.map(a=>a.splitAfterIntervals),[[6,10]]);
  assert.equal(r.patterns.length,121);assert.equal(r.totalDeclaredPatterns,121);assert.equal(r.unexaminedHigherChangePatterns,0);
  assert.equal(result.investigation.readings.length,24);assert.equal(r.work.uniqueSources,3);assert.equal(r.originalTimes.length,17);
  assert.equal(r.work.executedThermalCourses,47580);assert.equal(r.work.executedWitnessCourses,12);assert.equal(r.work.reusedCompleteCourses,36588);
  assert.equal(r.work.geometryPasses,3);assert.equal(r.work.exactSolves,121);
  assert(r.work.linearRationalOperations>0&&r.work.linearRationalOperations<=SKY_CHANGE_LIMITS.maxLinearRationalOperations);
  assert.equal(r.patterns.filter(p=>p.compatibility==='compatible').length,1);
  assert(r.patterns.every(p=>p.numericalScreens.length===3&&p.numericalScreens.every(s=>s.combinations===4**(p.changes+1)&&s.originalBoundaryScreens.length===17&&s.maximumDiscrepancyC.upper<=1e-9)));
  const a=r.alternatives[0];assert.equal(a.originalObservations.length,24);
  for(const p of a.phaseProfiles)assert.equal(cmp(p.map(fraction).reduce(add,q(0)),q(1)),0);
  for(const row of a.originalObservations){const band=r.readings[row.recordIndex].bandC;assert(cmp(fraction(row.additiveC),fraction(band.lower))>=0&&cmp(fraction(row.additiveC),fraction(band.upper))<=0);}
  for(const replay of a.originalReplays){assert.equal(replay.originalCourse.length,17);assert(replay.maximumReplayResidualC.upper<=1e-9);assert.deepEqual(replay.originalCourse.map(({index,utc,minute,thermalMinute})=>({index,utc,minute,thermalMinute})),r.originalTimes);}
});
test('a static compatible short-clock class stops only after its complete class, and an impossible original band examines every declared pattern',()=>{
  const originals=shortOriginals(),good=prepareSkyChangeEvidence(originals,query).report;
  assert.equal(good.minimumChanges,0);assert.equal(good.patterns.length,1);assert.equal(good.totalDeclaredPatterns,2);assert.equal(good.unexaminedHigherChangePatterns,1);
  assert.deepEqual(good.alternatives.map(a=>a.splitAfterIntervals),[[]]);assert.equal(good.alternatives[0].phaseProfiles.length,1);
  assert.equal(good.originalTimes.at(-1).utc,'2026-06-21T04:19:37.000Z');assert.equal(good.originalTimes.at(-1).minute,19.4);
  originals[2].query.reading.temperatureC=400;originals[2].query.reading.halfWidthC=0;
  const bad=prepareSkyChangeEvidence(originals,query).report;
  assert.equal(bad.compatibility,'incompatible');assert.equal(bad.minimumChanges,null);assert.equal(bad.patterns.length,2);assert.equal(bad.alternatives.length,0);
  assert.equal(bad.unexaminedHigherChangePatterns,0);assert.equal(bad.work.executedWitnessCourses,0);assert.equal(bad.readings.length,3);
});
test('source-only own and prior inquiry intake preserves every original record while excluding prior chosen cuts and targets',()=>{
  const own=authored().investigation,text=serializeSkyChangeSource(own);
  assert.deepEqual(parseSkyChangeSource(text),own);assert.deepEqual(Object.keys(JSON.parse(text)),['kind','model','readings','query']);
  assert.deepEqual(parseSkyChangeOriginals([text]),{readings:own.readings,sharingSource:own.query.sharingSource,ownQuery:own.query});
  const three=makeThreeEpochSkyExample(),target=makeSkyCourseTargetExample();
  for(const source of [prepareThreeEpochSkySource(three.readings,three.query),prepareSkyCourseTargetSource(target.readings,target.query),prepareSkyTargetConflictSource(target.readings,target.query)]){
    const loaded=parseSkyChangeOriginals([JSON.stringify(source)]);assert.deepEqual(loaded.readings,source.readings);assert.equal(loaded.sharingSource,source.query.sharingSource);assert.equal(loaded.ownQuery,null);
    assert.deepEqual(Object.keys(loaded).sort(),['ownQuery','readings','sharingSource']);
  }
  assert.deepEqual(parseSkyChangeOriginals(three.readings.map(JSON.stringify)).readings,three.readings);
  for(const mutate of [s=>s.report={},s=>s.patterns=[],s=>s.query.splitAfterIntervals=[6,10],s=>s.query.maximumChanges=3,s=>s.query.maximumChanges=1.5,s=>s.query.searchSource=' ',s=>s.query.targets=[],s=>s.model.version=2,s=>s.readings.pop(),s=>s.readings[0].query.reading.witness={}]){
    const source=structuredClone(own);mutate(source);
    if(source.readings.length===23)assert.equal(parseSkyChangeSource(JSON.stringify(source)).readings.length,23);
    else assert.throws(()=>parseSkyChangeSource(JSON.stringify(source)));
  }
  assert.throws(()=>serializeSkyChangeSource({...own,report:{}}));assert.throws(()=>parseSkyChangeSource('['));
  assert.throws(()=>parseSkyChangeOriginals([text+' '.repeat(5*1024*1024)]),/5 MiB/);
});
test('the maximum original clock reserves all declared classes, every potential minimum-class profile and complete output before execution',()=>{
  const raw=makeThreeEpochSkyExample();for(const input of raw.readings)input.source.declaration.path.endUtc='2026-06-21T16:00:00.000Z';
  const work=inspectSkyChangeWork(raw.readings,query);
  assert.equal(work.intervals,24);assert.equal(work.declaredPatterns,277);assert.equal(work.reservedWitnessProfiles,253);
  assert.equal(work.reservedDistinctBasisCourses,112656);assert.equal(work.reservedWitnessCourses,3036);assert.equal(work.reservedThermalCourses,115692);
  assert.equal(work.reservedCourseIntervals,2776608);assert.equal(work.reservedReplayEndpointRows,18975);assert.equal(work.reservedObservationReplayRows,6072);
  assert.equal(work.reservedCacheEntriesPerReceiver,280);assert.equal(work.reservedLinearRationalOperations,24000000);assert.equal(work.maximumCompleteReportBytes,64*1024*1024);
  assert.equal(work.reservedThermalCourses,SKY_CHANGE_LIMITS.maxThermalCourses);
  const fixed=inspectSkyChangeWork(raw.readings,{...query,maximumChanges:0});assert.equal(fixed.declaredPatterns,1);assert.equal(fixed.reservedWitnessProfiles,1);
});
test('the complete actual result satisfies the unchanged maintained worker transport contract',async()=>{
  let terminated=0;const computation=createShadeHeatComputation(()=>{const worker={terminate(){terminated++;},postMessage(){queueMicrotask(()=>worker.onmessage({data:{ok:true,result:authored()}}));}};return worker;});
  assert.deepEqual(await computation.compute({operation:'prepare',originals:authored().investigation.readings,query}),authored());assert.equal(terminated,1);assert.equal(computation.pending,false);
});
