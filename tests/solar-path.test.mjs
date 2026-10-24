import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {makeExample,compare} from '../core.js';
import {prepareSolarStudy,compareSolarOcclusion} from '../solar-occlusion.js';
import {compareSunPath,sunPathPosition,sunPathUtc,validateSunPath,sunPathCellCourse,sunPathContext} from '../solar-path.js';

function fixture() {
  const p=makeExample();p.width=4;p.height=2;p.selectedIndex=0;p.weather.cellSizeM=2;
  p.existing=Array.from({length:8},()=>({surface:'turf',elevationM:0,provenance:'Authored flat geometric control'}));
  p.proposal=structuredClone(p.existing);
  p.solarStudy=prepareSolarStudy(p,{headingDeg:0,elevationDeg:45,sunSource:'Original authored single direction',existing:[],
    proposal:[{cellIndex:2,heightMinM:2,heightMaxM:2,source:'Authored opaque column, not a surveyed building'}]});
  return p;
}
const input=()=>({latitudeDeg:51.5,longitudeDeg:-.1,gridColumnBearingDeg:90,
  locationSource:'Authored London coordinate for software controls',orientationSource:'Authored east-right/south-down grid',
  startUtc:'2026-06-21T04:00:00Z',endUtc:'2026-06-21T20:00:00Z',stepMinutes:60});
const angularGap=(a,b)=>Math.abs((a-b+540)%360-180);
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}

test('pinned solar positions agree with all 728 upstream-retained independent JPL reference positions',()=>{
  const ref=JSON.parse(readFileSync(new URL('./fixtures/solar-path-reference.json',import.meta.url)));
  assert.equal(ref.rows.length,728);assert.equal(ref.commit,'21449f34820c3c80a27a78cdc940747ff19ca1e3');
  let maxAz=0,maxAlt=0;
  for(const row of ref.rows){
    const got=sunPathPosition(row.utc,row.latitudeDeg,row.longitudeDeg,90);
    const az=angularGap(got.azimuthDeg,row.azimuth),alt=Math.abs(got.elevationDeg-row.altitude);
    maxAz=Math.max(maxAz,az);maxAlt=Math.max(maxAlt,alt);
    assert.ok(az<=.05,`${row.name} ${row.utc}: azimuth error ${az}`);
    assert.ok(alt<=.25,`${row.name} ${row.utc}: altitude error ${alt}`);
  }
  assert.ok(maxAz>0&&maxAlt>0,'comparison retains actual external residuals, not regenerated zero-error truth');
});

test('geographic north/east bearings convert to the existing grid convention without v1 radians/south confusion',()=>{
  const t='2026-06-21T12:00:00Z',north=sunPathPosition(t,51.5,-.1,0),east=sunPathPosition(t,51.5,-.1,90);
  assert.ok(north.azimuthDeg>170&&north.azimuthDeg<190,'London noon sun is near south');
  assert.equal(north.headingDeg,north.azimuthDeg);assert.ok(angularGap(east.headingDeg,north.headingDeg-90)<1e-10);
  assert.equal(north.elevationDeg,east.elevationDeg);assert.ok(east.elevationDeg>60&&east.elevationDeg<63);
});

test('every daytime sample exactly reuses the maintained paired obstruction calculation',()=>{
  const p=fixture(),r=compareSunPath(p,input());assert.equal(r.samples.length,17);
  for(const sample of r.samples){
    assert.equal(sample.condition,'modeled');
    const q=structuredClone(p);Object.assign(q.solarStudy,{headingDeg:sample.headingDeg,elevationDeg:sample.elevationDeg});
    const expected=compareSolarOcclusion(q);
    assert.deepEqual(sample.existing,expected.existing);assert.deepEqual(sample.proposal,expected.proposal);
    assert.deepEqual(sample.changes,expected.changes);assert.equal(sample.epsilonM,expected.epsilonM);
  }
  const course=sunPathCellCourse(r,1);
  assert.equal(course[0].proposal.status,'blocked');assert.equal(course.at(-1).proposal.status,'no-mapped-blocker');
  assert.ok(course.every(s=>s.existing.status==='no-mapped-blocker'));
  assert.ok(sunPathCellCourse(r,2).every(s=>s.proposal.status==='footprint'));
});

test('rotating the declared grid changes actual sampled obstruction without rotating the source geometry',()=>{
  const p=fixture(),before=structuredClone(p),a=compareSunPath(p,input()),b=compareSunPath(p,{...input(),gridColumnBearingDeg:270});
  assert.equal(a.samples[0].proposal[1].status,'blocked');assert.equal(b.samples[0].proposal[1].status,'no-mapped-blocker');
  assert.deepEqual(p,before);assert.notDeepEqual(a.samples.map(s=>s.proposal),b.samples.map(s=>s.proposal));
});

test('date, longitude and latitude changes affect the ephemeris and preserve explicit east/north signs',()=>{
  const t='2026-06-21T06:00:00Z',baseline=sunPathPosition(t,51.5,-.1,90);
  assert.notEqual(baseline.elevationDeg,sunPathPosition('2026-12-21T06:00:00Z',51.5,-.1,90).elevationDeg);
  assert.notEqual(baseline.elevationDeg,sunPathPosition(t,51.5,30,90).elevationDeg);
  assert.notEqual(baseline.elevationDeg,sunPathPosition(t,-51.5,-.1,90).elevationDeg);
  const west=sunPathPosition(t,30,-180,90),east=sunPathPosition(t,30,180,90);
  assert.ok(angularGap(west.azimuthDeg,east.azimuthDeg)<1e-8);assert.ok(Math.abs(west.elevationDeg-east.elevationDeg)<1e-8);
});

test('below-horizon and positive low-elevation samples are explicitly unmodeled, not clear ground',()=>{
  const p=fixture(),r=compareSunPath(p,{...input(),startUtc:'2026-03-20T05:56:00Z',endUtc:'2026-03-20T06:16:00Z',stepMinutes:5});
  assert.ok(r.samples.some(s=>s.condition==='below-horizon'));assert.ok(r.samples.some(s=>s.condition==='low-elevation'));
  assert.ok(r.samples.some(s=>s.condition==='modeled'));
  for(const row of r.samples.filter(s=>s.condition!=='modeled')){assert.equal(row.existing,null);assert.equal(row.proposal,null);assert.deepEqual(row.changes,[]);}
  const course=sunPathCellCourse(r,1);assert.equal(course[0].proposal.status,'below-horizon');
  assert.ok(course.some(s=>s.proposal.status==='low-elevation'));
});

test('polar night and polar day keep every requested sample without invented rise/set instants',()=>{
  const p=fixture(),config={...input(),latitudeDeg:78.22334,longitudeDeg:15.64689,startUtc:'2026-12-21T00:00:00Z',endUtc:'2026-12-22T00:00:00Z',stepMinutes:120};
  const night=compareSunPath(p,config);assert.equal(night.samples.length,13);assert.ok(night.samples.every(s=>s.condition==='below-horizon'));
  const day=compareSunPath(p,{...config,startUtc:'2026-06-21T00:00:00Z',endUtc:'2026-06-22T00:00:00Z'});assert.equal(day.samples.length,13);assert.ok(day.samples.every(s=>s.condition==='modeled'));
});

test('height uncertainty and witnesses survive reuse of the point model',()=>{
  const p=fixture();p.solarStudy.proposal[0].heightMinM=0;
  const r=compareSunPath(p,input()),row=r.samples[0].proposal[1];assert.equal(row.status,'height-dependent');
  assert.equal(row.witness.source,p.solarStudy.proposal[0].source);assert.equal(row.witness.cellIndex,2);
});

test('strict UTC admission rejects impossible dates, local clocks, offsets, normalized hours and unsupported years',()=>{
  for(const value of ['2026-02-30T12:00:00Z','2026-13-01T12:00:00Z','2026-01-01T24:00:00Z','2026-01-01T12:00:60Z',
    '2026-01-01T12:00','2026-01-01T12:00:00+01:00','2026-01-01T12:00:00.100Z','1899-12-31T23:59:59Z','2101-01-01T00:00:00Z',null])assert.throws(()=>sunPathUtc(value),String(value));
  assert.equal(sunPathUtc('2024-02-29T12:34:56Z'),Date.UTC(2024,1,29,12,34,56));
  assert.throws(()=>sunPathUtc('2025-02-29T12:34:56Z'));
});

test('sample generation includes an unaligned final instant exactly once and accepts canonical normalized input',()=>{
  const p=fixture(),config={...input(),startUtc:'2026-06-21T08:00:00Z',endUtc:'2026-06-21T09:05:00Z',stepMinutes:30};
  const r=compareSunPath(p,config);assert.deepEqual(r.samples.map(s=>s.utc),['2026-06-21T08:00:00.000Z','2026-06-21T08:30:00.000Z','2026-06-21T09:00:00.000Z','2026-06-21T09:05:00.000Z']);
  assert.deepEqual(compareSunPath(p,validateSunPath(config)),r);
});

test('geometry, source and column-declaration changes invalidate; unrelated rain rate does not silently rebind',()=>{
  const p=fixture(),context=sunPathContext(p),rain=structuredClone(p);rain.weather.rainMmHr+=1;
  assert.equal(sunPathContext(rain),context);assert.deepEqual(compareSunPath(rain,input()).samples,compareSunPath(p,input()).samples);
  for(const change of [q=>q.existing[0].elevationM=.1,q=>q.source='Different site',q=>q.weather.cellSizeM=3,q=>q.existing[0].provenance='Different source']){
    const q=structuredClone(p);change(q);assert.notEqual(sunPathContext(q),context);assert.throws(()=>compareSunPath(q,input()),/source changed/);
  }
  const changed=structuredClone(p);changed.solarStudy.proposal[0].source='New source';assert.notEqual(sunPathContext(changed),context);
  const absent=structuredClone(p);delete absent.solarStudy;assert.throws(()=>compareSunPath(absent,input()),/Save an obstruction/);
});

test('read-only computation preserves frozen input, saved single-direction metadata and rain behavior',()=>{
  const p=fixture(),before=structuredClone(p),decl=input(),rain=compare(p);freeze(p);freeze(decl);
  const r=compareSunPath(p,decl);assert.deepEqual(p,before);assert.equal(p.solarStudy.headingDeg,0);assert.equal(p.solarStudy.elevationDeg,45);
  assert.equal(p.solarStudy.sunSource,'Original authored single direction');assert.deepEqual(compare(p),rain);
  assert.equal(r.declaration.locationSource,decl.locationSource);assert.equal(r.declaration.orientationSource,decl.orientationSource);
  for(const cell of [-1,8,1.5,NaN])assert.throws(()=>sunPathCellCourse(r,cell));
});

test('complete-course budget and all declared bounds refuse before returning a partial result',()=>{
  const p=fixture();
  for(const over of [{latitudeDeg:90},{latitudeDeg:-90},{latitudeDeg:NaN},{longitudeDeg:181},{gridColumnBearingDeg:360},
    {gridColumnBearingDeg:-1},{locationSource:''},{orientationSource:' '},{locationSource:'x'.repeat(401)},
    {stepMinutes:0},{stepMinutes:1.5},{stepMinutes:241},{stepMinutes:1},
    {endUtc:input().startUtc},{endUtc:'2026-06-24T20:00:00Z'}])assert.throws(()=>compareSunPath(p,{...input(),...over}));
  p.width=p.height=24;p.existing=Array.from({length:576},()=>({...p.existing[0]}));p.proposal=structuredClone(p.existing);
  p.solarStudy=prepareSolarStudy(p,{...p.solarStudy});const before=structuredClone(p);
  assert.throws(()=>compareSunPath(p,input()),/ray-check budget/);assert.deepEqual(p,before);
  const admitted=compareSunPath(p,{...input(),endUtc:'2026-06-21T08:00:00Z'});assert.equal(admitted.samples.length,5);
});

test('UTC results are identical under different process time zones',()=>{
  const code="import {sunPathPosition} from './solar-path.js'; console.log(JSON.stringify(sunPathPosition('2026-06-21T12:00:00Z',51.5,-.1,90)))";
  const outputs=['UTC','America/Los_Angeles','Pacific/Kiritimati'].map(TZ=>{
    const r=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:new URL('../',import.meta.url),env:{...process.env,TZ},encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);return r.stdout;
  });assert.equal(new Set(outputs).size,1);
});
