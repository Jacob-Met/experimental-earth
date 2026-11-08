import {classifyDecisionBands,ACQUISITION_LIMITS} from './mechanism-acquisition.js';
import {planMechanismAcquisitionCollections,estimateMechanismAcquisitionCollectionsWork} from './mechanism-acquisition-collections.js';

export const ACQUISITION_SEQUENCE_MENU_SCHEMA='experimental-earth-mechanism-acquisition-sequences/1';
export const ACQUISITION_CONDITIONAL_REPORT_SCHEMA='experimental-earth-mechanism-conditional-acquisition/1';
export const MAX_ACQUISITION_SEQUENCES=32;
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const description=value=>typeof value==='string'&&value.trim().length>0&&value.length<=600;

function geometryReservation(N,sequenceCount){
  const maximumOppositePairs=Math.floor(N*N/4),allPairs=N*(N-1)/2,maximumEndpoints=2*N+1,maximumRegions=4*N+2;
  const reservedPairWork=sequenceCount*(2*(allPairs+maximumOppositePairs)+4*maximumRegions*maximumOppositePairs);
  const reservedMembershipWork=sequenceCount*3*maximumRegions*N;
  const reservedSortWork=sequenceCount*maximumEndpoints*maximumEndpoints;
  const reservedPolicyWork=reservedPairWork+reservedMembershipWork+reservedSortWork;
  const reservedOutputItems=sequenceCount*(maximumRegions*(N+2*maximumOppositePairs+12)+12);
  return {offeredHypotheses:N,reservedSequences:sequenceCount,maximumOppositePairs,maximumEndpoints,maximumRegions,reservedPairWork,reservedMembershipWork,reservedSortWork,reservedPolicyWork,reservedOutputItems};
}

function admitGeometryWork(geometry,collectionWork=null){
  const combinedPolicyWork=(collectionWork?.combinedPairWork??0)+geometry.reservedPolicyWork;
  const combinedOutputItems=(collectionWork?.combinedOutputItems??0)+geometry.reservedOutputItems;
  if(![...Object.values(geometry),combinedPolicyWork,combinedOutputItems].every(Number.isSafeInteger)||combinedPolicyWork>ACQUISITION_LIMITS.pairChecks||combinedOutputItems>ACQUISITION_LIMITS.outputItems)throw Error('Complete conditional region, pair and report work exceeds the acquisition budget; no policy prefix is evaluated.');
  return {collection:collectionWork,geometry,combinedPolicyWork,combinedOutputItems,limits:{policyWork:ACQUISITION_LIMITS.pairChecks,outputItems:ACQUISITION_LIMITS.outputItems}};
}

/** Exact finite closed-band geometry over the nonnegative real first-value domain. */
export function classifyConditionalDecisionBands(meets,firstBands,secondBands){
  if(!Array.isArray(meets)||meets.length<1||meets.length>ACQUISITION_LIMITS.hypotheses||!Array.isArray(firstBands)||!Array.isArray(secondBands)||firstBands.length!==meets.length||secondBands.length!==meets.length)throw Error('Supply one complete nonempty finite family and two matching closed-band arrays.');
  admitGeometryWork(geometryReservation(meets.length,1));
  // The maintained helper validates each complete geometry and fixes the common
  // opposite-target pair order. Restriction below never creates new pair IDs.
  const first=classifyDecisionBands(meets,firstBands),second=classifyDecisionBands(meets,secondBands);
  const crossTargetPairs=first.crossTargetPairs,secondUnresolved=new Set(second.unresolvedPairIndices);
  const endpoints=[...new Set([0,...firstBands.flatMap(band=>[band.lowerMm,band.upperMm])])].sort((a,b)=>a-b),regions=[];
  const append=(kind,lowerMm,upperMm)=>{
    const point=kind==='point',compatibleCandidateIndices=[];
    for(let index=0;index<meets.length;index++){
      const band=firstBands[index];
      const includes=point?band.lowerMm<=lowerMm&&lowerMm<=band.upperMm:upperMm!==null&&band.lowerMm<=lowerMm&&band.upperMm>=upperMm;
      if(includes)compatibleCandidateIndices.push(index);
    }
    const meetingCount=compatibleCandidateIndices.filter(index=>meets[index]).length,missingCount=compatibleCandidateIndices.length-meetingCount;
    const action=!compatibleCandidateIndices.length?'outside-family':!missingCount?'stop-meet':!meetingCount?'stop-miss':'take-second';
    const oppositePairIndices=[],separatedPairIndices=[],unresolvedPairIndices=[];
    if(action==='take-second'){
      const active=new Set(compatibleCandidateIndices);
      for(let index=0;index<crossTargetPairs.length;index++){
        const [a,b]=crossTargetPairs[index];
        if(!active.has(a)||!active.has(b))continue;
        oppositePairIndices.push(index);
        (secondUnresolved.has(index)?unresolvedPairIndices:separatedPairIndices).push(index);
      }
    }
    const region={kind,lowerMm,upperMm,lowerInclusive:point,upperInclusive:point,compatibleCandidateIndices,meetingCount,missingCount,action,oppositePairIndices};
    if(action==='take-second')region.secondSeparation={separatedPairIndices,unresolvedPairIndices,allPairsSeparated:oppositePairIndices.length>0&&unresolvedPairIndices.length===0};
    regions.push(region);
  };
  // Every endpoint is an atom. Every intervening cell is symbolic: comparisons
  // of its bounds determine membership, even if no binary64 midpoint exists.
  for(let index=0;index<endpoints.length;index++){
    append('point',endpoints[index],endpoints[index]);
    append('open-interval',endpoints[index],index+1<endpoints.length?endpoints[index+1]:null);
  }
  const consistent=regions.filter(region=>region.compatibleCandidateIndices.length),continuations=consistent.filter(region=>region.action==='take-second');
  const summary={consistentRegionCount:consistent.length,stopAfterFirstRegionCount:consistent.length-continuations.length,continueRegionCount:continuations.length,outsideFamilyRegionCount:regions.length-consistent.length,decisionComplete:consistent.length>0&&continuations.every(region=>region.secondSeparation.allPairsSeparated),maximumReadoutCount:continuations.length?2:1};
  return {crossTargetPairs,regions,summary};
}

function admitSequences(menu,collections,declaration){
  if(!exact(declaration,['schema','eventRef','sequences'])||declaration.schema!==ACQUISITION_SEQUENCE_MENU_SCHEMA||declaration.eventRef!==menu.eventRef||!Array.isArray(declaration.sequences)||declaration.sequences.length<1||declaration.sequences.length>MAX_ACQUISITION_SEQUENCES)throw Error('Offer1–32 explicit conditional sequences for the original acquisition event.');
  const options=new Map(menu.options.map(offer=>[offer.id,offer])),pairs=new Map(collections.collections.map(offer=>[offer.id,offer]));
  const ids=new Set([...options.keys(),...pairs.keys()]),sequences=[];
  for(const offer of Array.from(declaration.sequences)){
    if(!exact(offer,['id','collectionId','firstOptionId','secondOptionId','minimumDecisionMinutes','responseBasis','conditionalAvailabilityBasis'])||!description(offer.id)||ids.has(offer.id)||!description(offer.responseBasis)||!description(offer.conditionalAvailabilityBasis)||typeof offer.minimumDecisionMinutes!=='number'||!Number.isFinite(offer.minimumDecisionMinutes)||offer.minimumDecisionMinutes<0||offer.minimumDecisionMinutes>1e6)throw Error('Each distinct sequence needs an original collection, explicit order, response delay and conditional availability.');
    const pair=pairs.get(offer.collectionId);
    if(!pair||offer.firstOptionId===offer.secondOptionId||!pair.optionIds.includes(offer.firstOptionId)||!pair.optionIds.includes(offer.secondOptionId))throw Error('A sequence must order exactly the two distinct members of its original offered collection.');
    ids.add(offer.id);
    const first=options.get(offer.firstOptionId),second=options.get(offer.secondOptionId);
    const firstEndMinute=first.kind==='depth'?first.minute:first.endMinute,secondStartMinute=second.kind==='depth'?second.minute:second.startMinute;
    const timing={firstEndMinute,firstAvailableMinute:first.availableMinute,minimumDecisionMinutes:offer.minimumDecisionMinutes,decisionReadyMinute:first.availableMinute+offer.minimumDecisionMinutes,secondStartMinute};
    const exclusionReasons=[];
    if(first.mode!=='prospective')exclusionReasons.push('first-option-is-not-prospective');
    if(second.mode!=='prospective')exclusionReasons.push('second-option-is-not-prospective');
    if(secondStartMinute<=firstEndMinute)exclusionReasons.push('second-support-not-after-first');
    if(secondStartMinute<timing.decisionReadyMinute)exclusionReasons.push('second-start-before-decision-ready');
    sequences.push({offer:structuredClone(offer),timing,exclusionReasons});
  }
  return sequences;
}

/** Admit all original sequence declarations and reserve work without inference. */
export function prepareMechanismConditionalAcquisition(originalText,menu,collections,declaration){
  const collectionWork=estimateMechanismAcquisitionCollectionsWork(originalText,menu,collections);
  const offered=admitSequences(menu,collections,declaration);
  const work=admitGeometryWork(geometryReservation(collectionWork.singleReadout.offeredHypotheses,offered.length),collectionWork);
  return {sequences:offered,work};
}

/** Plan declared ordered collections from complete originals, with one inference. */
export function planMechanismConditionalAcquisition(originalText,menu,collections,declaration){
  const {sequences:offered,work}=prepareMechanismConditionalAcquisition(originalText,menu,collections,declaration);
  // Full original and all offered policy work is reserved before this sole
  // authoritative planner call. No caller-supplied prediction report is intake.
  const collectionReport=planMechanismAcquisitionCollections(originalText,menu,collections);
  const single=collectionReport.singleReadoutReport,options=new Map(single.options.map(option=>[option.offer.id,option])),pairs=new Map(collectionReport.collections.map(pair=>[pair.offer.id,pair]));
  const meets=single.proposal.rows.map(row=>row.meets),sequences=[];
  for(const sequence of offered){
    const exclusionReasons=[...sequence.exclusionReasons];
    if(pairs.get(sequence.offer.collectionId).status==='excluded')exclusionReasons.push('collection-excluded');
    if(exclusionReasons.length){sequences.push({...sequence,status:'excluded',exclusionReasons});continue;}
    if(!single.crossTargetPairs.length){sequences.push({...sequence,status:'not-needed'});continue;}
    const first=options.get(sequence.offer.firstOptionId),second=options.get(sequence.offer.secondOptionId);
    const geometry=classifyConditionalDecisionBands(meets,first.predictions,second.predictions);
    sequences.push({...sequence,status:geometry.summary.decisionComplete?'decision-complete':'unresolved',regions:geometry.regions,summary:geometry.summary});
  }
  const decisionCompleteSequenceIds=sequences.filter(sequence=>sequence.status==='decision-complete').map(sequence=>sequence.offer.id);
  const stopAfterFirstSequenceIds=sequences.filter(sequence=>sequence.summary?.stopAfterFirstRegionCount>0).map(sequence=>sequence.offer.id);
  const selectionStatus=!single.proposal.rows.length?'no-compatible-explanations':!single.crossTargetPairs.length?'no-target-disagreement':decisionCompleteSequenceIds.length?'decision-complete-sequences':'no-decision-complete-sequence';
  return {schema:ACQUISITION_CONDITIONAL_REPORT_SCHEMA,status:collectionReport.status==='evidence-challenged'?'evidence-challenged':selectionStatus,selectionStatus,collectionReport,sequences,decisionCompleteSequenceIds,stopAfterFirstSequenceIds,work,
    meaning:'A conditional finite-family plan over explicitly ordered prospective readouts. All original calibration-compatible rows, target labels, challenge labels and guarded prediction bands remain in the collection report. Endpoint atoms and symbolic real open intervals cover the complete nonnegative first-value domain without midpoint sampling. A nonempty unanimous branch can stop; a mixed branch needs the declared second readout, whose remaining original opposite-target pairs are retained. Outside-family values challenge the family and supply no target verdict. Both declared physical error bounds must hold simultaneously; no statistical independence, probability, expected cost or general optimality follows. Second-support chronology, response delay and conditional availability are declared, not verified. Actual late receipt or wider uncertainty can invalidate use of this precomputed policy. No observed value guides original query selection, no hypothesis is refitted, and no acquisition, instrument operation or adopted site change follows.'};
}
