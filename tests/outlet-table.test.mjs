import test from 'node:test';import assert from 'node:assert/strict';
import {makeExample,validateProject} from '../core.js';
import {previewOutletTable,commitOutletTablePreview} from '../outlet-table.js';
import {compareOutletEvidence} from '../outlet-evidence.js';
const settings={target:'existing',eventRef:'Authored CSV event',collectionSource:'Declared all-boundary collection, not field data',coverage:'all-modeled-edges',ratesPerHour:[0,.1,.2]};
const header='start_minute,end_minute,volume,uncertainty,unit,source,use';
const csv=header+'\r\n7,37,16000,500,mL,"Source, with comma\nand a second line",calibration\r\n37,60,.0264,.001,m3,"Quoted ""record""",challenge';
test('whole-file preview and commit preserve original quantities, physical lines and sources',()=>{
 const p=makeExample(),before=structuredClone(p),v=previewOutletTable(csv,p,settings,'original.csv');assert.deepEqual(p,before);assert.equal(v.readings[1].tableSource.line,4);assert.equal(v.readings[0].source,'Source, with comma\nand a second line');
 const q=commitOutletTablePreview(p,settings,v);assert.deepEqual(p,before);assert.equal(q.outletEvidence.readings[0].volume,16000);assert.equal(q.outletEvidence.readings[1].tableSource.volumeValue,'.0264');
 const roundtrip=JSON.parse(JSON.stringify(q));validateProject(roundtrip);assert.deepEqual(compareOutletEvidence(roundtrip),compareOutletEvidence(q));assert.throws(()=>commitOutletTablePreview(q,settings,v),/changed/);assert.throws(()=>previewOutletTable(csv,q,settings,'original.csv'),/already retained/);
});
test('native quantity provenance refuses tampering while evidence roles remain editable',()=>{
 const p=makeExample(),q=commitOutletTablePreview(p,settings,previewOutletTable(csv,p,settings));const changed=structuredClone(q);changed.outletEvidence.readings[0].volume++;assert.throws(()=>validateProject(changed),/original table/);
 const unit=structuredClone(q);unit.outletEvidence.readings[0].unit='L';assert.throws(()=>validateProject(unit));
 const source=structuredClone(q);source.outletEvidence.readings[0].source='Rewritten source';assert.throws(()=>validateProject(source));
 const oversizedRole=structuredClone(q);oversizedRole.outletEvidence.readings[0].tableSource.useValue=' '.repeat(65);assert.throws(()=>validateProject(oversizedRole));
 q.outletEvidence.readings[0].use='challenge';validateProject(q);assert.equal(q.outletEvidence.readings[0].tableSource.useValue,'calibration');
});
test('whole malformed file refuses before mutation and missing roles remain notebook-only',()=>{
 const p=makeExample(),before=JSON.stringify(p);for(const text of [header+'\n0,5,1,0,watts,x,calibration',header+'\n0,5,1,0,L,x,calibration\n4,3,2,0,L,y,challenge',header+'\n0,5,1,0,L,"unterminated',header+',extra\n0,5,1,0,L,x,calibration,no'])assert.throws(()=>previewOutletTable(text,p,settings));
 assert.equal(JSON.stringify(p),before);assert.throws(()=>previewOutletTable(csv,p,{...settings,coverage:'partial'}));
 const v=previewOutletTable('start_minute,end_minute,volume,uncertainty,unit,source\n0,5,1,0,L,original',p,settings);assert.equal(v.readings[0].use,'unassigned');
});
test('byte, row, total capacity and stale settings all refuse atomically',()=>{
 const p=makeExample();assert.throws(()=>previewOutletTable('é'.repeat(64001),p,settings),/UTF-8/);
 const eighty=header+'\n'+Array.from({length:80},(_,i)=>`0,5,${i},0,L,row${i},unassigned`).join('\n');const v=previewOutletTable(eighty,p,settings),q=commitOutletTablePreview(p,settings,v);assert.equal(q.outletEvidence.readings.length,80);
 assert.throws(()=>previewOutletTable(header+'\n0,5,1,0,L,new,unassigned',q,settings,'new.csv'),/80/);assert.throws(()=>previewOutletTable(eighty+'\n0,5,1,0,L,extra,unassigned',p,settings),/80/);
 assert.throws(()=>commitOutletTablePreview(p,{...settings,eventRef:'different'},v),/changed/);p.weather.rainMmHr++;assert.throws(()=>commitOutletTablePreview(p,settings,v),/changed/);
});

test('an inconsistent retained event duration cannot admit collections outside the current event',()=>{
 const p=makeExample(),q=commitOutletTablePreview(p,settings,previewOutletTable(csv,p,settings));q.outletEvidence.durationMinutes=720;const before=JSON.stringify(q);
 assert.throws(()=>previewOutletTable(header+'\n300,400,1,0,L,source,calibration',q,settings,'different.csv'),/duration/);assert.equal(JSON.stringify(q),before);
});
