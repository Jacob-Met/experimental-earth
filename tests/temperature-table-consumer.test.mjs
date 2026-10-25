import test from 'node:test';
import assert from 'node:assert/strict';
import {previewTemperatureTable} from '../temperature-table.js';
import {prepareHeatColumnEvidence,compareHeatColumnEvidence} from '../heat-column-evidence.js';
import {parsePortableProject,serializePortableProject} from '../project-portability.js';
import {temperatureProject,temperatureCSV,temperatureHeader} from './temperature-table-fixture.mjs';
test('original F/K rows reach maintained comparison and raw whole-project replay',()=>{
 const p=temperatureProject(),before=structuredClone(p),preview=previewTemperatureTable(temperatureCSV,420,'original.csv');
 p.heatColumnEvidence=prepareHeatColumnEvidence(p,{...p.heatColumnEvidence,readings:preview.readings});
 const report=compareHeatColumnEvidence(p);
 assert.equal(report.status,'one-survivor');assert.equal(report.calibrationLabels.length,5);
 assert.deepEqual(p.heatColumnEvidence.hypotheses,before.heatColumnEvidence.hypotheses);
 assert.deepEqual(p.heatColumnStudy,before.heatColumnStudy);
 const reopened=parsePortableProject(serializePortableProject(p));
 assert.deepEqual(reopened.heatColumnEvidence.readings,preview.readings);
 assert.deepEqual(compareHeatColumnEvidence(reopened),report);
 const reading=reopened.heatColumnEvidence.readings[1];
 assert.equal(JSON.parse(reading.source.slice('Original temperature CSV: '.length)).temperature,'300.58965430499205');
 reading.temperatureC=100;
 const challenged=compareHeatColumnEvidence(reopened);assert.equal(challenged.status,'challenged');
 assert.deepEqual(challenged.calibrationLabels,report.calibrationLabels);
});
test('bulk interval means reach the maintained mean operator and do not become endpoint readings',()=>{
 const p=temperatureProject(),rows=previewTemperatureTable(temperatureHeader+'60,0,interval-mean,310,100,K,calibration,Authored broad mean',420,'mean.csv').readings;
 p.heatColumnEvidence=prepareHeatColumnEvidence(p,{...p.heatColumnEvidence,readings:rows});
 const report=compareHeatColumnEvidence(p);assert.equal(report.status,'needs-challenge');
 for(const c of report.candidates){const r=c.calibration.rows[0];assert.equal(r.aggregation,'interval-mean');assert.equal(r.fromMinute,0);assert.notEqual(r.predictionC,c.trajectory.find(t=>t.minute===60).surfaceC);}
});
