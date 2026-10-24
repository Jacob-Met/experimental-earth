import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample, validateProject} from '../core.js';
import {MAX_PROJECT_FILE_BYTES, checkProjectFileBytes, serializePortableProject, parsePortableProject} from '../project-portability.js';

function sourceRichSite() {
  const p = makeExample(); p.width = p.height = 24; p.selectedIndex = 0;
  const provenance = {
    kind:'supplied-elevation-table/1', fileName:'F'.repeat(200), line:2,
    datum:'D'.repeat(160), source:'S'.repeat(240), unit:'m',
    elevationValue:0, uncertaintyValue:0, cellSizeM:p.weather.cellSizeM,
  };
  const cell = {elevationM:0, surface:'turf', provenance:'P'.repeat(240), terrainSource:provenance};
  p.existing = Array.from({length:576}, (_,i)=>({...cell,terrainSource:{...provenance,line:i+2}}));
  p.proposal = structuredClone(p.existing);
  return validateProject(p);
}

test('max supported sourced-grid project has a complete portable export the same importer accepts', () => {
  const p=sourceRichSite(), before=structuredClone(p);
  const saved=serializePortableProject(p), bytes=new Blob([saved]).size;
  assert.ok(bytes>1_000_000,'reproduce the former 1 MB importer refusal');
  assert.ok(bytes<MAX_PROJECT_FILE_BYTES,'the declared transfer bound must cover this validated project');
  assert.deepEqual(parsePortableProject(saved),p);
  assert.deepEqual(p,before,'the saving/reopening path must not mutate or adopt source state');
  assert.equal(parsePortableProject(saved).proposal[575].terrainSource.line,577);
});

test('size check counts encoded bytes and rejects malformed/unbounded size without truncation',()=>{
  checkProjectFileBytes(MAX_PROJECT_FILE_BYTES);
  for(const n of [-1,NaN,Infinity,MAX_PROJECT_FILE_BYTES+1,1.25]) {
    assert.throws(()=>checkProjectFileBytes(n),/exceeds/);
  }
  const p=makeExample();p.retainedNotes='🙂'.repeat(1_100_000);
  assert.ok(JSON.stringify(p).length<MAX_PROJECT_FILE_BYTES,'UTF-16 units alone would undercount bytes');
  assert.throws(()=>serializePortableProject(p),/4 MiB/);
  assert.throws(()=>parsePortableProject(JSON.stringify(p)),/4 MiB/);
  assert.deepEqual(parsePortableProject(serializePortableProject(makeExample())),makeExample());
});

test('valid length does not overrule JSON, survey provenance or project schema validation',()=>{
  for(const bad of ['', 'not-json', '{"schema":"wrong"}', 3, null]) assert.throws(()=>parsePortableProject(bad));
  const p=sourceRichSite();p.existing[0].terrainSource.elevationValue=2;
  assert.throws(()=>parsePortableProject(JSON.stringify(p)),/Terrain elevation disagrees/);
  assert.throws(()=>serializePortableProject(p),/Terrain elevation disagrees/);
});
