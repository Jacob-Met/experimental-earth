import {checkShadeHeatBytes} from './shade-heat.js';
import {prepareSkyChangeSource,inspectSkyChangeWork,SKY_CHANGE_MODEL,SKY_CHANGE_LIMITS} from './shade-heat-sky-change-course.js';
import {exactSkyKeys,sameSkyData,originalSkyReadingTimes} from './shade-heat-timed-reading-source.js';
import {createOriginalSkyChangeBasis} from './shade-heat-sky-change-kernel.js';
import {rangeMinimumSkyChanges} from './shade-heat-sky-change-range.js';
import {profileFraction} from './shade-heat-profile-band.js';
import {rational as q,add,sub,cmp} from './vendor/chronos/exact-halfplanes.mjs';

export const SKY_CONSEQUENCE_KIND='experimental-earth/minimum-sky-consequence-inputs/1';
export const SKY_CONSEQUENCE_MODEL=Object.freeze({name:'minimum-original-clock-sky-consequence-intervals',version:1,
 inference:SKY_CHANGE_MODEL.name,observation:SKY_CHANGE_MODEL.observation,profiles:SKY_CHANGE_MODEL.profiles,
 coefficient:SKY_CHANGE_MODEL.coefficient,
 target:'one original receiver, original clock endpoint and surface or lower-store component; proposal minus existing',
 result:'exact lower/upper extrema over every compatible profile of every minimum-change pattern; separate interval components, gaps and tied attaining pattern identities',
 qualification:'complete original combination screens and separate original numerical replay of both extreme profiles for every compatible pattern; exact pointwise endpoint-order proof',
 limitation:'conditional represented-model enclosures, not physical realizability, probability, a unique sky history, a continuous-time guarantee or one simultaneous extreme trajectory'});
export const SKY_CONSEQUENCE_LIMITS=Object.freeze({...SKY_CHANGE_LIMITS,maxTargets:1,
 maxWitnessProfiles:2*SKY_CHANGE_LIMITS.maxWitnessProfiles,maxWitnessCourses:2*SKY_CHANGE_LIMITS.maxWitnessCourses,
 maxThermalCourses:SKY_CHANGE_LIMITS.maxDistinctBasisCourses+2*SKY_CHANGE_LIMITS.maxWitnessCourses,
 maxCourseIntervals:(SKY_CHANGE_LIMITS.maxDistinctBasisCourses+2*SKY_CHANGE_LIMITS.maxWitnessCourses)*SKY_CHANGE_LIMITS.maxIntervals,
 maxReplayEndpointRows:2*SKY_CHANGE_LIMITS.maxReplayEndpointRows,maxObservationReplayRows:2*SKY_CHANGE_LIMITS.maxObservationReplayRows});
const originalQuery=query=>({bins:query.bins,maximumChanges:query.maximumChanges,sharingSource:query.sharingSource,searchSource:query.searchSource});
const exact=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
const serialize=value=>JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item));

function reserve(source){
 const parent=inspectSkyChangeWork(source.readings,originalQuery(source.query)),profiles=2*parent.reservedWitnessProfiles;
 const witnessCourses=profiles*parent.uniqueSources*4,thermalCourses=parent.reservedDistinctBasisCourses+witnessCourses;
 const work={...parent,reservedWitnessProfiles:profiles,reservedWitnessCourses:witnessCourses,reservedThermalCourses:thermalCourses,
  reservedCourseIntervals:thermalCourses*parent.intervals,reservedReplayEndpointRows:profiles*parent.uniqueSources*parent.originalBoundaries,
  reservedObservationReplayRows:profiles*source.readings.length,reservedObjectivesPerCompatiblePattern:3};
 if(profiles>SKY_CONSEQUENCE_LIMITS.maxWitnessProfiles||witnessCourses>SKY_CONSEQUENCE_LIMITS.maxWitnessCourses||thermalCourses>SKY_CONSEQUENCE_LIMITS.maxThermalCourses
  ||work.reservedCourseIntervals>SKY_CONSEQUENCE_LIMITS.maxCourseIntervals||work.reservedReplayEndpointRows>SKY_CONSEQUENCE_LIMITS.maxReplayEndpointRows
  ||work.reservedObservationReplayRows>SKY_CONSEQUENCE_LIMITS.maxObservationReplayRows)throw Error('The complete consequence inquiry exceeds its aggregate allowance');
 return work;
}
export function prepareSkyConsequenceSource(originals,query){
 if(!exactSkyKeys(query,['bins','maximumChanges','sharingSource','searchSource','target'])
  ||!exactSkyKeys(query.target,['receiverReadingIndex','utc','store']))throw Error('Declare one original receiver, original UTC and temperature component with the complete search query');
 const parent=prepareSkyChangeSource(originals,originalQuery(query)),target=query.target;
 if(!Number.isInteger(target.receiverReadingIndex)||target.receiverReadingIndex<0||target.receiverReadingIndex>=parent.readings.length
  ||!['surfaceC','subsurfaceC'].includes(target.store)||typeof target.utc!=='string'
  ||!originalSkyReadingTimes(parent.readings[target.receiverReadingIndex].source).some(row=>row.utc===target.utc))
  throw Error('Choose an existing original receiver, one of its unchanged clock endpoints and a temperature component');
 const source={kind:SKY_CONSEQUENCE_KIND,model:{...SKY_CONSEQUENCE_MODEL},readings:parent.readings,query:{...parent.query,target:structuredClone(target)}};
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
 const choice=investigation.query.target,sourceIndex=admitted.recordSourceIndices[choice.receiverReadingIndex],originalIndex=originalTimes.findIndex(t=>t.utc===choice.utc);
 const target={...choice,sourceIndex,representativeReadingIndex:representatives[sourceIndex],originalIndex,
  cellIndex:investigation.readings[choice.receiverReadingIndex].query.reading.cellIndex};
 const targets=bases[sourceIndex].consequenceRows(originalIndex,choice.store);
 const result=rangeMinimumSkyChanges(observed,bands,targets,{maximumChanges:investigation.query.maximumChanges}),analysis=result.analysis;
 const patterns=[],alternatives=[];
 function replayExtreme(patternIndex,splits,side,endpoint){
  const profile=endpoint.witness;
  const replays=bases.map((basis,index)=>({sourceIndex:index,representativeReadingIndex:representatives[index],
   cellIndex:investigation.readings[representatives[index]].query.reading.cellIndex,...basis.replay(splits,profile.phaseProfiles,SKY_CONSEQUENCE_LIMITS.numericalConsistencyScreenC)}));
  const observations=locations.map((at,recordIndex)=>{
   const reading=investigation.readings[recordIndex].query.reading,row=replays[at.sourceIndex].originalCourse[at.originalIndex];
   if(row.utc!==reading.utc||cmp(exact(row.additiveC.existing.lower[reading.store]),profile.observedC[recordIndex]))throw Error('An extreme profile lost its original observation identity');
   const originalC=Object.fromEntries(['lower','upper'].map(end=>[end,row.originalC.existing[end][reading.store]]));
   return{recordIndex,cellIndex:reading.cellIndex,...at,additiveC:profileFraction(profile.observedC[recordIndex]),originalC,
    endpointStatus:Object.fromEntries(['lower','upper'].map(end=>[end,cmp(q(originalC[end]),bands[recordIndex].lower)>=0&&cmp(q(originalC[end]),bands[recordIndex].upper)<=0?'within-original-band':'outside-original-band']))};
  });
  const row=replays[sourceIndex].originalCourse[originalIndex];
  const represented={lower:sub(exact(row.additiveC.proposal.lower[choice.store]),exact(row.additiveC.existing.upper[choice.store])),
   upper:sub(exact(row.additiveC.proposal.upper[choice.store]),exact(row.additiveC.existing.lower[choice.store]))};
  if(cmp(represented[side],endpoint.value))throw Error('An exact extreme lost its original receiver/time/component binding');
  if(cmp(represented.lower,represented.upper)>0)throw Error('An extreme profile contradicts the exact endpoint-order proof');
  const numerical={lower:sub(q(row.originalC.proposal.lower[choice.store]),q(row.originalC.existing.upper[choice.store])),
   upper:sub(q(row.originalC.proposal.upper[choice.store]),q(row.originalC.existing.lower[choice.store]))};
  return{patternIndex,endpoint:side,valueC:profileFraction(endpoint.value),phaseProfiles:profile.phaseProfiles.map(p=>p.map(profileFraction)),
   productMasses:profile.productMasses.map(profileFraction),observedC:profile.observedC.map(profileFraction),
   originalObservations:observations,originalReplays:replays,
   targetRepresentedPairC:Object.fromEntries(Object.entries(represented).map(([k,v])=>[k,profileFraction(v)])),
   targetOriginalNumericalPairC:Object.fromEntries(Object.entries(numerical).map(([k,v])=>[k,profileFraction(v)]))};
 }
 for(const [patternIndex,item]of analysis.cases.entries()){
  const splitUtcs=item.splits.map(i=>originalTimes[i].utc);
  const numericalScreens=bases.map((basis,index)=>({sourceIndex:index,representativeReadingIndex:representatives[index],
   ...basis.screenPattern(item.splits,locations.filter(at=>at.sourceIndex===index),SKY_CONSEQUENCE_LIMITS.numericalConsistencyScreenC)}));
  patterns.push({patternIndex,changes:item.splits.length,splitAfterIntervals:[...item.splits],splitUtcs,
   compatibility:item.status==='feasible'?'compatible':'incompatible',exactProofIndex:patternIndex,numericalScreens});
  if(item.status!=='feasible')continue;
  const range=result.ranges.find(r=>r.patternIndex===patternIndex);
  if(!range)throw Error('A compatible minimum pattern lost its consequence extrema');
  alternatives.push({patternIndex,splitAfterIntervals:[...item.splits],splitUtcs,
   rangeC:{lower:profileFraction(range.lower.value),upper:profileFraction(range.upper.value)},
   maximumLowerMinusUpperC:profileFraction(range.endpointOrder.maximumDifference),
   extremes:{lower:replayExtreme(patternIndex,item.splits,'lower',range.lower),upper:replayExtreme(patternIndex,item.splits,'upper',range.upper)}});
 }
 const perSource=bases.map(b=>b.work()),sum=key=>perSource.reduce((total,row)=>total+row[key],0),profiles=alternatives.length*2;
 const executedBasisCourses=sum('executedBasisCourses'),executedWitnessCourses=sum('executedWitnessCourses');
 const work={...admitted,perSource,executedBasisCourses,executedWitnessCourses,executedThermalCourses:executedBasisCourses+executedWitnessCourses,
  executedCourseIntervals:(executedBasisCourses+executedWitnessCourses)*admitted.intervals,reusedCompleteCourses:sum('reusedCompleteCourses'),
  combinationStatesScreened:sum('combinationStatesScreened'),actualWitnessProfiles:profiles,actualReplayEndpointRows:profiles*admitted.uniqueSources*originalTimes.length,
  actualObservationReplayRows:profiles*investigation.readings.length,exactSolves:result.work.solves,exactObjectives:result.work.objectives,
  linearPivots:result.work.pivots,linearRationalOperations:result.work.rationalOperations,actualSkyFaceTests:sum('actualSkyFaceTests')};
 if(executedBasisCourses>admitted.reservedDistinctBasisCourses||executedWitnessCourses!==profiles*admitted.uniqueSources*4
  ||work.executedThermalCourses>admitted.reservedThermalCourses||work.executedCourseIntervals>admitted.reservedCourseIntervals
  ||profiles>admitted.reservedWitnessProfiles||work.actualReplayEndpointRows>admitted.reservedReplayEndpointRows||work.actualObservationReplayRows>admitted.reservedObservationReplayRows
  ||work.linearPivots>admitted.reservedLinearPivots||work.linearRationalOperations>admitted.reservedLinearRationalOperations
  ||perSource.some(row=>row.maximumCacheEntries>admitted.reservedCacheEntriesPerReceiver||row.patternsScreened!==patterns.length))
  throw Error('The complete consequence inquiry exceeded its admitted work');
 const consequence=result.lower===null?null:{lower:profileFraction(result.lower),upper:profileFraction(result.upper),
  lowerPatternIndices:result.lowerPatternIndices,upperPatternIndices:result.upperPatternIndices,
  components:result.components.map(c=>({lower:profileFraction(c.lower),upper:profileFraction(c.upper),patternIndices:c.patternIndices})),
  gaps:result.gaps.map(g=>({after:profileFraction(g.after),before:profileFraction(g.before),boundary:g.boundary})),
  direction:result.upper[0]<0n?'proposal-lower-for-every-compatible-represented-profile':result.lower[0]>0n?'proposal-higher-for-every-compatible-represented-profile':
   result.lower[0]===0n&&result.upper[0]===0n?'same-represented-temperature':'direction-not-established'};
 return{status:'compared',model:{...SKY_CONSEQUENCE_MODEL},query:structuredClone(investigation.query),target,
  compatibility:analysis.status,minimumChanges:analysis.minimumChanges,originalTimes,patterns,alternatives,consequence,
  totalDeclaredPatterns:analysis.totalDeclaredPatterns,unexaminedHigherChangePatterns:analysis.unexaminedHigherChangePatterns,
  readings:investigation.readings.map((input,i)=>({...input.query.reading,...locations[i],originalBins:input.query.bins,activeCommonBins:4,
   bandC:{lower:profileFraction(bands[i].lower),upper:profileFraction(bands[i].upper)}})),
  exactEvidence:{fractionEncoding:'two decimal integer strings [numerator, positive denominator]',
   coordinateOrder:'three nonzero-bin masses for each chronological epoch; bin zero is the exact complement',observedIntervalRows:observed,bands,targetIntervalRows:targets,result},
  numericalEvidence:{consistencyScreenC:SKY_CONSEQUENCE_LIMITS.numericalConsistencyScreenC,
   sourceBases:bases.map((basis,index)=>({sourceIndex:index,representativeReadingIndex:representatives[index],
    cellIndex:investigation.readings[representatives[index]].query.reading.cellIndex,...basis.numericalBasis()})),
   scope:'Every examined pattern has all complete original one-bin combination screens. Both extreme profiles of each compatible minimum pattern have separate original numerical replay. The screen is not a uniform physical or every-profile error bound.'},
  diagnostics:bases.map(b=>b.diagnostics()),work,
  semantics:'The result bounds one explicitly selected original receiver/time/component over the entire represented compatible profile family in the complete minimum change class. '
   +'Both endpoint extrema and pointwise endpoint order have original-matrix optimality proofs. Every tied attaining pattern and every separate represented interval component is retained. '
   +'The global hull may contain gaps. Component contributor identities do not make each pattern attain every component value. '
   +'Different extreme profiles need not form one common trajectory. An interval inside the numerical model does not establish physical realizability of every enclosed temperature. '
   +'Original numerical endpoints and original-band statuses remain separate from represented compatibility. Higher-change classes, continuous-time extrema, physical sky history and intervention benefit are not established.'};
}
export function prepareSkyConsequenceEvidence(originals,query){
 const investigation=prepareSkyConsequenceSource(originals,query),report=serialize(evaluate(investigation));
 if(new Blob([JSON.stringify({investigation,report})]).size>SKY_CONSEQUENCE_LIMITS.maxReportBytes)throw Error('The complete consequence report exceeds its output allowance; no partial result is returned');
 return{investigation,report};
}
export function inspectSkyConsequenceWork(originals,query){return reserve(prepareSkyConsequenceSource(originals,query));}
export function parseSkyConsequenceSource(text){
 if(typeof text!=='string')throw TypeError('Original sky-consequence inputs must be JSON text');
 checkShadeHeatBytes(new Blob([text]).size);let raw;try{raw=JSON.parse(text);}catch{throw Error('Invalid original sky-consequence JSON');}
 if(!exactSkyKeys(raw,['kind','model','readings','query'])||raw.kind!==SKY_CONSEQUENCE_KIND||!sameSkyData(raw.model,SKY_CONSEQUENCE_MODEL))throw Error('Unsupported sky-consequence source or saved calculated fields');
 return prepareSkyConsequenceSource(raw.readings,raw.query);
}
export function parseSkyConsequenceEvidence(text){const source=parseSkyConsequenceSource(text);return prepareSkyConsequenceEvidence(source.readings,source.query);}
export function serializeSkyConsequenceSource(input){
 const source=parseSkyConsequenceSource(JSON.stringify(input));let text=JSON.stringify(source,null,2)+'\n';
 try{checkShadeHeatBytes(new Blob([text]).size);}catch{text=JSON.stringify(source)+'\n';checkShadeHeatBytes(new Blob([text]).size);}return text;
}
