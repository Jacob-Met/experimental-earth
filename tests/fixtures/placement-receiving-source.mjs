import {makeExample,runRain} from '../../core.js';
import {snapshotDepths} from '../../ponding-exposure.js';
import {hypothesisLayer} from '../../draining-layer-evidence.js';

export function receivingFixture() {
 const project=makeExample();project.proposal=structuredClone(project.existing);
 project.existing[27].surface=project.proposal[27].surface='garden';
 Object.assign(project.weather,{rainMmHr:36,stormMinutes:60,durationMinutes:240,stepMinutes:5,cellSizeM:2,mobilityPerHour:.5,boundaryExitPerHour:.38});
 const receivingStudy={schema:'experimental-earth-draining-hypotheses/1',target:'existing',surface:'garden',
  hypotheses:[[5,0],[5,1],[10,.5],[20,0]].map(([capacityMm,drainagePerHour],i)=>({id:'h'+i,label:'Authored receiver '+i,
   capacityMm,initialStoredMm:0,drainagePerHour,source:'Declared authored model alternative, not field evidence'}))};
 const truth=runRain(project.existing,project.width,project.height,project.weather,{drainingLayer:hypothesisLayer(receivingStudy,receivingStudy.hypotheses[1])});
 project.observations=[['calibration',30,1.5],['challenge',60,.1]].map(([use,minute,uncertaintyMm])=>({cellIndex:27,minute,depthMm:snapshotDepths(truth,minute)[27],uncertaintyMm,scenario:'existing',use,source:'Authored solver control on unchanged geometry; not a measured reading'}));
 const query={eligibleCells:project.proposal.flatMap((c,i)=>c.surface==='sealed'?[i]:[]),maxEdits:2,surface:'garden',metric:'unabsorbedLiters',subset:'calibration',receivingStudy};
 return {project,query};
}
