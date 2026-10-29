import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, validateProject } from '../core.js';
import { previewObservationTable } from '../observation-table.js';
import { serializeObservationCSV } from '../observation-export.js';

const reading = (changes = {}) => ({
  cellIndex: 0, minute: 0, depthMm: 0, uncertaintyMm: 0,
  source: 'Authored receiving control', ...changes,
});
const comparable = o => ({
  cellIndex: o.cellIndex, minute: o.minute, depthMm: o.depthMm,
  uncertaintyMm: o.uncertaintyMm,
  source: o.source.replace(/\r\n?/g, '\n').trim(),
  scenario: o.scenario === undefined ? 'unassigned' : o.scenario,
  use: o.use === undefined ? 'unassigned' : o.use,
});
const fresh = project => ({ ...structuredClone(project), observations: [] });

test('literal CSV contract uses the actual nonsquare grid, explicit units and legacy roles', () => {
  const project = makeExample();
  project.observations = [reading(), reading({ cellIndex: 47, minute: 2.5,
    depthMm: 0.30000000000000004, uncertaintyMm: 1e-7, source: 'Second reading',
    scenario: 'proposal', use: 'challenge' })];
  assert.equal(serializeObservationCSV(project),
    'cell,minute,depth,uncertainty,unit,source,scenario,use\r\n' +
    'A1,0,0,0,mm,Authored receiving control,unassigned,unassigned\r\n' +
    'H6,2.5,0.30000000000000004,1e-7,mm,Second reading,proposal,challenge\r\n');
});

test('mixed imported units and manual readings survive normalized reimport without changing provenance', () => {
  const project = makeExample();
  const imported = previewObservationTable(
    'cell,minute,depth,uncertainty,unit,source,scenario,use\n' +
    'B2,12.25,.3,.1,in,Original inch ruler,existing,calibration\n' +
    'C3,30,1.2,.05,cm,Original cm ruler,proposal,challenge',
    project, 'original-units.csv').readings;
  project.observations = [...imported, reading({ cellIndex: 47, minute: 60, source: 'Manual reading' })];
  const before = structuredClone(project);
  const text = serializeObservationCSV(project);
  const restored = previewObservationTable(text, fresh(project), 'normalized.csv').readings;
  assert.deepEqual(restored.map(comparable), before.observations.map(comparable));
  assert.deepEqual(project, before);
  assert.equal(project.observations[0].tableSource.unit, 'in');
  assert.equal(restored[0].tableSource.unit, 'mm');
  assert.equal(restored.length, project.observations.length);
});

test('escaped source text stays verbatim in the file while the existing reader canonicalizes it', () => {
  const project = makeExample();
  project.observations = [reading({ minute: .1, depthMm: .30000000000000004,
    uncertaintyMm: 1e-7, source: '  lab, "A"\r\nsecond\rthird\nlast  ',
    scenario: 'existing', use: 'challenge' })];
  const csv = serializeObservationCSV(project);
  assert.ok(csv.includes('"  lab, ""A""\r\nsecond\rthird\nlast  "'));
  const restored = previewObservationTable(csv, fresh(project)).readings[0];
  assert.equal(restored.source, 'lab, "A"\nsecond\nthird\nlast');
  assert.equal(restored.minute, .1);
  assert.equal(restored.depthMm, .30000000000000004);
  assert.equal(restored.uncertaintyMm, 1e-7);
});

test('maximum valid Unicode notebook fits the existing import byte and row limits', () => {
  const project = makeExample();
  project.width = project.height = 24;
  project.existing = Array.from({ length: 576 }, () => structuredClone(project.existing[0]));
  project.proposal = structuredClone(project.existing);
  project.weather.durationMinutes = 720;
  project.observations = Array.from({ length: 100 }, (_, n) => reading({
    cellIndex: 575, minute: 720, depthMm: 1000, uncertaintyMm: 1000,
    source: String.fromCodePoint(0x4E00 + n).repeat(200),
  }));
  const csv = serializeObservationCSV(project);
  assert.ok(new TextEncoder().encode(csv).byteLength <= 128000);
  const rows = previewObservationTable(csv, fresh(project)).readings;
  assert.equal(rows.length, 100);
  assert.equal(rows[99].cellIndex, 575);
  assert.ok(csv.includes('X24,720,1000,1000,mm,'));
  assert.deepEqual(rows.map(comparable), project.observations.map(comparable));
});

test('paired Unicode, subnormal numbers and signed zeros are retained', () => {
  const project = makeExample();
  project.observations = [reading({ minute: Number.MIN_VALUE, depthMm: Number.MIN_VALUE,
    uncertaintyMm: -0, source: '😀'.repeat(100) })];
  const rows = previewObservationTable(serializeObservationCSV(project), fresh(project)).readings;
  assert.equal(rows[0].source, project.observations[0].source);
  assert.equal(rows[0].minute, Number.MIN_VALUE);
  assert.equal(rows[0].depthMm, Number.MIN_VALUE);
  assert.ok(Object.is(rows[0].uncertaintyMm, -0));
});

test('unrepresentable source text refuses before encoding and leaves the complete project available', () => {
  for (const source of ['A\uD800B', 'A\uDC00B', '\uD800', '\uDC00']) {
    const project = makeExample();
    project.observations = [reading({ source })];
    validateProject(project);
    const before = JSON.stringify(project);
    assert.throws(() => serializeObservationCSV(project), /row 1.*source text.*UTF-8 CSV/);
    assert.equal(JSON.stringify(project), before);
    assert.equal(JSON.parse(before).observations[0].source, source);
  }
});

test('empty, invalid and contradictory provenance fail without repair or omitted rows', () => {
  const project = makeExample();
  assert.throws(() => serializeObservationCSV(project), /Add a reading/);
  project.observations = [reading(), reading({ depthMm: Infinity })];
  const before = structuredClone(project);
  assert.throws(() => serializeObservationCSV(project), /Invalid observation/);
  assert.deepEqual(project, before);
  project.observations = previewObservationTable(
    'cell,minute,depth,uncertainty,unit,source\nA1,1,1,.1,cm,Original source', makeExample()).readings;
  project.observations[0].depthMm = 11;
  assert.throws(() => serializeObservationCSV(project), /retained unit conversion/);
});
