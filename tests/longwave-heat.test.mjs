import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLongwaveHeat, canonicalLongwaveHeat, LONGWAVE_HEAT_SCHEMA, STEFAN_BOLTZMANN, longwaveFluxWm2 } from '../longwave-heat.js';
const near = (a,b,tol=1e-6) => assert.ok(Math.abs(a-b)<tol, `${a} versus ${b}`);
function fixture() {
 const layer={absorptivity:.8,capacityJm2K:40000,exchangeWm2K:10,initialC:25,source:'Authored layer; not field data'};
 return {schema:LONGWAVE_HEAT_SCHEMA,exchangeBasis:'excludes-longwave',heatStudy:{schema:'experimental-earth-surface-heat/1',model:'uniform-layer-forced-linear-exchange',cellIndex:0,
 contextJson:JSON.stringify({width:2,height:2,cellSizeM:1,source:'Authored grid',cellIndex:0,existing:{surface:'sealed',elevationM:0,provenance:'authored'},proposal:{surface:'sealed',elevationM:0,provenance:'authored'}}),
 existing:{...layer},proposal:{...layer},schedule:[{minutes:60,incidentWm2:600,reservoirC:25,source:'Authored heating'},{minutes:120,incidentWm2:0,reservoirC:25,source:'Authored cooling'}]},existing:{emissivity:.9,source:'Assumed gray body'},proposal:{emissivity:.9,source:'Assumed gray body'},radiationSchedule:[{skyC:5,source:'Assumed effective environment'},{skyC:5,source:'Assumed effective environment'}]};
}
test('zero emissivity independently recovers exact forced linear recurrence at every sample',()=>{
 const x=fixture();x.existing.emissivity=0;x.proposal.emissivity=0;const r=compareLongwaveHeat(x);
 let t=25;
 for(let i=1;i<r.existing.trajectory.length;i++) {const heating=i<=60;const equilibrium=25+(heating?480:0)/10;t=equilibrium+(t-equilibrium)*Math.exp(-10*60/40000);near(r.existing.trajectory[i].temperatureC,t,2e-7);assert.equal(r.existing.trajectory[i].radiationJm2,0);}
});
test('pure radiative cooling agrees with independent fixed-step midpoint reference',()=>{
 // Absolute zero is outside the declared effective-sky range, so use an
 // independent high-order numerical quadrature of dT/dt for admissible sky.
 const x=fixture();x.heatStudy.existing.exchangeWm2K=0;x.heatStudy.schedule=[{minutes:60,incidentWm2:0,reservoirC:25,source:'No convection or shortwave'}];x.radiationSchedule=[{skyC:-80,source:'Declared cold reservoir'}];
 const result=compareLongwaveHeat(x).existing.final.temperatureC;
 // Independent fixed-step midpoint, separate direct fourth powers, dt=.01s.
 let t=25;const derivative=t=>-.9*STEFAN_BOLTZMANN*((t+273.15)**4-193.15**4)/40000;
 for(let i=0;i<360000;i++){const half=t+.005*derivative(t);t+=.01*derivative(half);}
 near(result,t,2e-7);
});
test('colder radiative surroundings permit sub-air cooling; warm surroundings supply signed heat',()=>{
 const x=fixture();x.heatStudy.schedule=[{minutes:120,incidentWm2:0,reservoirC:25,source:'Night control'}];x.radiationSchedule=[{skyC:5,source:'Cold surroundings'}];
 const cold=compareLongwaveHeat(x);assert.ok(cold.existing.final.temperatureC<23);assert.ok(cold.existing.final.convectionJm2<0);assert.ok(cold.existing.final.radiationJm2>0);
 x.radiationSchedule[0].skyC=50;const warm=compareLongwaveHeat(x);assert.ok(warm.existing.final.temperatureC>25);assert.ok(warm.existing.final.radiationJm2<0);
});
test('independent energy balance, exact equilibrium, same-input parity and unchanged sources',()=>{
 const x=fixture(),before=JSON.stringify(x),r=compareLongwaveHeat(x);assert.equal(JSON.stringify(x),before);assert.deepEqual(r.existing,r.proposal);
 for(const target of ['existing','proposal'])for(const row of r[target].trajectory)near(row.balanceResidualJm2,0,2e-7);
 x.heatStudy.schedule=[{minutes:120,incidentWm2:0,reservoirC:25,source:'Equilibrium'}];x.radiationSchedule=[{skyC:25,source:'Equilibrium'}];const e=compareLongwaveHeat(x).existing.final;assert.equal(e.temperatureC,25);assert.equal(e.radiationJm2,0);assert.equal(e.convectionJm2,0);
});
test('longwave emissivity is independent of shortwave absorption and changes daytime and night consequences',()=>{
 const x=fixture();x.proposal.emissivity=.1;const r=compareLongwaveHeat(x);assert.ok(r.proposal.maximumC>r.existing.maximumC+3);assert.ok(r.proposal.final.temperatureC>r.existing.final.temperatureC+2);
});
test('split forcing intervals preserve response and accounting',()=>{
 const x=fixture(),a=compareLongwaveHeat(x);x.heatStudy.schedule=x.heatStudy.schedule.flatMap(r=>[{...r,minutes:r.minutes/2},{...r,minutes:r.minutes/2}]);x.radiationSchedule=x.radiationSchedule.flatMap(r=>[{...r},{...r}]);const b=compareLongwaveHeat(x);near(a.existing.final.temperatureC,b.existing.final.temperatureC,1e-10);near(a.existing.final.radiationJm2,b.existing.final.radiationJm2,1e-8);
});
test('missing declarations, nonfinite temperatures, unsupported counts and excessive work refuse',()=>{
 for(const mutate of [x=>delete x.existing.source,x=>x.existing.emissivity=NaN,x=>x.proposal.emissivity=1.1,x=>x.radiationSchedule.pop(),x=>x.radiationSchedule[0].skyC=-273.15,x=>x.radiationSchedule[0].source='']){const x=fixture();mutate(x);assert.throws(()=>compareLongwaveHeat(x));}
 const x=fixture();for(const k of ['existing','proposal']){x.heatStudy[k].capacityJm2K=1000;x.heatStudy[k].exchangeWm2K=1000;}x.heatStudy.schedule=[{minutes:720,incidentWm2:0,reservoirC:25,source:'Long stiff control'},{minutes:720,incidentWm2:0,reservoirC:25,source:'Long stiff control'}];assert.throws(()=>compareLongwaveHeat(x),/work budget/);
});
test('factored radiation retains sign and precision near equal temperatures',()=>{assert.equal(longwaveFluxWm2(20,20,.9),0);assert.ok(longwaveFluxWm2(20+1e-10,20,.9)>0);near(longwaveFluxWm2(60,0,.9),.9*STEFAN_BOLTZMANN*(333.15**4-273.15**4),1e-10);});
test('stiff admitted convection is stable and equal-reservoir radiative cooling approaches without overshoot',()=>{
 const x=fixture();x.heatStudy.schedule=[{minutes:5,incidentWm2:0,reservoirC:20,source:'Stiff cooling'}];x.radiationSchedule=[{skyC:20,source:'Equal reservoir'}];
 for(const k of ['existing','proposal'])Object.assign(x.heatStudy[k],{capacityJm2K:1000,exchangeWm2K:1000,initialC:100});
 const r=compareLongwaveHeat(x);for(const row of r.existing.trajectory)assert.ok(row.temperatureC>=20&&row.temperatureC<=100);near(r.existing.final.temperatureC,20,1e-8);
});
test('explicit nonradiative basis is required, and out-of-range computed temperatures never become a result',()=>{
 const x=fixture();delete x.exchangeBasis;assert.throws(()=>compareLongwaveHeat(x),/linear exchange/);
 x.exchangeBasis='excludes-longwave';for(const k of ['existing','proposal'])Object.assign(x.heatStudy[k],{capacityJm2K:1000,exchangeWm2K:0,absorptivity:1});x.existing.emissivity=0;x.proposal.emissivity=0;x.heatStudy.schedule=[{minutes:10,incidentWm2:2000,reservoirC:25,source:'Unsupported heating'}];x.radiationSchedule=[{skyC:20,source:'No radiative coupling'}];assert.throws(()=>compareLongwaveHeat(x),/supported/);
});
test('nonzero radiative equilibrium follows Kelvin fourth-power balance independently',()=>{
 const x=fixture(),skyC=5,incidentWm2=200,absorptivity=.8,emissivity=.9;
 const equilibrium=(absorptivity*incidentWm2/(emissivity*STEFAN_BOLTZMANN)+(skyC+273.15)**4)**.25-273.15;
 for(const k of ['existing','proposal'])Object.assign(x.heatStudy[k],{exchangeWm2K:0,initialC:equilibrium,absorptivity});
 x.heatStudy.schedule=[{minutes:120,incidentWm2,reservoirC:-20,source:'Independent nonzero equilibrium'}];x.radiationSchedule=[{skyC,source:'Declared radiative environment'}];
 const r=compareLongwaveHeat(x).existing.final;near(r.temperatureC,equilibrium,1e-10);near(r.radiationJm2,r.inputJm2,1e-6);assert.equal(r.convectionJm2,0);
});
test('changed radiative surroundings use each original interval and preserve state across the discontinuity',()=>{
 const x=fixture();x.heatStudy.schedule=[{minutes:30,incidentWm2:0,reservoirC:25,source:'First interval'},{minutes:30,incidentWm2:0,reservoirC:25,source:'Second interval'}];x.radiationSchedule=[{skyC:-20,source:'Cold environment first'},{skyC:80,source:'Warm environment second'}];
 const full=compareLongwaveHeat(x),atSwitch=full.existing.trajectory.find(r=>r.minute===30).temperatureC;
 assert.ok(atSwitch<25);assert.ok(full.existing.final.temperatureC>atSwitch);
 const resumed=structuredClone(x);resumed.heatStudy.schedule=[x.heatStudy.schedule[1]];resumed.radiationSchedule=[x.radiationSchedule[1]];for(const k of ['existing','proposal'])resumed.heatStudy[k].initialC=atSwitch;
 near(compareLongwaveHeat(resumed).existing.final.temperatureC,full.existing.final.temperatureC,1e-10);
});

test('source-only canonical receiving strips forged derived fields at every input level',()=>{
 const x=fixture(),expected=structuredClone(x);x.result={temperatureC:999};x.integrationAttempts=0;x.existing.final={temperatureC:999};x.heatStudy.results={approved:true};x.heatStudy.existing.temperatureC=999;x.heatStudy.schedule[0].energyJm2=123;x.radiationSchedule[0].computedFlux=123;
 const accepted=canonicalLongwaveHeat(x);assert.deepEqual(accepted,expected);assert.deepEqual(compareLongwaveHeat(accepted),compareLongwaveHeat(expected));accepted.heatStudy.existing.source='changed';assert.notEqual(x.heatStudy.existing.source,'changed');
});
