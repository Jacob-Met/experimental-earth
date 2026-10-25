import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {prepareSurfaceHeatStudy,inspectSurfaceHeat} from '../surface-heat.js';
import {prepareLateralHeatStudy,validateLateralHeatStudy,compareLateralHeat,exchangeHeatPair} from '../lateral-heat.js';

const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b} (tolerance ${tol})`);
function fixture() {
  const p=makeExample();
  const layer={absorptivity:.85,capacityJm2K:40000,exchangeWm2K:12,initialC:25,source:'Authored reference, not field evidence'};
  p.surfaceHeatStudy=prepareSurfaceHeatStudy(p,{cellIndex:0,existing:layer,proposal:{...layer,absorptivity:.3},schedule:[
    {minutes:60,incidentWm2:600,reservoirC:25,source:'Authored heating'},
    {minutes:60,incidentWm2:0,reservoirC:25,source:'Authored cooling'}]});
  const input={neighborIndex:1,neighbor:{...layer,absorptivity:.5,capacityJm2K:80000,exchangeWm2K:8},conductanceWK:80,source:'Authored lateral connection'};
  return {p,input,study:prepareLateralHeatStudy(p,input)};
}

test('closed unequal-capacity pair agrees with independent weighted equilibrium and exponential difference',()=>{
  const [a,b,ca,cb,g,t]=[80,20,1000,3000,2,123];
  const r=exchangeHeatPair(a,b,ca,cb,g,t),mean=(ca*a+cb*b)/(ca+cb),delta=(a-b)*Math.exp(-g*(1/ca+1/cb)*t);
  near(r.aC,mean+cb/(ca+cb)*delta,1e-12);near(r.bC,mean-ca/(ca+cb)*delta,1e-12);
  near(ca*(r.aC-a)+cb*(r.bC-b),0,1e-10);
  assert.ok(r.transferredJ>0);assert.ok(r.aC<a&&r.bC>b);
});
test('zero edge, equal temperatures, reverse flow, and stiff passive equilibration',()=>{
  assert.deepEqual(exchangeHeatPair(40,20,1000,2000,0,50),{aC:40,bC:20,transferredJ:0});
  assert.deepEqual(exchangeHeatPair(30,30,1000,2000,1000,86400),{aC:30,bC:30,transferredJ:0});
  assert.ok(exchangeHeatPair(20,40,1000,2000,10,50).transferredJ<0);
  const r=exchangeHeatPair(100,0,1000,3000,1000,86400);near(r.aC,25);near(r.bC,25);
  for(const args of [[20,30,0,1000,2,1],[20,30,1000,1000,-1,1],[NaN,20,1000,1000,1,1]])assert.throws(()=>exchangeHeatPair(...args));
  for(const capacities of [[1e11,Number.MIN_VALUE],[Number.MIN_VALUE,1e11],[Number.MIN_VALUE,Number.MIN_VALUE]])assert.throws(()=>exchangeHeatPair(40,20,...capacities,0,50));
  for(const capacities of [[62.5,1e11],[1e11,62.5]])assert.deepEqual(exchangeHeatPair(40,20,...capacities,0,50),{aC:40,bC:20,transferredJ:0});
});
test('zero coupling reproduces maintained surface-heat consumer at every schedule endpoint',()=>{
  const {p,input}=fixture();input.conductanceWK=0;const study=prepareLateralHeatStudy(p,input),r=compareLateralHeat(p,study);
  for(const target of ['existing','proposal'])for(const row of r.results[target].refined.trajectory){
    const original=inspectSurfaceHeat(p.surfaceHeatStudy,row.minute)[target];
    near(row.temperaturesC[0],original.temperatureC,1e-10);near(row.inputJ[0],original.inputJm2*r.results[target].refined.areaM2,1e-6);near(row.transferJ,0);
    near(row.temperaturesC[1],r.results.existing.refined.trajectory.find(x=>x.minute===row.minute).temperaturesC[1],1e-10);
  }
});
test('full consumer conserves signed total and local energy and changes the unchanged neighbor',()=>{
  const {p,study}=fixture(),original=structuredClone({p,study}),r=compareLateralHeat(p,study);
  assert.equal(r.status,'compared');assert.ok(r.proposalMinusExistingC[1]<-.01);
  for(const target of ['existing','proposal'])for(const row of r.results[target].refined.trajectory){
    near(row.totalResidualJ,0,1e-5);row.residualJ.forEach(x=>near(x,0,1e-5));
  }
  assert.deepEqual({p,study},original);assert.ok(r.results.existing.refined.final.transferJ>0);
  near(r.results.existing.isolated.final.temperaturesC[1],r.results.proposal.isolated.final.temperaturesC[1]);
});

// Independent conventional RK4 integrator of the unsplit forced balance.
function oracle(study,target) {
  const area=JSON.parse(study.heatStudy.contextJson).cellSizeM**2,layers=[study.heatStudy[target],study.neighbor];
  let T=layers.map(x=>x.initialC);
  for(const row of study.heatStudy.schedule){
    const count=20000,dt=row.minutes*60/count;
    const f=x=>layers.map((l,i)=>(l.absorptivity*row.incidentWm2-l.exchangeWm2K*(x[i]-row.reservoirC)+(study.conductanceWK/area)*(x[1-i]-x[i]))/l.capacityJm2K);
    const add=(v,k,h)=>v.map((x,i)=>x+h*k[i]);
    for(let j=0;j<count;j++) {const k1=f(T),k2=f(add(T,k1,dt/2)),k3=f(add(T,k2,dt/2)),k4=f(add(T,k3,dt));T=T.map((x,i)=>x+dt*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);}
  }
  return T;
}
test('splitting approaches independent unsplit RK4 and discloses boundary sensitivity',()=>{
  const {p,study}=fixture(),coarse=compareLateralHeat(p,study,120),fine=compareLateralHeat(p,study,30);
  for(const target of ['existing','proposal']){
    const reference=oracle(study,target),error=r=>Math.max(...r.results[target].refined.final.temperaturesC.map((x,i)=>Math.abs(x-reference[i])));
    assert.ok(error(fine)<error(coarse)/10);assert.ok(error(fine)<.001);
    assert.ok(fine.results[target].maximumBoundaryDifferenceC>0);
    assert.ok(fine.results[target].maximumBoundaryDifferenceC<coarse.results[target].maximumBoundaryDifferenceC);
  }
});
test('input source, neighbor adjacency and units are admitted without silently rebinding',()=>{
  const {p,input,study}=fixture();
  for(const patch of [{neighborIndex:0},{neighborIndex:p.width+1},{neighborIndex:-1},{conductanceWK:-1},{conductanceWK:Infinity},{source:''},{neighbor:{...input.neighbor,capacityJm2K:0}}])assert.throws(()=>prepareLateralHeatStudy(p,{...input,...patch}));
  const malformed=structuredClone(study);malformed.neighborContextJson='{}';assert.throws(()=>validateLateralHeatStudy(malformed));
  const changed=structuredClone(p);changed.existing[1].elevationM+=.01;assert.equal(compareLateralHeat(changed,study).status,'context-changed');
  const exposure=structuredClone(p);exposure.surfaceHeatStudy.schedule[0].incidentWm2+=1;assert.equal(compareLateralHeat(exposure,study).status,'context-changed');
  assert.deepEqual(compareLateralHeat(p,JSON.parse(JSON.stringify(study))),compareLateralHeat(p,study));
});
test('source area controls total conductance per cell; zero input remains isothermal',()=>{
  const {p,input}=fixture();for(const target of ['existing','proposal'])p.surfaceHeatStudy[target].absorptivity=0;
  input.neighbor.absorptivity=0;let study=prepareLateralHeatStudy(p,input),r=compareLateralHeat(p,study);
  for(const target of ['existing','proposal'])assert.deepEqual(r.results[target].refined.final.temperaturesC,[25,25]);
  near(r.results.existing.refined.final.transferJ,0);
  const a=fixture();a.p.weather.cellSizeM*=2;
  a.p.surfaceHeatStudy=prepareSurfaceHeatStudy(a.p,a.p.surfaceHeatStudy);study=prepareLateralHeatStudy(a.p,a.input);r=compareLateralHeat(a.p,study);
  assert.notEqual(r.results.existing.refined.final.temperaturesC[1],compareLateralHeat(fixture().p,fixture().study).results.existing.refined.final.temperaturesC[1]);
});
test('split step bounds and computational work refusal are explicit',()=>{
  const {p,study}=fixture();for(const step of [0,.1,301,NaN,'30'])assert.throws(()=>compareLateralHeat(p,study,step));
  const long=fixture();long.p.surfaceHeatStudy.schedule=[{minutes:720,incidentWm2:0,reservoirC:25,source:'Authored day'},{minutes:720,incidentWm2:0,reservoirC:25,source:'Authored day'}];
  const s=prepareLateralHeatStudy(long.p,long.input);assert.throws(()=>compareLateralHeat(long.p,s,1),/200000/);
});

test('stiff forced pair resolves coupled equilibrium instead of falsely agreeing on saturated split steps',()=>{
  const {p,input}=fixture();p.weather.cellSizeM=.25;
  const layer={absorptivity:1,capacityJm2K:1000,exchangeWm2K:1000,initialC:25,source:'Authored stiff analytic control'};
  p.surfaceHeatStudy=prepareSurfaceHeatStudy(p,{cellIndex:0,existing:layer,proposal:layer,
    schedule:[{minutes:.1,incidentWm2:1000,reservoirC:25,source:'Authored forcing'}]});
  input.neighbor={...layer,absorptivity:0};input.conductanceWK=1000;
  const study=prepareLateralHeatStudy(p,input),r=compareLateralHeat(p,study,30);
  const common=.5*-Math.expm1(-6),difference=(1000/33000)*-Math.expm1(-198);
  const expected=[25+common+difference/2,25+common-difference/2];
  assert.ok(r.results.existing.coarse.maxStepSeconds<.01);
  r.results.existing.refined.final.temperaturesC.forEach((v,i)=>near(v,expected[i],.0001));
  assert.ok(Math.abs(r.results.existing.isolated.final.temperaturesC[1]-expected[1])>.4);
  const long=structuredClone(p);long.surfaceHeatStudy.schedule[0].minutes=60;
  assert.throws(()=>compareLateralHeat(long,prepareLateralHeatStudy(long,input)),/200000/);
});

test('two independently illuminated cells approach an unsplit augmented-matrix reference across area and unequal properties',()=>{
  // Independent SciPy 1.17 expm of [T1,T2,Q12,Eambient1,Eambient2,1].
  // Generator: tests/reference/lateral_heat_matrix.py; full temperature and
  // signed-energy oracle: tests/fixtures/lateral-heat-matrix.json.
  // Areas vary BETWEEN cases: this model does not admit unequal cell areas.
  const cases=[
    {size:2,a:[.85,40000,12,25],b:[.5,80000,8,29],g:80,rows:[[60,600,25],[60,150,22]],T:[37.99008252829042,39.13231757469653],Q:1246806.203654153},
    {size:.25,a:[.3,1000,1000,90],b:[.9,1e7,0,20],g:1000,rows:[[.1,2000,15]],T:[19.74608746038991,20.00520412737222],Q:2577.5796076383112},
    {size:100,a:[.9,1e7,0,20],b:[.4,1000,1000,40],g:.1,rows:[[.1,1000,25],[.1,500,20]],T:[20.00081000005336,20.212979213914174],Q:-5.338135025179218},
    {size:.5,a:[.8,2500,1,70],b:[.2,9000,500,5],g:400,rows:[[.1,100,25],[.1,0,25]],T:[21.83282971736662,22.04006076058283],Q:30221.76955498664},
  ];
  const layer=([absorptivity,capacityJm2K,exchangeWm2K,initialC])=>({absorptivity,capacityJm2K,exchangeWm2K,initialC,source:'Authored independent matrix reference'});
  for(const c of cases){
    const p=makeExample();p.weather.cellSizeM=c.size;
    p.surfaceHeatStudy=prepareSurfaceHeatStudy(p,{cellIndex:0,existing:layer(c.a),proposal:layer(c.a),schedule:c.rows.map(([minutes,incidentWm2,reservoirC])=>({minutes,incidentWm2,reservoirC,source:'Authored reference forcing'}))});
    const study=prepareLateralHeatStudy(p,{neighborIndex:1,neighbor:layer(c.b),conductanceWK:c.g,source:'Authored explicit total W/K'});
    const r=compareLateralHeat(p,study).results.existing;
    const error=result=>Math.max(...result.final.temperaturesC.map((v,i)=>Math.abs(v-c.T[i])));
    assert.ok(error(r.refined)<.001,`Matrix temperature discrepancy ${error(r.refined)} C`);
    if(error(r.coarse)>1e-8)assert.ok(error(r.refined)<error(r.coarse)/3.5,'second-order approach to independent unsplit result');
    assert.ok(Math.abs(r.refined.final.transferJ-c.Q)<.001*Math.max(1,Math.abs(c.Q)),'signed internal energy approaches matrix integral');
    const scale=Math.max(1,...r.refined.final.inputJ.map(Math.abs),...r.refined.final.exchangeOutJ.map(Math.abs));
    r.refined.final.residualJ.forEach(v=>assert.ok(Math.abs(v)<1e-9*scale,'cell accounting relative to total energy scale'));
    near(r.refined.final.totalResidualJ,r.refined.final.residualJ.reduce((a,b)=>a+b),1e-6);
  }
});
