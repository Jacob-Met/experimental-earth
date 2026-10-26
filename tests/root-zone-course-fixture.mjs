import {makeExample} from '../core.js';
import {ROOT_COURSE_SCHEMA} from '../root-zone-course.js';
const root={fieldCapacity:.3,wiltingPoint:.12,rootDepthM:.1,initialAvailableMm:0,depletionFraction:.5,source:'Authored18mm store'};
const demand={potentialTranspirationMmPerDay:4,source:'Authored transpiration'};
export function fixture(gap=1){
 const p=makeExample();p.width=p.height=2;p.existing=Array.from({length:4},()=>({surface:'garden',elevationM:0,provenance:'Authored flat garden'}));p.proposal=structuredClone(p.existing);p.observations=[];p.selectedIndex=0;p.weather={...p.weather,rainMmHr:20,stormMinutes:30,durationMinutes:30,stepMinutes:5,mobilityPerHour:0,boundaryExitPerHour:0,cellSizeM:1};
 const event=i=>({reference:'Authored event '+i,project:structuredClone(p),gapDays:i?gap:0,gapDemand:demand,eventDemand:demand,surfaceResetSource:'Authored distinct event with initially dry surface; no hydraulic state transfer'});
 return {schema:ROOT_COURSE_SCHEMA,cellIndex:0,associationSource:'Authored whole modeled infiltration enters this rooted store',existing:root,proposal:root,events:[event(0),event(1)],schedule:[{durationDays:7-gap,...demand}]};
}
