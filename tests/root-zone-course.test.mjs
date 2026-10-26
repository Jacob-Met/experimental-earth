import test from 'node:test';import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {compareRootCourse,rootCourseAtDay,serializeRootCourse,parseRootCourse,validateRootCourse,ROOT_COURSE_SCHEMA} from '../root-zone-course.js';
import {compareRootZoneTiming,rootZoneTimingAtDay} from '../root-zone-timing.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
import {fixture} from './root-zone-course-fixture.mjs';
test('two native rain sources carry root inventory and expose spacing consequences',()=>{
 const x=fixture(),before=JSON.stringify(x),r=compareRootCourse(x),contiguous=compareRootCourse(fixture(0));
 assert.equal(JSON.stringify(x),before);close(r.existing.final.rechargeMm,20);close(r.existing.final.drainageMm,0);
 close(r.existing.final.suppliedMm,18.587084350145695);close(contiguous.existing.final.suppliedMm,17.039132072258987);
 close(contiguous.existing.final.drainageMm,1.870937936210045);
 assert.ok(r.existing.events[1].before.availableMm>0);assert.equal(r.existing.events[1].before.availableMm,r.existing.segments.find(s=>s.phase==='event'&&s.eventIndex===1).before.availableMm);
 for(const side of ['existing','proposal'])for(const day of [0,.01,1,2,7,r[side].final.day])close(rootCourseAtDay(r[side],day).balanceErrorMm,0);
 // An intentional reset loses retained inventory and must not satisfy the result.
 const reset={...x,events:[x.events[1]],schedule:x.schedule};reset.events[0]={...reset.events[0],gapDays:0};
 assert.notEqual(compareRootCourse(reset).existing.final.availableMm,r.existing.final.availableMm);
});
test('one-event course agrees with unchanged maintained timing consumer',()=>{
 const x=fixture();x.events.length=1;const e=x.events[0],study={schema:'experimental-earth-root-zone-study/1',cellIndex:x.cellIndex,rechargeBasis:'modeled-event-infiltration-pulse',associationSource:x.associationSource,existing:x.existing,proposal:x.proposal,schedule:x.schedule};
 const a=compareRootCourse(x),b=compareRootZoneTiming(e.project,study,e.eventDemand);
 for(const side of ['existing','proposal'])for(const day of [0,.01,.1,2,a[side].final.day]){const u=rootCourseAtDay(a[side],day),v=rootZoneTimingAtDay(b[side].interval,Math.min(day,b[side].interval.totalDays));for(const k of ['availableMm','rechargeMm','drainageMm','suppliedMm','unmetMm'])close(u[k],v[k]);}
});
test('complete event budgets and independent no-demand capacity oracle',()=>{
 const x=fixture();for(const e of x.events)e.eventDemand=e.gapDemand={source:'Authored no demand',potentialTranspirationMmPerDay:0};x.schedule[0].potentialTranspirationMmPerDay=0;
 const r=compareRootCourse(x);close(r.existing.final.availableMm,18);close(r.existing.final.drainageMm,2);close(r.existing.final.suppliedMm,0);
 for(const e of r.existing.events){close(e.original.originalBudget.absorbedLiters,10);close(e.after.rechargeMm-e.before.rechargeMm,10);}
});
test('source-only replay and mismatches, timeline and aggregate limits refuse',()=>{
 const x=fixture();assert.deepEqual(parseRootCourse(serializeRootCourse(x)),x);
 assert.throws(()=>parseRootCourse(JSON.stringify({...x,final:{availableMm:18}})),/original rooted course/);
 const bad=structuredClone(x);bad.events[1].project.proposal[0].elevationM=.1;assert.throws(()=>compareRootCourse(bad),/geometry/);
 const dup=structuredClone(x);dup.events[1].reference=dup.events[0].reference;assert.throws(()=>validateRootCourse(dup),/distinct/);
 const long=structuredClone(x);long.events[1].gapDays=366;assert.throws(()=>validateRootCourse(long),/366/);
 const large=structuredClone(x);large.events=Array.from({length:12},(_,i)=>{const e=structuredClone(x.events[0]);e.reference=String(i);e.project.width=e.project.height=12;e.project.existing=Array.from({length:144},()=>({...e.project.existing[0]}));e.project.proposal=structuredClone(e.project.existing);e.project.weather.durationMinutes=720;e.project.weather.stepMinutes=2;return e;});assert.throws(()=>validateRootCourse(large),/budget/);
});
test('unfamiliar carried courses agree with independent fine-step scalar water equation',()=>{
 // Independent midpoint integration of dS=R-E*min(1,S/T), in nonoverflow
 // controls; this does not call any maintained root propagator.
 for(let seed=1;seed<=12;seed++){
  const x=fixture(.15+seed*.07);x.existing={...x.existing,rootDepthM:.4,initialAvailableMm:seed/3,depletionFraction:.2+seed*.03};x.proposal=x.existing;
  x.events[0].eventDemand.potentialTranspirationMmPerDay=2+seed/5;x.events[1].eventDemand={...x.events[0].eventDemand};
  const r=compareRootCourse(x).existing,C=r.capacityMm,T=(1-x.existing.depletionFraction)*C;let S=x.existing.initialAvailableMm;
  for(const interval of r.segments){const duration=interval.endDay-interval.startDay,n=Math.max(1,Math.ceil(duration*20000)),h=duration/n,R=interval.rechargeMmPerDay,E=interval.demandMmPerDay;for(let k=0;k<n;k++){const a=R-E*Math.min(1,S/T);const mid=S+a*h/2;S+=h*(R-E*Math.min(1,mid/T));}assert.ok(S>=0&&S<C);}
  assert.ok(Math.abs(S-r.final.availableMm)<2e-7,`${seed}: ${S} != ${r.final.availableMm}`);
 }
});
