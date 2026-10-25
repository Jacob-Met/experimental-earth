import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample, runRain} from '../core.js';
import {compareEdgesGround, compareSurfaceElevation, compareComponentHypotheses} from '../proposal-components.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7, `${a} != ${b}`);
function source(){ const p=makeExample(); p.proposal=structuredClone(p.existing); p.proposal[27].surface='garden'; p.proposal[27].elevationM-=.05; p.proposal[27].internalBarriers={east:{closed:true,source:'Authored wall'}}; return p; }
test('edge/ground combinations reproduce independent worlds and preserve source',()=>{
 const p=source(), before=JSON.stringify(p), a=structuredClone(p.existing), b=structuredClone(p.proposal);
 a[27].internalBarriers=structuredClone(p.proposal[27].internalBarriers);delete b[27].internalBarriers;
 const runs=[p.existing,a,b,p.proposal].map(c=>runRain(c,p.width,p.height,p.weather));
 const r=compareEdgesGround(p); assert.equal(r.partition,'edges-ground');assert.deepEqual(r.selectedIndices,[27]); assert.deepEqual(r.remainingIndices,[27]);
 for(const m of r.metrics){for(const [i,k] of ['existing','selected','remaining','full'].entries())near(m[k],runs[i][m.key]);near(m.interaction,m.full-m.selected-m.remaining+m.existing);}
 for(const v of Object.values(r.balances))near(v.massErrorLiters,0);
 assert.equal(JSON.stringify(p),before);assert.throws(()=>compareSurfaceElevation(p),/unchanged/);
});
test('opening removal and finite crests retain independent source worlds',()=>{
 for(const crest of [false,true]){const p=source();p.existing[27].internalBarriers=crest?{east:{crestElevationM:.2,source:'Authored crest'}}:{east:{closed:true,source:'Authored wall'}};delete p.proposal[27].internalBarriers;
 const a=structuredClone(p.existing);delete a[27].internalBarriers;
 const b=structuredClone(p.proposal);b[27].internalBarriers=structuredClone(p.existing[27].internalBarriers);
 const r=compareEdgesGround(p),ar=runRain(a,p.width,p.height,p.weather),br=runRain(b,p.width,p.height,p.weather);
 for(const m of r.metrics){near(m.selected,ar[m.key]);near(m.remaining,br[m.key]);}}
});
test('source-only edge edits and absent ground factor refuse, fixed rates use same partition',()=>{
 const p=source();p.existing[27].internalBarriers=structuredClone(p.proposal[27].internalBarriers);p.existing[27].internalBarriers.east.source='Other source';assert.throws(()=>compareEdgesGround(p),/both/);
 const q=source();q.proposal[27].surface=q.existing[27].surface;q.proposal[27].elevationM=q.existing[27].elevationM;assert.throws(()=>compareEdgesGround(q),/both/);
 const h=compareComponentHypotheses(source(),undefined,{partition:'edges-ground',subset:'all'});assert.equal(h.status,'compared');assert.ok(h.candidates.every(c=>c.result.partition==='edges-ground'));
});
test('no lateral transfer gives zero edge effect and zero interaction',()=>{
 const p=source();p.weather.mobilityPerHour=0;
 for(const m of compareEdgesGround(p).metrics){near(m.selectedEffect,0);near(m.interaction,0);}
});
test('finite offered rates match independent four-world overrides',()=>{
 const p=source();const h=compareComponentHypotheses(p,undefined,{partition:'edges-ground',subset:'all',study:{target:'existing',surface:'sealed',ratesMmHr:[1,9]}});
 for(const candidate of h.candidates){
  const a=structuredClone(p.existing),b=structuredClone(p.proposal);a[27].internalBarriers=structuredClone(p.proposal[27].internalBarriers);delete b[27].internalBarriers;
  const runs=[p.existing,a,b,p.proposal].map(c=>runRain(c,p.width,p.height,p.weather,{surfaceInfiltrationOverride:{surface:'sealed',rateMmHr:candidate.rateMmHr}}));
  for(const m of candidate.result.metrics)for(const [i,k] of ['existing','selected','remaining','full'].entries())near(m[k],runs[i][m.key]);
 }
});
