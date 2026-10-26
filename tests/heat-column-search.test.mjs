import test from 'node:test';
import assert from 'node:assert/strict';
import {p as original,query} from './heat-column-search-fixture.mjs';
import {compareHeatColumnEvidence} from '../heat-column-evidence.js';
import {evaluateHeatColumnTarget} from '../heat-column.js';
import {searchHeatColumnParameters,serializeHeatSearch,parseHeatSearch,HEAT_SEARCH_LIMIT} from '../heat-column-search.js';
const search=(p,q=query)=>searchHeatColumnParameters(p,q);
const signature=r=>r.candidates.map(c=>[c.id,c.hypothesis,c.objective,c.calibration]);
test('unseen interior explanation is found from original calibration while coarse/manual alternatives miss',()=>{
 const p=structuredClone(original),before=structuredClone(p);
 assert.equal(compareHeatColumnEvidence(p).calibrationLabels.length,0);
 const coarse=searchHeatColumnParameters(p,query,{refine:false}),r=search(p);
 assert.equal(coarse.compatibleIds.length,0);assert.ok(r.compatibleIds.length>0);assert.ok(r.evaluations<=HEAT_SEARCH_LIMIT);
 assert.equal(r.coarseCompatibleIds.length,0);assert.deepEqual(p,before);
 for(const c of r.candidates.filter(c=>r.compatibleIds.includes(c.id))){assert.equal(c.calibration.compatible,true);assert.ok(Math.abs(c.final.balanceResidualJm2)<1e-6);}
});
test('changed held-aside value never chooses search points, order, objective or calibration',()=>{
 const p=structuredClone(original),r=search(p);p.heatColumnEvidence.readings[2].temperatureC=100;
 const changed=search(p);assert.deepEqual(signature(changed),signature(r));assert.deepEqual(changed.compatibleIds,r.compatibleIds);
 assert.ok(changed.candidates.filter(c=>c.calibration.compatible).every(c=>c.challenge.compatible===false));
});
test('unfamiliar parameter targets and interval-mean operators use original windows',()=>{
 for(const [capacityJm2K,conductanceWm2K]of [[91000,17.3],[277000,55.2],[67000,71.8]]){
  const p=structuredClone(original),study=structuredClone(p.heatColumnStudy);Object.assign(study.lowerLayers.existing,{capacityJm2K,conductanceWm2K});
  const windows=[{fromMinute:21,minute:37},{fromMinute:64,minute:95}];const c=evaluateHeatColumnTarget(study,'existing',[143],windows);
  p.heatColumnEvidence.readings=windows.map((w,i)=>({...w,aggregation:'interval-mean',temperatureC:c.averages[i].surfaceMeanC,halfWidthC:.04,use:'calibration',source:'Unfamiliar authored interval control'}));
  const r=search(p);assert.ok(r.compatibleIds.length>0,JSON.stringify({capacityJm2K,conductanceWm2K,best:Math.min(...r.candidates.map(c=>c.objective))}));
  assert.ok(r.candidates.every(c=>c.calibration.rows.every(r=>r.aggregation==='interval-mean')));
 }
});
test('no calibration, impossible bands and equilibrium do not become identification claims',()=>{
 const p=structuredClone(original);p.heatColumnEvidence.readings.forEach(r=>r.use='challenge');assert.equal(search(p).evaluations,0);
 p.heatColumnEvidence.readings=[{minute:0,temperatureC:99,halfWidthC:0,use:'calibration',source:'Contradictory authored initial reading'}];
 const bad=search(p);assert.equal(bad.status,'no-compatible-proposal-found');assert.equal(bad.compatibleIds.length,0);
 p.heatColumnEvidence.readings[0].temperatureC=20;const all=search(p);assert.equal(all.compatibleIds.length,all.evaluations);assert.ok(all.evaluations<=HEAT_SEARCH_LIMIT);
});
test('raw source replay recomputes and forged derived output is refused',()=>{
 const text=serializeHeatSearch(original,query),v=parseHeatSearch(text);assert.deepEqual(search(v.project,v.query),search(original));
 const forged=JSON.parse(text);forged.report={compatibleIds:[1]};assert.throws(()=>parseHeatSearch(JSON.stringify(forged)),/original/);
 const before=structuredClone(original);assert.throws(()=>search(original,{...query,source:''}),/Source/);assert.deepEqual(original,before);
});
test('domain, stale source and combined work refusals remain separate from no fit',()=>{
 assert.throws(()=>search(original,{...query,capacity:{minimum:0,maximum:1e6}}),/bounds/);
 const stale=structuredClone(original);stale.heatColumnStudy.lowerLayers.existing.initialC++;assert.throws(()=>search(stale),/current/);
 const p=structuredClone(original);const schedule=Array.from({length:100},()=>({...p.surfaceHeatStudy.schedule[0],minutes:4.2}));
 p.surfaceHeatStudy.schedule=schedule;p.heatColumnStudy.heatStudy.schedule=schedule;p.heatColumnEvidence.columnStudy.heatStudy.schedule=schedule;
 assert.throws(()=>search(p),/budget|schedule|interval/i);
});
test('very narrow admitted domains keep reconstructed proposals inside original physical bounds',()=>{
 const q={capacity:{minimum:1000,maximum:1000.0000000001},conductance:{minimum:0,maximum:1e-8},source:'Independent review narrow-domain control'};
 const r=search(original,q);assert.ok(r.evaluations<=HEAT_SEARCH_LIMIT);
 for(const c of r.candidates){assert.ok(c.hypothesis.capacityJm2K>=q.capacity.minimum&&c.hypothesis.capacityJm2K<=q.capacity.maximum);assert.ok(c.hypothesis.conductanceWm2K>=0&&c.hypothesis.conductanceWm2K<=1e-8);}
});
test('retained NOAA measured interval means remain an informative failure under original authored physics',async()=>{
 const {readFile}=await import('node:fs/promises');const p=JSON.parse(await readFile(new URL('../examples/noaa-tucson-hourly/project.json',import.meta.url),'utf8')),before=structuredClone(p);
 const q={capacity:{minimum:10000,maximum:1000000},conductance:{minimum:0,maximum:100},source:'Authored search domain, not station material measurements'};
 const r=search(p,q);assert.equal(r.status,'no-compatible-proposal-found');assert.equal(r.compatibleIds.length,0);assert.ok(r.evaluations<=HEAT_SEARCH_LIMIT);assert.deepEqual(p,before);assert.equal(p.heatColumnEvidence.readings.length,9);assert.match(p.heatColumnEvidence.readings[0].source,/NOAA Tucson parent line16/);
});
