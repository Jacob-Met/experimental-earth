import {makeExample} from '../core.js';
import {prepareSurfaceHeatStudy} from '../surface-heat.js';
import {prepareHeatColumnStudy} from '../heat-column.js';
import {prepareHeatColumnEvidence,authoredHeatColumnEvidenceExample} from '../heat-column-evidence.js';
import {prepareHeatColumnTransfer} from '../heat-column-transfer.js';
export function transferProject(cooling=false){
 const p=makeExample();p.title=cooling?'Authored later cooling exposure':'Authored original heating investigation';
 const top={capacityJm2K:20000,exchangeWm2K:10,absorptivity:.8,initialC:cooling?52:20,source:'Authored same surface material; not measured'};
 p.surfaceHeatStudy=prepareSurfaceHeatStudy(p,{cellIndex:0,existing:top,proposal:{...top,absorptivity:.4},schedule:cooling?[{minutes:35,incidentWm2:0,reservoirC:12,source:'Authored separately declared cooling'},{minutes:25,incidentWm2:220,reservoirC:18,source:'Authored weak later heating'}]:[{minutes:60,incidentWm2:700,reservoirC:20,source:'Authored original pulse'},{minutes:360,incidentWm2:0,reservoirC:20,source:'Authored original dark interval'}]});
 const lower={capacityJm2K:80000,conductanceWm2K:20,initialC:cooling?36:20,source:'Authored initial state and lower layer, not acquired'};
 p.heatColumnStudy=prepareHeatColumnStudy(p,{existing:lower,proposal:lower});
 if(!cooling){const evidence=authoredHeatColumnEvidenceExample(p);evidence.readings=evidence.readings.slice(0,1);p.heatColumnEvidence=prepareHeatColumnEvidence(p,evidence);}
 return p;
}
export const transferHeader='minute,from_minute,aggregation,temperature,half_width,unit,use,source';
// Independent augmented-matrix exponential values; the mean spans the35-minute forcing change.
export const transferCSV=transferHeader+'\n15,,instant,34.68300177529785,0.1,C,challenge,Authored independent matrix point\n45,30,interval-mean,30.704771782103844,0.1,C,challenge,Authored independent matrix mean\n';
export function transferBundle(){return prepareHeatColumnTransfer(transferProject(),transferProject(true),{name:'authored-separate-temperature.csv',text:transferCSV},'Authored unchanged-material transfer control; no acquired temperature evidence');}
