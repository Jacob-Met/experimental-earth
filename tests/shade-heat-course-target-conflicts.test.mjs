import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSkyTargetConflictSource,prepareSkyTargetConflictEvidence,parseSkyTargetConflictSource,parseSkyTargetConflictEvidence,serializeSkyTargetConflictSource,inspectSkyTargetConflictWork,SKY_TARGET_CONFLICT_LIMITS} from '../shade-heat-course-target-conflicts.js';
import {prepareSkyCourseTargetEvidence} from '../shade-heat-course-targets.js';
import {makeSkyCourseTargetExample} from '../shade-heat-course-target-example.js';
import {verifyThreeEpochTargetLinearCertificate} from '../shade-heat-exact-linear.js';
import {createShadeHeatComputation} from '../shade-heat-computation.js';
import {rational as q,sub,cmp} from '../vendor/chronos/exact-halfplanes.mjs';
import {prepareSolarStudy} from '../solar-occlusion.js';
import {prepareSurfaceHeatStudy} from '../surface-heat.js';
import {prepareHeatColumnStudy} from '../heat-column.js';
const ZERO=q(0),decode=v=>[BigInt(v[0]),BigInt(v[1])],exact=v=>[BigInt(v.exact.numerator),BigInt(v.exact.denominator)];
const run=s=>prepareSkyTargetConflictEvidence(s.readings,s.query);let baseline;
const authored=()=>baseline??=run(makeSkyCourseTargetExample());

test('the complete32-target consumer isolates a necessary pair and numerically replays both removal profiles through every original receiver/time',()=>{
 const raw=makeSkyCourseTargetExample(),before=JSON.stringify(raw),value=run(raw);baseline=value;
 assert.equal(JSON.stringify(raw),before);const r=value.report,c=r.conflict;
 assert.equal(r.status,'compared');assert.equal(r.observationCompatibility,'compatible');assert.equal(r.targetCompatibility,'incompatible');assert.deepEqual(c.targetIndices,[13,30]);
 assert.equal(r.targets.length,32);assert.equal(c.removalWitnesses.length,2);assert.equal(r.work.executedConflictWitnessCourses,24);
 assert.equal(r.work.executedThermalCourses,r.originalTargetMargin.work.executedThermalCourses+24);
 assert.equal(r.work.executedThermalCourses,864);assert(r.work.conflictFeasibility.rationalOperations<4000000);
 const e=r.exactEvidence.analysis.conflict,proof={...e.certificate,dual:e.certificate.dual.map(decode),contradiction:decode(e.certificate.contradiction)};
 assert(verifyThreeEpochTargetLinearCertificate(e.linearModel.rows.map(row=>row.map(decode)),e.linearModel.bounds.map(decode),null,proof));
 for(const w of c.removalWitnesses){
  assert.equal(w.witness.originalObservations.length,24);assert.equal(w.witness.originalReplays.length,3);assert(w.witness.originalReplays.every(p=>p.originalCourse.length===17));
  assert.equal(w.targets.length,32);assert.deepEqual(w.requiredTargetIndices,c.targetIndices.filter(i=>i!==w.removedTargetIndex));
  w.targets.forEach((t,i)=>{
   assert.equal(t.originalIndex,raw.query.targets[i].originalIndex);assert.equal(t.store,raw.query.targets[i].store);assert.equal(t.maximumDifferenceC,raw.query.targets[i].maximumDifferenceC);
   assert.equal(t.utc,r.originalTimes[t.originalIndex].utc);assert.equal(t.removedHere,i===w.removedTargetIndex);assert.equal(t.requiredAfterRemoval,w.requiredTargetIndices.includes(i));
   if(t.requiredAfterRemoval)assert(t.withinDeclaredCeiling);if(t.removedHere)assert(cmp(exact(t.excessC),ZERO)>0);
   const p=w.witness.originalReplays[0].originalCourse[t.originalIndex];assert.equal(cmp(exact(t.differenceC),sub(exact(p.additiveC.proposal.lower[t.store]),exact(p.additiveC.existing.lower[t.store]))),0);
   for(const side of ['lower','upper'])assert.equal(t.originalReplay.endpointStatus[side],cmp(exact(t.originalReplay.differenceC[side]),q(t.maximumDifferenceC))<=0?'within-authored-ceiling':'above-authored-ceiling');
  });
 }
 assert.deepEqual(r.originalTargetMargin,prepareSkyCourseTargetEvidence(raw.readings,raw.query).report);
});

test('the complete conflict result passes the maintained worker transport contract without broadening its validation gate',async()=>{
 let terminated=0;
 const computation=createShadeHeatComputation(()=>{
  const worker={terminate(){terminated++;},postMessage(){queueMicrotask(()=>worker.onmessage({data:{ok:true,result:authored()}}));}};return worker;
 });
 assert.deepEqual(await computation.compute({operation:'prepare',originals:authored().investigation.readings,query:authored().investigation.query}),authored());
 assert.equal(terminated,1);assert.equal(computation.pending,false);
});

test('raising only desired ceilings removes the conflict and reuses the fully replayed compatible common profile',()=>{
 const raw=makeSkyCourseTargetExample();raw.query.targets.forEach(t=>{t.maximumDifferenceC+=.0002;});const value=run(raw),r=value.report;
 assert.equal(r.targetCompatibility,'compatible');assert.equal(r.conflict,null);assert.equal(r.work.executedConflictWitnessCourses,0);
 assert.equal(r.work.conflictFeasibility.feasibilitySolves,1);assert.equal(r.work.conflictFeasibility.verifiedInitialCertificates,1);
 assert.deepEqual(value.investigation.readings,authored().investigation.readings);assert.deepEqual(r.originalTargetMargin.original,authored().report.originalTargetMargin.original);
 assert(r.originalTargetMargin.targets.every(t=>t.withinDeclaredCeiling));
});

test('an incompatible final original observation withholds all target conflict/removal claims',()=>{
 const raw=makeSkyCourseTargetExample();raw.readings[23].query.reading.temperatureC=400;const r=run(raw).report;
 assert.equal(r.observationCompatibility,'incompatible');assert.equal(r.targetCompatibility,'not-evaluated-original-incompatible');
 assert.equal(r.originalTargetMargin.original.firstThree.compatibility,'compatible');assert.equal(r.conflict,null);assert.equal(r.exactEvidence,null);
 assert.equal(r.work.conflictFeasibility,null);assert.equal(r.work.executedConflictWitnessCourses,0);assert.equal(r.targets.length,32);
});

test('an impossible initial target has one necessary member while its removal retains the complete original observations',()=>{
 const raw=makeSkyCourseTargetExample();raw.query.targets=[{originalIndex:0,store:'surfaceC',maximumDifferenceC:-.01}];const r=run(raw).report;
 assert.deepEqual(r.conflict.targetIndices,[0]);const w=r.conflict.removalWitnesses[0];assert.deepEqual(w.requiredTargetIndices,[]);
 assert.equal(w.witness.originalObservations.length,24);assert.equal(w.targets[0].utc,r.originalTimes[0].utc);
 assert.equal(cmp(exact(w.targets[0].differenceC),ZERO),0);assert(cmp(exact(w.targets[0].excessC),ZERO)>0);
 assert.equal(r.work.executedConflictWitnessCourses,12);assert.equal(r.exactEvidence.analysis.conflict.initialSupport.length,1);
});

test('only complete source inputs reopen, derived conflict/witness data cannot be smuggled into the inquiry',()=>{
 const value=authored(),text=serializeSkyTargetConflictSource(value.investigation);
 assert.deepEqual(parseSkyTargetConflictSource(text),value.investigation);assert.deepEqual(parseSkyTargetConflictEvidence(text),value);
 for(const change of [s=>{s.report={};},s=>{s.conflict={targetIndices:[0]};},s=>{s.query.initialCertificate={};},s=>{s.query.targets[0].witness={};},s=>{s.query.targets.push(s.query.targets[0]);},s=>{s.query.targetSource=' ';},s=>{s.model.version=2;}]){
  const s=structuredClone(value.investigation);change(s);assert.throws(()=>parseSkyTargetConflictSource(JSON.stringify(s)));
 }
 assert.throws(()=>serializeSkyTargetConflictSource({...value.investigation,report:value.report}));
});

test('the complete50-target preflight reserves all potential removal profiles before geometry or thermal evaluation',()=>{
 const input=makeSkyCourseTargetExample();input.readings.forEach(r=>{r.source.declaration.path.endUtc='2026-06-21T16:00:00.000Z';});
 input.query.targets=Array.from({length:25},(_,originalIndex)=>['surfaceC','subsurfaceC'].map(store=>({originalIndex,store,maximumDifferenceC:0}))).flat();
 const work=inspectSkyTargetConflictWork(input.readings,input.query);
 assert.equal(work.reservedThermalCourses,2580);assert.equal(work.courseIntervals,61920);assert.equal(work.reservedWitnessProfiles,151);
 assert.equal(work.maxConflictFeasibilitySolves,52);assert.equal(work.maxLinearRationalOperations,24000000);
 assert.equal(work.courseIntervals,SKY_TARGET_CONFLICT_LIMITS.maxCourseIntervals);
});

test('a large admitted conflict source stays downloadable when pretty formatting crosses the source byte allowance',()=>{
 const raw=makeSkyCourseTargetExample();for(const input of raw.readings){
  const p=input.source.project,heat=p.surfaceHeatStudy,lower=p.heatColumnStudy.lowerLayers,solar=p.solarStudy;p.width=p.height=20;
  for(const kind of ['existing','proposal'])p[kind]=Array.from({length:400},(_,i)=>({...p[kind][i%16],provenance:'Authored original grid cell with unchanged geometry.'}));
  p.solarStudy=prepareSolarStudy(p,solar);delete p.heatColumnStudy;p.surfaceHeatStudy=prepareSurfaceHeatStudy(p,heat);p.heatColumnStudy=prepareHeatColumnStudy(p,lower);
 }
 const source=prepareSkyTargetConflictSource(raw.readings,raw.query),compact=JSON.stringify(source),pretty=JSON.stringify(source,null,2)+'\n';
 assert(new Blob([compact]).size<5*1024*1024);assert(new Blob([pretty]).size>5*1024*1024);
 assert.throws(()=>parseSkyTargetConflictSource(pretty),/5 MiB/);assert.equal(serializeSkyTargetConflictSource(source),compact);assert.deepEqual(parseSkyTargetConflictSource(compact),source);
});
