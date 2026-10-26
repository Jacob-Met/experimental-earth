import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseDrainingQuestion} from '../draining-question.js';
import {planComplementaryDepths} from '../complementary-depth-plan.js';
import {compareDrainingHypotheses,makeDrainingEvidenceExample,serializeDrainingEvidence,parseDrainingEvidence} from '../draining-layer-evidence.js';
const run=(id,depths)=>({id,result:{snapshots:depths.map((depthsMm,minute)=>({minute,depthsMm}))}});

test('reuses the complete maintained singleton planner and retains unresolved identities',()=>{
 const runs=[run('a',[[0,0],[1,3]]),run('b',[[0,0],[1,6]]),run('c',[[0,0],[1,6.1]])];
 const q=chooseDrainingQuestion(runs,.1);
 assert.equal(q.status,'question');assert.equal(q.question.cellIndex,1);assert.equal(q.question.minute,1);
 assert.equal(q.question.separatedPairs.length,2);assert.deepEqual(q.question.unresolvedPairs,[['b','c']]);
 assert.deepEqual(q.plan,planComplementaryDepths(runs.map(r=>r.result),{uncertaintyMm:.1,maxReadings:1,recorded:[]}));
 assert.equal(chooseDrainingQuestion(runs,10).status,'no-separation');
 assert.equal(chooseDrainingQuestion(runs,.1,[{cellIndex:1,minute:1}]).status,'no-separation');
});

test('touching bands, invalid runs and unsupported complete families never offer success',()=>{
 assert.equal(chooseDrainingQuestion([run('a',[[0],[0]]),run('b',[[0],[2]])],1).status,'no-separation');
 assert.equal(chooseDrainingQuestion([run('a',[[0],[0]])],1).status,'no-supported-pair');
 assert.equal(chooseDrainingQuestion([run('a',[[0],[0]]),run('b',[[0],[NaN]])],1).status,'unsupported');
 assert.equal(chooseDrainingQuestion(Array.from({length:10},(_,i)=>run(String(i),[[0],[i]])),1).status,'unsupported');
});

test('original receiver investigation proposes without held-aside value leakage and reopens',()=>{
 const {project,study}=makeDrainingEvidenceExample(),before=JSON.stringify({project,study});
 const report=compareDrainingHypotheses(project,study);
 assert.equal(report.question.status,'question');assert.deepEqual(report.question.ids,report.compatibleIds);
 assert.equal(JSON.stringify({project,study}),before);
 assert.ok(!project.observations.some(o=>o.scenario===study.target&&o.cellIndex===report.question.question.cellIndex&&o.minute===report.question.question.minute));
 const changed=structuredClone(project);changed.observations.filter(o=>o.use==='challenge').forEach(o=>o.depthMm=999);
 assert.deepEqual(compareDrainingHypotheses(changed,study).question,report.question);
 const input=parseDrainingEvidence(serializeDrainingEvidence(project,study));
 assert.deepEqual(compareDrainingHypotheses(input.project,input.study).question,report.question);
 const empty=structuredClone(project);empty.observations=empty.observations.filter(o=>o.use!=='calibration');
 assert.equal(compareDrainingHypotheses(empty,study).question.status,'no-supported-pair');
 const wide=structuredClone(project);wide.observations.filter(o=>o.use==='calibration').forEach(o=>o.uncertaintyMm=100);
 assert.equal(compareDrainingHypotheses(wide,study).question.status,'no-separation');
});

test('recording every retained coordinate withholds a duplicate question',()=>{
 const runs=[run('first',[[0],[2],[4]]),run('second',[[0],[5],[8]])];
 const q=chooseDrainingQuestion(runs,.1,[{cellIndex:0,minute:1},{cellIndex:0,minute:2}]);
 assert.equal(q.status,'no-separation');assert.equal(q.plan.status,'all-recorded');assert.equal(q.question,null);
});

test('new closed stores propose independently known depths without using the held-aside answer',()=>{
 const {project,study}=makeDrainingEvidenceExample();
 project.weather.stepMinutes=5;
 study.hypotheses=[5,6].map(capacityMm=>({id:capacityMm===5?'closed-five':'closed-six',label:'Closed '+capacityMm+' mm store',capacityMm,initialStoredMm:0,drainagePerHour:0,source:'Authored analytic closed-layer control'}));
 project.observations=[
  {cellIndex:0,minute:5,depthMm:1,uncertaintyMm:.1,scenario:'proposal',use:'calibration',source:'3 mm rain minus 2 mm intake'},
  {cellIndex:0,minute:180,depthMm:31,uncertaintyMm:.1,scenario:'proposal',use:'challenge',source:'36 mm rain minus 5 mm closed storage'}
 ];
 const first=compareDrainingHypotheses(project,study);
 assert.deepEqual(first.question.ids,['closed-five','closed-six']);
 assert.equal(first.question.status,'question');
 assert.equal(first.question.question.cellIndex,0);assert.equal(first.question.question.minute,15);
 assert.deepEqual(first.question.question.predictions.map(p=>p.depthMm),[4,3]);
 assert.equal(first.question.question.separatedPairs.length,1);
 assert.equal(first.question.question.unresolvedPairs.length,0);
 project.observations[1].depthMm=30;
 assert.deepEqual(compareDrainingHypotheses(project,study).question,first.question);
 project.observations[0].uncertaintyMm=100;
 assert.equal(compareDrainingHypotheses(project,study).question.status,'no-separation');
});
