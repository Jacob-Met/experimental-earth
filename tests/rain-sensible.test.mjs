import test from 'node:test';import assert from 'node:assert/strict';
import {rainSensibleStep,compareRainSensible,saveRainSensible,reopenRainSensible} from '../rain-sensible.js';
import {advanceHeatColumn} from '../heat-column-step.js';
import {rechargeCoolingExample} from '../recharge-cooling-example.js';
const surface={capacityJm2K:100000,exchangeWm2K:10,absorptivity:.8},lower={capacityJm2K:200000,conductanceWm2K:5},forcing={incidentWm2:500,reservoirC:30},initial={surfaceC:50,subsurfaceC:40};
const p={rateMmHr:60,waterC:10,contactFraction:1,volumetricHeatCapacityJm3K:4180000};
const request={source:'Authored liquid properties and contact',clockSource:'Authored common event start',waterC:10,volumetricHeatCapacityJm3K:4180000,contactFraction:{existing:1,proposal:.5}};
test('cold and warm incoming rain reverse signed water exchange and conserve both stores',()=>{
 const old=advanceHeatColumn(surface,lower,forcing,initial,3600),cold=rainSensibleStep(surface,lower,forcing,initial,3600,p),warm=rainSensibleStep(surface,lower,forcing,initial,3600,{...p,waterC:70});
 assert.ok(cold.surfaceC<old.surfaceC);assert.ok(warm.surfaceC>old.surfaceC);assert.ok(cold.waterOutJm2>0);assert.ok(warm.waterOutJm2<0);
 for(const r of [cold,warm])assert.ok(Math.abs(r.energyResidualJm2)<1e-7);
});
test('independent one-store closed form and separate-flux RK4 agree with exact kernel adapter',()=>{
 const h=10+4180*60/3600,eq=(400+10*30+(4180*60/3600)*10)/h;
 const exact=eq+(50-eq)*Math.exp(-h*3600/100000);
 assert.ok(Math.abs(rainSensibleStep(surface,{...lower,conductanceWm2K:0},forcing,initial,3600,p).surfaceC-exact)<1e-12);
 const actual=rainSensibleStep(surface,lower,forcing,initial,3600,p);let state=[50,40,0,0];const dt=.25;
 const rhs=([s,b])=>{const air=10*(s-30),water=(4180*60/3600)*(s-10),down=5*(s-b);return [(400-air-water-down)/100000,down/200000,air,water]};
 for(let t=0;t<3600;t+=dt){const a=rhs(state),b=rhs(state.map((x,i)=>x+dt*a[i]/2)),c=rhs(state.map((x,i)=>x+dt*b[i]/2)),d=rhs(state.map((x,i)=>x+dt*c[i]));state=state.map((x,i)=>x+dt*(a[i]+2*b[i]+2*c[i]+d[i])/6)}
 assert.ok(Math.abs(actual.surfaceC-state[0])<1e-10);assert.ok(Math.abs(actual.subsurfaceC-state[1])<1e-10);assert.ok(Math.abs(actual.waterOutJm2-state[3])<1e-7);
});
test('dry and zero-contact paths retain old behavior, and interval partition preserves signed accounts',()=>{
 const baseline=advanceHeatColumn(surface,lower,forcing,initial,3600);
 for(const changed of [{rateMmHr:0},{contactFraction:0}]){const r=rainSensibleStep(surface,lower,forcing,initial,3600,{...p,...changed});assert.equal(r.surfaceC,baseline.surfaceC);assert.equal(r.waterOutJm2,0)}
 const whole=rainSensibleStep(surface,lower,forcing,initial,3600,p),a=rainSensibleStep(surface,lower,forcing,initial,1234,p),b=rainSensibleStep(surface,lower,forcing,a,2366,p);
 assert.ok(Math.abs(b.surfaceC-whole.surfaceC)<1e-12);assert.ok(Math.abs(a.waterOutJm2+b.waterOutJm2-whole.waterOutJm2)<1e-8);
});
test('source event splits at nonaligned rain end, retains exact rain amount and nonmutation',()=>{
 const {project}=rechargeCoolingExample();project.weather.rainMmHr=30;project.weather.stormMinutes=17.5;const before=JSON.stringify(project);
 const r=compareRainSensible(project,request);assert.deepEqual(r.sides.existing.rainContact.course.map(p=>p.minute),[0,17.5,240,480]);assert.equal(r.sides.existing.rainContact.final.rainMm,8.75);assert.equal(JSON.stringify(project),before);
 const changed=compareRainSensible({...project,weather:{...project.weather,rainMmHr:0}},request);assert.equal(changed.sides.existing.rainContact.final.surfaceC,changed.sides.existing.baseline.final.surfaceC);
});
test('source-only save and reopen recompute, stale place and invalid assumptions refuse',()=>{
 const {project}=rechargeCoolingExample(),saved=JSON.parse(saveRainSensible(project,request));assert.equal(saved.sides,undefined);saved.sides={existing:{surfaceC:999}};
 assert.deepEqual(reopenRainSensible(JSON.stringify(saved)),compareRainSensible(project,request));
 const stale=structuredClone(project);stale.existing[stale.heatColumnStudy.heatStudy.cellIndex].elevationM+=.1;assert.throws(()=>compareRainSensible(stale,request),/current/);
 for(const bad of [{waterC:-1},{source:''},{clockSource:''},{contactFraction:{existing:2,proposal:0}}])assert.throws(()=>compareRainSensible(project,{...request,...bad}));
});
test('liquid phase omission is a refusal, never silently extrapolated through frozen or boiling contact',()=>{
 for(const temp of [-1,0,100,110])assert.throws(()=>rainSensibleStep(surface,lower,forcing,{...initial,surfaceC:temp},3600,p),/phase change/);
 assert.throws(()=>rainSensibleStep({...surface,exchangeWm2K:1000},lower,forcing,initial,3600,p),/supported finite/);
 const hot={capacityJm2K:1000,exchangeWm2K:0,absorptivity:1};assert.throws(()=>rainSensibleStep(hot,{...lower,conductanceWm2K:0},{incidentWm2:200,reservoirC:30},initial,3600,{...p,rateMmHr:1}),/phase change/);
});
