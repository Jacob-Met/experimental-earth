import {checkShadeHeatBytes} from './shade-heat.js';
import {prepareThreeEpochSkySource,prepareThreeEpochSkyExecution,inspectThreeEpochSkyWork,THREE_EPOCH_SKY_LIMITS} from './shade-heat-three-epoch-course.js';
import {exactSkyKeys,sameSkyData,originalSkyReadingTimes} from './shade-heat-timed-reading-source.js';
import {minimizeThreeEpochTargetExcess,THREE_EPOCH_TARGET_LIMITS} from './shade-heat-target-margin.js';
import {profileFraction} from './shade-heat-profile-band.js';
import {rational as q,add,sub,mul,cmp} from './vendor/chronos/exact-halfplanes.mjs';

export const SKY_COURSE_TARGET_KIND='experimental-earth/three-epoch-original-target-margin-inputs/1';
export const SKY_COURSE_TARGET_MODEL=Object.freeze({name:'one-three-profile-margin-across-original-thermal-targets',version:1,
  observation:'retain every original instantaneous existing-temperature band and complete receiver declaration from the three-profile inquiry',
  profile:'one common normalized four-bin profile in each of three explicitly declared original epochs',
  targets:'one to50 distinct explicitly declared original time/component paired-temperature ceilings at the first original receiver, separate from observations',
  objective:'minimize the largest target excess, equivalently maximize the common temperature margin, under one fixed set of profiles',
  geometry:'both existing/proposal geometry endpoints must resolve at every selected original target',
  arithmetic:'a bounded ten-coordinate epigraph over the unchanged original nine-coordinate constraints; exact additive lower anchor and original-matrix optimality proof',
  replay:'one best common profile retains every original observation and receives a separate complete numerical replay at every original receiver/time'});
export const SKY_COURSE_TARGET_LIMITS=Object.freeze({targets:THREE_EPOCH_TARGET_LIMITS.targets,
  maxIntervals:THREE_EPOCH_SKY_LIMITS.maxIntervals,maxCourses:1980,maxCourseIntervals:47520,
  maxWitnessProfiles:101,maxReportBytes:THREE_EPOCH_SKY_LIMITS.maxReportBytes,
  maxLinearPivots:THREE_EPOCH_SKY_LIMITS.maxLinearPivots+THREE_EPOCH_TARGET_LIMITS.linear.pivots,
  maxLinearRationalOperations:THREE_EPOCH_SKY_LIMITS.maxLinearRationalOperations+THREE_EPOCH_TARGET_LIMITS.linear.rationalOperations});
const ZERO=q(0),stores=['surfaceC','subsurfaceC'],bounds=['lower','upper'];
const dense=(v,n)=>Array.isArray(v)&&v.length===n&&Array.from({length:n},(_,i)=>Object.hasOwn(v,i)).every(Boolean);
const exact=v=>[BigInt(v.exact.numerator),BigInt(v.exact.denominator)];
const serialize=v=>JSON.parse(JSON.stringify(v,(_key,x)=>typeof x==='bigint'?x.toString():x));
const dot=(a,b)=>a.reduce((sum,v,i)=>add(sum,mul(v,b[i])),ZERO);
const baseQuery=query=>({bins:query.bins,splitAfterIntervals:query.splitAfterIntervals,sharingSource:query.sharingSource});

function preflight(source){
  const parent=inspectThreeEpochSkyWork(source.readings,baseQuery(source.query));
  const extraWitnessCourses=parent.uniqueSources*4;
  const reservedThermalCourses=parent.reservedThermalCourses+extraWitnessCourses;
  const courseIntervals=reservedThermalCourses*parent.intervals;
  const reservedWitnessProfiles=parent.reservedWitnessProfiles+1;
  if(reservedThermalCourses>SKY_COURSE_TARGET_LIMITS.maxCourses||courseIntervals>SKY_COURSE_TARGET_LIMITS.maxCourseIntervals
      ||reservedWitnessProfiles>SKY_COURSE_TARGET_LIMITS.maxWitnessProfiles)
    throw Error('The complete original inquiry and best-profile replay exceed the whole target allowance');
  return {...parent,targets:source.query.targets.length,reservedThermalCourses,courseIntervals,reservedWitnessProfiles,
    reservedWitnessCourses:parent.reservedWitnessCourses+extraWitnessCourses,
    replayEndpointRows:parent.replayEndpointRows+parent.uniqueSources*parent.originalBoundaries,
    observationReplayRows:parent.observationReplayRows+source.readings.length,
    linearFamilies:5,maxLinearPivots:SKY_COURSE_TARGET_LIMITS.maxLinearPivots,
    maxLinearRationalOperations:SKY_COURSE_TARGET_LIMITS.maxLinearRationalOperations};
}

export function prepareSkyCourseTargetSource(originals,query){
  const count=query?.targets?.length;
  if(!exactSkyKeys(query,['bins','splitAfterIntervals','sharingSource','targets','targetSource'])
      ||!Number.isInteger(count)||count<1||count>SKY_COURSE_TARGET_LIMITS.targets||!dense(query.targets,count)
      ||!query.targets.every(target=>exactSkyKeys(target,['originalIndex','store','maximumDifferenceC'])
        &&Number.isInteger(target.originalIndex)&&target.originalIndex>=0&&stores.includes(target.store)
        &&Number.isFinite(target.maximumDifferenceC))
      ||typeof query.targetSource!=='string'||!query.targetSource.trim()||query.targetSource.length>400)
    throw Error('Declare one to50 distinct original time/component targets, finite temperature ceilings and their separate objective source');
  const parent=prepareThreeEpochSkySource(originals,baseQuery(query));
  const times=originalSkyReadingTimes(parent.readings[0].source);
  const identities=query.targets.map(target=>target.originalIndex+':'+target.store);
  if(query.targets.some(target=>target.originalIndex>=times.length)||new Set(identities).size!==count)
    throw Error('Every target must keep one distinct original time/component identity within the unchanged complete clock');
  const investigation={kind:SKY_COURSE_TARGET_KIND,model:{...SKY_COURSE_TARGET_MODEL},readings:parent.readings,
    query:{...parent.query,targets:query.targets.map(target=>({...target,maximumDifferenceC:Object.is(target.maximumDifferenceC,-0)?0:target.maximumDifferenceC})),targetSource:query.targetSource.trim()}};
  checkShadeHeatBytes(new Blob([JSON.stringify(investigation)]).size);preflight(investigation);return investigation;
}

function evaluate(investigation){
  const reservation=preflight(investigation);
  const execution=prepareThreeEpochSkyExecution(investigation.readings,baseQuery(investigation.query));
  const original=execution.report,context=execution.context,basis=context.bases[0];
  const targetRows=investigation.query.targets.map(target=>{
    if(!basis.triples.every(triple=>['existing','proposal'].every(design=>
      triple.trace.states[design].lower[target.originalIndex][target.store]
        ===triple.trace.states[design].upper[target.originalIndex][target.store])))
      throw Error('Every selected original target requires resolved existing and proposal geometry endpoints');
    const index=context.axes.findIndex(axis=>axis.originalIndex===target.originalIndex&&axis.store===target.store&&axis.side==='upper');
    if(index<0||context.axes[index].utc!==original.originalTimes[target.originalIndex].utc)
      throw Error('An original target lost its complete course identity');
    return context.objectiveRows[index];
  });
  const ceilings=investigation.query.targets.map(target=>q(target.maximumDifferenceC));
  let solved=null,witness=null;
  if(original.compatibility==='compatible'){
    solved=minimizeThreeEpochTargetExcess(context.family.linearModel,targetRows,ceilings);
    if(solved.status!=='optimized')throw Error('A compatible original family cannot be rejected by a finite unrestricted target excess');
    const observedC=context.observedRows.map(row=>dot(row,solved.witness.masses));
    if(observedC.some((value,i)=>cmp(value,context.family.bands[i].lower)<0||cmp(value,context.family.bands[i].upper)>0))
      throw Error('The best common target profile lost an original observation');
    witness=context.witnessFor({...solved.witness,observedC},0);
  }
  const targets=investigation.query.targets.map((target,index)=>{
    const time=original.originalTimes[target.originalIndex],range=original.pointwiseCourse[target.originalIndex].ranges?.[target.store];
    const common={targetIndex:index,...target,utc:time.utc,cellIndex:original.cellIndex,ceilingC:profileFraction(ceilings[index]),
      individualRange:range?{lower:range.lower.differenceC,upper:range.upper.differenceC}:null,
      individuallyPossible:range?cmp(exact(range.lower.differenceC),ceilings[index])<=0:null};
    if(!solved)return {...common,differenceC:null,excessC:null,withinDeclaredCeiling:null,attainsWorstExcess:null,originalReplay:null};
    const point=witness.originalReplays[0].originalCourse[target.originalIndex];
    if(point.utc!==time.utc||cmp(sub(exact(point.additiveC.proposal.lower[target.store]),exact(point.additiveC.existing.lower[target.store])),solved.targetValuesC[index]))
      throw Error('The best fixed profile lost an original target binding');
    const differences=Object.fromEntries(bounds.map(bound=>[bound,sub(q(point.originalC.proposal[bound][target.store]),q(point.originalC.existing[bound==='lower'?'upper':'lower'][target.store]))]));
    return {...common,differenceC:profileFraction(solved.targetValuesC[index]),excessC:profileFraction(solved.targetExcessC[index]),
      withinDeclaredCeiling:cmp(solved.targetExcessC[index],ZERO)<=0,attainsWorstExcess:solved.activeTargetIndices.includes(index),
      originalReplay:{originalIndex:target.originalIndex,utc:time.utc,store:target.store,cellIndex:original.cellIndex,
        differenceC:Object.fromEntries(bounds.map(bound=>[bound,profileFraction(differences[bound])])),
        endpointStatus:Object.fromEntries(bounds.map(bound=>[bound,cmp(differences[bound],ceilings[index])<=0?'within-authored-ceiling':'above-authored-ceiling']))}};
  });
  const extraWitnessCourses=witness?reservation.uniqueSources*4:0;
  const executedThermalCourses=original.work.executedThermalCourses+extraWitnessCourses;
  const executedWitnessCourses=original.work.executedWitnessCourses+extraWitnessCourses;
  const actualReplayEndpointRows=original.work.actualReplayEndpointRows+(witness?reservation.uniqueSources*reservation.originalBoundaries:0);
  const actualObservationReplayRows=original.work.actualObservationReplayRows+(witness?investigation.readings.length:0);
  const linearPivots=original.work.linearPivots+(solved?.work.pivots??0);
  const linearRationalOperations=original.work.linearRationalOperations+(solved?.work.rationalOperations??0);
  if(executedThermalCourses>reservation.reservedThermalCourses||executedWitnessCourses>reservation.reservedWitnessCourses
      ||executedThermalCourses*reservation.intervals>reservation.courseIntervals
      ||actualReplayEndpointRows>reservation.replayEndpointRows||actualObservationReplayRows>reservation.observationReplayRows
      ||linearPivots>reservation.maxLinearPivots||linearRationalOperations>reservation.maxLinearRationalOperations)
    throw Error('The complete original target inquiry exceeded its reserved work; no partial result is returned');
  const report={status:'compared',observationCompatibility:original.compatibility,
    targetCompatibility:solved?.targetCompatibility??'not-evaluated-original-incompatible',
    model:{...SKY_COURSE_TARGET_MODEL},query:structuredClone(investigation.query),cellIndex:original.cellIndex,
    originalTimes:original.originalTimes,splitUtcs:original.splitUtcs,targets,witness,original,
    margin:solved?{minimumWorstExcessC:profileFraction(solved.minimumWorstExcessC),maximumCommonMarginC:profileFraction(solved.maximumCommonMarginC),
      activeTargetIndices:solved.activeTargetIndices,individuallyPossibleTargets:targets.filter(target=>target.individuallyPossible).length}:null,
    exactEvidence:solved?serialize({targetTripleRows:targetRows,ceilings,lowerAnchorC:solved.lowerAnchorC,
      minimumBasisExcessC:solved.minimumBasisExcessC,projections:solved.projections,linearModel:solved.linearModel,certificate:solved.linearCertificate}):null,
    work:{...reservation,executedBasisCourses:original.work.executedBasisCourses,executedWitnessCourses,executedTargetWitnessCourses:extraWitnessCourses,
      executedThermalCourses,executedCourseIntervals:executedThermalCourses*reservation.intervals,actualReplayEndpointRows,actualObservationReplayRows,
      linearPivots,linearRationalOperations,originalLinearPivots:original.work.linearPivots,originalLinearRationalOperations:original.work.linearRationalOperations,
      targetOptimization:solved?.work??null,exactWitnessMarginalEqualities:original.work.exactWitnessMarginalEqualities+(witness?.exactMarginalEqualities??0)},
    semantics:'Every original observation constrains one fixed set of three shared sky profiles. The authored target ceilings are objectives, not extra measured bands. '
      +'The optimum is the smallest possible largest excess across every explicitly selected original time/component, using one common profile. Positive optimum proves that the targets cannot all hold in this exact coefficient family; the displayed best compromise still retains every original observation. '
      +'The auxiliary lower anchor follows from all64 retained additive target values. Its exact primal/dual proof concerns the represented additive model with resolved selected geometry endpoints. '
      +'The complete original numerical replay and its band/ceiling statuses remain separate. No unselected times, interpolation, continuous-time guarantee, measured sky history or validated physical intervention is inferred.'};
  return {report,context:{original:context,targetRows,ceilings,solved}};
}

export function prepareSkyCourseTargetExecution(originals,query){
  const investigation=prepareSkyCourseTargetSource(originals,query),{report,context}=evaluate(investigation);
  if(new Blob([JSON.stringify({investigation,report})]).size>SKY_COURSE_TARGET_LIMITS.maxReportBytes)
    throw Error('The complete original target report exceeds its output allowance; no partial result is accepted');
  return {investigation,report,context};
}
export function prepareSkyCourseTargetEvidence(originals,query){
  const {investigation,report}=prepareSkyCourseTargetExecution(originals,query);return {investigation,report};
}
export function inspectSkyCourseTargetWork(originals,query){
  return preflight(prepareSkyCourseTargetSource(originals,query));
}
export function parseSkyCourseTargetSource(text){
  if(typeof text!=='string')throw TypeError('Original course target inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);let raw;
  try{raw=JSON.parse(text);}catch{throw Error('Invalid original course target input JSON');}
  if(!exactSkyKeys(raw,['kind','model','readings','query'])||raw.kind!==SKY_COURSE_TARGET_KIND||!sameSkyData(raw.model,SKY_COURSE_TARGET_MODEL))
    throw Error('Use the complete original target input model without saved calculations or unsupported fields');
  return prepareSkyCourseTargetSource(raw.readings,raw.query);
}
export function parseSkyCourseTargetEvidence(text){
  const source=parseSkyCourseTargetSource(text);return prepareSkyCourseTargetEvidence(source.readings,source.query);
}
export function serializeSkyCourseTargetSource(input){
  const source=parseSkyCourseTargetSource(JSON.stringify(input));
  let text=JSON.stringify(source,null,2)+'\n';
  try{checkShadeHeatBytes(new Blob([text]).size);}
  catch{text=JSON.stringify(source);}
  checkShadeHeatBytes(new Blob([text]).size);return text;
}
