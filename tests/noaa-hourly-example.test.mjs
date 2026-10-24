import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildNoaaExample} from '../examples/noaa-tucson-hourly/build.mjs';
import {replayIntake,selectCourse} from '../examples/noaa-tucson-hourly/intake.mjs';
import {parsePortableProject,serializePortableProject} from '../project-portability.js';
import {compareHeatColumnEvidence} from '../heat-column-evidence.js';
test('exact NOAA excerpt preserves support, source values, flags and separate byte identities',()=>{
 const {project:p,intake,receipt,course}=buildNoaaExample();
 assert.equal(intake.sha256,'247bd26d2cdc1af26c933af2ced818d00dfbe629e4d1cdfae9a5a81b1b9547ac');
 assert.equal(intake.byteLength,2196); assert.equal(receipt.sources[2].sha256,'8a3f9e470c96557cb21a0e1bab0f556630f4c8ec50965666a8f5a32a0677ea75');
 assert.notEqual(intake.sha256,receipt.sources[2].sha256);
 assert.equal(course.initialState.timeUtc,'2025-01-01T15:00:00.000Z');
 assert.equal(intake.rows.at(-1).intervalEndUtc,'2025-01-02T00:00:00.000Z');
 for(const [i,r]of intake.rows.entries()){
  const h=p.heatColumnEvidence.readings[i],s=p.surfaceHeatStudy.schedule[i];
  assert.equal(h.aggregation,'interval-mean');assert.equal(h.fromMinute,i*60);assert.equal(h.minute,(i+1)*60);
  assert.equal(h.temperatureC,Number(r.raw.SUR_TEMP));assert.equal(r.raw.SUR_TEMP_TYPE,'C');assert.equal(r.raw.SUR_TEMP_FLAG,'0');assert.equal(r.raw.SOLARAD_FLAG,'0');
  assert.equal(s.incidentWm2,Number(r.raw.SOLARAD));assert.equal(s.reservoirC,Number(r.raw.T_HR_AVG));assert.equal(h.halfWidthC,.5);assert.equal(h.use,i<3?'calibration':'challenge');
 }
 assert.deepEqual(replayIntake(intake),intake);
 assert.throws(()=>selectCourse(intake,{firstLine:1,count:9,correctionType:'C',initialState:{...course.initialState,timeUtc:intake.rows[0].intervalEndUtc}}),/initial-state/);
});
test('native saved project reopens and reproduces a rejected unchanged illustrative family',()=>{
 const {project,report}=buildNoaaExample();
 assert.equal(report.status,'calibration-rejected');assert.equal(report.candidates.length,3);
 assert.deepEqual(project.heatColumnEvidence.hypotheses.map(h=>[h.capacityJm2K,h.conductanceWm2K]),[[60000,20],[80000,20],[160000,20]]);
 const reopened=parsePortableProject(serializePortableProject(project));assert.deepEqual(compareHeatColumnEvidence(reopened),report);
 const saved=parsePortableProject(readFileSync(new URL('../examples/noaa-tucson-hourly/project.json',import.meta.url),'utf8'));assert.deepEqual(saved,project);
 const changed=structuredClone(project);changed.heatColumnEvidence.readings[8].temperatureC+=10;
 const altered=compareHeatColumnEvidence(changed);
 for(let i=0;i<3;i++){assert.deepEqual(altered.candidates[i].calibration,report.candidates[i].calibration);assert.deepEqual(altered.candidates[i].trajectory,report.candidates[i].trajectory);assert.notDeepEqual(altered.candidates[i].challenge,report.candidates[i].challenge);}
 assert.deepEqual(changed.heatColumnEvidence.hypotheses,project.heatColumnEvidence.hypotheses);
});
