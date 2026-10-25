import test from 'node:test';import assert from 'node:assert/strict';
import {makeExample,validateProject} from '../core.js';
import {previewObservationTable,commitObservationPreview} from '../observation-table.js';
import {compareInfiltration} from '../infiltration-study.js';
const mapping={source:'Authored placement control',entries:[{station:'east',cell:'B2'},{station:'west',cell:'D4'}]};
const csv='station,minute,depth,uncertainty,unit,source,scenario,use\neast,20,7,1,mm,"control\nmultiline",existing,calibration\nwest,45,3,1,mm,control,existing,challenge';
const intake=(text=csv,map=mapping)=>{const p=makeExample();return commitObservationPreview(p,previewObservationTable(text,p,'original.csv',map))};
test('original station IDs, placement source and multiline row locations survive normal reopen',()=>{
 const p=intake();assert.deepEqual(p.observations.map(r=>r.cellIndex),[9,27]);assert.deepEqual(p.observations.map(r=>r.tableSource.line),[2,4]);
 assert.equal(p.observations[0].tableSource.stationMapping.station,'east');assert.equal(p.observations[0].source,'control\nmultiline');
 assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
 const changed=structuredClone(mapping);changed.entries[0].cell='C2';assert.deepEqual(intake(csv,changed).observations.map(r=>r.cellIndex),[10,27]);
});
test('mapped original rows produce exactly the same calibration/challenge results as equivalent cell rows',()=>{
 const p=intake(),original=makeExample(),q=commitObservationPreview(original,previewObservationTable(csv.replace('station,','cell,').replace('east,','B2,').replace('west,','D4,'),original));
 const study={target:'existing',surface:'sealed',ratesMmHr:[1,9,22]};assert.deepEqual(compareInfiltration(p,study),compareInfiltration(q,study));
});
test('missing, duplicate, out-of-grid or unsourced station declarations refuse before mutation',()=>{
 for(const map of [null,{...mapping,source:''},{...mapping,entries:mapping.entries.slice(0,1)},{...mapping,entries:[mapping.entries[0],mapping.entries[0]]},{...mapping,entries:[{station:'east',cell:'Z99'}]}]){
 const p=makeExample(),before=JSON.stringify(p);assert.throws(()=>previewObservationTable(csv,p,'original.csv',map));assert.equal(JSON.stringify(p),before);
 }
 assert.throws(()=>previewObservationTable(csv.replace('station,','station,cell,'),makeExample(),'original.csv',mapping));
});
test('changed derived cell or grid cannot silently retain contradictory original station custody',()=>{
 const p=intake();p.observations[0].cellIndex++;assert.throws(()=>validateProject(p),/retained station mapping/);
 const q=intake();q.observations[0].tableSource.stationMapping.gridWidth--;assert.throws(()=>validateProject(q),/different grid dimensions/);
});
test('station mapping coexists with retained clock offsets and duplicate detection',()=>{
 const text='station,timestamp,event_start,depth,uncertainty,unit,source\neast,2026-10-25T01:15:30+02:00,2026-10-24T23:00:00Z,1,.1,cm,control';
 const p=intake(text);assert.equal(p.observations[0].minute,15.5);assert.equal(p.observations[0].tableSource.stationMapping.cell,'B2');
 assert.throws(()=>previewObservationTable(text,p,'original.csv',mapping),/already/);
 const relocated=structuredClone(mapping);relocated.entries[0].cell='C2';assert.throws(()=>previewObservationTable(text,p,'original.csv',relocated),/already/);
 const next=structuredClone(mapping);next.source='Same declared placement, different description';assert.throws(()=>previewObservationTable(text,p,'original.csv',next),/already/);
});

test('original whitespace-bearing station tokens survive and cannot be forged on reopen',()=>{
 const p=intake(csv.replace('east,','" east ",'));assert.equal(p.observations[0].tableSource.stationValue,' east ');
 assert.equal(p.observations[0].tableSource.stationMapping.station,'east');assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
 p.observations[0].tableSource.stationValue='west';assert.throws(()=>validateProject(p),/station token/);
 const q=intake();delete q.observations[0].tableSource.stationValue;assert.throws(()=>validateProject(q),/station token/);
});
