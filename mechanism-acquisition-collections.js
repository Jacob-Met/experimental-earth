import {planMechanismAcquisition,estimateMechanismAcquisitionWork,ACQUISITION_LIMITS} from './mechanism-acquisition.js';

export const ACQUISITION_COLLECTION_MENU_SCHEMA='experimental-earth-mechanism-acquisition-collection-menu/1';
export const ACQUISITION_COLLECTION_REPORT_SCHEMA='experimental-earth-mechanism-acquisition-collections/1';
export const MAX_ACQUISITION_COLLECTIONS=64;
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const description=value=>typeof value==='string'&&value.trim().length>0&&value.length<=600;

function admitCollections(menu,declaration){
  if(!exact(declaration,['schema','eventRef','collections'])||declaration.schema!==ACQUISITION_COLLECTION_MENU_SCHEMA||declaration.eventRef!==menu.eventRef||!Array.isArray(declaration.collections)||declaration.collections.length<1||declaration.collections.length>MAX_ACQUISITION_COLLECTIONS)throw Error('Offer 1–64 explicit two-readout collections for the original acquisition event.');
  const optionIndex=new Map(menu.options.map((option,index)=>[option.id,index]));
  const ids=new Set(optionIndex.keys()),pairs=new Set(),collections=[];
  for(const offer of declaration.collections){
    if(!exact(offer,['id','optionIds','jointAvailabilityBasis'])||!description(offer.id)||ids.has(offer.id)||!description(offer.jointAvailabilityBasis)||!Array.isArray(offer.optionIds)||offer.optionIds.length!==2||Array.from(offer.optionIds).some(id=>typeof id!=='string'||!optionIndex.has(id))||offer.optionIds[0]===offer.optionIds[1])throw Error('Each distinct collection needs two distinct known option IDs and an explicit joint-availability basis.');
    const key=offer.optionIds.map(id=>optionIndex.get(id)).sort((a,b)=>a-b).join(':');
    if(pairs.has(key))throw Error('Offer each two-readout collection once; reversing member order does not create another collection.');
    ids.add(offer.id);pairs.add(key);collections.push(structuredClone(offer));
  }
  return collections;
}

function reserveCollections(singleReadout,optionCount,collectionCount){
  // Reserve every offered collection, even if a member is later excluded.
  // Four worst-case pair visits cover set construction, intersection, and the
  // complementary returned index lists. This is a work bound, not a CPU timer.
  const reservedCollectionMemberLookups=2*collectionCount;
  const reservedCollectionPairWork=4*collectionCount*singleReadout.reservedCrossTargetPairs;
  const reservedCollectionOutputItems=collectionCount*(4+singleReadout.reservedCrossTargetPairs)+optionCount;
  const combinedPairWork=singleReadout.reservedPairChecks+reservedCollectionMemberLookups+reservedCollectionPairWork;
  const combinedOutputItems=singleReadout.reservedOutputItems+reservedCollectionOutputItems;
  if(![reservedCollectionMemberLookups,reservedCollectionPairWork,reservedCollectionOutputItems,combinedPairWork,combinedOutputItems].every(Number.isSafeInteger)||combinedPairWork>ACQUISITION_LIMITS.pairChecks||combinedOutputItems>ACQUISITION_LIMITS.outputItems)throw Error('Complete single-readout plus collection work exceeds the acquisition budget; no collection prefix is evaluated.');
  return {singleReadout,reservedCollections:collectionCount,reservedCollectionMemberLookups,reservedCollectionPairWork,reservedCollectionOutputItems,combinedPairWork,combinedOutputItems,limits:{pairWork:ACQUISITION_LIMITS.pairChecks,outputItems:ACQUISITION_LIMITS.outputItems}};
}

/** Evaluate only declared jointly obtainable pairs; recompute original inputs once. */
export function planMechanismAcquisitionCollections(originalText,menu,declaration){
  // This first call validates and reserves only. It invokes no inference.
  const singleReservation=estimateMechanismAcquisitionWork(originalText,menu);
  const offers=admitCollections(menu,declaration),work=reserveCollections(singleReservation,menu.options.length,offers.length);
  // No caller-supplied cached result is accepted. Preserve this report intact.
  const singleReadoutReport=planMechanismAcquisition(originalText,menu);
  const members=new Map(singleReadoutReport.options.map(option=>[option.offer.id,option]));
  const pairCount=singleReadoutReport.crossTargetPairs.length,collections=[];
  for(const offer of offers){
    const selected=offer.optionIds.map(id=>members.get(id));
    const exclusionReasons=selected.filter(member=>member.status==='excluded').map(member=>({optionId:member.offer.id,reasons:[...member.exclusionReasons]}));
    if(exclusionReasons.length){collections.push({offer,status:'excluded',exclusionReasons});continue;}
    if(!pairCount){collections.push({offer,status:'not-needed',exclusionReasons:[]});continue;}
    // Joint rectangular bands overlap for an opposing pair only if both
    // component bands overlap. No statistical independence is assumed.
    const firstUnresolved=new Set(selected[0].unresolvedPairIndices);
    const unresolvedPairIndices=selected[1].unresolvedPairIndices.filter(index=>firstUnresolved.has(index));
    const unresolved=new Set(unresolvedPairIndices),separatedPairIndices=[];
    for(let index=0;index<pairCount;index++)if(!unresolved.has(index))separatedPairIndices.push(index);
    const allPairsSeparated=unresolvedPairIndices.length===0;
    collections.push({offer,status:allPairsSeparated?'separates-decision':'unresolved',exclusionReasons:[],separatedPairIndices,unresolvedPairIndices,allPairsSeparated});
  }
  const singles=singleReadoutReport.options.filter(option=>option.status==='separates-decision');
  const separatingCollections=collections.filter(collection=>collection.status==='separates-decision');
  const minimumOfferedReadoutCount=singles.length?1:separatingCollections.length?2:null;
  const minimumOfferedChoices=singles.length
    ?singles.map(option=>({kind:'single',id:option.offer.id,optionIds:[option.offer.id]}))
    :separatingCollections.map(collection=>({kind:'collection',id:collection.offer.id,optionIds:[...collection.offer.optionIds]}));
  const selectionStatus=!singleReadoutReport.proposal.rows.length?'no-compatible-explanations':!pairCount?'no-target-disagreement':minimumOfferedReadoutCount===null?'no-decision-separating-choice':'decision-separating-choices';
  return {schema:ACQUISITION_COLLECTION_REPORT_SCHEMA,status:singleReadoutReport.status==='evidence-challenged'?'evidence-challenged':selectionStatus,selectionStatus,singleReadoutReport,collections,decisionSeparatingCollectionIds:separatingCollections.map(collection=>collection.offer.id),minimumOfferedReadoutCount,minimumOfferedChoices,work,
    meaning:'Conditional finite-family identifiability from explicitly offered two-readout collections. The single-readout report, original hypotheses, target labels, bands and pair identities are unchanged. A pair is separated when either member separates it; unresolved sets intersect. Both declared component error bounds must hold simultaneously. Statistical independence is neither required nor established, and no probability of success follows. Joint availability is explicitly declared, not verified by individual availability or this calculation. Every offered collection remains visible, including exclusions and pairs that are not minimal. Minimum offered readout count is only among the offered separating singletons and collections, with original-order ties; it is not a cost ranking or global optimum. An excluded member excludes its whole collection. A joint readout outside every retained joint band challenges the family. No model refit, acquisition, instrument operation or adopted site change follows.'};
}
