import test from 'node:test';
import assert from 'node:assert/strict';
import { intersectThreeProfileBands, intersectThreeRationalProfileBands,
  THREE_PROFILE_BAND_MAX_CANDIDATES } from '../shade-heat-profile-three-bands.js';
import { intersectTwoProfileBands } from '../shade-heat-profile-two-bands.js';
import { rational as q } from '../vendor/chronos/exact-halfplanes.mjs';

const band = (temperatureC, halfWidthC = 0) => ({ temperatureC, halfWidthC });
const key = c => JSON.stringify([c.support, c.weights], (_, v) => typeof v === 'bigint' ? String(v) : v);

test('Three independent exact readings can require all four original bins', () => {
  const result = intersectThreeProfileBands([[1,0,0,0], [0,1,0,0], [0,0,1,0]], [band(.25),band(.25),band(.25)]);
  assert.equal(result.status, 'compatible'); assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.candidates[0].support, [0,1,2,3]);
  assert.deepEqual(result.candidates[0].weights, Array.from({length:4},()=>q(.25)));
  assert.equal(result.work.admittedTetrahedronVertices, 1);
});

test('Separate pairwise compatibility cannot stand in for one three-reading witness', () => {
  const rows = [[1,0,0],[0,1,0],[0,0,1]], readings = [band(.5),band(.5),band(.5)];
  for (let i=0;i<3;i++) for(let j=i+1;j<3;j++)
    assert.equal(intersectTwoProfileBands([rows[i],rows[j]],[readings[i],readings[j]]).status,'compatible');
  assert.equal(intersectThreeProfileBands(rows,readings).status,'incompatible');
});

test('Redundant constant and dependent bands retain the complete leading-two vertices', () => {
  const rows = [[0,1,2,3,4],[4,0,3,1,2]], readings = [band(2,.75),band(2,.5)];
  const prior=intersectTwoProfileBands(rows,readings);
  for(const [row,reading] of [[Array(5).fill(0),band(0)],[rows[0],readings[0]],[rows[0].map(v=>-v),band(-2,.75)]]) {
    const result=intersectThreeProfileBands([...rows,row],[...readings,reading]);
    assert.deepEqual(result.candidates.map(key).sort(),prior.candidates.map(key).sort());
  }
});

test('Closed contacts, original vertices and degenerate rows retain exact mass', () => {
  const rows=[[0,1,0],[0,0,1],[1,1,1]];
  const result=intersectThreeProfileBands(rows,[band(0),band(0),band(1)]);
  assert.deepEqual(result.candidates.map(c=>c.support),[[0]]);
  assert.equal(intersectThreeProfileBands(rows,[band(0),band(0),band(2)]).status,'incompatible');
  assert.deepEqual(intersectThreeProfileBands(rows,[band(.5),band(.5),band(1)]).candidates[0].weights,[q(.5),q(.5)]);
});

test('Nonbinary rational coefficients preserve exact four-bin weights', () => {
  const zero=[0n,1n], third=[1n,3n];
  const result=intersectThreeRationalProfileBands([[third,zero,zero,zero],[zero,third,zero,zero],[zero,zero,third,zero]],
    [band(1/16),band(1/16),band(1/16)]);
  assert.equal(result.candidates.length,1);
  assert.deepEqual(result.candidates[0].weights,[[3n,16n],[3n,16n],[3n,16n],[7n,16n]]);
});

test('Numeric and rational paths and reordered original bands preserve all vertices', () => {
  const rows=[[0,1,2,3,4],[4,0,3,1,2],[2,3,-1,4,0]],readings=[band(2,.75),band(2,.5),band(1,.25)];
  const expected=intersectThreeProfileBands(rows,readings).candidates.map(key).sort();assert.ok(expected.length>0);
  assert.deepEqual(intersectThreeRationalProfileBands(rows.map(r=>r.map(q)),readings).candidates.map(key).sort(),expected);
  assert.deepEqual(intersectThreeProfileBands([rows[2],rows[0],rows[1]],[readings[2],readings[0],readings[1]]).candidates.map(key).sort(),expected);
});

test('The complete sixteen-bin capacity is admitted and every support is visited', () => {
  const result=intersectThreeProfileBands([Array(16).fill(0),Array(16).fill(1),Array(16).fill(2)],
    [band(0,1),band(1,1),band(2,1)]);
  assert.equal(result.work.maximumCandidates,THREE_PROFILE_BAND_MAX_CANDIDATES);
  assert.equal(result.work.maximumCandidates,22016);
  assert.equal(result.work.examinedPairs,120);assert.equal(result.work.examinedTriangles,560);
  assert.equal(result.work.examinedTetrahedra,1820);assert.equal(result.candidates.length,16);
});

test('Sparse, nonfinite, oversized and forged coefficient or reading inputs refuse', () => {
  const good=[[0,1],[0,1],[0,1]],readings=[band(.5),band(.5),band(.5)];
  for(const rows of [[good[0],,good[2]],[[0,,1], [0,1,2],[0,1,2]],[[0,Infinity],good[1],good[2]],
    [Array(17).fill(0),Array(17).fill(0),Array(17).fill(0)],[good[0],good[1]]])
    assert.throws(()=>intersectThreeProfileBands(rows,readings));
  for(const r of [[readings[0],,readings[2]],[band(.5),band(.5),band(.5,-1)],
    [band(.5),band(.5),{...band(.5),derived:true}]]) assert.throws(()=>intersectThreeProfileBands(good,r));
  for(const coefficient of [[1n,0n],[1n,-1n],[1,1],[1n,,1n],[1n<<4096n,1n]]) {
    const rows=good.map(row=>row.map(q));rows[2][0]=coefficient;
    assert.throws(()=>intersectThreeRationalProfileBands(rows,readings));
  }
});
