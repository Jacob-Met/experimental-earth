import {createHash} from 'node:crypto';
import {DEPTH_UNITS} from './observation-units.js';
import {ACQUISITION_LIMITS} from './mechanism-acquisition.js';
import {prepareMechanismConditionalAcquisition,classifyConditionalDecisionBands} from './mechanism-acquisition-conditional.js';
import {estimateMechanismAcquisitionReceiptWork,receiveMechanismAcquisition} from './mechanism-acquisition-receive.js';

export const CONDITIONAL_ACQUISITION_RECEIPT_SCHEMA='experimental-earth-mechanism-conditional-acquisition-receipt/1';
export const CONDITIONAL_ACQUISITION_RECEIVED_SCHEMA='experimental-earth-mechanism-conditional-acquisition-received/1';
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');

function parseOriginal(text,limit,label){
  if(typeof text!=='string'||!Buffer.byteLength(text,'utf8')||Buffer.byteLength(text,'utf8')>limit)throw Error(`${label} exceeds its original-input limit.`);
  return JSON.parse(text);
}

function reserveCombined(prepared,receiptWork){
  const N=receiptWork.forecast.singleReadout.offeredHypotheses,P=Math.floor(N*N/4),R=4*N+2;
  const additionalActualPolicyWork=8*P+8*N+8*R+32,additionalOutputItems=3*P+4*N+128;
  const combinedPolicyWork=prepared.work.combinedPolicyWork+additionalActualPolicyWork;
  const combinedOutputItems=receiptWork.combinedOutputItems+prepared.work.geometry.reservedOutputItems+additionalOutputItems;
  const combinedCellSteps=receiptWork.combinedCellSteps;
  if(![N,P,R,additionalActualPolicyWork,additionalOutputItems,combinedPolicyWork,combinedOutputItems,combinedCellSteps].every(Number.isSafeInteger)||combinedPolicyWork>ACQUISITION_LIMITS.pairChecks||combinedOutputItems>ACQUISITION_LIMITS.outputItems||combinedCellSteps>ACQUISITION_LIMITS.cellSteps)throw Error('Complete conditional receipt work exceeds the acquisition budget; no inference course is started.');
  return {conditional:prepared.work,receipt:receiptWork,additionalActualPolicyWork,additionalOutputItems,combinedPolicyWork,combinedOutputItems,combinedCellSteps,limits:{policyWork:ACQUISITION_LIMITS.pairChecks,outputItems:ACQUISITION_LIMITS.outputItems,cellSteps:ACQUISITION_LIMITS.cellSteps}};
}

function actualTiming(sequence,firstReceipt,menu,second){
  const receivedMinute=firstReceipt.receivedMinute,minimumDecisionMinutes=sequence.offer.minimumDecisionMinutes;
  const decisionReadyMinute=receivedMinute+minimumDecisionMinutes;
  if(!Number.isFinite(decisionReadyMinute))throw Error('Actual receipt plus response delay must remain finite.');
  const decisionMinute=menu.decisionMinute,secondStartMinute=sequence.timing.secondStartMinute,secondAvailableMinute=second.availableMinute;
  const receivedByDecision=receivedMinute<=decisionMinute,readyByDecision=decisionReadyMinute<=decisionMinute;
  const canStartSecondAfterDecision=secondStartMinute>=decisionReadyMinute,secondDeclaredAvailableByDecision=secondAvailableMinute<=decisionMinute;
  return {receivedMinute,minimumDecisionMinutes,decisionReadyMinute,decisionMinute,receivedByDecision,readyByDecision,secondStartMinute,secondAvailableMinute,canStartSecondAfterDecision,secondDeclaredAvailableByDecision,continuationFeasible:readyByDecision&&canStartSecondAfterDecision&&secondDeclaredAvailableByDecision};
}

/** Receive one actual first reading; planned regions remain diagnostic only. */
export function receiveMechanismConditionalAcquisition(originalText,menuText,conditionalReceipt,collectionText,sequenceText){
  parseOriginal(originalText,4*1024*1024,'Original proposal');
  const menu=parseOriginal(menuText,128*1024,'Acquisition menu');
  const collections=parseOriginal(collectionText,128*1024,'Acquisition collections');
  const declaration=parseOriginal(sequenceText,128*1024,'Conditional sequences');
  if(!exact(conditionalReceipt,['schema','conditionalSequencesSha256','sequenceId','firstReceipt'])||conditionalReceipt.schema!==CONDITIONAL_ACQUISITION_RECEIPT_SCHEMA||conditionalReceipt.conditionalSequencesSha256!==sha(sequenceText)||typeof conditionalReceipt.sequenceId!=='string')throw Error('Supply an exact original-sequence-bound conditional first receipt.');
  const prepared=prepareMechanismConditionalAcquisition(originalText,menu,collections,declaration);
  const sequence=prepared.sequences.find(item=>item.offer.id===conditionalReceipt.sequenceId);
  if(!sequence)throw Error('The selected sequence is absent from the complete original declaration.');
  if(sequence.exclusionReasons.length)throw Error('The selected sequence is excluded by original chronology or prospective admission.');
  const firstReceipt=conditionalReceipt.firstReceipt;
  if(!exact(firstReceipt?.choice,['kind','id'])||firstReceipt.choice.kind!=='single'||firstReceipt.choice.id!==sequence.offer.firstOptionId)throw Error('Receive exactly the selected sequence first option as a singleton.');
  const receiptWork=estimateMechanismAcquisitionReceiptWork(originalText,menuText,firstReceipt,collectionText);
  const work=reserveCombined(prepared,receiptWork);
  const secondOffer=menu.options.find(offer=>offer.id===sequence.offer.secondOptionId);
  const timing=actualTiming(sequence,firstReceipt,menu,secondOffer);
  // The estimator has admitted all originals and actual readings. This is the
  // only receiver call and performs exactly the established two full courses.
  const {receivedOriginalText,report:receiptReport}=receiveMechanismAcquisition(originalText,menuText,firstReceipt,collectionText);
  const collectionReport=receiptReport.forecast,single=collectionReport.singleReadoutReport;
  const originalCollection=collectionReport.collections.find(item=>item.offer.id===sequence.offer.collectionId);
  if(!originalCollection||originalCollection.status==='excluded')throw Error('The selected original collection is excluded; no conditional receipt is returned.');
  const first=single.options.find(item=>item.offer.id===sequence.offer.firstOptionId),second=single.options.find(item=>item.offer.id===sequence.offer.secondOptionId);
  const reading=receiptReport.receipt.readings[0].reading;
  const firstValueMm=first.offer.kind==='depth'?reading.depthMm:reading.depth*DEPTH_UNITS[reading.unit];
  if(!Number.isFinite(firstValueMm)||firstValueMm<0)throw Error('Actual first value must normalize to finite nonnegative millimetres.');
  let plannedPolicy={status:'not-needed',firstValueMm,regionIndex:null,action:null};
  if(single.crossTargetPairs.length){
    const geometry=classifyConditionalDecisionBands(single.proposal.rows.map(row=>row.meets),first.predictions,second.predictions);
    const regionIndex=geometry.regions.findIndex(region=>region.kind==='point'?firstValueMm===region.lowerMm:firstValueMm>region.lowerMm&&(region.upperMm===null||firstValueMm<region.upperMm));
    if(regionIndex<0)throw Error('Planned diagnostic partition did not cover the admitted first value.');
    plannedPolicy={status:geometry.summary.decisionComplete?'decision-complete':'unresolved',firstValueMm,regionIndex,action:geometry.regions[regionIndex].action,regions:geometry.regions,summary:geometry.summary};
  }
  const actual=receiptReport.receivedOutcome;
  let secondSeparation=null;
  if(actual.meetingCount>0&&actual.missingCount>0){
    const survivors=new Set(actual.survivingIndices),unresolved=new Set(second.unresolvedPairIndices);
    const oppositePairIndices=[],separatedPairIndices=[],unresolvedPairIndices=[];
    single.crossTargetPairs.forEach(([a,b],index)=>{
      if(!survivors.has(a)||!survivors.has(b))return;
      oppositePairIndices.push(index);
      (unresolved.has(index)?unresolvedPairIndices:separatedPairIndices).push(index);
    });
    secondSeparation={oppositePairIndices,separatedPairIndices,unresolvedPairIndices,allPairsSeparated:oppositePairIndices.length>0&&unresolvedPairIndices.length===0};
  }
  const action=!single.proposal.rows.length?'no-compatible-explanations':!actual.survivingCount?'family-challenged':!timing.readyByDecision?'not-ready-by-deadline':!actual.missingCount?'stop-meet':!actual.meetingCount?'stop-miss':!timing.continuationFeasible?'continuation-unavailable':secondSeparation.allPairsSeparated?'take-second':'continuation-unresolved';
  return {receivedOriginalText,report:{schema:CONDITIONAL_ACQUISITION_RECEIVED_SCHEMA,eventRef:menu.eventRef,conditionalReceipt:structuredClone(conditionalReceipt),sequence:structuredClone(sequence),receiptReport,plannedPolicy,actualDecision:{action,outcome:actual.status,timing,secondSeparation},work,
    meaning:'The actual first reading is received through the unchanged original challenge receiver with its own value, unit, uncertainty and source. All original calibration explanations, target labels and prior contradictions remain in the nested report. Planned-region lookup is diagnostic under planned uncertainty; actual action uses only the received uncontradicted subset and actual receipt plus declared response delay. A nonempty unanimous subset may stop only when decision-ready by the deadline. A mixed subset needs a feasible later reading and separation of every remaining original opposite-target pair by that reading’s declared bands. No survivors challenges the family and supplies no target verdict. Second-reading precision and availability remain declarations; this does not acquire or receive the second reading. Source/clock association and physical accuracy are unverified, and no probability, expected cost, model adequacy or physical intervention permission follows.'}};
}
