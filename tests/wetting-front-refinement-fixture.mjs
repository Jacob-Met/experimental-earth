import {makeExample,runRain,interpolateDepth} from '../core.js';
export function fixture(k=17.3,a=6.2){
 const p=makeExample();p.width=p.height=2;p.selectedIndex=0;p.existing=Array.from({length:4},()=>({elevationM:0,surface:'turf',provenance:'Authored mathematical control'}));p.proposal=structuredClone(p.existing);Object.assign(p.weather,{rainMmHr:50,stormMinutes:60,durationMinutes:90,stepMinutes:5,cellSizeM:1,mobilityPerHour:0,boundaryExitPerHour:0});
 const truth=runRain(p.existing,2,2,p.weather,{surfaceWettingFront:{surface:'turf',conductivityMmHr:k,capillaryDriveMm:a}});
 p.observations=[17.5,42.5,77.5].map(minute=>({cellIndex:0,minute,depthMm:interpolateDepth(truth,0,minute).depthMm,uncertaintyMm:.03,scenario:'existing',use:'calibration',source:'Authored solver control, not measured soil',method:'ruler'}));
 const q={target:'existing',surface:'turf',basis:'Authored control bounds',conductivity:{min:10,max:30,count:3},drive:{min:0,max:20,count:3}};return {p,q};
}
