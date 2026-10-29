import {checkShadeHeatBytes} from './shade-heat.js';
import {prepareSkyChangeSource,inspectSkyChangeWork,SKY_CHANGE_MODEL,SKY_CHANGE_LIMITS} from './shade-heat-sky-change-course.js';
import {exactSkyKeys,sameSkyData,originalSkyReadingTimes} from './shade-heat-timed-reading-source.js';
import {createOriginalSkyChangeBasis} from './shade-heat-sky-change-kernel.js';
import {conditionMinimumSkyConsequence} from './shade-heat-sky-conditional.js';
import {parseSkyAllowanceText,skyAllowanceFractionText} from './shade-heat-sky-allowance.js';
import {profileFraction} from './shade-heat-profile-band.js';
import {rational as q,add,sub,cmp} from './vendor/chronos/exact-halfplanes.mjs';

export const SKY_CONDITIONAL_KIND='experimental-earth/conditional-sky-consequence-inputs/1';
export const SKY_CONDITIONAL_MODEL=Object.freeze({name:'conditioned-original-clock-sky-consequence',version:1,
 inference:SKY_CHANGE_MODEL.name,observation:SKY_CHANGE_MODEL.observation,profiles:SKY_CHANGE_MODEL.profiles,coefficient:SKY_CHANGE_MODEL.coefficient,
 target:'two original receiver, original clock endpoint and surface or lower-store requirements, one exact fixed nonnegative Celsius allowance, and a third declared paired consequence',
 requirement:'at-most constrains the entire represented interval by its upper endpoint; at-least constrains the entire interval by its lower endpoint; equality is included',
 result:'condition every original minimum-compatible pattern on both selected requirements; retain every excluded pattern and every closed consequence interval, exact union component, gap and attaining tie',
 qualification:'complete original combination screens, original-polytope requirement-order proofs, conditioned feasibility or Farkas certificates, conditioned consequence-order and separate lower and upper optimality certificates, and two separate original numerical profile replays per surviving pattern',
 limitation:'a conditional represented-model question; no new observation, class promotion, fitted tolerance, probability, physical attainability or continuous-time guarantee'});
export const SKY_CONDITIONAL_COURSE_LIMITS=Object.freeze({...SKY_CHANGE_LIMITS,maxRequirements:2,
 maxWitnessProfiles:2*SKY_CHANGE_LIMITS.maxWitnessProfiles,maxWitnessCourses:2*SKY_CHANGE_LIMITS.maxWitnessCourses,
 maxThermalCourses:SKY_CHANGE_LIMITS.maxDistinctBasisCourses+2*SKY_CHANGE_LIMITS.maxWitnessCourses,
 maxCourseIntervals:(SKY_CHANGE_LIMITS.maxDistinctBasisCourses+2*SKY_CHANGE_LIMITS.maxWitnessCourses)*SKY_CHANGE_LIMITS.maxIntervals,
 maxReplayEndpointRows:2*SKY_CHANGE_LIMITS.maxReplayEndpointRows,maxObservationReplayRows:2*SKY_CHANGE_LIMITS.maxObservationReplayRows});
const originalQuery=query=>({bins:query.bins,maximumChanges:query.maximumChanges,sharingSource:query.sharingSource,searchSource:query.searchSource});
const exact=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
const serialize=value=>JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item));
const dense=(value,length)=>Array.isArray(value)&&value.length===length&&Array.from({length},(_,i)=>Object.hasOwn(value,i)).every(Boolean);
const meets=(relation,pair,limit)=>relation==='at-most'?cmp(pair.upper,limit)<=0:cmp(pair.lower,limit)>=0;
const adjusted=(choice,allowance)=>choice.relation==='at-most'?add(q(choice.differenceC),allowance):sub(q(choice.differenceC),allowance);
function reserve(source){
 const parent=inspectSkyChangeWork(source.readings,originalQuery(source.query)),profiles=2*parent.reservedWitnessProfiles;
 const witnessCourses=profiles*parent.uniqueSources*4,thermalCourses=parent.reservedDistinctBasisCourses+witnessCourses;
 const work={...parent,reservedWitnessProfiles:profiles,reservedWitnessCourses:witnessCourses,reservedThermalCourses:thermalCourses,
  reservedCourseIntervals:thermalCourses*parent.intervals,reservedReplayEndpointRows:profiles*parent.uniqueSources*parent.originalBoundaries,
  reservedObservationReplayRows:profiles*source.readings.length,reservedRequirementReplayRows:2*profiles,reservedConsequenceReplayRows:profiles,
  reservedAdditionalSolvesPerCompatiblePattern:4,reservedAdditionalObjectivesPerCompatiblePattern:5,
  reservedConditionalOrderSolves:parent.reservedWitnessProfiles,reservedLowerSolves:parent.reservedWitnessProfiles,reservedUpperSolves:parent.reservedWitnessProfiles};
 if(profiles>SKY_CONDITIONAL_COURSE_LIMITS.maxWitnessProfiles||witnessCourses>SKY_CONDITIONAL_COURSE_LIMITS.maxWitnessCourses||thermalCourses>SKY_CONDITIONAL_COURSE_LIMITS.maxThermalCourses
  ||work.reservedCourseIntervals>SKY_CONDITIONAL_COURSE_LIMITS.maxCourseIntervals||work.reservedReplayEndpointRows>SKY_CONDITIONAL_COURSE_LIMITS.maxReplayEndpointRows
  ||work.reservedObservationReplayRows>SKY_CONDITIONAL_COURSE_LIMITS.maxObservationReplayRows)throw Error('The complete conditional consequence exceeds its aggregate allowance');
 return work;
}
function admitLocation(choice,parent,requirement){
 const names=requirement?['receiverReadingIndex','utc','store','relation','differenceC','source']:['receiverReadingIndex','utc','store','source'];
 if(!exactSkyKeys(choice,names)||!Number.isInteger(choice.receiverReadingIndex)||choice.receiverReadingIndex<0||choice.receiverReadingIndex>=parent.readings.length
  ||!['surfaceC','subsurfaceC'].includes(choice.store)||typeof choice.utc!=='string'
  ||!originalSkyReadingTimes(parent.readings[choice.receiverReadingIndex].source).some(row=>row.utc===choice.utc)
  ||typeof choice.source!=='string'||!choice.source.trim()||choice.source.length>400
  ||(requirement&&(!['at-most','at-least'].includes(choice.relation)||!Number.isFinite(choice.differenceC))))
  throw Error('Each declared consequence needs an original receiver, unchanged clock endpoint, temperature component and source; requirements also need a whole-interval relation and finite threshold');
}
export function prepareSkyConditionalSource(originals,query){
 if(!exactSkyKeys(query,['bins','maximumChanges','sharingSource','searchSource','requirements','allowanceC','consequence'])||!dense(query.requirements,2))
  throw Error('Declare both original requirements, one exact allowance and the third original-clock consequence');
 const parent=prepareSkyChangeSource(originals,originalQuery(query)),allowance=parseSkyAllowanceText(query.allowanceC);
 for(const choice of query.requirements){admitLocation(choice,parent,true);adjusted(choice,allowance);}
 admitLocation(query.consequence,parent,false);
 const source={kind:SKY_CONDITIONAL_KIND,model:{...SKY_CONDITIONAL_MODEL},readings:parent.readings,
  query:{...parent.query,requirements:structuredClone(query.requirements),allowanceC:skyAllowanceFractionText(allowance),consequence:structuredClone(query.consequence)}};
 checkShadeHeatBytes(new Blob([JSON.stringify(source)]).size);reserve(source);return source;
}
function evaluate(investigation){
 const admitted=reserve(investigation),representatives=admitted.sources.map(s=>s.recordIndex),allowance=parseSkyAllowanceText(investigation.query.allowanceC);
 const bases=representatives.map(i=>createOriginalSkyChangeBasis(investigation.readings[i])),originalTimes=bases[0].originalTimes;
 if(bases.some(b=>!sameSkyData(b.originalTimes,originalTimes))||!sameSkyData(originalTimes,originalSkyReadingTimes(investigation.readings[0].source)))
  throw Error('Every receiver must retain the identical complete original clock');
 const locations=investigation.readings.map((input,i)=>{
  const reading=input.query.reading,originalIndex=originalTimes.findIndex(t=>t.utc===reading.utc);
  if(originalIndex<0)throw Error('An original observation is absent from its unchanged clock');
  return{sourceIndex:admitted.recordSourceIndices[i],originalIndex,utc:reading.utc,store:reading.store};
 });
 const observed=locations.map(at=>bases[at.sourceIndex].observationRow(at.originalIndex,at.store));
 const bands=investigation.readings.map(input=>({lower:sub(q(input.query.reading.temperatureC),q(input.query.reading.halfWidthC)),upper:add(q(input.query.reading.temperatureC),q(input.query.reading.halfWidthC))}));
 const locate=choice=>{
  const sourceIndex=admitted.recordSourceIndices[choice.receiverReadingIndex],originalIndex=originalTimes.findIndex(t=>t.utc===choice.utc);
  return {...choice,sourceIndex,representativeReadingIndex:representatives[sourceIndex],originalIndex,
   cellIndex:investigation.readings[choice.receiverReadingIndex].query.reading.cellIndex};
 };
 const requirements=investigation.query.requirements.map((choice,requirementIndex)=>({...locate(choice),requirementIndex,
  limitC:profileFraction(q(choice.differenceC)),selectedLimitC:profileFraction(adjusted(choice,allowance))}));
 const consequence=locate(investigation.query.consequence);
 const targets=requirements.map(choice=>({relation:choice.relation,limit:q(choice.differenceC),...bases[choice.sourceIndex].consequenceRows(choice.originalIndex,choice.store)}));
 const consequenceRows=bases[consequence.sourceIndex].consequenceRows(consequence.originalIndex,consequence.store);
 const result=conditionMinimumSkyConsequence(observed,bands,targets,allowance,consequenceRows,{maximumChanges:investigation.query.maximumChanges}),analysis=result.analysis;
 const patterns=[],alternatives=[];
 function replayExtreme(patternIndex,splits,entry,role){
  const profile=entry.witness;
  const replays=bases.map((basis,index)=>({sourceIndex:index,representativeReadingIndex:representatives[index],
   cellIndex:investigation.readings[representatives[index]].query.reading.cellIndex,...basis.replay(splits,profile.phaseProfiles,SKY_CONDITIONAL_COURSE_LIMITS.numericalConsistencyScreenC)}));
  const observations=locations.map((at,recordIndex)=>{
   const reading=investigation.readings[recordIndex].query.reading,row=replays[at.sourceIndex].originalCourse[at.originalIndex];
   if(row.utc!==reading.utc||cmp(exact(row.additiveC.existing.lower[reading.store]),profile.observedC[recordIndex]))throw Error('A conditional extreme lost its original observation identity');
   const originalC=Object.fromEntries(['lower','upper'].map(end=>[end,row.originalC.existing[end][reading.store]]));
   return {recordIndex,cellIndex:reading.cellIndex,...at,additiveC:profileFraction(profile.observedC[recordIndex]),originalC,
    endpointStatus:Object.fromEntries(['lower','upper'].map(end=>[end,cmp(q(originalC[end]),bands[recordIndex].lower)>=0&&cmp(q(originalC[end]),bands[recordIndex].upper)<=0?'within-original-band':'outside-original-band']))};
  });
  function paired(choice){
   const row=replays[choice.sourceIndex].originalCourse[choice.originalIndex],store=choice.store;
   if(row.utc!==choice.utc)throw Error('A conditional profile lost its original target clock');
   return {represented:{lower:sub(exact(row.additiveC.proposal.lower[store]),exact(row.additiveC.existing.upper[store])),
    upper:sub(exact(row.additiveC.proposal.upper[store]),exact(row.additiveC.existing.lower[store]))},
    numerical:{lower:sub(q(row.originalC.proposal.lower[store]),q(row.originalC.existing.upper[store])),
    upper:sub(q(row.originalC.proposal.upper[store]),q(row.originalC.existing.lower[store]))}};
  }
  const values=requirements.map(choice=>{
   const {represented,numerical}=paired(choice),expected=profile.requirementPairs[choice.requirementIndex],selectedLimit=adjusted(choice,allowance);
   if(cmp(represented.lower,expected.lower)||cmp(represented.upper,expected.upper)||cmp(represented.lower,represented.upper)>0)
    throw Error('A conditional extreme lost its exact original requirement binding');
   const representedStatus=meets(choice.relation,represented,q(choice.differenceC))?'met':'not-met',selectedRepresentedStatus=meets(choice.relation,represented,selectedLimit)?'met':'not-met';
   if(representedStatus!==profile.originalRequirementStatuses[choice.requirementIndex]||selectedRepresentedStatus!==profile.selectedRequirementStatuses[choice.requirementIndex]||selectedRepresentedStatus!=='met')
    throw Error('Each conditional extreme must satisfy both selected requirements on the same original profile');
   return {requirementIndex:choice.requirementIndex,originalLimitC:profileFraction(q(choice.differenceC)),selectedLimitC:profileFraction(selectedLimit),
    representedPairC:Object.fromEntries(Object.entries(represented).map(([key,value])=>[key,profileFraction(value)])),representedStatus,selectedRepresentedStatus,
    originalNumericalPairC:Object.fromEntries(Object.entries(numerical).map(([key,value])=>[key,profileFraction(value)])),
    originalNumericalStatus:meets(choice.relation,numerical,q(choice.differenceC))?'met':'not-met',
    selectedOriginalNumericalStatus:meets(choice.relation,numerical,selectedLimit)?'met':'not-met'};
  });
  const {represented,numerical}=paired(consequence);
  if(cmp(represented.lower,profile.consequencePair.lower)||cmp(represented.upper,profile.consequencePair.upper)||cmp(represented[role],entry.value)||cmp(represented.lower,represented.upper)>0)
   throw Error('A conditional extreme lost its declared third consequence or attained endpoint');
  return {patternIndex,role,valueC:profileFraction(entry.value),allowanceC:profileFraction(allowance),requiredRelaxationC:profileFraction(profile.requiredRelaxation),
   phaseProfiles:profile.phaseProfiles.map(p=>p.map(profileFraction)),productMasses:profile.productMasses.map(profileFraction),
   observedC:profile.observedC.map(profileFraction),requirements:values,originalObservations:observations,originalReplays:replays,
   consequenceRepresentedPairC:Object.fromEntries(Object.entries(represented).map(([key,value])=>[key,profileFraction(value)])),
   consequenceOriginalNumericalPairC:Object.fromEntries(Object.entries(numerical).map(([key,value])=>[key,profileFraction(value)]))};
 }
 for(const [patternIndex,item]of analysis.cases.entries()){
  const splitUtcs=item.splits.map(i=>originalTimes[i].utc);
  const numericalScreens=bases.map((basis,index)=>({sourceIndex:index,representativeReadingIndex:representatives[index],
   ...basis.screenPattern(item.splits,locations.filter(at=>at.sourceIndex===index),SKY_CONDITIONAL_COURSE_LIMITS.numericalConsistencyScreenC)}));
  patterns.push({patternIndex,changes:item.splits.length,splitAfterIntervals:[...item.splits],splitUtcs,
   compatibility:item.status==='feasible'?'compatible':'incompatible',exactProofIndex:patternIndex,numericalScreens});
  if(item.status!=='feasible')continue;
  const entry=result.cases.find(c=>c.patternIndex===patternIndex);
  if(!entry)throw Error('An original-compatible minimum pattern lost its conditioned result');
  alternatives.push({patternIndex,splitAfterIntervals:[...item.splits],splitUtcs,conditionalStatus:entry.status==='feasible'?'compatible':'incompatible',
   originalRequirementMaximumLowerMinusUpperC:entry.requirementOrder.tests.map(t=>profileFraction(t.maximumDifference)),
   conditionedMaximumLowerMinusUpperC:entry.conditionedOrder===null?null:profileFraction(entry.conditionedOrder.maximumDifference),
   rangeC:entry.range===null?null:{lower:profileFraction(entry.range.lower),upper:profileFraction(entry.range.upper)},
   lowerAttainsGlobalMinimum:result.lowerAttainingPatternIndices.includes(patternIndex),upperAttainsGlobalMaximum:result.upperAttainingPatternIndices.includes(patternIndex),
   extremes:entry.status==='feasible'?{lower:replayExtreme(patternIndex,item.splits,entry.lower,'lower'),upper:replayExtreme(patternIndex,item.splits,entry.upper,'upper')}:null});
 }
 const perSource=bases.map(b=>b.work()),sum=key=>perSource.reduce((total,row)=>total+row[key],0),profiles=2*result.conditionalPatternIndices.length;
 const executedBasisCourses=sum('executedBasisCourses'),executedWitnessCourses=sum('executedWitnessCourses');
 const work={...admitted,perSource,executedBasisCourses,executedWitnessCourses,executedThermalCourses:executedBasisCourses+executedWitnessCourses,
  executedCourseIntervals:(executedBasisCourses+executedWitnessCourses)*admitted.intervals,reusedCompleteCourses:sum('reusedCompleteCourses'),
  combinationStatesScreened:sum('combinationStatesScreened'),actualWitnessProfiles:profiles,actualReplayEndpointRows:profiles*admitted.uniqueSources*originalTimes.length,
  actualObservationReplayRows:profiles*investigation.readings.length,actualRequirementReplayRows:2*profiles,actualConsequenceReplayRows:profiles,
  exactSolves:result.work.solves,exactObjectives:result.work.objectives,exactRequirementOrderSolves:result.work.requirementOrderSolves,
  exactConditionalOrderSolves:result.work.conditionalOrderSolves,exactLowerSolves:result.work.lowerSolves,exactUpperSolves:result.work.upperSolves,
  linearPivots:result.work.pivots,linearRationalOperations:result.work.rationalOperations,actualSkyFaceTests:sum('actualSkyFaceTests')};
 if(executedBasisCourses>admitted.reservedDistinctBasisCourses||executedWitnessCourses!==profiles*admitted.uniqueSources*4
  ||work.executedThermalCourses>admitted.reservedThermalCourses||work.executedCourseIntervals>admitted.reservedCourseIntervals
  ||profiles>admitted.reservedWitnessProfiles||work.actualReplayEndpointRows>admitted.reservedReplayEndpointRows||work.actualObservationReplayRows>admitted.reservedObservationReplayRows
  ||work.actualRequirementReplayRows>admitted.reservedRequirementReplayRows||work.actualConsequenceReplayRows>admitted.reservedConsequenceReplayRows
  ||work.exactConditionalOrderSolves>admitted.reservedConditionalOrderSolves||work.exactLowerSolves>admitted.reservedLowerSolves||work.exactUpperSolves>admitted.reservedUpperSolves
  ||work.linearPivots>admitted.reservedLinearPivots||work.linearRationalOperations>admitted.reservedLinearRationalOperations
  ||perSource.some(row=>row.maximumCacheEntries>admitted.reservedCacheEntriesPerReceiver||row.patternsScreened!==patterns.length))
  throw Error('The complete conditional consequence exceeded its admitted work');
 return {status:'compared',model:{...SKY_CONDITIONAL_MODEL},query:structuredClone(investigation.query),requirements,consequence,
  allowanceC:profileFraction(allowance),compatibility:analysis.status,minimumChanges:analysis.minimumChanges,conditionalStatus:result.status,
  conditionalPatternIndices:[...result.conditionalPatternIndices],conditionalExcludedPatternIndices:[...result.conditionalExcludedPatternIndices],
  hullC:result.hull===null?null:{lower:profileFraction(result.hull.lower),upper:profileFraction(result.hull.upper)},
  lowerAttainingPatternIndices:[...result.lowerAttainingPatternIndices],upperAttainingPatternIndices:[...result.upperAttainingPatternIndices],
  components:result.components.map(c=>({lower:profileFraction(c.lower),upper:profileFraction(c.upper),patternIndices:[...c.patternIndices],
   lowerAttainingPatternIndices:[...c.lowerAttainingPatternIndices],upperAttainingPatternIndices:[...c.upperAttainingPatternIndices]})),
  gaps:result.gaps.map(g=>({lower:profileFraction(g.lower),upper:profileFraction(g.upper),lowerIncluded:false,upperIncluded:false})),
  originalTimes,patterns,alternatives,totalDeclaredPatterns:analysis.totalDeclaredPatterns,unexaminedHigherChangePatterns:analysis.unexaminedHigherChangePatterns,
  readings:investigation.readings.map((input,i)=>({...input.query.reading,...locations[i],originalBins:input.query.bins,activeCommonBins:4,
   bandC:{lower:profileFraction(bands[i].lower),upper:profileFraction(bands[i].upper)}})),
  exactEvidence:{fractionEncoding:'two decimal integer strings [numerator, positive denominator]',
   coordinateOrder:'three nonzero-bin masses for each chronological epoch; bin zero is the exact complement; every conditional objective uses the unchanged original coordinates with exactly two selected requirement rows appended',
   observedIntervalRows:observed,bands,requirementIntervalRows:targets,consequenceIntervalRows:consequenceRows,result},
  numericalEvidence:{consistencyScreenC:SKY_CONDITIONAL_COURSE_LIMITS.numericalConsistencyScreenC,
   sourceBases:bases.map((basis,index)=>({sourceIndex:index,representativeReadingIndex:representatives[index],
    cellIndex:investigation.readings[representatives[index]].query.reading.cellIndex,...basis.numericalBasis()})),
   scope:'Every examined original pattern retains its complete original one-bin combination screens. Every conditionally compatible minimum pattern has two separately replayed profiles across all original receivers and endpoints, one attaining its lower consequence and one its upper. Each exact profile satisfies both selected requirements. Numerical requirement and observation statuses are retained separately. An exact represented certificate does not turn a finite numerical screen into a uniform or physical bound.'},
  diagnostics:bases.map(b=>b.diagnostics()),work,
  semantics:'Original observations determine the complete minimum change class once, before the two requirements and fixed allowance are applied. '
   +'The same nonnegative Celsius allowance raises each at-most threshold and lowers each at-least threshold. Both whole-interval requirements constrain one common original profile at once, with equality included. '
   +'Every original-compatible minimum pattern remains visible, including a conditioned Farkas exclusion. An empty conditioned family never promotes the model to a higher-change class. '
   +'The third declared consequence keeps its original receiver, clock endpoint and temperature component. Its endpoint-order proof applies to the conditioned polytope; both requirement intervals remain ordered on the original polytopes. '
   +'Each surviving pattern has a closed interval from its minimum lower endpoint to its maximum upper endpoint. Its lower and upper attaining profiles remain distinct roles; each is separately replayed and satisfies both selected requirements. '
   +'Closed intervals merge only where they overlap or touch exactly. Every positive gap remains open and visible; the outer hull does not create a profile inside a gap. A contributing pattern need not span its whole merged component. All global and component endpoint ties are retained. '
   +'Original-empty and conditional-empty are different unevaluated outcomes, neither a zero consequence. The fixed allowance is a query input, not an optimized result or new observation. Changing it requires a fresh bounded computation. '
   +'Original numerical replays and exact represented statuses remain separate. This is not a physical attainability claim, noise estimate, probability, permission to adopt relaxed limits or continuous-time guarantee.'};
}
export function prepareSkyConditionalEvidence(originals,query){
 const investigation=prepareSkyConditionalSource(originals,query),report=serialize(evaluate(investigation));
 if(new Blob([JSON.stringify({investigation,report})]).size>SKY_CONDITIONAL_COURSE_LIMITS.maxReportBytes)throw Error('The complete conditional consequence report exceeds its output allowance; no partial result is returned');
 return {investigation,report};
}
export function inspectSkyConditionalWork(originals,query){return reserve(prepareSkyConditionalSource(originals,query));}
export function parseSkyConditionalSource(text){
 if(typeof text!=='string')throw TypeError('Conditional sky consequence inputs must be JSON text');
 checkShadeHeatBytes(new Blob([text]).size);let raw;try{raw=JSON.parse(text);}catch{throw Error('Invalid conditional sky consequence JSON');}
 if(!exactSkyKeys(raw,['kind','model','readings','query'])||raw.kind!==SKY_CONDITIONAL_KIND||!sameSkyData(raw.model,SKY_CONDITIONAL_MODEL))throw Error('Unsupported conditional consequence source or saved calculated fields');
 return prepareSkyConditionalSource(raw.readings,raw.query);
}
export function parseSkyConditionalEvidence(text){const source=parseSkyConditionalSource(text);return prepareSkyConditionalEvidence(source.readings,source.query);}
export function serializeSkyConditionalSource(input){
 const source=parseSkyConditionalSource(JSON.stringify(input));let text=JSON.stringify(source,null,2)+'\n';
 try{checkShadeHeatBytes(new Blob([text]).size);}catch{text=JSON.stringify(source)+'\n';checkShadeHeatBytes(new Blob([text]).size);}return text;
}
