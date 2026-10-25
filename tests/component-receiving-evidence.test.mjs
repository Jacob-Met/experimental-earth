import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample,runRain} from '../core.js';
import {compareDrainingHypotheses,DRAINING_HYPOTHESES_SCHEMA,hypothesisLayer,parseDrainingEvidence,serializeDrainingEvidence} from '../draining-layer-evidence.js';
import {compareReceivingEvidenceComponents} from '../component-receiving-evidence.js';
import {fixture} from './component-receiving-evidence-fixture.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('original supported explanations retain opposing component consequences and all independent worlds',()=>{
 const {project,study}=fixture(),before=JSON.stringify({project,study}),report=compareReceivingEvidenceComponents(project,study,{subset:'surviving'});
 assert.equal(report.status,'compared');assert.deepEqual(report.candidates.map(c=>c.hypothesis.id),['h1','h2']);assert.deepEqual(report.inference,compareDrainingHypotheses(project,study));
 for(const c of report.candidates)for(let mask=0;mask<8;mask++){
  const cells=structuredClone(mask&2?project.proposal:project.existing);
  for(let i=0;i<cells.length;i++){cells[i].surface=(mask&1?project.proposal:project.existing)[i].surface;delete cells[i].internalBarriers;const b=(mask&4?project.proposal:project.existing)[i].internalBarriers;if(b)cells[i].internalBarriers=structuredClone(b);}
  const r=runRain(cells,project.width,project.height,project.weather,{drainingLayer:hypothesisLayer(study,c.hypothesis)});
  for(const metric of c.result.metrics)near(metric.values[mask],r[metric.key]);near(c.result.balances[mask],r.massErrorLiters);
 }
 const effects=report.candidates.map(c=>c.result.metrics.find(m=>m.key==='storedLiters'));
 near(effects[0].values[7]-effects[0].values[0],5.604318659444971);near(effects[1].values[7]-effects[1].values[0],-6.5683236619202034);assert.ok(effects[0].effects[7]<0&&effects[1].effects[7]>0);assert.equal(JSON.stringify({project,study}),before);
 const replay=parseDrainingEvidence(serializeDrainingEvidence(project,study));assert.deepEqual(compareReceivingEvidenceComponents(replay.project,replay.study,{subset:'surviving'}),report);
});
test('held-aside rejection changes support without refitting any offered world or calibration',()=>{
 const {project,study}=fixture(),before=compareReceivingEvidenceComponents(project,study);
 project.observations[1].depthMm=900;const after=compareReceivingEvidenceComponents(project,study);
 assert.deepEqual(after.inference.compatibleIds,before.inference.compatibleIds);assert.deepEqual(after.inference.survivingIds,[]);
 for(let i=0;i<after.candidates.length;i++){assert.deepEqual(after.candidates[i].result,before.candidates[i].result);assert.deepEqual(after.candidates[i].calibration,before.candidates[i].calibration);}
 const filtered=compareReceivingEvidenceComponents(project,study,{subset:'surviving'});assert.equal(filtered.status,'no-supported-explanations');assert.deepEqual(filtered.candidates,[]);
});
test('missing evidence and observed surface refuse support; complete budget precedes filtering',()=>{
 const {project,study}=fixture();project.observations=[];assert.equal(compareReceivingEvidenceComponents(project,study,{subset:'calibration'}).status,'need-calibration');
 assert.equal(compareReceivingEvidenceComponents(project,study).candidates.length,4);
 project.observations=fixture().project.observations.slice(0,1);assert.equal(compareReceivingEvidenceComponents(project,study,{subset:'surviving'}).status,'need-challenge');
 assert.throws(()=>compareReceivingEvidenceComponents(project,study,{subset:'winner'}));
 project.existing[40].surface='sealed';assert.equal(compareReceivingEvidenceComponents(project,study).status,'surface-absent');
 const huge=fixture().project;huge.weather.durationMinutes=720;huge.weather.stepMinutes=1;assert.throws(()=>compareReceivingEvidenceComponents(huge,study,{subset:'surviving'}),/ten-world/);
});
