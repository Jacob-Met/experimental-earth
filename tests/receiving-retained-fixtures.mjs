import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {runRain} from '../core.js';
import {hypothesisLayer} from '../draining-layer-evidence.js';
import {makePostDryReceivingAccountProposalExample} from '../receiving-account-proposals.js';

const bytes=readFileSync(new URL('../experiments/independent-retained-tuples.json',import.meta.url));
export const independentRetainedSource=JSON.parse(bytes);
export const independentRetainedSourceSha256=createHash('sha256').update(bytes).digest('hex');
const validation=JSON.parse(readFileSync(new URL('../experiments/independent-retained-validation.json',import.meta.url)));
assert.equal(independentRetainedSourceSha256,validation.sourceSha256);

// These tuples and the perturbation rule were fixed by a separate contributor
// before that contributor or this fixture ran the new inverse. The saved
// unchanged-forward oracle determines eligibility, never the inverse result.
export function independentRetainedCourse(tuple){
  const original=validation.results.find(row=>row.id===tuple.id);
  assert.ok(original);
  const {project,selection}=makePostDryReceivingAccountProposalExample();
  project.title='Independent authored retained-band course '+tuple.id;
  project.width=2;project.height=2;project.selectedIndex=0;
  project.proposal=Array.from({length:4},()=>({elevationM:0,surface:'garden',provenance:'Independent authored control; not field measurement'}));
  project.existing=structuredClone(project.proposal);
  project.weather={...project.weather,rainMmHr:tuple.rainMmHr,stormMinutes:tuple.stormMinutes,
    durationMinutes:Math.max(tuple.firstMinute,tuple.secondMinute)+60,stepMinutes:5,cellSizeM:1,mobilityPerHour:0,boundaryExitPerHour:0};
  const truth={capacityMm:tuple.capacityMm,initialStoredMm:tuple.capacityMm*tuple.initialStoredFraction,
    drainagePerHour:tuple.drainagePerHour,source:'Separately frozen independent tuple; never supplied to the inverse'};
  const result=runRain(project.proposal,2,2,project.weather,{drainingLayer:hypothesisLayer(selection,truth)});
  const depth=t=>result.snapshots.find(row=>row.minute===t).depthsMm[0];
  const receiver=t=>result.drainingLayer.snapshots.find(row=>row.minute===t);
  assert.equal(depth(tuple.stormMinutes),original.truth.stormDepthMm);
  assert.equal(depth(tuple.firstMinute),original.truth.firstDepthMm);
  assert.equal(depth(tuple.secondMinute),original.truth.secondDepthMm);
  assert.equal(receiver(tuple.firstMinute).retainedLiters,original.truth.firstRetainedLiters);
  assert.equal(receiver(tuple.secondMinute).retainedLiters,original.truth.secondRetainedLiters);
  const source='Independent authored original from the unchanged forward model; not field evidence';
  project.observations=[
    {cellIndex:0,minute:tuple.stormMinutes,depthMm:depth(tuple.stormMinutes),uncertaintyMm:1e-5,scenario:selection.target,use:'calibration',source},
    {cellIndex:0,minute:tuple.firstMinute,depthMm:depth(tuple.firstMinute),uncertaintyMm:1e-5,scenario:selection.target,use:'calibration',source},
    {cellIndex:0,minute:tuple.secondMinute,depthMm:depth(tuple.secondMinute),uncertaintyMm:1e-5,scenario:selection.target,use:'challenge',source:'Independent original surface value held aside before fitting'},
  ];
  const account={footprintBasis:'Authored original whole-receiver account across four garden cells / four square metres.',readings:[],offers:[]};
  for(const [minute,valueLiters]of [[tuple.firstMinute,original.recorded.firstRetainedLiters],[tuple.secondMinute,original.recorded.secondRetainedLiters]])
    account.readings.push({id:'retained-'+minute,channel:'retained',minute,valueLiters,uncertaintyLiters:original.recorded.uncertaintyLiters,use:'calibration',source:source+'; fixed increasing-center perturbation with original truth inside declared bands'});
  const heldMinute=Math.min(720,tuple.secondMinute+60);
  for(const [channel,field]of [['retained','retainedLiters'],['drained','drainedLiters']])account.readings.push({id:'held-'+channel,channel,minute:heldMinute,
    valueLiters:receiver(heldMinute)[field],uncertaintyLiters:.02,use:'challenge',source:'Independent original receiver value held out of every numerical start, fit, ranking and offer; fixed uncertainty before receiving tuples'});
  return {id:tuple.id,project,selection,account,truth,result,eligible:original.eligible,reasons:original.reasons};
}
export function independentRetainedCourses(){return independentRetainedSource.cases.map(independentRetainedCourse);}
