import test from 'node:test';
import assert from 'node:assert/strict';
import {observationMinute, timestampMillis} from '../observation-clock.js';
import {makeExample, validateProject} from '../core.js';
import {previewObservationTable, commitObservationPreview} from '../observation-table.js';
const header='cell,timestamp,event_start,depth,uncertainty,unit,source,scenario,use';
const csv=(time='2026-10-25T01:15:30+02:00',start='2026-10-24T23:00:00Z')=>`${header}\nA1,${time},${start},1,.1,cm,logger,existing,calibration`;
test('independent offsets and midnight retain fractional minutes',()=>{
 assert.equal(observationMinute('2026-10-25T01:15:30+02:00','2026-10-24T23:00:00Z'),15.5);
 assert.equal(observationMinute('2024-03-01T00:00:00.120Z','2024-02-29T23:59:00.000Z'),1.002);
 assert.equal(observationMinute('2026-11-01T01:30:00-05:00','2026-11-01T01:30:00-04:00'),60);
});
test('ambiguous and impossible calendar tokens cannot normalize into evidence',()=>{
 for(const bad of ['2026-02-29T00:00:00Z','2024-04-31T00:00:00Z','2026-01-01T24:00:00Z','2026-01-01T00:00:60Z','2026-01-01T00:00:00','2026-01-01T00:00:00-00:00','2026-01-01T00:00:00+24:00','2026-01-01T00:00:00.0001Z']) assert.throws(()=>timestampMillis(bad),bad);
 assert.throws(()=>observationMinute('2026-01-01T00:00:00Z','2026-01-01T00:01:00Z'),/precedes/);
});
test('actual notebook import retains raw clocks and refuses changed conversion on reopen',()=>{
 const p=makeExample(), before=JSON.stringify(p), preview=previewObservationTable(csv(),p);
 assert.equal(preview.readings[0].minute,15.5); assert.equal(preview.readings[0].depthMm,10);
 const next=commitObservationPreview(p,preview);assert.equal(JSON.stringify(p),before);
 assert.deepEqual(validateProject(JSON.parse(JSON.stringify(next))).observations,next.observations);
 next.observations[0].minute=20;assert.throws(()=>validateProject(next),/clock conversion/);
});
test('missing or conflicting clock columns and mixed event starts refuse',()=>{
 const p=makeExample();
 for(const text of [csv().replace('timestamp,event_start','timestamp,minute'),csv().replace('timestamp,event_start','minute,event_start'),csv()+ '\nB1,2026-10-25T01:15:30+02:00,2026-10-24T23:01:00Z,1,.1,cm,logger,existing,challenge']) assert.throws(()=>previewObservationTable(text,p));
 const preview=previewObservationTable(csv(),p);p.weather.rainMmHr++;assert.throws(()=>commitObservationPreview(p,preview),/changed/);
});
test('relative-minute consumer remains available and duplicate source rows refuse',()=>{
 const p=makeExample();const relative=previewObservationTable('cell,minute,depth,uncertainty,unit,source\nA1,15.5,10,1,mm,logger',p);
 assert.equal(relative.readings[0].minute,15.5);assert.equal(relative.readings[0].tableSource.timestamp,undefined);
 const next=commitObservationPreview(p,previewObservationTable(csv(),p));assert.throws(()=>previewObservationTable(csv(),next),/already/);
});

test('source identity distinguishes event instants but canonicalizes equivalent offsets',()=>{
 const p=makeExample();const next=commitObservationPreview(p,previewObservationTable(csv(),p,'logger.csv'));
 const equivalent=csv('2026-10-24T23:15:30Z','2026-10-25T01:00:00+02:00');
 assert.throws(()=>previewObservationTable(equivalent,next,'logger.csv'),/already/);
 const distinct=csv('2026-10-26T01:15:30+02:00','2026-10-25T23:00:00Z');
 const updated=commitObservationPreview(next,previewObservationTable(distinct,next,'logger.csv'));
 assert.equal(updated.observations.length,2);assert.equal(updated.observations[0].minute,updated.observations[1].minute);
 assert.notEqual(updated.observations[0].tableSource.timestamp,updated.observations[1].tableSource.timestamp);
});
