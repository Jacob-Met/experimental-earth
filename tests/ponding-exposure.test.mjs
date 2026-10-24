import test from 'node:test';
import assert from 'node:assert/strict';
import { pondingExposure, snapshotDepths } from '../ponding-exposure.js';
import { compare, makeExample } from '../core.js';
const series = depths => ({ snapshots: depths.map((d, i) => ({minute:i * 10,depthsMm:[d]})) });
test('triangular pulse gives analytic threshold crossing duration', () => {
  assert.deepEqual(pondingExposure(series([0,20,0]), 5)[0], {cellIndex:0,minutesAbove:15,intervals:[{startMinute:2.5,endMinute:17.5}]});
});
test('separate pulses preserve dry gap rather than duration from first to last', () => {
  const r = pondingExposure(series([0,20,0,20,0]), 10)[0];
  assert.equal(r.minutesAbove,20); assert.deepEqual(r.intervals,[{startMinute:5,endMinute:15},{startMinute:25,endMinute:35}]);
});
test('threshold plateau is excluded and wet intervals remain separate', () => {
  const r = pondingExposure(series([20,10,10,20]),10)[0];
  assert.equal(r.minutesAbove,20); assert.equal(r.intervals.length,2);
  assert.equal(pondingExposure(series([10,10,10]),10)[0].minutesAbove,0);
});
test('start wet / end wet and nonuniform time steps remain clipped to observation horizon', () => {
  const r = {snapshots:[{minute:0,depthsMm:[20]},{minute:7,depthsMm:[20]},{minute:10,depthsMm:[0]}]};
  assert.equal(pondingExposure(r,10)[0].minutesAbove,8.5);
});
test('replay interpolates values without mutating stored snapshots', () => {
  const r=series([0,20,0]), before=structuredClone(r);
  assert.deepEqual(snapshotDepths(r,5),[10]);assert.deepEqual(snapshotDepths(r,20),[0]);
  snapshotDepths(r,10)[0]=100;assert.deepEqual(r,before);
  assert.throws(()=>snapshotDepths(r,21));
});
test('bad threshold and malformed timeline refuse', () => {
  for(const t of [0,-1,NaN,Infinity,1001])assert.throws(()=>pondingExposure(series([0,20]),t));
  assert.throws(()=>pondingExposure({snapshots:[{minute:0,depthsMm:[1]},{minute:0,depthsMm:[2]}]},1));
});
test('real solver unchanged scenario gives equal exposures and bounded durations', () => {
  const p=makeExample();p.proposal=structuredClone(p.existing); const before=structuredClone(p);
  const results=compare(p), a=pondingExposure(results.existing,10), b=pondingExposure(results.proposal,10);
  assert.deepEqual(a,b);assert.ok(a.some(x=>x.minutesAbove>0));
  assert.ok(a.every(x=>x.minutesAbove>=0&&x.minutesAbove<=p.weather.durationMinutes));assert.deepEqual(p,before);
});
test('replay and exposure both refuse malformed snapshots', () => {
  for (const r of [{}, {snapshots:[]}, {snapshots:[{minute:0,depthsMm:[]},{minute:1,depthsMm:[]}]}, {snapshots:[{minute:0,depthsMm:[0]},{minute:1,depthsMm:[NaN]}]}, {snapshots:[{minute:0,depthsMm:[0]},{minute:1,depthsMm:[1,2]}]}]) {
    assert.throws(()=>snapshotDepths(r,0));assert.throws(()=>pondingExposure(r,1));
  }
});
test('real fractional event retains dry origin and exact final horizon', () => {
  const p=makeExample();p.weather.durationMinutes=61.3;p.weather.stepMinutes=7;
  const r=compare(p).existing;
  assert.equal(r.snapshots[0].minute,0);assert.ok(r.snapshots[0].depthsMm.every(x=>x===0));
  assert.equal(r.snapshots.at(-1).minute,61.3);
  assert.deepEqual(snapshotDepths(r,61.3),r.finalDepthMm);
});
