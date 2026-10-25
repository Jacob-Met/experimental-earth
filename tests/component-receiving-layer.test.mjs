import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample, runRain} from '../core.js';
import {DRAINING_LAYER_SCHEMA} from '../draining-infiltration.js';
import {serializeDrainingLayer, parseDrainingLayer} from '../draining-layer-study.js';
import {compareReceivingComponents} from '../component-receiving-layer.js';
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-7, `${a} != ${b}`);
function fixture() {
 const p=makeExample();p.proposal=structuredClone(p.existing);p.proposal[27].surface='garden';p.proposal[27].elevationM-=.05;p.proposal[27].internalBarriers={east:{closed:true,source:'Authored wall'}};
 return {project:p,layer:{schema:DRAINING_LAYER_SCHEMA,surface:'garden',capacityMm:5,initialStoredMm:0,drainagePerHour:1,source:'Authored finite receiver control'}};
}
function world(p,mask){const cells=structuredClone(p.existing);for(let i=0;i<cells.length;i++){if(mask&1)cells[i].surface=p.proposal[i].surface;if(mask&2)cells[i].elevationM=p.proposal[i].elevationM;if(mask&4){delete cells[i].internalBarriers;if(p.proposal[i].internalBarriers)cells[i].internalBarriers=structuredClone(p.proposal[i].internalBarriers);}}return cells;}
test('same source yields a qualified reversal and every independent world is retained',()=>{
 const {project:p,layer}=fixture(),before=JSON.stringify({p,layer});
 const r=compareReceivingComponents(p,layer,{study:{target:'existing',surface:'sealed',ratesMmHr:[1,9]}});assert.equal(r.status,'compared');
 for(const candidate of r.candidates){const override={surfaceInfiltrationOverride:{surface:'sealed',rateMmHr:candidate.rateMmHr}};
  for(const kind of ['unlimited','draining'])for(let mask=0;mask<8;mask++){
   const direct=runRain(world(p,mask),p.width,p.height,p.weather,{...override,...(kind==='draining'?{drainingLayer:layer}:{})});
   for(const m of candidate[kind].metrics)near(m.values[mask],direct[m.key]);near(direct.massErrorLiters,0);
  }
  const storage=candidate.changes.find(m=>m.key==='storedLiters');assert.ok(storage.unlimitedFullEffect<0);assert.ok(storage.drainingFullEffect>0);near(storage.fullEffectDifference,storage.drainingFullEffect-storage.unlimitedFullEffect);
 }
 near(r.candidates[0].changes.find(m=>m.key==='storedLiters').drainingFullEffect,5.762229692948495);
 assert.equal(JSON.stringify({p,layer}),before);
});
test('default capacities and original file replay retain the full calculation',()=>{
 const {project,layer}=fixture();const before=JSON.stringify({project,layer}),r=compareReceivingComponents(project,layer);assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].rateMmHr,null);
 const reopened=parseDrainingLayer(serializeDrainingLayer(project,layer));assert.deepEqual(compareReceivingComponents(reopened.project,reopened.layer),r);assert.equal(JSON.stringify({project,layer}),before);
});
test('zero drainage agrees with the maintained closed receiver in every world',()=>{
 const {project:p,layer}=fixture();layer.drainagePerHour=0;layer.initialStoredMm=2;
 const r=compareReceivingComponents(p,layer);for(let mask=0;mask<8;mask++){
  const direct=runRain(world(p,mask),p.width,p.height,p.weather,{infiltrationStorage:{schema:'experimental-earth-closed-infiltration-store/1',surface:'garden',remainingCapacityMm:3,source:'Authored closed counterpart'}});
  for(const m of r.candidates[0].draining.metrics)near(m.values[mask],direct[m.key]);
 }
});
test('unsupported evidence filters, absent receiver, invalid source and whole-work limits refuse without fallback',()=>{
 const {project:p,layer}=fixture();for(const subset of ['calibration','surviving','unknown'])assert.throws(()=>compareReceivingComponents(p,layer,{subset}),/require default/);
 assert.throws(()=>compareReceivingComponents(p,{...layer,capacityMm:-1}));
 const small=makeExample();small.width=small.height=2;small.selectedIndex=0;small.existing=Array.from({length:4},()=>({surface:'sealed',elevationM:0,provenance:'Authored'}));small.proposal=structuredClone(small.existing);small.proposal[0].surface='garden';small.proposal[0].elevationM=-.05;small.proposal[0].internalBarriers={east:{closed:true,source:'Authored'}};
 assert.equal(compareReceivingComponents(small,{...layer,surface:'turf'}).status,'layer-surface-absent');
 assert.equal(compareReceivingComponents(small,layer,{study:{surface:'turf',target:'existing',ratesMmHr:[1,9]}}).status,'rate-surface-absent');
 const large=structuredClone(small);large.width=large.height=24;large.existing=Array.from({length:576},()=>structuredClone(small.existing[0]));large.proposal=structuredClone(large.existing);large.proposal[0]=structuredClone(small.proposal[0]);Object.assign(large.weather,{durationMinutes:720,stepMinutes:1});assert.throws(()=>compareReceivingComponents(large,layer),/sixteen-world/);
});
