import test from 'node:test';
import assert from 'node:assert/strict';
import { authoredPowerWeather } from './weather-power-fixture.mjs';
import { parsePowerHourly, checkPowerHourlyBytes } from '../weather-power.js';
const raw = JSON.stringify(authoredPowerWeather());
const fixture = () => JSON.parse(raw);
const parse = value => parsePowerHourly(JSON.stringify(value));

test('authored original POWER-format response retains each source value and explicit one-hour energy-to-flux conversion', () => {
  const r = parsePowerHourly(raw);
  assert.equal(r.rawText, raw); assert.equal(r.intervals.length, 24);
  assert.equal(r.latitudeDeg, 51.5); assert.equal(r.longitudeDeg, -.1);
  assert.equal(r.startUtc, '2025-06-21T00:00:00.000Z');
  assert.equal(r.endUtc, '2025-06-22T00:00:00.000Z');
  const ninth = r.intervals[8];
  assert.equal(ninth.sourceKey, '2025062108');
  assert.equal(ninth.fromUtc, '2025-06-21T08:00:00.000Z');
  assert.equal(ninth.toUtc, '2025-06-21T09:00:00.000Z');
  assert.equal(ninth.durationHours, 1);
  assert.equal(ninth.original.ALLSKY_SFC_SW_DNI, 300);
  assert.equal(ninth.directNormalWm2, 300);
  assert.equal(ninth.diffuseHorizontalWm2, 100);
  assert.equal(ninth.reservoirC, 22);
  assert.equal(r.source.units.ALLSKY_SFC_SW_DNI, 'Wh/m^2');
});

test('UTC chronology is bound to the complete original date across leap and year boundaries', () => {
  for (const [day, next] of [['20240229', '2024-03-01'], ['20251231', '2026-01-01']]) {
    const v = fixture(), old = v.header.start; v.header.start = v.header.end = day;
    for (const key of Object.keys(v.properties.parameter)) {
      v.properties.parameter[key] = Object.fromEntries(Object.entries(v.properties.parameter[key]).map(([stamp, value]) => [stamp.replace(old, day), value]));
    }
    assert.equal(parse(v).endUtc, next + 'T00:00:00.000Z');
  }
  const impossible = fixture(); impossible.header.start = impossible.header.end = '20250230';
  assert.throws(() => parse(impossible), /date must exist/);
  const local = fixture(); local.header.time_standard = 'LST';
  assert.throws(() => parse(local), /time-standard=UTC/);
  const multiple = fixture(); multiple.header.end = '20250622';
  assert.throws(() => parse(multiple), /not truncated/);
});

test('missing, mismatched and extra hours refuse the entire weather course', () => {
  for (const key of Object.keys(fixture().properties.parameter)) {
    const missing = fixture(); delete missing.properties.parameter[key]['2025062111'];
    assert.throws(() => parse(missing), /24 matching/);
    const shifted = fixture(); shifted.properties.parameter[key]['2025062200'] = shifted.properties.parameter[key]['2025062123'];
    delete shifted.properties.parameter[key]['2025062123'];
    assert.throws(() => parse(shifted), /24 matching/);
    const extra = fixture(); extra.properties.parameter[key]['2025062200'] = 0;
    assert.throws(() => parse(extra), /24 matching/);
  }
});

test('fill values, wrong units, strings and unsupported physical ranges are never silently coerced', () => {
  const missing = fixture(); missing.properties.parameter.T2M['2025062110'] = -999;
  assert.throws(() => parse(missing), /fill value is not zero/);
  const units = fixture(); units.parameters.ALLSKY_SFC_SW_DNI.units = 'kWh/m^2/day';
  assert.throws(() => parse(units), /original unit Wh/);
  for (const value of ['300', null, -1, 2500]) {
    const v = fixture(); v.properties.parameter.ALLSKY_SFC_SW_DNI['2025062108'] = value;
    assert.throws(() => parse(v), /Unsupported weather value/);
  }
  const total = fixture(); total.properties.parameter.ALLSKY_SFC_SW_DNI['2025062108'] = 1901;
  assert.throws(() => parse(total), /Unsupported weather value/);
});

test('coordinates and original source custody are mandatory; limits precede parse', () => {
  const noHeader = fixture(); delete noHeader.header.api;
  assert.throws(() => parse(noHeader), /original hourly API/);
  for (const coordinates of [[0, 90], [181, 0], ['0', 0], [0], [0, 0, null]]) {
    const v = fixture(); v.geometry.coordinates = coordinates;
    assert.throws(() => parse(v), /longitude and non-polar/);
  }
  assert.throws(() => parsePowerHourly('x'.repeat(262145)), /256 KiB/);
  assert.throws(() => checkPowerHourlyBytes(262145), /256 KiB/);
  assert.throws(() => parsePowerHourly('{'), /Invalid hourly/);
  const v = fixture(); v.header.sources[0] = '<img onerror=bad()>';
  assert.equal(parse(v).source.sources[0], '<img onerror=bad()>');
});
