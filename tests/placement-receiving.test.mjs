import test from 'node:test';
import assert from 'node:assert/strict';
import {runRain} from '../core.js';
import {receivingFixture} from './fixtures/placement-receiving-source.mjs';
import {selectPondingExposure} from '../ponding-exposure-request.js';
import {compareDrainingHypotheses,hypothesisLayer} from '../draining-layer-evidence.js';
import {comparePlacements,comparePlacementsWithFixedSupport,adoptPlacement,estimatePlacementWork,validatePlacementQuery} from '../placement-search.js';
import {comparePlacementResolution} from '../placement-resolution.js';
import {comparePlacementTradeoffs} from '../placement-tradeoffs.js';
import {serializePlacementInvestigation,parsePlacementInvestigation} from '../placement-investigation.js';


const water=r=>r.exitLiters+r.storedLiters;

test('all original supported receiving explanations reach every layout through the default-rate solver',()=>{
 const {project:p,query:q}=receivingFixture(),before=structuredClone(p),evidence=compareDrainingHypotheses(p,q.receivingStudy);
 assert.deepEqual(evidence.compatibleIds,['h0','h1']);assert.deepEqual(evidence.survivingIds,['h1']);
 const report=comparePlacements(p,q),surviving=comparePlacements(p,{...q,subset:'surviving'}),all=comparePlacements(p,{...q,subset:'all'});
 assert.equal(report.variantCount,67);assert.equal(report.plans.length,67);assert.deepEqual(report.hypothesisIds,['h0','h1']);
 assert.deepEqual(report.best,[[35,36]]);assert.deepEqual(surviving.best,[[35,36]]);assert.ok(report.plans[0].score>surviving.plans[0].score+100);
 assert.equal(all.hypothesisIds.length,4);assert.equal(report.ratesMmHr,undefined);assert.deepEqual(report.originalEvidence,evidence);
 for(const plan of all.plans) {
  const cells=structuredClone(p.proposal);for(const i of plan.cells)cells[i].surface=q.surface;
  for(const candidate of plan.candidates) {
   const options={drainingLayer:hypothesisLayer(q.receivingStudy,candidate.hypothesis)};
   const current=runRain(p.proposal,p.width,p.height,p.weather,options),proposed=runRain(cells,p.width,p.height,p.weather,options);
   assert.equal(candidate.metrics.unabsorbedLiters.current,water(current));assert.equal(candidate.metrics.unabsorbedLiters.proposed,water(proposed));
   for(const key of ['exitLiters','storedLiters','peakPondingLiters','maxDepthMm'])assert.equal(candidate.metrics[key].delta,proposed[key]-current[key]);
   assert.deepEqual(candidate.peakDeltaMm,proposed.peakDepthMm.map((v,i)=>v-current.peakDepthMm[i]));
   assert.equal(candidate.drainingLayer.proposed.drainedLiters,proposed.drainingLayer.drainedLiters);
   assert.ok(Math.abs(candidate.massErrorLiters.proposal)<1e-7);assert.ok(Math.abs(candidate.drainingLayer.proposed.balanceErrorLiters)<1e-7);
  }
 }
 assert.deepEqual(p,before);
});

test('challenge changes cannot refit calibration or simulated layouts; missing and rejected support never falls back',()=>{
 const {project:p,query:q}=receivingFixture();q.eligibleCells=[35,36];
 const calibration=comparePlacements(p,q);p.observations[1].depthMm=999;
 const changed=comparePlacements(p,q);assert.deepEqual(changed.hypothesisIds,calibration.hypothesisIds);assert.deepEqual(changed.plans,calibration.plans);
 assert.equal(comparePlacements(p,{...q,subset:'surviving'}).status,'no-compatible-receivers');
 p.observations.pop();assert.equal(comparePlacements(p,{...q,subset:'surviving'}).status,'need-challenge');
 p.observations[0].depthMm=999;assert.equal(comparePlacements(p,q).status,'no-compatible-receivers');
 p.observations=[];assert.equal(comparePlacements(p,q).status,'need-calibration');assert.equal(comparePlacements(p,{...q,subset:'all'}).status,'compared');
 p.existing[27].surface='turf';assert.equal(comparePlacements(p,q).status,'surface-absent');
 const declared=comparePlacements(p,{...q,subset:'all'});assert.equal(declared.status,'compared');assert.equal(declared.originalEvidence.status,'surface-absent');
 assert.equal(declared.hypothesisIds.length,4);
});

test('finer intervals retain privately held original support and reject a forged or altered baseline',()=>{
 const {project:p,query:q}=receivingFixture();q.eligibleCells=[35,36];q.subset='surviving';
 const base=comparePlacements(p,q),nativeFiner=compareDrainingHypotheses({...p,weather:{...p.weather,stepMinutes:1.25}},q.receivingStudy);
 // A narrow original band deliberately distinguishes fresh refitting at a new
 // interval from retaining the same declared original evidence conditions.
 assert.notDeepEqual(nativeFiner.survivingIds,base.hypothesisIds);
 const fixed=comparePlacementsWithFixedSupport(p,q,base,1.25);assert.deepEqual(fixed.hypothesisIds,['h1']);assert.equal(fixed.supportMode,'fixed-original-support');
 base.originalEvidence.survivingIds.length=0;base.plans[0].candidates[0].hypothesis.capacityMm=999;
 assert.deepEqual(comparePlacementsWithFixedSupport(p,q,base,1.25),fixed);
 assert.throws(()=>comparePlacementsWithFixedSupport(p,q,structuredClone(base),1.25),/matching original/);
 base.hypothesisIds.push('h0');assert.throws(()=>comparePlacementsWithFixedSupport(p,q,base,1.25),/support was altered/);
 const fresh=comparePlacements(p,q);p.observations[0].uncertaintyMm=.5;
 assert.throws(()=>comparePlacementsWithFixedSupport(p,q,fresh,1.25),/matching original/);
});

test('receiving witnesses serve the maintained peak, duration, cost, interval and adoption paths',()=>{
 const {project:p,query:q}=receivingFixture();q.eligibleCells=[35,36];
 q.targets=[{cellIndex:10,maxPeakChangeMm:0,basis:'Authored no-deepening decision condition'}];
 q.durationGoal={cellIndices:[10],thresholdMm:5,maxAdditionalMinutes:0,basis:'Authored finite event condition'};
 const report=comparePlacements(p,q),resolution=comparePlacementResolution(p,q);assert.equal(resolution.status,'compared');
 assert.deepEqual(resolution.hypothesisIds,['h0','h1']);assert.ok(resolution.runs.every(r=>JSON.stringify(r.hypothesisIds)==='["h0","h1"]'));
 const plan=report.plans.find(row=>row.cells.length===2);
 for(const candidate of plan.candidates) {
  const cells=structuredClone(p.proposal);for(const i of plan.cells)cells[i].surface=q.surface;
  const run=runRain(cells,p.width,p.height,p.weather,{drainingLayer:hypothesisLayer(q.receivingStudy,candidate.hypothesis)});
  assert.deepEqual(candidate.exposure.proposed,selectPondingExposure(run,{cellIndices:[10],thresholdMm:5}));
 }
 assert.ok(plan.localTargets.checks[0].witnesses.every(w=>w.hypothesis.id&&!Object.hasOwn(w,'rateMmHr')));
 assert.ok(plan.durationTargets.checks[0].witnesses.every(w=>w.hypothesis.id&&!Object.hasOwn(w,'rateMmHr')));
 const costs={metrics:['unabsorbedLiters','maxDepthMm'],costUnit:'authored units',budget:2,cellCosts:q.eligibleCells.map(cellIndex=>({cellIndex,cost:1,source:'Authored equal costs'}))};
 const trade=comparePlacementTradeoffs(p,q,costs);assert.deepEqual(trade.plans,report.plans);assert.ok(trade.tradeoffs.frontier.length);
 const adopted=adoptPlacement(p,q,report.best[0],report.sourceSignature);assert.deepEqual(adopted.existing,p.existing);assert.deepEqual(adopted.observations,p.observations);assert.equal(adopted.receivingStudy,undefined);
 const bound=structuredClone(p);bound.observations[0].scenario='proposal';const boundReport=comparePlacements(bound,{...q,subset:'all'});
 assert.throws(()=>adoptPlacement(bound,{...q,subset:'all'},[35],boundReport.sourceSignature),/observed geometry/);
});

test('strict new input-only schema prevents model fallback and recomputes changed original evidence',()=>{
 const {project:p,query:q}=receivingFixture();q.eligibleCells=[35,36];
 const before=comparePlacements(p,q),text=serializePlacementInvestigation(p,q),value=JSON.parse(text);
 assert.equal(value.schema,'experimental-earth-placement-investigation/2');assert.ok(!text.includes('compatibleIds'));assert.ok(!text.includes('plans'));
 const replay=parsePlacementInvestigation(text);assert.deepEqual(comparePlacements(replay.project,replay.query),before);
 for(const schema of ['experimental-earth-placement-investigation/1','experimental-earth-placement-investigation/3'])assert.throws(()=>parsePlacementInvestigation(JSON.stringify({...value,schema})));
 assert.throws(()=>parsePlacementInvestigation(JSON.stringify({...value,best:[[35,36]]})),/conclusions/);
 value.project.observations[0].depthMm=999;const changed=parsePlacementInvestigation(JSON.stringify(value));assert.equal(comparePlacements(changed.project,changed.query).status,'no-compatible-receivers');
 delete value.query.receivingStudy;assert.throws(()=>parsePlacementInvestigation(JSON.stringify(value)),/version 2/);
});

test('joint model ambiguity, malformed receiving hypotheses and complete-work excess are refused before search',()=>{
 const {project:p,query:q}=receivingFixture();
 assert.throws(()=>comparePlacements(p,{...q,study:{target:'existing',surface:'sealed',ratesMmHr:[1,2]}}),/joint model/);
 assert.throws(()=>comparePlacements(p,{...q,drainingLayer:null}),/joint model/);
 for(const receivingStudy of [null,false,{}, {...q.receivingStudy,hypotheses:q.receivingStudy.hypotheses.slice(0,1)}])assert.throws(()=>comparePlacements(p,{...q,receivingStudy}));
 const work=estimatePlacementWork(p,validatePlacementQuery(p,q));assert.ok(work.estimatedCellSteps<=3000000);
 assert.throws(()=>comparePlacements(p,{...q,durationGoal:{cellIndices:[10],thresholdMm:5,maxAdditionalMinutes:0,basis:'Authored budget refusal'}}),/3 million/);
});
