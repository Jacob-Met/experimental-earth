import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceFixture} from './longwave-heat-evidence-fixture.mjs';
import {compareLongwaveEvidence,canonicalLongwaveEvidence,serializeLongwaveEvidence,reopenLongwaveEvidence,LONGWAVE_FAMILY_SCHEMA} from '../longwave-heat-evidence.js';
import {longwaveFluxWm2} from '../longwave-heat.js';
import {familyFixture as familySources} from './longwave-family-fixture.mjs';
const familyFixture=()=>familySources().input;

test('original absorbed energy distinguishes temperature-equivalent coefficient families without rescuing a rejected family',()=>{
 const input=familyFixture(),r=compareLongwaveEvidence(input);
 assert.deepEqual(r.candidates.map(c=>c.label),['A','B','C slower']);assert.deepEqual(r.candidates.map(c=>c.calibration.insideAtBoth),[true,true,false]);assert.deepEqual(r.candidates.map(c=>c.challenge.insideAtBoth),[true,false,true]);
 assert.deepEqual(r.candidates[0].rows[0].predictedC,r.candidates[1].rows[0].predictedC);assert.deepEqual(r.candidates.map(c=>c.energyRows[0].predictionJm2),[864000,1728000,864000]);
 assert.deepEqual(r.candidates.filter(c=>c.calibration.insideAtBoth&&c.challenge.insideAtBoth).map(c=>c.label),['A']);
});
test('wide or zero-forcing energy evidence preserves the unresolved temperature-equivalent alternatives',()=>{
 const input=familyFixture();input.evidence.energyReadings[0].energyJm2=1296000;input.evidence.energyReadings[0].halfWidthJm2=432001;const wide=compareLongwaveEvidence(input);assert.ok(wide.candidates.slice(0,2).every(c=>c.calibration.insideAtBoth&&c.challenge.insideAtBoth));
 input.radiation.heatStudy.schedule=input.radiation.heatStudy.schedule.map(r=>({...r,incidentWm2:0}));input.evidence.heatStudy=structuredClone(input.radiation.heatStudy);input.evidence.readings[0].temperatureC=23.32350935272112;input.evidence.energyReadings[0].energyJm2=0;input.evidence.energyReadings[0].halfWidthJm2=1;
 const dark=compareLongwaveEvidence(input);assert.ok(dark.candidates.slice(0,2).every(c=>c.calibration.insideAtBoth&&c.challenge.insideAtBoth));assert.equal(dark.candidates[0].energyRows[0].predictionJm2,0);assert.equal(dark.candidates[1].energyRows[0].predictionJm2,0);
});
test('same observed temperature and absorbed energy do not generally identify capacity, convection or emissivity',()=>{
 const input=familyFixture();input.evidence.hypotheses=input.evidence.hypotheses.slice(0,2).map((h,i)=>({...h,absorptivity:.4,initialC:45,capacityJm2K:i?80000:40000,exchangeWm2K:(240-longwaveFluxWm2(45,5,i?.7:.3))/20}));input.radiativeHypotheses=[{label:'A',emissivity:.3,source:'Authored equilibrium family'},{label:'B',emissivity:.7,source:'Different authored equilibrium family'}];
 input.evidence.readings[0].temperatureC=45;const before=compareLongwaveEvidence(input);assert.ok(before.candidates.every(c=>c.calibration.insideAtBoth&&c.challenge.insideAtBoth));
 input.evidence.readings.push({minute:90,temperatureC:36.393885114925176,halfWidthC:.05,use:'challenge',source:'Original authored post-switch control; not independent field data'});
 const after=compareLongwaveEvidence(input);assert.deepEqual(after.candidates.map(c=>c.calibration),before.candidates.map(c=>c.calibration));assert.deepEqual(after.candidates.map(c=>c.challenge.insideAtBoth),[true,false]);
});
test('family source requires complete unique label binding and never silently ignores a v2 declaration',()=>{
 for(const mutate of [x=>x.schema='experimental-earth-longwave-evidence/1',x=>x.radiativeHypotheses.pop(),x=>x.radiativeHypotheses[0].label='foreign',x=>x.radiativeHypotheses[0].label='A',x=>x.radiativeHypotheses[0].emissivity=NaN,x=>x.radiativeHypotheses[0].source='']){const input=familyFixture();mutate(input);assert.throws(()=>compareLongwaveEvidence(input));}
 const input=familyFixture();input.evidence.energyQuantity='incident-input';assert.throws(()=>compareLongwaveEvidence(input),/absorbed-input/);
});
test('source-only family roundtrip preserves all labels and sources, strips outputs and remains nonmutating',()=>{
 const input=familyFixture(),before=JSON.stringify(input);input.radiativeHypotheses[0].derivedScore=1;const clean=canonicalLongwaveEvidence(input);assert.deepEqual(clean.radiativeHypotheses.map(f=>f.label),['A','B','C slower']);assert.equal(clean.radiativeHypotheses[1].derivedScore,undefined);
 const report=compareLongwaveEvidence(input);assert.deepEqual(reopenLongwaveEvidence(serializeLongwaveEvidence(input)),report);delete input.radiativeHypotheses[0].derivedScore;assert.equal(JSON.stringify(input),before);
});
