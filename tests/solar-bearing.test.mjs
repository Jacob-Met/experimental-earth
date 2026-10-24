import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {prepareSolarStudy,compareSolarOcclusion} from '../solar-occlusion.js';
import {sunPathPosition} from '../solar-path.js';
import {inspectSunBearing,planSunBearing} from '../solar-bearing.js';
import {buildSunBearingInvestigation,serializeSunBearingInvestigation,parseSunBearingInvestigation,reopenSunBearingInvestigation,checkSunBearingInvestigationBytes,MAX_SUN_BEARING_BYTES} from '../solar-bearing-receipt.js';
import {rectangleDiskHeadingArc,headingArcBearings,unionBearingIntervals,bearingDomainCovered} from '../solar-bearing-geometry.js';
const wrap=a=>((a%360)+360)%360,utc='2026-03-20T09:00:00Z',position=sunPathPosition(utc,0,0,0),A=position.azimuthDeg;
function fixture(columns=[2],heightMinM=4,heightMaxM=4){
 const p=makeExample();p.width=4;p.height=2;p.selectedIndex=0;p.weather.cellSizeM=2;
 p.existing=Array.from({length:8},()=>({surface:'turf',elevationM:0,provenance:'Authored flat bearing control'}));p.proposal=structuredClone(p.existing);
 p.solarStudy=prepareSolarStudy(p,{headingDeg:0,elevationDeg:45,sunSource:'Authored saved original direction',existing:[],proposal:columns.map(cellIndex=>({cellIndex,heightMinM,heightMaxM,source:'Authored opaque column'}))});return p;
}
const declaration=bearing=>({latitudeDeg:0,longitudeDeg:0,gridColumnBearingDeg:wrap(bearing),locationSource:'Authored equatorial location',orientationSource:'Authored nominal orientation',startUtc:utc,endUtc:'2026-03-20T09:01:00Z',stepMinutes:1});
const settings=halfWidthDeg=>({cellIndex:0,sampleIndex:0,halfWidthDeg,basis:'Explicit illustrative bearing interval; not a survey'});
function actual(p,d,bearing){const q=structuredClone(p),s=sunPathPosition(d.startUtc,d.latitudeDeg,d.longitudeDeg,wrap(bearing));q.solarStudy={...q.solarStudy,headingDeg:s.headingDeg,elevationDeg:s.elevationDeg};return compareSolarOcclusion(q);}

test('retained nominal clearance can coexist with an original blocked witness in the declared range',()=>{
 const p=fixture(),before=JSON.stringify(p),r=inspectSunBearing(p,declaration(A-30),settings(35));
 assert.equal(r.nominal.proposal.status,'no-mapped-blocker');assert.equal(r.existing.status,'no-mapped-blocker-throughout');assert.equal(r.proposal.status,'not-established');assert.equal(r.bearingSensitive,true);
 assert.ok(r.witnesses.some(w=>w.proposal.status==='blocked'&&w.proposal.witness.cellIndex===2));assert.equal(JSON.stringify(p),before);assert.ok(r.actualWitnessCount<=7);
 const blocked=inspectSunBearing(p,declaration(A),settings(1));assert.equal(blocked.proposal.status,'blocked-throughout');assert.equal(blocked.paired,'additional-throughout');
 const clear=inspectSunBearing(p,declaration(A-45),settings(1));assert.equal(clear.proposal.status,'no-mapped-blocker-throughout');
});

test('disk-clipped angular events retain radius dependence and conservative tangent fallbacks',()=>{
 const r=rectangleDiskHeadingArc([3,5,-1,1],3.05,'outer');assert.equal(r.fallback,null);
 assert.ok(Math.abs((r.arc.endDeg-r.arc.startDeg)-2*Math.acos(3/3.05)*180/Math.PI)<1e-10);
 assert.equal(rectangleDiskHeadingArc([3,5,-1,1],2.9,'outer').arc,null);
 assert.ok(rectangleDiskHeadingArc([3,5,-1,1],3,'outer').arc);assert.equal(rectangleDiskHeadingArc([3,5,-1,1],3,'inner').arc,null);
 const corner=Math.hypot(3,1);assert.equal(rectangleDiskHeadingArc([3,5,1,2],corner,'inner').arc,null);
 assert.throws(()=>headingArcBearings({startDeg:NaN,endDeg:1},A,[0,1],'outer'),/heading arc/);
});

test('different original columns can jointly cover a complete bearing range',()=>{
 const r=inspectSunBearing(fixture([2,6]),declaration(A-10),settings(20));
 assert.equal(r.proposal.status,'blocked-throughout');assert.equal(r.paired,'additional-throughout');
 assert.equal(r.proposal.columns.some(c=>bearingDomainCovered(c.inner.ranges,r.domain)),false);
 assert.ok(r.proposal.columns.filter(c=>c.inner.ranges.length).length>=2);
});

test('wrapped, full, zero-width, height-limited, footprint and dark selections retain their meanings',()=>{
 const r=inspectSunBearing(fixture([4]),declaration(359),settings(5));assert.deepEqual(r.domain,[354,364]);assert.equal(r.proposal.status,'blocked-throughout');
 const full=inspectSunBearing(fixture(),declaration(A),settings(180));assert.equal(full.existing.status,'no-mapped-blocker-throughout');assert.equal(full.proposal.status,'not-established');
 assert.equal(inspectSunBearing(fixture(),declaration(A),settings(0)).proposal.status,'blocked-throughout');
 const uncertain=inspectSunBearing(fixture([2],0,4),declaration(A),settings(1));assert.equal(uncertain.proposal.status,'not-established');assert.ok(uncertain.witnesses.some(w=>w.proposal.status==='height-dependent'));
 const footprint=inspectSunBearing(fixture(),declaration(A),{...settings(180),cellIndex:2});assert.equal(footprint.proposal.status,'footprint');
 const dark=inspectSunBearing(fixture(),{...declaration(A),startUtc:'2026-03-20T00:00:00Z',endUtc:'2026-03-20T00:01:00Z'},settings(180));assert.equal(dark.condition,'below-horizon');assert.deepEqual(dark.witnesses,[]);
 assert.deepEqual(unionBearingIntervals([[0,1],[1+1e-10,2]]),[[0,1],[1+1e-10,2]]);assert.equal(bearingDomainCovered([[0,1],[1+1e-10,2]],[0,2]),false);
});

test('sufficient range conclusions agree with maintained rays across adversarial selected directions',()=>{
 let seed=842715,checked=0;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 for(let trial=0;trial<36;trial++){
  const p=fixture(),columns=[];
  for(let i=1;i<8;i++)if(random()<.5){const minimum=random()*7;columns.push({cellIndex:i,heightMinM:minimum,heightMaxM:minimum+random()*3,source:'Authored range oracle column'});}
  p.solarStudy=prepareSolarStudy(p,{headingDeg:0,elevationDeg:45,sunSource:'Authored source',existing:[],proposal:columns});
  const d=declaration(trial%3===0?A:360*random()),r=inspectSunBearing(p,d,settings(trial%3===0?.001:180*random()));
  for(let n=0;n<=40;n++){
   const sample=actual(p,d,r.domain[0]+(r.domain[1]-r.domain[0])*n/40);
   for(const target of ['existing','proposal']){
    const expected=r[target].status==='blocked-throughout'?'blocked':r[target].status==='no-mapped-blocker-throughout'?'no-mapped-blocker':null;
    if(expected){assert.equal(sample[target][0].status,expected,JSON.stringify({trial,n,target,domain:r.domain}));checked++;}
   }
  }
 }
 assert.ok(checked>1400);
});

test('source, complete selection, finite range and unexpected fields refuse before geometry',()=>{
 const p=fixture(),d=declaration(A),o=settings(5);
 for(const x of [{...o,halfWidthDeg:181},{...o,halfWidthDeg:NaN},{...o,sampleIndex:2},{...o,cellIndex:8},{...o,basis:' '},{...o,verdict:'blocked'}])assert.throws(()=>planSunBearing(p,d,x));
 const stale=structuredClone(p);stale.existing[0].provenance='Different retained survey';assert.throws(()=>inspectSunBearing(stale,d,o),/obstruction|source|context/i);
});

test('raw replay recomputes complete geometry and witnesses with original site and selection custody',()=>{
 const p=fixture(),d=declaration(A-30),o=settings(35),before=JSON.stringify(p);
 const text=serializeSunBearingInvestigation(p,d,o),parsed=JSON.parse(text),r=parseSunBearingInvestigation(text);
 assert.deepEqual(r.envelope.project,p);assert.deepEqual(r.envelope.settings,o);assert.equal(r.report.bearingSensitive,true);
 assert.deepEqual(r.report,inspectSunBearing(p,d,o));assert.equal(JSON.stringify(p),before);
 assert.deepEqual(Object.keys(parsed).sort(),['declaration','kind','model','project','settings']);
 assert.equal('sampleCount' in parsed.declaration,false);assert.equal('witnesses' in parsed,false);
 for(const mutate of [x=>x.verdict='blocked',x=>x.settings.arc=[0,360],x=>x.model.version='other',x=>x.project.proposal[0].elevationM=1,x=>x.settings.sampleIndex=5]){
  const bad=structuredClone(parsed);mutate(bad);assert.throws(()=>reopenSunBearingInvestigation(bad));
 }
 assert.throws(()=>parseSunBearingInvestigation('{broken'));assert.throws(()=>checkSunBearingInvestigationBytes(MAX_SUN_BEARING_BYTES+1));
 assert.throws(()=>parseSunBearingInvestigation(' '.repeat(MAX_SUN_BEARING_BYTES+1)),/limit/);
 assert.deepEqual(buildSunBearingInvestigation(p,d,o),parsed);
});
