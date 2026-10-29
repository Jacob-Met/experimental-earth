import {runRain,SURFACES} from './core.js';
import {hypothesisLayer} from './draining-layer-evidence.js';
import {evaluateReadings} from './infiltration-study.js';
import {evaluateReceivingAccountRows,receivingAccountVerdict,chooseReceivingAccountQuestion} from './receiving-account-evidence.js';
import {inferPostDryRetainedReceivers,proposeUnfilledReceivingBandWitnesses,UNFILLED_RECEIVING_RATE_POINTS,UNFILLED_RECEIVING_MAXIMUM_PROPOSALS,UNFILLED_DRAIN_RATE_EVALUATIONS,UNFILLED_DRAIN_MAXIMUM_PROPOSALS,proposeFilledDrainBandWitnesses,reserveFilledDrainBandWork,unfilledReceivingSurfaceCourse,FILLED_DRAIN_MAXIMUM_PROPOSALS} from './post-dry-receiving-inverse.js';
import {fitReceivingAccountBands,reserveReceivingAccountBandWork,RECEIVING_ACCOUNT_BAND_SEEDS,RECEIVING_ACCOUNT_BAND_STEP_LIMIT} from './receiving-account-band-fit.js';
import {serializeReceivingAccountProposals,parseReceivingAccountProposals,makePostDryReceivingAccountProposalExample,RECEIVING_ACCOUNT_PROPOSAL_SCHEMA} from './receiving-account-proposals.js';

export const RECEIVING_ACCOUNT_PHASE_SCHEMA='experimental-earth-receiving-account-phase-search/1';
const filledTargets=[[0,0],[0,1],[1,0],[1,1],[.5,.5]];
export const RECEIVING_ACCOUNT_PHASE_MAXIMUM_PROPOSALS=filledTargets.length*6+UNFILLED_DRAIN_MAXIMUM_PROPOSALS+FILLED_DRAIN_MAXIMUM_PROPOSALS;
const clone=x=>structuredClone(x),exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
function sources(project,selection,account){
  const originals=project.observations.map((reading,index)=>({reading,index})).filter(row=>row.reading.scenario===selection.target);
  const calibration=originals.filter(row=>row.reading.use==='calibration');
  const storm=calibration.find(row=>row.reading.minute===project.weather.stormMinutes&&project[selection.target][row.reading.cellIndex].surface===selection.surface);
  const retained=account.readings.map((reading,index)=>({reading,index})).filter(row=>row.reading.use==='calibration'&&row.reading.channel==='retained'&&row.reading.minute>project.weather.stormMinutes).sort((a,b)=>a.reading.minute-b.reading.minute||a.index-b.index);
  const drained=account.readings.map((reading,index)=>({reading,index})).filter(row=>row.reading.use==='calibration'&&row.reading.channel==='drained');
  const hasPhaseSource=!!storm&&retained.length>=2&&retained[0].reading.minute<retained.at(-1).reading.minute;
  return {originals,calibration,storm,retained,drained,hasPhaseSource};
}


function phaseInput(project,selection,source){
  const w=project.weather;
  return {rainMmHr:w.rainMmHr,infiltrationMmHr:SURFACES[selection.surface].infiltrationMmHr,stormMinutes:w.stormMinutes,
    stormEndDepthMm:source.storm?.reading.depthMm,stormUncertaintyMm:source.storm?.reading.uncertaintyMm,
    areaM2:project[selection.target].filter(cell=>cell.surface===selection.surface).length*w.cellSizeM**2,
    readings:source.retained.map(row=>row.reading),drainedReadings:source.drained.map(row=>row.reading)};
}

/** Reserve the complete old method, every optional phase proposal, every final
 * original-grid check and all bounded arithmetic before any producer runs. */
export function reserveReceivingAccountPhaseWork(project,selection,account){
  const incumbent=reserveReceivingAccountBandWork(project,selection,account),source=sources(project,selection,account);
  const refineDrain=source.drained.some(row=>row.reading.minute>0),input=phaseInput(project,selection,source);
  const unfilledPossible=source.hasPhaseSource&&unfilledReceivingSurfaceCourse(input).possible;
  const filledDrain=reserveFilledDrainBandWork(input);
  const maximumPhaseProposals=source.hasPhaseSource?filledTargets.length*6+(unfilledPossible?(refineDrain?UNFILLED_DRAIN_MAXIMUM_PROPOSALS:UNFILLED_RECEIVING_MAXIMUM_PROPOSALS):0)+filledDrain.maximumProposals:0;
  const finalGridChecks=RECEIVING_ACCOUNT_BAND_SEEDS+maximumPhaseProposals;
  const finalGridCellSteps=finalGridChecks*incumbent.fullGridCellSteps;
  const phaseRootEvaluations=source.hasPhaseSource?filledTargets.length*2*(2+128+1):0;
  const phaseRateEvaluations=unfilledPossible?(refineDrain?UNFILLED_DRAIN_RATE_EVALUATIONS:UNFILLED_RECEIVING_RATE_POINTS):0;
  const phaseBandIntersections=phaseRateEvaluations*(source.retained.length+source.drained.length);
  const totalCellEquivalentSteps=incumbent.totalCellEquivalentSteps+finalGridCellSteps+phaseRootEvaluations+phaseBandIntersections+filledDrain.qEvaluations+filledDrain.bandIntersections+filledDrain.modelEvaluations;
  if(totalCellEquivalentSteps>RECEIVING_ACCOUNT_BAND_STEP_LIMIT)throw Error('The complete original-band incumbent, phase alternatives and final original-grid checks exceed one million cell-equivalent steps; no partial phase family was computed.');
  return {incumbent,maximumPhaseProposals,finalGridChecks,finalGridCellSteps,phaseRootEvaluations,phaseRateEvaluations,phaseBandIntersections,filledDrain,unfilledPossible,
    maximumCandidates:RECEIVING_ACCOUNT_BAND_SEEDS+maximumPhaseProposals,totalCellEquivalentSteps,fullGridCellSteps:incumbent.fullGridCellSteps,limit:RECEIVING_ACCOUNT_BAND_STEP_LIMIT};
}

export function fitReceivingAccountPhases(project,selection,account){
  const reservation=reserveReceivingAccountPhaseWork(project,selection,account),source=sources(project,selection,account),w=project.weather;
  const phases=[],refusals=[],counts={phaseInverseCalls:0,phaseBandIntersections:0,phaseRateEvaluations:0,phaseUniqueParameters:0,finalOriginalGridChecks:0,filledDrainQEvaluations:0,filledDrainModelEvaluations:0,filledDrainBandIntersections:0};
  const areaM2=project[selection.target].filter(cell=>cell.surface===selection.surface).length*w.cellSizeM**2;
  let unfilled=null,filledDrain=null;
  const keep=(h,origin)=>{
    const previous=phases.find(row=>row.hypothesis.capacityMm===h.capacityMm&&row.hypothesis.initialStoredMm===h.initialStoredMm&&row.hypothesis.drainagePerHour===h.drainagePerHour);
    if(previous){previous.phaseOrigins.push(origin);return;}
    if(phases.length>=reservation.maximumPhaseProposals)throw Error('The generated phase family exceeded its complete reservation.');
    const id='account-phase-'+(phases.length+1);
    phases.push({hypothesis:{id,label:origin.family==='unfilled'?'Never-filled receiver witness '+(phases.length+1):origin.family==='filled-drain'?'Filled receiver from original drainage '+(phases.length+1):'Filled receiver band-point witness '+(phases.length+1),
      capacityMm:h.capacityMm,initialStoredMm:h.initialStoredMm,drainagePerHour:h.drainagePerHour,
      source:origin.family==='unfilled'?'Explicit arbitrary never-filled capacity witness, not an estimate; generated from original calibration bands.':origin.family==='filled-drain'?'Conditional filled receiver generated from original retained and drainage calibration bands; no observations are replaced.':'Conditional filled receiver from computational points inside original calibration bands, not substituted observations.'},phaseOrigins:[origin]});
  };
  if(source.hasPhaseSource&&areaM2>0){
    const first=source.retained[0],last=source.retained.at(-1),storm=source.storm;
    const point=(row,f)=>{const lo=Math.max(0,row.valueLiters-row.uncertaintyLiters),hi=row.valueLiters+row.uncertaintyLiters;return f===0?lo:f===1?hi:lo+f*(hi-lo);};
    for(const [a,b]of filledTargets){
      counts.phaseInverseCalls++;
      const targetLiters=[point(first.reading,a),point(last.reading,b)];
      const inferred=inferPostDryRetainedReceivers({rainMmHr:w.rainMmHr,infiltrationMmHr:SURFACES[selection.surface].infiltrationMmHr,stormMinutes:w.stormMinutes,stormEndDepthMm:storm.reading.depthMm,areaM2,
        earlier:{...first.reading,valueLiters:targetLiters[0]},later:{...last.reading,valueLiters:targetLiters[1]}});
      const origin={family:'filled-target',surfaceRows:[storm.index],accountIndices:[first.index,last.index],bandCoordinates:[a,b],targetLiters,
        meaning:'Computational band points passed to the unchanged maintained inverse; original measurements are never replaced.'};
      for(const h of inferred.proposals??[])keep(h,{...origin,phase:h.phase,capacityBranch:h.capacityBranch});
      if(!(inferred.proposals?.length))refusals.push({...origin,reason:inferred.reason??inferred.status});
    }
    counts.phaseInverseCalls++;
    unfilled=proposeUnfilledReceivingBandWitnesses({rainMmHr:w.rainMmHr,infiltrationMmHr:SURFACES[selection.surface].infiltrationMmHr,stormMinutes:w.stormMinutes,stormEndDepthMm:storm.reading.depthMm,stormUncertaintyMm:storm.reading.uncertaintyMm,areaM2,readings:source.retained.map(row=>row.reading),drainedReadings:source.drained.map(row=>row.reading)});
    counts.phaseBandIntersections=unfilled.bandIntersections??0;
    counts.phaseRateEvaluations=unfilled.rateEvaluations??0;
    if(counts.phaseBandIntersections>reservation.phaseBandIntersections)throw Error('The complete phase band-intersection reservation was exceeded.');
    if(counts.phaseRateEvaluations>reservation.phaseRateEvaluations)throw Error('The complete phase rate-evaluation reservation was exceeded.');
    for(const h of unfilled.proposals)keep(h,{family:'unfilled',surfaceRows:[storm.index],accountIndices:[...source.retained,...source.drained].map(row=>row.index).sort((a,b)=>a-b),phase:h.phase,
      rateFraction:h.rateFraction,sampledRateFraction:h.sampledRateFraction,endpointInsetPerHour:h.endpointInsetPerHour,rateMethod:h.rateMethod??'fixed-rate-grid',initialFraction:h.initialFraction,capacityChoice:h.capacityChoice,initialIntervalMm:h.initialIntervalMm,maximumModeledStorageMm:h.maximumModeledStorageMm,meaning:h.meaning});
    if(!unfilled.proposals.length)refusals.push({family:'unfilled',reason:unfilled.reason??unfilled.status});
    if(reservation.filledDrain.maximumProposals){
      counts.phaseInverseCalls++;
      filledDrain=proposeFilledDrainBandWitnesses(phaseInput(project,selection,source));
      counts.filledDrainQEvaluations=filledDrain.counts?.qEvaluations??0;
      counts.filledDrainModelEvaluations=filledDrain.counts?.modelEvaluations??0;
      counts.filledDrainBandIntersections=filledDrain.counts?.bandIntersections??0;
      if(counts.filledDrainQEvaluations>reservation.filledDrain.qEvaluations||counts.filledDrainModelEvaluations>reservation.filledDrain.modelEvaluations||counts.filledDrainBandIntersections>reservation.filledDrain.bandIntersections)
        throw Error('The complete original-drainage filled-course reservation was exceeded.');
      for(const h of filledDrain.proposals)keep(h,{family:'filled-drain',surfaceRows:[storm.index],
        accountIndices:[...source.retained,...source.drained].map(row=>row.index).sort((a,b)=>a-b),
        phase:h.phase,fullStoreRateMmHr:h.fullStoreRateMmHr,fillMinute:h.fillMinute,dryMinute:h.dryMinute,
        rateInterval:h.rateInterval,rateFraction:h.rateFraction,endpointInsetPerHour:h.endpointInsetPerHour,qOrigin:h.qOrigin,
        meaning:'Original retained and cumulative-drainage bands constrain the same conditional filled course. Bounded computational parameters are not additional observations, an exhaustive enclosure or identified physical properties.'});
      if(!filledDrain.proposals.length)refusals.push({family:'filled-drain',reason:filledDrain.reason??filledDrain.status});
    }

  }
  counts.phaseUniqueParameters=phases.length;
  // This unchanged incumbent keeps its own analytic family and every local
  // search. It cannot influence the already frozen extra phase parameters.
  const incumbent=fitReceivingAccountBands(project,selection,account);
  const frozen=[...incumbent.candidates.map(row=>({hypothesis:clone(row.hypothesis),search:clone(row.search),originalTrials:clone(row.originalTrials)})),
    ...phases.map(row=>({...row,originalTrials:row.phaseOrigins.map(origin=>({branch:'finite-'+origin.family,surfaceRows:origin.surfaceRows,accountIndices:origin.accountIndices,accountId:origin.accountIndices.map(i=>account.readings[i].id).join(' / ')}))}))];
  const courses=[];
  for(const candidate of frozen){
    if(++counts.finalOriginalGridChecks>reservation.finalGridChecks)throw Error('The final phase-family original-grid reservation was exceeded.');
    const result=runRain(project[selection.target],project.width,project.height,w,{drainingLayer:hypothesisLayer(selection,candidate.hypothesis)});
    const surfaceCalibration=evaluateReadings(result,source.calibration),surfaceChallenge=evaluateReadings(result,source.originals.filter(row=>row.reading.use==='challenge'));
    const accountReadings=evaluateReceivingAccountRows(result,account.readings),row={...candidate,surfaceCalibration,surfaceChallenge,accountReadings,
      calibration:receivingAccountVerdict(surfaceCalibration,accountReadings.filter(row=>row.use==='calibration')),
      challenge:receivingAccountVerdict(surfaceChallenge,accountReadings.filter(row=>row.use==='challenge'))};
    courses.push({row,offers:evaluateReceivingAccountRows(result,account.offers)});
  }
  const candidates=courses.map(c=>c.row),compatibleIds=candidates.filter(row=>row.calibration.compatible===true).map(row=>row.hypothesis.id),survivingIds=candidates.filter(row=>row.calibration.compatible===true&&row.challenge.compatible===true).map(row=>row.hypothesis.id);
  const hasChallenge=source.originals.some(row=>row.reading.use==='challenge')||account.readings.some(row=>row.use==='challenge');
  const emptyStatus=['surface-absent','need-calibration-account'].includes(incumbent.status)?incumbent.status:'no-search-starts';
  const status=!candidates.length?emptyStatus:!compatibleIds.length?'no-band-witness':!hasChallenge?'needs-challenge':!survivingIds.length?'challenged':survivingIds.length===1?'one-surviving-proposal':'several-surviving-proposals';
  return {schema:RECEIVING_ACCOUNT_PHASE_SCHEMA,project:clone(project),selection:clone(selection),account:clone(account),status,reservation,counts:{...counts,incumbent:clone(incumbent.counts)},
    baseline:incumbent.baseline,bandIncumbent:incumbent,searches:incumbent.searches,refusals:[...incumbent.refusals,...refusals],unfilled,filledDrain,candidates,compatibleIds,survivingIds,question:chooseReceivingAccountQuestion(account,courses),
    meaning:'The unchanged original-band incumbent plus finite filled and never-filled alternatives. Every final model is checked on the complete original map, including all original calibration and held bands. Never-filled capacities are explicit arbitrary witnesses, not capacity estimates. Computational targets are never added as measurements. Held values do not fit or select parameters or offered questions. These generated alternatives are not a complete parameter enclosure, physical identification or automatic adoption.'};
}

export function serializeReceivingAccountPhases(project,selection,account){
  reserveReceivingAccountPhaseWork(project,selection,account);
  const raw=JSON.parse(serializeReceivingAccountProposals(project,selection,account)),text=JSON.stringify({...raw,schema:RECEIVING_ACCOUNT_PHASE_SCHEMA},null,2);
  if(new TextEncoder().encode(text).length>2*1024*1024)throw Error('Original phase-family sources exceed2MiB.');return text;
}
export function parseReceivingAccountPhases(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>2*1024*1024)throw Error('Choose original phase-family JSON under2MiB.');
  const raw=JSON.parse(text);
  if(!exact(raw,['schema','project','selection','account'])||raw.schema!==RECEIVING_ACCOUNT_PHASE_SCHEMA)throw Error('Only original phase-family sources are accepted; saved conclusions or proposed parameters are not evidence.');
  const input=parseReceivingAccountProposals(JSON.stringify({...raw,schema:RECEIVING_ACCOUNT_PROPOSAL_SCHEMA}));reserveReceivingAccountPhaseWork(input.project,input.selection,input.account);return {...input,schema:RECEIVING_ACCOUNT_PHASE_SCHEMA};
}

export function makeUnfilledReceivingPhaseExample(){
  const {project,selection}=makePostDryReceivingAccountProposalExample();
  project.title='Authored receiver that never fills: capacity remains undetermined';
  project.weather={...project.weather,rainMmHr:48,stormMinutes:60,durationMinutes:720,stepMinutes:5};
  const hypothesis={capacityMm:50,initialStoredMm:12.5,drainagePerHour:.25,source:'Authored known model used only to create original demonstration inputs; not a measured material'};
  const result=runRain(project[selection.target],project.width,project.height,project.weather,{drainingLayer:hypothesisLayer(selection,hypothesis)});
  const receiver=minute=>result.drainingLayer.snapshots.find(row=>row.minute===minute);
  project.observations=[60,300,540].map((minute,i)=>({cellIndex:0,minute,depthMm:result.snapshots.find(row=>row.minute===minute).depthsMm[0],uncertaintyMm:1e-5,scenario:selection.target,use:i===2?'challenge':'calibration',source:'Authored original surface course from unchanged maintained model; not field measurement'}));
  const first=receiver(300).retainedLiters,last=receiver(540).retainedLiters,middle=(first+last)/2,uncertainty=Math.abs(first-last)/2+.011;
  const account={footprintBasis:'Authored original whole-receiver account over four garden cells / four square metres. Capacity was not directly measured.',readings:[300,540].map((minute,i)=>({id:'retained-'+minute,channel:'retained',minute,valueLiters:middle+(i?.01:-.01),uncertaintyLiters:uncertainty,use:'calibration',source:'Authored increasing recorded center within a declared band containing the original model value; no measurement was corrected.'})),
    offers:['retained','drained'].map(channel=>({id:channel+'-660',channel,minute:660,uncertaintyLiters:.02,basis:'Authored hypothetical availability of a later whole-receiver reading; no observation is asserted.'}))};
  for(const [channel,field]of [['retained','retainedLiters'],['drained','drainedLiters']])account.readings.push({id:'held-'+channel,channel,minute:600,valueLiters:receiver(600)[field],uncertaintyLiters:.02,use:'challenge',source:'Authored original receiver reading held out of every starting point, parameter fit and prospective question.'});
  return {project,selection,account};
}
