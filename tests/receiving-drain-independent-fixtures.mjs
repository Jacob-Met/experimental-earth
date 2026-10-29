import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {runRain} from '../core.js';
import {hypothesisLayer} from '../draining-layer-evidence.js';
import {makePostDryReceivingAccountProposalExample} from '../receiving-account-proposals.js';

const tupleBytes=readFileSync(new URL('../experiments/drain-independent-tuples.json',import.meta.url));
export const drainIndependentTupleSha256=createHash('sha256').update(tupleBytes).digest('hex');
const source=JSON.parse(tupleBytes),validation=JSON.parse(readFileSync(new URL('../experiments/drain-independent-validation.json',import.meta.url)));
assert.equal(drainIndependentTupleSha256,validation.sourceSha256);
export function drainIndependentCourses(){return source.cases.map(tuple=>{
  const oracle=validation.results.find(row=>row.id===tuple.id);assert.ok(oracle);
  const {project,selection}=makePostDryReceivingAccountProposalExample();
  const count=tuple.columns*tuple.rows,area=count*tuple.cellSizeM**2;
  project.title='Independently authored phase-family source '+tuple.id;project.width=tuple.columns;project.height=tuple.rows;project.selectedIndex=0;
  project.proposal=Array.from({length:count},()=>({elevationM:0,surface:'garden',provenance:'Frozen independently authored phase-family control; not field evidence'}));project.existing=structuredClone(project.proposal);
  project.weather={...project.weather,rainMmHr:tuple.rainMmHr,stormMinutes:tuple.stormMinutes,durationMinutes:Math.min(720,Math.max(tuple.firstLateMinutes,tuple.secondLateMinutes)+60),stepMinutes:5,cellSizeM:tuple.cellSizeM,mobilityPerHour:0,boundaryExitPerHour:0};
  const truth={capacityMm:tuple.capacityMm,initialStoredMm:tuple.capacityMm*tuple.initialFraction,drainagePerHour:tuple.drainagePerHour,source:'Frozen independent parameter tuple; never supplied to either inverse'};
  const result=runRain(project.proposal,project.width,project.height,project.weather,{drainingLayer:hypothesisLayer(selection,truth)});
  const receiver=t=>result.drainingLayer.snapshots.find(row=>row.minute===t),depth=t=>result.snapshots.find(row=>row.minute===t).depthsMm[0];
  assert.equal(area,oracle.truth.area);assert.equal(depth(tuple.stormMinutes),oracle.truth.stormDepthMm);assert.equal(depth(tuple.firstLateMinutes),oracle.truth.firstDepthMm);assert.equal(depth(tuple.secondLateMinutes),oracle.truth.secondDepthMm);
  assert.equal(receiver(tuple.firstLateMinutes).retainedLiters/area,oracle.truth.firstMeanRetainedMm);assert.equal(receiver(tuple.secondLateMinutes).retainedLiters/area,oracle.truth.secondMeanRetainedMm);
  const origin='Independent authored original from unchanged maintained forward model; not measured field evidence';
  project.observations=[
    {cellIndex:0,minute:tuple.stormMinutes,depthMm:depth(tuple.stormMinutes),uncertaintyMm:1e-5,scenario:selection.target,use:'calibration',source:origin},
    {cellIndex:0,minute:tuple.firstLateMinutes,depthMm:depth(tuple.firstLateMinutes),uncertaintyMm:1e-5,scenario:selection.target,use:'calibration',source:origin},
    {cellIndex:0,minute:tuple.secondLateMinutes,depthMm:depth(tuple.secondLateMinutes),uncertaintyMm:1e-5,scenario:selection.target,use:'challenge',source:origin+'; original held role fixed before method execution'},
  ];
  const account={footprintBasis:'Independent original whole-receiver account over '+count+' garden cells / '+area+' square metres; frozen mean-mm bands are converted once to total litres.',readings:[],offers:[]};
  for(const [minute,mean]of [[tuple.firstLateMinutes,oracle.bands.firstMeanMm],[tuple.secondLateMinutes,oracle.bands.secondMeanMm]])account.readings.push({id:'original-retained-'+minute,channel:'retained',minute,valueLiters:mean*area,uncertaintyLiters:oracle.bands.errorMm*area,use:'calibration',source:origin+'; independent predeclared increasing-center bands use per-selected-area mean, converted to litres'});
  assert.equal(receiver(tuple.secondLateMinutes).drainedLiters,oracle.truth.secondDrainedLiters);
  account.readings.push({id:'new-original-drained-'+tuple.secondLateMinutes,channel:'drained',minute:tuple.secondLateMinutes,valueLiters:oracle.truth.secondDrainedLiters,uncertaintyLiters:.02,use:'calibration',source:origin+'; additional original cumulative drainage fixed by independent protocol'});
  const heldMinute=project.weather.durationMinutes;
  assert.equal(heldMinute,oracle.truth.futureMinute);assert.equal(receiver(heldMinute).retainedLiters,oracle.truth.futureRetainedLiters);assert.equal(receiver(heldMinute).drainedLiters,oracle.truth.futureDrainedLiters);
  for(const [channel,field]of [['retained','retainedLiters'],['drained','drainedLiters']])account.readings.push({id:'held-'+channel,channel,minute:heldMinute,valueLiters:receiver(heldMinute)[field],uncertaintyLiters:.02,use:'challenge',source:'Original receiver value held out of all numerical starts/fitting; time and ±0.02L fixed before tuple release'});
  const maximumDuringStorm=Math.max(...result.drainingLayer.snapshots.filter(row=>row.minute<=tuple.stormMinutes).map(row=>row.retainedLiters/area));
  const maximumDuringCourse=Math.max(...result.drainingLayer.snapshots.map(row=>row.retainedLiters/area));
  return {id:tuple.id,project,selection,account,truth,result,eligible:oracle.eligible,reasons:oracle.reasons,
    originalReportedPhase:oracle.phase,truthSnapshotPhase:maximumDuringStorm>=tuple.capacityMm-1e-7?'full-by-storm':maximumDuringCourse>=tuple.capacityMm-1e-7?'first-full-after-storm':'not-full-in-retained-snapshots',maximumDuringStormMm:maximumDuringStorm,maximumDuringCourseMm:maximumDuringCourse};
});}
