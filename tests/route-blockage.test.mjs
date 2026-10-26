import test from 'node:test';
import assert from 'node:assert/strict';
import {routeBlockageAttribution} from '../route-blockage.js';
import {routeThresholdWindows} from '../route-ponding.js';
import {pondingExposure} from '../ponding-exposure.js';

const exposures = ranges => ranges.map(intervals => ({
  intervals: intervals.map(([startMinute,endMinute]) => ({startMinute,endMinute}))
}));
const close = (actual, expected, tolerance=1e-10) =>
  assert.ok(Math.abs(actual-expected)<=tolerance, actual+' != '+expected);
function partition(result, duration) {
  close(result.cells.reduce((sum,cell)=>sum+cell.soleAboveMinutes,0)+result.multipleAboveMinutes,result.aboveMinutes);
  close(result.aboveMinutes+result.clearMinutes,duration);
  for(const cell of result.cells) {
    assert.ok(cell.soleAboveMinutes>=0 && cell.minutesAbove>=cell.soleAboveMinutes);
  }
  assert.ok(result.multipleAboveMinutes>=0 && result.clearMinutes>=0);
}

test('partitions sole and shared blockage and ranks cells by sole duration',()=>{
  const source=exposures([[[0,4],[8,10]],[[2,6]],[[5,9]]]);
  const result=routeBlockageAttribution(source,[0,1,2],0,10);
  assert.deepEqual(result.cells,[
    {cellIndex:0,minutesAbove:6,soleAboveMinutes:3},
    {cellIndex:2,minutesAbove:4,soleAboveMinutes:2},
    {cellIndex:1,minutesAbove:4,soleAboveMinutes:1}
  ]);
  assert.equal(result.multipleAboveMinutes,4);
  assert.equal(result.aboveMinutes,10);
  assert.equal(result.clearMinutes,0);
  partition(result,10);
});

test('clear gaps survive and sole-duration ties follow authored route order',()=>{
  const result=routeBlockageAttribution(exposures([[[1,2]],[[3,4]]]),[1,0],0,5);
  assert.deepEqual(result.cells.map(cell=>cell.cellIndex),[1,0]);
  assert.equal(result.clearMinutes,3);
  assert.equal(result.multipleAboveMinutes,0);
  partition(result,5);
});

test('touching cross-cell intervals have no positive shared duration',()=>{
  const result=routeBlockageAttribution(exposures([[[0,5]],[[5,10]]]),[0,1],0,10);
  assert.deepEqual(result.cells.map(cell=>cell.soleAboveMinutes),[5,5]);
  assert.equal(result.multipleAboveMinutes,0);
  partition(result,10);
});

test('overlapping intervals from one cell and repeated indices do not invent multiple cells',()=>{
  const source=exposures([[[4,5],[1,4],[2,3]],[[2,3]]]);
  const before=JSON.stringify(source);
  const result=routeBlockageAttribution(source,[0,1,0],0,6);
  assert.deepEqual(result.cells,[
    {cellIndex:0,minutesAbove:4,soleAboveMinutes:3},
    {cellIndex:1,minutesAbove:1,soleAboveMinutes:0}
  ]);
  assert.equal(result.multipleAboveMinutes,1);
  assert.equal(result.clearMinutes,2);
  assert.equal(JSON.stringify(source),before);
  partition(result,6);
});

test('three simultaneous cells contribute one shared span, not three durations',()=>{
  const result=routeBlockageAttribution(exposures([[[0,3]],[[0,3]],[[0,3]]]),[2,0,1],0,4);
  assert.deepEqual(result.cells.map(cell=>cell.cellIndex),[2,0,1]);
  assert.ok(result.cells.every(cell=>cell.soleAboveMinutes===0));
  assert.equal(result.multipleAboveMinutes,3);
  partition(result,4);
});

test('a wholly clear route retains zero-attribution cells',()=>{
  const result=routeBlockageAttribution(exposures([[],[]]),[0,1],4,9);
  assert.equal(result.aboveMinutes,0);
  assert.equal(result.multipleAboveMinutes,0);
  assert.equal(result.clearMinutes,5);
  assert.ok(result.cells.every(cell=>cell.minutesAbove===0 && cell.soleAboveMinutes===0));
  partition(result,5);
});

test('clipping tolerated off-horizon intervals never invents negative time',()=>{
  const source=exposures([[[10-8e-9,10-4e-9],[10-2e-9,12],[20+2e-9,20+4e-9]],[]]);
  const result=routeBlockageAttribution(source,[0,1],10,20);
  assert.equal(result.cells[0].soleAboveMinutes,2);
  assert.equal(result.cells[0].minutesAbove,2);
  assert.equal(result.aboveMinutes,2);
  assert.equal(result.clearMinutes,8);
  partition(result,10);
});

test('positive gaps are not attributed to a cell even below legacy union tolerance',()=>{
  const gap=5e-9,source=exposures([[[0,1]],[[1+gap,2]]]);
  const result=routeBlockageAttribution(source,[0,1],0,2);
  close(result.clearMinutes,gap,1e-12);
  assert.equal(result.multipleAboveMinutes,0);
  const union=routeThresholdWindows(source,[0,1],0,2).aboveWindows;
  close(result.aboveMinutes,union.reduce((sum,w)=>sum+w.endMinute-w.startMinute,0),1e-8);
  partition(result,2);
});

test('refuses missing exposures, malformed intervals, invalid routes and horizons',()=>{
  const valid=exposures([[],[]]);
  assert.throws(()=>routeBlockageAttribution([valid[0],null],[0,1],0,10),/Missing exposure/);
  for(const interval of [null,{startMinute:0,endMinute:NaN},{startMinute:3,endMinute:2},{startMinute:-1,endMinute:1},{startMinute:0,endMinute:11}]) {
    assert.throws(()=>routeBlockageAttribution([{intervals:[interval]},valid[1]],[0,1],0,10),/Invalid modeled threshold interval/);
  }
  for(const indices of [[0],[0,2],[0,0.5]]) {
    assert.throws(()=>routeBlockageAttribution(valid,indices,0,10),/Route cells/);
  }
  assert.throws(()=>routeBlockageAttribution(valid,[0,1],2,2),/time horizon/);
});

test('real interpolated snapshots distinguish paired scenarios and threshold changes',()=>{
  const existing={snapshots:[
    {minute:0,depthsMm:[0,0,100]},
    {minute:10,depthsMm:[10,0,100]},
    {minute:20,depthsMm:[0,10,100]}
  ]};
  const proposal={snapshots:[
    {minute:0,depthsMm:[0,0,100]},
    {minute:10,depthsMm:[0,10,100]},
    {minute:20,depthsMm:[0,0,100]}
  ]};
  const baseline=routeBlockageAttribution(pondingExposure(existing,5),[0,1],0,20);
  const changed=routeBlockageAttribution(pondingExposure(proposal,5),[0,1],0,20);
  assert.deepEqual(baseline.cells,[
    {cellIndex:0,minutesAbove:10,soleAboveMinutes:10},
    {cellIndex:1,minutesAbove:5,soleAboveMinutes:5}
  ]);
  assert.deepEqual(changed.cells,[
    {cellIndex:1,minutesAbove:10,soleAboveMinutes:10},
    {cellIndex:0,minutesAbove:0,soleAboveMinutes:0}
  ]);
  assert.equal(changed.clearMinutes-baseline.clearMinutes,5);
  const lower=routeBlockageAttribution(pondingExposure(existing,2.5),[0,1],0,20);
  assert.equal(lower.multipleAboveMinutes,5);
  assert.equal(lower.clearMinutes,2.5);
  for(const result of [baseline,changed,lower]) partition(result,20);
});

test('agrees with independent midpoint counting across overlapping integer fixtures',()=>{
  for(let seed=1;seed<=24;seed++) {
    const ranges=Array.from({length:4},(_,cell)=>Array.from({length:3},(_,span)=>{
      const start=(seed*7+cell*5+span*3)%12;
      return [start,Math.min(12,start+1+(seed+cell+span)%4)];
    }));
    const indices=[2,0,3],source=exposures(ranges);
    const result=routeBlockageAttribution(source,indices,0,12);
    const expected=new Map(indices.map(cellIndex=>[cellIndex,{above:0,sole:0}]));
    let shared=0,blocked=0;
    for(let minute=0;minute<12;minute++) {
      const at=minute+0.5;
      const active=indices.filter(index=>ranges[index].some(([start,end])=>start<at && at<end));
      for(const index of active) expected.get(index).above++;
      if(active.length) blocked++;
      if(active.length===1) expected.get(active[0]).sole++;
      if(active.length>1) shared++;
    }
    for(const cell of result.cells) {
      assert.equal(cell.minutesAbove,expected.get(cell.cellIndex).above);
      assert.equal(cell.soleAboveMinutes,expected.get(cell.cellIndex).sole);
    }
    assert.equal(result.aboveMinutes,blocked);
    assert.equal(result.multipleAboveMinutes,shared);
    const windows=routeThresholdWindows(source,indices,0,12);
    assert.equal(result.clearMinutes,windows.clearMinutes);
    assert.equal(result.aboveMinutes,windows.aboveWindows.reduce((sum,w)=>sum+w.endMinute-w.startMinute,0));
    partition(result,12);
  }
});
