import {checkShadeHeatBytes,SHADE_HEAT_LIMITS} from './shade-heat.js';
import {originalSkyReadingTimes,normalizeTimedSkyOriginal,exactSkyKeys,sameSkyData,sharedSkySite} from './shade-heat-timed-reading-source.js';
import {buildOriginalBoundaryBasis,consequences,inspectWitness} from './shade-heat-epoch-kernel.js';
import {solveMarginalSkyObjectives} from './shade-heat-sky-marginals.js';
import {SKY_LINEAR_LIMITS} from './shade-heat-exact-linear.js';
import {profileFraction} from './shade-heat-profile-band.js';
import {rational as q,sub,neg,cmp} from './vendor/chronos/exact-halfplanes.mjs';

export const MANY_SKY_COURSE_KIND='experimental-earth/many-original-sky-reading-inputs/1';
export const MANY_SKY_COURSE_MODEL=Object.freeze({name:'many-original-readings-two-epoch-course',version:1,
  observation:'three to 24 distinct original existing-temperature receiver/time/component bands on at most three complete original receiver sources',
  profile:'one common four-bin early profile and one common four-bin late profile for all original observations, times and designs',
  boundary:'one explicitly chosen internal original interval boundary',
  coefficient:'exact represented C_i0+C_0j-C_00 at original states, screened against all sixteen complete pair courses',
  consequence:'pointwise paired temperature bounds at the first original receiver; the first three original bands remain a separate reference family',
  arithmetic:'six exact marginal coordinates with original-matrix primal/dual or Farkas certificates; whole inquiry refusal on work exhaustion',
  repetition:'repeated receivers require identical complete original sources; duplicate receiver/time/component identities are refused'});
export const MANY_SKY_COURSE_LIMITS=Object.freeze({readings:24,uniqueSources:3,bins:4,pairs:16,maxIntervals:24,
  maxOriginalBoundaries:25,maxGeometryChecks:SHADE_HEAT_LIMITS.maxRayTests,maxBasisCourses:192,
  maxWitnessProfiles:100,maxWitnessCourses:1200,maxCourses:1392,maxCourseIntervals:33408,
  maxReplayEndpointRows:7500,maxObservationReplayRows:2400,maxLinearPivots:2*SKY_LINEAR_LIMITS.pivots,
  maxLinearRationalOperations:2*SKY_LINEAR_LIMITS.rationalOperations,numericalConsistencyScreenC:1e-9});
const stores=['surfaceC','subsurfaceC'],bounds=['lower','upper'];
const exact=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
const serialize=value=>JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item));

function sourceMap(readings){
  const representatives=[],indices=[],cells=new Map();
  readings.forEach((reading,index)=>{
    const cell=reading.query.reading.cellIndex;
    if(!cells.has(cell)){cells.set(cell,representatives.length);representatives.push(index);}
    indices.push(cells.get(cell));
  });
  return {representatives,indices};
}

function preflight(investigation){
  const {representatives,indices}=sourceMap(investigation.readings);
  if(representatives.length>MANY_SKY_COURSE_LIMITS.uniqueSources)throw Error('At most three complete original receiver sources are admitted');
  const sources=representatives.map(index=>{
    const source=investigation.readings[index].source,intervals=originalSkyReadingTimes(source).length-1;
    const cells=source.project.width*source.project.height;
    return {recordIndex:index,intervals,estimatedRayTests:6*(cells-1)*intervals,
      estimatedSkyFaceTests:4*(4*(cells-1)+4)*(cells-1)};
  });
  const intervals=sources[0].intervals,originalBoundaries=intervals+1,uniqueSources=sources.length;
  if(intervals<2||intervals>24||sources.some(source=>source.intervals!==intervals)
      ||investigation.query.splitAfterInterval>=intervals)
    throw Error('Retain every original interval and choose one internal original boundary');
  const geometryChecks=sources.reduce((sum,source)=>sum+source.estimatedRayTests+source.estimatedSkyFaceTests,0);
  const basisCourses=uniqueSources*64,reservedWitnessProfiles=4*originalBoundaries;
  const reservedWitnessCourses=reservedWitnessProfiles*uniqueSources*4,reservedThermalCourses=basisCourses+reservedWitnessCourses;
  const courseIntervals=reservedThermalCourses*intervals,replayEndpointRows=reservedWitnessProfiles*uniqueSources*originalBoundaries;
  const observationReplayRows=reservedWitnessProfiles*investigation.readings.length;
  if(geometryChecks>MANY_SKY_COURSE_LIMITS.maxGeometryChecks||reservedThermalCourses>MANY_SKY_COURSE_LIMITS.maxCourses
      ||courseIntervals>MANY_SKY_COURSE_LIMITS.maxCourseIntervals||replayEndpointRows>MANY_SKY_COURSE_LIMITS.maxReplayEndpointRows
      ||observationReplayRows>MANY_SKY_COURSE_LIMITS.maxObservationReplayRows)
    throw Error('The complete original record, both exact families and whole-course witnesses exceed the inquiry allowance');
  return {sources,recordSourceIndices:indices,uniqueSources,geometryPasses:uniqueSources,geometryChecks,intervals,originalBoundaries,
    basisCourses,reservedWitnessProfiles,reservedWitnessCourses,reservedThermalCourses,courseIntervals,replayEndpointRows,
    observationReplayRows,objectivesPerFamily:4*originalBoundaries,maxLinearPivots:MANY_SKY_COURSE_LIMITS.maxLinearPivots,
    maxLinearRationalOperations:MANY_SKY_COURSE_LIMITS.maxLinearRationalOperations};
}

export function prepareManySkyCourseSource(originals,query){
  if(!Array.isArray(originals)||originals.length<3||originals.length>24||Array.from(originals).some(value=>!value))
    throw Error('Supply three to 24 complete original reading inputs in the intended evidence order');
  if(!exactSkyKeys(query,['bins','splitAfterInterval','sharingSource'])||query.bins!==4
      ||!Number.isInteger(query.splitAfterInterval)||query.splitAfterInterval<1
      ||typeof query.sharingSource!=='string'||!query.sharingSource.trim()||query.sharingSource.length>400)
    throw Error('Declare four common bins, one internal original boundary and an attributed basis for shared sky conditions');
  checkShadeHeatBytes(new Blob([JSON.stringify({originals,query})]).size);
  const readings=originals.map(normalizeTimedSkyOriginal),site=sharedSkySite(readings[0].source);
  if(readings.some(reading=>!sameSkyData(sharedSkySite(reading.source),site)))
    throw Error('Original site, geometry, orientation, forcing and dated course must agree exactly');
  const identities=new Set(),receivers=new Map();
  for(const original of readings){
    const r=original.query.reading,key=JSON.stringify([r.cellIndex,r.utc,r.store]);
    if(identities.has(key))throw Error('Retain distinct original receiver/time/component identities; repeated evidence is not another observation');
    identities.add(key);
    if(receivers.has(r.cellIndex)&&!sameSkyData(receivers.get(r.cellIndex),original.source))
      throw Error('Repeated receiver readings require identical complete original receiver declarations');
    receivers.set(r.cellIndex,original.source);
  }
  const investigation={kind:MANY_SKY_COURSE_KIND,model:{...MANY_SKY_COURSE_MODEL},readings,query:{...query}};
  checkShadeHeatBytes(new Blob([JSON.stringify(investigation)]).size);preflight(investigation);return investigation;
}

function evaluate(investigation){
  const work=preflight(investigation),split=investigation.query.splitAfterInterval;
  // Identity and complete-source equality were admitted above. A receiver's
  // complete basis is shared only within this inquiry; no record is discarded.
  const representatives=work.sources.map(source=>source.recordIndex);
  const bases=representatives.map(index=>buildOriginalBoundaryBasis(investigation.readings[index],split));
  const originalBoundaries=bases[0].originalBoundaries;
  if(originalBoundaries.length!==work.originalBoundaries||bases.some(basis=>
      !sameSkyData(basis.originalBoundaries,originalBoundaries)
      ||!sameSkyData(basis.originalBoundaries,originalSkyReadingTimes(basis.input.source))))
    throw Error('Complete original evaluator clocks disagree');
  if(bases.some(basis=>cmp(basis.maximumCourseDiscrepancyC,q(MANY_SKY_COURSE_LIMITS.numericalConsistencyScreenC))>0))
    throw Error('An original pair course exceeds the additive screen; no partial record is accepted');
  const locations=investigation.readings.map((input,index)=>{
    const r=input.query.reading,sourceIndex=work.recordSourceIndices[index],basis=bases[sourceIndex];
    const originalIndex=originalBoundaries.findIndex(time=>time.utc===r.utc);
    if(originalIndex<0)throw Error('An original observation UTC is absent from its complete source course');
    if(!basis.pairs.every(pair=>pair.trace.states.existing.lower[originalIndex][r.store]===pair.trace.states.existing.upper[originalIndex][r.store]))
      throw Error('Original reading '+(index+1)+' has unresolved existing endpoints at its original time/component');
    return {originalIndex,utc:r.utc,store:r.store,sourceIndex};
  });
  const bands=investigation.readings.map(input=>({temperatureC:input.query.reading.temperatureC,halfWidthC:input.query.reading.halfWidthC}));
  const observedRows=locations.map(location=>bases[location.sourceIndex].courseCoefficients[location.originalIndex]
    .map(pair=>pair.final.existing.lower[location.store]));
  const axes=[],objectiveRows=[];
  for(const boundary of originalBoundaries)for(const store of stores)for(const side of bounds){
    const row=bases[0].courseCoefficients[boundary.index].map(pair=>sub(pair.final.proposal[side][store],
      pair.final.existing[side==='lower'?'upper':'lower'][store]));
    axes.push({originalIndex:boundary.index,utc:boundary.utc,store,side});
    objectiveRows.push(side==='lower'?row.map(neg):row);
  }
  // Both complete objective families are atomic. An exhausted later family
  // throws before any partial report or earlier feasible subset is returned.
  const prior=solveMarginalSkyObjectives(observedRows.slice(0,3),bands.slice(0,3),objectiveRows);
  const family=solveMarginalSkyObjectives(observedRows,bands,objectiveRows);
  const profileIds=new Map(),profiles=[];
  const witnessIds=family.results.map(result=>{
    const key=JSON.stringify(serialize(result.phaseProfiles));
    if(!profileIds.has(key)){profileIds.set(key,profiles.length);profiles.push(result);}
    return profileIds.get(key);
  });
  const course=(solved,all)=>originalBoundaries.map(boundary=>({...boundary,ranges:solved.status==='feasible'?
    Object.fromEntries(stores.map((store,component)=>[store,Object.fromEntries(bounds.map((bound,side)=>{
      const index=boundary.index*4+component*2+side,value=solved.results[index].value;
      return [bound,{differenceC:profileFraction(side?value:neg(value)),proofIndex:index,...(all?{witnessId:witnessIds[index]}:{})}];
    }))])):null}));
  const priorCourse=course(prior,false),pointwiseCourse=course(family,true);
  const rangeChanges={narrowed:0,unchanged:0};
  for(const row of pointwiseCourse)if(row.ranges){
    const before=priorCourse[row.index];if(!before.ranges)throw Error('Additional original bands cannot rescue an incompatible reference family');
    for(const store of stores){
      let changed=false;
      for(const bound of bounds){
        const order=cmp(exact(row.ranges[store][bound].differenceC),exact(before.ranges[store][bound].differenceC));
        if(bound==='lower'?order<0:order>0)throw Error('The complete original record cannot widen the leading-three exact range');
        changed ||= order!==0;
      }
      rangeChanges[changed?'narrowed':'unchanged']++;
    }
  }
  if(profiles.length>work.reservedWitnessProfiles)throw Error('Complete witness-profile allowance exhausted');
  const witnesses=profiles.map((result,id)=>{
    const support=result.masses.flatMap((mass,index)=>mass[0]?[index]:[]);
    const candidate={support,weights:support.map(index=>result.masses[index]),observed:result.observedC};
    const final=consequences([candidate],bases[0].coefficients);
    const replay=inspectWitness({...final.selected[0],id},bases,representatives.map(index=>bands[index]),split,
      MANY_SKY_COURSE_LIMITS.numericalConsistencyScreenC,true,representatives.map(index=>locations[index]));
    const originalObservations=locations.map((location,index)=>{
      const r=investigation.readings[index].query.reading,row=replay.originalReplays[location.sourceIndex].originalCourse[location.originalIndex];
      if(row.utc!==r.utc||cmp(exact(row.additiveC.existing.lower[r.store]),result.observedC[index]))
        throw Error('An original record lost its exact witness identity');
      const originalC=Object.fromEntries(bounds.map(bound=>[bound,row.originalC.existing[bound][r.store]]));
      const endpointStatus=Object.fromEntries(bounds.map(bound=>{
        const value=q(originalC[bound]),band=family.bands[index];
        return [bound,cmp(value,band.lower)>=0&&cmp(value,band.upper)<=0?'within-original-band':'outside-original-band'];
      }));
      return {recordIndex:index,cellIndex:r.cellIndex,...location,originalC,endpointStatus};
    });
    return {...final.witnesses[0],id,...replay,originalObservations,
      originalReplays:replay.originalReplays.map((value,sourceIndex)=>({...value,sourceIndex,representativeReadingIndex:representatives[sourceIndex]}))};
  });
  const executedBasisCourses=bases.reduce((sum,basis)=>sum+basis.executedCourses,0);
  const executedWitnessCourses=witnesses.length*work.uniqueSources*4,executedThermalCourses=executedBasisCourses+executedWitnessCourses;
  const actualReplayEndpointRows=witnesses.length*work.uniqueSources*originalBoundaries.length;
  const actualObservationReplayRows=witnesses.length*investigation.readings.length;
  const linearPivots=prior.work.pivots+family.work.pivots,linearRationalOperations=prior.work.rationalOperations+family.work.rationalOperations;
  if(executedBasisCourses!==work.basisCourses||executedWitnessCourses>work.reservedWitnessCourses
      ||executedThermalCourses>work.reservedThermalCourses||actualReplayEndpointRows>work.replayEndpointRows
      ||actualObservationReplayRows>work.observationReplayRows||linearPivots>work.maxLinearPivots
      ||linearRationalOperations>work.maxLinearRationalOperations)
    throw Error('The complete original-record inquiry exceeded its admitted work');
  const evidence=solved=>serialize({status:solved.status,linearModel:solved.linearModel,certificate:solved.certificate,
    objectives:solved.results.map((result,index)=>({...axes[index],projection:result.objective,
      maximumValue:result.value,certificate:result.linearCertificate}))});
  return {status:'compared',compatibility:family.status==='feasible'?'compatible':'incompatible',model:{...MANY_SKY_COURSE_MODEL},
    query:{...investigation.query},cellIndex:investigation.readings[0].query.reading.cellIndex,finalUtc:originalBoundaries.at(-1).utc,
    splitUtc:bases[0].splitUtc,intervalCount:work.intervals,pointwiseCourse,witnesses,rangeChanges,
    firstThree:{compatibility:prior.status==='feasible'?'compatible':'incompatible',pointwiseCourse:priorCourse,work:prior.work},
    readings:investigation.readings.map((input,index)=>({...input.query.reading,...locations[index],originalBins:input.query.bins,
      activeCommonBins:4,originalKind:input.kind,bandC:Object.fromEntries(bounds.map(bound=>[bound,profileFraction(family.bands[index][bound])]))})),
    exactEvidence:{coordinateOrder:['early1','early2','early3','late1','late2','late3'],
      constraintOrder:'early sum, late sum, then original upper/lower band inequalities in saved record order; all coordinates nonnegative',
      fractionEncoding:'two decimal integer strings [numerator, positive denominator]',
      observedPairRows:serialize(observedRows),objectivePairRows:serialize(objectiveRows),all:evidence(family),firstThree:evidence(prior)},
    numericalEvidence:{consistencyScreenC:MANY_SKY_COURSE_LIMITS.numericalConsistencyScreenC,
      scope:'Every original pair state and displayed original witness course is screened; this is not a uniform every-profile or physical error bound.',
      points:bases.map((basis,sourceIndex)=>({sourceIndex,representativeReadingIndex:representatives[sourceIndex],
        cellIndex:basis.input.query.reading.cellIndex,maximumAdditivePairDiscrepancyC:profileFraction(basis.maximumCourseDiscrepancyC),
        originalBoundaryScreens:basis.courseScreens}))},diagnostics:bases.map(basis=>basis.geometry.diagnostics),
    work:{...work,executedBasisCourses,executedWitnessCourses,executedThermalCourses,
      executedCourseIntervals:executedThermalCourses*work.intervals,actualReplayEndpointRows,actualObservationReplayRows,
      linearPivots,linearRationalOperations,allRecordOptimization:family.work,priorOptimization:prior.work,
      actualSkyFaceTests:bases.reduce((sum,basis)=>sum+basis.geometry.sampled.diffuseSky.estimatedFaceTests,0),
      exactWitnessMarginalEqualities:witnesses.reduce((sum,witness)=>sum+witness.exactMarginalEqualities,0)},
    semantics:'Every original instant band constrains the same early/late sky at its actual receiver, component and original UTC. '
      +'All admitted records remain constraints; the first three form an explicit reference family. Additional records can narrow or reject it, or leave a bound unchanged. '
      +'Identical complete receiver sources share one basis and one replay per witness within this inquiry; every observation retains its own exact and numerical checks. '
      +'Pointwise extrema can use different profiles, so the envelope is not one realized course. Each displayed witness uses one fixed profile pair across every original time and source. '
      +'Exact additive bands and separate original numerical replay statuses are not solver enclosures, a reconstructed measured sky history or validated physical interventions. No interpolation or interval-mean inference is made.'};
}

export function prepareManySkyCourseEvidence(originals,query){
  const investigation=prepareManySkyCourseSource(originals,query);return {investigation,report:evaluate(investigation)};
}
// Complete reservation for callers composing several unchanged inquiries. This
// performs the same original-source admission and does not execute a course.
export function inspectManySkyCourseWork(originals,query){
  return preflight(prepareManySkyCourseSource(originals,query));
}
export function parseManySkyCourseSource(text){
  if(typeof text!=='string')throw TypeError('Original-record sky inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);let raw;
  try{raw=JSON.parse(text);}catch{throw Error('Invalid original-record sky JSON');}
  if(!exactSkyKeys(raw,['kind','model','readings','query'])||raw.kind!==MANY_SKY_COURSE_KIND||!sameSkyData(raw.model,MANY_SKY_COURSE_MODEL))
    throw Error('Unsupported original-record sky model or saved calculated fields');
  return prepareManySkyCourseSource(raw.readings,raw.query);
}
export function parseManySkyCourseEvidence(text){
  const investigation=parseManySkyCourseSource(text);return {investigation,report:evaluate(investigation)};
}
