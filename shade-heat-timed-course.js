import { checkShadeHeatBytes, SHADE_HEAT_LIMITS } from './shade-heat.js';
import { originalSkyReadingTimes, normalizeTimedSkyOriginal, exactSkyKeys, sameSkyData, sharedSkySite } from './shade-heat-timed-reading-source.js';
import { buildOriginalBoundaryBasis, consequences, inspectWitness } from './shade-heat-epoch-kernel.js';
import { intersectThreeProfileBands, intersectThreeRationalProfileBands, THREE_PROFILE_BAND_MAX_CANDIDATES } from './shade-heat-profile-three-bands.js';
import { intersectTwoRationalProfileBands } from './shade-heat-profile-two-bands.js';
import { profileFraction } from './shade-heat-profile-band.js';
import { rational as q, cmp } from './vendor/chronos/exact-halfplanes.mjs';

export const TIMED_SKY_COURSE_KIND = 'experimental-earth/three-original-time-sky-course-inputs/1';
export const TIMED_SKY_COURSE_MODEL = Object.freeze({ name:'three-original-time-readings-two-epoch-course',version:1,
  observation:'three distinct original existing-temperature receiver/time/component identities on one original site and course',
  profile:'one common four-bin early profile and one common four-bin late profile for all observations, times and designs',
  boundary:'one explicitly chosen internal original interval boundary',
  coefficient:'exact represented C_i0+C_0j-C_00 at original states, screened against all sixteen complete pair courses',
  consequence:'pointwise paired temperature bounds at the first original receiver; leading-two evidence retained separately',
  repetition:'repeated receivers require identical complete original receiver sources; repeated observation identities are refused' });
export const TIMED_SKY_COURSE_LIMITS = Object.freeze({sources:3,bins:4,pairs:16,maxIntervals:24,maxOriginalBoundaries:25,
  maxGeometryChecks:SHADE_HEAT_LIMITS.maxRayTests,maxBasisCourses:192,
  maxWitnessProfiles:100,maxWitnessCourses:1200,maxCourses:1392,maxCourseIntervals:33408,
  maxCandidates:THREE_PROFILE_BAND_MAX_CANDIDATES,maxPriorCandidates:2736,maxStaticCandidates:192,
  maxCourseObjectiveMixtureTerms:(THREE_PROFILE_BAND_MAX_CANDIDATES+2736)*25*8*4,
  maxReplayEndpointRows:7500,numericalConsistencyScreenC:1e-9 });
const targets=['existing','proposal'],bounds=['lower','upper'],stores=['surfaceC','subsurfaceC'];
const fraction=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
const mapFinal=get=>Object.fromEntries(targets.map(target=>[target,Object.fromEntries(bounds.map(bound=>[bound,
  Object.fromEntries(stores.map(store=>[store,get(target,bound,store)]))]))]));

function preflight(investigation) {
  const sources=investigation.readings.map(({source})=>{
    const times=originalSkyReadingTimes(source),intervals=times.length-1,cells=source.project.width*source.project.height;
    return {intervals,estimatedRayTests:6*(cells-1)*intervals,estimatedSkyFaceTests:4*(4*(cells-1)+4)*(cells-1)};
  });
  const intervals=sources[0].intervals,originalBoundaries=intervals+1;
  if (sources.length!==3 || sources.some(source=>source.intervals!==intervals) || intervals<2 || intervals>24
      || investigation.query.splitAfterInterval>=intervals)
    throw Error('Retain all three complete original sources and one internal original interval boundary');
  const geometryChecks=sources.reduce((sum,source)=>sum+source.estimatedRayTests+source.estimatedSkyFaceTests,0);
  const basisCourses=192,reservedWitnessProfiles=4*originalBoundaries,reservedWitnessCourses=12*reservedWitnessProfiles;
  const reservedThermalCourses=basisCourses+reservedWitnessCourses,courseIntervals=reservedThermalCourses*intervals;
  const courseObjectiveMixtureTerms=(TIMED_SKY_COURSE_LIMITS.maxCandidates+TIMED_SKY_COURSE_LIMITS.maxPriorCandidates)*originalBoundaries*8*4;
  const replayEndpointRows=reservedWitnessProfiles*3*originalBoundaries;
  if (geometryChecks>TIMED_SKY_COURSE_LIMITS.maxGeometryChecks
      || reservedThermalCourses>TIMED_SKY_COURSE_LIMITS.maxCourses
      || courseIntervals>TIMED_SKY_COURSE_LIMITS.maxCourseIntervals
      || courseObjectiveMixtureTerms>TIMED_SKY_COURSE_LIMITS.maxCourseObjectiveMixtureTerms
      || replayEndpointRows>TIMED_SKY_COURSE_LIMITS.maxReplayEndpointRows)
    throw Error('All original bases, both complete evidence families and whole-course witnesses exceed the inquiry allowance');
  return {sources,geometryPasses:3,geometryChecks,intervals,originalBoundaries,basisCourses,
    reservedWitnessProfiles,reservedWitnessCourses,reservedThermalCourses,courseIntervals,
    courseObjectiveMixtureTerms,replayEndpointRows,
    candidateCapacity:TIMED_SKY_COURSE_LIMITS.maxCandidates+TIMED_SKY_COURSE_LIMITS.maxPriorCandidates+TIMED_SKY_COURSE_LIMITS.maxStaticCandidates};
}

export function prepareTimedSkyCourseSource(originals,query) {
  if (!Array.isArray(originals) || originals.length!==3 || Array.from(originals).some(value=>!value))
    throw Error('Supply exactly three complete original reading inputs in the intended evidence order');
  if (!exactSkyKeys(query,['bins','splitAfterInterval','sharingSource']) || query.bins!==4
      || !Number.isInteger(query.splitAfterInterval) || query.splitAfterInterval<1
      || typeof query.sharingSource!=='string' || !query.sharingSource.trim() || query.sharingSource.length>400)
    throw Error('Declare four common bins, one original internal change boundary and the attributed basis for sharing sky conditions');
  checkShadeHeatBytes(new Blob([JSON.stringify({originals,query})]).size);
  const readings=originals.map(normalizeTimedSkyOriginal),site=sharedSkySite(readings[0].source);
  if (readings.some(reading=>!sameSkyData(sharedSkySite(reading.source),site)))
    throw Error('Original site, geometry, orientation, forcing and dated course must agree exactly');
  const identities=new Set(),receivers=new Map();
  for (const original of readings) {
    const r=original.query.reading,key=JSON.stringify([r.cellIndex,r.utc,r.store]);
    if (identities.has(key)) throw Error('Retain three distinct original receiver/time/component identities; repeated evidence is not another observation');
    identities.add(key);
    if (receivers.has(r.cellIndex) && !sameSkyData(receivers.get(r.cellIndex),original.source))
      throw Error('Repeated receiver readings require identical complete original receiver declarations');
    receivers.set(r.cellIndex,original.source);
  }
  const investigation={kind:TIMED_SKY_COURSE_KIND,model:{...TIMED_SKY_COURSE_MODEL},readings,query:{...query}};
  checkShadeHeatBytes(new Blob([JSON.stringify(investigation)]).size);preflight(investigation);
  return investigation;
}

function staticReport(bases,locations,bands,additive) {
  const rows=bases.map((basis,index)=>{
    const at=locations[index],diagonal=basis.pairs.filter(pair=>pair.early===pair.late);
    return additive ? basis.courseCoefficients[at.originalIndex].filter(pair=>pair.early===pair.late).map(value=>value.final.existing.lower[at.store])
      : diagonal.map(pair=>pair.trace.states.existing.lower[at.originalIndex][at.store]);
  });
  const family=(additive?intersectThreeRationalProfileBands:intersectThreeProfileBands)(rows,bands);
  const coefficients=additive?bases[0].coefficients.filter(pair=>pair.early===pair.late)
    :bases[0].pairs.filter(pair=>pair.early===pair.late).map(pair=>({...pair,final:mapFinal((target,bound,store)=>q(pair.final[target][bound][store]))}));
  const result=consequences(family.candidates,coefficients);
  return {compatibility:family.status,ranges:result.ranges,witnesses:result.witnesses,work:family.work};
}

function evaluate(investigation) {
  const work=preflight(investigation),split=investigation.query.splitAfterInterval;
  // Complete all three source bases, including repeated receivers, before any
  // compatibility test. No favorable time/source subset is used as a fallback.
  const bases=investigation.readings.map(input=>buildOriginalBoundaryBasis(input,split));
  const originalBoundaries=bases[0].originalBoundaries;
  if (originalBoundaries.length!==work.originalBoundaries || bases.some(basis=>
      !sameSkyData(basis.originalBoundaries,originalBoundaries)
      || !sameSkyData(basis.originalBoundaries,originalSkyReadingTimes(basis.input.source))))
    throw Error('Original source clocks do not match the complete original evaluator states');
  const locations=investigation.readings.map((input,index)=>{
    const r=input.query.reading,basis=bases[index];
    const originalIndex=originalBoundaries.findIndex(time=>time.utc===r.utc);
    if (originalIndex<0) throw Error('The original observation UTC is absent from the complete course');
    if (!basis.pairs.every(pair=>pair.trace.states.existing.lower[originalIndex][r.store]===pair.trace.states.existing.upper[originalIndex][r.store]))
      throw Error('Original reading '+(index+1)+' has unresolved existing endpoints at its original time/component');
    if (cmp(basis.maximumCourseDiscrepancyC,q(TIMED_SKY_COURSE_LIMITS.numericalConsistencyScreenC))>0)
      throw Error('An original pair course exceeds the declared additive screen; no partial inquiry is accepted');
    return {originalIndex,utc:r.utc,store:r.store};
  });
  const bands=investigation.readings.map(({query:{reading:r}})=>({temperatureC:r.temperatureC,halfWidthC:r.halfWidthC}));
  const rows=bases.map((basis,index)=>basis.courseCoefficients[locations[index].originalIndex].map(v=>v.final.existing.lower[locations[index].store]));
  const prior=intersectTwoRationalProfileBands(rows.slice(0,2),bands.slice(0,2));
  const family=intersectThreeRationalProfileBands(rows,bands);
  if (family.candidates.length>TIMED_SKY_COURSE_LIMITS.maxCandidates || prior.candidates.length>TIMED_SKY_COURSE_LIMITS.maxPriorCandidates)
    throw Error('The complete original-time candidate allowance is exhausted');
  const selectedIds=new Set(),priorCourse=[];
  const pointwiseCourse=originalBoundaries.map((boundary,time)=>{
    const result=consequences(family.candidates,bases[0].courseCoefficients[time]);
    const leading=consequences(prior.candidates,bases[0].courseCoefficients[time]);
    for (const witness of result.witnesses) selectedIds.add(witness.id);
    if (result.ranges) {
      if (!leading.ranges) throw Error('A third original band cannot rescue an incompatible leading-two family');
      for (const store of stores) for (const bound of bounds) {
        const order=cmp(fraction(result.ranges[store][bound].differenceC),fraction(leading.ranges[store][bound].differenceC));
        if (bound==='lower'?order<0:order>0) throw Error('A third original band cannot widen a retained exact range');
      }
    }
    // Prior-family candidate ids remain scoped to that family; they are not
    // links to the all-three whole-course witness collection.
    const ranges=leading.ranges?Object.fromEntries(stores.map(store=>[store,Object.fromEntries(bounds.map(bound=>
      [bound,{differenceC:leading.ranges[store][bound].differenceC,candidateId:leading.ranges[store][bound].witnessId}]))])):null;
    priorCourse.push({...boundary,ranges});
    return {...boundary,ranges:result.ranges};
  });
  if (selectedIds.size>work.reservedWitnessProfiles) throw Error('Complete original-time witness allowance exhausted');
  const witnesses=[...selectedIds].map(id=>{
    const final=consequences([family.candidates[id]],bases[0].coefficients),item={...final.selected[0],id};
    return {...final.witnesses[0],id,...inspectWitness(item,bases,bands,split,
      TIMED_SKY_COURSE_LIMITS.numericalConsistencyScreenC,true,locations)};
  });
  const originalStatic=staticReport(bases,locations,bands,false),additiveStatic=staticReport(bases,locations,bands,true);
  const executedBasisCourses=bases.reduce((sum,basis)=>sum+basis.executedCourses,0);
  const executedWitnessCourses=witnesses.length*12,executedThermalCourses=executedBasisCourses+executedWitnessCourses;
  const actualCourseObjectiveMixtureTerms=originalBoundaries.length*8*[...family.candidates,...prior.candidates]
    .reduce((sum,candidate)=>sum+candidate.support.length,0);
  const actualReplayEndpointRows=witnesses.length*3*originalBoundaries.length;
  if (executedBasisCourses!==work.basisCourses || executedWitnessCourses>work.reservedWitnessCourses
      || executedThermalCourses>work.reservedThermalCourses || executedThermalCourses*work.intervals>work.courseIntervals
      || actualCourseObjectiveMixtureTerms>work.courseObjectiveMixtureTerms || actualReplayEndpointRows>work.replayEndpointRows
      || originalStatic.work.candidates+additiveStatic.work.candidates>TIMED_SKY_COURSE_LIMITS.maxStaticCandidates)
    throw Error('Complete original-time execution exceeded its admitted work; no partial report is accepted');
  return {status:'compared',compatibility:family.status,model:{...TIMED_SKY_COURSE_MODEL},query:{...investigation.query},
    cellIndex:investigation.readings[0].query.reading.cellIndex,finalUtc:originalBoundaries.at(-1).utc,splitUtc:bases[0].splitUtc,
    intervalCount:work.intervals,pointwiseCourse,witnesses,
    firstTwo:{compatibility:prior.status,pointwiseCourse:priorCourse,work:prior.work},
    readings:investigation.readings.map((input,index)=>({...input.query.reading,originalIndex:locations[index].originalIndex,
      originalBins:input.query.bins,activeCommonBins:4,originalKind:input.kind,
      bandC:Object.fromEntries(bounds.map(bound=>[bound,profileFraction(family.bands[index][bound])]))})),
    originalStatic,additiveStatic,staticCompatibilityAgrees:originalStatic.compatibility===additiveStatic.compatibility,
    numericalEvidence:{consistencyScreenC:TIMED_SKY_COURSE_LIMITS.numericalConsistencyScreenC,
      scope:'All original pair states and displayed original witness courses screened; not a uniform every-profile or physical error bound.',
      points:bases.map(basis=>({cellIndex:basis.input.query.reading.cellIndex,
        maximumAdditivePairDiscrepancyC:profileFraction(basis.maximumCourseDiscrepancyC),originalBoundaryScreens:basis.courseScreens}))},
    diagnostics:bases.map(basis=>basis.geometry.diagnostics),
    work:{...work,executedBasisCourses,executedWitnessCourses,executedThermalCourses,executedCourseIntervals:executedThermalCourses*work.intervals,
      actualCourseObjectiveMixtureTerms,actualReplayEndpointRows,
      actualSkyFaceTests:bases.reduce((sum,basis)=>sum+basis.geometry.sampled.diffuseSky.estimatedFaceTests,0),
      profileIntersection:family.work,priorProfileIntersection:prior.work,
      exactWitnessMarginalEqualities:witnesses.reduce((sum,witness)=>sum+witness.exactMarginalEqualities,0)},
    semantics:'Each original instant band constrains the same common early/late sky at its own exact receiver, component and original UTC. '
      +'The complete original source course is never truncated, resampled or moved to the final reading time. Repeated receivers retain identical fixed declarations. '
      +'The leading-two envelope is separate evidence; adding the third band cannot widen it, but may add no constraint. '
      +'Pointwise extrema can require different profiles; the envelope is not one realized trajectory. Each displayed all-three witness replays one fixed profile pair across every original source and time. '
      +'Exact additive bands and separate original numerical statuses are not solver enclosures, reconstructed measured histories, identified physical skies or validated interventions. No continuous-time or interval-mean inference is made.'};
}

export function prepareTimedSkyCourseEvidence(originals,query) {
  const investigation=prepareTimedSkyCourseSource(originals,query);
  return {investigation,report:evaluate(investigation)};
}
export function parseTimedSkyCourseSource(text) {
  if (typeof text!=='string') throw TypeError('Original-time sky inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);let raw;
  try {raw=JSON.parse(text);} catch {throw Error('Invalid original-time sky JSON');}
  if (!exactSkyKeys(raw,['kind','model','readings','query']) || raw.kind!==TIMED_SKY_COURSE_KIND || !sameSkyData(raw.model,TIMED_SKY_COURSE_MODEL))
    throw Error('Unsupported original-time sky model or saved calculated fields');
  return prepareTimedSkyCourseSource(raw.readings,raw.query);
}
export function parseTimedSkyCourseEvidence(text) {
  const investigation=parseTimedSkyCourseSource(text);
  return {investigation,report:evaluate(investigation)};
}
