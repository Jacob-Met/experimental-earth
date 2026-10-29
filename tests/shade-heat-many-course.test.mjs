import test from 'node:test';
import assert from 'node:assert/strict';
import {makeManySkyExample} from '../shade-heat-many-example.js';
import {makeTimedSkyExample} from '../shade-heat-timed-example.js';
import {prepareManySkyCourseEvidence,prepareManySkyCourseSource,parseManySkyCourseEvidence,parseManySkyCourseSource,MANY_SKY_COURSE_LIMITS} from '../shade-heat-many-course.js';
import {prepareTimedSkyCourseEvidence} from '../shade-heat-timed-course.js';
import {prepareTimedSkyReadingSource} from '../shade-heat-timed-reading-source.js';
import {buildOriginalBoundaryBasis} from '../shade-heat-epoch-kernel.js';
import {verifyRationalLinearCertificate} from '../shade-heat-exact-linear.js';
import {parseManyOriginals} from '../shade-heat-many-inputs.js';
import {rational as q,add,sub,neg,cmp} from '../vendor/chronos/exact-halfplanes.mjs';

const exact=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
const restore=value=>Array.isArray(value)?(value.length===2&&value.every(x=>typeof x==='string'&&/^-?\d+$/.test(x))
  ?value.map(BigInt):value.map(restore)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,restore(v)])):value;
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};
const run=source=>prepareManySkyCourseEvidence(source.readings,source.query);
const input=freeze(makeManySkyExample()),before=JSON.stringify(input),full=run(input);
const width=row=>sub(exact(row.ranges.surfaceC.upper.differenceC),exact(row.ranges.surfaceC.lower.differenceC));

test('24 complete records constrain three original receiver sources with a narrower leading-three reference',()=>{
  const r=full.report;assert.equal(r.compatibility,'compatible');assert.equal(r.readings.length,24);
  assert.equal(r.work.uniqueSources,3);assert.equal(r.work.executedBasisCourses,192);
  assert.deepEqual(r.work.sources.map(x=>x.recordIndex),[0,3,5]);
  assert.deepEqual(r.readings.map(x=>[x.cellIndex,x.utc,x.store,x.temperatureC,x.halfWidthC,x.source]),
    input.readings.map(x=>{const r=x.query.reading;return [r.cellIndex,r.utc,r.store,r.temperatureC,r.halfWidthC,r.source];}));
  assert(cmp(width(r.firstThree.pointwiseCourse[4]),q(.012))>0);
  assert(cmp(width(r.pointwiseCourse[4]),q(.00102))<0);
  for(const row of r.pointwiseCourse)for(const store of ['surfaceC','subsurfaceC'])for(const bound of ['lower','upper']){
    const order=cmp(exact(row.ranges[store][bound].differenceC),exact(r.firstThree.pointwiseCourse[row.index].ranges[store][bound].differenceC));
    assert(bound==='lower'?order>=0:order<=0);
  }
  assert.deepEqual(r.rangeChanges,{narrowed:32,unchanged:2});assert.equal(JSON.stringify(input),before);
});

test('each displayed fixed profile replays complete unique sources and binds every distinct original observation',()=>{
  const r=full.report;assert(r.witnesses.length>0);
  for(const witness of r.witnesses){
    assert.equal(witness.originalReplays.length,3);assert.equal(witness.originalObservations.length,24);
    for(const phase of witness.phaseProfiles)assert.equal(cmp(phase.map(exact).reduce(add,q(0)),q(1)),0);
    for(const [index,observation] of witness.originalObservations.entries()){
      const reading=r.readings[index],replay=witness.originalReplays[reading.sourceIndex];
      assert.deepEqual([observation.cellIndex,observation.utc,observation.store,observation.originalIndex],
        [reading.cellIndex,reading.utc,reading.store,reading.originalIndex]);
      assert.equal(replay.originalCourse.length,17);const row=replay.originalCourse[reading.originalIndex];
      assert.equal(row.utc,reading.utc);assert.equal(cmp(exact(row.additiveC.existing.lower[reading.store]),exact(witness.observedC[index])),0);
      assert(cmp(exact(witness.observedC[index]),exact(reading.bandC.lower))>=0);
      assert(cmp(exact(witness.observedC[index]),exact(reading.bandC.upper))<=0);
      for(const bound of ['lower','upper']){
        assert.equal(observation.originalC[bound],row.originalC.existing[bound][reading.store]);
        const value=q(observation.originalC[bound]),within=cmp(value,exact(reading.bandC.lower))>=0&&cmp(value,exact(reading.bandC.upper))<=0;
        assert.equal(observation.endpointStatus[bound],within?'within-original-band':'outside-original-band');
      }
    }
  }
  assert.equal(r.work.actualObservationReplayRows,r.witnesses.length*24);
  assert.equal(r.work.executedWitnessCourses,r.witnesses.length*3*4);
});

test('every serialized bound certificate verifies against original inequalities and binds its objective, range and witness',()=>{
  const r=full.report;
  for(const [name,course] of [['all',r.pointwiseCourse],['firstThree',r.firstThree.pointwiseCourse]]){
    const evidence=restore(r.exactEvidence[name]),{rows,bounds}=evidence.linearModel;
    assert(verifyRationalLinearCertificate(rows,bounds,null,evidence.certificate));
    assert.equal(evidence.objectives.length,68);
    evidence.objectives.forEach((objective,index)=>{
      assert(verifyRationalLinearCertificate(rows,bounds,objective.projection.coefficients,objective.certificate));
      assert.equal(cmp(add(objective.projection.constant,objective.certificate.value),objective.maximumValue),0);
      const range=course[objective.originalIndex].ranges[objective.store][objective.side];assert.equal(range.proofIndex,index);
      assert.equal(cmp(exact(range.differenceC),objective.side==='lower'?neg(objective.maximumValue):objective.maximumValue),0);
      if(name==='all'){
        const witness=r.witnesses.find(w=>w.id===range.witnessId),row=witness.originalReplays[0].originalCourse[objective.originalIndex];
        const value=sub(exact(row.additiveC.proposal[objective.side][objective.store]),
          exact(row.additiveC.existing[objective.side==='lower'?'upper':'lower'][objective.store]));
        assert.equal(cmp(value,exact(range.differenceC)),0);
      }
    });
  }
});

test('the three-record specialization matches all accepted exact bounds while sharing identical complete sources',()=>{
  const s=makeTimedSkyExample(),legacy=prepareTimedSkyCourseEvidence(s.readings,s.query),current=run(s);
  assert.equal(current.report.work.executedBasisCourses,64);
  assert.deepEqual(current.investigation.readings,legacy.investigation.readings);
  for(const row of current.report.pointwiseCourse)for(const store of ['surfaceC','subsurfaceC'])for(const bound of ['lower','upper']){
    assert.deepEqual(row.ranges[store][bound].differenceC,legacy.report.pointwiseCourse[row.index].ranges[store][bound].differenceC);
    assert.deepEqual(row.ranges[store][bound].differenceC,current.report.firstThree.pointwiseCourse[row.index].ranges[store][bound].differenceC);
  }
  assert.deepEqual(current.report.rangeChanges,{narrowed:0,unchanged:34});
});

test('extra records may add no gain, but a contradictory final record rejects the whole family without removing prior evidence',()=>{
  const s=makeManySkyExample(),twelve=run({...s,readings:s.readings.slice(0,12)});
  assert.equal(cmp(width(twelve.report.pointwiseCourse[4]),width(full.report.pointwiseCourse[4])),0);
  s.readings[23].query.reading.temperatureC=400;
  const rejected=run(s).report;assert.equal(rejected.compatibility,'incompatible');assert.equal(rejected.firstThree.compatibility,'compatible');
  assert.equal(rejected.readings.length,24);assert.equal(rejected.work.executedBasisCourses,192);
  assert.equal(rejected.work.executedWitnessCourses,0);assert.deepEqual(rejected.witnesses,[]);
  assert(rejected.pointwiseCourse.every(row=>row.ranges===null));
  assert.deepEqual(rejected.firstThree.pointwiseCourse,full.report.firstThree.pointwiseCourse);
  const proof=restore(rejected.exactEvidence.all);
  assert(verifyRationalLinearCertificate(proof.linearModel.rows,proof.linearModel.bounds,null,proof.certificate));
  assert(proof.certificate.contradiction[0]<0n);
});

test('source-only saved and multi-file intakes retain all24 bands and original bin histories without adopting prior boundaries',()=>{
  const s=makeManySkyExample();s.readings.forEach((r,i)=>{r.query.bins=[4,16,8][i%3];});
  const accepted=run(s),text=JSON.stringify(accepted.investigation);
  assert.deepEqual(parseManySkyCourseEvidence(text),accepted);
  assert.deepEqual(parseManyOriginals([text]),{readings:accepted.investigation.readings,sharingSource:s.query.sharingSource});
  assert.deepEqual(parseManyOriginals(s.readings.map(JSON.stringify)),{readings:accepted.investigation.readings,sharingSource:null});
  for(const change of [x=>{x.report={};},x=>{x.model.version=2;},x=>{x.query.result={};},x=>{x.kind='other';}]){
    const bad=structuredClone(accepted.investigation);change(bad);assert.throws(()=>parseManySkyCourseSource(JSON.stringify(bad)));
  }
  for(const texts of [[],['{}','{}'],Array(25).fill('{}'),Array(3),['broken']])assert.throws(()=>parseManyOriginals(texts));
});

test('malformed, duplicate, conflicting and excessive original records refuse as a complete inquiry',()=>{
  for(const change of [
    s=>{s.readings[23]=structuredClone(s.readings[0]);},
    s=>{s.readings[23].source.project.heatColumnStudy.lowerLayers.existing.capacityJm2K*=2;},
    s=>{s.readings[23].query.reading.utc='2026-06-21T06:01:00.000Z';},
    s=>{s.readings[23].query.reading.aggregation='interval-mean';},
    s=>{s.readings[23].query.reading.source='';},
    s=>{s.readings[23].source.declaration.reservoirC+=1;},
    s=>{s.readings.push(structuredClone(s.readings[0]));},s=>{s.readings=s.readings.slice(0,2);},
    s=>{delete s.readings[23];},s=>{s.query.bins=8;},s=>{s.query.splitAfterInterval=16;}
  ]){const s=makeManySkyExample();change(s);assert.throws(()=>prepareManySkyCourseSource(s.readings,s.query));}
  const unresolved=makeManySkyExample();for(const r of unresolved.readings)r.source.project.solarStudy.existing[0].heightMaxM=4;
  assert.throws(()=>run(unresolved),/unresolved existing endpoints/);
});

test('unfamiliar partial original clock supports mixed stores and a retained initial observation without interpolation',()=>{
  const original=makeTimedSkyExample().readings[0];
  Object.assign(original.source.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T06:07:37.000Z',stepMinutes:13});
  const basis=buildOriginalBoundaryBasis(original,4),pair=basis.pairs.find(p=>p.early===1&&p.late===2);
  const choices=[[0,'subsurfaceC'],[5,'surfaceC'],[10,'surfaceC'],[2,'subsurfaceC'],[7,'subsurfaceC'],[9,'surfaceC']];
  const readings=choices.map(([index,store])=>prepareTimedSkyReadingSource(original.source.project,original.source.declaration,{bins:4,reading:{
    ...original.query.reading,utc:basis.originalBoundaries[index].utc,store,temperatureC:pair.trace.states.existing.lower[index][store],halfWidthC:.001}}));
  const result=prepareManySkyCourseEvidence(readings,{bins:4,splitAfterInterval:4,sharingSource:'Authored unfamiliar partial-course control'}).report;
  assert.equal(result.compatibility,'compatible');assert.equal(result.pointwiseCourse.length,11);
  assert.equal(result.pointwiseCourse.at(-1).minute,127.4);assert.equal(result.pointwiseCourse.at(-1).thermalMinute,127.4);
  assert.deepEqual(result.readings.map(r=>[r.originalIndex,r.store]),choices);
  assert.equal(result.work.executedBasisCourses,64);
  assert(result.witnesses.every(w=>w.originalObservations.length===6&&w.originalReplays.length===1));
});

test('maximal original clock and record count reserve every objective and original observation before incompatibility',()=>{
  const s=makeManySkyExample();for(const r of s.readings){r.source.declaration.path.endUtc='2026-06-21T16:00:00.000Z';r.query.reading.temperatureC=400;}
  const r=run(s).report;assert.equal(r.compatibility,'incompatible');assert.equal(r.pointwiseCourse.length,25);
  assert.equal(r.work.objectivesPerFamily,100);assert.equal(r.work.reservedWitnessProfiles,100);
  assert.equal(r.work.reservedThermalCourses,MANY_SKY_COURSE_LIMITS.maxCourses);
  assert.equal(r.work.observationReplayRows,MANY_SKY_COURSE_LIMITS.maxObservationReplayRows);
  assert.equal(r.work.executedCourseIntervals,4608);
});
