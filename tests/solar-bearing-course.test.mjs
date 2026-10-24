import test from 'node:test';
import assert from 'node:assert/strict';
import {bearingCourseFixture} from './solar-bearing-course-fixture.mjs';
import {prepareSolarStudy} from '../solar-occlusion.js';
import {compareSunPath,sunPathCellCourse} from '../solar-path.js';
import {inspectSunBearing} from '../solar-bearing.js';
import {planSunBearingCourse,inspectSunBearingCourse,bearingCourseEnvelopes} from '../solar-bearing-course.js';
import {sweepBearingCourse} from '../solar-bearing-course-sweep.js';
import {serializeSunBearingCourseInvestigation,parseSunBearingCourseInvestigation,reopenSunBearingCourseInvestigation,checkSunBearingCourseInvestigationBytes,MAX_SUN_BEARING_COURSE_BYTES} from '../solar-bearing-course-receipt.js';
const wrap=x=>((x%360)+360)%360;
const inAtom=(a,x)=>(x>a.from||a.includeFrom&&x===a.from)&&(x<a.to||a.includeTo&&x===a.to);

test('one common bearing tightens nine independent possibilities to seven original samples',()=>{
  const f=bearingCourseFixture(),before=JSON.stringify(f),r=inspectSunBearingCourse(f.project,f.declaration,f.settings);
  assert.equal(r.status,'bounded');assert.equal(r.sampleCount,9);assert.equal(r.samples.filter(s=>s.proposal.outer.length).length,9);
  assert.deepEqual(r.extrema,{existing:[0,0],proposal:[0,7],additional:[0,7],removed:[0,0]});
  assert.equal(r.limits.proposal.modeled,9);assert.equal(r.limits.pairedModeled,9);assert.equal(r.profile.length,37);assert.equal(r.eventCount,36);
  const w=r.witnesses.find(w=>w.counts.proposal===7);assert.ok(w);assert.deepEqual(w.countBounds.proposal,[7,7]);assert.equal(w.samples.filter(s=>s.proposal.status==='no-mapped-blocker').length,2);
  const independentlyChecked=sunPathCellCourse(compareSunPath(f.project,{...f.declaration,gridColumnBearingDeg:w.bearingDeg}),0);
  assert.deepEqual(w.samples.map(s=>s.proposal),independentlyChecked.map(s=>s.proposal));
  assert.equal(r.additionalWitnessCourses,2);assert.ok(r.estimatedRayTests<=16000000);assert.equal(JSON.stringify(f),before);
});

test('paired count profiles receive both scenarios at one unchanged bearing, not separate extrema',()=>{
  const f=bearingCourseFixture();f.project.solarStudy=prepareSolarStudy(f.project,{headingDeg:0,elevationDeg:45,sunSource:'Original paired control',existing:[{cellIndex:6,heightMinM:8,heightMaxM:8,source:'Authored C2 existing column'}],proposal:[{cellIndex:2,heightMinM:10,heightMaxM:10,source:'Authored C1 proposed column'}]});
  const r=inspectSunBearingCourse(f.project,f.declaration,f.settings);assert.equal(r.status,'bounded');
  let received=0;
  for(let j=0;j<=72;j++){
    const bearing=r.domain[0]+(r.domain[1]-r.domain[0])*j/72,atom=r.profile.find(a=>inAtom(a,bearing));assert.ok(atom);
    const steps=sunPathCellCourse(compareSunPath(f.project,{...f.declaration,gridColumnBearingDeg:wrap(bearing)}),0);
    const ranges={existing:[0,0],proposal:[0,0],additional:[0,0],removed:[0,0]};
    for(const step of steps){
      const flags={};for(const k of ['existing','proposal']){const status=step[k].status;flags[k]=status==='blocked'?[1,1]:status==='no-mapped-blocker'?[0,0]:[0,1];ranges[k][0]+=flags[k][0];ranges[k][1]+=flags[k][1];}
      const [e,p]=[flags.existing,flags.proposal];ranges.additional[0]+=Number(p[0]===1&&e[1]===0);ranges.additional[1]+=Number(p[1]===1&&e[0]===0);ranges.removed[0]+=Number(e[0]===1&&p[1]===0);ranges.removed[1]+=Number(e[1]===1&&p[0]===0);
    }
    for(const k of Object.keys(ranges)){assert.ok(atom.counts[k][0]<=ranges[k][0],`${k} lower at${bearing}`);assert.ok(ranges[k][1]<=atom.counts[k][1],`${k} upper at${bearing}`);}
    received++;
  }
  assert.equal(received,73);
});

test('zero and full-circle ranges preserve nominal identity, footprint and dark denominators',()=>{
  const f=bearingCourseFixture();
  const point=inspectSunBearingCourse(f.project,f.declaration,{...f.settings,halfWidthDeg:0});assert.equal(point.profile.length,1);assert.equal(point.witnesses.length,1);assert.deepEqual(point.extrema.proposal,[6,6]);
  const full=inspectSunBearingCourse(f.project,{...f.declaration,gridColumnBearingDeg:332.007},{...f.settings,halfWidthDeg:180});
  assert.deepEqual(full.domain,[0,360]);assert.equal(full.status,'bounded');assert.equal(full.declaration.gridColumnBearingDeg,332.007);assert.equal(full.sampleCount,9);
  const single=inspectSunBearing(f.project,{...f.declaration,gridColumnBearingDeg:332.007},{...f.settings,halfWidthDeg:180,sampleIndex:0});assert.deepEqual(single.domain,[0,360]);
  const footprint=inspectSunBearingCourse(f.project,f.declaration,{...f.settings,cellIndex:2});assert.equal(footprint.limits.proposal.footprint,9);assert.equal(footprint.limits.proposal.modeled,0);assert.equal(footprint.limits.pairedModeled,0);assert.deepEqual(footprint.extrema.additional,[0,0]);assert.equal(footprint.sampleCount,9);
  const dark=inspectSunBearingCourse(f.project,{...f.declaration,startUtc:'2026-06-21T00:00:00Z',endUtc:'2026-06-21T01:00:00Z'},f.settings);assert.equal(dark.limits.existing.belowHorizon,dark.sampleCount);assert.equal(dark.limits.pairedModeled,0);assert.deepEqual(dark.extrema.proposal,[0,0]);
});

test('numerical rejection remains unknown and excluded categories never become clear paired evidence',()=>{
  const domain=[0,2],clear={status:'no-mapped-blocker-throughout',inner:[],outer:[]},blocked={status:'blocked-throughout',inner:[[0,2]],outer:[[0,2]]};
  const samples=[
    {utc:'2026-06-21T06:00:00Z',domain,condition:'modeled',existing:{status:'numerically-unresolved',inner:[[0,2]],outer:[]},proposal:clear,witnesses:[]},
    {utc:'2026-06-21T06:30:00Z',domain,condition:'modeled',existing:{status:'footprint',inner:[],outer:[]},proposal:blocked,witnesses:[]},
    {utc:'2026-06-21T07:00:00Z',domain,condition:'below-horizon'}
  ];
  const n=bearingCourseEnvelopes(samples,domain),r=sweepBearingCourse(domain,n.rows);
  assert.deepEqual(n.rows[0].existing,{eligible:true,inner:[],outer:[[0,2]]});assert.equal(n.limits.existing.numericalUnknown,1);assert.equal(n.limits.existing.footprint,1);assert.equal(n.limits.existing.belowHorizon,1);assert.equal(n.limits.pairedModeled,1);
  assert.deepEqual(r.extrema.additional,[0,0]);assert.deepEqual(r.extrema.removed,[0,1]);
  const conflicting={utc:'2026-06-21T06:00:00Z',domain,condition:'modeled',existing:{status:'not-established',inner:[[.25,.5]],outer:[[0,2]]},proposal:clear,witnesses:[{unwrappedBearingDeg:.3,existing:{status:'no-mapped-blocker'},proposal:{status:'no-mapped-blocker'}}]};
  const c=bearingCourseEnvelopes([conflicting],domain);assert.equal(c.limits.existing.numericalUnknown,1);assert.deepEqual(c.rows[0].existing.inner,[]);assert.deepEqual(c.rows[0].existing.outer,[[0,2]]);
});

test('aggregate preflight refuses the whole course before a single-time budget can hide excess work',()=>{
  const f=bearingCourseFixture();
  for(const settings of [{...f.settings,sampleIndex:0},{...f.settings,halfWidthDeg:NaN},{...f.settings,halfWidthDeg:181},{...f.settings,cellIndex:8},{...f.settings,basis:''},{...f.settings,basis:'x'.repeat(401)}])assert.throws(()=>planSunBearingCourse(f.project,f.declaration,settings));
  const p=structuredClone(f.project);p.width=24;p.height=24;p.existing=Array.from({length:576},()=>({surface:'turf',elevationM:0,provenance:'Authored complete large grid'}));p.proposal=structuredClone(p.existing);p.solarStudy=prepareSolarStudy(p,{headingDeg:0,elevationDeg:45,sunSource:'Authored source',existing:[],proposal:[]});
  assert.throws(()=>planSunBearingCourse(p,f.declaration,f.settings),/complete original course.*ray-check budget/);
  const before=JSON.stringify(f.project);f.project.existing[0].elevationM=.1;assert.throws(()=>planSunBearingCourse(f.project,f.declaration,f.settings),/sourced obstruction|original site/);f.project.existing[0].elevationM=0;assert.equal(JSON.stringify(f.project),before);
});

test('raw replay recomputes all original samples and rejects cached profiles, model and source tamper',()=>{
  const f=bearingCourseFixture(),text=serializeSunBearingCourseInvestigation(f.project,f.declaration,f.settings),value=JSON.parse(text),opened=parseSunBearingCourseInvestigation(text);
  assert.deepEqual(Object.keys(value).sort(),['declaration','kind','model','project','settings']);assert.equal(Object.keys(value.settings).length,3);assert.equal(Object.keys(value.declaration).length,8);
  assert.deepEqual(opened.report,inspectSunBearingCourse(f.project,f.declaration,f.settings));assert.deepEqual(opened.envelope.project,f.project);
  for(const bad of [{...value,profile:[]},{...value,extrema:{proposal:[0,0]}},{...value,settings:{...value.settings,sampleIndex:0}},{...value,declaration:{...value.declaration,sampleCount:1}},{...value,model:{...value.model,version:'untrusted'}}])assert.throws(()=>reopenSunBearingCourseInvestigation(bad));
  const changed=structuredClone(value);changed.project.proposal[7].elevationM=.2;assert.throws(()=>reopenSunBearingCourseInvestigation(changed));
  assert.throws(()=>parseSunBearingCourseInvestigation('{'));assert.throws(()=>checkSunBearingCourseInvestigationBytes(MAX_SUN_BEARING_COURSE_BYTES+1));assert.throws(()=>checkSunBearingCourseInvestigationBytes(-1));
});

test('an unaligned final endpoint remains a complete original timestamp, not a duration weight',()=>{
  const f=bearingCourseFixture(),declaration={...f.declaration,endUtc:'2026-06-21T10:10:00Z'},r=inspectSunBearingCourse(f.project,declaration,f.settings),original=compareSunPath(f.project,declaration);
  assert.equal(r.sampleCount,10);assert.equal(r.samples.at(-1).utc,'2026-06-21T10:10:00.000Z');assert.deepEqual(r.samples.map(s=>s.utc),original.samples.map(s=>s.utc));assert.deepEqual(r.samples.map(s=>s.settings.sampleIndex),Array.from({length:10},(_,i)=>i));
  assert.equal(r.limits.proposal.modeled,10);assert.match(r.semantics,/not duration/);assert.ok(r.extrema.proposal[1]<=10);
});
