import test from 'node:test';
import assert from 'node:assert/strict';
import { bandFlip, rankingFlip, noFlow, challengeFlip, rainStopInterpolationFlip } from './fixtures/resolution.mjs';
import { compareInfiltrationResolution as compare } from '../infiltration-resolution.js';
const close = (a, b) => assert.ok(Math.abs(a-b) < 1e-10, `${a} != ${b}`);
const readingFor = (r, rate, index=0) => r.candidates.find(c => c.rateMmHr === rate).readings.find(o => o.index === index);

test('fixed reading changes band classification with step alone, preserving inputs', () => {
  const p=bandFlip(), before=structuredClone(p), r=compare(p), reading=readingFor(r,9);
  assert.equal(r.status,'step-sensitive'); assert.deepEqual(r.stepsMinutes,[5,2.5,1.25]);
  assert.deepEqual(r.runs.map(run=>run.compatibleRatesMmHr),[[9],[],[]]);
  [6.940985617982156,7.4517560219159105,7.702638318799191].forEach((d,i)=>close(reading.predictions[i].depthMm,d));
  assert.deepEqual(reading.predictions.map(p=>p.withinBand),[true,false,false]);
  assert.equal(reading.bandChanged,true); close(reading.spreadMm,.761652700817035);
  assert.deepEqual(p,before);
});

test('closest calibration set can change while compatible candidates stay fixed', () => {
  const r=compare(rankingFlip());
  assert.equal(r.changes.closestCalibration,true); assert.equal(r.changes.calibrationCompatible,false);
  assert.deepEqual(r.runs.map(run=>run.closestCalibrationRatesMmHr),[[3],[9],[9]]);
  assert.deepEqual(r.candidates.map(c=>c.rateMmHr),r.runs[0].candidates.map(c=>c.rateMmHr));
});

test('uninterrupted no-flow rain agrees with an independent off-step analytic solution', () => {
  const p=noFlow(), before=structuredClone(p), r=compare(p);
  assert.equal(r.status,'no-decision-change');
  for(const c of r.candidates) for(const prediction of c.readings[0].predictions){
    close(prediction.depthMm,(30-c.rateMmHr)*17.3/60);
    assert.equal(prediction.method,'linear interpolation');
    assert.ok(prediction.beforeMinute<17.3 && prediction.afterMinute>17.3);
  }
  assert.deepEqual(r.runs.map(run=>run.compatibleRatesMmHr),[[10],[10],[10]]); assert.deepEqual(p,before);
});

test('held-aside values cannot affect calibration metrics, order or closest sets', () => {
  const p=noFlow(); p.observations.push({...p.observations[0],minute:60,use:'challenge',depthMm:0});
  const a=compare(p); p.observations[1].depthMm=1000; const b=compare(p);
  for(let i=0;i<a.runs.length;i++){
    assert.deepEqual(a.runs[i].candidates.map(c=>[c.rateMmHr,c.calibration]),b.runs[i].candidates.map(c=>[c.rateMmHr,c.calibration]));
    assert.deepEqual(a.runs[i].closestCalibrationRatesMmHr,b.runs[i].closestCalibrationRatesMmHr);
    assert.deepEqual(a.runs[i].compatibleRatesMmHr,b.runs[i].compatibleRatesMmHr);
    assert.notDeepEqual(a.runs[i].candidates.map(c=>c.challenge),b.runs[i].candidates.map(c=>c.challenge));
  }
});

test('held-aside band can change survival without changing calibration decisions', () => {
  const r=compare(challengeFlip());
  assert.equal(r.changes.closestCalibration,false); assert.equal(r.changes.calibrationCompatible,false);
  assert.equal(r.changes.surviving,true); assert.deepEqual(r.runs.map(run=>run.survivingRatesMmHr),[[9],[],[]]);
  assert.equal(readingFor(r,9,1).role,'challenge');
});

test('rain-stop interpolation sensitivity remains visible without surface flow', () => {
  const r=compare(rainStopInterpolationFlip()), reading=readingFor(r,10);
  [1.7,1.9,2].forEach((d,i)=>close(reading.predictions[i].depthMm,d));
  assert.deepEqual(reading.predictions.map(p=>p.withinBand),[false,false,true]);
  assert.equal(r.changes.closestCalibration,false,'near ties among worse candidates are not a new closest set');
  assert.deepEqual(reading.predictions.map(p=>[p.beforeMinute,p.afterMinute]),[[5,10],[5,7.5],[5,6.25]]);
});

test('minimum step refuses comparison and bounded duplicate steps are not rerun', () => {
  const p=noFlow(); p.weather.stepMinutes=1; const minimum=compare(p);
  assert.equal(minimum.status,'minimum-step'); assert.deepEqual(minimum.stepsMinutes,[1]); assert.deepEqual(minimum.runs,[]);
  p.weather.stepMinutes=1.5; assert.deepEqual(compare(p).stepsMinutes,[1.5,1]);
});

test('missing evidence, absent surface and excessive work refuse before simulations', () => {
  const p=bandFlip(); p.observations[0].scenario='proposal'; assert.equal(compare(p).status,'no-assigned-readings');
  p.observations[0].scenario='existing'; p.infiltrationStudy.surface='garden'; assert.equal(compare(p).status,'surface-absent');
  p.infiltrationStudy.surface='turf'; p.width=p.height=24; p.selectedIndex=0;
  p.existing=Array.from({length:576},()=>({elevationM:0,surface:'turf',provenance:'work bound fixture'}));
  p.proposal=structuredClone(p.existing); p.weather.durationMinutes=720; p.weather.stepMinutes=2;
  p.infiltrationStudy.ratesMmHr=[0,1,2,3,4,5,6,7,8]; const r=compare(p);
  assert.equal(r.status,'work-limit'); assert.ok(r.estimatedCellSteps>r.maxCellSteps); assert.deepEqual(r.runs,[]);
  p.weather.stepMinutes=NaN; assert.throws(()=>compare(p),/parameters/);
});
