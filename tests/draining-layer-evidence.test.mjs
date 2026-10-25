import test from 'node:test';
import assert from 'node:assert/strict';
import {compareDrainingHypotheses, makeDrainingEvidenceExample, validateDrainingHypotheses,
  serializeDrainingEvidence, parseDrainingEvidence} from '../draining-layer-evidence.js';
const near = (a,b,t=1e-9) => assert.ok(Math.abs(a-b)<=t, `${a} differs from ${b}`);

test('same early depth cannot separate closed storage from drainage; a late original reading can', () => {
  const {project, study} = makeDrainingEvidenceExample(), report = compareDrainingHypotheses(project, study);
  assert.deepEqual(report.compatibleIds, ['draining', 'closed-matched']);
  assert.deepEqual(report.survivingIds, ['draining']); assert.equal(report.status, 'one-survivor');
  const [draining, closed] = report.candidates;
  near(draining.calibration.errors[0].depthMm, closed.calibration.errors[0].depthMm);
  near(closed.challenge.errors[0].depthMm - draining.challenge.errors[0].depthMm, 10);
  assert.equal(report.candidates.length, 4); assert.equal(closed.challenge.compatible, false);
  near(draining.proposal.receiver.retainedLiters, 20);
  near(draining.proposal.receiver.drainedLiters, 4 * (20 + 19 * Math.log(24 / 19)) - 20);
  assert.equal(report.effects.calibration.count, 2); assert.equal(report.effects.surviving.count, 1);
  near(report.effects.surviving.metrics.storedLiters.minimum, draining.change.storedLiters);
});

test('held-aside values reject explanations without changing calibration or their consequences', () => {
  const {project, study} = makeDrainingEvidenceExample(), before = compareDrainingHypotheses(project, study);
  project.observations[1].depthMm = project.observations[0].depthMm;
  const after = compareDrainingHypotheses(project, study);
  assert.deepEqual(after.compatibleIds, before.compatibleIds);
  assert.deepEqual(after.survivingIds, ['closed-matched']);
  for (let i=0;i<after.candidates.length;i++) {
    assert.deepEqual(after.candidates[i].calibration, before.candidates[i].calibration);
    assert.deepEqual(after.candidates[i].change, before.candidates[i].change);
    assert.deepEqual(after.candidates[i].hypothesis, before.candidates[i].hypothesis);
  }
});

test('missing calibration or challenge never manufactures supported or surviving explanations', () => {
  const {project, study} = makeDrainingEvidenceExample();
  const noCalibration = structuredClone(project); noCalibration.observations.shift();
  const a = compareDrainingHypotheses(noCalibration, study);
  assert.equal(a.status, 'need-calibration'); assert.deepEqual(a.compatibleIds, []); assert.deepEqual(a.survivingIds, []);
  const noChallenge = structuredClone(project); noChallenge.observations.pop();
  const b = compareDrainingHypotheses(noChallenge, study);
  assert.equal(b.status, 'needs-challenge'); assert.equal(b.compatibleIds.length, 2);
  assert.deepEqual(b.survivingIds, []); assert.equal(b.effects.surviving.metrics.storedLiters, null);
});

test('ambiguity and complete contradictions retain every offered explanation without fallback', () => {
  const {project, study} = makeDrainingEvidenceExample();
  project.observations[1].uncertaintyMm = 20;
  let r = compareDrainingHypotheses(project, study);
  assert.equal(r.status, 'ambiguous'); assert.equal(r.survivingIds.length, 2);
  project.observations[1].uncertaintyMm = 0.1; project.observations[1].depthMm = 100;
  r = compareDrainingHypotheses(project, study); assert.equal(r.status, 'challenged');
  assert.deepEqual(r.survivingIds, []); assert.equal(r.candidates.length, 4);
  project.observations[0].depthMm = 100;
  r = compareDrainingHypotheses(project, study); assert.equal(r.status, 'calibration-rejected');
  assert.deepEqual(r.compatibleIds, []); assert.equal(r.effects.calibration.count, 0);
});

test('original target roles and absent receiving surfaces remain explicit', () => {
  const {project, study} = makeDrainingEvidenceExample();
  const other = structuredClone(project.observations[0]); other.scenario='existing'; other.depthMm=100;
  project.observations.push(other);
  let r=compareDrainingHypotheses(project, study); assert.equal(r.counts.ignored,1); assert.equal(r.status,'one-survivor');
  r=compareDrainingHypotheses(project,{...study,target:'existing'});
  assert.equal(r.status,'surface-absent'); assert.deepEqual(r.candidates,[]);
  assert.equal(r.counts.affectedCells,0);
});

test('source-only replay recomputes and preserves original project and hypothesis order', () => {
  const {project, study} = makeDrainingEvidenceExample(), before=JSON.stringify({project,study});
  const r=compareDrainingHypotheses(project,study), text=serializeDrainingEvidence(project,study), reopened=parseDrainingEvidence(text);
  assert.deepEqual(compareDrainingHypotheses(reopened.project,reopened.study),r);
  assert.equal(JSON.stringify({project,study}),before);
  assert.throws(()=>parseDrainingEvidence(JSON.stringify({...reopened,results:{status:'one-survivor'}})),/saved conclusions/);
  const reversed=compareDrainingHypotheses(project,{...study,hypotheses:[...study.hypotheses].reverse()});
  assert.deepEqual(reversed.compatibleIds.sort(),r.compatibleIds.sort());
  assert.deepEqual(reversed.survivingIds,r.survivingIds);
});

test('complete admission rejects duplicates, missing assumptions and excessive original work', () => {
  const {project,study}=makeDrainingEvidenceExample();
  for(const patch of [{target:'unknown'},{surface:'constructor'},{hypotheses:[]},{extra:true}])
    assert.throws(()=>validateDrainingHypotheses({...study,...patch}));
  for(const patch of [{id:study.hypotheses[1].id},{label:''},{capacityMm:-1},{initialStoredMm:6},{source:''},{drainagePerHour:'1'},{extra:true}]) {
    const copy=structuredClone(study);Object.assign(copy.hypotheses[0],patch);
    assert.throws(()=>validateDrainingHypotheses(copy));
  }
  const duplicate=structuredClone(study);duplicate.hypotheses[1]={...duplicate.hypotheses[0],id:'different'};
  assert.throws(()=>validateDrainingHypotheses(duplicate),/distinct storage/);
  const sparse=structuredClone(study);delete sparse.hypotheses[1];assert.throws(()=>validateDrainingHypotheses(sparse));
  const big={...project,width:24,height:24,selectedIndex:0,existing:Array(576).fill(project.existing[0]),proposal:Array(576).fill(project.proposal[0]),weather:{...project.weather,durationMinutes:720,stepMinutes:1}};
  assert.throws(()=>compareDrainingHypotheses(big,study),/one million/);
});
