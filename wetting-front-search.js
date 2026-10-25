import {runRain, validateProject, SURFACES} from './core.js';
import {evaluateReadings} from './infiltration-study.js';

export const MAX_SOIL_SEARCH_CELL_STEPS = 1_000_000;
export const SOIL_SEARCH_FILE_LIMIT = 5 * 1024 * 1024;
const schema = 'experimental-earth-soil-search/1';
const plain = x => x && typeof x === 'object' && !Array.isArray(x);
function axis(value, maximum, name) {
  if (!plain(value) || Object.keys(value).some(k => !['min','max','count'].includes(k)) ||
      !Number.isFinite(value.min) || !Number.isFinite(value.max) || value.min < 0 ||
      value.max > maximum || value.min >= value.max || !Number.isInteger(value.count) ||
      value.count < 2 || value.count > 9) throw Error(`${name} needs distinct bounds and 2–9 evenly spaced values`);
  const values = Array.from({length:value.count}, (_,i) => i === value.count-1 ? value.max : value.min + (value.max-value.min)*i/(value.count-1));
  if (new Set(values).size !== value.count) throw Error(`${name} bounds are too close to represent distinct grid values`);
  return values;
}
export function validateSoilSearch(project, query) {
  validateProject(project);
  if (!plain(query) || Object.keys(query).some(k => !['target','surface','basis','conductivity','drive'].includes(k)) ||
      !['existing','proposal'].includes(query.target) || !Object.hasOwn(SURFACES,query.surface) ||
      typeof query.basis !== 'string' || !query.basis.trim() || query.basis.length > 400) throw Error('Declare scenario, material and a basis for the search bounds');
  const conductivity = axis(query.conductivity,2000,'Conductivity K');
  const drive = axis(query.drive,5000,'Capillary drive A');
  const cellSteps = project.width * project.height * Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes) * conductivity.length * drive.length;
  if (cellSteps > MAX_SOIL_SEARCH_CELL_STEPS) throw Error(`Soil search exceeds ${MAX_SOIL_SEARCH_CELL_STEPS} cell-steps; narrow the grid or source event`);
  return {conductivity,drive,cellSteps};
}
/** Exhaustive finite inverse search; no optimizer prior, pruning or parameter adoption. */
export function searchSoilParameters(project, query) {
  const {conductivity,drive,cellSteps} = validateSoilSearch(project,query);
  const readings = project.observations.map((reading,index)=>({reading,index}));
  const calibration = readings.filter(x=>x.reading.scenario===query.target && x.reading.use==='calibration');
  const challenge = readings.filter(x=>x.reading.scenario===query.target && x.reading.use==='challenge');
  const affectedCells = project[query.target].filter(x=>x.surface===query.surface).length;
  const base = {schema,sourceSignature:JSON.stringify(project),query:structuredClone(query),cellSteps,
    counts:{calibration:calibration.length,challenge:challenge.length,affectedCells},candidates:[],compatibleIds:[],closestIds:[]};
  if (!affectedCells || !calibration.length) return {...base,status:!affectedCells?'surface-absent':'need-calibration'};
  const candidates = [];
  conductivity.forEach((conductivityMmHr,ki)=>drive.forEach((capillaryDriveMm,ai)=>{
    const result = runRain(project[query.target],project.width,project.height,project.weather,
      {surfaceWettingFront:{surface:query.surface,conductivityMmHr,capillaryDriveMm}});
    candidates.push({id:ki*drive.length+ai+1,conductivityMmHr,capillaryDriveMm,
      boundary:ki===0||ki===conductivity.length-1||ai===0||ai===drive.length-1,
      calibration:evaluateReadings(result,calibration),challenge:evaluateReadings(result,challenge),
      massErrorLiters:result.massErrorLiters});
  }));
  candidates.sort((a,b)=>a.calibration.rmseMm-b.calibration.rmseMm||a.id-b.id);
  const compatibleIds = candidates.filter(x=>x.calibration.compatible).map(x=>x.id);
  const best = candidates[0].calibration.rmseMm;
  const closestIds = candidates.filter(x=>Math.abs(x.calibration.rmseMm-best)<=1e-9*Math.max(1,best)).map(x=>x.id);
  return {...base,candidates,compatibleIds,closestIds,status:compatibleIds.length?'computed':'calibration-rejected'};
}
export function soilSearchSelection(report, ids) {
  if (report?.schema!==schema || !Array.isArray(ids) || ids.length<2 || ids.length>9 || new Set(ids).size!==ids.length) throw Error('Explicitly select 2–9 distinct tested pairs');
  const hypotheses = ids.map(id=>{
    const row=report.candidates.find(x=>x.id===id);
    if (!row) throw Error('Selection is not in this computed search');
    return {conductivityMmHr:row.conductivityMmHr,capillaryDriveMm:row.capillaryDriveMm};
  });
  return {target:report.query.target,surface:report.query.surface,basis:report.query.basis,hypotheses};
}
export function serializeSoilSearch(project,query) {
  validateSoilSearch(project,query);
  const text=JSON.stringify({schema,project,query},null,2);
  if (new TextEncoder().encode(text).length>SOIL_SEARCH_FILE_LIMIT) throw Error('Soil search exceeds 5 MiB');
  return text;
}
export function parseSoilSearch(text) {
  if (typeof text!=='string' || new TextEncoder().encode(text).length>SOIL_SEARCH_FILE_LIMIT) throw Error('Soil search exceeds 5 MiB');
  const value=JSON.parse(text);
  if (!plain(value)||value.schema!==schema||Object.keys(value).some(k=>!['schema','project','query'].includes(k))) throw Error('Expected original soil search inputs, not saved conclusions');
  validateSoilSearch(value.project,value.query);
  return value;
}
