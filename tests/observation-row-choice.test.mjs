import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, validateProject } from '../core.js';
import { previewObservationTable, commitObservationPreview } from '../observation-table.js';
import { previewObservationChoices, commitObservationChoices } from '../observation-row-choice.js';
const header='cell,minute,depth,uncertainty,unit,source';
const csv=(...rows)=>[header,...rows].join('\n');
const fresh=()=>{const p=structuredClone(makeExample());p.observations=[];validateProject(p);return p;};
const seed=(p,text,name)=>commitObservationPreview(p,previewObservationTable(text,p,name));

test('explicit original physical lines preserve raw strings and source order',()=>{
 const p=fresh(),before=structuredClone(p);
 const text=['\uFEFF'+header+',scenario,use','A1,15,010.00,01.0,mm,"first','logger",existing,calibration','B1,30,20,.2,mm,second,existing,challenge','A1,45,30,.3,mm,third,existing,calibration'].join('\n');
 const preview=previewObservationChoices(text,p,'multiline-bom.csv'),prior=structuredClone(preview);
 assert.deepEqual(preview.readings.map(r=>r.tableSource.line),[2,4,5]);
 const next=commitObservationChoices(p,preview,[5,2]);
 assert.deepEqual(next.observations,[preview.readings[0],preview.readings[2]]);
 assert.deepEqual(next.observations.map(r=>r.tableSource.line),[2,5]);
 assert.equal(next.observations[0].tableSource.depthValue,'010.00');
 assert.equal(next.observations[0].tableSource.uncertaintyValue,'01.0');
 assert.deepEqual(p,before);assert.deepEqual(preview,prior);validateProject(next);
});

test('station provenance and exact unit source strings survive cloned selected commit',()=>{
 const p=fresh(),mapping={source:'Independent receiving placement',entries:[{station:'east',cell:'B2'}]};
 const original=structuredClone(mapping);
 const preview=previewObservationChoices('station,minute,depth,uncertainty,unit,source,scenario,use\neast,15,1,.1,cm,logger,existing,calibration',p,'stations.csv',mapping);
 const origin=structuredClone(preview.readings[0].tableSource),next=commitObservationChoices(p,preview,[2]);
 assert.equal(origin.stationValue,'east');assert.equal(origin.depthValue,'1');assert.equal(origin.uncertaintyValue,'.1');assert.equal(origin.unit,'cm');
 assert.deepEqual(next.observations[0].tableSource,origin);assert.deepEqual(mapping,original);
 assert.notStrictEqual(next.observations[0].tableSource.stationMapping,preview.readings[0].tableSource.stationMapping);
 assert.equal(next.observations[0].depthMm,10);validateProject(next);
});

test('existing duplicate may be excluded; selected duplicate refuses atomically and permits retry',()=>{
 const row='A1,30,10,1,mm,ruler',p=seed(fresh(),csv(row),'existing.csv'),before=structuredClone(p);
 const preview=previewObservationChoices(csv(row,'B1,60,20,.2,mm,second'),p,'existing.csv'),prior=structuredClone(preview);
 for(const choice of [[2],[2,3]]){assert.throws(()=>commitObservationChoices(p,preview,choice),/already/);assert.deepEqual(p,before);assert.deepEqual(preview,prior);}
 const next=commitObservationChoices(p,preview,[3]);
 assert.deepEqual(next.observations,[p.observations[0],preview.readings[1]]);
 assert.deepEqual(p,before);assert.deepEqual(preview,prior);
});

test('99 existing observations allow one selected row but refuse two with no partial append',()=>{
 const p=seed(fresh(),csv(...Array.from({length:99},(_,i)=>'A1,30,10,1,mm,seed-'+i)),'seed.csv'),before=structuredClone(p);
 const preview=previewObservationChoices(csv('A1,15,10,1,mm,new-first','B1,45,20,.2,mm,new-second'),p,'new.csv'),prior=structuredClone(preview);
 assert.throws(()=>commitObservationChoices(p,preview,[2,3]),/100/);
 assert.deepEqual(p,before);assert.deepEqual(preview,prior);
 const next=commitObservationChoices(p,preview,[3]);
 assert.equal(next.observations.length,100);assert.deepEqual(next.observations.slice(0,99),p.observations);
 assert.deepEqual(next.observations[99],preview.readings[1]);validateProject(next);
});

test('malformed unselected source rows refuse full admission',()=>{
 const p=fresh(),before=structuredClone(p);
 for(const invalid of ['B1,30,not-a-number,.2,mm,invalid','B1,30,20,.2,feet,invalid','Z99,30,20,.2,mm,invalid']){
  assert.throws(()=>previewObservationChoices(csv('A1,15,10,1,mm,valid',invalid),p,'bad.csv'),/Line 3/);
  assert.deepEqual(p,before);
 }
});

test('invalid original project cannot be hidden by the preview-only observations replacement',()=>{
 const p=fresh();p.observations=[null];const before=structuredClone(p);
 assert.throws(()=>validateProject(p));assert.throws(()=>previewObservationChoices(csv('A1,30,10,1,mm,ruler'),p,'invalid-project.csv'));
 assert.deepEqual(p,before);
});

test('selection is explicitly nonempty, unique numeric source lines, with no absent-line fallback',()=>{
 const p=fresh(),preview=previewObservationChoices(csv('A1,15,10,1,mm,first','B1,30,20,.2,mm,second'),p,'choices.csv');
 const before=structuredClone(p),prior=structuredClone(preview);
 for(const lines of [undefined,null,[],2,'2',{},[2,2],['2'],[2.5],[0],[-1],[NaN],[Infinity],[Number.MAX_SAFE_INTEGER+1],[1],[4],[2,4]]){
  assert.throws(()=>commitObservationChoices(p,preview,lines));
  assert.deepEqual(p,before);assert.deepEqual(preview,prior);
 }
});

test('ambiguous preview row identities cannot silently select more than requested',()=>{
 const p=fresh(),preview=previewObservationChoices(csv('A1,15,10,1,mm,first'),p);
 const forged={...preview,readings:[preview.readings[0],structuredClone(preview.readings[0])]};
 assert.throws(()=>commitObservationChoices(p,forged,[2]),/ambiguous/);
 assert.equal(p.observations.length,0);
});

test('changed notebook or site is rejected by the original preview-context gate',()=>{
 const p=fresh(),preview=previewObservationChoices(csv('A1,15,10,1,mm,candidate'),p,'pending.csv');
 const changed=seed(p,csv('B1,30,20,.2,mm,intervening'),'intervening.csv'),before=structuredClone(changed);
 assert.throws(()=>commitObservationChoices(changed,preview,[2]),/changed/);assert.deepEqual(changed,before);
 p.weather.rainMmHr++;assert.throws(()=>commitObservationChoices(p,preview,[2]),/changed/);
});

test('successful commit clones both existing and selected observations',()=>{
 const p=seed(fresh(),csv('A1,15,10,1,mm,existing'),'old.csv');
 const preview=previewObservationChoices(csv('B1,30,20,.2,mm,new'),p,'new.csv');
 const before=structuredClone(p),prior=structuredClone(preview),next=commitObservationChoices(p,preview,[2]);
 assert.notStrictEqual(next.observations[0],p.observations[0]);assert.notStrictEqual(next.observations[1],preview.readings[0]);
 next.observations[0].tableSource.depthValue='edited';next.observations[1].tableSource.depthValue='edited';
 assert.deepEqual(p,before);assert.deepEqual(preview,prior);
});

test('same raw data on distinct source lines retains distinct origins',()=>{
 const p=fresh(),row='A1,30,10,1,mm,ruler',preview=previewObservationChoices(csv(row,row),p,'distinct.csv');
 const next=commitObservationChoices(p,preview,[3,2]);assert.deepEqual(next.observations.map(r=>r.tableSource.line),[2,3]);validateProject(next);
});

test('source-wide admission still retains the 100-row bound',()=>{
 const p=fresh();assert.throws(()=>previewObservationChoices(csv(...Array.from({length:101},(_,i)=>'A1,30,10,1,mm,source-'+i)),p,'too-many.csv'),/100/);
 assert.equal(p.observations.length,0);
});

test('unchanged ordinary API still appends all rows and refuses existing duplicates',()=>{
 const p=fresh(),text=csv('A1,15,10,1,mm,first','B1,30,20,.2,mm,second'),preview=previewObservationTable(text,p,'ordinary.csv');
 const next=commitObservationPreview(p,preview);assert.deepEqual(next.observations,preview.readings);assert.equal(next.observations.length,2);
 assert.throws(()=>previewObservationTable(text,next,'ordinary.csv'),/already/);assert.equal(p.observations.length,0);
});

test('unchanged ordinary API still applies combined notebook capacity before preview',()=>{
 const p=seed(fresh(),csv(...Array.from({length:99},(_,i)=>'A1,30,10,1,mm,original-'+i)),'original-seed.csv');
 assert.throws(()=>previewObservationTable(csv('A1,15,10,1,mm,one','B1,45,20,.2,mm,two'),p,'new.csv'),/100/);
 assert.equal(p.observations.length,99);
});
