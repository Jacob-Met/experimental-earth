import {checkShadeHeatBytes} from './shade-heat.js';
import {prepareManySkyCourseSource,inspectManySkyCourseWork,MANY_SKY_COURSE_LIMITS} from './shade-heat-many-course.js';
import {exactSkyKeys,sameSkyData,originalSkyReadingTimes} from './shade-heat-timed-reading-source.js';
import {buildThreeEpochBasis,replayThreeEpochWitness} from './shade-heat-three-epoch-kernel.js';
import {solveThreeEpochSkyObjectives,embeddedTwoEpochRows} from './shade-heat-three-epoch-marginals.js';
import {solveMarginalSkyObjectives} from './shade-heat-sky-marginals.js';
import {THREE_EPOCH_LINEAR_LIMITS} from './shade-heat-exact-linear.js';
import {profileFraction} from './shade-heat-profile-band.js';
import {rational as q,sub,neg,cmp} from './vendor/chronos/exact-halfplanes.mjs';

export const THREE_EPOCH_SKY_KIND='experimental-earth/three-declared-sky-epoch-inputs/1';
export const THREE_EPOCH_SKY_MODEL=Object.freeze({name:'complete-original-record-three-declared-sky-epochs',version:1,
  observation:'three to24 distinct original existing-temperature receiver/time/component bands, at most three complete receiver sources',
  profile:'three common four-bin profiles, each fixed across its declared epoch and shared by every original receiver and both designs',
  boundaries:'two strictly ordered explicitly chosen internal original interval boundaries; no inferred or interpolated time',
  coefficient:'exact represented C_i00+C_0j0+C_00k-2C_000 at every original state, screened against all64 complete original combination courses',
  consequence:'pointwise paired consequences at the first original receiver, separate first-three reference and two embedded one-change families',
  references:'one-change references join adjacent epoch profiles using the same exact three-epoch coefficient rows, not a separately rounded legacy fit',
  arithmetic:'nine exact marginal coordinates with original-matrix primal/dual or Farkas certificates; complete inquiry refusal on exhaustion'});
const {pairs:_legacyPairs,...originalRecordLimits}=MANY_SKY_COURSE_LIMITS;
export const THREE_EPOCH_SKY_LIMITS=Object.freeze({...originalRecordLimits,epochs:3,combinations:64,
  maxBasisCourses:768,maxCourses:1968,maxCourseIntervals:47232,maxReportBytes:64*1024*1024,
  maxLinearPivots:4*THREE_EPOCH_LINEAR_LIMITS.pivots,
  maxLinearRationalOperations:4*THREE_EPOCH_LINEAR_LIMITS.rationalOperations});
const stores=['surfaceC','subsurfaceC'],bounds=['lower','upper'];
const exact=v=>[BigInt(v.exact.numerator),BigInt(v.exact.denominator)];
const serialize=v=>JSON.parse(JSON.stringify(v,(_key,item)=>typeof item==='bigint'?item.toString():item));
const legacyQuery=query=>({bins:4,splitAfterInterval:query.splitAfterIntervals[0],sharingSource:query.sharingSource});

function preflight(source){
  const old=inspectManySkyCourseWork(source.readings,legacyQuery(source.query));
  if(source.query.splitAfterIntervals[1]>=old.intervals)throw Error('Both changes must be internal original interval boundaries');
  const basisCourses=old.uniqueSources*256,reservedThermalCourses=basisCourses+old.reservedWitnessCourses;
  const courseIntervals=reservedThermalCourses*old.intervals;
  if(basisCourses>THREE_EPOCH_SKY_LIMITS.maxBasisCourses||reservedThermalCourses>THREE_EPOCH_SKY_LIMITS.maxCourses
      ||courseIntervals>THREE_EPOCH_SKY_LIMITS.maxCourseIntervals)
    throw Error('All64 original combinations and complete witness courses exceed the three-epoch inquiry allowance');
  return {...old,basisCourses,reservedThermalCourses,courseIntervals,linearFamilies:4,
    maxLinearPivots:THREE_EPOCH_SKY_LIMITS.maxLinearPivots,
    maxLinearRationalOperations:THREE_EPOCH_SKY_LIMITS.maxLinearRationalOperations};
}

export function prepareThreeEpochSkySource(originals,query){
  if(!exactSkyKeys(query,['bins','splitAfterIntervals','sharingSource'])||query.bins!==4
      ||!Array.isArray(query.splitAfterIntervals)||query.splitAfterIntervals.length!==2
      ||!Object.hasOwn(query.splitAfterIntervals,0)||!Object.hasOwn(query.splitAfterIntervals,1)
      ||!query.splitAfterIntervals.every(Number.isInteger)||query.splitAfterIntervals[0]<1
      ||query.splitAfterIntervals[0]>=query.splitAfterIntervals[1])
    throw Error('Declare exactly two ordered distinct internal original changes and four common bins');
  const admitted=prepareManySkyCourseSource(originals,legacyQuery(query));
  const source={kind:THREE_EPOCH_SKY_KIND,model:{...THREE_EPOCH_SKY_MODEL},readings:admitted.readings,
    query:{bins:4,splitAfterIntervals:[...query.splitAfterIntervals],sharingSource:admitted.query.sharingSource}};
  checkShadeHeatBytes(new Blob([JSON.stringify(source)]).size);preflight(source);return source;
}

function evaluate(investigation){
  const work=preflight(investigation),splits=investigation.query.splitAfterIntervals;
  const representatives=work.sources.map(s=>s.recordIndex);
  const bases=representatives.map(i=>buildThreeEpochBasis(investigation.readings[i],splits));
  const originalTimes=bases[0].originalBoundaries;
  if(originalTimes.length!==work.originalBoundaries||bases.some(b=>!sameSkyData(b.originalBoundaries,originalTimes)
      ||!sameSkyData(b.originalBoundaries,originalSkyReadingTimes(b.input.source))))
    throw Error('Complete original three-epoch evaluator clocks disagree');
  if(bases.some(b=>cmp(b.maximumCourseDiscrepancyC,q(THREE_EPOCH_SKY_LIMITS.numericalConsistencyScreenC))>0))
    throw Error('An original combination exceeds the additive consistency screen; no partial record is accepted');
  const locations=investigation.readings.map((input,index)=>{
    const r=input.query.reading,sourceIndex=work.recordSourceIndices[index],basis=bases[sourceIndex];
    const originalIndex=originalTimes.findIndex(t=>t.utc===r.utc);
    if(originalIndex<0)throw Error('An original record time is absent from its unchanged complete course');
    if(!basis.triples.every(v=>v.trace.states.existing.lower[originalIndex][r.store]===v.trace.states.existing.upper[originalIndex][r.store]))
      throw Error('Original record '+(index+1)+' has unresolved existing endpoints at its original time/component');
    return {originalIndex,utc:r.utc,store:r.store,sourceIndex};
  });
  const bands=investigation.readings.map(input=>({temperatureC:input.query.reading.temperatureC,halfWidthC:input.query.reading.halfWidthC}));
  const observedRows=locations.map(at=>bases[at.sourceIndex].courseCoefficients[at.originalIndex].map(v=>v.values.existing.lower[at.store]));
  const axes=[],objectiveRows=[];
  for(const time of originalTimes)for(const store of stores)for(const side of bounds){
    const row=bases[0].courseCoefficients[time.index].map(v=>sub(v.values.proposal[side][store],v.values.existing[side==='lower'?'upper':'lower'][store]));
    axes.push({originalIndex:time.index,utc:time.utc,store,side});objectiveRows.push(side==='lower'?row.map(neg):row);
  }
  // Every requested family completes before any report becomes available.
  const prior=solveThreeEpochSkyObjectives(observedRows.slice(0,3),bands.slice(0,3),objectiveRows);
  const family=solveThreeEpochSkyObjectives(observedRows,bands,objectiveRows);
  const references=[0,1].map(i=>solveMarginalSkyObjectives(embeddedTwoEpochRows(observedRows,i),bands,embeddedTwoEpochRows(objectiveRows,i)));
  const profileIds=new Map(),profiles=[];
  const witnessIds=family.results.map(result=>{
    const key=JSON.stringify(serialize(result.phaseProfiles));
    if(!profileIds.has(key)){profileIds.set(key,profiles.length);profiles.push(result);}
    return profileIds.get(key);
  });
  const course=(solved,all=false)=>originalTimes.map(time=>({...time,ranges:solved.status==='feasible'?
    Object.fromEntries(stores.map((store,component)=>[store,Object.fromEntries(bounds.map((bound,side)=>{
      const index=time.index*4+component*2+side,value=solved.results[index].value;
      return [bound,{differenceC:profileFraction(side?value:neg(value)),proofIndex:index,...(all?{witnessId:witnessIds[index]}:{})}];
    }))])):null}));
  const firstCourse=course(prior),pointwiseCourse=course(family,true),referenceCourses=references.map(r=>course(r));
  const rangeChanges={narrowed:0,unchanged:0};
  for(const row of pointwiseCourse)if(row.ranges){
    if(!firstCourse[row.index].ranges)throw Error('A complete record cannot rescue its incompatible first-three family');
    for(const store of stores){
      let changed=false;
      for(const bound of bounds){
        const order=cmp(exact(row.ranges[store][bound].differenceC),exact(firstCourse[row.index].ranges[store][bound].differenceC));
        if(bound==='lower'?order<0:order>0)throw Error('Additional original records cannot widen a three-epoch range');
        changed ||= order!==0;
      }
      rangeChanges[changed?'narrowed':'unchanged']++;
    }
  }
  for(const reference of referenceCourses)for(const row of reference)if(row.ranges){
    const complete=pointwiseCourse[row.index];
    if(!complete.ranges)throw Error('An embedded one-change family cannot rescue an incompatible three-epoch family');
    for(const store of stores)for(const bound of bounds){
      const order=cmp(exact(complete.ranges[store][bound].differenceC),exact(row.ranges[store][bound].differenceC));
      if(bound==='lower'?order>0:order<0)throw Error('The exact three-profile family must contain each embedded one-change range');
    }
  }
  if(profiles.length>work.reservedWitnessProfiles)throw Error('The complete three-epoch witness allowance was exhausted');
  const witnesses=profiles.map((result,id)=>{
    const replay=replayThreeEpochWitness(result,id,bases,splits,THREE_EPOCH_SKY_LIMITS.numericalConsistencyScreenC);
    const originalObservations=locations.map((at,index)=>{
      const r=investigation.readings[index].query.reading,row=replay.originalReplays[at.sourceIndex].originalCourse[at.originalIndex];
      if(row.utc!==r.utc||cmp(exact(row.additiveC.existing.lower[r.store]),result.observedC[index]))throw Error('An original record lost its exact three-epoch witness identity');
      const originalC=Object.fromEntries(bounds.map(bound=>[bound,row.originalC.existing[bound][r.store]]));
      const endpointStatus=Object.fromEntries(bounds.map(bound=>{
        const value=q(originalC[bound]),band=family.bands[index];
        return [bound,cmp(value,band.lower)>=0&&cmp(value,band.upper)<=0?'within-original-band':'outside-original-band'];
      }));
      return {recordIndex:index,cellIndex:r.cellIndex,...at,originalC,endpointStatus};
    });
    const finalC=replay.originalReplays[0].originalCourse.at(-1).additiveC;
    const differenceC=Object.fromEntries(stores.map(store=>[store,[
      profileFraction(sub(exact(finalC.proposal.lower[store]),exact(finalC.existing.upper[store]))),
      profileFraction(sub(exact(finalC.proposal.upper[store]),exact(finalC.existing.lower[store]))),
    ]]));
    return {id,masses:result.masses.map(profileFraction),observedC:result.observedC.map(profileFraction),finalC,differenceC,...replay,originalObservations,
      originalReplays:replay.originalReplays.map((r,i)=>({...r,representativeReadingIndex:representatives[i]}))};
  });
  const executedBasisCourses=bases.reduce((sum,b)=>sum+b.executedCourses,0),executedWitnessCourses=witnesses.length*work.uniqueSources*4;
  const executedThermalCourses=executedBasisCourses+executedWitnessCourses;
  const actualReplayEndpointRows=witnesses.length*work.uniqueSources*originalTimes.length;
  const actualObservationReplayRows=witnesses.length*investigation.readings.length;
  const solved=[prior,family,...references],linearPivots=solved.reduce((s,v)=>s+v.work.pivots,0);
  const linearRationalOperations=solved.reduce((s,v)=>s+v.work.rationalOperations,0);
  if(executedBasisCourses!==work.basisCourses||executedThermalCourses>work.reservedThermalCourses
      ||executedWitnessCourses>work.reservedWitnessCourses||actualReplayEndpointRows>work.replayEndpointRows
      ||actualObservationReplayRows>work.observationReplayRows||linearPivots>work.maxLinearPivots
      ||linearRationalOperations>work.maxLinearRationalOperations)
    throw Error('The complete three-epoch inquiry exceeded its admitted work');
  const evidence=solved=>serialize({status:solved.status,linearModel:solved.linearModel,certificate:solved.certificate,
    objectives:solved.results.map((r,i)=>({...axes[i],projection:r.objective,maximumValue:r.value,certificate:r.linearCertificate}))});
  return {status:'compared',compatibility:family.status==='feasible'?'compatible':'incompatible',model:{...THREE_EPOCH_SKY_MODEL},
    query:structuredClone(investigation.query),cellIndex:investigation.readings[0].query.reading.cellIndex,
    finalUtc:originalTimes.at(-1).utc,splitUtcs:splits.map(i=>originalTimes[i].utc),intervalCount:work.intervals,
    originalTimes,pointwiseCourse,witnesses,rangeChanges,
    firstThree:{compatibility:prior.status==='feasible'?'compatible':'incompatible',pointwiseCourse:firstCourse,work:prior.work},
    embeddedOneChange:references.map((r,i)=>({referenceIndex:i,splitAfterInterval:splits[i],splitUtc:originalTimes[splits[i]].utc,
      joinedEpochs:i===0?[1,2]:[0,1],compatibility:r.status==='feasible'?'compatible':'incompatible',pointwiseCourse:referenceCourses[i],work:r.work})),
    readings:investigation.readings.map((input,i)=>({...input.query.reading,...locations[i],originalBins:input.query.bins,
      activeCommonBins:4,originalKind:input.kind,bandC:Object.fromEntries(bounds.map(bound=>[bound,profileFraction(family.bands[i][bound])]))})),
    exactEvidence:{coordinateOrder:['epoch0bin1','epoch0bin2','epoch0bin3','epoch1bin1','epoch1bin2','epoch1bin3','epoch2bin1','epoch2bin2','epoch2bin3'],
      constraintOrder:'three epoch sums then upper/lower original bands in saved order; nonnegative coordinates',
      fractionEncoding:'two decimal integer strings [numerator, positive denominator]',observedTripleRows:serialize(observedRows),objectiveTripleRows:serialize(objectiveRows),
      all:evidence(family),firstThree:evidence(prior),embeddedOneChange:references.map(evidence)},
    numericalEvidence:{consistencyScreenC:THREE_EPOCH_SKY_LIMITS.numericalConsistencyScreenC,
      scope:'All64 original combination states and every displayed original witness course are screened; no uniform every-profile or physical error bound is claimed.',
      points:bases.map((b,i)=>({sourceIndex:i,representativeReadingIndex:representatives[i],cellIndex:b.input.query.reading.cellIndex,
        maximumAdditiveCombinationDiscrepancyC:profileFraction(b.maximumCourseDiscrepancyC),originalBoundaryScreens:b.courseScreens}))},
    diagnostics:bases.map(b=>b.geometry.diagnostics),
    work:{...work,executedBasisCourses,executedWitnessCourses,executedThermalCourses,executedCourseIntervals:executedThermalCourses*work.intervals,
      actualReplayEndpointRows,actualObservationReplayRows,linearPivots,linearRationalOperations,
      allRecordOptimization:family.work,priorOptimization:prior.work,embeddedOptimizations:references.map(r=>r.work),
      actualSkyFaceTests:bases.reduce((s,b)=>s+b.geometry.sampled.diffuseSky.estimatedFaceTests,0),
      exactWitnessMarginalEqualities:witnesses.reduce((s,w)=>s+w.exactMarginalEqualities,0)},
    semantics:'Every original record constrains the same three declared sky profiles at its unchanged receiver, component and original UTC. '
      +'All64 complete original one-bin combinations validate the represented additive model under its stated numerical screen. The first-three and both embedded one-change families remain explicit. '
      +'The embedded references use identical represented three-epoch coefficients with adjacent profiles equal; they are not separately rounded legacy evaluator results. '
      +'Pointwise extremes can require different profiles and do not form one realizable trajectory. Each displayed witness retains one fixed three-profile course and separate original numerical band statuses. '
      +'This does not infer change times, reconstruct measured sky history, verify shared physical conditions or validate an intervention.'};
}

export function prepareThreeEpochSkyEvidence(originals,query){
  const investigation=prepareThreeEpochSkySource(originals,query),report=evaluate(investigation);
  if(new Blob([JSON.stringify({investigation,report})]).size>THREE_EPOCH_SKY_LIMITS.maxReportBytes)
    throw Error('The complete three-epoch report exceeds its bounded output allowance; no partial result is accepted');
  return {investigation,report};
}
export function parseThreeEpochSkySource(text){
  if(typeof text!=='string')throw TypeError('Three-epoch original inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);let raw;
  try{raw=JSON.parse(text);}catch{throw Error('Invalid three-epoch original input JSON');}
  if(!exactSkyKeys(raw,['kind','model','readings','query'])||raw.kind!==THREE_EPOCH_SKY_KIND||!sameSkyData(raw.model,THREE_EPOCH_SKY_MODEL))
    throw Error('Unsupported three-epoch model or saved calculated fields');
  return prepareThreeEpochSkySource(raw.readings,raw.query);
}
export function parseThreeEpochSkyEvidence(text){
  const source=parseThreeEpochSkySource(text);return prepareThreeEpochSkyEvidence(source.readings,source.query);
}
