import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceHeatColumn,advanceHeatColumnWithLoss} from '../heat-column-step.js';
import {compareCooling,inspectCooling,serializeCooling,parseCooling,validateCoolingStudy} from '../evaporative-cooling.js';
import {coolingExample} from '../evaporative-cooling-example.js';
import {inspectHeatColumn} from '../heat-column.js';
import {advanceRootZoneDry} from '../root-zone.js';
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}, difference ${a-b}`);
const surface={capacityJm2K:20000,exchangeWm2K:10,absorptivity:.8};
const lower={capacityJm2K:80000,conductanceWm2K:20};
const forcing={incidentWm2:700,reservoirC:20};
const initial={surfaceC:20,subsurfaceC:20};

test('zero latent loss preserves the maintained exact heat response',()=>{
  for(const h of [0,10,1000])for(const g of [0,20,1000]) {
    const args=[{...surface,exchangeWm2K:h},{...lower,conductanceWm2K:g},forcing,initial,100];
    const got=advanceHeatColumnWithLoss(...args,{initialWm2:0,decayPerSecond:.1});
    assert.deepEqual(got,{...advanceHeatColumn(...args),surfaceLossJm2:0});
  }
});
test('equal-rate and insulated analytic limits preserve heat and latent accounting',()=>{
  const rate=.001,seconds=1000,watts=100;
  const got=advanceHeatColumnWithLoss({...surface,exchangeWm2K:20},{...lower,conductanceWm2K:0},
    {incidentWm2:0,reservoirC:20},initial,seconds,{initialWm2:watts,decayPerSecond:rate});
  near(got.surfaceC,20-watts/surface.capacityJm2K*seconds*Math.exp(-rate*seconds));
  near(got.subsurfaceC,20);near(got.surfaceLossJm2,watts/rate*(1-Math.exp(-rate*seconds)));
  near(got.balanceResidualJm2,0);assert.ok(got.exchangeOutJm2<0);
  for(const decay of [0,1e-12,.001,1000]) {
    const v=advanceHeatColumnWithLoss({...surface,exchangeWm2K:0},{...lower,conductanceWm2K:0},
      {incidentWm2:0,reservoirC:20},initial,100,{initialWm2:100,decayPerSecond:decay});
    near(v.surfaceC,20-v.surfaceLossJm2/surface.capacityJm2K);near(v.balanceResidualJm2,0);
  }
});
test('splitting a decaying flux preserves endpoint and independent integrated energy',()=>{
  for(const rate of [0,1e-10,.0001172177814626813,.0016327822185373186,.001,10]) {
    const first=advanceHeatColumnWithLoss(surface,lower,forcing,initial,300,{initialWm2:150,decayPerSecond:rate});
    const second=advanceHeatColumnWithLoss(surface,lower,forcing,first,3300,{initialWm2:150*Math.exp(-rate*300),decayPerSecond:rate});
    const whole=advanceHeatColumnWithLoss(surface,lower,forcing,initial,3600,{initialWm2:150,decayPerSecond:rate});
    near(second.surfaceC,whole.surfaceC);near(second.subsurfaceC,whole.subsurfaceC);
    for(const key of ['inputJm2','surfaceLossJm2','exchangeOutJm2','transferDownJm2'])near(first[key]+second[key],whole[key],1e-5);
    near(whole.balanceResidualJm2,0,1e-5);near(whole.surfaceBalanceResidualJm2,0,1e-5);near(whole.subsurfaceBalanceResidualJm2,0,1e-5);
  }
});
test('rain water, temperature and independently integrated latent energy compose without source mutation',()=>{
  const {project,study}=coolingExample(),before=structuredClone({project,study}),r=compareCooling(project,study);
  assert.ok(r.initial.proposal.rechargeMm>r.initial.existing.rechargeMm);
  assert.ok(r.final.proposal.surfaceC<r.final.existing.surfaceC);
  assert.ok(r.final.proposal.suppliedMm>r.final.existing.suppliedMm);
  for(const row of r.trajectory)for(const side of ['existing','proposal']) {
    const v=row[side];near(v.waterResidualMm,0,1e-10);near(v.energyResidualJm2,0,2e-6);near(v.latentResidualJm2,0,2e-6);
    near(v.latentJm2,v.surfaceLossJm2+v.unmodeledLatentSupplyJm2,1e-7);
    assert.ok(v.availableMm>=0);assert.ok(v.unmetMm>=0);
  }
  assert.deepEqual({project,study},before);
});
test('dry store, zero demand and zero coupling recover the original thermal counterfactual',()=>{
  for(const mode of ['dry','demand','coupling','latent']) {
    const {project,study}=coolingExample();
    if(mode==='dry') {project.weather.rainMmHr=0;project.weather.rainTimeline=undefined;}
    if(mode==='demand')study.demands.forEach(x=>x.potentialTranspirationMmPerDay=0);
    if(mode==='coupling')study.surfaceLatentFraction={existing:0,proposal:0};
    if(mode==='latent')study.latentHeatJkg=0;
    const r=compareCooling(project,study),base=inspectHeatColumn(study.heatColumn,r.durationMinutes);
    for(const side of ['existing','proposal']) {near(r.final[side].surfaceC,base[side].surfaceC);near(r.final[side].surfaceLossJm2,0);}
    if(mode==='coupling'||mode==='latent')assert.ok(r.final.proposal.suppliedMm>0);
  }
});
test('water exhaustion and stress transitions receive exact same-time original water',()=>{
  for(const p of [0,.4,1]) {
    const {project,study}=coolingExample();for(const side of ['existing','proposal'])study.roots[side].depletionFraction=p;
    const r=compareCooling(project,study);
    for(const minute of [.1,35.75,239.99,240,241,480])for(const side of ['existing','proposal']) {
      let water=r.initial[side].rechargedMm, supplied=0,elapsed=0;
      for(let i=0;i<study.demands.length;i++) {
        const used=Math.min(study.heatColumn.heatStudy.schedule[i].minutes,Math.max(0,minute-elapsed));
        const step=advanceRootZoneDry({availableMm:water,capacityMm:r.initial[side].capacityMm,depletionFraction:p,
          demandMmPerDay:study.demands[i].potentialTranspirationMmPerDay,days:used/1440});
        water=step.availableMm;supplied+=step.suppliedMm;elapsed+=study.heatColumn.heatStudy.schedule[i].minutes;
      }
      const got=inspectCooling(r,minute)[side];near(got.availableMm,water,1e-12);near(got.suppliedMm,supplied,1e-12);near(got.latentResidualJm2,0,2e-6);
    }
  }
});
test('input-only reopening recalculates and refuses changed source association or saved conclusions',()=>{
  const {project,study}=coolingExample(),text=serializeCooling(project,study),opened=parseCooling(text);
  assert.deepEqual(compareCooling(opened.project,opened.study),compareCooling(project,study));
  assert.throws(()=>parseCooling(JSON.stringify({...opened,result:{surfaceC:-99}})),/fields/);
  opened.project.heatColumnStudy.lowerLayers.proposal.capacityJm2K+=1;
  assert.throws(()=>validateCoolingStudy(opened.project,opened.study),/original current/);
  const bad=structuredClone(study);bad.demands[0].potentialTranspirationMmPerDay=-1;
  assert.throws(()=>validateCoolingStudy(project,bad),/0–30/);
});
