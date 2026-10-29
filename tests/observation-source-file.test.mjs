import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeExample } from '../core.js';
import { previewObservationTable, commitObservationPreview } from '../observation-table.js';
import { admitObservationCsv, serializeObservationSource, parseObservationSource, originalObservationCsvBytes,
  MAX_OBSERVATION_CSV_BYTES, MAX_OBSERVATION_SOURCE_BYTES } from '../observation-source-file.js';

const text = '\uFEFFstation,minute,depth,uncertainty,unit,source,scenario,use\r\n" east ",30,.3,.1,in,"gauge, α\r\nsecond line",existing,challenge\r\nwest,60,12,1,mm,"operator ""B""",existing,calibration\r\n';
const bytes = Buffer.from(text);
const mapText = ' \n{"source":"original placement notebook","entries":[{"station":"east","cell":"B2"},{"station":"west","cell":"C3"}]}\n ';
const checksum = value => createHash('sha256').update(value).digest('hex');

test('original BOM, CRLF, quoted multiline source and Unicode survive exact source-file reopening', async () => {
  const source = await admitObservationCsv(bytes, 'logger-α.csv');
  assert.equal(source.text, text);
  assert.equal(source.table.sha256, checksum(bytes));
  const saved = await serializeObservationSource(source, mapText);
  const reopened = await parseObservationSource(saved);
  assert.deepEqual(Buffer.from(originalObservationCsvBytes(reopened.source)), bytes);
  assert.equal(reopened.stationMapText, mapText);
  assert.equal(reopened.source.table.fileName, 'logger-α.csv');
  assert.ok(Object.isFrozen(reopened.source) && Object.isFrozen(reopened.source.table));
});

test('unchanged parser reproduces original lines, station tokens, units and explicit evidence roles', async () => {
  const project = makeExample();
  const original = previewObservationTable(text, project, 'capture.csv', JSON.parse(mapText));
  const reopened = await parseObservationSource(await serializeObservationSource(await admitObservationCsv(bytes, 'capture.csv'), mapText));
  const received = previewObservationTable(reopened.source.text, project, reopened.source.table.fileName, JSON.parse(reopened.stationMapText));
  assert.deepEqual(received, original);
  assert.equal(received.readings[0].tableSource.line, 2);
  assert.equal(received.readings[1].tableSource.line, 4);
  assert.equal(received.readings[0].tableSource.stationValue, ' east ');
  assert.equal(received.readings[0].depthMm, 0.3 * 25.4);
  assert.equal(received.readings[0].use, 'challenge');
});

test('tampering, noncanonical bytes, unknown fields and invalid source identities are refused', async () => {
  const packet = JSON.parse(await serializeObservationSource(await admitObservationCsv(bytes, 'original.csv'), mapText));
  const variants = [
    p => { p.table.sha256 = '0'.repeat(64); },
    p => { p.table.byteLength++; },
    p => { p.table.base64 = ' ' + p.table.base64; },
    p => { p.table.fileName = ''; },
    p => { p.table.extra = 'derived'; },
    p => { p.result = { accepted: true }; },
    p => { p.project = makeExample(); },
    p => { p.format = 'unknown'; },
    p => { p.stationMapText = {}; },
  ];
  for (const mutate of variants) {
    const candidate = structuredClone(packet); mutate(candidate);
    await assert.rejects(parseObservationSource(JSON.stringify(candidate)));
  }
  const one = JSON.parse(await serializeObservationSource(await admitObservationCsv(new Uint8Array([65]), 'one.csv'), ''));
  one.table.base64 = 'QR=='; // Same decoded byte with invalid padding bits.
  await assert.rejects(parseObservationSource(JSON.stringify(one)), /base64/);
});

test('unfinished supplied maps are preserved literally and remain an interpretation decision', async () => {
  const source = await admitObservationCsv(bytes, 'capture.csv');
  const unfinished = '  {"source":"unfinished",\n';
  const restored = await parseObservationSource(await serializeObservationSource(source, unfinished));
  assert.equal(restored.stationMapText, unfinished);
  assert.throws(() => JSON.parse(restored.stationMapText));
  await assert.rejects(serializeObservationSource(source, ' '.repeat(32001)), /32 KB/);
  await assert.rejects(serializeObservationSource(source, '\uD800'), /Unicode/);
});

test('admission snapshots typed arrays including Node Buffer before asynchronous hashing', async () => {
  const mutable = Buffer.from(bytes);
  const pending = admitObservationCsv(mutable, 'snapshot.csv');
  mutable.fill(65);
  const accepted = await pending;
  assert.deepEqual(Buffer.from(originalObservationCsvBytes(accepted)), bytes);
  assert.equal(accepted.table.sha256, checksum(bytes));
});

test('serialization freezes offered metadata before its asynchronous identity check', async () => {
  const source = await admitObservationCsv(bytes, 'first.csv');
  const offered = { table: { ...source.table } };
  const pending = serializeObservationSource(offered, '');
  offered.table.fileName = 'changed.csv'; offered.table.sha256 = '0'.repeat(64);
  const saved = JSON.parse(await pending);
  assert.equal(saved.table.fileName, 'first.csv');
  assert.equal(saved.table.sha256, checksum(bytes));
});

test('byte ceilings, malformed UTF-8 and Unicode names are checked before accepting source', async () => {
  await assert.rejects(admitObservationCsv(new Uint8Array(), 'empty.csv'), /empty/);
  await assert.rejects(admitObservationCsv(new Uint8Array(MAX_OBSERVATION_CSV_BYTES + 1), 'large.csv'), /128 KB/);
  await assert.rejects(admitObservationCsv(new Uint8Array([0xc3, 0x28]), 'bad.csv'));
  await assert.rejects(admitObservationCsv(bytes, '\uD800'), /Unicode/);
  await assert.rejects(parseObservationSource(' '.repeat(MAX_OBSERVATION_SOURCE_BYTES + 1)), /512 KB/);
  const accepted = await admitObservationCsv(new Uint8Array(MAX_OBSERVATION_CSV_BYTES).fill(65), 'maximum.csv');
  const saved = await serializeObservationSource(accepted, '\0'.repeat(32000));
  assert.ok(Buffer.byteLength(saved) < MAX_OBSERVATION_SOURCE_BYTES);
  assert.equal((await parseObservationSource(saved)).source.table.byteLength, MAX_OBSERVATION_CSV_BYTES);
});

test('reopened sources still require unchanged project-specific preview and duplicate/history admission', async () => {
  const project = makeExample();
  const source = await admitObservationCsv(bytes, 'capture.csv');
  const reopened = await parseObservationSource(await serializeObservationSource(source, mapText));
  const preview = previewObservationTable(reopened.source.text, project, reopened.source.table.fileName, JSON.parse(reopened.stationMapText));
  const committed = commitObservationPreview(project, preview);
  assert.equal(project.observations.length, 0);
  assert.equal(committed.observations.length, 2);
  assert.throws(() => previewObservationTable(reopened.source.text, committed, reopened.source.table.fileName, JSON.parse(reopened.stationMapText)), /already/);
  const moved = makeExample(); moved.weather.rainMmHr++;
  assert.throws(() => commitObservationPreview(moved, preview), /changed/);
  assert.equal(Object.hasOwn(committed, 'table'), false);
  assert.equal(Object.hasOwn(committed, 'stationMapText'), false);
});
