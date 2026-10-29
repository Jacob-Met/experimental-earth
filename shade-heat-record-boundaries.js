import {checkShadeHeatBytes} from './shade-heat.js';
import {exactSkyKeys,sameSkyData,originalSkyReadingTimes} from './shade-heat-timed-reading-source.js';
import {prepareManySkyCourseSource,prepareManySkyCourseEvidence,inspectManySkyCourseWork,MANY_SKY_COURSE_LIMITS} from './shade-heat-many-course.js';
import {cmp} from './vendor/chronos/exact-halfplanes.mjs';

export const RECORD_BOUNDARY_KIND='experimental-earth/complete-record-sky-boundary-inputs/1';
export const RECORD_BOUNDARY_MODEL=Object.freeze({name:'complete-original-record-offered-sky-boundaries',version:1,
  observation:'the same complete three to 24 original instantaneous temperature bands at at most three receiver sources',
  alternatives:'one common four-bin early/late profile pair at each explicitly offered original internal change boundary',
  comparison:'retain every offered boundary, first-three reference and complete-record compatibility separately',
  consequence:'exact pointwise union over compatible offered boundaries; every attaining boundary and its original proof/profile identity is retained',
  limitation:'no interpolation, automatic time search, inferred physical change time or one-trajectory interpretation of the union envelope'});
export const RECORD_BOUNDARY_LIMITS=Object.freeze({maxOfferedBoundaries:23,
  maxGeometryChecks:MANY_SKY_COURSE_LIMITS.maxGeometryChecks,
  maxThermalCourses:23*MANY_SKY_COURSE_LIMITS.maxCourses,
  maxCourseIntervals:300000,
  maxReplayEndpointRows:23*MANY_SKY_COURSE_LIMITS.maxReplayEndpointRows,
  maxObservationReplayRows:23*MANY_SKY_COURSE_LIMITS.maxObservationReplayRows,
  maxLinearPivots:23*MANY_SKY_COURSE_LIMITS.maxLinearPivots,
  maxLinearRationalOperations:23*MANY_SKY_COURSE_LIMITS.maxLinearRationalOperations,
  maxReportBytes:64*1024*1024});
const stores=['surfaceC','subsurfaceC'],sides=['lower','upper'];
const exact=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
const singleQuery=(query,split)=>({bins:query.bins,splitAfterInterval:split,sharingSource:query.sharingSource});
const clock=row=>({index:row.index,utc:row.utc,minute:row.minute,thermalMinute:row.thermalMinute});

function reserve(source){
  const count=source.query.splitAfterIntervals.length;
  const perBoundary=inspectManySkyCourseWork(source.readings,singleQuery(source.query,source.query.splitAfterIntervals[0]));
  const work={offeredBoundaries:count,perBoundary,
    geometryPasses:count*perBoundary.geometryPasses,geometryChecks:count*perBoundary.geometryChecks,
    basisCourses:count*perBoundary.basisCourses,reservedWitnessCourses:count*perBoundary.reservedWitnessCourses,
    reservedThermalCourses:count*perBoundary.reservedThermalCourses,
    reservedCourseIntervals:count*perBoundary.courseIntervals,
    reservedReplayEndpointRows:count*perBoundary.replayEndpointRows,
    reservedObservationReplayRows:count*perBoundary.observationReplayRows,
    reservedLinearPivots:count*perBoundary.maxLinearPivots,
    reservedLinearRationalOperations:count*perBoundary.maxLinearRationalOperations};
  const limits=RECORD_BOUNDARY_LIMITS;
  if(work.geometryChecks>limits.maxGeometryChecks||work.reservedThermalCourses>limits.maxThermalCourses
      ||work.reservedCourseIntervals>limits.maxCourseIntervals||work.reservedReplayEndpointRows>limits.maxReplayEndpointRows
      ||work.reservedObservationReplayRows>limits.maxObservationReplayRows||work.reservedLinearPivots>limits.maxLinearPivots
      ||work.reservedLinearRationalOperations>limits.maxLinearRationalOperations)
    throw Error('The complete offered-boundary list exceeds its aggregate allowance; offer fewer boundaries without dropping original records');
  return work;
}

export function prepareRecordBoundarySource(originals,query){
  if(!exactSkyKeys(query,['bins','splitAfterIntervals','sharingSource'])||query.bins!==4
      ||!Array.isArray(query.splitAfterIntervals)||query.splitAfterIntervals.length<1
      ||query.splitAfterIntervals.length>RECORD_BOUNDARY_LIMITS.maxOfferedBoundaries
      ||!Array.from(query.splitAfterIntervals).every(value=>Number.isInteger(value)&&value>=1)
      ||new Set(query.splitAfterIntervals).size!==query.splitAfterIntervals.length)
    throw Error('Explicitly offer one to 23 distinct internal original interval boundaries in the intended order');
  const admitted=prepareManySkyCourseSource(originals,singleQuery(query,query.splitAfterIntervals[0]));
  const times=originalSkyReadingTimes(admitted.readings[0].source);
  if(query.splitAfterIntervals.some(value=>value>=times.length-1))
    throw Error('Every offered boundary must leave at least one complete original interval on each side');
  const source={kind:RECORD_BOUNDARY_KIND,model:{...RECORD_BOUNDARY_MODEL},readings:admitted.readings,
    query:{bins:4,splitAfterIntervals:[...query.splitAfterIntervals],sharingSource:query.sharingSource}};
  checkShadeHeatBytes(new Blob([JSON.stringify(source)]).size);
  reserve(source);return source;
}

function unionCourse(boundaries,firstThree){
  const reference=boundaries[0].report.pointwiseCourse;
  return reference.map((time,index)=>{
    const available=boundaries.flatMap(boundary=>{
      const family=firstThree?boundary.report.firstThree:boundary.report;
      const row=family.pointwiseCourse[index];
      if(!sameSkyData(clock(row),clock(time)))throw Error('Offered alternatives lost the identical original clock');
      if(family.compatibility==='incompatible'){
        if(row.ranges!==null)throw Error('An incompatible boundary cannot supply a consequence range');
        return [];
      }
      if(family.compatibility!=='compatible'||!row.ranges)throw Error('An offered boundary has no complete terminal family');
      return [{boundary,row}];
    });
    return {...clock(time),ranges:available.length?Object.fromEntries(stores.map(store=>[store,
      Object.fromEntries(sides.map(side=>{
        let value=null,attainments=[];
        for(const {boundary,row} of available){
          const endpoint=row.ranges[store][side];
          const order=value===null?null:cmp(exact(endpoint.differenceC),exact(value));
          const better=value===null||(side==='lower'?order<0:order>0);
          const origin={offeredIndex:boundary.offeredIndex,splitAfterInterval:boundary.splitAfterInterval,
            splitUtc:boundary.splitUtc,proofIndex:endpoint.proofIndex,
            ...(!firstThree?{witnessId:endpoint.witnessId}:{})};
          if(better){value=endpoint.differenceC;attainments=[origin];}
          else if(order===0)attainments.push(origin);
        }
        return [side,{differenceC:structuredClone(value),attainments}];
      }))])):null};
  });
}

function evaluate(source){
  const admitted=reserve(source),boundaries=[];
  let reportBytes=0;
  for(const [offeredIndex,split] of source.query.splitAfterIntervals.entries()){
    // The accepted single-boundary evaluator remains the only course producer.
    // No successful prefix is returned if any later alternative is refused.
    const {report}=prepareManySkyCourseEvidence(source.readings,singleQuery(source.query,split));
    reportBytes+=new Blob([JSON.stringify(report)]).size;
    if(reportBytes>RECORD_BOUNDARY_LIMITS.maxReportBytes)
      throw Error('The complete original-boundary evidence exceeds the report allowance; no partial comparison is accepted');
    if(report.query.splitAfterInterval!==split||report.readings.length!==source.readings.length)
      throw Error('An offered alternative lost its boundary or original record');
    if(report.compatibility==='compatible'&&report.firstThree.compatibility!=='compatible')
      throw Error('Additional original bands cannot rescue a rejected reference boundary');
    boundaries.push({offeredIndex,splitAfterInterval:split,splitUtc:report.splitUtc,report});
  }
  const pointwiseCourse=unionCourse(boundaries,false),referenceCourse=unionCourse(boundaries,true);
  const compatible=boundaries.filter(x=>x.report.compatibility==='compatible');
  const priorCompatible=boundaries.filter(x=>x.report.firstThree.compatibility==='compatible');
  const rangeChanges={narrowed:0,unchanged:0};
  for(const row of pointwiseCourse)if(row.ranges){
    const reference=referenceCourse[row.index];
    if(!reference.ranges)throw Error('The full-record union cannot rescue an empty reference union');
    for(const store of stores){
      let changed=false;
      for(const side of sides){
        const order=cmp(exact(row.ranges[store][side].differenceC),exact(reference.ranges[store][side].differenceC));
        if(side==='lower'?order<0:order>0)throw Error('The full-record union cannot widen the reference union');
        changed ||= order!==0;
      }
      rangeChanges[changed?'narrowed':'unchanged']++;
    }
  }
  const sum=key=>boundaries.reduce((total,boundary)=>total+boundary.report.work[key],0);
  const work={...admitted,executedBasisCourses:sum('executedBasisCourses'),
    executedWitnessCourses:sum('executedWitnessCourses'),executedThermalCourses:sum('executedThermalCourses'),
    executedCourseIntervals:sum('executedCourseIntervals'),actualReplayEndpointRows:sum('actualReplayEndpointRows'),
    actualObservationReplayRows:sum('actualObservationReplayRows'),linearPivots:sum('linearPivots'),
    linearRationalOperations:sum('linearRationalOperations'),actualSkyFaceTests:sum('actualSkyFaceTests'),boundaryReportBytes:reportBytes};
  if(work.executedBasisCourses!==admitted.basisCourses||work.executedWitnessCourses>admitted.reservedWitnessCourses
      ||work.executedThermalCourses>admitted.reservedThermalCourses||work.executedCourseIntervals>admitted.reservedCourseIntervals
      ||work.actualReplayEndpointRows>admitted.reservedReplayEndpointRows||work.actualObservationReplayRows>admitted.reservedObservationReplayRows
      ||work.linearPivots>admitted.reservedLinearPivots||work.linearRationalOperations>admitted.reservedLinearRationalOperations)
    throw Error('The complete offered-boundary comparison exceeded its admitted work');
  const report={status:'compared',compatibility:compatible.length?'compatible':'incompatible',model:{...RECORD_BOUNDARY_MODEL},
    query:structuredClone(source.query),cellIndex:source.readings[0].query.reading.cellIndex,
    originalRecordCount:source.readings.length,originalTimes:pointwiseCourse.map(clock),
    boundaries,pointwiseCourse,rangeChanges,
    firstThree:{compatibility:priorCompatible.length?'compatible':'incompatible',pointwiseCourse:referenceCourse},
    boundaryComparison:{offered:boundaries.length,firstThreeCompatible:priorCompatible.map(x=>x.offeredIndex),
      allRecordsCompatible:compatible.map(x=>x.offeredIndex),
      rejectedByAdditionalRecords:boundaries.filter(x=>x.report.firstThree.compatibility==='compatible'&&x.report.compatibility==='incompatible').map(x=>x.offeredIndex)},
    work,
    semantics:'Every explicitly offered original boundary is evaluated with the entire unchanged original record. '
      +'Compatibility is conditional on that boundary and the declared common sky/thermal/source model. '
      +'A rejected boundary cannot be silently omitted, and no unoffered time is considered. '
      +'First-three and all-record unions are separate. Exact ties retain every attaining offered boundary. '
      +'Each displayed profile and original numeric replay belongs to one named boundary. '
      +'Pointwise union endpoints may use different times of change and different profiles; they are not one possible trajectory. '
      +'Exact additive compatibility and separate original numerical replay are not physical validation or a recovered measured change time.'};
  const bytes=new Blob([JSON.stringify(report)]).size;
  if(bytes>RECORD_BOUNDARY_LIMITS.maxReportBytes)
    throw Error('The complete original-boundary evidence exceeds the report allowance; no partial comparison is accepted');
  return report;
}

export function prepareRecordBoundaryEvidence(originals,query){
  const investigation=prepareRecordBoundarySource(originals,query);
  return {investigation,report:evaluate(investigation)};
}
export function parseRecordBoundarySource(text){
  if(typeof text!=='string')throw TypeError('Original boundary inquiry inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);let raw;
  try{raw=JSON.parse(text);}catch{throw Error('Invalid complete-record boundary JSON');}
  if(!exactSkyKeys(raw,['kind','model','readings','query'])||raw.kind!==RECORD_BOUNDARY_KIND||!sameSkyData(raw.model,RECORD_BOUNDARY_MODEL))
    throw Error('Unsupported complete-record boundary inputs or saved calculated fields');
  return prepareRecordBoundarySource(raw.readings,raw.query);
}
export function parseRecordBoundaryEvidence(text){
  const investigation=parseRecordBoundarySource(text);return {investigation,report:evaluate(investigation)};
}
