import {makeExample} from '../core.js';
import {prepareSurfaceHeatStudy} from '../surface-heat.js';
import {LONGWAVE_HEAT_SCHEMA} from '../longwave-heat.js';
import {LONGWAVE_EVIDENCE_SCHEMA} from '../longwave-heat-evidence.js';
export function evidenceFixture(){
 const project=makeExample();
 project.surfaceHeatStudy=prepareSurfaceHeatStudy(project,{cellIndex:0,
  existing:{absorptivity:.4,capacityJm2K:40000,exchangeWm2K:10,initialC:25,source:'Authored A; not acquired'},
  proposal:{absorptivity:.8,capacityJm2K:80000,exchangeWm2K:20,initialC:25,source:'Authored B common-scale alternative'},
  schedule:[{minutes:60,incidentWm2:600,reservoirC:25,source:'Authored heating'},{minutes:120,incidentWm2:0,reservoirC:25,source:'Authored cooling'}]});
 const radiation={schema:LONGWAVE_HEAT_SCHEMA,exchangeBasis:'excludes-longwave',heatStudy:structuredClone(project.surfaceHeatStudy),existing:{emissivity:.9,source:'Declared fixed emissivity'},proposal:{emissivity:.9,source:'Declared fixed emissivity'},radiationSchedule:[{skyC:5,source:'Authored cold surroundings'},{skyC:5,source:'Authored cold surroundings'}]};
 const evidence={schema:'experimental-earth-surface-heat-evidence/1',heatStudy:structuredClone(project.surfaceHeatStudy),target:'existing',associationSource:'Authored control from earlier model execution; no field acquisition',hypotheses:[{...project.surfaceHeatStudy.existing,label:'A'},{...project.surfaceHeatStudy.proposal,label:'B'}],readings:[{minute:30,temperatureC:29.606765985935127,halfWidthC:.05,use:'calibration',source:'Previous authored model control'},{minute:60,temperatureC:31.885343930834214,halfWidthC:.05,use:'challenge',source:'Previous authored model control, not independent acquisition'}]};
 project.surfaceHeatEvidence=structuredClone(evidence);
 return {project,input:{schema:LONGWAVE_EVIDENCE_SCHEMA,radiation,evidence,hypothesisExchangeBasis:'excludes-longwave',exchangeBasisSource:'Authored all-candidate nonradiative exchange assumption'}};
}
