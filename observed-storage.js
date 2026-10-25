import {validateProject, interpolateDepth} from './core.js';

/** Conditional inventory from original, simultaneous cell-representative bands. */
export function observedStorage(project, results, query) {
  validateProject(project);
  const {scenario, minute, role = 'all', basis} = query ?? {};
  if (!['existing','proposal'].includes(scenario)) throw Error('Choose an observed scenario');
  if (!Number.isFinite(minute) || minute < 0 || minute > project.weather.durationMinutes) throw Error('Choose an exact minute inside the event');
  if (!['all','calibration','challenge','unassigned'].includes(role)) throw Error('Choose an evidence role');
  if (typeof basis !== 'string' || !basis.trim() || basis.length > 500) throw Error('Declare why these depths represent their entire grid cells (at most 500 characters)');
  const areaM2 = project.weather.cellSizeM ** 2, groups = new Map();
  const excluded = {scenario:0, minute:0, role:0};
  for (const [index, reading] of project.observations.entries()) {
    if (reading.scenario !== scenario) { excluded.scenario++; continue; }
    if (reading.minute !== minute) { excluded.minute++; continue; }
    if (role !== 'all' && (reading.use ?? 'unassigned') !== role) { excluded.role++; continue; }
    if (!groups.has(reading.cellIndex)) groups.set(reading.cellIndex, []);
    groups.get(reading.cellIndex).push({index, reading:structuredClone(reading), lowerMm:Math.max(0,reading.depthMm-reading.uncertaintyMm), upperMm:reading.depthMm+reading.uncertaintyMm});
  }
  const cells = [...groups].sort((a,b)=>a[0]-b[0]).map(([cellIndex, readings]) => {
    const lowerMm = Math.max(...readings.map(r=>r.lowerMm)), upperMm = Math.min(...readings.map(r=>r.upperMm));
    return {cellIndex, readings, lowerMm, upperMm, contradictory:lowerMm>upperMm};
  });
  const totalCells=project[scenario].length, missingCells=totalCells-cells.length;
  const context={scenario,minute,role,basis:basis.trim(),areaM2,cells,missingCells,totalCells,excluded,readingCount:cells.reduce((n,c)=>n+c.readings.length,0)};
  // No guard widens an original band. Even tiny gaps cannot become inventory.
  if (cells.some(c=>c.contradictory)) return {...context,status:'contradictory',observedLiters:null,siteLiters:null,model:null};
  if (!cells.length) return {...context,status:'no-readings',observedLiters:null,siteLiters:null,model:null};
  const lower=cells.reduce((s,c)=>s+c.lowerMm*areaM2,0), upper=cells.reduce((s,c)=>s+c.upperMm*areaM2,0);
  const sampled=project[scenario].map((_,i)=>interpolateDepth(results[scenario],i,minute));
  if (sampled.some(p=>!Number.isFinite(p.depthMm)||p.depthMm<0)) throw Error('Modeled depths must be finite and nonnegative');
  const footprintLiters=cells.reduce((s,c)=>s+sampled[c.cellIndex].depthMm*areaM2,0);
  const siteLiters=sampled.reduce((s,p)=>s+p.depthMm*areaM2,0);
  const numericalGuardLiters=32*Number.EPSILON*Math.max(1,lower,upper,footprintLiters);
  const relation=footprintLiters<lower-numericalGuardLiters?'below':footprintLiters>upper+numericalGuardLiters?'above':'within';
  return {...context,status:'bounded',observedLiters:{lower,upper},siteLiters:{lower,upper:missingCells?null:upper},model:{footprintLiters,siteLiters,relation,numericalGuardLiters,beforeMinute:sampled[0].beforeMinute,afterMinute:sampled[0].afterMinute,method:sampled[0].method}};
}
