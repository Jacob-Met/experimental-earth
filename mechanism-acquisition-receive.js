import {createHash} from 'node:crypto';
import {validateProject} from './core.js';
import {validateRainGauge} from './rain-gauge-evidence.js';
import {DEPTH_UNITS} from './observation-units.js';
import {importMechanismProposal} from './rain-mechanism-proposal.js';
import {planMechanismAcquisition,estimateMechanismAcquisitionWork,ACQUISITION_LIMITS} from './mechanism-acquisition.js';
import {planMechanismAcquisitionCollections,estimateMechanismAcquisitionCollectionsWork} from './mechanism-acquisition-collections.js';

export const ACQUISITION_RECEIPT_SCHEMA='experimental-earth-mechanism-acquisition-receipt/1';
export const ACQUISITION_RECEIVED_SCHEMA='experimental-earth-mechanism-acquisition-received/1';
const ORIGINAL_LIMIT=4*1024*1024,MENU_LIMIT=128*1024;
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const description=value=>typeof value==='string'&&value.trim().length>0&&value.length<=600;
const nonnegative=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');

function originalJSON(text,limit,label){
  if(typeof text!=='string'||Buffer.byteLength(text,'utf8')<1||Buffer.byteLength(text,'utf8')>limit)throw Error(`${label} exceeds its complete original-input limit.`);
  const value=JSON.parse(text),pending=[value];
  // The returned originals must not silently convert an overflowing JSON number
  // to null, including numbers in preserved fields not used by this calculation.
  while(pending.length){
    const next=pending.pop();
    if(typeof next==='number'&&!Number.isFinite(next))throw Error(`${label} contains a non-finite original number.`);
    if(next&&typeof next==='object')for(const child of Object.values(next))pending.push(child);
  }
  return value;
}

function selectedOffers(menu,collections,receipt,originalText,menuText,collectionText){
  if(!exact(receipt,['schema','inputs','eventRef','choice','receivedMinute','receiptBasis','readings'])||receipt.schema!==ACQUISITION_RECEIPT_SCHEMA||!exact(receipt.inputs,['originalProposalSha256','acquisitionMenuSha256','acquisitionCollectionsSha256'])||receipt.eventRef!==menu.eventRef||!description(receipt.receiptBasis)||!nonnegative(receipt.receivedMinute)||receipt.receivedMinute<menu.planningMinute||!Array.isArray(receipt.readings)||receipt.readings.length<1||receipt.readings.length>2)throw Error('Supply a complete source-bound acquisition receipt with actual readings and an original-clock receipt declaration.');
  if(receipt.inputs.originalProposalSha256!==sha(originalText)||receipt.inputs.acquisitionMenuSha256!==sha(menuText)||receipt.inputs.acquisitionCollectionsSha256!==(collectionText===null?null:sha(collectionText)))throw Error('Receipt input identity does not match the complete original proposal, menu or collection bytes.');
  const choice=receipt.choice;
  if(!exact(choice,['kind','id'])||!['single','collection'].includes(choice.kind)||!description(choice.id))throw Error('Identify one offered single readout or collection.');
  const options=new Map(menu.options.map(offer=>[offer.id,offer]));
  let optionIds;
  if(choice.kind==='single')optionIds=[choice.id];
  else{
    const offered=collections?.collections.find(offer=>offer.id===choice.id);
    if(!offered)throw Error('The selected collection needs its complete original declaration.');
    optionIds=[...offered.optionIds];
  }
  if(optionIds.some(id=>!options.has(id)))throw Error('The selected readout is not in the original menu.');
  const selected=optionIds.map(id=>options.get(id));
  if(selected.some(offer=>offer.mode!=='prospective'))throw Error('This receiver accepts prospective offers only; archived-record receipt needs a separate persistent identity contract.');
  if(selected.some(offer=>receipt.receivedMinute<(offer.kind==='depth'?offer.minute:offer.endMinute)))throw Error('A receipt cannot precede a selected measurement end.');
  const readings=new Map();
  for(const entry of Array.from(receipt.readings)){
    if(!exact(entry,['optionId','reading'])||typeof entry.optionId!=='string'||!optionIds.includes(entry.optionId)||readings.has(entry.optionId))throw Error('Receive each selected member exactly once, with no extra or duplicate member.');
    readings.set(entry.optionId,entry.reading);
  }
  if(readings.size!==selected.length)throw Error('Receive the complete selected member set; a partial collection is not a paired receipt.');
  return {selected,readings,selectedChoice:{kind:choice.kind,id:choice.id,optionIds}};
}

function appendChallenges(raw,selected,readings){
  const received=structuredClone(raw),receivedRecords=[],precision=[];
  for(const offer of selected){
    const reading=readings.get(offer.id);
    if(offer.kind==='depth'){
      if(!exact(reading,['scenario','use','cellIndex','minute','depthMm','uncertaintyMm','source'])||reading.use!=='challenge'||reading.scenario!==raw.source.request.target||reading.cellIndex!==offer.cellIndex||reading.minute!==offer.minute)throw Error('Receive an explicitly held-aside depth at the exact selected scenario, cell and time.');
      const index=received.source.project.observations.length;
      received.source.project.observations.push(structuredClone(reading));
      receivedRecords.push({optionId:offer.id,kind:offer.kind,recordRef:'depth:'+index});
      precision.push({optionId:offer.id,plannedUncertaintyMm:offer.uncertaintyMm,actualUncertaintyMm:reading.uncertaintyMm,exceedsPlanned:reading.uncertaintyMm>offer.uncertaintyMm});
    }else{
      if(!exact(reading,['id','startMinute','endMinute','depth','uncertainty','unit','source','use'])||reading.use!=='challenge'||reading.startMinute!==offer.startMinute||reading.endMinute!==offer.endMinute)throw Error('Receive an explicitly held-aside rainfall reading over the exact selected interval.');
      received.source.gauge.readings.push(structuredClone(reading));
      receivedRecords.push({optionId:offer.id,kind:offer.kind,recordRef:'rain-gauge:'+reading.id});
      const actualUncertaintyMm=reading.uncertainty*DEPTH_UNITS[reading.unit];
      precision.push({optionId:offer.id,plannedUncertaintyMm:offer.uncertaintyMm,actualUncertaintyMm,exceedsPlanned:actualUncertaintyMm>offer.uncertaintyMm});
    }
  }
  validateProject(received.source.project);
  validateRainGauge(received.source.project,received.source.gauge);
  return {received,receivedRecords,precision};
}

function reserveReceipt(forecastWork,singleWork,received,readingCount){
  const {project,gauge}=received.source,N=singleWork.offeredHypotheses;
  // The forecast includes one original inference/proposal evaluation and any
  // readout replay. Receiving then performs a second full original evaluation.
  const receivedInferenceCellSteps=3*N*project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
  const combinedCellSteps=singleWork.reservedCellSteps+receivedInferenceCellSteps;
  // Both outcome summaries store up to two indices per candidate, and the
  // newly contradicted list another one. Preserve all received error records.
  const receivedOutputItems=N*(1+project.observations.length+gauge.readings.length)+5*N+3*readingCount;
  const forecastOutputItems=forecastWork.combinedOutputItems??forecastWork.reservedOutputItems;
  const combinedOutputItems=forecastOutputItems+receivedOutputItems;
  if(![receivedInferenceCellSteps,combinedCellSteps,receivedOutputItems,combinedOutputItems].every(Number.isSafeInteger)||combinedCellSteps>ACQUISITION_LIMITS.cellSteps||combinedOutputItems>ACQUISITION_LIMITS.outputItems)throw Error('Complete planning plus received inference and report work exceeds the acquisition budget; neither course is started.');
  return {forecast:forecastWork,receivedInferenceCellSteps,combinedCellSteps,receivedOutputItems,combinedOutputItems,limits:{cellSteps:ACQUISITION_LIMITS.cellSteps,outputItems:ACQUISITION_LIMITS.outputItems}};
}

function outcome(proposal){
  const survivingIndices=[],meetingIndices=[],missingIndices=[];
  proposal.rows.forEach((row,index)=>{
    if(!row.candidate.surviving)return;
    survivingIndices.push(index);(row.meets?meetingIndices:missingIndices).push(index);
  });
  const status=!proposal.rows.length?'no-calibration-compatible-explanations':!survivingIndices.length?'family-challenged':!missingIndices.length?'all-uncontradicted-meet':!meetingIndices.length?'all-uncontradicted-miss':'unresolved';
  return {status,survivingIndices,meetingIndices,missingIndices,survivingCount:survivingIndices.length,meetingCount:meetingIndices.length,missingCount:missingIndices.length};
}

function calibrationView(row){
  const copy=structuredClone(row);
  delete copy.candidate.challenge;delete copy.candidate.surviving;
  if(copy.candidate.rainfall)delete copy.candidate.rainfall.challenge;
  return JSON.stringify(copy);
}

function prepareReceipt(originalText,menuText,receipt,collectionText){
  const raw=originalJSON(originalText,ORIGINAL_LIMIT,'Original proposal');
  const menu=originalJSON(menuText,MENU_LIMIT,'Acquisition menu');
  const collections=collectionText===null?null:originalJSON(collectionText,MENU_LIMIT,'Acquisition collections');
  const forecastWork=collections===null?estimateMechanismAcquisitionWork(originalText,menu):estimateMechanismAcquisitionCollectionsWork(originalText,menu,collections);
  const singleWork=collections===null?forecastWork:forecastWork.singleReadout;
  const {selected,readings,selectedChoice}=selectedOffers(menu,collections,receipt,originalText,menuText,collectionText);
  const {received,receivedRecords,precision}=appendChallenges(raw,selected,readings);
  const receivedOriginalText=JSON.stringify(received,null,2)+'\n';
  if(Buffer.byteLength(receivedOriginalText,'utf8')>ORIGINAL_LIMIT)throw Error('The complete received original investigation exceeds4MiB.');
  const work=reserveReceipt(forecastWork,singleWork,received,selected.length);
  return {menu,collections,selected,readings,selectedChoice,receivedOriginalText,receivedRecords,precision,work};
}

/** Reserve the complete original receipt course without starting inference. */
export function estimateMechanismAcquisitionReceiptWork(originalText,menuText,receipt,collectionText=null){
  return prepareReceipt(originalText,menuText,receipt,collectionText).work;
}

/** Receive actual declared challenges; preserve originals and frozen calibration. */
export function receiveMechanismAcquisition(originalText,menuText,receipt,collectionText=null){
  const {menu,collections,selected,readings,selectedChoice,receivedOriginalText,receivedRecords,precision,work}=prepareReceipt(originalText,menuText,receipt,collectionText);
  // Both full courses are reserved before this first inference. No cached
  // caller result, inferred observed value or export helper is used.
  const forecast=collections===null?planMechanismAcquisition(originalText,menu):planMechanismAcquisitionCollections(originalText,menu,collections);
  const singleReport=collections===null?forecast:forecast.singleReadoutReport;
  const optionResults=new Map(singleReport.options.map(option=>[option.offer.id,option]));
  if(selected.some(offer=>optionResults.get(offer.id).status==='excluded'))throw Error('A selected acquisition is excluded by the original planning admission; no received investigation is returned.');
  const receivedProposal=importMechanismProposal(receivedOriginalText).result;
  if(receivedProposal.rows.length!==singleReport.proposal.rows.length||receivedProposal.rows.some((row,index)=>calibrationView(row)!==calibrationView(singleReport.proposal.rows[index])))throw Error('Held-aside receipt changed the original calibration family or proposal outcomes.');
  const baselineOutcome=outcome(singleReport.proposal),receivedOutcome=outcome(receivedProposal),surviving=new Set(receivedOutcome.survivingIndices);
  const newlyContradictedCandidateIndices=baselineOutcome.survivingIndices.filter(index=>!surviving.has(index));
  // Retain every supplied receipt field, with member order canonicalized to the
  // selected declaration. The CLI separately identifies the original file bytes.
  const retainedReceipt={...structuredClone(receipt),readings:selected.map(offer=>({optionId:offer.id,reading:structuredClone(readings.get(offer.id))}))};
  return {receivedOriginalText,report:{schema:ACQUISITION_RECEIVED_SCHEMA,eventRef:menu.eventRef,selectedChoice,receipt:retainedReceipt,forecast,baselineOutcome,receivedOutcome,receivedProposal,receivedRecords,precision,receiptTiming:{receivedMinute:receipt.receivedMinute,decisionMinute:menu.decisionMinute,receivedByDecision:receipt.receivedMinute<=menu.decisionMinute},newlyContradictedCandidateIndices,work,
    meaning:'Actual supplied readings challenge the same complete finite calibration family using their own declared uncertainty and maintained scoring guards. All original rows, target labels, calibration roles, prior challenges and transfer assumptions remain. The separate uncontradicted subset is conditional on the supplied family and valid simultaneous actual error bounds; it does not replace the original whole-family target result or establish a physical model. Zero survivors is a family challenge, not a target verdict. Wider actual uncertainty can defeat planned separation; late receipt cannot answer an earlier decision. Source identities and measurement coordinates bind this receipt computationally; event association, access, timing and physical accuracy remain declarations. Two complete inference/proposal courses are explicitly reserved. No automatic measurement, calibration promotion, search, instrument operation or adopted site change follows.'}};
}
