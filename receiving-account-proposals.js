import {inferPostDryRetainedReceivers,inferPostDryDrainedReceivers} from './post-dry-receiving-inverse.js';
import {validateProject,runRain,SURFACES} from './core.js';
import {hypothesisLayer} from './draining-layer-evidence.js';
import {evaluateReadings} from './infiltration-study.js';
import {validateReceivingAccountOriginals,evaluateReceivingAccountRows,receivingAccountVerdict,makeReceivingAccountExample,chooseReceivingAccountQuestion} from './receiving-account-evidence.js';
import {inferReceivingAccountCentral,proposeInitiallyFullReceivingAccount} from './receiving-account-inverse.js';

export const RECEIVING_ACCOUNT_PROPOSAL_SCHEMA='experimental-earth-receiving-account-proposals/1';
export const RECEIVING_ACCOUNT_PROPOSAL_TRIAL_LIMIT=128;
export const RECEIVING_ACCOUNT_PROPOSAL_CELL_STEP_LIMIT=1000000;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const copy=v=>structuredClone(v);

function admit(project,selection,account){
  validateProject(project);validateReceivingAccountOriginals(project,account);
  if(!exact(selection,['target','surface','uniformReceiverBasis'])||!['existing','proposal'].includes(selection.target)||!Object.hasOwn(SURFACES,selection.surface)||typeof selection.uniformReceiverBasis!=='string'||!selection.uniformReceiverBasis.trim()||selection.uniformReceiverBasis.length>300)
    throw Error('Declare an original scenario, known surface and a basis for one uniform receiving layer across the whole selected footprint.');
  const w=project.weather;
  if(w.mobilityPerHour!==0||w.boundaryExitPerHour!==0)throw Error('This receiving-account inverse requires zero lateral mobility and zero surface boundary outflow in the original source.');
  if(!(w.rainMmHr>0&&w.stormMinutes>0&&w.durationMinutes>w.stormMinutes))throw Error('The original event needs positive constant rain followed by a dry period.');
  // Match the maintained solver's retained endpoint arithmetic, including its
  // final partial step. No inventory or drainage interpolation is introduced.
  const endpoints=new Set([0]);
  for(let start=0;start<w.durationMinutes-1e-10;start+=w.stepMinutes){
    const dt=Math.min(w.stepMinutes,w.durationMinutes-start);
    endpoints.add(Math.min(w.durationMinutes,start+dt));
  }
  for(const r of [...account.readings,...account.offers])if(!endpoints.has(r.minute))
    throw Error('Every original receiving reading and offer must use an exact retained solver endpoint.');
  return endpoints;
}

/** One source admission and complete central-family reservation, without any
 * inverse or forward evaluation. Shared with the optional original-band fit. */
function prepareReceivingAccountProposalPlan(project,selection,account){
  const endpoints=admit(project,selection,account),{target,surface}=selection,w=project.weather;
  const cellIndices=project[target].flatMap((cell,i)=>cell.surface===surface?[i]:[]);
  const areaM2=cellIndices.length*w.cellSizeM**2;
  const original={project:copy(project),selection:copy(selection),account:copy(account)};
  const footprint={target,surface,cellIndices,areaM2,basis:account.footprintBasis,uniformReceiverBasis:selection.uniformReceiverBasis};
  const sourceRows=project.observations.map((reading,index)=>({reading,index})).filter(r=>r.reading.scenario===target);
  const calibration=sourceRows.filter(r=>r.reading.use==='calibration'),challenge=sourceRows.filter(r=>r.reading.use==='challenge');
  const accountCalibration=account.readings.map((reading,index)=>({reading,index})).filter(r=>r.reading.use==='calibration');
  const starts=calibration.filter(({reading:r})=>r.minute===w.stormMinutes&&endpoints.has(r.minute)&&project[target][r.cellIndex].surface===surface);
  const pairs=[];
  for(const start of starts)for(const later of calibration)
    if(later.reading.cellIndex===start.reading.cellIndex&&later.reading.minute>w.stormMinutes&&endpoints.has(later.reading.minute))pairs.push({start,later});
  const retained=accountCalibration.filter(r=>r.reading.channel==='retained'&&r.reading.minute>w.stormMinutes),retainedPairs=[];
  for(let a=0;a<retained.length;a++)for(let b=a+1;b<retained.length;b++){
    const first=retained[a],second=retained[b];
    if(first.reading.minute===second.reading.minute)continue;
    retainedPairs.push(first.reading.minute<second.reading.minute?{earlier:first,later:second}:{earlier:second,later:first});
  }
  const drained=accountCalibration.filter(r=>r.reading.channel==='drained'&&r.reading.minute>w.stormMinutes).sort((a,b)=>a.reading.minute-b.reading.minute||a.index-b.index);
  // Count distinct-time triples before building any of them. Repeated-time
  // originals stay distinct evidence rows but never form a three-time course.
  let priorRows=0,priorPairs=0,drainedTripletCount=0;
  for(let i=0;i<drained.length;){
    let j=i+1;while(j<drained.length&&drained[j].reading.minute===drained[i].reading.minute)j++;
    const count=j-i;drainedTripletCount+=priorPairs*count;priorPairs+=priorRows*count;priorRows+=count;i=j;
  }
  const wetSourceCombinationCount=pairs.length*accountCalibration.length,postDrySourceCombinationCount=starts.length*(retainedPairs.length+drainedTripletCount);
  const wetTrialCount=pairs.length*accountCalibration.reduce((n,r)=>n+(r.reading.channel==='retained'?2:1),0);
  // Two monotone capacity branches, each with an interior and separately
  // enumerated initially-full and initially-empty trials. Reserve wet,
  // retained-pair and drainage-triple work before any model calculation.
  const postDryRetainedTrialCount=6*starts.length*retainedPairs.length,postDryDrainedTrialCount=6*starts.length*drainedTripletCount;
  const postDryTrialCount=postDryRetainedTrialCount+postDryDrainedTrialCount,trialCount=wetTrialCount+postDryTrialCount;
  const cellSteps=trialCount*project.width*project.height*Math.ceil(w.durationMinutes/w.stepMinutes);
  if(trialCount>RECEIVING_ACCOUNT_PROPOSAL_TRIAL_LIMIT||cellSteps>RECEIVING_ACCOUNT_PROPOSAL_CELL_STEP_LIMIT)
    throw Error('The complete original wet and post-dry calibration family exceeds 128 model trials or one million cell-steps; no partial proposals were computed.');
  const context={...original,footprint,pairCount:pairs.length,retainedPairCount:retainedPairs.length,drainedTripletCount,sourceCombinationCount:wetSourceCombinationCount+postDrySourceCombinationCount,
    wetTrialCount,postDryRetainedTrialCount,postDryDrainedTrialCount,postDryTrialCount,trialCount,reservedCellSteps:cellSteps,candidates:[],refusedTrials:[],nonIdentifyingTrials:[],compatibleIds:[],survivingIds:[],question:{status:'no-supported-pair',offers:[],best:null,supportIds:[]}};
  return {context,cellIndices,starts,accountCalibration,pairs,retainedPairs,drained,drainedTripletCount,calibration,challenge,target,surface,w,areaM2};
}

export function reserveReceivingAccountProposalWork(project,selection,account){
  const {context}=prepareReceivingAccountProposalPlan(project,selection,account);
  return {trialCount:context.trialCount,reservedCellSteps:context.reservedCellSteps};
}

/** Generate a bounded finite family from original calibration centers.
 * No initial water is supplied or selected from held-aside values. These are
 * conditional proposals, not parameter intervals or complete identification.
 */
export function proposeReceivingAccountLayers(project,selection,account){
  const {context,cellIndices,starts,accountCalibration,pairs,retainedPairs,drained,drainedTripletCount,calibration,challenge,target,surface,w,areaM2}=prepareReceivingAccountProposalPlan(project,selection,account);
  if(!cellIndices.length)return {...context,status:'surface-absent'};
  if(!starts.length)return {...context,status:'need-storm-end-calibration'};
  if(!accountCalibration.length)return {...context,status:'need-calibration-account'};
  if(!pairs.length&&!retainedPairs.length&&!drainedTripletCount)return {...context,status:'need-calibration-pair'};
  const candidates=[],courses=[],refusedTrials=[],nonIdentifyingTrials=[];
  function keepRefusal(provenance,inferred){
    const row={...provenance,reason:inferred.reason};
    if(Object.hasOwn(inferred,'numericalGuardMm'))row.numericalGuardMm=inferred.numericalGuardMm;
    (inferred.status==='non-identifying'?nonIdentifyingTrials:refusedTrials).push(row);
  }
  function checkProposal(inferred,provenance){
    if(inferred.status&&inferred.status!=='proposal'){keepRefusal(provenance,inferred);return;}
    const duplicate=candidates.find(c=>c.hypothesis.capacityMm===inferred.capacityMm&&c.hypothesis.initialStoredMm===inferred.initialStoredMm&&c.hypothesis.drainagePerHour===inferred.drainagePerHour);
    if(duplicate){duplicate.originalTrials.push(provenance);return;}
    const indices=provenance.accountIndices??[provenance.accountIndex];
    const hypothesis={id:'account-inferred-'+(candidates.length+1),label:'Proposal from surface rows '+provenance.surfaceRows.map(i=>i+1).join(' / ')+' and receiver rows '+indices.map(i=>i+1).join(' / '),
      capacityMm:inferred.capacityMm,initialStoredMm:inferred.initialStoredMm,drainagePerHour:inferred.drainagePerHour,
      source:'Calibration-center proposal from original surface rows '+provenance.surfaceRows.map(i=>i+1).join(', ')+' and receiver rows '+indices.map(i=>i+1).join(', ')+'. Uniform isolated footprint: '+selection.uniformReceiverBasis.trim()};
    const result=runRain(project[target],project.width,project.height,w,{drainingLayer:hypothesisLayer({surface},hypothesis)});
    const surfaceCalibration=evaluateReadings(result,calibration),surfaceChallenge=evaluateReadings(result,challenge);
    const accountReadings=evaluateReceivingAccountRows(result,account.readings);
    const row={hypothesis,originalTrials:[provenance],fillMinute:inferred.fillMinute,fullStoreRateMmHr:inferred.fullStoreRateMmHr,preFillIntakeMmHr:Math.min(w.rainMmHr,SURFACES[surface].infiltrationMmHr),phase:inferred.phase,inverseIterations:inferred.iterations??inferred.rootIterations,
      ...(Object.hasOwn(inferred,'dryMinute')?{dryMinute:inferred.dryMinute,capacityBranch:inferred.capacityBranch}:{}),
      surfaceCalibration,surfaceChallenge,accountReadings,
      calibration:receivingAccountVerdict(surfaceCalibration,accountReadings.filter(r=>r.use==='calibration')),
      challenge:receivingAccountVerdict(surfaceChallenge,accountReadings.filter(r=>r.use==='challenge'))};
    candidates.push(row);courses.push({row,offers:evaluateReceivingAccountRows(result,account.offers)});
  }
  for(const {start,later} of pairs)for(const {reading,index} of accountCalibration){
    const origin={surfaceRows:[start.index,later.index],accountIndex:index,accountId:reading.id,channel:reading.channel};
    const input={rainMmHr:w.rainMmHr,infiltrationMmHr:SURFACES[surface].infiltrationMmHr,stormMinutes:w.stormMinutes,laterMinute:later.reading.minute,stormEndDepthMm:start.reading.depthMm,laterDepthMm:later.reading.depthMm,
      account:{areaM2,channel:reading.channel,minute:reading.minute,valueLiters:reading.valueLiters,use:reading.use}};
    checkProposal(inferReceivingAccountCentral(input),{...origin,branch:'wet-full-central'});
    if(reading.channel==='retained')checkProposal(proposeInitiallyFullReceivingAccount(input),{...origin,branch:'initially-full-boundary'});
  }
  for(const start of starts)for(const {earlier,later} of retainedPairs){
    const origin={surfaceRows:[start.index],accountIndices:[earlier.index,later.index],accountIds:[earlier.reading.id,later.reading.id],accountId:earlier.reading.id+' / '+later.reading.id,channel:'retained'};
    const inferred=inferPostDryRetainedReceivers({rainMmHr:w.rainMmHr,infiltrationMmHr:SURFACES[surface].infiltrationMmHr,stormMinutes:w.stormMinutes,stormEndDepthMm:start.reading.depthMm,areaM2,earlier:earlier.reading,later:later.reading});
    if(inferred.status==='refused'){keepRefusal({...origin,branch:'post-dry-retained-pair'},inferred);continue;}
    for(const item of inferred.refusedBranches)keepRefusal({...origin,branch:item.branch},{reason:item.reason});
    for(const item of inferred.refusedModels)keepRefusal({...origin,branch:item.capacityBranch},{reason:item.reason});
    for(const item of inferred.proposals)checkProposal(item,{...origin,branch:item.phase,capacityBranch:item.capacityBranch});
  }
  for(const start of starts)for(let a=0;a<drained.length;a++)for(let b=a+1;b<drained.length;b++)for(let c=b+1;c<drained.length;c++){
    const earlier=drained[a],middle=drained[b],later=drained[c];
    if(!(earlier.reading.minute<middle.reading.minute&&middle.reading.minute<later.reading.minute))continue;
    const origin={surfaceRows:[start.index],accountIndices:[earlier.index,middle.index,later.index],accountIds:[earlier.reading.id,middle.reading.id,later.reading.id],accountId:[earlier,middle,later].map(r=>r.reading.id).join(' / '),channel:'drained',inverseSource:'post-dry-drained-triplet'};
    const inferred=inferPostDryDrainedReceivers({rainMmHr:w.rainMmHr,infiltrationMmHr:SURFACES[surface].infiltrationMmHr,stormMinutes:w.stormMinutes,stormEndDepthMm:start.reading.depthMm,areaM2,earlier:earlier.reading,middle:middle.reading,later:later.reading});
    if(inferred.status==='refused'||inferred.status==='non-identifying'){keepRefusal({...origin,branch:'post-dry-drained-triplet'},inferred);continue;}
    const evidence={...origin,drainageRateIterations:inferred.drainageRateIterations,derivedCourse:inferred.derivedCourse};
    for(const item of inferred.refusedBranches??[])keepRefusal({...evidence,branch:item.branch},{reason:item.reason});
    for(const item of inferred.refusedModels??[])keepRefusal({...evidence,branch:item.capacityBranch},{reason:item.reason});
    for(const item of inferred.proposals??[])checkProposal(item,{...evidence,branch:item.phase,capacityBranch:item.capacityBranch});
  }
  const compatibleIds=candidates.filter(c=>c.calibration.compatible===true).map(c=>c.hypothesis.id);
  const survivingIds=candidates.filter(c=>c.calibration.compatible===true&&c.challenge.compatible===true).map(c=>c.hypothesis.id);
  const hasChallenge=challenge.length+account.readings.filter(r=>r.use==='challenge').length>0;
  const status=!candidates.length?(nonIdentifyingTrials.length?'non-identifying-trials':'unsupported-trials'):!compatibleIds.length?'no-compatible-proposal':!hasChallenge?'needs-challenge':!survivingIds.length?'challenged':survivingIds.length===1?'one-surviving-proposal':'several-surviving-proposals';
  return {...context,status,candidates,refusedTrials,nonIdentifyingTrials,compatibleIds,survivingIds,question:chooseReceivingAccountQuestion(account,courses),
    meaning:'Finite central-value and separately enumerated initially-full and initially-empty boundary proposals, conditional on a uniform isolated receiving footprint. Wet surface pairs with a receiver account, post-dry retained pairs and post-dry cumulative drainage triples with an original storm-end depth are examined. Drainage triples may have unequal time spacing; their derived retained course is never inserted into original observations. The post-dry inverse keeps both monotone capacity branches. Only original calibration values generate parameters; every original surface and receiving calibration band must then pass the maintained forward model. Held-aside values only challenge and never select a prospective measurement. No negative fill time or storage is clipped. No fallback, parameter uncertainty enclosure, complete continuous search, unique physical identification or automatic adoption is claimed.'};
}

export function serializeReceivingAccountProposals(project,selection,account){
  admit(project,selection,account);
  const text=JSON.stringify({schema:RECEIVING_ACCOUNT_PROPOSAL_SCHEMA,project,selection,account},null,2);
  if(new TextEncoder().encode(text).length>2*1024*1024)throw Error('Original receiving-account proposal inputs exceed 2 MiB.');
  return text;
}
export function parseReceivingAccountProposals(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>2*1024*1024)throw Error('Choose original receiving-account proposal JSON under 2 MiB.');
  const input=JSON.parse(text);
  if(!exact(input,['schema','project','selection','account'])||input.schema!==RECEIVING_ACCOUNT_PROPOSAL_SCHEMA)throw Error('Retain only original receiving-account proposal inputs; saved conclusions are not accepted.');
  admit(input.project,input.selection,input.account);return input;
}

export function makeReceivingAccountProposalExample(){
  const {project,study,account}=makeReceivingAccountExample();
  project.title='Authored receiver proposal from original surface and retained water';
  const truth=runRain(project[study.target],project.width,project.height,project.weather,{drainingLayer:hypothesisLayer(study,study.hypotheses[0])});
  const snapshot=minute=>truth.drainingLayer.snapshots.find(row=>row.minute===minute);
  const selection={target:study.target,surface:study.surface,uniformReceiverBasis:'Authored uniform isolated receiver across all four garden cells; synthetic control, not field evidence'};
  account.readings=[
    {id:'retained-120',channel:'retained',minute:120,valueLiters:snapshot(120).retainedLiters,uncertaintyLiters:.1,use:'calibration',source:'Authored maintained-forward whole-footprint retained amount; not a physical measurement'},
    {id:'drained-240',channel:'drained',minute:240,valueLiters:snapshot(240).drainedLiters,uncertaintyLiters:.1,use:'challenge',source:'Authored original drainage held aside from parameter generation; not a physical measurement'}
  ];
  return {project,selection,account};
}

export function makePostDryReceivingAccountProposalExample(){
  const {project,study}=makeReceivingAccountExample();
  project.title='Authored late-water ambiguity: two receivers share the same retained course';
  project.weather={...project.weather,rainMmHr:30,durationMinutes:720,stepMinutes:5};
  const truth={capacityMm:12,initialStoredMm:3.390981833321632,drainagePerHour:.63,source:'Authored post-dry ambiguity control; not a measured material model'};
  const run=runRain(project[study.target],project.width,project.height,project.weather,{drainingLayer:hypothesisLayer(study,truth)});
  project.observations=[60,240,300].map((minute,index)=>({cellIndex:0,minute,depthMm:run.snapshots.find(row=>row.minute===minute).depthsMm[0],uncertaintyMm:.00001,scenario:study.target,use:index===2?'challenge':'calibration',source:'Authored maintained-forward original surface control; not a field observation'}));
  const selection={target:study.target,surface:study.surface,uniformReceiverBasis:'Authored uniform isolated receiver across all four garden cells; synthetic late-water control'};
  const account={footprintBasis:'Authored whole-receiver account across four garden cells (4 square metres), not a point probe or surface outlet.',
    readings:[240,300].map(minute=>({id:'retained-'+minute,channel:'retained',minute,valueLiters:run.drainingLayer.snapshots.find(row=>row.minute===minute).retainedLiters,uncertaintyLiters:.001,use:'calibration',source:'Authored original late retained-water calibration; not a physical measurement'})),
    offers:['retained','drained'].map(channel=>({id:channel+'-360',channel,minute:360,uncertaintyLiters:.1,basis:'Hypothetical available whole-receiver measurement at original minute 360; no actual acquisition is asserted'}))};
  return {project,selection,account};
}

export function makePostDryDrainageAccountProposalExample(){
  const {project,selection,account}=makePostDryReceivingAccountProposalExample();
  project.title='Authored receiver inference from three late cumulative drainage readings';
  const truth={capacityMm:12,initialStoredMm:3.390981833321632,drainagePerHour:.63,source:'Authored drainage-course control; not a measured material'};
  const run=runRain(project[selection.target],project.width,project.height,project.weather,{drainingLayer:hypothesisLayer(selection,truth)});
  account.readings=[240,300,420].map(minute=>({id:'drained-'+minute,channel:'drained',minute,valueLiters:run.drainingLayer.snapshots.find(row=>row.minute===minute).drainedLiters,uncertaintyLiters:.001,use:'calibration',source:'Authored whole-footprint cumulative drainage since event start; not a physical measurement'}));
  account.readings.push({id:'retained-held-540',channel:'retained',minute:540,valueLiters:run.drainingLayer.snapshots.find(row=>row.minute===540).retainedLiters,uncertaintyLiters:.001,use:'challenge',source:'Authored late retained amount held aside from drainage-curve inference'});
  return {project,selection,account};
}
