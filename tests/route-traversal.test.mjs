import test from 'node:test';
import assert from 'node:assert/strict';
import {pondingExposure} from '../ponding-exposure.js';
import {makeExample, compare} from '../core.js';
import {parseRouteCells, routeThresholdWindows} from '../route-ponding.js';
import {parseSegmentMinutes, timedRouteWindows, inspectTimedRoute} from '../route-traversal.js';

const siteRoute = parseRouteCells('A1 B1', 2, 2);
const series = (a,b) => ({snapshots:[0,10,20].map((minute,i)=>({
  minute,depthsMm:[a[i],b[i],0,0]
}))});
const exposure = result => pondingExposure(result,1);

test('explicit step timing admits exactly one repeated or N-1 individual times',()=>{
  assert.deepEqual(parseSegmentMinutes('5',3),[5,5]);
  assert.deepEqual(parseSegmentMinutes('1.5, 2',3),[1.5,2]);
  for(const [text,length] of [['',3],['1,2,3',3],['1;2',3],
    ['1x',2],['0',2],['-1',2],['Infinity',2],['2e999',2],['0.001',2]]) {
    assert.throws(()=>parseSegmentMinutes(text,length));
  }
});

test('staggered traversal succeeds when no simultaneous positive-duration window is clear',()=>{
  const original = series([0,2,2],[2,0,0]);
  // From 0 until just before 10: B is above, then A is above.
  const same = routeThresholdWindows(exposure(original),siteRoute.indices,0,20);
  assert.equal(same.clearMinutes,0);
  const inspected = inspectTimedRoute(original,siteRoute.indices,[10],0,1);
  assert.equal(inspected.allAtOrBelow,true);
  assert.deepEqual(inspected.arrivals.map(a=>a.minute),[0,10]);
  assert.equal(inspected.firstFailure,null);
  const windows = timedRouteWindows(exposure(original),siteRoute.indices,[10],0,20,0,10);
  assert.ok(windows.clearWindows.length);
  assert.equal(windows.clearWindows[0].startMinute,0);
});

test('same-time clear departure can fail when traveler reaches the wet cell later',()=>{
  const result=series([0,0,0],[0,2,2]);
  const simultaneous=routeThresholdWindows(exposure(result),siteRoute.indices,0,20);
  assert.ok(simultaneous.clearMinutes>0);
  const at0=inspectTimedRoute(result,siteRoute.indices,[10],0,1);
  assert.deepEqual(at0.firstFailure,{cellIndex:1,routePosition:1,minute:10,depthMm:2});
  const windows=timedRouteWindows(exposure(result),siteRoute.indices,[10],0,20,0,10);
  assert.equal(windows.clearWindows.length,0);
  assert.equal(windows.clearMinutes,0);
  assert.deepEqual(windows.aboveWindows,[{startMinute:0,endMinute:10}]);
});

test('changed threshold and step duration change exact moving windows without mutating original',()=>{
  const result=series([0,0,0],[0,2,0]);
  const source=structuredClone(result);
  const slow=timedRouteWindows(pondingExposure(result,1),siteRoute.indices,[5],0,20,0,15);
  const fast=timedRouteWindows(pondingExposure(result,1),siteRoute.indices,[2],0,20,0,18);
  const lenient=timedRouteWindows(pondingExposure(result,3),siteRoute.indices,[5],0,20,0,15);
  assert.deepEqual(slow.clearWindows,[{startMinute:10,endMinute:15}]);
  assert.ok(fast.clearMinutes!==slow.clearMinutes);
  assert.equal(lenient.clearMinutes,15);
  assert.deepEqual(result,source);
});

test('refuse unsupported departure range, travel duration and malformed exposures',()=>{
  const result=series([0,0,0],[0,0,0]),exp=exposure(result);
  for(const query of [
    ()=>timedRouteWindows(exp,siteRoute.indices,[21],0,20,0,1),
    ()=>timedRouteWindows(exp,siteRoute.indices,[5],0,20,0,16),
    ()=>timedRouteWindows(exp,siteRoute.indices,[5],0,20,-1,12),
    ()=>timedRouteWindows(exp,siteRoute.indices,[5],0,20,10,0),
    ()=>timedRouteWindows(exp,siteRoute.indices,[0],0,20,0,10),
    ()=>timedRouteWindows(exp,siteRoute.indices,[1,2],0,20,0,10),
    ()=>timedRouteWindows([{},exp[1],exp[2],exp[3]],siteRoute.indices,[5],0,20,0,10),
    ()=>inspectTimedRoute(result,siteRoute.indices,[5],16,1),
    ()=>inspectTimedRoute(result,siteRoute.indices,[5],0,0),
    ()=>inspectTimedRoute(result,[0,9],[5],0,1)
  ]) assert.throws(query);
});

test('maintained original solver feeds source-bound traversal without altering a site',()=>{
  const project=makeExample(), original=structuredClone(project);
  const route=parseRouteCells('D3 E3 F3',project.width,project.height);
  const wet=compare(project);
  const last=project.weather.durationMinutes, until=Math.min(25,last-2);
  assert.ok(until>0);
  const wetWindows=timedRouteWindows(pondingExposure(wet.existing,0.1),route.indices,
    [1,1],0,last,0,until);
  assert.ok(wetWindows.clearMinutes>=0 && wetWindows.clearMinutes<=until);
  assert.equal(wetWindows.arrivalOffsetsMinutes.at(-1),2);
  const dry=structuredClone(project);dry.weather.rainMmHr=0;
  const dryResult=compare(dry);
  const dryWindows=timedRouteWindows(pondingExposure(dryResult.existing,0.1),route.indices,
    [1,1],0,last,0,until);
  assert.equal(dryWindows.clearMinutes,until);
  assert.ok(wetWindows.clearMinutes<dryWindows.clearMinutes,'original rain produces fewer qualifying departures');
  assert.deepEqual(project,original);
});
