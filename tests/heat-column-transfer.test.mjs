import test from 'node:test';import assert from 'node:assert/strict';
import {compareHeatColumnTransfer,prepareHeatColumnTransfer,serializeHeatColumnTransfer,parseHeatColumnTransfer,MAX_TRANSFER_FILE_BYTES} from '../heat-column-transfer.js';
import {prepareHeatColumnStudy} from '../heat-column.js';
import {authoredHeatColumnEvidenceExample} from '../heat-column-evidence.js';
import {transferBundle,transferProject,transferCSV,transferHeader} from './heat-column-transfer-fixture.mjs';

test('frozen five-way original ambiguity transfers to one finite alternative under independently integrated new exposure',()=>{
 const b=transferBundle(),before=structuredClone(b),r=compareHeatColumnTransfer(b);
 assert.equal(r.originalCalibrationLabels.length,5);assert.equal(r.originalSurvivingLabels.length,5);assert.deepEqual(r.transferLabels,['B · reference lower store']);assert.equal(r.status,'one-finite-alternative');
 assert.equal(r.candidates.length,5);assert.equal(r.readings[1].aggregation,'interval-mean');assert.equal(r.readings[1].fromMinute,30);assert.equal(r.durationMinutes,60);
 const expected=[[34.62475757792193,31.463054952285585],[34.68300177529785,30.704771782103844],[34.80452164293739,30.16673606192061],[34.924019294801745,29.761351031018584],[34.98156670388678,29.586258362782473]];
 r.candidates.forEach((c,i)=>c.challenge.rows.forEach((v,j)=>assert.ok(Math.abs(v.predictionC-expected[i][j])<1e-10)));
 assert.deepEqual(b,before);
});
test('broad bands preserve ambiguity and contradictory new readings cannot refit original calibration',()=>{
 const b=transferBundle(),baseline=compareHeatColumnTransfer(b);b.readingFile.text=transferCSV.replaceAll(',0.1,C,',',100,C,');assert.equal(compareHeatColumnTransfer(b).transferLabels.length,5);
 b.readingFile.text=transferHeader+'\n15,,instant,100,0.1,C,challenge,Authored contradiction\n';const r=compareHeatColumnTransfer(b);assert.equal(r.status,'transfer-rejected');assert.deepEqual(r.transferLabels,[]);assert.deepEqual(r.originalCalibrationLabels,baseline.originalCalibrationLabels);assert.equal(r.candidates.length,5);
});
test('absent original calibration and rejected original family cannot become transferred success',()=>{
 const b=transferBundle();b.originalProject.heatColumnEvidence.readings[0].use='challenge';let r=compareHeatColumnTransfer(b);assert.equal(r.status,'need-original-calibration');assert.equal(r.transferLabels,null);
 b.originalProject.heatColumnEvidence.readings[0].use='calibration';b.originalProject.heatColumnEvidence.readings[0].temperatureC=100;r=compareHeatColumnTransfer(b);assert.equal(r.status,'original-family-rejected');assert.equal(r.transferLabels,null);
});
test('original first-exposure challenges stay active and every original alternative remains inspectable',()=>{
 const b=transferBundle();b.originalProject.heatColumnEvidence.readings.push({minute:120,temperatureC:100,halfWidthC:.01,use:'challenge',source:'Authored original contradiction'});
 const r=compareHeatColumnTransfer(b);assert.equal(r.originalCalibrationLabels.length,5);assert.equal(r.originalSurvivingLabels.length,0);assert.equal(r.candidates.length,5);assert.equal(r.status,'original-family-rejected');
});
test('new calibration roles, empty CSV, altered source and changed surface physics refuse',()=>{
 const b=transferBundle();b.readingFile.text=transferCSV.replaceAll(',challenge,',',calibration,');assert.throws(()=>compareHeatColumnTransfer(b),/held aside/);
 b.readingFile.text=transferHeader;assert.throws(()=>compareHeatColumnTransfer(b),/at least one/);b.readingFile.text=transferCSV;
 b.challengeProject.weather.cellSizeM=3;assert.throws(()=>compareHeatColumnTransfer(b),/changed/);
 const second=transferProject(true);delete second.heatColumnStudy;second.surfaceHeatStudy.existing.capacityJm2K=21000;second.heatColumnStudy=prepareHeatColumnStudy(second,transferProject(true).heatColumnStudy.lowerLayers);
 assert.throws(()=>prepareHeatColumnTransfer(transferProject(),second,b.readingFile,b.associationSource),/surface physics/);
});
test('original-only export/reopen preserves both projects, original CSV and finite candidate declarations',()=>{
 const b=transferBundle(),json=serializeHeatColumnTransfer(b),back=parseHeatColumnTransfer(json);assert.deepEqual(back,b);assert.deepEqual(compareHeatColumnTransfer(back),compareHeatColumnTransfer(b));
 assert.equal(Object.hasOwn(back,'results'),false);assert.equal(back.challengeProject.heatColumnEvidence,undefined);assert.equal(back.readingFile.text,transferCSV);
 assert.throws(()=>parseHeatColumnTransfer(JSON.stringify({...b,results:{status:'success'}})),/Retain both/);assert.throws(()=>parseHeatColumnTransfer(' '.repeat(MAX_TRANSFER_FILE_BYTES+1)),/limit/);
});
test('independent mixed-unit file retains original lexical values and exact mean window',()=>{
 const b=transferBundle();b.readingFile.text=transferHeader+'\n15,,instant,94.42940319553613,0.18,F,challenge,Authored Fahrenheit matrix point\n45,30,interval-mean,303.8547717821038,0.1,K,challenge,Authored Kelvin matrix mean\n';
 const r=compareHeatColumnTransfer(b);assert.deepEqual(r.transferLabels,['B · reference lower store']);assert.equal(r.originalRows[0].temperature,'94.42940319553613');assert.equal(r.originalRows[1].unit,'K');assert.equal(r.readings[1].fromMinute,30);
});

test('a previously rejected alternative cannot regain support by matching only the new exposure',()=>{
 const b=transferBundle();b.originalProject.heatColumnEvidence.readings.push(authoredHeatColumnEvidenceExample(b.originalProject).readings[1]);
 b.readingFile.text=transferHeader+'\n15,,instant,34.62475757792193,0.01,C,challenge,Authored alternative A point\n45,30,interval-mean,31.463054952285585,0.01,C,challenge,Authored alternative A mean\n';
 const r=compareHeatColumnTransfer(b);assert.deepEqual(r.originalSurvivingLabels,['B · reference lower store']);assert.equal(r.candidates[0].challenge.compatible,true);assert.equal(r.candidates[0].retainedOriginally,false);assert.equal(r.status,'transfer-rejected');assert.deepEqual(r.transferLabels,[]);
});
