import test from 'node:test';
import assert from 'node:assert/strict';
import { makeThirdReceiverExample } from '../shade-heat-third-example.js';
import { parseCourseOriginals, courseWitnessDifferences } from '../shade-heat-course-inputs.js';
import { prepareSkyCourseEvidence } from '../shade-heat-course-evidence.js';
import { cmp } from '../vendor/chronos/exact-halfplanes.mjs';

const raw = makeThirdReceiverExample();
const before = JSON.stringify(raw);
const joined = parseCourseOriginals([before]);
test('A saved three-reading inquiry contributes its original evidence without choosing a course boundary', () => {
  assert.deepEqual(joined.readings, raw.readings);
  assert.equal(joined.sharingSource, raw.query.sharingSource);
  assert.deepEqual(Object.keys(joined), ['readings', 'sharingSource']);
  assert.equal(JSON.stringify(raw), before);
  joined.readings[0].query.reading.source = 'Changed local copy';
  assert.deepEqual(parseCourseOriginals([before]).readings, raw.readings);
});
test('Three independent originals retain their separate histories and malformed mixed intake refuses whole', () => {
  const originals = structuredClone(raw.readings);
  originals.forEach((input, index) => { input.query.bins = [4, 16, 8][index]; });
  assert.deepEqual(parseCourseOriginals(originals.map(JSON.stringify)), { readings: originals, sharingSource: null });
  for (const texts of [[], Array(3), [before, , before], [before, before], [before, before, before, before], [null], ['{'],
    [JSON.stringify({ ...raw, report: {} })], [JSON.stringify({ ...raw, model: { ...raw.model, version: 2 } })],
    [JSON.stringify({ ...raw, query: { ...raw.query, splitAfterIntervals: [8, 8] } })],
    [JSON.stringify(raw.readings[0])], originals.map((input, index) => JSON.stringify(index === 2 ? { ...input, report: {} } : input))]) {
    assert.throws(() => parseCourseOriginals(texts));
  }
});
test('Displayed whole-profile differences exactly attain all68 reported extremes and preserve original replay separation', () => {
  const report = prepareSkyCourseEvidence(raw.readings, { bins: 4, splitAfterInterval: 8, sharingSource: raw.query.sharingSource }).report;
  const fraction = value => [BigInt(value.exact.numerator), BigInt(value.exact.denominator)];
  const courses = new Map(report.witnesses.map(witness => [witness.id, courseWitnessDifferences(witness)]));
  for (const row of report.pointwiseCourse) for (const store of ['surfaceC', 'subsurfaceC']) for (const bound of ['lower', 'upper']) {
    const extreme = row.ranges[store][bound], course = courses.get(extreme.witnessId);
    assert.equal(cmp(fraction(course[row.index].differenceC[store][bound]), fraction(extreme.differenceC)), 0);
    assert.equal(course[row.index].utc, row.utc);
  }
  for (const witness of report.witnesses) for (let receiver = 0; receiver < 3; receiver++) {
    const course = courseWitnessDifferences(witness, receiver);
    assert.equal(course.length, 17);
    for (const row of course) for (const store of ['surfaceC', 'subsurfaceC']) {
      const original = witness.originalReplays[receiver].originalCourse[row.index].originalC;
      assert.equal(row.originalDifferenceC[store].lower, original.proposal.lower[store] - original.existing.upper[store]);
      assert.equal(row.originalDifferenceC[store].upper, original.proposal.upper[store] - original.existing.lower[store]);
    }
  }
  assert.throws(() => courseWitnessDifferences(report.witnesses[0], 3), /receiver/);
});
