import {proposeReceivingAccountLayers,reserveReceivingAccountProposalWork} from './receiving-account-proposals.js';
import {fitReceivingAccountBands,reserveReceivingAccountBandWork,RECEIVING_ACCOUNT_BAND_SEEDS} from './receiving-account-band-fit.js';
import {fitReceivingAccountPhases,reserveReceivingAccountPhaseWork} from './receiving-account-phase-fit.js';
import {compareDrainingLayer,MAX_DRAINING_CELL_STEPS} from './draining-layer-study.js';
import {hypothesisLayer,drainingConsequences} from './draining-layer-evidence.js';
import {evaluateReadings} from './infiltration-study.js';
import {evaluateReceivingAccountRows,receivingAccountVerdict} from './receiving-account-evidence.js';

export const RECEIVING_ACCOUNT_CONSEQUENCE_SCHEMA='experimental-earth-receiving-account-consequences/1';
const FILE_LIMIT=2*1024*1024;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const clone=v=>structuredClone(v);
const sides=['existing','proposal'];
const surfaceMetrics=['absorbedLiters','storedLiters','exitLiters','maxDepthMm'];
const receiverMetrics=['initialLiters','retainedLiters','drainedLiters'];

/** The entire inverse and all possible six-run consumers are admitted together,
 * before either producer or the maintained paired comparison executes. */
export function reserveReceivingAccountConsequenceWork(project,selection,account,options){
  if(!exact(options,['mode','transferBasis'])||!['central','bands','phases'].includes(options.mode)||
      typeof options.transferBasis!=='string'||!options.transferBasis.trim()||options.transferBasis.length>600)
    throw Error('Choose analytic, original-band or phase-alternative inference and explain why the same receiver parameters and initial water apply to the selected material in both original layouts.');
  const central=reserveReceivingAccountProposalWork(project,selection,account);
  const inverse=options.mode==='phases'?reserveReceivingAccountPhaseWork(project,selection,account):options.mode==='bands'?reserveReceivingAccountBandWork(project,selection,account):central;
  const inverseCellEquivalentSteps=options.mode==='central'?central.reservedCellSteps:inverse.totalCellEquivalentSteps;
  const maximumCandidates=central.trialCount+(options.mode==='phases'?inverse.maximumCandidates:options.mode==='bands'?RECEIVING_ACCOUNT_BAND_SEEDS:0);
  const stepsPerCourse=Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
  const fullGridCellSteps=project.width*project.height*stepsPerCourse;
  const comparisonRuns=6*maximumCandidates;
  const comparisonCellSteps=comparisonRuns*fullGridCellSteps;
  const totalCellEquivalentSteps=inverseCellEquivalentSteps+comparisonCellSteps;
  if(totalCellEquivalentSteps>MAX_DRAINING_CELL_STEPS)
    throw Error('The complete inverse and every possible paired six-run comparison exceed one million cell-equivalent steps; no parameters or partial consequences were computed.');
  return {inverseCellEquivalentSteps,maximumCandidates,comparisonRuns,comparisonCellSteps,
    totalCellEquivalentSteps,fullGridCellSteps,limit:MAX_DRAINING_CELL_STEPS,inverse};
}

function summary(run){
  const layer=run.drainingLayer;
  return {...Object.fromEntries(surfaceMetrics.map(key=>[key,run[key]])),rainLiters:run.rainLiters,massErrorLiters:run.massErrorLiters,
    receiver:{affectedCellCount:layer.affectedCellCount,initialLiters:layer.initialLiters,retainedLiters:layer.retainedLiters,
      drainedLiters:layer.drainedLiters,infiltratedLiters:layer.infiltratedLiters,balanceErrorLiters:layer.balanceErrorLiters}};
}
function range(rows,value){
  if(!rows.length)return null;
  const values=rows.map(value),minimum=Math.min(...values),maximum=Math.max(...values);
  return {minimum,maximum,minimumIds:rows.filter((_,i)=>values[i]===minimum).map(r=>r.hypothesis.id),maximumIds:rows.filter((_,i)=>values[i]===maximum).map(r=>r.hypothesis.id)};
}
function effects(rows){
  return {...drainingConsequences(rows),receiverMetrics:Object.fromEntries(receiverMetrics.map(key=>[key,range(rows,row=>row.receiverChange[key])]))};
}

/** Every generated calibration-compatible receiver is carried into the same
 * unchanged paired consumer. Held values only annotate/challenge the frozen
 * family. Only the original selected evidence scenario supplies calibration;
 * neither paired consequence refits the parameters. */
export function compareReceivingAccountConsequences(project,selection,account,options){
  const reservation=reserveReceivingAccountConsequenceWork(project,selection,account,options);
  const inferred=options.mode==='phases'?fitReceivingAccountPhases(project,selection,account):options.mode==='bands'?fitReceivingAccountBands(project,selection,account):proposeReceivingAccountLayers(project,selection,account);
  const families=options.mode==='central'?[{id:'analytic',report:inferred}]:[{id:'analytic',report:inferred.baseline},{id:options.mode,report:inferred}];
  const collected=[],byParameters=new Map();
  for(const family of families)for(const candidate of family.report.candidates){
    if(candidate.calibration.compatible!==true)continue;
    const h=candidate.hypothesis,key=JSON.stringify([h.capacityMm,h.initialStoredMm,h.drainagePerHour]);
    const origin={family:family.id,hypothesisId:h.id,originalTrials:clone(candidate.originalTrials)};
    if(byParameters.has(key)){byParameters.get(key).origins.push(origin);continue;}
    const row={hypothesis:{...clone(h),id:'consequence-'+(collected.length+1)},origins:[origin]};
    collected.push(row);byParameters.set(key,row);
  }
  if(collected.length>reservation.maximumCandidates)throw Error('The generated family exceeded its complete preflight reservation; no partial comparison was accepted.');
  const original=project.observations.map((reading,index)=>({reading,index})).filter(r=>r.reading.scenario===selection.target);
  const rows=[];
  for(const candidate of collected){
    const comparison=compareDrainingLayer(project,hypothesisLayer(selection,candidate.hypothesis));
    const observed=comparison[selection.target].draining;
    const accountReadings=evaluateReceivingAccountRows(observed,account.readings);
    const surfaceCalibration=evaluateReadings(observed,original.filter(r=>r.reading.use==='calibration'));
    const calibration=receivingAccountVerdict(surfaceCalibration,accountReadings.filter(r=>r.use==='calibration'));
    if(calibration.compatible!==true)throw Error('The paired consumer contradicted an original calibration band for an inferred receiver; no consequence comparison was accepted.');
    const surfaceChallenge=evaluateReadings(observed,original.filter(r=>r.reading.use==='challenge'));
    const challenge=receivingAccountVerdict(surfaceChallenge,accountReadings.filter(r=>r.use==='challenge'));
    const row={...candidate,calibration,challenge,surfaceCalibration,surfaceChallenge,accountReadings,
      ...Object.fromEntries(sides.map(side=>[side,summary(comparison[side].draining)])),
      change:Object.fromEntries(surfaceMetrics.map(key=>[key,comparison.change[key].draining])),
      receiverChange:Object.fromEntries(receiverMetrics.map(key=>[key,comparison.proposal.draining.drainingLayer[key]-comparison.existing.draining.drainingLayer[key]])),
      counterparts:{unlimited:Object.fromEntries(surfaceMetrics.map(key=>[key,comparison.change[key].unlimited])),closed:Object.fromEntries(surfaceMetrics.map(key=>[key,comparison.change[key].closed]))}};
    rows.push(row);
  }
  const survivors=rows.filter(row=>row.challenge.compatible===true),hasChallenge=rows.some(row=>row.challenge.count>0);
  const status=!rows.length?'no-compatible-receivers':!hasChallenge?'needs-challenge':!survivors.length?'challenged':'compared';
  return {schema:RECEIVING_ACCOUNT_CONSEQUENCE_SCHEMA,project:clone(project),selection:clone(selection),account:clone(account),options:clone(options),
    status,reservation,inference:inferred,candidates:rows,compatibleIds:rows.map(row=>row.hypothesis.id),survivingIds:survivors.map(row=>row.hypothesis.id),
    effects:{calibration:effects(rows),surviving:effects(survivors)},counts:{comparedCandidates:rows.length,comparisonRuns:rows.length*6,comparisonCellSteps:rows.length*6*reservation.fullGridCellSteps},
    meaning:'Every distinct generated calibration-compatible receiver from the chosen inference mode is applied unchanged to both original layouts. Original-band mode retains the analytic family as well as the searched family; identical parameters retain all origins. Held-aside values neither select the comparison family nor fit parameters. Their separate survival range is a conditional evidence summary, not refitting. Values are proposal minus existing; receiver initial water can differ when the selected material area changes and is reported separately. Transfer of the same per-cell material, initial water and drainage is an explicit declaration. These finite generated-model ranges are not a continuous uncertainty enclosure, a probability distribution, field validation, automatic adoption or intervention approval.'};
}

export function serializeReceivingAccountConsequences(project,selection,account,options){
  reserveReceivingAccountConsequenceWork(project,selection,account,options);
  const text=JSON.stringify({schema:RECEIVING_ACCOUNT_CONSEQUENCE_SCHEMA,project,selection,account,options},null,2);
  if(new TextEncoder().encode(text).length>FILE_LIMIT)throw Error('Original receiving-consequence inputs exceed 2 MiB.');
  return text;
}
export function parseReceivingAccountConsequences(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>FILE_LIMIT)throw Error('Choose original receiving-consequence JSON under 2 MiB.');
  const input=JSON.parse(text);
  if(!exact(input,['schema','project','selection','account','options'])||input.schema!==RECEIVING_ACCOUNT_CONSEQUENCE_SCHEMA)
    throw Error('Retain only original receiving-consequence inputs; saved parameters, effects and verdicts are not accepted.');
  reserveReceivingAccountConsequenceWork(input.project,input.selection,input.account,input.options);
  return input;
}
