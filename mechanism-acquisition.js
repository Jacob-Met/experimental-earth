import {runRain,validateProject,interpolateDepth} from './core.js';
import {importMechanismProposal,MECHANISM_PROPOSAL_SCHEMA} from './rain-mechanism-proposal.js';
import {INFILTRATION_STORAGE_MODEL} from './infiltration-storage.js';
import {RAIN_SOIL_WORK_LIMIT} from './rain-soil-evidence.js';
import {validateRainGauge} from './rain-gauge-evidence.js';
import {validateStudy} from './study-contract.js';

export const ACQUISITION_MENU_SCHEMA='experimental-earth-mechanism-acquisition-menu/1';
export const ACQUISITION_REPORT_SCHEMA='experimental-earth-mechanism-acquisition/1';
export const ACQUISITION_LIMITS=Object.freeze({options:64,hypotheses:512,pairChecks:100000,predictions:10000,outputItems:150000,cellSteps:RAIN_SOIL_WORK_LIMIT});
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const nonnegative=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const description=x=>typeof x==='string'&&x.trim().length>0&&x.length<=600;
// Match only clock coordinates, at the maintained depth planner's resolution.
const timeKey=minute=>Math.round(minute*1e7);

function decisionPairs(meets){
  const pairs=[];
  for(let a=0;a<meets.length;a++)for(let b=a+1;b<meets.length;b++)if(meets[a]!==meets[b])pairs.push([a,b]);
  return pairs;
}
function classifyPairs(pairs,bands){
  const separatedPairIndices=[],unresolvedPairIndices=[];
  for(let i=0;i<pairs.length;i++){
    const [a,b]=pairs[i],left=bands[a],right=bands[b];
    // Closed bands that touch remain unresolved. No span or vote substitutes
    // for checking every opposite-target pair.
    (left.upperMm<right.lowerMm||right.upperMm<left.lowerMm?separatedPairIndices:unresolvedPairIndices).push(i);
  }
  return {separatedPairIndices,unresolvedPairIndices,allPairsSeparated:pairs.length>0&&unresolvedPairIndices.length===0};
}
/** Pure finite-family band geometry, not a probability or an inference importer. */
export function classifyDecisionBands(meets,bands){
  if(!Array.isArray(meets)||meets.length>ACQUISITION_LIMITS.hypotheses||Array.from(meets).some(x=>typeof x!=='boolean')||!Array.isArray(bands)||bands.length!==meets.length||Array.from(bands).some(b=>!b||!nonnegative(b.lowerMm)||!nonnegative(b.upperMm)||b.upperMm<b.lowerMm))throw Error('Supply matching finite closed readout bands and boolean target outcomes.');
  const crossTargetPairs=decisionPairs(meets);
  return {crossTargetPairs,...classifyPairs(crossTargetPairs,bands)};
}

function originalRecords(source){
  const depth=source.project.observations.filter(r=>r.scenario===source.request.target);
  return {depth,gauge:source.gauge.readings,identities:new Set([
    ...source.project.observations.map((_,index)=>'depth:'+index),
    ...source.gauge.readings.map(r=>'rain-gauge:'+r.id),
  ])};
}
function admitMenu(source,menu){
  if(!exact(menu,['schema','eventRef','planningMinute','decisionMinute','options'])||menu.schema!==ACQUISITION_MENU_SCHEMA||menu.eventRef!==source.gauge.eventRef||!nonnegative(menu.planningMinute)||!nonnegative(menu.decisionMinute)||menu.decisionMinute<menu.planningMinute||!Array.isArray(menu.options)||menu.options.length<1||menu.options.length>ACQUISITION_LIMITS.options)throw Error('Declare the original event, an ordered planning/decision clock and 1–64 offered measurements.');
  const recorded=originalRecords(source),horizon=source.project.weather.durationMinutes;
  if(recorded.depth.some(r=>r.use==='calibration'&&r.minute>menu.planningMinute)||recorded.gauge.some(r=>r.use==='calibration'&&r.endMinute>menu.planningMinute))throw Error('The planning point must follow all original calibration readings.');
  const ids=new Set(),archiveRefs=new Set(),options=[];
  for(const option of menu.options){
    const keys=['id','kind','mode','availableMinute','uncertaintyMm','source','availabilityBasis','associationBasis'];
    if(option?.kind==='depth')keys.push('cellIndex','minute');
    else if(option?.kind==='rain-gauge')keys.push('startMinute','endMinute');
    else throw Error('Each offered measurement must be a site depth or an interval rain-gauge total.');
    if(option.mode==='existing-record')keys.push('recordRef','distinctRecordBasis');
    else if(option.mode!=='prospective')throw Error('Declare a prospective measurement or an actually existing record.');
    if(!exact(option,keys)||!description(option.id)||ids.has(option.id)||!nonnegative(option.availableMinute)||!nonnegative(option.uncertaintyMm)||option.uncertaintyMm>10000||!['source','availabilityBasis','associationBasis'].every(k=>description(option[k])))throw Error('Offer distinct identified measurements with finite uncertainty, availability and original-event association declarations.');
    ids.add(option.id);
    if(option.mode==='existing-record'){
      if(!description(option.recordRef)||option.recordRef!==option.recordRef.trim()||!description(option.distinctRecordBasis)||archiveRefs.has(option.recordRef)||(!recorded.identities.has(option.recordRef)&&!option.recordRef.startsWith('external:'))||option.recordRef==='external:')throw Error('Each archived offer needs a canonical original reference or external: record reference, and an explicit non-reuse declaration.');
      archiveRefs.add(option.recordRef);
    }
    if(option.kind==='depth'){
      if(!Number.isInteger(option.cellIndex)||option.cellIndex<0||option.cellIndex>=source.project.width*source.project.height||!nonnegative(option.minute))throw Error('Offer a valid original cell and a finite nonnegative depth-reading time.');
    }else if(!nonnegative(option.startMinute)||!nonnegative(option.endMinute)||option.endMinute<=option.startMinute)throw Error('Offer an ordered positive original-clock rainfall interval.');
    const start=option.kind==='depth'?option.minute:option.startMinute,end=option.kind==='depth'?option.minute:option.endMinute,reasons=[];
    if(end>horizon)reasons.push('outside-original-event-horizon');
    if(option.availableMinute<end)reasons.push('available-before-measurement');
    if(option.availableMinute>menu.decisionMinute)reasons.push('available-after-decision');
    if(option.mode==='prospective'){
      if(start<menu.planningMinute)reasons.push('prospective-measurement-starts-in-past');
      const occupied=option.kind==='depth'
        ?recorded.depth.some(r=>r.cellIndex===option.cellIndex&&timeKey(r.minute)===timeKey(option.minute))
        :recorded.gauge.some(r=>timeKey(r.startMinute)===timeKey(start)&&timeKey(r.endMinute)===timeKey(end));
      if(occupied)reasons.push('original-reading-already-recorded');
    }else{
      if(end>menu.planningMinute)reasons.push('record-does-not-yet-exist');
      if(recorded.identities.has(option.recordRef))reasons.push('original-record-already-consumed');
    }
    options.push({offer:structuredClone(option),exclusionReasons:reasons});
  }
  return options;
}

function reserveWork(raw,options){
  const {source,fronts}=raw,{project,request,durations,capacities,layers}=source;
  for(const value of [request?.ratesMmHr,request?.rainRatesMmHr,durations,capacities,layers,fronts])if(!Array.isArray(value)||!value.length)throw Error('Retain the complete original rainfall, duration, soil and receiver offers.');
  const offeredHypotheses=(request.ratesMmHr.length*(1+capacities.length+layers.length)+fronts.length)*durations.length*request.rainRatesMmHr.length;
  const eligible=options.filter(o=>!o.exclusionReasons.length),depthReplay=eligible.some(o=>o.offer.kind==='depth');
  const reservedCellSteps=(3+Number(depthReplay))*offeredHypotheses*project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
  const reservedCrossTargetPairs=Math.floor(offeredHypotheses*offeredHypotheses/4);
  const reservedPairChecks=(eligible.length+1)*offeredHypotheses*(offeredHypotheses-1)/2,reservedPredictions=eligible.length*offeredHypotheses;
  const reservedOutputItems=offeredHypotheses*(1+project.observations.length+source.gauge.readings.length)+(eligible.length+1)*reservedCrossTargetPairs+reservedPredictions;
  if(![offeredHypotheses,reservedCellSteps,reservedPairChecks,reservedPredictions,reservedOutputItems].every(Number.isSafeInteger)||offeredHypotheses>ACQUISITION_LIMITS.hypotheses||reservedCellSteps>ACQUISITION_LIMITS.cellSteps||reservedPairChecks>ACQUISITION_LIMITS.pairChecks||reservedPredictions>ACQUISITION_LIMITS.predictions||reservedOutputItems>ACQUISITION_LIMITS.outputItems)throw Error('Complete inference, replay, pair and report work exceeds the acquisition budget; no partial menu is evaluated.');
  return {offeredHypotheses,reservedCellSteps,reservedCrossTargetPairs,reservedPairChecks,reservedPredictions,reservedOutputItems,limits:ACQUISITION_LIMITS};
}
function candidateOptions(candidate,surface){
  if(candidate.soilModel==='wetting-front')return {surfaceWettingFront:{surface,conductivityMmHr:candidate.front.conductivityMmHr,capillaryDriveMm:candidate.front.capillaryDriveMm}};
  const options={surfaceInfiltrationOverride:{surface,rateMmHr:candidate.rateMmHr}};
  if(candidate.receiverModel==='draining')options.drainingLayer=candidate.layer;
  else if(candidate.receiverModel==='closed')options.infiltrationStorage={schema:INFILTRATION_STORAGE_MODEL,surface,remainingCapacityMm:candidate.remainingCapacityMm,source:candidate.capacitySource};
  return options;
}
function readoutBand(predictedMm,uncertaintyMm,kind){
  if(!nonnegative(predictedMm))throw Error('A retained explanation produced a non-finite or negative readout.');
  // Conservatively include the maintained readout admission's floating-point
  // tolerance, including its dependence on the yet-unknown observed value.
  // This is printed separately from the declared physical measurement error.
  const epsilon=kind==='depth'?1e-9:64*Number.EPSILON;
  const numericalGuardMm=2*epsilon/(1-epsilon)*Math.max(1,predictedMm+uncertaintyMm);
  const lowerMm=Math.max(0,predictedMm-uncertaintyMm-numericalGuardMm),upperMm=predictedMm+uncertaintyMm+numericalGuardMm;
  if(!Number.isFinite(upperMm))throw Error('Readout band overflow.');
  return {predictedMm,uncertaintyMm,numericalGuardMm,lowerMm,upperMm};
}

/** Recompute the original investigation once; never accept cached caller results. */
export function planMechanismAcquisition(originalText,menu){
  if(typeof originalText!=='string'||new TextEncoder().encode(originalText).length>4*1024*1024)throw Error('Open at most4MiB of original mechanism/proposal inputs.');
  const raw=JSON.parse(originalText);
  if(!exact(raw,['schema','source','fronts','goal'])||raw.schema!==MECHANISM_PROPOSAL_SCHEMA||!exact(raw.source,['project','request','gauge','durations','capacities','layers']))throw Error('Open original mechanism/proposal inputs, not derived results.');
  validateProject(raw.source.project);validateStudy(raw.source.request);validateRainGauge(raw.source.project,raw.source.gauge);
  const admitted=admitMenu(raw.source,menu),work=reserveWork(raw,admitted);
  // The maintained importer remains the sole inference/target authority.
  const imported=importMechanismProposal(originalText),{source}=imported,proposal=imported.result;
  const crossTargetPairs=decisionPairs(proposal.rows.map(row=>row.meets)),options=[],runs=new Map();
  for(const {offer,exclusionReasons} of admitted){
    if(exclusionReasons.length){options.push({offer,status:'excluded',exclusionReasons});continue;}
    if(!crossTargetPairs.length){options.push({offer,status:'not-needed',exclusionReasons:[]});continue;}
    const predictions=proposal.rows.map((row,candidateIndex)=>{
      const candidate=row.candidate;let predictedMm,timing;
      if(offer.kind==='depth'){
        if(!runs.has(candidateIndex))runs.set(candidateIndex,runRain(source.project[source.request.target],source.project.width,source.project.height,{...source.project.weather,rainMmHr:candidate.rainMmHr,stormMinutes:candidate.stormMinutes},candidateOptions(candidate,source.request.surface)));
        const depth=interpolateDepth(runs.get(candidateIndex),offer.cellIndex,offer.minute);
        predictedMm=depth.depthMm;timing={method:depth.method,beforeMinute:depth.beforeMinute,afterMinute:depth.afterMinute};
      }else{
        const rainyMinutes=Math.max(0,Math.min(offer.endMinute,candidate.stormMinutes)-Math.min(offer.startMinute,candidate.stormMinutes));
        predictedMm=candidate.rainMmHr*rainyMinutes/60;timing={method:'constant-forcing-overlap',rainyMinutes};
      }
      return {candidateIndex,...readoutBand(predictedMm,offer.uncertaintyMm,offer.kind),...timing};
    });
    const result=classifyPairs(crossTargetPairs,predictions);
    options.push({offer,status:result.allPairsSeparated?'separates-decision':'unresolved',exclusionReasons:[],predictions,...result});
  }
  const decisionSeparatingOptionIds=options.filter(o=>o.status==='separates-decision').map(o=>o.offer.id);
  const decisionStatus=!proposal.rows.length?'no-compatible-explanations':!crossTargetPairs.length?'no-target-disagreement':decisionSeparatingOptionIds.length?'decision-separating-options':'no-decision-separating-option';
  return {schema:ACQUISITION_REPORT_SCHEMA,status:proposal.status==='evidence-challenged'?'evidence-challenged':decisionStatus,decisionStatus,eventRef:menu.eventRef,planningMinute:menu.planningMinute,decisionMinute:menu.decisionMinute,scenario:source.request.target,work,proposal,crossTargetPairs,options,decisionSeparatingOptionIds,
    originalRecordReferences:{depth:source.project.observations.map((_,index)=>'depth:'+index),rainGauge:source.gauge.readings.map(r=>'rain-gauge:'+r.id)},
    meaning:'Conditional finite-family decision identifiability from one offered readout. Every calibration-compatible explanation, original target guard and held-aside contradiction is retained. Strictly disjoint closed bands must separate every opposite-target pair; a readout outside every band challenges the family. Numerical readout guards are reported separately from declared measurement uncertainty. Original-input identities mark consumed records; a different reference and non-reuse basis are declarations, not verified provenance or statistical independence. Availability, event/site/clock association and access are declared, not verified acquisition. No posterior probability, preferred intervention, physical validation, instrument operation or adopted site change follows.'};
}
