import {checkShadeHeatBytes} from './shade-heat.js';
import {prepareSkyCourseTargetSource,prepareSkyCourseTargetExecution,inspectSkyCourseTargetWork,SKY_COURSE_TARGET_LIMITS} from './shade-heat-course-targets.js';
import {exactSkyKeys,sameSkyData} from './shade-heat-timed-reading-source.js';
import {findThreeEpochTargetConflict,prepareThreeEpochTargetConflictSeed,THREE_EPOCH_TARGET_CONFLICT_LIMITS} from './shade-heat-target-conflict.js';
import {profileFraction} from './shade-heat-profile-band.js';
import {rational as q,add,sub,mul,cmp} from './vendor/chronos/exact-halfplanes.mjs';

export const SKY_TARGET_CONFLICT_KIND='experimental-earth/original-target-conflict-inputs/1';
export const SKY_TARGET_CONFLICT_MODEL=Object.freeze({name:'necessary-conflict-among-original-time-targets',version:1,
  observations:'every original instantaneous temperature band, complete receiver declaration and both explicitly declared profile changes remain mandatory',
  targets:'all one to50 desired original time/component ceilings remain in the authored input and full common-margin report',
  conflict:'one inclusion-minimal jointly incompatible target subset, with a verified exact Farkas certificate against the original observation matrix',
  necessity:'a feasible fixed set of three normalized profiles for each final-subset-minus-one, retaining every original observation and strictly violating that removed ceiling',
  search:'verified fresh common-margin certificate support, then deterministic source-order deletion under one cumulative exact-work allowance; no minimum-cardinality claim',
  replay:'each final removal witness receives a separate complete original numerical replay at every original receiver and original time'});
export const SKY_TARGET_CONFLICT_LIMITS=Object.freeze({targets:SKY_COURSE_TARGET_LIMITS.targets,
  maxIntervals:SKY_COURSE_TARGET_LIMITS.maxIntervals,maxCourses:2580,maxCourseIntervals:61920,maxWitnessProfiles:151,
  maxReportBytes:SKY_COURSE_TARGET_LIMITS.maxReportBytes,
  maxLinearPivots:SKY_COURSE_TARGET_LIMITS.maxLinearPivots+THREE_EPOCH_TARGET_CONFLICT_LIMITS.pivots,
  maxLinearRationalOperations:SKY_COURSE_TARGET_LIMITS.maxLinearRationalOperations+THREE_EPOCH_TARGET_CONFLICT_LIMITS.rationalOperations});
const ZERO=q(0),bounds=['lower','upper'];
const exact=v=>[BigInt(v.exact.numerator),BigInt(v.exact.denominator)];
const serialize=v=>JSON.parse(JSON.stringify(v,(_key,x)=>typeof x==='bigint'?x.toString():x));
const dot=(a,b)=>a.reduce((sum,v,i)=>add(sum,mul(v,b[i])),ZERO);

function preflight(source){
  const parent=inspectSkyCourseTargetWork(source.readings,source.query),count=source.query.targets.length;
  const extraWitnessCourses=count*parent.uniqueSources*4,reservedThermalCourses=parent.reservedThermalCourses+extraWitnessCourses;
  const courseIntervals=reservedThermalCourses*parent.intervals,reservedWitnessProfiles=parent.reservedWitnessProfiles+count;
  if(reservedThermalCourses>SKY_TARGET_CONFLICT_LIMITS.maxCourses||courseIntervals>SKY_TARGET_CONFLICT_LIMITS.maxCourseIntervals
      ||reservedWitnessProfiles>SKY_TARGET_CONFLICT_LIMITS.maxWitnessProfiles)
    throw Error('The complete conflict and every possible removal replay exceed the whole inquiry allowance');
  return {...parent,reservedThermalCourses,courseIntervals,reservedWitnessProfiles,
    reservedConflictWitnessProfiles:count,reservedConflictWitnessCourses:extraWitnessCourses,
    reservedWitnessCourses:parent.reservedWitnessCourses+extraWitnessCourses,
    replayEndpointRows:parent.replayEndpointRows+count*parent.uniqueSources*parent.originalBoundaries,
    observationReplayRows:parent.observationReplayRows+count*source.readings.length,
    maxConflictFeasibilitySolves:count+2,maxLinearPivots:SKY_TARGET_CONFLICT_LIMITS.maxLinearPivots,
    maxLinearRationalOperations:SKY_TARGET_CONFLICT_LIMITS.maxLinearRationalOperations};
}

export function prepareSkyTargetConflictSource(originals,query){
  const parent=prepareSkyCourseTargetSource(originals,query),source={kind:SKY_TARGET_CONFLICT_KIND,model:{...SKY_TARGET_CONFLICT_MODEL},readings:parent.readings,query:parent.query};
  checkShadeHeatBytes(new Blob([JSON.stringify(source)]).size);preflight(source);return source;
}
export function inspectSkyTargetConflictWork(originals,query){return preflight(prepareSkyTargetConflictSource(originals,query));}

export function prepareSkyTargetConflictEvidence(originals,query){
  const investigation=prepareSkyTargetConflictSource(originals,query),reservation=preflight(investigation);
  const parent=prepareSkyCourseTargetExecution(investigation.readings,investigation.query),base=parent.report,context=parent.context;
  let analysis=null,seed=null,conflict=null;
  if(base.observationCompatibility==='compatible'){
    seed=prepareThreeEpochTargetConflictSeed(context.original.family.linearModel,context.targetRows,context.ceilings,context.solved);
    analysis=findThreeEpochTargetConflict(context.original.family.linearModel,context.targetRows,context.ceilings,{initialCertificate:seed});
    const expected=base.targetCompatibility==='compatible'?'compatible-targets':'incompatible-targets';
    if(analysis.status!==expected)throw Error('The verified target conflict disagrees with the same complete common-margin inquiry');
    if(analysis.status==='compatible-targets'){
      if(analysis.compatibleWitness.coordinates.some((v,i)=>cmp(v,context.solved.witness.coordinates[i])))
        throw Error('The compatible target witness must retain the already replayed common profile');
    }else{
      const indices=analysis.conflict.targetIndices;
      const removalWitnesses=analysis.conflict.removalWitnesses.map(value=>{
        const observedC=context.original.observedRows.map(row=>dot(row,value.masses));
        if(observedC.some((v,i)=>cmp(v,context.original.family.bands[i].lower)<0||cmp(v,context.original.family.bands[i].upper)>0))
          throw Error('A conflict removal witness lost an original observation');
        const witness=context.original.witnessFor({...value,observedC},value.removedTargetIndex);
        const targets=investigation.query.targets.map((target,index)=>{
          const original=base.targets[index],point=witness.originalReplays[0].originalCourse[target.originalIndex];
          if(point.utc!==original.utc||cmp(sub(exact(point.additiveC.proposal.lower[target.store]),exact(point.additiveC.existing.lower[target.store])),value.targetValuesC[index]))
            throw Error('A conflict removal witness lost an original target binding');
          const differences=Object.fromEntries(bounds.map(side=>[side,sub(q(point.originalC.proposal[side][target.store]),q(point.originalC.existing[side==='lower'?'upper':'lower'][target.store]))]));
          return {targetIndex:index,...target,utc:original.utc,cellIndex:base.cellIndex,ceilingC:original.ceilingC,
            inConflict:indices.includes(index),requiredAfterRemoval:value.requiredTargetIndices.includes(index),removedHere:index===value.removedTargetIndex,
            differenceC:profileFraction(value.targetValuesC[index]),excessC:profileFraction(value.targetExcessC[index]),withinDeclaredCeiling:cmp(value.targetExcessC[index],ZERO)<=0,
            originalReplay:{originalIndex:target.originalIndex,utc:original.utc,store:target.store,cellIndex:base.cellIndex,
              differenceC:Object.fromEntries(bounds.map(side=>[side,profileFraction(differences[side])])),
              endpointStatus:Object.fromEntries(bounds.map(side=>[side,cmp(differences[side],context.ceilings[index])<=0?'within-authored-ceiling':'above-authored-ceiling']))}};
        });
        return {removedTargetIndex:value.removedTargetIndex,requiredTargetIndices:value.requiredTargetIndices,targets,witness};
      });
      conflict={targetIndices:indices,minimality:analysis.conflict.minimality,removalWitnesses};
    }
  }
  const witnessCount=conflict?.removalWitnesses.length??0,extraCourses=witnessCount*reservation.uniqueSources*4;
  const executedThermalCourses=base.work.executedThermalCourses+extraCourses,executedWitnessCourses=base.work.executedWitnessCourses+extraCourses;
  const actualReplayEndpointRows=base.work.actualReplayEndpointRows+witnessCount*reservation.uniqueSources*reservation.originalBoundaries;
  const actualObservationReplayRows=base.work.actualObservationReplayRows+witnessCount*investigation.readings.length;
  const linearPivots=base.work.linearPivots+(analysis?.work.pivots??0),linearRationalOperations=base.work.linearRationalOperations+(analysis?.work.rationalOperations??0);
  if(executedThermalCourses>reservation.reservedThermalCourses||executedWitnessCourses>reservation.reservedWitnessCourses
      ||executedThermalCourses*reservation.intervals>reservation.courseIntervals||actualReplayEndpointRows>reservation.replayEndpointRows
      ||actualObservationReplayRows>reservation.observationReplayRows||linearPivots>reservation.maxLinearPivots||linearRationalOperations>reservation.maxLinearRationalOperations)
    throw Error('The complete target conflict exceeded its reserved work; no partial explanation is returned');
  const report={status:'compared',observationCompatibility:base.observationCompatibility,targetCompatibility:base.targetCompatibility,
    model:{...SKY_TARGET_CONFLICT_MODEL},query:structuredClone(investigation.query),cellIndex:base.cellIndex,originalTimes:base.originalTimes,splitUtcs:base.splitUtcs,
    targets:base.targets,conflict,originalTargetMargin:base,
    exactEvidence:analysis?serialize({targetTripleRows:context.targetRows,ceilings:context.ceilings,initialCertificate:seed,analysis}):null,
    work:{...reservation,executedBasisCourses:base.work.executedBasisCourses,executedWitnessCourses,executedConflictWitnessCourses:extraCourses,
      executedThermalCourses,executedCourseIntervals:executedThermalCourses*reservation.intervals,actualReplayEndpointRows,actualObservationReplayRows,
      linearPivots,linearRationalOperations,originalTargetPivots:base.work.linearPivots,originalTargetRationalOperations:base.work.linearRationalOperations,
      conflictFeasibility:analysis?.work??null,exactWitnessMarginalEqualities:base.work.exactWitnessMarginalEqualities+(conflict?.removalWitnesses.reduce((s,v)=>s+v.witness.exactMarginalEqualities,0)??0)},
    semantics:'Every original observation remains mandatory. The identified target group is jointly incompatible in the exact represented additive model. '
      +'Each final member has a feasible common-profile witness after removing only that member from this group, so the group is inclusion-minimal. '
      +'This does not prove the smallest possible number of conflicting targets. Targets outside the group remain authored and visible but are not required by a removal witness. '
      +'No target is edited or removed from the saved inquiry. Every displayed removal profile receives a complete original numerical replay with separate band and ceiling statuses. '
      +'No unselected or interpolated time, measured sky history, physical incompatibility or validated intervention is inferred.'};
  if(new Blob([JSON.stringify({investigation,report})]).size>SKY_TARGET_CONFLICT_LIMITS.maxReportBytes)
    throw Error('The complete target-conflict report exceeds its output allowance; no partial explanation is accepted');
  return {investigation,report};
}
export function parseSkyTargetConflictSource(text){
  if(typeof text!=='string')throw TypeError('Original target conflict inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);let raw;
  try{raw=JSON.parse(text);}catch{throw Error('Invalid original target conflict input JSON');}
  if(!exactSkyKeys(raw,['kind','model','readings','query'])||raw.kind!==SKY_TARGET_CONFLICT_KIND||!sameSkyData(raw.model,SKY_TARGET_CONFLICT_MODEL))
    throw Error('Use the complete original target conflict input model without saved calculations or unsupported fields');
  return prepareSkyTargetConflictSource(raw.readings,raw.query);
}
export function parseSkyTargetConflictEvidence(text){
  const source=parseSkyTargetConflictSource(text);return prepareSkyTargetConflictEvidence(source.readings,source.query);
}
export function serializeSkyTargetConflictSource(input){
  const source=parseSkyTargetConflictSource(JSON.stringify(input));let text=JSON.stringify(source,null,2)+'\n';
  try{checkShadeHeatBytes(new Blob([text]).size);}catch{text=JSON.stringify(source);}
  checkShadeHeatBytes(new Blob([text]).size);return text;
}
