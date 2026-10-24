import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample, compare} from '../core.js';
import {pondingExposure, snapshotDepths} from '../ponding-exposure.js';
import {parseRouteCells, routeThresholdWindows, routeDepthAtMinute} from '../route-ponding.js';

test('authored route admits only finite, unique orthogonal cells inside this project', () => {
  assert.deepEqual(parseRouteCells('a1, B1 → b2 C2', 8, 6), {
    indices:[0,1,9,10], labels:['A1','B1','B2','C2']
  });
  assert.deepEqual(parseRouteCells('X24 W24',24,24).indices,[575,574]);
  for (const [raw,width,height] of [
    ['',8,6],['A1',8,6],['A1 A1',8,6],['A1 B2',8,6],
    ['A1 C1',8,6],['A1 H24',8,6],['A1 Z1',8,6],
    ['A1 I1',8,6],['A1 B0',8,6],['A1 B25',24,24],
    ['A1 B1'.repeat(600),8,6]
  ]) assert.throws(()=>parseRouteCells(raw,width,height));
  assert.throws(()=>parseRouteCells('A1 B1',25,24));
  assert.throws(()=>parseRouteCells('A1 B1',8,0));
});

function exposure(intervals, aboveAtStart=false, aboveAtEnd=false) {
  return {intervals:intervals.map(([startMinute,endMinute])=>({startMinute,endMinute})),
    aboveAtStart,aboveAtEnd};
}
test('route windows union overlapping and touching wet episodes, retaining separate clear windows',()=>{
  const exp=[
    exposure([[5,15]]), exposure([[12,18]]),
    exposure([[0,4]],true,false), exposure([[19,20]],false,true)
  ];
  const a=routeThresholdWindows(exp,[0,1],0,20);
  assert.deepEqual(a.aboveWindows,[{startMinute:5,endMinute:18}]);
  assert.deepEqual(a.clearWindows,[{startMinute:0,endMinute:5},{startMinute:18,endMinute:20}]);
  assert.equal(a.clearMinutes,7);
  assert.equal(a.aboveAtStart,false);assert.equal(a.aboveAtEnd,false);
  const b=routeThresholdWindows(exp,[0,2,3],0,20);
  assert.deepEqual(b.aboveWindows,[{startMinute:0,endMinute:4},{startMinute:5,endMinute:15},{startMinute:19,endMinute:20}]);
  assert.deepEqual(b.clearWindows,[{startMinute:4,endMinute:5},{startMinute:15,endMinute:19}]);
  assert.equal(b.clearMinutes,5);assert.equal(b.aboveAtStart,true);assert.equal(b.aboveAtEnd,true);
  const c=routeThresholdWindows([exposure([]),exposure([])],[0,1],0,20);
  assert.deepEqual(c.clearWindows,[{startMinute:0,endMinute:20}]);assert.equal(c.clearMinutes,20);
  const d=routeThresholdWindows([exposure([[0,20]],true,true),exposure([])],[0,1],0,20);
  assert.deepEqual(d.clearWindows,[]);assert.equal(d.clearMinutes,0);
  assert.deepEqual(exp[0].intervals,[{startMinute:5,endMinute:15}],'no source mutation');
});
test('route threshold and time admission reject inconsistent inputs',()=>{
  const exp=[exposure([]),exposure([])];
  assert.throws(()=>routeThresholdWindows(exp,[0,5],0,20));
  assert.throws(()=>routeThresholdWindows(exp,[0,1],20,20));
  assert.throws(()=>routeThresholdWindows([exposure([[4,3]]),exposure([])],[0,1],0,20));
  assert.throws(()=>routeThresholdWindows([exposure([[0,21]]),exposure([])],[0,1],0,20));
  assert.throws(()=>routeDepthAtMinute([0,2],[0,1],0));
  assert.throws(()=>routeDepthAtMinute([0,NaN],[0,1],10));
  assert.throws(()=>routeDepthAtMinute([0,3],[0,4],10));
});
test('at-minute bottleneck preserves route order on equal depths and threshold equality',()=>{
  assert.deepEqual(routeDepthAtMinute([4,9,9,0],[2,1],9),{
    maxDepthMm:9,maxCellIndex:2,everyCellAtOrBelow:true
  });
  assert.deepEqual(routeDepthAtMinute([4,9,9,0],[1,2],8.999),{
    maxDepthMm:9,maxCellIndex:1,everyCellAtOrBelow:false
  });
});
test('real maintained solver changes route-window outcome on changed rain without changing its source',()=>{
  const project=makeExample(),before=structuredClone(project),route=parseRouteCells('D3 E3 F3',project.width,project.height);
  const first=compare(project);
  const threshold=0.1;
  const review=result=>routeThresholdWindows(pondingExposure(result.existing,threshold),route.indices,0,project.weather.durationMinutes);
  const wet=review(first);
  assert.ok(wet.clearMinutes<project.weather.durationMinutes,'actual rainfall wets at least one route cell');
  const bottleneck=routeDepthAtMinute(snapshotDepths(first.existing,project.weather.stormMinutes),route.indices,threshold);
  assert.ok(bottleneck.maxDepthMm>threshold);
  assert.deepEqual(project,before);
  const dry=structuredClone(project);dry.weather.rainMmHr=0;
  const noRain=compare(dry);
  const clean=routeThresholdWindows(pondingExposure(noRain.existing,threshold),route.indices,0,dry.weather.durationMinutes);
  assert.equal(clean.clearMinutes,dry.weather.durationMinutes);
  assert.equal(clean.aboveWindows.length,0);
  assert.ok(clean.clearMinutes>wet.clearMinutes);
  const second=compare(project);
  assert.deepEqual(routeThresholdWindows(pondingExposure(second.proposal,threshold),route.indices,0,project.weather.durationMinutes),
                   routeThresholdWindows(pondingExposure(first.proposal,threshold),route.indices,0,project.weather.durationMinutes),
                   'deterministic and same-input replayable');
});

