import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeExample,validateProject} from '../core.js';
import {admitEditorSelection} from '../editor-selection.js';

const missing=(width,height)=>{
  const p=makeExample();p.width=width;p.height=height;
  p.existing=p.existing.slice(0,width*height);
  p.proposal=p.proposal.slice(0,width*height);
  p.observations=[];
  delete p.selectedIndex;
  return validateProject(p);
};

for(const [width,height] of [[2,2],[8,6],[3,4]]) {
  test('selection-free '+width+'x'+height+' projects remain valid, and editor admission only supplies focus',()=>{
    const project=missing(width,height);
    const before=JSON.stringify(project);
    const adopted=admitEditorSelection(project);
    assert.notStrictEqual(adopted,project);
    assert.equal(adopted.selectedIndex,0);
    assert.equal(project.selectedIndex,undefined);
    assert.equal(JSON.stringify(project),before);
    const {selectedIndex,...site}=adopted;
    assert.deepEqual(site,project);
    assert.equal(validateProject(adopted),adopted);
  });
}
test('explicit valid editor focus is preserved without copying its source',()=>{
  const original=missing(2,2);original.selectedIndex=3;
  assert.equal(admitEditorSelection(original),original);
  assert.equal(admitEditorSelection(original).selectedIndex,3);
});
test('invalid selections remain invalid: UI normalization cannot reclassify them',()=>{
  for(const invalid of [-1,4,1.5,null,'1']) {
    const project=missing(2,2);project.selectedIndex=invalid;
    assert.throws(()=>validateProject(admitEditorSelection(project)),/Selected cell out of range/);
  }
});
