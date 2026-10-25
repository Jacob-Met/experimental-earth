import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceFixture} from './longwave-heat-evidence-fixture.mjs';
import {compareLongwaveEvidence,canonicalLongwaveEvidence,serializeLongwaveEvidence,reopenLongwaveEvidence} from '../longwave-heat-evidence.js';
import {compareLongwaveHeat} from '../longwave-heat.js';
import {absorbedSurfaceHeatEnergy} from '../surface-heat.js';
const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<tol,`${a} vs ${b}`);
test('radiation separates fixed-emissivity common-scale alternatives without changing original readings or linear predictions',()=>{
 const {input}=evidenceFixture(),before=JSON.stringify(input),r=compareLongwaveEvidence(input);
 assert.equal(r.candidates[0].calibration.insideAtBoth,true);assert.equal(r.candidates[1].calibration.insideAtBoth,false);
 near(r.candidates[0].rows[0].linearPredictionC,r.candidates[1].rows[0].linearPredictionC,1e-12);
 assert.equal(r.candidates[0].challenge.insideAtBoth,true);assert.equal(JSON.stringify(input),before);assert.ok(r.work.attempts<=r.work.limit);
});
test('held-aside revisions never refit or alter calibration; empty roles remain unevaluated',()=>{
 const {input}=evidenceFixture(),before=compareLongwaveEvidence(input);input.evidence.readings[1].temperatureC=100;
 const after=compareLongwaveEvidence(input);assert.deepEqual(after.candidates.map(c=>c.calibration),before.candidates.map(c=>c.calibration));assert.equal(after.candidates[0].challenge.insideAtBoth,false);
 input.evidence.readings=input.evidence.readings.filter(r=>r.use==='challenge');assert.equal(compareLongwaveEvidence(input).candidates[0].calibration.insideAtBoth,null);
});
test('exact reading-time integration agrees with independent exponential and rejects minute interpolation',()=>{
 const {input}=evidenceFixture();for(const k of ['existing','proposal']){Object.assign(input.radiation.heatStudy[k],{capacityJm2K:1000,exchangeWm2K:10,initialC:100});input.radiation[k].emissivity=0;}
 input.radiation.heatStudy.schedule=[{minutes:2,incidentWm2:0,reservoirC:20,source:'Exact query control'}];input.radiation.radiationSchedule=[{skyC:5,source:'Zero coupling'}];input.evidence.heatStudy=structuredClone(input.radiation.heatStudy);input.evidence.hypotheses=input.evidence.hypotheses.map(h=>({...h,capacityJm2K:1000,exchangeWm2K:10,initialC:100}));input.evidence.readings=[{minute:.37,temperatureC:84.07322914677273,halfWidthC:1e-6,use:'challenge',source:'Independent exact exponential'}];
 const row=compareLongwaveEvidence(input).candidates[0].rows[0];near(row.predictedC[0],20+80*Math.exp(-.222),1e-6);assert.equal(row.bandAtTestedSettings,'inside');
 const coarse=compareLongwaveHeat(input.radiation).existing.trajectory;const interpolation=coarse[0].temperatureC*.63+coarse[1].temperatureC*.37;assert.ok(Math.abs(interpolation-row.predictedC[0])>2);
});
test('actual disagreement across numerical settings cannot pass a zero-width band',()=>{
 const {input}=evidenceFixture();for(const k of ['existing','proposal'])Object.assign(input.radiation.heatStudy[k],{capacityJm2K:1000,initialC:100});input.evidence.heatStudy=structuredClone(input.radiation.heatStudy);input.evidence.hypotheses=input.evidence.hypotheses.map(h=>({...h,capacityJm2K:1000,initialC:100}));input.evidence.readings[0].minute=.37;
 const r=compareLongwaveEvidence(input);input.evidence.readings[0].temperatureC=r.candidates[0].rows[0].predictedC[0];input.evidence.readings[0].halfWidthC=0;
 const edge=compareLongwaveEvidence(input).candidates[0];assert.equal(edge.rows[0].bandAtTestedSettings,'disagreement');assert.ok(edge.rows[0].predictionChangeC>1e-9);assert.equal(edge.calibration.insideAtBoth,false);
});
test('retains and evaluates original absorbed-input evidence without relabeling radiation as absorption',()=>{
 const {input}=evidenceFixture();input.evidence.schema='experimental-earth-surface-heat-evidence/2';input.evidence.energyQuantity='absorbed-input';input.evidence.energyReadings=[{fromMinute:0,toMinute:60,energyJm2:864000,halfWidthJm2:1,use:'challenge',source:'Authored absorbed-energy reading'}];
 const r=compareLongwaveEvidence(input);assert.equal(r.source.evidence.energyReadings.length,1);assert.equal(r.candidates[0].energyRows[0].predictionJm2,absorbedSurfaceHeatEnergy(input.radiation.heatStudy,'existing',0,60));assert.equal(r.candidates[0].energyRows[0].bandAtTestedSettings,'inside');assert.equal(r.candidates[1].energyRows[0].bandAtTestedSettings,'outside');assert.equal(r.candidates[0].challenge.count,2);
});
test('same target radiative declaration applies to every candidate and odd candidate count remains ordered',()=>{
 const {input}=evidenceFixture();input.evidence.target='proposal';input.radiation.proposal.emissivity=.1;input.evidence.hypotheses.push({...input.evidence.hypotheses[0],label:'A duplicate properties'});
 const r=compareLongwaveEvidence(input);assert.deepEqual(r.candidates.map(c=>c.label),['A','B','A duplicate properties']);assert.deepEqual(r.candidates[0].rows,r.candidates[2].rows);
 const copy=structuredClone(input);copy.evidence.target='existing';assert.notEqual(compareLongwaveEvidence(copy).candidates[0].rows[0].predictedC[0],r.candidates[0].rows[0].predictedC[0]);
});
test('all candidates share a transactional budget; oversized inquiry refuses without source mutation',()=>{
 const {input}=evidenceFixture();input.evidence.hypotheses=Array.from({length:12},(_,i)=>({...input.evidence.hypotheses[0],label:'H'+i,capacityJm2K:1000,exchangeWm2K:100}));const before=JSON.stringify(input);
 assert.throws(()=>compareLongwaveEvidence(input),/complete.*budget before execution/);assert.equal(JSON.stringify(input),before);
});
test('source-only canonical reopening drops forged outputs and copies original fields',()=>{
 const {input}=evidenceFixture(),clean=canonicalLongwaveEvidence(input);input.result={accepted:true};input.evidence.results={winner:'B'};input.evidence.hypotheses[0].predictionC=999;input.evidence.readings[0].withinBand=true;
 assert.deepEqual(canonicalLongwaveEvidence(input),clean);const r=reopenLongwaveEvidence(serializeLongwaveEvidence(input));assert.deepEqual(r,compareLongwaveEvidence(clean));r.source.evidence.readings[0].temperatureC=999;assert.notEqual(input.evidence.readings[0].temperatureC,999);
});
test('source mismatch, missing nonradiative basis, malformed readings and unsupported sampling refuse',()=>{
 for(const change of [x=>x.evidence.heatStudy.existing.initialC++,x=>x.evidence.heatStudy.schedule[0].minutes++,x=>delete x.hypothesisExchangeBasis,x=>x.exchangeBasisSource='',x=>x.evidence.readings[0].minute=NaN]){const {input}=evidenceFixture();change(input);assert.throws(()=>compareLongwaveEvidence(input));}
 const {input}=evidenceFixture();for(const options of [{sampleMinutes:[-1]},{sampleMinutes:[Infinity]},{sampleMinutes:Array(101).fill(1)},{toleranceC:1e-6},{workLimit:0}])assert.throws(()=>compareLongwaveHeat(input.radiation,options));
 assert.throws(()=>reopenLongwaveEvidence('x'.repeat(300001)),/300000/);
});

test('held-aside time changes cannot alter calibration integration or a discriminating narrow band',()=>{
 const {input}=evidenceFixture();for(const k of ['existing','proposal'])Object.assign(input.radiation.heatStudy[k],{capacityJm2K:1000,initialC:100});input.evidence.heatStudy=structuredClone(input.radiation.heatStudy);input.evidence.hypotheses=input.evidence.hypotheses.map(h=>({...h,capacityJm2K:1000,initialC:100}));
 input.evidence.readings[0].minute=.37;input.evidence.readings[1].minute=.1;
 // Construct the adversarial band from both actual joint-grid courses with a
 // positive margin. A hardcoded boundary at a Node24 ulp is not portable proof.
 const joint=challengeMinute=>[1e-8,1e-10].map(toleranceC=>compareLongwaveHeat(input.radiation,{sampleMinutes:[.37,challengeMinute],toleranceC}).existing.trajectory.find(r=>r.minute===.37).temperatureC);
 const oldA=joint(.1),oldB=joint(.2),low=Math.min(...oldA),high=Math.max(...oldA);
 const separation=Math.max(low-Math.min(...oldB),Math.max(...oldB)-high);
 assert.ok(separation>1e-11,JSON.stringify({oldA,oldB,separation}));
 input.evidence.readings[0].temperatureC=(low+high)/2;input.evidence.readings[0].halfWidthC=(high-low)/2+separation/4;
 const first=compareLongwaveEvidence(input);input.evidence.readings[1].minute=.2;const second=compareLongwaveEvidence(input);
 assert.deepEqual(first.candidates.map(c=>c.calibration),second.candidates.map(c=>c.calibration));assert.deepEqual(first.work.roleCourses,['calibration','challenge']);
 const reading=input.evidence.readings[0],inside=value=>Math.abs(value-reading.temperatureC)<=reading.halfWidthC;
 assert.equal(oldA.every(inside),true,JSON.stringify({oldA,reading}));assert.equal(oldB.every(inside),false,JSON.stringify({oldB,reading}));
});
test('tighter nonzero-radiation query agrees more closely with an independent small-step reference',()=>{
 const {input}=evidenceFixture();for(const k of ['existing','proposal'])Object.assign(input.radiation.heatStudy[k],{capacityJm2K:1000,initialC:100});input.evidence.heatStudy=structuredClone(input.radiation.heatStudy);input.evidence.hypotheses=input.evidence.hypotheses.map(h=>({...h,capacityJm2K:1000,initialC:100}));input.evidence.readings[0].minute=.37;
 const row=compareLongwaveEvidence(input).candidates[0].rows[0];
 // Independent direct fourth powers and fixed-step midpoint, not production RK4.
 const derivative=t=>(240-10*(t-25)-.9*5.6703744191844314e-8*((t+273.15)**4-278.15**4))/1000;
 let reference=100;const dt=22.2/222000;for(let i=0;i<222000;i++)reference+=dt*derivative(reference+dt*derivative(reference)/2);
 const errors=row.predictedC.map(t=>Math.abs(t-reference));assert.ok(errors[1]<2e-9,JSON.stringify({reference,errors}));assert.ok(errors[1]<errors[0]/5,JSON.stringify({reference,errors}));
});
test('scaling emissivity with all other heat coefficients restores the temperature ambiguity',()=>{
 const {input}=evidenceFixture();input.radiation.existing.emissivity=.45;input.radiation.proposal.emissivity=.9;
 const result=compareLongwaveHeat(input.radiation);assert.deepEqual(result.existing.trajectory.map(r=>r.temperatureC),result.proposal.trajectory.map(r=>r.temperatureC));
 assert.notEqual(result.existing.final.radiationJm2,result.proposal.final.radiationJm2);
});
