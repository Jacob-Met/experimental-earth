import {validateProject} from './core.js';
import {solarContext} from './solar-occlusion-contract.js';
import {compareSunPath,validateSunPath,sunPathUtc,SUN_PATH_MODEL,SUN_PATH_LIMITS} from './solar-path.js';
import {SUN_PATH_INVESTIGATION_KIND,reopenSunPathInvestigation} from './solar-path-receipt.js';
import {summarizeSunPathSpatial} from './solar-path-spatial.js';

export const SUN_DATES_KIND='experimental-earth/sun-dates-inputs/1';
export const SUN_DATES_LIMITS=Object.freeze({maxCourses:8,maxBytes:6*1024*1024,maxRayTests:SUN_PATH_LIMITS.maxRayTests});
export const SUN_DATES_SEMANTICS='Every date uses the same retained site, location, true-north orientation, UTC starting clock, elapsed duration and sample spacing. '
 +'Equal UTC clocks do not guarantee equal local clocks or solar times. Counts describe discrete ground-centre samples, not hours, shaded area or an annual total. '
 +'Selected dates do not establish what happens between dates. Footprint, uncertain heights, grazing, low elevation and below-horizon samples remain separate. '
 +'Location, clock, orientation and physical-model uncertainty retain the original sun-path limitations.';
const declarationKeys=['latitudeDeg','longitudeDeg','gridColumnBearingDeg','locationSource','orientationSource','startUtc','endUtc','stepMinutes'];
const pickDeclaration=value=>Object.fromEntries(declarationKeys.map(k=>[k,value[k]]));
const exactKeys=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
 &&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));

/** Admit all date declarations and their aggregate work before any course runs. */
export function planSunPathDates(project,input,additionalDates){
 validateProject(project);
 const original=validateSunPath(input);
 if(!project.solarStudy)throw Error('Save an obstruction declaration before comparing dates.');
 if(project.solarStudy.contextJson!==solarContext(project))throw Error('The retained ground source changed; resolve its obstruction declaration first.');
 if(!Array.isArray(additionalDates)||additionalDates.length<1||additionalDates.length>=SUN_DATES_LIMITS.maxCourses){
  throw Error('Choose from one to seven additional dates; the original course is always retained.');
 }
 const originalDate=original.startUtc.slice(0,10),seen=new Set([originalDate]);
 const start=sunPathUtc(original.startUtc),duration=sunPathUtc(original.endUtc)-start;
 const clock=original.startUtc.slice(10),declarations=[pickDeclaration(original)];
 for(const date of additionalDates){
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Use complete additional dates in YYYY-MM-DD form.');
  sunPathUtc(date+'T00:00:00Z');
  if(seen.has(date))throw Error('Every additional date must be distinct from the original and the other dates.');
  seen.add(date);
  const shiftedStart=sunPathUtc(date+clock),shiftedEnd=new Date(shiftedStart+duration).toISOString();
  declarations.push(pickDeclaration(validateSunPath({...original,startUtc:new Date(shiftedStart).toISOString(),endUtc:shiftedEnd})));
 }
 const n=project.width*project.height,totalSamples=original.sampleCount*declarations.length;
 const estimatedRayTests=6*n*(n-1)*totalSamples;
 if(!Number.isSafeInteger(estimatedRayTests)||estimatedRayTests>SUN_DATES_LIMITS.maxRayTests){
  throw Error('The complete date set exceeds the 16 million ray-check budget. Choose fewer dates, a coarser interval or a shorter period.');
 }
 return {originalDate,additionalDates:[...additionalDates],declarations,samplesPerCourse:original.sampleCount,totalSamples,estimatedRayTests};
}

function receivePlan(project,plan,originalReport=null){
 const reports=plan.declarations.map((declaration,i)=>i===0&&originalReport?originalReport:compareSunPath(project,declaration));
 return {schema:'experimental-earth-sun-dates/1',sourceContext:reports[0].sourceContext,width:project.width,height:project.height,
  originalDate:plan.originalDate,additionalDates:plan.additionalDates,totalSamples:plan.totalSamples,estimatedRayTests:plan.estimatedRayTests,
  courses:reports.map((report,index)=>({index,date:report.declaration.startUtc.slice(0,10),original:index===0,report,spatial:summarizeSunPathSpatial(report)})),
  semantics:SUN_DATES_SEMANTICS};
}

export function compareSunPathDates(project,input,additionalDates){
 return receivePlan(project,planSunPathDates(project,input,additionalDates));
}

export function inspectSunPathDates(comparison,cellIndex){
 if(comparison?.schema!=='experimental-earth-sun-dates/1'||!Number.isInteger(cellIndex)
  ||cellIndex<0||cellIndex>=comparison.width*comparison.height)throw Error('Select a ground centre from this retained date comparison.');
 return comparison.courses.map(course=>({index:course.index,date:course.date,original:course.original,
  startUtc:course.report.declaration.startUtc,endUtc:course.report.declaration.endUtc,
  samples:course.report.samples.length,counts:{...course.spatial.cells[cellIndex].counts},
  limitedSamples:course.spatial.cells[cellIndex].limitedSamples,pattern:course.spatial.cells[cellIndex].pattern}));
}

export function checkSunPathDatesBytes(bytes){
 if(!Number.isSafeInteger(bytes)||bytes<0||bytes>SUN_DATES_LIMITS.maxBytes)throw Error('Date comparison exceeds the 6 MiB file limit.');
}

function prepareEnvelope(base,additionalDates,selectedCourseIndex){
 // The whole date plan is admitted before the maintained receiver calculates
 // the original course. Reuse that calculated report instead of running it twice.
 const plan=planSunPathDates(base?.project,base?.declaration,additionalDates);
 if(!Number.isInteger(selectedCourseIndex)||selectedCourseIndex<0||selectedCourseIndex>=plan.declarations.length){
  throw Error('Select one of the complete retained date courses.');
 }
 const original=reopenSunPathInvestigation(base);
 const envelope={kind:SUN_DATES_KIND,investigation:original.investigation,additionalDates:plan.additionalDates,selectedCourseIndex};
 checkSunPathDatesBytes(new Blob([JSON.stringify(envelope)]).size);
 return {envelope,comparison:receivePlan(original.investigation.project,plan,original.report)};
}

/** Retain only original site inputs, calendar choices and the two selections. */
export function buildSunPathDatesInvestigation(project,input,additionalDates,selectedCellIndex=0,selectedCourseIndex=0){
 const declaration=pickDeclaration(validateSunPath(input));
 return prepareEnvelope({kind:SUN_PATH_INVESTIGATION_KIND,model:{...SUN_PATH_MODEL},project,declaration,selectedCellIndex},additionalDates,selectedCourseIndex).envelope;
}

export function serializeSunPathDatesInvestigation(project,input,additionalDates,selectedCellIndex=0,selectedCourseIndex=0){
 const text=JSON.stringify(buildSunPathDatesInvestigation(project,input,additionalDates,selectedCellIndex,selectedCourseIndex),null,2);
 checkSunPathDatesBytes(new Blob([text]).size);return text;
}

export function reopenSunPathDatesInvestigation(value){
 if(!exactKeys(value,['kind','investigation','additionalDates','selectedCourseIndex'])||value.kind!==SUN_DATES_KIND){
  throw Error('Unsupported date-comparison envelope; only retained inputs are accepted.');
 }
 return prepareEnvelope(value.investigation,value.additionalDates,value.selectedCourseIndex);
}

export function parseSunPathDatesInvestigation(text){
 if(typeof text!=='string')throw TypeError('Date comparison must be JSON text.');
 checkSunPathDatesBytes(new Blob([text]).size);
 let value;try{value=JSON.parse(text);}catch{throw Error('Date-comparison JSON is invalid.');}
 return reopenSunPathDatesInvestigation(value);
}
