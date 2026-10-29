import {checkShadeHeatBytes} from './shade-heat.js';
import {prepareSkyChangeSource,inspectSkyChangeWork,SKY_CHANGE_MODEL,SKY_CHANGE_LIMITS} from './shade-heat-sky-change-course.js';
import {exactSkyKeys,sameSkyData,originalSkyReadingTimes} from './shade-heat-timed-reading-source.js';
import {createOriginalSkyChangeBasis} from './shade-heat-sky-change-kernel.js';
import {compareMinimumSkyCoverage} from './shade-heat-sky-coverage.js';
import {profileFraction} from './shade-heat-profile-band.js';
import {rational as q,add,sub,cmp} from './vendor/chronos/exact-halfplanes.mjs';

export const SKY_COVERAGE_KIND='experimental-earth/minimum-sky-coverage-inputs/1';
export const SKY_COVERAGE_MODEL=Object.freeze({name:'minimum-original-clock-sky-profile-coverage',version:1,
 inference:SKY_CHANGE_MODEL.name,observation:SKY_CHANGE_MODEL.observation,profiles:SKY_CHANGE_MODEL.profiles,coefficient:SKY_CHANGE_MODEL.coefficient,
 target:'exactly two original receiver, original clock endpoint and surface or lower-store requirements on proposal minus existing',
 requirement:'at-most constrains the entire represented interval by its upper endpoint; at-least constrains the entire interval by its lower endpoint; equality is included',
 result:'compare the smallest nonnegative Celsius relaxation permitting one original-compatible profile with the smallest amount covering every profile in the complete original minimum family; retain both signed requirement maxima and their separate profiles',
 qualification:'complete original combination screens, original-polytope interval-order proofs, existential augmented optimality proofs, original-polytope residual maximum certificates, all ties, and three separate original numerical profile replays per compatible pattern',
 limitation:'a conditional represented-model threshold question; no fitted noise, calibrated physical tolerance, permission to adopt relaxed limits, original-class promotion, probability or continuous-time guarantee'});
export const SKY_COVERAGE_LIMITS=Object.freeze({...SKY_CHANGE_LIMITS,maxRequirements:2,
 maxWitnessProfiles:3*SKY_CHANGE_LIMITS.maxWitnessProfiles,maxWitnessCourses:3*SKY_CHANGE_LIMITS.maxWitnessCourses,
 maxThermalCourses:SKY_CHANGE_LIMITS.maxDistinctBasisCourses+3*SKY_CHANGE_LIMITS.maxWitnessCourses,
 maxCourseIntervals:(SKY_CHANGE_LIMITS.maxDistinctBasisCourses+3*SKY_CHANGE_LIMITS.maxWitnessCourses)*SKY_CHANGE_LIMITS.maxIntervals,
 maxReplayEndpointRows:3*SKY_CHANGE_LIMITS.maxReplayEndpointRows,maxObservationReplayRows:3*SKY_CHANGE_LIMITS.maxObservationReplayRows});
const originalQuery=query=>({bins:query.bins,maximumChanges:query.maximumChanges,sharingSource:query.sharingSource,searchSource:query.searchSource});
const exact=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
const serialize=value=>JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item));
const dense=(value,length)=>Array.isArray(value)&&value.length===length&&Array.from({length},(_,i)=>Object.hasOwn(value,i)).every(Boolean);
const meets=(relation,pair,limit)=>relation==='at-most'?cmp(pair.upper,limit)<=0:cmp(pair.lower,limit)>=0;
function reserve(source){
 const parent=inspectSkyChangeWork(source.readings,originalQuery(source.query)),profiles=3*parent.reservedWitnessProfiles;
 const witnessCourses=profiles*parent.uniqueSources*4,thermalCourses=parent.reservedDistinctBasisCourses+witnessCourses;
 const work={...parent,reservedWitnessProfiles:profiles,reservedWitnessCourses:witnessCourses,reservedThermalCourses:thermalCourses,
  reservedCourseIntervals:thermalCourses*parent.intervals,reservedReplayEndpointRows:profiles*parent.uniqueSources*parent.originalBoundaries,
  reservedObservationReplayRows:profiles*source.readings.length,reservedRequirementSolvesPerCompatiblePattern:3,reservedObjectivesPerCompatiblePattern:5};
 if(profiles>SKY_COVERAGE_LIMITS.maxWitnessProfiles||witnessCourses>SKY_COVERAGE_LIMITS.maxWitnessCourses||thermalCourses>SKY_COVERAGE_LIMITS.maxThermalCourses
  ||work.reservedCourseIntervals>SKY_COVERAGE_LIMITS.maxCourseIntervals||work.reservedReplayEndpointRows>SKY_COVERAGE_LIMITS.maxReplayEndpointRows
  ||work.reservedObservationReplayRows>SKY_COVERAGE_LIMITS.maxObservationReplayRows)throw Error('The complete profile-coverage comparison exceeds its aggregate allowance');
 return work;
}
export function prepareSkyCoverageSource(originals,query){
 if(!exactSkyKeys(query,['bins','maximumChanges','sharingSource','searchSource','requirements'])||!dense(query.requirements,2))
  throw Error('Declare exactly two complete original-clock consequence requirements with the original search query');
 const parent=prepareSkyChangeSource(originals,originalQuery(query));
 for(const choice of query.requirements){
  if(!exactSkyKeys(choice,['receiverReadingIndex','utc','store','relation','differenceC','source'])
   ||!Number.isInteger(choice.receiverReadingIndex)||choice.receiverReadingIndex<0||choice.receiverReadingIndex>=parent.readings.length
   ||!['surfaceC','subsurfaceC'].includes(choice.store)||typeof choice.utc!=='string'
   ||!originalSkyReadingTimes(parent.readings[choice.receiverReadingIndex].source).some(row=>row.utc===choice.utc)
   ||!['at-most','at-least'].includes(choice.relation)||!Number.isFinite(choice.differenceC)
   ||typeof choice.source!=='string'||!choice.source.trim()||choice.source.length>400)
   throw Error('Each requirement needs an existing receiver, unchanged original UTC, temperature component, whole-interval relation, finite Celsius threshold and source');
 }
 const source={kind:SKY_COVERAGE_KIND,model:{...SKY_COVERAGE_MODEL},readings:parent.readings,query:{...parent.query,requirements:structuredClone(query.requirements)}};
 checkShadeHeatBytes(new Blob([JSON.stringify(source)]).size);reserve(source);return source;
}
function evaluate(investigation){
 const admitted=reserve(investigation),representatives=admitted.sources.map(s=>s.recordIndex);
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
 const requirements=investigation.query.requirements.map((choice,requirementIndex)=>{
  const sourceIndex=admitted.recordSourceIndices[choice.receiverReadingIndex],originalIndex=originalTimes.findIndex(t=>t.utc===choice.utc);
  return {...choice,requirementIndex,sourceIndex,representativeReadingIndex:representatives[sourceIndex],originalIndex,
   cellIndex:investigation.readings[choice.receiverReadingIndex].query.reading.cellIndex,limitC:profileFraction(q(choice.differenceC))};
 });
 const targets=requirements.map(choice=>({relation:choice.relation,limit:q(choice.differenceC),...bases[choice.sourceIndex].consequenceRows(choice.originalIndex,choice.store)}));
 const result=compareMinimumSkyCoverage(observed,bands,targets,{maximumChanges:investigation.query.maximumChanges}),minimum=result.minimum,analysis=minimum.analysis;
 const patterns=[],alternatives=[];
 function replayWitness(patternIndex,splits,entry,role,requirementIndex,allowance){
  const profile=entry.witness;
  const replays=bases.map((basis,index)=>({sourceIndex:index,representativeReadingIndex:representatives[index],
   cellIndex:investigation.readings[representatives[index]].query.reading.cellIndex,...basis.replay(splits,profile.phaseProfiles,SKY_COVERAGE_LIMITS.numericalConsistencyScreenC)}));
  const observations=locations.map((at,recordIndex)=>{
   const reading=investigation.readings[recordIndex].query.reading,row=replays[at.sourceIndex].originalCourse[at.originalIndex];
   if(row.utc!==reading.utc||cmp(exact(row.additiveC.existing.lower[reading.store]),profile.observedC[recordIndex]))throw Error('A requirement profile lost its original observation identity');
   const originalC=Object.fromEntries(['lower','upper'].map(end=>[end,row.originalC.existing[end][reading.store]]));
   return {recordIndex,cellIndex:reading.cellIndex,...at,additiveC:profileFraction(profile.observedC[recordIndex]),originalC,
    endpointStatus:Object.fromEntries(['lower','upper'].map(end=>[end,cmp(q(originalC[end]),bands[recordIndex].lower)>=0&&cmp(q(originalC[end]),bands[recordIndex].upper)<=0?'within-original-band':'outside-original-band']))};
  });
  const values=requirements.map(choice=>{
   const row=replays[choice.sourceIndex].originalCourse[choice.originalIndex],store=choice.store;
   if(row.utc!==choice.utc)throw Error('A requirement profile lost its original target clock');
   const represented={lower:sub(exact(row.additiveC.proposal.lower[store]),exact(row.additiveC.existing.upper[store])),
    upper:sub(exact(row.additiveC.proposal.upper[store]),exact(row.additiveC.existing.lower[store]))};
   const expected=profile.targetPairs[choice.requirementIndex];
   if(cmp(represented.lower,expected.lower)||cmp(represented.upper,expected.upper)||cmp(represented.lower,represented.upper)>0)
    throw Error('A requirement profile lost its exact paired consequence binding');
   const representedStatus=meets(choice.relation,represented,q(choice.differenceC))?'met':'not-met';
   if(representedStatus!==profile.requirementStatuses[choice.requirementIndex])throw Error('The replay changed its exact whole-interval requirement status');
   const relaxedLimit=choice.relation==='at-most'?add(q(choice.differenceC),allowance):sub(q(choice.differenceC),allowance);
   const relaxedRepresentedStatus=meets(choice.relation,represented,relaxedLimit)?'met':'not-met';
   if(relaxedRepresentedStatus!=='met')throw Error('A retained profile fails its designated exact common relaxed allowance');
   const numerical={lower:sub(q(row.originalC.proposal.lower[store]),q(row.originalC.existing.upper[store])),
    upper:sub(q(row.originalC.proposal.upper[store]),q(row.originalC.existing.lower[store]))};
   return {requirementIndex:choice.requirementIndex,originalLimitC:profileFraction(q(choice.differenceC)),relaxedLimitC:profileFraction(relaxedLimit),
    representedPairC:Object.fromEntries(Object.entries(represented).map(([key,value])=>[key,profileFraction(value)])),representedStatus,relaxedRepresentedStatus,
    originalNumericalPairC:Object.fromEntries(Object.entries(numerical).map(([key,value])=>[key,profileFraction(value)])),
    originalNumericalStatus:meets(choice.relation,numerical,q(choice.differenceC))?'met':'not-met',
    relaxedOriginalNumericalStatus:meets(choice.relation,numerical,relaxedLimit)?'met':'not-met'};
  });
  return {patternIndex,role,requirementIndex,allowanceC:profileFraction(allowance),requiredRelaxationC:profileFraction(profile.requiredRelaxation),
   maximumViolationC:role==='requirement-maximum'?profileFraction(entry.maximumViolation):null,
   phaseProfiles:profile.phaseProfiles.map(p=>p.map(profileFraction)),productMasses:profile.productMasses.map(profileFraction),
   observedC:profile.observedC.map(profileFraction),requirements:values,originalObservations:observations,originalReplays:replays};
 }
 for(const [patternIndex,item]of analysis.cases.entries()){
  const splitUtcs=item.splits.map(i=>originalTimes[i].utc);
  const numericalScreens=bases.map((basis,index)=>({sourceIndex:index,representativeReadingIndex:representatives[index],
   ...basis.screenPattern(item.splits,locations.filter(at=>at.sourceIndex===index),SKY_COVERAGE_LIMITS.numericalConsistencyScreenC)}));
  patterns.push({patternIndex,changes:item.splits.length,splitAfterIntervals:[...item.splits],splitUtcs,
   compatibility:item.status==='feasible'?'compatible':'incompatible',exactProofIndex:patternIndex,numericalScreens});
  if(item.status!=='feasible')continue;
  const entry=result.cases.find(c=>c.patternIndex===patternIndex),some=minimum.cases.find(c=>c.patternIndex===patternIndex);
  if(!entry||!some)throw Error('An original-compatible minimum pattern lost its complete profile-coverage comparison');
  alternatives.push({patternIndex,splitAfterIntervals:[...item.splits],splitUtcs,
   maximumLowerMinusUpperC:some.endpointOrder.tests.map(t=>profileFraction(t.maximumDifference)),
   someProfileRelaxationC:profileFraction(some.relaxation.value),allProfileRelaxationC:profileFraction(entry.allProfileRelaxation),
   rawMaximumViolationC:profileFraction(entry.rawMaximumViolation),
   someProfileAttainsGlobalMinimum:minimum.attainingPatternIndices.includes(patternIndex),
   allProfileAttainsGlobalMaximum:result.allProfileAttainingPatternIndices.includes(patternIndex),
   rawMaximumRequirementIndices:[...entry.rawMaximumRequirementIndices],bindingRequirementIndices:[...entry.bindingRequirementIndices],
   floorActive:entry.floorActive,floorOnly:entry.floorOnly,
   someProfile:replayWitness(patternIndex,item.splits,some.relaxation,'some-profile',null,some.relaxation.value),
   maxima:entry.tests.map(t=>({requirementIndex:t.requirementIndex,maximumViolationC:profileFraction(t.maximumViolation),
    attainsGlobalRawMaximum:result.rawMaximumPairs.some(p=>p.patternIndex===patternIndex&&p.requirementIndex===t.requirementIndex),
    controlsAllProfileAmount:result.controllingPairs.some(p=>p.patternIndex===patternIndex&&p.requirementIndex===t.requirementIndex),
    witness:replayWitness(patternIndex,item.splits,t,'requirement-maximum',t.requirementIndex,result.allProfileRelaxation)}))});
 }
 const perSource=bases.map(b=>b.work()),sum=key=>perSource.reduce((total,row)=>total+row[key],0);
 const profiles=3*alternatives.length;
 const executedBasisCourses=sum('executedBasisCourses'),executedWitnessCourses=sum('executedWitnessCourses');
 const work={...admitted,perSource,executedBasisCourses,executedWitnessCourses,executedThermalCourses:executedBasisCourses+executedWitnessCourses,
  executedCourseIntervals:(executedBasisCourses+executedWitnessCourses)*admitted.intervals,reusedCompleteCourses:sum('reusedCompleteCourses'),
  combinationStatesScreened:sum('combinationStatesScreened'),actualWitnessProfiles:profiles,actualReplayEndpointRows:profiles*admitted.uniqueSources*originalTimes.length,
  actualObservationReplayRows:profiles*investigation.readings.length,exactSolves:result.work.solves,exactObjectives:result.work.objectives,
  exactOrderSolves:result.work.orderSolves,exactRelaxationSolves:result.work.relaxationSolves,
  exactCoverageSolves:result.work.coverageSolves,exactCoverageObjectives:result.work.coverageObjectives,
  linearPivots:result.work.pivots,linearRationalOperations:result.work.rationalOperations,actualSkyFaceTests:sum('actualSkyFaceTests')};
 if(executedBasisCourses>admitted.reservedDistinctBasisCourses||executedWitnessCourses!==profiles*admitted.uniqueSources*4
  ||work.executedThermalCourses>admitted.reservedThermalCourses||work.executedCourseIntervals>admitted.reservedCourseIntervals
  ||profiles>admitted.reservedWitnessProfiles||work.actualReplayEndpointRows>admitted.reservedReplayEndpointRows||work.actualObservationReplayRows>admitted.reservedObservationReplayRows
  ||work.linearPivots>admitted.reservedLinearPivots||work.linearRationalOperations>admitted.reservedLinearRationalOperations
  ||perSource.some(row=>row.maximumCacheEntries>admitted.reservedCacheEntriesPerReceiver||row.patternsScreened!==patterns.length))
  throw Error('The complete profile-coverage comparison exceeded its admitted work');
 return {status:'compared',model:{...SKY_COVERAGE_MODEL},query:structuredClone(investigation.query),requirements,
  compatibility:analysis.status,minimumChanges:analysis.minimumChanges,coverageStatus:result.status,
  someProfileRelaxationC:result.someProfileRelaxation===null?null:profileFraction(result.someProfileRelaxation),
  allProfileRelaxationC:result.allProfileRelaxation===null?null:profileFraction(result.allProfileRelaxation),
  rawMaximumViolationC:result.rawMaximumViolation===null?null:profileFraction(result.rawMaximumViolation),
  coverageGapC:result.coverageGap===null?null:profileFraction(result.coverageGap),
  someProfileAttainingPatternIndices:[...minimum.attainingPatternIndices],allProfileAttainingPatternIndices:[...result.allProfileAttainingPatternIndices],
  rawMaximumPairs:structuredClone(result.rawMaximumPairs),controllingPairs:structuredClone(result.controllingPairs),
  zeroCoverPatternIndices:[...result.zeroCoverPatternIndices],someProfileMeetsOriginal:minimum.originalRequirementsCompatible,
  allProfilesMeetOriginal:result.allProfilesMeetOriginal,floorActive:result.floorActive,floorOnly:result.floorOnly,
  originalTimes,patterns,alternatives,totalDeclaredPatterns:analysis.totalDeclaredPatterns,unexaminedHigherChangePatterns:analysis.unexaminedHigherChangePatterns,
  readings:investigation.readings.map((input,i)=>({...input.query.reading,...locations[i],originalBins:input.query.bins,activeCommonBins:4,
   bandC:{lower:profileFraction(bands[i].lower),upper:profileFraction(bands[i].upper)}})),
  exactEvidence:{fractionEncoding:'two decimal integer strings [numerator, positive denominator]',
   coordinateOrder:'three nonzero-bin masses for each chronological epoch; bin zero is the exact complement; only existential LP certificates append one final nonnegative Celsius relaxation coordinate; every residual maximum uses the unchanged original polytope and original coordinates',
   observedIntervalRows:observed,bands,requirementIntervalRows:targets,result},
  numericalEvidence:{consistencyScreenC:SKY_COVERAGE_LIMITS.numericalConsistencyScreenC,
   sourceBases:bases.map((basis,index)=>({sourceIndex:index,representativeReadingIndex:representatives[index],
    cellIndex:investigation.readings[representatives[index]].query.reading.cellIndex,...basis.numericalBasis()})),
   scope:'Every examined original pattern has all complete original one-bin combination screens. Every original-compatible minimum pattern has three separate replays across all original receivers and clock endpoints: its existential optimum, its requirement A maximizer, and its requirement B maximizer. Original and allowance-relaxed requirement statuses remain separate. The every-profile represented bound rests on complete exact optimality certificates, not these selected numerical replays. A finite numerical screen is not a uniform every-profile or physical error bound.'},
  diagnostics:bases.map(b=>b.diagnostics()),work,
  semantics:'Original observations determine the complete minimum change class before either requirement is applied. '
   +'One shared nonnegative Celsius amount raises every at-most limit and lowers every at-least limit. Whole-interval endpoints and equality retain their original meaning. '
   +'The one-profile amount is the minimum over all original-compatible profiles and patterns; the every-profile amount is the nonnegative maximum of both signed residual maxima over that entire original minimum family. '
   +'Every pattern retains its own existential optimum, both signed residual maxima, its clipped coverage bound and all exact ties. The one-profile amount never exceeds the every-profile amount. '
   +'Three separate profile roles remain distinct: one attaining this pattern\'s existential optimum and one attaining each requirement\'s maximum. The two residual maximizers need not coincide and are never presented as one worst common history. '
   +'An existential profile uses its own pattern\'s minimum allowance; either maximizing profile uses the global every-profile allowance. Their required relaxations and their original statuses remain visible. '
   +'If all signed maxima are negative, the nonnegative floor alone gives zero and no requirement pair is binding. Signed maxima equal to zero are exact contacts. Original-empty means neither amount nor either compatibility statement is assessed. '
   +'Original pattern identities and original-polytope witness membership remain intact. A proper convex hull of a common affine consequence set preserves linear maxima, but a hull point is not thereby an original-pattern profile. '
   +'Every retained profile is separately replayed across all original receivers and times. Exact and numerical statuses remain separate; original observation bands and declared thresholds stay unchanged. '
   +'Every means every profile in this represented original minimum family. This is not a fitted noise level, calibrated physical tolerance, recommendation to weaken limits, probability, physical realizability claim, correlated-uncertainty model or continuous-time guarantee.'};
}
export function prepareSkyCoverageEvidence(originals,query){
 const investigation=prepareSkyCoverageSource(originals,query),report=serialize(evaluate(investigation));
 if(new Blob([JSON.stringify({investigation,report})]).size>SKY_COVERAGE_LIMITS.maxReportBytes)throw Error('The complete profile-coverage report exceeds its output allowance; no partial result is returned');
 return {investigation,report};
}
export function inspectSkyCoverageWork(originals,query){return reserve(prepareSkyCoverageSource(originals,query));}
export function parseSkyCoverageSource(text){
 if(typeof text!=='string')throw TypeError('Original profile-coverage sky inputs must be JSON text');
 checkShadeHeatBytes(new Blob([text]).size);let raw;try{raw=JSON.parse(text);}catch{throw Error('Invalid original profile-coverage sky JSON');}
 if(!exactSkyKeys(raw,['kind','model','readings','query'])||raw.kind!==SKY_COVERAGE_KIND||!sameSkyData(raw.model,SKY_COVERAGE_MODEL))throw Error('Unsupported profile-coverage sky source or saved calculated fields');
 return prepareSkyCoverageSource(raw.readings,raw.query);
}
export function parseSkyCoverageEvidence(text){const source=parseSkyCoverageSource(text);return prepareSkyCoverageEvidence(source.readings,source.query);}
export function serializeSkyCoverageSource(input){
 const source=parseSkyCoverageSource(JSON.stringify(input));let text=JSON.stringify(source,null,2)+'\n';
 try{checkShadeHeatBytes(new Blob([text]).size);}catch{text=JSON.stringify(source)+'\n';checkShadeHeatBytes(new Blob([text]).size);}return text;
}
