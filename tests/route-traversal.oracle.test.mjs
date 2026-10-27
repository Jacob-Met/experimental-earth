import test from 'node:test';
import assert from 'node:assert/strict';
import {pondingExposure} from '../ponding-exposure.js';
import {timedRouteWindows, inspectTimedRoute} from '../route-traversal.js';

import {rawDepth, oracle} from './support/route-traversal-oracle.mjs';

const series=(times,cells)=>({snapshots:times.map((minute,j)=>({
  minute,depthsMm:cells.map(values=>values[j])
}))});
const base=()=>series([0,10,20,30],[[0,0,0,0],[0,2,0,0],[0,0,2,0]]);
const windows=pairs=>pairs.map(([startMinute,endMinute])=>({startMinute,endMinute}));
function near(actual,expected,label) {
  assert.ok(Math.abs(actual-expected)<=1e-9,`${label}: ${actual} versus ${expected}`);
}
function receive(result,route,steps,threshold,from,until,analytic) {
  const original=structuredClone(result);
  const expected=oracle(result,route,steps,threshold,from,until);
  if(analytic) assert.deepEqual(expected,windows(analytic),'oracle agrees with analytic fixture');
  const actual=timedRouteWindows(pondingExposure(result,threshold),route,steps,
    result.snapshots[0].minute,result.snapshots.at(-1).minute,from,until);
  assert.equal(actual.clearWindows.length,expected.length,'number of connected qualifying windows');
  expected.forEach((w,j)=>{
    near(actual.clearWindows[j].startMinute,w.startMinute,'start');
    near(actual.clearWindows[j].endMinute,w.endMinute,'end');
  });
  near(actual.clearMinutes,expected.reduce((s,w)=>s+w.endMinute-w.startMinute,0),'duration');
  if(expected.length) near(actual.earliestFeasibleDepartureMinute,expected[0].startMinute,'earliest');
  else assert.equal(actual.earliestFeasibleDepartureMinute,null);
  // Interior points check the independently sampled arrival consumer as well.
  for(const w of expected) {
    const departure=(w.startMinute+w.endMinute)/2;
    const inspected=inspectTimedRoute(result,route,steps,departure,threshold);
    assert.equal(inspected.allAtOrBelow,true);
    assert.equal(inspected.departureMinute,departure,'declared departure preserved');
    assert.equal(inspected.arrivals.length,route.length,'one arrival per route cell');
    assert.equal(inspected.firstFailure,null,'qualifying interior has no failed arrival');
    inspected.arrivals.forEach((arrival,k)=>{
      const expectedMinute=departure+steps.slice(0,k).reduce((sum,n)=>sum+n,0);
      assert.equal(arrival.cellIndex,route[k],'arrival cell follows declared order');
      assert.equal(arrival.routePosition,k,'arrival route position');
      near(arrival.minute,expectedMinute,'independently accumulated arrival time');
      near(arrival.depthMm,rawDepth(result,route[k],expectedMinute),'arrival depth');
    });
  }
  assert.deepEqual(result,original,'original modeled snapshots preserved');
  return actual;
}

test('independent oracle resolves overlapping arrival constraints and cumulative timing',()=>{
  receive(base(),[0,1,2],[2,3],1,0,25,[[0,3],[20,25]]);
  const original=receive(base(),[0,1,2],[2,3],1,0,18,[[0,3]]);
  const changed=receive(base(),[0,1,2],[2,10],1,0,18,[[0,3],[13,18]]);
  assert.equal(changed.clearMinutes-original.clearMinutes,5);
  receive(base(),[2,1,0],[2,3],1,0,25,[[0,3],[13,15]]);
});

test('proposal change yields +7 minutes and threshold change removes that difference',()=>{
  const proposal=series([0,10,20,30],[[0,0,0,0],[0,2,0,0],[0,0,0,0]]);
  const existing=receive(base(),[0,1,2],[2,3],1,0,25,[[0,3],[20,25]]);
  const improved=receive(proposal,[0,1,2],[2,3],1,0,25,[[0,3],[13,25]]);
  assert.equal(improved.clearMinutes-existing.clearMinutes,7);
  const relaxed=receive(base(),[0,1,2],[2,3],2,0,25,[[0,25]]);
  const relaxedProposal=receive(proposal,[0,1,2],[2,3],2,0,25,[[0,25]]);
  assert.equal(relaxedProposal.clearMinutes-relaxed.clearMinutes,0);
});

test('isolated equality is excluded but positive equality plateau remains',()=>{
  const isolated=series([0,5,10,15],[[2,1,0,0],[0,0,1,2]]);
  receive(isolated,[0,1],[5],1,0,10,[]);
  assert.equal(inspectTimedRoute(isolated,[0,1],[5],5,1).allAtOrBelow,true);
  for(const departure of [4.9,5.1])
    assert.equal(inspectTimedRoute(isolated,[0,1],[5],departure,1).allAtOrBelow,false);
  receive(series([0,5,10,15],[[2,1,1,0],[0,0,0,0]]),
    [0,1],[5],1,0,10,[[5,10]]);
});

test('inspector independently reports cumulative arrivals and earliest failing cell',()=>{
  const result=base(),route=[0,1,2],steps=[2,3];
  for(const [departure,expectedFailure] of [
    [20.5,null],
    [18,{cellIndex:2,routePosition:2,minute:23,depthMm:1.4}],
    [4,{cellIndex:1,routePosition:1,minute:6,depthMm:1.2}]
  ]) {
    const actual=inspectTimedRoute(result,route,steps,departure,1);
    assert.equal(actual.arrivals.length,3);
    assert.equal(actual.departureMinute,departure);
    actual.arrivals.forEach((arrival,k)=>{
      const expectedMinute=departure+[0,2,5][k];
      assert.equal(arrival.cellIndex,route[k]);
      assert.equal(arrival.routePosition,k);
      near(arrival.minute,expectedMinute,'independent inspector arrival');
      near(arrival.depthMm,rawDepth(result,route[k],expectedMinute),'independent inspector depth');
    });
    assert.equal(actual.allAtOrBelow,expectedFailure===null);
    if(expectedFailure===null) {
      assert.equal(actual.firstFailure,null);
      near(actual.arrivals[2].minute,25.5,'qualifying final arrival');
      near(actual.arrivals[2].depthMm,0.9,'qualifying final depth');
    } else {
      assert.ok(actual.firstFailure);
      assert.equal(actual.firstFailure.cellIndex,expectedFailure.cellIndex);
      assert.equal(actual.firstFailure.routePosition,expectedFailure.routePosition);
      near(actual.firstFailure.minute,expectedFailure.minute,'first exceedance time');
      near(actual.firstFailure.depthMm,expectedFailure.depthMm,'first exceedance depth');
    }
  }
});

test('deterministic varied raw snapshots agree with partition oracle',()=>{
  // Integer depths and quarter-minute steps keep these cases away from the
  // implementation's 1e-8 interval tolerance; not a floating-point stress test.
  let state=437;
  const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
  for(let caseIndex=0;caseIndex<48;caseIndex++) {
    const times=[3,7,14,23,35];
    const cells=Array.from({length:3},()=>times.map(()=>next()%5));
    const steps=[(next()%8+1)/4,(next()%8+1)/4];
    const route=caseIndex%2?[2,0,1]:[0,1,2];
    const threshold=[0.5,1,2,3][caseIndex%4];
    const until=35-steps[0]-steps[1];
    receive(series(times,cells),route,steps,threshold,3,until);
  }
});
