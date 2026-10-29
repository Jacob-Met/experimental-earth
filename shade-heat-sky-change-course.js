import {checkShadeHeatBytes} from './shade-heat.js';
import {prepareManySkyCourseSource,inspectManySkyCourseWork,MANY_SKY_COURSE_LIMITS} from './shade-heat-many-course.js';
import {exactSkyKeys,sameSkyData,originalSkyReadingTimes} from './shade-heat-timed-reading-source.js';
import {createOriginalSkyChangeBasis} from './shade-heat-sky-change-kernel.js';
import {findMinimumSkyChanges,SKY_CHANGE_PATTERN_LIMITS} from './shade-heat-sky-change-patterns.js';
import {profileFraction} from './shade-heat-profile-band.js';
import {rational as q,add,sub,cmp} from './vendor/chronos/exact-halfplanes.mjs';

export const SKY_CHANGE_KIND='experimental-earth/original-clock-sky-change-inputs/1';
export const SKY_CHANGE_MODEL=Object.freeze({name:'minimum-original-clock-sky-change-class',version:1,
  observation:'three to 24 original instantaneous temperature bands at at most three complete receiver sources',
  profiles:'one common four-bin profile per epoch, shared by every original receiver and both designs',
  alternatives:'all zero, one or two change patterns on original internal interval boundaries, up to the explicitly declared maximum',
  coefficient:'one exact represented static-plus-original-step response basis; phase coefficients telescope without rounding, so lower-change classes are exact subsets',
  qualification:'every examined pattern is screened against every complete original one-bin combination at every original endpoint; every displayed fixed profile has a separate original numerical replay',
  result:'minimum compatible change count and every compatible pattern in that class; one feasible profile per pattern, not a pointwise consequence envelope',
  limitation:'conditional model compatibility, not a recovered measured sky history, likelihood or physical validation'});
export const SKY_CHANGE_LIMITS=Object.freeze({readings:24,uniqueSources:3,bins:4,maxIntervals:24,
  maxGeometryChecks:MANY_SKY_COURSE_LIMITS.maxGeometryChecks,maxPatterns:277,
  maxDistinctBasisCourses:112656,maxWitnessProfiles:253,maxWitnessCourses:3036,
  maxThermalCourses:115692,maxCourseIntervals:2776608,maxCacheEntriesPerReceiver:280,
  maxReplayEndpointRows:18975,maxObservationReplayRows:6072,maxReportBytes:64*1024*1024,
  maxLinearPivots:SKY_CHANGE_PATTERN_LIMITS.pivots,maxLinearRationalOperations:SKY_CHANGE_PATTERN_LIMITS.rationalOperations,
  numericalConsistencyScreenC:MANY_SKY_COURSE_LIMITS.numericalConsistencyScreenC});
const parentQuery=query=>({bins:4,splitAfterInterval:1,sharingSource:query.sharingSource});
const exact=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
const serialize=value=>JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item));

function reserve(source){
  const parent=inspectManySkyCourseWork(source.readings,parentQuery(source.query));
  const n=parent.intervals,internal=n-1,pairs=internal*(internal-1)/2,max=source.query.maximumChanges;
  const singles=max>=1?internal:0,doubles=max>=2?pairs:0,patterns=1+singles+doubles;
  const referenceSequences=3*n+1,declaredSequences=4+12*singles+36*doubles;
  const distinctSequences=Math.max(referenceSequences,declaredSequences);
  const profiles=Math.max(1,singles,doubles),sources=parent.uniqueSources;
  const basisCourses=distinctSequences*sources*4,witnessCourses=profiles*sources*4,thermalCourses=basisCourses+witnessCourses;
  const work={sources:parent.sources,recordSourceIndices:parent.recordSourceIndices,uniqueSources:sources,
    intervals:n,originalBoundaries:n+1,originalRecords:source.readings.length,
    geometryPasses:sources,geometryChecks:parent.geometryChecks,declaredPatterns:patterns,
    reservedReferenceCourses:referenceSequences*sources*4,reservedDistinctBasisCourses:basisCourses,
    reservedWitnessProfiles:profiles,reservedWitnessCourses:witnessCourses,reservedThermalCourses:thermalCourses,
    reservedCourseIntervals:thermalCourses*n,reservedReplayEndpointRows:profiles*sources*(n+1),
    reservedObservationReplayRows:profiles*source.readings.length,reservedCacheEntriesPerReceiver:4+12*internal,
    reservedLinearPivots:SKY_CHANGE_LIMITS.maxLinearPivots,reservedLinearRationalOperations:SKY_CHANGE_LIMITS.maxLinearRationalOperations,
    maximumCompleteReportBytes:SKY_CHANGE_LIMITS.maxReportBytes};
  if(work.geometryChecks>SKY_CHANGE_LIMITS.maxGeometryChecks||patterns>SKY_CHANGE_LIMITS.maxPatterns
      ||basisCourses>SKY_CHANGE_LIMITS.maxDistinctBasisCourses||profiles>SKY_CHANGE_LIMITS.maxWitnessProfiles
      ||witnessCourses>SKY_CHANGE_LIMITS.maxWitnessCourses||thermalCourses>SKY_CHANGE_LIMITS.maxThermalCourses
      ||work.reservedCourseIntervals>SKY_CHANGE_LIMITS.maxCourseIntervals
      ||work.reservedReplayEndpointRows>SKY_CHANGE_LIMITS.maxReplayEndpointRows
      ||work.reservedObservationReplayRows>SKY_CHANGE_LIMITS.maxObservationReplayRows
      ||work.reservedCacheEntriesPerReceiver>SKY_CHANGE_LIMITS.maxCacheEntriesPerReceiver)
    throw Error('The complete original-clock search exceeds its aggregate allowance; no partial pattern set is offered');
  return work;
}

export function prepareSkyChangeSource(originals,query){
  if(!exactSkyKeys(query,['bins','maximumChanges','sharingSource','searchSource'])||query.bins!==4
      ||!Number.isInteger(query.maximumChanges)||query.maximumChanges<0||query.maximumChanges>2
      ||typeof query.searchSource!=='string'||!query.searchSource.trim()||query.searchSource.length>400)
    throw Error('Declare four common bins, at most zero/one/two original-clock changes, and an attributed basis for this model class');
  const admitted=prepareManySkyCourseSource(originals,parentQuery(query));
  const source={kind:SKY_CHANGE_KIND,model:{...SKY_CHANGE_MODEL},readings:admitted.readings,
    query:{bins:4,maximumChanges:query.maximumChanges,sharingSource:admitted.query.sharingSource,searchSource:query.searchSource}};
  checkShadeHeatBytes(new Blob([JSON.stringify(source)]).size);reserve(source);return source;
}

function evaluate(investigation){
  const admitted=reserve(investigation),representatives=admitted.sources.map(s=>s.recordIndex);
  const bases=representatives.map(index=>createOriginalSkyChangeBasis(investigation.readings[index]));
  const originalTimes=bases[0].originalTimes;
  if(bases.some(b=>!sameSkyData(b.originalTimes,originalTimes))
      ||!sameSkyData(originalTimes,originalSkyReadingTimes(investigation.readings[0].source)))
    throw Error('Every original receiver must retain the identical complete original clock');
  const locations=investigation.readings.map((input,i)=>{
    const reading=input.query.reading,originalIndex=originalTimes.findIndex(t=>t.utc===reading.utc);
    if(originalIndex<0)throw Error('An original observation is absent from its unchanged complete clock');
    return {sourceIndex:admitted.recordSourceIndices[i],originalIndex,utc:reading.utc,store:reading.store};
  });
  const observed=locations.map(at=>bases[at.sourceIndex].observationRow(at.originalIndex,at.store));
  const bands=investigation.readings.map(input=>({lower:sub(q(input.query.reading.temperatureC),q(input.query.reading.halfWidthC)),
    upper:add(q(input.query.reading.temperatureC),q(input.query.reading.halfWidthC))}));
  const analysis=findMinimumSkyChanges(observed,bands,{maximumChanges:investigation.query.maximumChanges});
  const patterns=[],alternatives=[];
  // Numerical qualification completes for the entire examined class before the
  // report is returned. Exact infeasibility does not waive an original gate.
  for(const [patternIndex,item]of analysis.cases.entries()){
    const splitUtcs=item.splits.map(i=>originalTimes[i].utc);
    const numericalScreens=bases.map((basis,sourceIndex)=>({sourceIndex,representativeReadingIndex:representatives[sourceIndex],
      ...basis.screenPattern(item.splits,locations.filter(at=>at.sourceIndex===sourceIndex),SKY_CHANGE_LIMITS.numericalConsistencyScreenC)}));
    patterns.push({patternIndex,changes:item.splits.length,splitAfterIntervals:[...item.splits],splitUtcs,
      compatibility:item.status==='feasible'?'compatible':'incompatible',exactProofIndex:patternIndex,numericalScreens});
    if(item.status!=='feasible')continue;
    const profile=item.witness;
    const replays=bases.map((basis,sourceIndex)=>({sourceIndex,representativeReadingIndex:representatives[sourceIndex],
      cellIndex:investigation.readings[representatives[sourceIndex]].query.reading.cellIndex,
      ...basis.replay(item.splits,profile.phaseProfiles,SKY_CHANGE_LIMITS.numericalConsistencyScreenC)}));
    const originalObservations=locations.map((at,recordIndex)=>{
      const reading=investigation.readings[recordIndex].query.reading,row=replays[at.sourceIndex].originalCourse[at.originalIndex];
      if(row.utc!==reading.utc||cmp(exact(row.additiveC.existing.lower[reading.store]),profile.observedC[recordIndex]))
        throw Error('A fixed pattern profile lost an original observation identity');
      const originalC=Object.fromEntries(['lower','upper'].map(side=>[side,row.originalC.existing[side][reading.store]]));
      return {recordIndex,cellIndex:reading.cellIndex,...at,additiveC:profileFraction(profile.observedC[recordIndex]),originalC,
        endpointStatus:Object.fromEntries(['lower','upper'].map(side=>[side,
          cmp(q(originalC[side]),bands[recordIndex].lower)>=0&&cmp(q(originalC[side]),bands[recordIndex].upper)<=0?'within-original-band':'outside-original-band']))};
    });
    alternatives.push({patternIndex,splitAfterIntervals:[...item.splits],splitUtcs,
      phaseProfiles:profile.phaseProfiles.map(phase=>phase.map(profileFraction)),
      productMasses:profile.productMasses.map(profileFraction),observedC:profile.observedC.map(profileFraction),
      originalObservations,originalReplays:replays});
  }
  const perSource=bases.map(b=>b.work()),sum=key=>perSource.reduce((total,row)=>total+row[key],0);
  const executedBasisCourses=sum('executedBasisCourses'),executedWitnessCourses=sum('executedWitnessCourses');
  const work={...admitted,perSource,executedBasisCourses,executedWitnessCourses,
    executedThermalCourses:executedBasisCourses+executedWitnessCourses,
    executedCourseIntervals:(executedBasisCourses+executedWitnessCourses)*admitted.intervals,
    reusedCompleteCourses:sum('reusedCompleteCourses'),combinationStatesScreened:sum('combinationStatesScreened'),
    actualWitnessProfiles:alternatives.length,actualReplayEndpointRows:alternatives.length*admitted.uniqueSources*originalTimes.length,
    actualObservationReplayRows:alternatives.length*investigation.readings.length,
    exactSolves:analysis.work.solves,linearPivots:analysis.work.pivots,linearRationalOperations:analysis.work.rationalOperations,
    actualSkyFaceTests:sum('actualSkyFaceTests')};
  if(executedBasisCourses>admitted.reservedDistinctBasisCourses||executedWitnessCourses!==alternatives.length*admitted.uniqueSources*4
      ||work.executedThermalCourses>admitted.reservedThermalCourses||work.executedCourseIntervals>admitted.reservedCourseIntervals
      ||work.actualWitnessProfiles>admitted.reservedWitnessProfiles||work.actualReplayEndpointRows>admitted.reservedReplayEndpointRows
      ||work.actualObservationReplayRows>admitted.reservedObservationReplayRows
      ||work.linearPivots>admitted.reservedLinearPivots||work.linearRationalOperations>admitted.reservedLinearRationalOperations
      ||perSource.some(row=>row.maximumCacheEntries>admitted.reservedCacheEntriesPerReceiver||row.patternsScreened!==patterns.length))
    throw Error('The complete original pattern inquiry exceeded its admitted work');
  return {status:'compared',model:{...SKY_CHANGE_MODEL},query:structuredClone(investigation.query),
    compatibility:analysis.status,minimumChanges:analysis.minimumChanges,originalTimes,patterns,alternatives,
    totalDeclaredPatterns:analysis.totalDeclaredPatterns,unexaminedHigherChangePatterns:analysis.unexaminedHigherChangePatterns,
    readings:investigation.readings.map((input,i)=>({...input.query.reading,...locations[i],originalBins:input.query.bins,activeCommonBins:4,
      bandC:{lower:profileFraction(bands[i].lower),upper:profileFraction(bands[i].upper)}})),
    exactEvidence:{fractionEncoding:'two decimal integer strings [numerator, positive denominator]',
      coordinateOrder:'three nonzero-bin masses for each chronological epoch; bin zero is the exact complement',
      observedIntervalRows:observed,bands,analysis},
    numericalEvidence:{consistencyScreenC:SKY_CHANGE_LIMITS.numericalConsistencyScreenC,
      sourceBases:bases.map((basis,sourceIndex)=>({sourceIndex,representativeReadingIndex:representatives[sourceIndex],
        cellIndex:investigation.readings[representatives[sourceIndex]].query.reading.cellIndex,...basis.numericalBasis()})),
      scope:'All complete original one-bin combinations of every examined pattern and all displayed fixed-profile courses were replayed. The consistency screen is not a uniform physical or every-profile error bound.'},
    diagnostics:bases.map(b=>b.diagnostics()),work,
    semantics:'The minimum is taken across the explicitly declared model class on the unchanged original clock. '
      +'Every compatible pattern in that minimum class is retained. Higher-change classes need not be examined after a complete lower class succeeds. '
      +'The static and original-step responses define one common represented model; exact regrouping keeps the simpler classes nested. '
      +'Each displayed consequence is one fixed feasible profile for its named pattern, not the full consequence range or a most likely history. '
      +'Original numerical replay and original band statuses remain separate from exact represented compatibility. '
      +'No measured change time, intervening observation, physical sky history or intervention benefit is established.'};
}

export function prepareSkyChangeEvidence(originals,query){
  const investigation=prepareSkyChangeSource(originals,query),report=serialize(evaluate(investigation));
  if(new Blob([JSON.stringify({investigation,report})]).size>SKY_CHANGE_LIMITS.maxReportBytes)
    throw Error('The complete original pattern report exceeds its output allowance; no partial result is returned');
  return {investigation,report};
}
export function inspectSkyChangeWork(originals,query){return reserve(prepareSkyChangeSource(originals,query));}
export function parseSkyChangeSource(text){
  if(typeof text!=='string')throw TypeError('Original sky-change inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);let raw;
  try{raw=JSON.parse(text);}catch{throw Error('Invalid original sky-change input JSON');}
  if(!exactSkyKeys(raw,['kind','model','readings','query'])||raw.kind!==SKY_CHANGE_KIND||!sameSkyData(raw.model,SKY_CHANGE_MODEL))
    throw Error('Unsupported original sky-change inputs or saved calculated fields');
  return prepareSkyChangeSource(raw.readings,raw.query);
}
export function parseSkyChangeEvidence(text){const input=parseSkyChangeSource(text);return prepareSkyChangeEvidence(input.readings,input.query);}
export function serializeSkyChangeSource(input){
  const source=parseSkyChangeSource(JSON.stringify(input));
  let text=JSON.stringify(source,null,2)+'\n';
  try{checkShadeHeatBytes(new Blob([text]).size);}catch{text=JSON.stringify(source)+'\n';checkShadeHeatBytes(new Blob([text]).size);}
  return text;
}
