import test from 'node:test';
import assert from 'node:assert/strict';
import { makeThirdReceiverExample } from '../shade-heat-third-example.js';
import { makeJointCourseExample } from '../shade-heat-joint-example.js';
import { prepareSkyCourseSource } from '../shade-heat-course-evidence.js';
import { prepareSkyJointSource } from '../shade-heat-joint-course.js';
import { parseJointOriginals } from '../shade-heat-joint-inputs.js';
test('three originals and old boundary/course/new joint files extract only original evidence and sharing source',()=>{
  const old=makeThirdReceiverExample(),joint=makeJointCourseExample();
  const course=prepareSkyCourseSource(old.readings,{bins:4,splitAfterInterval:8,sharingSource:old.query.sharingSource});
  const source=prepareSkyJointSource(joint.readings,joint.query);
  for(const saved of [old,course,source]){
    const result=parseJointOriginals([JSON.stringify(saved)]);
    assert.deepEqual(Object.keys(result),['readings','sharingSource']);
    assert.deepEqual(result.readings,saved.readings);assert.equal(result.sharingSource,saved.query.sharingSource);
  }
  const result=parseJointOriginals(old.readings.map(x=>JSON.stringify(x)));
  assert.deepEqual(result.readings,old.readings);assert.equal(result.sharingSource,null);
});
test('sparse, extra-result, altered-model and malformed prior files cannot become original evidence',()=>{
  const old=makeThirdReceiverExample(),course=prepareSkyCourseSource(old.readings,{bins:4,splitAfterInterval:8,sharingSource:old.query.sharingSource});
  for(const texts of [[],Array(3),[JSON.stringify(old.readings[0]),,JSON.stringify(old.readings[2])],['x'],[JSON.stringify({...course,report:{}})],[JSON.stringify({...course,model:{...course.model,version:2}})]])assert.throws(()=>parseJointOriginals(texts));
});
