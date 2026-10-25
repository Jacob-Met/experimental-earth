import {makeExample} from './core.js';
import {prepareSurfaceHeatStudy} from './surface-heat.js';
import {prepareHeatColumnStudy} from './heat-column.js';
import {COOLING_SCHEMA} from './evaporative-cooling.js';

export function coolingExample() {
  const project=makeExample();
  project.title='Fictional courtyard — retained rain and conditional cooling';
  const cellIndex=27;
  const surface={absorptivity:.7,capacityJm2K:50000,exchangeWm2K:15,initialC:28,
    source:'Authored effective transpiring-surface store, not measured ground or leaf properties'};
  project.surfaceHeatStudy=prepareSurfaceHeatStudy(project,{cellIndex,existing:surface,proposal:structuredClone(surface),schedule:[
    {minutes:240,incidentWm2:650,reservoirC:28,source:'Fictional warm four-hour exposure'},
    {minutes:240,incidentWm2:150,reservoirC:25,source:'Fictional lower-input four-hour exposure'}]});
  const lower={capacityJm2K:150000,conductanceWm2K:8,initialC:26,source:'Authored effective lower heat store; no resolved depth profile'};
  project.heatColumnStudy=prepareHeatColumnStudy(project,{existing:lower,proposal:structuredClone(lower)});
  const root={fieldCapacity:.25,wiltingPoint:.15,rootDepthM:.05,initialAvailableMm:0,depletionFraction:.4,
    source:'Fictional shallow rooted store to expose water-limited transpiration during this example'};
  const study={schema:COOLING_SCHEMA,heatColumn:structuredClone(project.heatColumnStudy),
    roots:{existing:root,proposal:structuredClone(root)},surfaceLatentFraction:{existing:.6,proposal:.6},latentHeatJkg:2450000,
    latentHeatSource:'FAO Irrigation and Drainage Paper 56, chapter 1: approximate 2.45 MJ/kg at 20 °C. Held constant here as an authored approximation. https://www.fao.org/4/x0490e/x0490e04.htm',
    associationSource:'Authored common effective surface: each cell’s modeled rain infiltration supplies its rooted store; 60% of latent heat is drawn from this thermal surface and 40% from unresolved surroundings. Not field observations.',
    demands:[{potentialTranspirationMmPerDay:18,source:'Hypothetical plant-only demand during warm interval'},
      {potentialTranspirationMmPerDay:6,source:'Hypothetical plant-only demand during lower-input interval'}]};
  return {project,study};
}
