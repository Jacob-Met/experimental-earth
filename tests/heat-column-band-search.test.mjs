import test from 'node:test';
import assert from 'node:assert/strict';
import {bandCase,query} from './heat-column-band-fixture.mjs';
import {searchHeatColumnParameters} from '../heat-column-search.js';
import {searchHeatColumnBands,serializeHeatBandSearch,parseHeatBandSearch,HEAT_BAND_SEARCH_METHOD} from '../heat-column-band-search.js';
const signature=r=>r.candidates.map(c=>[c.id,c.hypothesis,c.objective,c.calibration]);
test('original band continuation finds a known-feasible explanation missed by normalized least squares',()=>{
 const p=bandCase(),before=structuredClone(p),baseline=searchHeatColumnParameters(p,query),r=searchHeatColumnBands(p,query);
 assert.equal(baseline.compatibleIds.length,0);assert.ok(r.compatibleIds.length>0);assert.equal(r.status,'compatible-proposals');assert.ok(r.evaluations<=400);assert.equal(r.method,HEAT_BAND_SEARCH_METHOD);assert.deepEqual(p,before);
 const coarse=searchHeatColumnParameters(p,query,{refine:false});assert.deepEqual(r.candidates.slice(0,25),coarse.candidates);
});
test('40 known-feasible point controls and36 unfamiliar interval-mean controls retain compatible proposals',()=>{
 for(const C of [51000,91000,183000,277000,373000])for(const G of [7.3,17.3,41.2,71.8])for(const shift of [-1.5,1.5]){const r=searchHeatColumnBands(bandCase(C,G,shift),query);assert.ok(r.compatibleIds.length>0,JSON.stringify({C,G,shift}));assert.ok(r.evaluations<=400);}
 let state=7561;const random=()=>{state=(1664525*state+1013904223)>>>0;return state/2**32;};
 for(let i=0;i<36;i++){const C=45000+random()*340000,G=6+random()*72,r=searchHeatColumnBands(bandCase(C,G,i%2?1.4:-1.4,{mean:true,anchor:i%3}),query);assert.ok(r.compatibleIds.length>0,JSON.stringify({C,G,i}));assert.ok(r.evaluations<=400);}
});
test('challenge value and time cannot steer bracket anchor, sampled points or calibration',()=>{
 const p=bandCase();p.heatColumnEvidence.readings[2].use='challenge';const r=searchHeatColumnBands(p,query);
 p.heatColumnEvidence.readings[2].temperatureC=200;p.heatColumnEvidence.readings[2].minute=300;const changed=searchHeatColumnBands(p,query);assert.deepEqual(signature(changed),signature(r));assert.equal(changed.anchorReadingIndex,r.anchorReadingIndex);assert.ok(changed.candidates.filter(c=>c.calibration.compatible).every(c=>c.challenge.compatible===false));
});
test('nonmonotone cooling retains distinct detected conductance crossings instead of assuming one root',()=>{
 const p=bandCase();p.heatColumnEvidence.readings=[{minute:75,temperatureC:33,halfWidthC:.005,use:'calibration',source:'Authored two-crossing control'}];
 const r=searchHeatColumnBands(p,{capacity:{minimum:79999.9,maximum:80000.1},conductance:{minimum:0,maximum:1000},source:'Authored domain with nonmonotone cooling response'}),supported=r.candidates.filter(c=>c.calibration.compatible);
 assert.ok(supported.some(c=>c.hypothesis.conductanceWm2K<30));assert.ok(supported.some(c=>c.hypothesis.conductanceWm2K>30));assert.ok(r.evaluations<=400);
});
test('no calibration, exact initial ambiguity and contradiction remain honest',()=>{
 const p=bandCase();p.heatColumnEvidence.readings.forEach(r=>r.use='challenge');assert.equal(searchHeatColumnBands(p,query).evaluations,0);
 for(const temperatureC of [20,99]){p.heatColumnEvidence.readings=[{minute:0,temperatureC,halfWidthC:0,use:'calibration',source:'Authored time-zero control'}];const r=searchHeatColumnBands(p,query);assert.equal(r.compatibleIds.length,temperatureC===20?r.evaluations:0);assert.equal(r.status,temperatureC===20?'compatible-proposals':'no-compatible-proposal-found');assert.ok(r.evaluations<=400);}
});
test('original method/source replay recomputes; changed metadata or forged answers cannot masquerade as results',()=>{
 const p=bandCase(),raw=serializeHeatBandSearch(p,query),v=parseHeatBandSearch(raw);assert.deepEqual(searchHeatColumnBands(v.project,v.query),searchHeatColumnBands(p,query));
 const forged=JSON.parse(raw);forged.report={compatibleIds:[1]};assert.throws(()=>parseHeatBandSearch(JSON.stringify(forged)),/original/);forged.method='unsupported';assert.throws(()=>parseHeatBandSearch(JSON.stringify(forged)),/original/);
});
