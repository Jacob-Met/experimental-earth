import {makeExample} from '../core.js';
import {prepareSurfaceHeatStudy} from '../surface-heat.js';
import {prepareHeatColumnStudy} from '../heat-column.js';
import {prepareHeatColumnEvidence,authoredHeatColumnEvidenceExample} from '../heat-column-evidence.js';
export function temperatureProject(){
 const p=makeExample(),top={capacityJm2K:20000,exchangeWm2K:10,absorptivity:.8,initialC:20,source:'Authored surface reference'};
 p.surfaceHeatStudy=prepareSurfaceHeatStudy(p,{cellIndex:0,existing:top,proposal:top,schedule:[{minutes:60,incidentWm2:700,reservoirC:20,source:'Authored pulse'},{minutes:360,incidentWm2:0,reservoirC:20,source:'Authored dark interval'}]});
 const lower={capacityJm2K:80000,conductanceWm2K:20,initialC:20,source:'Authored lower reference'};
 p.heatColumnStudy=prepareHeatColumnStudy(p,{existing:lower,proposal:lower});
 p.heatColumnEvidence=prepareHeatColumnEvidence(p,authoredHeatColumnEvidenceExample(p));return p;
}
export const temperatureHeader='minute,from_minute,aggregation,temperature,half_width,unit,use,source\n';
export const temperatureCSV=temperatureHeader+'60,,instant,112.15579813943923,0.09,F,calibration,Authored Fahrenheit control\n120,,instant,300.58965430499205,0.25,K,challenge,Authored Kelvin control';
