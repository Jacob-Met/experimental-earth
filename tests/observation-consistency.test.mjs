import test from 'node:test';
import assert from 'node:assert/strict';
import { observationConsistency } from '../observation-consistency.js';
const reading = (extra={}) => ({scenario:'existing',cellIndex:0,minute:5,depthMm:10,uncertaintyMm:1,source:'authored control, not measured',use:'calibration',...extra});
test('disjoint same-point bands yield exact witness and gap without a model',()=>{
  const input=[reading(),reading({depthMm:15,uncertaintyMm:2,use:'challenge'})],before=structuredClone(input);
  const group=observationConsistency(input).groups[0];
  assert.equal(group.status,'disjoint');assert.equal(group.gapMm,2);assert.deepEqual(group.witness,[0,1]);
  assert.equal(group.commonBandMm,null);assert.deepEqual(input,before);assert.equal(group.readings[1].reading.use,'challenge');
});
test('touching intervals remain compatible and zero tolerance is exact',()=>{
  assert.deepEqual(observationConsistency([reading(),reading({depthMm:12})]).groups[0].commonBandMm,[11,11]);
  assert.deepEqual(observationConsistency([reading({uncertaintyMm:0}),reading({uncertaintyMm:0})]).groups[0].commonBandMm,[10,10]);
  assert.equal(observationConsistency([reading({uncertaintyMm:0}),reading({depthMm:10.01,uncertaintyMm:0})]).groups[0].status,'disjoint');
});
test('minimum upper and maximum lower identify contradiction across many readings',()=>{
  const rows=[reading({depthMm:10,uncertaintyMm:10}),reading({depthMm:3,uncertaintyMm:1}),reading({depthMm:6,uncertaintyMm:1}),reading({depthMm:4,uncertaintyMm:10})];
  const g=observationConsistency(rows).groups[0];assert.deepEqual(g.witness,[1,2]);assert.equal(g.gapMm,1);
  assert.equal(g.readings.length,4);
});
test('different exact cell, time or scenario never establishes a contradiction',()=>{
  const rows=[reading(),reading({depthMm:30,minute:5.000000001}),reading({depthMm:30,cellIndex:1}),reading({depthMm:30,scenario:'proposal'}),reading({depthMm:30,scenario:'unassigned',use:'unassigned'})];
  const r=observationConsistency(rows);assert.equal(r.groups.length,0);assert.equal(r.unassignedCount,1);
});
test('imprecise readings retain physical nonnegative intersection without averaging',()=>{
  const g=observationConsistency([reading({depthMm:1,uncertaintyMm:4}),reading({depthMm:2,uncertaintyMm:4})]).groups[0];
  assert.deepEqual(g.commonBandMm,[0,5]);assert.equal(g.status,'overlap');
});
test('floating-point near-contact is explicit, not a fabricated common interval',()=>{
  const g=observationConsistency([reading({depthMm:1,uncertaintyMm:0}),reading({depthMm:1+Number.EPSILON,uncertaintyMm:0})]).groups[0];
  assert.equal(g.status,'roundoff-contact');assert.equal(g.commonBandMm,null);assert.ok(g.gapMm>0);assert.equal(g.witness,null);
});
test('source copies, role retention, reopening and bounded invalid inputs',()=>{
  const rows=[reading(),reading({use:'unassigned'})];const r=observationConsistency(rows);
  assert.deepEqual(r,observationConsistency(JSON.parse(JSON.stringify(rows))));
  r.groups[0].readings[0].reading.source='modified';assert.notEqual(rows[0].source,'modified');
  assert.throws(()=>observationConsistency(Array(101).fill(reading())),/100/);
  assert.throws(()=>observationConsistency([reading({depthMm:NaN})]),/Invalid/);
  assert.throws(()=>observationConsistency([reading({scenario:'other'})]),/scenario/);
});
test('changed declared tolerance changes compatibility without deleting or averaging evidence',()=>{
  const rows=[reading({depthMm:4,uncertaintyMm:1}),reading({depthMm:8,uncertaintyMm:1,use:'challenge'})];
  assert.equal(observationConsistency(rows).contradictoryGroups,1);
  rows[1].uncertaintyMm=3;
  const group=observationConsistency(rows).groups[0];
  assert.deepEqual(group.commonBandMm,[5,5]);assert.equal(group.readings.length,2);
  assert.equal(group.readings[1].reading.depthMm,8);
});
