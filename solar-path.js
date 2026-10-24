import {getPosition} from './vendor/suncalc/index.js';
import {validateProject} from './core.js';
import {compareSolarOcclusion} from './solar-occlusion.js';
import {solarContext} from './solar-occlusion-contract.js';

export const SUN_PATH_MODEL = Object.freeze({
  name: 'SunCalc', version: '2.1.1',
  commit: '21449f34820c3c80a27a78cdc940747ff19ca1e3',
  altitude: 'apparent, with the upstream standard refraction approximation',
  azimuth: 'degrees clockwise from true north',
});
export const SUN_PATH_LIMITS = Object.freeze({maxHours:48, maxSamples:193, maxRayTests:16000000});
export const SUN_PATH_SEMANTICS = 'Discrete ground-centre samples, not continuous shaded duration or whole-cell coverage. '
  + 'The sun position is calculated, not observed. Column height bounds retain their existing meaning; '
  + 'location, clock, orientation and solar-position uncertainty are not propagated. '
  + 'No mapped blocker does not establish sunlight: off-map objects, cloud and foliage are outside this model. '
  + 'No irradiance, temperature or comfort is inferred.';

const finite = (value,min,max) => typeof value==='number' && Number.isFinite(value) && value>=min && value<=max;
const sourced = value => typeof value==='string' && value.trim().length>0 && value.length<=400;
const wrap = angle => ((angle%360)+360)%360;

/** Strict UTC instants: reject impossible dates and implicit browser time zones. */
export function sunPathUtc(value) {
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.000)?Z$/.test(value)) {
    throw Error('Use an explicit UTC instant, for example 2026-06-21T08:00:00Z.');
  }
  const time=Date.parse(value), canonical=value.replace(/\.000Z$/,'Z');
  if(!Number.isFinite(time) || new Date(time).toISOString().replace('.000Z','Z')!==canonical) {
    throw Error('The UTC date and time must exist; normalized or impossible dates are refused.');
  }
  const year=new Date(time).getUTCFullYear();
  if(year<1900 || year>2100)throw Error('This sun-path consumer supports years 1900 through 2100.');
  return time;
}

export function validateSunPath(input) {
  if(!input || !finite(input.latitudeDeg,-90,90) || Math.abs(input.latitudeDeg)===90
    || !finite(input.longitudeDeg,-180,180)) {
    throw Error('Declare latitude strictly between −90° and 90°, and longitude from −180° to 180°.');
  }
  if(!finite(input.gridColumnBearingDeg,0,360) || input.gridColumnBearingDeg===360) {
    throw Error('Declare the bearing of increasing grid columns from 0° to below 360°, clockwise from true north.');
  }
  if(!sourced(input.locationSource) || !sourced(input.orientationSource)) {
    throw Error('Retain a source or explicit assumption for both location and grid orientation (up to 400 characters each).');
  }
  const start=sunPathUtc(input.startUtc), end=sunPathUtc(input.endUtc);
  if(end<=start || end-start>SUN_PATH_LIMITS.maxHours*3600000) {
    throw Error('End must follow start by no more than 48 hours.');
  }
  if(!Number.isInteger(input.stepMinutes) || !finite(input.stepMinutes,1,240)) {
    throw Error('Use a whole-number sample interval from 1 to 240 minutes.');
  }
  // Always include both endpoints, even when the final interval is shorter.
  const sampleCount=Math.ceil((end-start)/(input.stepMinutes*60000))+1;
  if(sampleCount>SUN_PATH_LIMITS.maxSamples)throw Error('Use a coarser interval: at most 193 complete samples are supported.');
  return {
    latitudeDeg:input.latitudeDeg, longitudeDeg:input.longitudeDeg,
    gridColumnBearingDeg:input.gridColumnBearingDeg,
    locationSource:input.locationSource.trim(), orientationSource:input.orientationSource.trim(),
    startUtc:new Date(start).toISOString(), endUtc:new Date(end).toISOString(),
    stepMinutes:input.stepMinutes, sampleCount,
  };
}

/** The grid's row direction is clockwise 90 degrees from its column direction. */
export function sunPathPosition(utc,latitudeDeg,longitudeDeg,gridColumnBearingDeg) {
  sunPathUtc(utc);
  if(!finite(latitudeDeg,-90,90) || Math.abs(latitudeDeg)===90 || !finite(longitudeDeg,-180,180)
    || !finite(gridColumnBearingDeg,0,360) || gridColumnBearingDeg===360)throw Error('Invalid geographic position or grid bearing.');
  const position=getPosition(new Date(utc),latitudeDeg,longitudeDeg);
  if(!Number.isFinite(position.azimuth) || !finite(position.altitude,-90,90))throw Error('Solar position could not be evaluated.');
  return {azimuthDeg:wrap(position.azimuth),elevationDeg:position.altitude,
    headingDeg:wrap(position.azimuth-gridColumnBearingDeg)};
}

export function sunPathContext(project) {
  return JSON.stringify([solarContext(project),project.solarStudy??null]);
}

/** Reuse the maintained obstruction calculation; never overwrite the saved direction. */
export function compareSunPath(project,input) {
  validateProject(project);
  const declaration=validateSunPath(input);
  if(!project.solarStudy)throw Error('Save an obstruction declaration in the direct-sun panel first.');
  if(project.solarStudy.contextJson!==solarContext(project)) {
    throw Error('The ground grid or its source changed. Resolve the saved obstruction declaration before comparing a sun path.');
  }
  const cellCount=project.width*project.height;
  // Two scenarios, three slab checks for every other cell, for every scheduled sample.
  // Conservative preflight counts low-sun samples too and does not truncate a course.
  const estimatedRayTests=6*cellCount*(cellCount-1)*declaration.sampleCount;
  if(estimatedRayTests>SUN_PATH_LIMITS.maxRayTests) {
    throw Error('This complete sun path exceeds the 16 million ray-check budget. Use a coarser interval or shorter time range.');
  }
  const start=Date.parse(declaration.startUtc), end=Date.parse(declaration.endUtc);
  const working=structuredClone(project), samples=[];
  for(let i=0;i<declaration.sampleCount;i++) {
    const utc=new Date(Math.min(end,start+i*declaration.stepMinutes*60000)).toISOString();
    const position=sunPathPosition(utc,declaration.latitudeDeg,declaration.longitudeDeg,declaration.gridColumnBearingDeg);
    const sample={utc,...position};
    if(position.elevationDeg<1) {
      samples.push({...sample,condition:position.elevationDeg<=0?'below-horizon':'low-elevation',existing:null,proposal:null,changes:[]});
      continue;
    }
    working.solarStudy={...project.solarStudy,headingDeg:position.headingDeg,elevationDeg:position.elevationDeg,
      sunSource:`Calculated ${SUN_PATH_MODEL.name} ${SUN_PATH_MODEL.version} at ${utc}; source location and grid bearing are in this path declaration.`};
    const comparison=compareSolarOcclusion(working);
    if(comparison.status!=='compared')throw Error('The maintained obstruction calculation refused this path sample.');
    samples.push({...sample,condition:'modeled',existing:comparison.existing,proposal:comparison.proposal,
      changes:comparison.changes,epsilonM:comparison.epsilonM});
  }
  return {schema:'experimental-earth-sun-path/1',model:SUN_PATH_MODEL,declaration,
    sourceContext:sunPathContext(project),width:project.width,height:project.height,
    estimatedRayTests,samples,semantics:SUN_PATH_SEMANTICS};
}

export function sunPathCellCourse(report,cellIndex) {
  if(!Number.isInteger(cellIndex) || cellIndex<0 || cellIndex>=report.width*report.height)throw Error('Select a cell from this sun-path source.');
  return report.samples.map(sample=>({utc:sample.utc,azimuthDeg:sample.azimuthDeg,
    elevationDeg:sample.elevationDeg,headingDeg:sample.headingDeg,
    existing:sample.condition==='modeled'?sample.existing[cellIndex]:{cellIndex,status:sample.condition,witness:null},
    proposal:sample.condition==='modeled'?sample.proposal[cellIndex]:{cellIndex,status:sample.condition,witness:null},
  }));
}
