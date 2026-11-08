import {validateProject} from './core.js';
import {validateStudy} from './study-contract.js';
import {validateRainGauge} from './rain-gauge-evidence.js';
import {importMechanismProposal,MECHANISM_PROPOSAL_SCHEMA} from './rain-mechanism-proposal.js';
import {findMinimumChallengeConflict} from './challenge-support-conflict.js';

const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const limits=Object.freeze({offeredHypotheses:512,applicableChallengeCount:12,cellSteps:3000000,searchWork:1000000,reportItems:150000});

function prepare(originalText){
  if(typeof originalText!=='string'||!originalText.length||new TextEncoder().encode(originalText).length>4*1024*1024||originalText.charCodeAt(0)===0xfeff||new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(new TextEncoder().encode(originalText))!==originalText)throw Error('Supply nonempty exact UTF-8 original mechanism inputs, without BOM, at most4MiB.');
  const raw=JSON.parse(originalText),pending=[raw];
  while(pending.length){const value=pending.pop();if(typeof value==='number'&&!Number.isFinite(value))throw Error('Non-finite original number.');if(value&&typeof value==='object')for(const child of Object.values(value))pending.push(child);}
  if(!exact(raw,['schema','source','fronts','goal'])||raw.schema!==MECHANISM_PROPOSAL_SCHEMA||!exact(raw.source,['project','request','gauge','durations','capacities','layers']))throw Error('Supply complete original mechanism/proposal inputs, not a computed report.');
  const {project,request,gauge,durations,capacities,layers}=raw.source;
  validateProject(project);validateStudy(request);validateRainGauge(project,gauge);
  for(const values of [request.ratesMmHr,request.rainRatesMmHr,durations,capacities,layers,raw.fronts])if(!Array.isArray(values)||!values.length)throw Error('Retain every offered rainfall, duration, soil and receiver family.');
  const records=[],excludedDepthChallenges=[];
  project.observations.forEach((reading,index)=>{
    if(reading.use!=='challenge')return;
    if(reading.scenario!==request.target){excludedDepthChallenges.push({ref:'depth:'+index,index,reason:'other-scenario'});return;}
    records.push({ordinal:records.length,ref:'depth:'+index,kind:'depth',index,reading:structuredClone(reading),supportedCandidateIds:[]});
  });
  gauge.readings.forEach((reading,index)=>{if(reading.use==='challenge')records.push({ordinal:records.length,ref:'rain-gauge:'+reading.id,kind:'rain-gauge',index,reading:structuredClone(reading),supportedCandidateIds:[]});});
  const H=(request.ratesMmHr.length*(1+capacities.length+layers.length)+raw.fronts.length)*durations.length*request.rainRatesMmHr.length,C=records.length,O=project.observations.length+gauge.readings.length;
  if(!Number.isSafeInteger(H)||H>limits.offeredHypotheses||C>limits.applicableChallengeCount)throw Error('Complete offered family or challenge count exceeds the conflict budget.');
  const reservedCellSteps=3*H*project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes),S=2**C-1;
  const candidateVisits=H*(S+5*C+2),subsetBookkeeping=8*S+C*C+C,searchWork=candidateVisits+subsetBookkeeping,reportItems=H*(O+4)+2*H*C+C*C+C+32;
  if(![H,C,O,reservedCellSteps,S,candidateVisits,subsetBookkeeping,searchWork,reportItems].every(Number.isSafeInteger)||reservedCellSteps>limits.cellSteps||searchWork>limits.searchWork||reportItems>limits.reportItems)throw Error('Complete model, subset search or report work exceeds the conflict budget; no inference is started.');
  const work={offeredHypotheses:H,applicableChallengeCount:C,originalReadingCount:O,reservedCellSteps,subsetCount:S,candidateVisits,subsetBookkeeping,searchWork,reportItems,limits};
  return {raw,records,excludedDepthChallenges,work};
}

/** Pure admission and reservation; no original inference. */
export function estimateMechanismChallengeConflictWork(originalText){return prepare(originalText).work;}

/** Explain original challenge supports without refitting or deleting evidence. */
export function explainMechanismChallengeConflict(originalText){
  const {raw,records,excludedDepthChallenges,work}=prepare(originalText);
  const originalProposal=importMechanismProposal(originalText),rows=originalProposal.result.rows;
  if(!Array.isArray(rows)||rows.length>work.offeredHypotheses)throw Error('Original comparison exceeded its reserved offered family.');
  const depth=new Map(),rain=new Map();
  for(const record of records)(record.kind==='depth'?depth:rain).set(record.index,record);
  const receiveScores=(errors,map,candidateIndex,isRain)=>{
    if(!Array.isArray(errors)||errors.length!==map.size)throw Error('Authoritative challenge score ledger has missing or unexpected records.');
    const seen=new Set();
    for(const error of errors){
      const record=map.get(error?.index);
      if(!record||seen.has(error.index)||typeof error.withinBand!=='boolean'||(isRain&&error.id!==record.reading.id))throw Error('Authoritative challenge score identity, uniqueness or boolean mismatch.');
      seen.add(error.index);if(error.withinBand)record.supportedCandidateIds.push(candidateIndex);
    }
  };
  const authoritativeSurvivors=[];
  rows.forEach((row,index)=>{
    receiveScores(row.candidate?.challenge?.errors,depth,index,false);
    receiveScores(row.candidate?.rainfall?.challenge?.errors,rain,index,true);
    if(typeof row.candidate.surviving!=='boolean')throw Error('Original candidate survival must be boolean.');
    if(row.candidate.surviving)authoritativeSurvivors.push(index);
  });
  const result=findMinimumChallengeConflict(rows.length,records.map(record=>record.supportedCandidateIds));
  if(result.jointSurvivorIds.length!==authoritativeSurvivors.length||result.jointSurvivorIds.some((id,i)=>id!==authoritativeSurvivors[i]))throw Error('Challenge intersection disagrees with authoritative candidate survival.');
  const status=!rows.length?'no-calibration-family':!records.length?'no-challenges':result.jointSurvivorIds.length?'compatible-survivors':'challenge-conflict';
  let witness=null;
  if(result.witness){
    const base=result.witness,recordRefs=base.recordOrdinals.map(i=>records[i].ref);
    witness={...base,recordRefs,omissions:base.omissions.map(item=>({...item,omittedRef:records[item.omittedOrdinal].ref,remainingRefs:base.recordOrdinals.filter(i=>i!==item.omittedOrdinal).map(i=>records[i].ref)}))};
  }
  return {schema:'experimental-earth-mechanism-challenge-conflict/1',status,scope:{targetScenario:raw.source.request.target,applicableChallengeCount:records.length,excludedDepthChallenges},work,originalProposal,records,jointSurvivorIds:result.jointSurvivorIds,witness,
    meaning:'Exact minimum-cardinality incompatible challenge subset within the complete declared finite calibration-compatible family and its authoritative original scores. Ties follow canonical record order. Cached omission survivors certify irreducibility separately from the exhaustive bounded minimum search. Original target labels and verdict, all explanations, evidence roles, units, sources and prior contradictions remain; excluded other-scenario depth challenges are not silently applied. This does not diagnose any reading, sensor, clock or physical assumption, choose evidence deletions, refit hypotheses, assign probabilities or establish intervention safety. Model cell steps, search visits and report items are specified bounded work categories, not total CPU, wall-time, heap or serialized-byte guarantees.'};
}
