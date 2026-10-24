import test from 'node:test';
import assert from 'node:assert/strict';
import {planSunBearingEvidence,inspectSunBearingEvidence,bearingEvidenceRegions} from '../solar-bearing-evidence.js';
import {buildSunBearingEvidenceInvestigation,serializeSunBearingEvidenceInvestigation,parseSunBearingEvidenceInvestigation,reopenSunBearingEvidenceInvestigation,checkSunBearingEvidenceInvestigationBytes} from '../solar-bearing-evidence-receipt.js';
import {bearingEvidenceFixture} from './solar-bearing-evidence-fixture.mjs';
import {prepareSolarStudy} from '../solar-occlusion.js';
const run=f=>inspectSunBearingEvidence(f.project,f.declaration,f.settings,f.observations);
const record=(utc,state='no-mapped-blocker',scenario='existing')=>({utc,scenario,state,source:'Separate authored observation control'});

test('individually possible records can exclude one common bearing; original pattern has a checked match',()=>{
  const f=bearingEvidenceFixture(),before=JSON.stringify(f),blocked=f.observations.map(o=>({...o,state:'blocked'}));
  const no=run({...f,observations:blocked});assert.equal(no.status,'excluded');assert.equal(no.regions.possible.length,0);assert.ok(no.observations.every(o=>o.individuallyPossible));
  const pair=run({...f,observations:[blocked[0],blocked[8]]});assert.equal(pair.status,'excluded');
  const yes=run(f);assert.equal(yes.status,'sufficient');assert.equal(yes.observationCount,9);assert.deepEqual(yes.regions.sufficient,[{from:92.85128377059965,to:92.9334022931672,includeFrom:true,includeTo:true}]);
  assert.ok(yes.witnesses.some(w=>w.matchesAll&&w.observations.length===9&&w.observations.every(o=>o.match===true)));
  assert.ok(yes.eventCount<=yes.estimatedEvents);assert.equal(JSON.stringify(f),before);
});

test('mixed scenario records preserve per-scenario eligibility and all original UTC samples',()=>{
  const f=bearingEvidenceFixture();f.observations=[...f.observations,record(f.observations[0].utc)];const r=run(f);assert.equal(r.status,'sufficient');assert.equal(r.observationCount,10);assert.equal(r.course.sampleCount,9);
  f.settings.cellIndex=2;f.observations=[record(f.observations[0].utc)];assert.equal(run(f).status,'sufficient');
  f.observations=[record(f.observations[0].utc,'no-mapped-blocker','proposal')];assert.throws(()=>run(f),/not a modeled ground observation/);
  f.settings.cellIndex=0;f.declaration.startUtc='2026-06-21T22:00:00Z';f.declaration.endUtc='2026-06-21T23:00:00Z';f.observations=[record(f.declaration.startUtc)];assert.throws(()=>run(f),/not a modeled ground observation/);
});

test('exact complements retain closed contacts and an open clear gap without a representable midpoint',()=>{
  const hi=1+Number.EPSILON,domain=[0,2],envelope={eligible:true,inner:[[0,1],[hi,2]],outer:[[0,1],[hi,2]]};
  const clear=bearingEvidenceRegions(domain,[{state:'no-mapped-blocker',envelope}]);assert.deepEqual(clear.regions.sufficient,[{from:1,to:hi,includeFrom:false,includeTo:false}]);assert.deepEqual(clear.regions.possible,clear.regions.sufficient);
  const blocked=bearingEvidenceRegions(domain,[{state:'blocked',envelope}]);assert.equal(blocked.regions.sufficient.length,2);assert.equal(blocked.regions.sufficient[0].includeTo,true);
  const point={eligible:true,inner:[[1,1]],outer:[[1,1]]};assert.equal(bearingEvidenceRegions([1,1],[{state:'blocked',envelope:point}]).status,'sufficient');assert.equal(bearingEvidenceRegions([1,1],[{state:'no-mapped-blocker',envelope:point}]).status,'excluded');
  assert.throws(()=>bearingEvidenceRegions(domain,[{state:'blocked',envelope}],{maxEvents:7}),/budget/);
});

test('numerical unknown and uncertain height witnesses do not become opposite observations',()=>{
  const unknown={eligible:true,inner:[],outer:[[0,360]]};for(const state of ['blocked','no-mapped-blocker']){const r=bearingEvidenceRegions([0,360],[{state,envelope:unknown}]);assert.equal(r.status,'unresolved');assert.equal(r.regions.sufficient.length,0);assert.deepEqual(r.regions.possible,[{from:0,to:360,includeFrom:true,includeTo:true}]);}
  const f=bearingEvidenceFixture();f.project.solarStudy=prepareSolarStudy(f.project,{headingDeg:0,elevationDeg:45,sunSource:'Authored retained direction',existing:[],proposal:[{cellIndex:2,heightMinM:0,heightMaxM:10,source:'Authored unresolved height range'}]});
  const r=run(f);assert.equal(r.status,'unresolved');assert.ok(r.witnesses.some(w=>!w.matchesAll&&!w.contradictsAny&&w.observations.some(o=>o.match===null)));assert.equal(r.disagreements.length,0);
});

test('unaligned original final UTC admits; detached and canonical duplicate records refuse',()=>{
  const f=bearingEvidenceFixture();f.declaration.endUtc='2026-06-21T09:47:00Z';f.observations=[record(f.declaration.endUtc)];const p=planSunBearingEvidence(f.project,f.declaration,f.settings,f.observations);assert.equal(p.observations[0].sampleIndex,8);assert.equal(run(f).course.samples.at(-1).utc,'2026-06-21T09:47:00.000Z');
  for(const utc of ['2026-06-21T09:46:59Z','2026-06-21T10:00:00Z','2026-06-21T09:47:00','2026-06-31T09:47:00Z','2026-06-21T09:47:00.001Z'])assert.throws(()=>planSunBearingEvidence(f.project,f.declaration,f.settings,[record(utc)]));
  assert.throws(()=>planSunBearingEvidence(f.project,f.declaration,f.settings,[record(f.declaration.endUtc),record('2026-06-21T09:47:00.000Z')]),/Duplicate/);
  for(const observations of [[],Array.from({length:33},()=>record(f.declaration.endUtc)),[{...record(f.declaration.endUtc),source:' '}],[{...record(f.declaration.endUtc),cached:true}]])assert.throws(()=>planSunBearingEvidence(f.project,f.declaration,f.settings,observations));
});

test('complete extra-witness reservation refuses a course that fits only the original nine-course bound',()=>{
  const f=bearingEvidenceFixture();f.project.width=10;f.project.height=10;f.project.existing=Array.from({length:100},()=>({surface:'turf',elevationM:0,provenance:'Authored complete-work control'}));f.project.proposal=structuredClone(f.project.existing);f.project.solarStudy=prepareSolarStudy(f.project,{headingDeg:0,elevationDeg:45,sunSource:'Authored work control',existing:[],proposal:[]});
  f.declaration.endUtc='2026-06-21T19:00:00Z';f.observations=[record(f.declaration.startUtc)];assert.throws(()=>planSunBearingEvidence(f.project,f.declaration,f.settings,f.observations),/additional recorded-pattern witness/);
});

test('input-only evidence replay recomputes original course and refuses cached or detached source claims',()=>{
  const f=bearingEvidenceFixture(),before=JSON.stringify(f),raw=buildSunBearingEvidenceInvestigation(f.project,f.declaration,f.settings,f.observations),text=serializeSunBearingEvidenceInvestigation(f.project,f.declaration,f.settings,f.observations);
  const reopened=parseSunBearingEvidenceInvestigation(text);assert.deepEqual(reopened.report,run(f));assert.deepEqual(reopened.envelope.project,f.project);assert.deepEqual(Object.keys(raw).sort(),['declaration','kind','model','observations','project','settings']);assert.equal(JSON.stringify(f),before);
  assert.throws(()=>reopenSunBearingEvidenceInvestigation({...raw,regions:[]}));const model=structuredClone(raw);model.model.version='unrecognized';assert.throws(()=>reopenSunBearingEvidenceInvestigation(model),/model/);
  const source=structuredClone(raw);source.project.proposal[0].elevationM=1;assert.throws(()=>reopenSunBearingEvidenceInvestigation(source),/source|context|changed|Resolve/);
  assert.throws(()=>parseSunBearingEvidenceInvestigation('{'));assert.throws(()=>checkSunBearingEvidenceInvestigationBytes(5*1024*1024+1));
});
