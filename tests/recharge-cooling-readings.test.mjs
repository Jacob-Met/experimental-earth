import test from 'node:test';
import assert from 'node:assert/strict';
import {rechargeCoolingExample} from '../recharge-cooling-example.js';
import {compareRechargeCooling,rechargeCoolingFractionVariant as variant,evaluateRechargeCoolingTarget as evaluate} from '../recharge-cooling.js';
import {RECHARGE_READINGS_SCHEMA,compareRechargeCoolingReadings,inspectRechargeCoolingReadings,authoredRechargeCoolingReadings,serializeRechargeCoolingReadings,parseRechargeCoolingReadings} from '../recharge-cooling-readings.js';
const near=(a,b,tol=2e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),a+' != '+b);
function fixture(){const x=rechargeCoolingExample();for(const side of ['existing','proposal'])x.study.cooling.roots[side].initialAvailableMm=1.5;return x;}
function point(model,side,kind,minute){return evaluate(model,side,kind,[minute]).trajectory.find(r=>r.minute===minute).surfaceC;}
function quadrature(model,side,kind,from,to){
 const cuts=[from,...model[side][kind].segments.map(s=>s.endMinute).filter(t=>t>from&&t<to),to];let integral=0;
 for(let j=1;j<cuts.length;j++){const a=cuts[j-1],b=cuts[j],n=b-a<1e-6?2:128,ts=Array.from({length:n+1},(_,i)=>a+(b-a)*i/n);
  const values=new Map(evaluate(model,side,kind,ts).trajectory.map(r=>[r.minute,r.surfaceC]));let sum=0;
  for(let i=0;i<=n;i++)sum+=(i===0||i===n?1:i%2?4:2)*values.get(ts[i]);
  integral+=sum*(b-a)/(3*n);
 }
 return integral/(to-from);
}
test('direct interval means match independent seven-state control and point quadrature across rain/pulse boundaries',()=>{
 const original=rechargeCoolingExample(),control=compareRechargeCooling(original.project,original.study);
 near(evaluate(control,'existing','interval',[],[{fromMinute:0,minute:240}]).averages[0].surfaceMeanC,41.60119183800371);
 const x=fixture(),base=compareRechargeCooling(x.project,x.study);
 for(const side of ['existing','proposal'])for(const kind of ['interval','latePulse']){
  const model=variant(base,side,.4);
  for(const [fromMinute,minute]of [[0,480],[239,241],[240-1e-9,240+1e-9],[12.345,13.987]]){
   const actual=evaluate(model,side,kind,[],[{fromMinute,minute}]).averages[0];
   near(actual.surfaceMeanC,quadrature(model,side,kind,fromMinute,minute),3e-8);
   assert.ok(Number.isFinite(actual.subsurfaceMeanC));
  }
  const windows=evaluate(model,side,kind,[],[{fromMinute:0,minute:480},{fromMinute:0,minute:240},{fromMinute:240,minute:480}]).averages;
  near(windows[0].surfaceMeanC,(windows[1].surfaceMeanC+windows[2].surfaceMeanC)/2);
  near(windows[0].subsurfaceMeanC,(windows[1].subsurfaceMeanC+windows[2].subsurfaceMeanC)/2);
 }
});
test('one constant fraction is affine for points and window means while original rain and water remain intact',()=>{
 const x=fixture(),source=JSON.stringify(x),base=compareRechargeCooling(x.project,x.study),snapshot=JSON.stringify(base);
 const windows=[{fromMinute:0,minute:61.5},{fromMinute:239.5,minute:301.25}];
 for(const side of ['existing','proposal'])for(const kind of ['interval','latePulse']){
  const ends=[0,1].map(f=>evaluate(variant(base,side,f),side,kind,[0,60,240,480],windows));
  for(const f of [.13,.4,.77]){
   const model=variant(base,side,f),course=evaluate(model,side,kind,[0,60,240,480],windows);
   assert.equal('final'in model,false);assert.equal('trajectory'in model,false);
   course.trajectory.forEach((row,i)=>{near(row.surfaceC,ends[0].trajectory[i].surfaceC*(1-f)+ends[1].trajectory[i].surfaceC*f);near(row.suppliedMm,ends[0].trajectory[i].suppliedMm);near(row.availableMm,ends[1].trajectory[i].availableMm);});
   course.averages.forEach((row,i)=>near(row.surfaceMeanC,ends[0].averages[i].surfaceMeanC*(1-f)+ends[1].averages[i].surfaceMeanC*f));
  }
 }
 assert.equal(JSON.stringify(x),source);assert.equal(JSON.stringify(base),snapshot);
});
test('calibration and held-aside rows require one common fraction under each recharge timing',()=>{
 const x=fixture(),e=authoredRechargeCoolingReadings(x.project,x.study),r=compareRechargeCoolingReadings(x.project,x.study,e);
 assert.equal(r.interval.status,'compatible-range');assert.equal(r.latePulse.status,'challenged');
 assert.ok(r.interval.survivingRange[0]<.4&&r.interval.survivingRange[1]>.4);
 near(r.interval.calibrationRange[0],.39520773492535877);near(r.latePulse.calibrationRange[0],.5270536884503664);
 assert.equal(r.latePulse.survivingRange,null);assert.ok(r.latePulse.calibrationRange[0]>.52);
 const inspection=inspectRechargeCoolingReadings(r,117.5);assert.ok(inspection.interval.survivingPredictionRangeC);assert.equal(inspection.latePulse.survivingPredictionRangeC,null);assert.ok(inspection.latePulse.calibrationPredictionRangeC);
 const calibrationOnly={...e,readings:[e.readings[0]]};assert.equal(compareRechargeCoolingReadings(x.project,x.study,calibrationOnly).latePulse.status,'needs-challenge');
 const allCalibration={...e,readings:e.readings.map(row=>({...row,use:'calibration'}))};assert.equal(compareRechargeCoolingReadings(x.project,x.study,allCalibration).latePulse.status,'calibration-rejected');
 const noCalibration={...e,readings:e.readings.map(row=>({...row,use:'challenge'}))};assert.equal(compareRechargeCoolingReadings(x.project,x.study,noCalibration).interval.status,'need-calibration');
});
test('reported window means constrain their complete windows with original sources and bands retained',()=>{
 const x=fixture(),base=compareRechargeCooling(x.project,x.study),truth=variant(base,'proposal',.4);
 const windows=[{fromMinute:20,minute:60},{fromMinute:420,minute:480}],means=evaluate(truth,'proposal','interval',[],windows).averages;
 const e={schema:RECHARGE_READINGS_SCHEMA,target:'proposal',fractionRange:[.2,.6],rangeSource:'Authored restricted domain',associationSource:'Authored exact window-mean control, not acquired readings',readings:windows.map((w,i)=>({...w,aggregation:'interval-mean',temperatureC:means[i].surfaceMeanC,halfWidthC:.001,use:i?'challenge':'calibration',source:'Original authored mean '+i}))};
 const before=JSON.stringify(e),r=compareRechargeCoolingReadings(x.project,x.study,e);assert.equal(r.interval.status,'compatible-range');assert.ok(r.interval.survivingRange[0]<=.4&&r.interval.survivingRange[1]>=.4);
 r.interval.rows.forEach((row,i)=>assert.deepEqual(row.reading,e.readings[i]));assert.equal(JSON.stringify(e),before);
 assert.ok(Math.abs(means[0].surfaceMeanC-point(truth,'proposal','interval',60))>.1,'point and sensor mean are distinct quantities');
});
test('zero sensitivity and a fixed declared fraction retain honest compatibility states',()=>{
 const x=fixture(),e=authoredRechargeCoolingReadings(x.project,x.study),initial=x.study.cooling.heatColumn.heatStudy.existing.initialC;
 e.readings=[{minute:0,temperatureC:initial,halfWidthC:0,use:'calibration',source:'Original event-start temperature'}];
 let r=compareRechargeCoolingReadings(x.project,x.study,e);for(const kind of ['interval','latePulse']){assert.equal(r[kind].rows[0].sensitivity,'none');assert.deepEqual(r[kind].calibrationRange,[0,1]);}
 e.readings[0].temperatureC=initial+1;r=compareRechargeCoolingReadings(x.project,x.study,e);assert.equal(r.interval.status,'calibration-rejected');
 const fixed=authoredRechargeCoolingReadings(x.project,x.study);fixed.fractionRange=[.4,.4];r=compareRechargeCoolingReadings(x.project,x.study,fixed);assert.deepEqual(r.interval.survivingRange,[.4,.4]);assert.equal(r.interval.rows[0].sensitivity,'fixed-range');
});
test('source-only replay and explicit numerical admission refuse unresolvable or detached evidence',()=>{
 const x=fixture(),e=authoredRechargeCoolingReadings(x.project,x.study),text=serializeRechargeCoolingReadings(x.project,x.study,e),open=parseRechargeCoolingReadings(text);
 assert.deepEqual(Object.keys(open).sort(),['evidence','project','schema','study']);assert.deepEqual(compareRechargeCoolingReadings(open.project,open.study,open.evidence).interval.survivingRange,compareRechargeCoolingReadings(x.project,x.study,e).interval.survivingRange);
 const forged=JSON.parse(text);forged.result={winner:'interval'};assert.throws(()=>parseRechargeCoolingReadings(JSON.stringify(forged)),/conclusions/);
 const bad=structuredClone(e);bad.readings[0]={...bad.readings[0],aggregation:'interval-mean',fromMinute:60};assert.throws(()=>compareRechargeCoolingReadings(x.project,x.study,bad));
 const base=compareRechargeCooling(x.project,x.study);
 for(const multiplier of [1,100,1000,10000,1e6])assert.throws(()=>evaluate(base,'existing','interval',[],[{fromMinute:0,minute:Number.MIN_VALUE*multiplier}]),/resolvable/);
 for(const window of [{fromMinute:0,minute:0},{fromMinute:-1,minute:1},{fromMinute:0,minute:481}])assert.throws(()=>evaluate(base,'existing','interval',[],[window]));
 assert.throws(()=>evaluate(base,'existing','interval',Array(2001).fill(0)));
 near(evaluate(base,'existing','interval',[],[{fromMinute:0,minute:1e-9}]).averages[0].surfaceMeanC,x.study.cooling.heatColumn.heatStudy.existing.initialC,1e-8);
});
