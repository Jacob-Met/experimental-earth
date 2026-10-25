import {makeExample,runRain} from '../core.js';
import {DRAINING_HYPOTHESES_SCHEMA,hypothesisLayer} from '../draining-layer-evidence.js';
export function fixture(){
 const project=makeExample();project.existing[40].surface='garden';project.proposal=structuredClone(project.existing);project.proposal[27].surface='garden';project.proposal[27].elevationM-=.05;project.proposal[27].internalBarriers={east:{closed:true,source:'Authored wall'}};
 const study={schema:DRAINING_HYPOTHESES_SCHEMA,target:'existing',surface:'garden',hypotheses:[[5,0],[5,1],[10,.5],[20,0]].map(([capacityMm,drainagePerHour],i)=>({id:`h${i}`,label:`Authored alternative ${i}`,capacityMm,initialStoredMm:0,drainagePerHour,source:'Authored original existing bed; not field validation'}))};
 const r=runRain(project.existing,project.width,project.height,project.weather,{drainingLayer:hypothesisLayer(study,study.hypotheses[1])}),last=r.snapshots.at(-1);
 project.observations=[{cellIndex:40,minute:50,depthMm:13,uncertaintyMm:1,scenario:'existing',use:'calibration',source:'Authored broad original reading'},{cellIndex:40,minute:last.minute,depthMm:last.depthsMm[40],uncertaintyMm:.1,scenario:'existing',use:'challenge',source:'Authored later original-source control'}];
 return {project,study};
}
