import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {prepareSolarStudy} from '../solar-occlusion.js';
import {compareSunPath, sunPathPosition} from '../solar-path.js';
import {compareSunPathSampling, inspectSunPathSampling} from '../solar-path-sampling.js';

function fixture() {
  const p=makeExample();p.width=8;p.height=2;p.selectedIndex=0;p.weather.cellSizeM=2;
  p.existing=Array.from({length:16},()=>({surface:'turf',elevationM:0,provenance:'Authored flat sampling control'}));
  p.proposal=structuredClone(p.existing);
  p.solarStudy=prepareSolarStudy(p,{headingDeg:0,elevationDeg:45,sunSource:'Original single direction',existing:[],
    proposal:[{cellIndex:7,heightMinM:10,heightMaxM:10,source:'Authored distant opaque column'}]});
  return p;
}
const input=()=>({latitudeDeg:51.5,longitudeDeg:-.1,
  gridColumnBearingDeg:sunPathPosition('2026-06-21T06:30:00Z',51.5,-.1,0).azimuthDeg,
  locationSource:'Authored London control',orientationSource:'Authored alignment to06:30 UTC sun',
  startUtc:'2026-06-21T06:00:00Z',endUtc:'2026-06-21T08:00:00Z',stepMinutes:60});

test('hourly endpoints miss47 independently evaluated finer blocked samples',()=>{
  const result=compareSunPathSampling(fixture(),input(),1),inspection=inspectSunPathSampling(result,0);
  assert.ok(result.coarse.samples.every(s=>s.proposal[0].status==='no-mapped-blocker'));
  assert.equal(result.evaluatedSamples,121);assert.equal(result.insertedSamples,118);
  assert.equal(inspection.newObservationCount,47);assert.equal(inspection.intervalsWithNewClassifications,1);
  const found=inspection.intervals[0].newObservations;
  assert.equal(found[0].utc,'2026-06-21T06:07:00.000Z');assert.equal(found.at(-1).utc,'2026-06-21T06:53:00.000Z');
  assert.ok(found.every(s=>s.newTargets.join()==='proposal'&&s.proposal.status==='blocked'&&s.proposal.witness.cellIndex===7));
});

test('derived coarse and fine reports exactly equal separate maintained path calls',()=>{
  const p=fixture();
  for(const [step,fine,end] of [[60,5,'2026-06-21T08:00:00Z'],[30,2,'2026-06-21T07:03:00Z'],[120,15,'2026-06-21T08:01:00Z']]){
    const declaration={...input(),stepMinutes:step,endUtc:end};const r=compareSunPathSampling(p,declaration,fine);
    assert.deepEqual(r.coarse,compareSunPath(p,declaration));
    assert.deepEqual(r.fine,compareSunPath(p,{...declaration,stepMinutes:fine}));
    assert.equal(r.coarse.samples.at(-1).utc,r.fine.samples.at(-1).utc);
    const inspected=inspectSunPathSampling(r,0);
    const inserted=inspected.intervals.flatMap(i=>i.inserted.map(s=>s.utc));
    assert.equal(new Set(inserted).size,r.insertedSamples);
    assert.ok(!inserted.includes(r.coarse.samples.at(-1).utc));
  }
});

test('each scenario is evaluated independently and height uncertainty remains explicit',()=>{
  const p=fixture();p.solarStudy.existing=structuredClone(p.solarStudy.proposal);
  p.solarStudy.proposal[0].heightMinM=0;
  const r=compareSunPathSampling(p,input(),1),inspection=inspectSunPathSampling(r,0);
  const sample=inspection.intervals[0].newObservations.find(s=>s.utc==='2026-06-21T06:30:00.000Z');
  assert.equal(sample.existing.status,'blocked');assert.equal(sample.proposal.status,'height-dependent');
  assert.deepEqual(sample.newTargets,['existing','proposal']);
  assert.equal(sample.proposal.witness.source,'Authored distant opaque column');
});

test('unchanging footprint has no new classification while low-sun categories are retained',()=>{
  const p=fixture(),r=compareSunPathSampling(p,input(),1);
  const footprint=inspectSunPathSampling(r,7);
  assert.equal(footprint.newObservationCount,0);
  assert.ok(footprint.intervals.flatMap(i=>i.inserted).every(s=>s.proposal.status==='footprint'));
  const dawn=compareSunPathSampling(p,{...input(),startUtc:'2026-03-20T05:56:00Z',endUtc:'2026-03-20T06:16:00Z',stepMinutes:20},1);
  assert.ok(dawn.fine.samples.some(s=>s.condition==='low-elevation'));
  const cells=inspectSunPathSampling(dawn,0).intervals[0].inserted;
  assert.ok(cells.some(s=>s.existing.status==='low-elevation'&&s.newTargets.includes('existing')));
});

test('finer-grid admission refuses unsupported ratios and complete work before any partial comparison',()=>{
  const p=fixture();
  for(const fine of [0,-1,.5,7,60,120,Infinity,NaN,'1'])assert.throws(()=>compareSunPathSampling(p,input(),fine),/finer whole-minute/);
  assert.throws(()=>compareSunPathSampling(p,{...input(),endUtc:'2026-06-21T10:00:00Z'},1),/193/);
  p.width=p.height=24;p.existing=Array.from({length:576},()=>({surface:'turf',elevationM:0,provenance:'Authored'}));p.proposal=structuredClone(p.existing);
  p.solarStudy=prepareSolarStudy(p,{headingDeg:0,elevationDeg:45,sunSource:'Authored',existing:[],proposal:[]});
  assert.throws(()=>compareSunPathSampling(p,input(),5),/ray-check budget/);
});

test('original declarations and sources remain unchanged; stale source and foreign cells refuse',()=>{
  const p=fixture(),before=structuredClone(p),d=input(),original=structuredClone(d);
  const r=compareSunPathSampling(p,d,5);assert.deepEqual(p,before);assert.deepEqual(d,original);
  for(const cell of [-1,16,.5,'0'])assert.throws(()=>inspectSunPathSampling(r,cell),/Select a cell/);
  p.existing[0].elevationM=.1;assert.throws(()=>compareSunPathSampling(p,d,5),/source changed/);
});
