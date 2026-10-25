import test from 'node:test';
import assert from 'node:assert/strict';
import {rechargeCoolingExample} from '../recharge-cooling-example.js';
import {compareRechargeCooling,inspectRechargeCooling,serializeRechargeCooling,parseRechargeCooling,validateRechargeCooling} from '../recharge-cooling.js';
import {runRootZoneTiming,rootZoneTimingAtDay} from '../root-zone-timing.js';
import {advanceHeatColumn} from '../heat-column-step.js';
const near=(a,b,tol=2e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),a+' != '+b);
test('native48interval rain follows independent seven-state rising-loss control at exact event end',()=>{
 const x=rechargeCoolingExample(),r=compareRechargeCooling(x.project,x.study),a=inspectRechargeCooling(r,240).existing;
 assert.equal(r.existing.originalIntervals.length,48);near(r.existing.originalRechargeMm,3);
 near(a.interval.availableMm,1.896361676485673);near(a.interval.suppliedMm,1.103638323514327);
 near(a.interval.surfaceC,42.129284417107804);near(a.interval.subsurfaceC,34.56886671046495);near(a.interval.surfaceMeanC,41.60119183800371);
 near(a.interval.surfaceLossJm2,1622348.33556606);near(a.latePulse.surfaceC,50.30877216918685);
 assert.equal(a.latePulse.suppliedMm,0);near(a.latePulse.availableMm,3);near(a.differenceC,-8.17948775207902);
 assert.ok(r.final.existing.differenceC>0,'holding water until event end can preserve later cooling: no monotone timing winner');
 for(const side of ['existing','proposal'])for(const kind of ['interval','latePulse'])for(const row of r.trajectory){
  const v=row[side][kind];assert.ok(Math.abs(v.waterResidualMm)<1e-10);assert.ok(Math.abs(v.latentResidualJm2)<1e-5);assert.ok(Math.abs(v.energyResidualJm2)<1e-5);
 }
});
test('exact selected-time water agrees with maintained recharge-timing owner across stress, drain and dry regimes',()=>{
 let cases=0;
 for(const p of [0,.4,1])for(const initial of [0,3,5])for(const rain of [.75,2,6]){
  const x=rechargeCoolingExample();x.project.weather.rainMmHr=rain;
  for(const side of ['existing','proposal'])Object.assign(x.study.cooling.roots[side],{depletionFraction:p,initialAvailableMm:initial});
  const r=compareRechargeCooling(x.project,x.study);
  for(const side of ['existing','proposal']){
   const native=runRootZoneTiming(x.study.cooling.roots[side],r[side].originalIntervals,{potentialTranspirationMmPerDay:18,source:'Same event demand'},[{durationDays:1/6,potentialTranspirationMmPerDay:6,source:'Same later demand'}]);
   for(const minute of [0,.123,4.999,5,117.7,239.999,240,240.01,301.5,480])for(const kind of ['interval','latePulse']){
    const a=inspectRechargeCooling(r,minute)[side][kind],b=rootZoneTimingAtDay(native[kind],minute/1440);
    for(const key of ['availableMm','suppliedMm','unmetMm','potentialMm','rechargeMm','drainageMm'])near(a[key],b[key]);
    assert.ok(Math.abs(a.energyResidualJm2)<1e-4);assert.ok(Math.abs(a.latentResidualJm2)<1e-4);cases++;
   }
  }
 }
 assert.equal(cases,1080);
});
test('zero declared surface fraction retains water timing while matching old no-loss heat response',()=>{
 const x=rechargeCoolingExample();x.study.cooling.surfaceLatentFraction={existing:0,proposal:0};const r=compareRechargeCooling(x.project,x.study),c=x.study.cooling;
 for(const side of ['existing','proposal']){
  const s=c.heatColumn.heatStudy[side],l=c.heatColumn.lowerLayers[side];let state={surfaceC:s.initialC,subsurfaceC:l.initialC};
  for(const f of c.heatColumn.heatStudy.schedule)state=advanceHeatColumn(s,l,f,state,f.minutes*60);
  near(r.final[side].interval.surfaceC,state.surfaceC);near(r.final[side].latePulse.surfaceC,state.surfaceC);
  assert.ok(r.final[side].interval.suppliedMm>0);assert.equal(r.final[side].interval.surfaceLossJm2,0);
 }
});
test('event-end pulse is right-continuous in water without retroactive heat loss, including final exposure boundary',()=>{
 const x=rechargeCoolingExample();const c=x.study.cooling;c.heatColumn.heatStudy.schedule=c.heatColumn.heatStudy.schedule.slice(0,1);c.demands=c.demands.slice(0,1);
 x.project.surfaceHeatStudy=structuredClone(c.heatColumn.heatStudy);x.project.heatColumnStudy=structuredClone(c.heatColumn);
 const r=compareRechargeCooling(x.project,x.study),before=inspectRechargeCooling(r,240-1e-7).existing.latePulse,end=r.final.existing.latePulse;
 assert.equal(before.rechargeMm,0);near(end.rechargeMm,3);assert.equal(end.suppliedMm,0);assert.equal(end.surfaceLossJm2,0);near(before.surfaceC,end.surfaceC);
});
test('source-only replay recomputes the same result and refuses missing clock, derived fields and incomplete clock coverage',()=>{
 const x=rechargeCoolingExample(),text=serializeRechargeCooling(x.project,x.study),open=parseRechargeCooling(text);
 assert.deepEqual(Object.keys(open).sort(),['project','schema','study']);assert.equal('trajectory' in open,false);
 assert.deepEqual(compareRechargeCooling(open.project,open.study).final,compareRechargeCooling(x.project,x.study).final);
 const bad=JSON.parse(text);bad.result={surfaceC:0};assert.throws(()=>parseRechargeCooling(JSON.stringify(bad)),/conclusions/);
 const missing=structuredClone(x.study);missing.clockSource='';assert.throws(()=>validateRechargeCooling(x.project,missing),/clock|minute zero/);
 const short=structuredClone(x);short.project.weather.durationMinutes=600;assert.throws(()=>validateRechargeCooling(short.project,short.study),/complete rain event/);
 for(const t of [-1,Infinity,NaN,481])assert.throws(()=>inspectRechargeCooling(compareRechargeCooling(x.project,x.study),t));
});
