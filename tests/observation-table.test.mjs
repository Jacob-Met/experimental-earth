import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, validateProject } from '../core.js';
import { previewObservationTable, appendObservations, commitObservationPreview } from '../observation-table.js';

const header = 'cell,minute,depth,uncertainty,unit,source';
const csv = (...rows) => [header, ...rows].join('\n');
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test('explicit inch, centimetre and millimetre quantities convert with original values retained', () => {
  const p = makeExample();
  const r = previewObservationTable(csv('A1,15,1.25,.1,in,ruler A', 'b2,20,1.2,.05,cm,ruler B', 'C3,30,8,2,mm,depth gauge'), p, 'readings.csv');
  close(r.readings[0].depthMm, 31.75); close(r.readings[0].uncertaintyMm, 2.54);
  close(r.readings[1].depthMm, 12); close(r.readings[1].uncertaintyMm, .5);
  close(r.readings[2].depthMm, 8);
  assert.deepEqual(r.readings[0].tableSource, { fileName: 'readings.csv', line: 2, unit: 'in', depthValue: '1.25', uncertaintyValue: '.1' });
  assert.equal(r.readings[1].cellIndex, 9); assert.equal(r.convertedCount, 2);
  assert.equal(r.unassignedCount, 3);
});

test('optional scenario and roles remain explicit and unchanged', () => {
  const text = `${header},scenario,use\nA1,30,10,.2,mm,first,existing,calibration\nB1,60,20,.2,mm,second,existing,challenge`;
  const r = previewObservationTable(text, makeExample());
  assert.equal(r.readings[0].use, 'calibration'); assert.equal(r.readings[1].use, 'challenge');
  assert.equal(r.unassignedCount, 0);
});

test('quoted commas, escaped quotes, CRLF, BOM and multiline sources keep record start lines', () => {
  const text = `\uFEFF${header}\r\nA1,30,10,1,mm,"gauge, A\r\nsecond line"\r\nB1,60,12,1,mm,"operator ""B"""\r\n`;
  const r = previewObservationTable(text, makeExample());
  assert.equal(r.readings[0].source, 'gauge, A\nsecond line');
  assert.equal(r.readings[1].source, 'operator "B"');
  assert.equal(r.readings[0].tableSource.line, 2); assert.equal(r.readings[1].tableSource.line, 4);
});

test('preview and failed import do not mutate existing data; commit clones both sides', () => {
  const p = makeExample(), before = JSON.stringify(p);
  const preview = previewObservationTable(csv('A1,30,10,1,mm,source'), p);
  assert.equal(JSON.stringify(p), before);
  const next = commitObservationPreview(p, preview);
  assert.equal(p.observations.length, 0); assert.equal(next.observations.length, 1);
  next.observations[0].source = 'edited';
  assert.equal(preview.readings[0].source, 'source');
  assert.throws(() => previewObservationTable(csv('A1,30,10,1,mm,good', 'Z99,30,10,1,mm,bad'), p), /Line 3/);
  assert.equal(JSON.stringify(p), before);
});

test('unknown, missing or duplicate headers and inconsistent column counts reject', () => {
  for (const text of [
    'cell,minute,depth,uncertainty,source\nA1,30,10,1,ruler',
    `${header},depth\nA1,30,10,1,mm,ruler,4`,
    `${header},extra\nA1,30,10,1,mm,ruler,x`,
    `${header}\nA1,30,10,1,mm`,
  ]) assert.throws(() => previewObservationTable(text, makeExample()));
});

test('malformed quoting fails with a row location', () => {
  for (const row of ['A1,30,10,1,mm,"unclosed', 'A1,30,10,1,mm,a"b', 'A1,30,10,1,mm,"a"z']) {
    assert.throws(() => previewObservationTable(csv(row), makeExample()), /Line 2/);
  }
});

test('ambiguous units, nondecimal values and out-of-range converted readings reject', () => {
  for (const row of [
    'A1,30,10,1,feet,ruler', 'A1,30,Infinity,1,mm,ruler', 'A1,30,0x10,1,mm,ruler',
    'A1,30,1e309,1,mm,ruler', 'A1,30,-1,1,mm,ruler', 'A1,30,101,1,cm,ruler',
    'A1,30,10,-1,mm,ruler', 'A1,999,10,1,mm,ruler', 'A1,-1,10,1,mm,ruler',
    'A0,30,10,1,mm,ruler', 'I1,30,10,1,mm,ruler', 'A7,30,10,1,mm,ruler', 'A1,30,10,1,mm,',
  ]) assert.throws(() => previewObservationTable(csv(row), makeExample()), /Line 2/);
});

test('empty tables, oversized inputs and exhausted history refuse before appending', () => {
  const p = makeExample();
  for (const text of ['', header, ' '.repeat(128001)]) assert.throws(() => previewObservationTable(text, p));
  const rows = Array.from({ length: 101 }, (_, i) => `A1,30,10,1,mm,source ${i}`);
  assert.throws(() => previewObservationTable(csv(...rows), p), /100/);
  const one = previewObservationTable(csv('A1,30,10,1,mm,source'), p).readings[0];
  p.observations = Array.from({ length: 100 }, () => ({ ...one }));
  assert.throws(() => previewObservationTable(csv('B1,30,10,1,mm,new'), p), /100/);
  assert.throws(() => appendObservations(p, [one]), /100/);
});

test('unsupported evidence role and role without a scenario are not silently admitted', () => {
  for (const suffix of [',existing,training', ',unassigned,calibration', ',future,challenge']) {
    assert.throws(() => previewObservationTable(`${header},scenario,use\nA1,30,10,1,mm,ruler${suffix}`, makeExample()), /Line 2/);
  }
});

test('retained conversion provenance survives JSON and rejects inconsistent quantities', () => {
  const p = makeExample(); const next = commitObservationPreview(p, previewObservationTable(csv('A1,30,.3,.1,in,ruler'), p));
  const restored = validateProject(JSON.parse(JSON.stringify(next)));
  assert.deepEqual(restored.observations, next.observations);
  restored.observations[0].depthMm += 1;
  assert.throws(() => validateProject(restored), /retained unit conversion/);
});

test('stale previews cannot remap cells or append to a changed notebook', () => {
  const p = makeExample(), preview = previewObservationTable(csv('A2,30,10,1,mm,source'), p);
  p.weather.rainMmHr++;
  assert.throws(() => commitObservationPreview(p, preview), /changed/);
  assert.equal(p.observations.length, 0);
});

test('same supplied file-row evidence is not accidentally counted twice', () => {
  const p = makeExample(), text = csv('A1,30,10,1,mm,ruler');
  const next = commitObservationPreview(p, previewObservationTable(text, p, 'capture.csv'));
  assert.throws(() => previewObservationTable(text, next, 'capture.csv'), /already/);
  assert.equal(next.observations.length, 1);
});
