import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeExample} from '../core.js';
import {prepareSurfaceHeatStudy,advanceSurfaceHeat} from '../surface-heat.js';
import {advanceHeatColumn,advanceHeatColumnWithBottom,advanceCoupledHeatLayers} from '../heat-column-step.js';
import {prepareLateralHeatStudy,compareLateralHeat,compareLateralHeatExact} from '../lateral-heat.js';
const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b} (limit ${tolerance})`);
const layer=([absorptivity,capacityJm2K,exchangeWm2K,initialC])=>({absorptivity,capacityJm2K,exchangeWm2K,initialC,source:'Authored analytic reference'});
const references=JSON.parse(readFileSync(new URL('./fixtures/lateral-heat-matrix.json',import.meta.url),'utf8'));
function declaration(c){
  const project=makeExample();project.weather.cellSizeM=c.size;
  project.surfaceHeatStudy=prepareSurfaceHeatStudy(project,{cellIndex:0,existing:layer(c.a),proposal:layer(c.a),schedule:c.schedule.map(([minutes,incidentWm2,reservoirC])=>({minutes,incidentWm2,reservoirC,source:'Authored matrix-reference exposure'}))});
  const study=prepareLateralHeatStudy(project,{neighborIndex:1,neighbor:layer(c.b),conductanceWK:c.g,source:'Authored total edge conductance'});
  return {project,study};
}

test('maintained analytic helper receives both forcing terms and every signed energy integral',()=>{
  for(const c of references){
    const {project,study}=declaration(c),before=structuredClone({project,study});
    const output=compareLateralHeatExact(project,study);assert.equal(output.status,'compared');
    assert.equal(output.method,'two-forced-stores-spectral/1');
    const final=output.results.existing.exact.final;
    final.temperaturesC.forEach((v,i)=>close(v,c.reference.temperaturesC[i],1e-9));
    close(final.transferJ,c.reference.transferJ,1e-6);
    final.exchangeOutJ.forEach((v,i)=>close(v,c.reference.exchangeOutJ[i],Math.max(1e-6,Math.abs(v)*1e-12)));
    const scale=Math.max(1,...final.inputJ.map(Math.abs),...final.exchangeOutJ.map(Math.abs));
    final.residualJ.forEach(v=>assert.ok(Math.abs(v)<=scale*1e-10));
    close(final.totalResidualJ,final.residualJ.reduce((a,b)=>a+b),1e-6);
    assert.deepEqual({project,study},before);
  }
});

test('old column and bottom-exchange outputs remain the zero-second-input specialization',()=>{
  for(const c1 of [1000,40000,1e7])for(const c2 of [1000,1e7])for(const h of [0,12,1000])for(const g of [0,20,1000])for(const seconds of [0,.001,60]){
    const first=layer([.7,c1,h,20]),interval={incidentWm2:600,reservoirC:25};
    for(const bottomExchange of [0,12]){
      const second=layer([0,c2,bottomExchange,35]);
      let old,exact;
      try {
        old=bottomExchange===0?advanceHeatColumn(first,{capacityJm2K:c2,conductanceWm2K:g},interval,{surfaceC:20,subsurfaceC:35},seconds):advanceHeatColumnWithBottom(first,{capacityJm2K:c2,conductanceWm2K:g},interval,{surfaceC:20,subsurfaceC:35},seconds,{conductanceWm2K:bottomExchange,reservoirC:25});
      } catch(error){assert.throws(()=>advanceCoupledHeatLayers(first,second,interval,{firstC:20,secondC:35},seconds,g));continue;}
      exact=advanceCoupledHeatLayers(first,second,interval,{firstC:20,secondC:35},seconds,g);
      close(exact.firstC,old.surfaceC);close(exact.secondC,old.subsurfaceC);
      close(exact.firstMeanC,old.surfaceMeanC);close(exact.secondMeanC,old.subsurfaceMeanC);
      close(exact.firstInputJm2,old.inputJm2);close(exact.secondInputJm2,0);
      close(exact.firstExchangeOutJm2,old.exchangeOutJm2);close(exact.secondExchangeOutJm2,old.bottomOutJm2??0);
      close(exact.transferJm2,old.transferDownJm2);
      const energyRoundoff=Math.max(1e-8,8*Number.EPSILON*(c1*Math.max(20,Math.abs(old.surfaceC))+c2*Math.max(35,Math.abs(old.subsurfaceC))));
      close(exact.balanceResidualJm2,old.balanceResidualJm2,energyRoundoff);
    }
  }
});

test('independently illuminated uncoupled cells retain the maintained single-layer response',()=>{
  const first=layer([.8,1000,0,20]),second=layer([.2,1e7,1000,45]),forcing={incidentWm2:300,reservoirC:15};
  const result=advanceCoupledHeatLayers(first,second,forcing,{firstC:20,secondC:45},60,0);
  const a=advanceSurfaceHeat(first,forcing,20,60),b=advanceSurfaceHeat(second,forcing,45,60);
  close(result.firstC,a.temperatureC);close(result.secondC,b.temperatureC);
  close(result.firstInputJm2,a.inputJm2);close(result.secondInputJm2,b.inputJm2);
  close(result.firstExchangeOutJm2,a.exchangedJm2);close(result.secondExchangeOutJm2,b.exchangedJm2);
  close(result.transferJm2,0);
});

test('both absorbed inputs work at zero ambient exchange, without an invented reservoir offset',()=>{
  const first=layer([1/3,2000,0,20]),second=layer([2/3,8000,0,20]);
  const r=advanceCoupledHeatLayers(first,second,{incidentWm2:600,reservoirC:25},{firstC:20,secondC:20},60,2);
  const delta=40*-Math.expm1(-.075),mean=23.6;
  close(r.firstC,mean+.8*delta);close(r.secondC,mean-.2*delta);
  close(r.firstInputJm2,12000);close(r.secondInputJm2,24000);
  close(r.firstExchangeOutJm2,0);close(r.secondExchangeOutJm2,0);close(r.balanceResidualJm2,0);
});

test('previously uncomputed stiff hour runs through the maintained source-bound consumer',()=>{
  const c=structuredClone(references[1]);c.schedule[0][0]=60;
  const {project,study}=declaration(c);
  assert.throws(()=>compareLateralHeat(project,study),/200000/);
  const report=compareLateralHeatExact(project,study),final=report.results.existing.exact.final;
  // Independent SciPy two-state exponential about the forced equilibrium.
  close(final.temperaturesC[0],19.072835628411195,1e-9);
  close(final.temperaturesC[1],19.2898780158489,1e-9);
  assert.ok(report.results.existing.exact.trajectory.length<=4);
  assert.ok(report.results.existing.exact.extrema[1].maximumC>20,'temporary neighbor warming remains visible although the final neighbor is cooler');
  const peak=report.results.existing.exact.extrema[1];
  assert.ok(peak.maximumMinute>0&&peak.maximumMinute<.1);
  assert.ok(report.results.existing.exact.trajectory.some(row=>row.kind==='interior stationary candidate'));
  const restored=JSON.parse(JSON.stringify({project,study}));assert.deepEqual(compareLateralHeatExact(restored.project,restored.study),report);
});

test('new normalized conductance admission does not widen old wrappers or accept malformed state',()=>{
  const first=layer([.3,1000,1000,25]),second=layer([.9,1e7,0,20]),forcing={incidentWm2:2000,reservoirC:15};
  assert.throws(()=>advanceHeatColumn(first,{capacityJm2K:second.capacityJm2K,conductanceWm2K:16000},forcing,{surfaceC:25,subsurfaceC:20},1));
  assert.ok(Number.isFinite(advanceCoupledHeatLayers(first,second,forcing,{firstC:25,secondC:20},1,16000).secondC));
  for(const conductance of [-1,16001,Infinity,'20'])assert.throws(()=>advanceCoupledHeatLayers(first,second,forcing,{firstC:25,secondC:20},1,conductance));
  for(const patch of [{absorptivity:-1},{exchangeWm2K:NaN},{capacityJm2K:0}])assert.throws(()=>advanceCoupledHeatLayers(first,{...second,...patch},forcing,{firstC:25,secondC:20},1,10));
  const {project,study}=declaration(references[0]);project.proposal[1].elevationM+=.01;
  assert.equal(compareLateralHeatExact(project,study).status,'context-changed');
});

test('independent review semigroup and swapped-store controls preserve all signed integrals',()=>{
  const first={capacityJm2K:3200,absorptivity:.8,exchangeWm2K:6};
  const second={capacityJm2K:8700,absorptivity:.15,exchangeWm2K:22};
  const forcing={incidentWm2:750,reservoirC:15},initial={firstC:40,secondC:8};
  for(const g of [0,1,16000])for(const seconds of [.00001,1,60,3600]){
    const full=advanceCoupledHeatLayers(first,second,forcing,initial,seconds,g);
    const half=advanceCoupledHeatLayers(first,second,forcing,initial,seconds/2,g);
    const end=advanceCoupledHeatLayers(first,second,forcing,{firstC:half.firstC,secondC:half.secondC},seconds/2,g);
    close(full.firstC,end.firstC,2e-10);close(full.secondC,end.secondC,2e-10);
    for(const key of ['firstInputJm2','secondInputJm2','firstExchangeOutJm2','secondExchangeOutJm2','transferJm2']){
      close(full[key],half[key]+end[key],Math.max(1e-7,Math.abs(full[key])*1e-10));
    }
    const swapped=advanceCoupledHeatLayers(second,first,forcing,{firstC:initial.secondC,secondC:initial.firstC},seconds,g);
    close(full.firstC,swapped.secondC,2e-10);close(full.secondC,swapped.firstC,2e-10);
    close(full.transferJm2,-swapped.transferJm2,Math.max(1e-7,Math.abs(full.transferJm2)*1e-10));
  }
});
