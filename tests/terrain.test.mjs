import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, validateProject, compare } from '../core.js';
import { previewTerrainTable, applyTerrainPreview } from '../terrain-import.js';
const project = () => { const p=makeExample(); p.width=2;p.height=2;p.existing=p.existing.slice(0,4);p.proposal=p.proposal.slice(0,4);p.selectedIndex=0;return p; };
const options={fileName:'survey.csv',datum:'Marked reference point',cellSizeM:2};
const csv='cell,elevation,uncertainty,unit,source\nA1,10,1,cm,"Survey, ruler"\nB1,0.2,0.01,m,level\nA2,-30,2,mm,level\nB2,0,0,m,level\n';
test('mixed-unit survey gives known elevations, source provenance and no source mutation',()=>{
 const p=project(), saved=structuredClone(p), v=previewTerrainTable(csv,p,options);
 assert.deepEqual(v.cells.map(c=>c.elevationM),[.1,.2,-.03,0]);
 assert.equal(v.cells[0].terrainSource.source,'Survey, ruler');
 const next=applyTerrainPreview(p,v,'existing');
 assert.deepEqual(p,saved);assert.deepEqual(next.proposal,p.proposal);assert.deepEqual(next.observations,p.observations);
 assert.deepEqual(next.existing.map(c=>c.surface),p.existing.map(c=>c.surface));
 assert.deepEqual(validateProject(JSON.parse(JSON.stringify(next))),next);
 assert.ok(Math.abs(compare(next).existing.massErrorLiters)<1e-7);
});
test('rejects incomplete, duplicate, misplaced, invalid unit/quantity/source/header atomically',()=>{
 const p=project(), saved=structuredClone(p);
 for(const bad of [csv.replace('B2,0,0,m,level\n',''), csv.replace('B2,','A1,'),csv.replace('B2,','C1,'),csv.replace('10,1,cm','10,1,feet'),csv.replace('10,1,cm','Infinity,1,cm'),csv.replace('10,1,cm','10,-1,cm'),csv.replace('10,1,cm','1001,1,cm'),csv.replace('B2,0,0,m,level','B2,0,0,m,'),csv.replace('source\n','unknown\n'),csv+'B2,0,0,m,level\n']) assert.throws(()=>previewTerrainTable(bad,p,options));
 assert.deepEqual(p,saved);
});
test('datum and spacing must explicitly correspond to current grid',()=>{
 for(const patch of [{datum:''},{cellSizeM:1},{cellSizeM:NaN},{fileName:''}]) assert.throws(()=>previewTerrainTable(csv,project(),{...options,...patch}));
});
test('stale preview cannot overwrite subsequent edits',()=>{
 const p=project(), v=previewTerrainTable(csv,p,options);p.proposal[0].elevationM+=.01;
 assert.throws(()=>applyTerrainPreview(p,v,'existing'),/changed/);
 assert.throws(()=>applyTerrainPreview(project(),v,'both'),/Choose/);
});
test('reopen refuses inconsistent provenance, changed geometry and spacing',()=>{
 const next=applyTerrainPreview(project(),previewTerrainTable(csv,project(),options),'proposal');
 for(const modify of [p=>p.proposal[0].elevationM+=.01,p=>p.weather.cellSizeM=3,p=>p.proposal[0].terrainSource.unit='ft',p=>p.proposal[0].terrainSource.uncertaintyValue=-1]) {const p=structuredClone(next);modify(p);assert.throws(()=>validateProject(p));}
});
test('quoted multiline sources retain physical line numbers and escaped quotes',()=>{
 const v=previewTerrainTable(csv.replace('"Survey, ruler"','"Survey, ""ruler""\nsecond line"'),project(),options);
 assert.equal(v.cells[0].terrainSource.line,2);assert.equal(v.cells[1].terrainSource.line,4);
 assert.equal(v.cells[0].terrainSource.source,'Survey, "ruler"\nsecond line');
});
test('terrain relief changes modeled depths with identical rainfall',()=>{
 const p=project(),next=applyTerrainPreview(p,previewTerrainTable(csv,p,options),'existing');
 const before=compare(p).existing,after=compare(next).existing;
 assert.equal(before.rainLiters,after.rainLiters);assert.notDeepEqual(before.peakDepthMm,after.peakDepthMm);
});
test('supports all 576 cells with bounded input',()=>{
 const p=makeExample();p.width=24;p.height=24;p.existing=Array.from({length:576},()=>({...p.existing[0]}));p.proposal=structuredClone(p.existing);
 const rows=Array.from({length:576},(_,i)=>`${String.fromCharCode(65+i%24)}${Math.floor(i/24)+1},0,0.1,cm,source`).join('\n');
 assert.equal(previewTerrainTable('cell,elevation,uncertainty,unit,source\n'+rows,p,options).cells.length,576);
 assert.throws(()=>previewTerrainTable('x'.repeat(128001),p,options),/128 KB/);
});
