import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample,runRain} from '../core.js';
import {createInterventionBatch,compareIntervention} from '../intervention-study.js';
import {comparePlacements,comparePlacementsWithFixedSupport,adoptPlacement} from '../placement-search.js';
import {comparePlacementResolution} from '../placement-resolution.js';
import {comparePlacementTradeoffs} from '../placement-tradeoffs.js';
import {serializePlacementInvestigation,parsePlacementInvestigation} from '../placement-investigation.js';

const layer=(extra={})=>({schema:'experimental-earth-draining-layer/1',surface:'garden',capacityMm:5,
  initialStoredMm:0,drainagePerHour:1,source:'Authored receiving-layer software control',...extra});
function fixture(){const p=makeExample();p.proposal=structuredClone(p.existing);return p;}
const query=(p,extra={})=>({eligibleCells:p.proposal.flatMap((c,i)=>c.surface==='sealed'?[i]:[]),maxEdits:2,
  surface:'garden',metric:'unabsorbedLiters',subset:'all',study:{target:'existing',surface:'sealed',ratesMmHr:[.2,1,4]},drainingLayer:layer(),...extra});
const water=r=>r.exitLiters+r.storedLiters;

test('complete actual-solver oracle exposes a changed best pair and harmful unlimited recommendation',()=>{
 const p=fixture(),q=query(p),before=structuredClone(p),unlimited=comparePlacements(p,{...q,drainingLayer:null});
 const actual=comparePlacements(p,q),closed=comparePlacements(p,{...q,drainingLayer:layer({drainagePerHour:0})});
 assert.deepEqual(unlimited.best,[[27,36]]);assert.deepEqual(actual.best,[[35,36]]);assert.deepEqual(closed.best,[[]]);
 assert.ok(closed.plans.find(r=>r.cells.join(',')==='27,36').score>87);
 assert.equal(actual.plans.length,79);assert.equal(actual.variantCount,79);
 for(const plan of actual.plans){
  const proposal=structuredClone(p.proposal);for(const i of plan.cells)proposal[i].surface='garden';
  for(const c of plan.candidates){
   const options={surfaceInfiltrationOverride:{surface:'sealed',rateMmHr:c.rateMmHr},drainingLayer:q.drainingLayer};
   const original=runRain(p.proposal,p.width,p.height,p.weather,options),edited=runRain(proposal,p.width,p.height,p.weather,options);
   assert.equal(c.metrics.unabsorbedLiters.current,water(original));assert.equal(c.metrics.unabsorbedLiters.proposed,water(edited));
   assert.equal(c.drainingLayer.proposed.retainedLiters,edited.drainingLayer.retainedLiters);
   assert.equal(c.drainingLayer.proposed.drainedLiters,edited.drainingLayer.drainedLiters);
   assert.ok(Math.abs(c.drainingLayer.proposed.balanceErrorLiters)<1e-8);assert.ok(Math.abs(c.massErrorLiters.proposal)<1e-8);
  }
 }
 assert.deepEqual(p,before);
});
test('the receiver participates in existing-site cache identity and returned summaries stay private',()=>{
 const p=fixture();p.existing[27].surface='garden';const compare=createInterventionBatch();
 const opts={study:query(p).study,subset:'all',allowAbsentSurface:true,drainingLayer:layer()};
 const first=compare(p,opts);first.candidates[0].drainingLayer.existing.drainedLiters=-999;
 assert.deepEqual(compare(p,opts),compareIntervention(p,opts));
 for(const change of [{capacityMm:20},{drainagePerHour:0},{initialStoredMm:3},{surface:'turf'}]){
  Object.assign(opts.drainingLayer,change);assert.deepEqual(compare(p,opts),compareIntervention(p,opts));
 }
 const inherited=Object.create({toJSON:()=>({})});Object.assign(inherited,layer());opts.drainingLayer=inherited;
 compare(p,opts);inherited.capacityMm=1;assert.deepEqual(compare(p,opts),compareIntervention(p,opts));
});
test('unlimited evidence cannot support the receiving model and invalid declarations never fall back',()=>{
 const p=fixture(),q=query(p);
 for(const subset of ['calibration','surviving']){
  assert.throws(()=>comparePlacements(p,{...q,subset}),/unlimited-receiver evidence/);
  assert.throws(()=>compareIntervention(p,{study:q.study,subset,drainingLayer:q.drainingLayer}),/unlimited-receiver evidence/);
 }
 for(const bad of [false,{},layer({capacityMm:NaN}),layer({initialStoredMm:6}),layer({source:''}),layer({unknown:true})])
  assert.throws(()=>comparePlacements(p,{...q,drainingLayer:bad}));
 assert.throws(()=>comparePlacements(p,{...q,study:{...q.study,ratesMmHr:[0,1,2,3,4,5,6,7,8]}}),/work/);
});
test('duration, local targets, cost and finer intervals carry exactly the same receiving declaration',()=>{
 const p=fixture(),q=query(p,{eligibleCells:[18,19,27,36],targets:[{cellIndex:10,maxPeakChangeMm:0,basis:'Authored peak target'}],
  durationGoal:{cellIndices:[10],thresholdMm:5,maxAdditionalMinutes:0,basis:'Authored within-window goal'}});
 const r=comparePlacementResolution(p,q);assert.equal(r.status,'compared');assert.deepEqual(r.query.drainingLayer,q.drainingLayer);
 for(const run of r.runs){
  const direct=comparePlacements({...p,weather:{...p.weather,stepMinutes:run.stepMinutes}},q);
  assert.deepEqual(run.plans,direct.plans);assert.deepEqual(run.best,direct.best);
 }
 const base=comparePlacements(p,q);
 assert.throws(()=>comparePlacementsWithFixedSupport(p,{...q,drainingLayer:layer({capacityMm:6})},base,2.5),/matching original/);
 const trade={metrics:['unabsorbedLiters','maxDepthMm'],costUnit:'authored work units',budget:2,
  cellCosts:q.eligibleCells.map(cellIndex=>({cellIndex,cost:1,source:'Authored equal costs'}))};
 const compared=comparePlacementTradeoffs(p,q,trade);assert.deepEqual(compared.plans,base.plans);
 const next=adoptPlacement(p,base.query,base.best[0],base.sourceSignature);assert.deepEqual(next.existing,p.existing);
 const changed=structuredClone(p);changed.weather.rainMmHr=50;
 assert.throws(()=>adoptPlacement(changed,base.query,[],base.sourceSignature),/changed/);
});
test('source-only investigation reopening recomputes the layer and every layout, never saved conclusions',()=>{
 const p=fixture(),q=query(p,{eligibleCells:[18,27,36]});
 const trade={metrics:['exitLiters'],costUnit:'authored units',budget:2,cellCosts:q.eligibleCells.map(cellIndex=>({cellIndex,cost:1,source:'Authored cost'}))};
 const before=comparePlacementTradeoffs(p,q,trade),text=serializePlacementInvestigation(p,q,trade);
 const input=parsePlacementInvestigation(text);assert.deepEqual(comparePlacementTradeoffs(input.project,input.query,input.tradeoffs),before);
 assert.ok(!text.includes('drainedLiters'));assert.ok(!text.includes('plans'));
 const forged=JSON.parse(text);forged.best=[[27,36]];assert.throws(()=>parsePlacementInvestigation(JSON.stringify(forged)),/conclusions/);
 delete forged.best;forged.query.plans=[];assert.throws(()=>parsePlacementInvestigation(JSON.stringify(forged)),/conclusions/);
 delete forged.query.plans;forged.query.drainingLayer.drainagePerHour=0;
 const altered=parsePlacementInvestigation(JSON.stringify(forged));assert.notDeepEqual(comparePlacements(altered.project,altered.query).plans,before.plans);
});
