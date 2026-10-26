import {p as original,query} from './heat-column-search-fixture.mjs';
import {evaluateHeatColumnTarget} from '../heat-column.js';
export {query};
export function bandCase(C=91000,G=17.3,shift=1.5,{mean=false,anchor=0}={}){
 const p=structuredClone(original),study=structuredClone(p.heatColumnStudy);Object.assign(study.lowerLayers.existing,{capacityJm2K:C,conductanceWm2K:G});
 const times=[27,81,143],windows=[{fromMinute:9.7,minute:19.3},{fromMinute:49.9,minute:72.4},{fromMinute:117.2,minute:171.8}];
 const course=evaluateHeatColumnTarget(study,'existing',times,mean?windows:[]);
 p.heatColumnEvidence.readings=times.map((minute,i)=>({...(mean?{...windows[i],aggregation:'interval-mean'}:{minute}),temperatureC:(mean?course.averages[i].surfaceMeanC:course.trajectory.find(r=>r.minute===minute).surfaceC)+(i===anchor?0:shift),halfWidthC:i===anchor?(mean?.002:.001):2,use:'calibration',source:'Authored known-feasible band control; not acquired measurements'}));
 return p;
}
