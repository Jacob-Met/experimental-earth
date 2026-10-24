import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample, compare} from '../core.js';
import {prepareSolarStudy} from '../solar-occlusion.js';
import {compareSunPath, sunPathCellCourse, SUN_PATH_MODEL} from '../solar-path.js';
import {buildSunPathInvestigation, serializeSunPathInvestigation, parseSunPathInvestigation,
  reopenSunPathInvestigation, checkSunPathInvestigationBytes,
  MAX_SUN_PATH_INVESTIGATION_BYTES} from '../solar-path-receipt.js';

function fixture() {
  const project = makeExample();
  project.width = 4; project.height = 2; project.selectedIndex = 0;
  project.weather.cellSizeM = 2;
  project.existing = Array.from({length: 8}, () => ({surface: 'turf', elevationM: 0,
    provenance: 'Authored flat control, not a surveyed place'}));
  project.proposal = structuredClone(project.existing);
  project.solarStudy = prepareSolarStudy(project, {headingDeg: 0, elevationDeg: 45,
    sunSource: 'Original single-direction source', existing: [],
    proposal: [{cellIndex: 2, heightMinM: 2, heightMaxM: 2,
      source: '<img src=x onerror=alert(1)> authored column é'}]});
  return project;
}
const input = () => ({latitudeDeg: 51.5, longitudeDeg: -.1, gridColumnBearingDeg: 90,
  locationSource: 'Authored London control coordinates, not a measurement',
  orientationSource: 'Authored east-right and south-down grid',
  startUtc: '2026-06-21T04:00:00Z', endUtc: '2026-06-21T20:00:00Z', stepMinutes: 60});
function freeze(value) {
  if (value && typeof value === 'object') {Object.freeze(value); for (const child of Object.values(value)) freeze(child);}
  return value;
}

test('input-only file retains the original complete source and recomputes the same paired course', () => {
  const source = fixture(), before = structuredClone(source), rain = compare(source);
  const text = serializeSunPathInvestigation(source, input(), 1), raw = JSON.parse(text);
  assert.deepEqual(Object.keys(raw).sort(), ['declaration', 'kind', 'model', 'project', 'selectedCellIndex']);
  assert.deepEqual(raw.project, source); assert.equal(raw.selectedCellIndex, 1);
  assert.equal(raw.declaration.sampleCount, undefined); assert.equal(raw.report, undefined);
  const reopened = parseSunPathInvestigation(text);
  assert.deepEqual(reopened.report, compareSunPath(source, input()));
  assert.equal(sunPathCellCourse(reopened.report, 1)[0].proposal.status, 'blocked');
  assert.equal(sunPathCellCourse(reopened.report, 1).at(-1).proposal.status, 'no-mapped-blocker');
  assert.deepEqual(source, before); assert.deepEqual(compare(source), rain);
  assert.equal(reopened.investigation.project.solarStudy.sunSource, 'Original single-direction source');
});

test('edited valid declared bearing and date produce fresh consequences instead of a saved verdict', () => {
  const original = buildSunPathInvestigation(fixture(), input(), 1);
  const baseline = reopenSunPathInvestigation(original).report;
  const rotated = structuredClone(original); rotated.declaration.gridColumnBearingDeg = 270;
  const revised = reopenSunPathInvestigation(rotated).report;
  assert.equal(baseline.samples[0].proposal[1].status, 'blocked');
  assert.equal(revised.samples[0].proposal[1].status, 'no-mapped-blocker');
  const winter = structuredClone(original);
  winter.declaration.startUtc = '2026-12-21T04:00:00Z'; winter.declaration.endUtc = '2026-12-21T20:00:00Z';
  assert.equal(reopenSunPathInvestigation(winter).report.samples[0].condition, 'below-horizon');
  assert.equal(baseline.samples[0].condition, 'modeled');
  assert.equal(original.declaration.gridColumnBearingDeg, 90);
});

test('a changed source grid cannot reuse the retained column declaration and refusal is nonmutating', () => {
  const retained = buildSunPathInvestigation(fixture(), input());
  retained.project.proposal[0].elevationM = .3;
  const before = structuredClone(retained);
  assert.throws(() => reopenSunPathInvestigation(retained), /ground grid|source changed/i);
  assert.deepEqual(retained, before);
  const changedSource = buildSunPathInvestigation(fixture(), input());
  changedSource.project.source += ' an unrelated place';
  assert.throws(() => reopenSunPathInvestigation(changedSource), /ground grid|source changed/i);
});

test('unsupported model identity, envelope revisions and cached conclusions are refused explicitly', () => {
  const original = buildSunPathInvestigation(fixture(), input());
  for (const key of Object.keys(SUN_PATH_MODEL)) {
    const changed = structuredClone(original); changed.model[key] = 'different';
    assert.throws(() => reopenSunPathInvestigation(changed), /unsupported sun-position model/i);
  }
  for (const modify of [r => {r.kind += '-future';}, r => {r.report = {samples: []};},
    r => {r.model.result = 'clear';}, r => {r.declaration.blockedHours = 4;}, r => {delete r.selectedCellIndex;}]) {
    const changed = structuredClone(original); modify(changed);
    assert.throws(() => reopenSunPathInvestigation(changed), /unsupported|supported|inputs/i);
  }
});

test('retained sample selection is checked against its own grid, including empty or fractional values', () => {
  const source = fixture();
  for (const selected of [-1, 8, .5, '1', null, NaN, Infinity]) {
    assert.throws(() => buildSunPathInvestigation(source, input(), selected), /selected ground sample/i);
  }
  assert.equal(buildSunPathInvestigation(source, input(), 7).selectedCellIndex, 7);
  const retained = buildSunPathInvestigation(source, input(), 1); retained.selectedCellIndex = 48;
  assert.throws(() => reopenSunPathInvestigation(retained), /selected ground sample/i);
});

test('reopen retains strict calendar, source and complete-course budget admission', () => {
  const original = buildSunPathInvestigation(fixture(), input());
  for (const [key, value] of [['startUtc', '2026-02-30T04:00:00Z'], ['endUtc', '2026-06-21T20:00:00-04:00'],
    ['locationSource', ' '], ['orientationSource', ''], ['latitudeDeg', 90], ['stepMinutes', .5]]) {
    const changed = structuredClone(original); changed.declaration[key] = value;
    assert.throws(() => reopenSunPathInvestigation(changed));
  }
  const source = fixture(); source.width = source.height = 24;
  source.existing = Array.from({length: 576}, () => ({surface: 'turf', elevationM: 0, provenance: 'Authored'}));
  source.proposal = structuredClone(source.existing);
  source.solarStudy = prepareSolarStudy(source, {headingDeg: 0, elevationDeg: 45, sunSource: 'Authored', existing: [], proposal: []});
  assert.throws(() => serializeSunPathInvestigation(source, input()), /ray-check budget/i);
});

test('byte bounds run before parsing and count UTF-8 bytes rather than only characters', () => {
  for (const value of [-1, 1.5, Infinity, NaN, MAX_SUN_PATH_INVESTIGATION_BYTES + 1]) {
    assert.throws(() => checkSunPathInvestigationBytes(value), /5 MiB/i);
  }
  checkSunPathInvestigationBytes(MAX_SUN_PATH_INVESTIGATION_BYTES);
  assert.throws(() => parseSunPathInvestigation('é'.repeat(MAX_SUN_PATH_INVESTIGATION_BYTES / 2 + 1)), /5 MiB/i);
  assert.throws(() => parseSunPathInvestigation('{'), /JSON is invalid/i);
  assert.throws(() => parseSunPathInvestigation(null), /JSON text/i);
  assert.throws(() => parseSunPathInvestigation('[]'), /envelope/i);
});

test('source words remain literal, geographic signs survive, and canonical UTC inputs remain explicit', () => {
  const source = fixture(), declaration = input();
  declaration.longitudeDeg = -179.9;
  declaration.locationSource = '<svg onload=alert(1)> é\nA source, with "quotes"';
  declaration.orientationSource = '  Manual bearing, not verified  ';
  const {investigation, report} = parseSunPathInvestigation(serializeSunPathInvestigation(source, declaration));
  assert.equal(investigation.declaration.longitudeDeg, -179.9);
  assert.equal(investigation.declaration.locationSource, declaration.locationSource);
  assert.equal(investigation.declaration.orientationSource, declaration.orientationSource.trim());
  assert.equal(investigation.declaration.startUtc, '2026-06-21T04:00:00.000Z');
  assert.equal(report.declaration.locationSource, declaration.locationSource);
  assert.equal(investigation.project.solarStudy.proposal[0].source, source.solarStudy.proposal[0].source);
});

test('frozen source inputs are accepted and reopened copies have independent ownership', () => {
  const source = freeze(fixture()), declaration = freeze(input());
  const original = freeze(buildSunPathInvestigation(source, declaration));
  const result = reopenSunPathInvestigation(original);
  result.investigation.project.title = 'Edited reopened copy';
  result.investigation.declaration.locationSource = 'Edited reopened source';
  assert.notEqual(original.project.title, result.investigation.project.title);
  assert.notEqual(original.declaration.locationSource, result.investigation.declaration.locationSource);
  assert.equal(original.model.version, SUN_PATH_MODEL.version);
});
