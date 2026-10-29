import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTimedSkyExample } from '../shade-heat-timed-example.js';
import { makeJointCourseExample } from '../shade-heat-joint-example.js';
import { prepareSkyJointSource } from '../shade-heat-joint-course.js';
import { prepareTimedSkyCourseSource } from '../shade-heat-timed-course.js';
import { parseTimedOriginals } from '../shade-heat-timed-inputs.js';

test('three timed original files keep their exact histories and do not adopt a change boundary',()=>{
  const s=makeTimedSkyExample();[4,16,8].forEach((bins,i)=>{s.readings[i].query.bins=bins;});
  const next=parseTimedOriginals(s.readings.map(JSON.stringify));
  assert.deepEqual(next,{readings:s.readings,sharingSource:null});assert(!Object.hasOwn(next,'query'));
});
test('strict prior inquiries supply original evidence without their query choices or derived report',()=>{
  const raw=makeTimedSkyExample();const timed=prepareTimedSkyCourseSource(raw.readings,{...raw.query,splitAfterInterval:7});
  assert.deepEqual(parseTimedOriginals([JSON.stringify(timed)]),{readings:timed.readings,sharingSource:timed.query.sharingSource});
  const old=makeJointCourseExample(),joint=prepareSkyJointSource(old.readings,old.query);
  assert.deepEqual(parseTimedOriginals([JSON.stringify(joint)]),{readings:joint.readings,sharingSource:joint.query.sharingSource});
  for(const value of [{...timed,report:{}},{...joint,report:{}},{...timed,model:{...timed.model,observation:'changed'}}])
    assert.throws(()=>parseTimedOriginals([JSON.stringify(value)]));
});
test('incomplete, duplicate, source-conflicting and sparse original intake cannot replace admitted evidence',()=>{
  const s=makeTimedSkyExample();const text=s.readings.map(JSON.stringify),before=JSON.stringify(s);
  for(const values of [text.slice(0,2),[text[0],text[1],text[1]],Array(3),[text[0],,text[2]],['not-json']])assert.throws(()=>parseTimedOriginals(values));
  const wrong=structuredClone(s.readings);wrong[2].source.project.heatColumnStudy.lowerLayers.existing.capacityJm2K*=2;
  assert.throws(()=>parseTimedOriginals(wrong.map(JSON.stringify)),/identical complete original receiver/);
  assert.equal(JSON.stringify(s),before);
});
