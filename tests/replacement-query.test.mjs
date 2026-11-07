import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnsavedProjectWarning} from '../unsaved-project-warning.js';
function fixture(){
 let project={title:'initial',observations:[]};const events=[];
 const tracker=createUnsavedProjectWarning({target:{addEventListener:(...a)=>events.push(['add',...a]),removeEventListener:(...a)=>events.push(['remove',...a])},getProject:()=>project});
 return {tracker,events,get project(){return project},replace:p=>project=p};
}
test('live replacement query has no persistence or listener effects',()=>{
 const f=fixture();assert.equal(f.tracker.hasUnsavedChanges(),false);
 f.project.title='accepted';assert.equal(f.tracker.hasUnsavedChanges(),true);
 assert.equal(f.tracker.hasUnsavedChanges(),true);assert.deepEqual(f.events,[]);
});
test('query shares exact verified-save baseline',()=>{
 const f=fixture();f.project.title='accepted';f.tracker.refresh();
 assert.equal(f.tracker.hasUnsavedChanges(),true);f.tracker.saved();
 assert.equal(f.tracker.hasUnsavedChanges(),false);f.project.observations.push({depthMm:2});
 assert.equal(f.tracker.hasUnsavedChanges(),true);
});
test('query observes rollback without a refresh',()=>{
 const f=fixture();f.project.title='temporary';f.tracker.refresh();
 f.project.title='initial';assert.equal(f.tracker.hasUnsavedChanges(),false);
});
test('replacement query uses serialized contents, not object identity',()=>{
 const f=fixture();f.replace({title:'initial',observations:[]});
 assert.equal(f.tracker.hasUnsavedChanges(),false);
 f.replace({title:'another',observations:[]});assert.equal(f.tracker.hasUnsavedChanges(),true);
});
