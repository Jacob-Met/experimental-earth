export const RAIN_SENSIBLE_SCHEMA='experimental-earth-rain-sensible/1';
export const RAIN_SENSIBLE_MEANING='Thermal minute zero is explicitly associated with rain-event start. The declared contact fraction of incoming rain equilibrates to surface temperature and departs immediately. Its sensible heat is accounted as an external flowing-water exchange; no thermal water storage, evaporation, freezing, boiling, runoff heat transport or change to the hydraulic solution is represented. Original rain is the retained constant-intensity pulse. Properties and contact are declarations, not measured identification.';
// Declared liquid throughflow sensible exchange using the maintained heat propagator.
import {advanceHeatColumn} from './heat-column-step.js';
export function rainSensibleStep(surface,lower,forcing,initial,seconds,{rateMmHr,waterC,contactFraction,volumetricHeatCapacityJm3K}){
 const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
 if(!finite(rateMmHr,0,250)||!finite(waterC,0,100)||!finite(contactFraction,0,1)||!finite(volumetricHeatCapacityJm3K,1e6,5e6))throw Error('Rain contact needs supported liquid temperature, volumetric heat capacity, rate and fraction');
 const hRain=rateMmHr/3600000*volumetricHeatCapacityJm3K*contactFraction;
 const total=surface.exchangeWm2K+hRain;
 const reservoirC=total===0?forcing.reservoirC:(surface.exchangeWm2K*forcing.reservoirC+hRain*waterC)/total;
 const step=advanceHeatColumn({...surface,exchangeWm2K:total},lower,{...forcing,reservoirC},initial,seconds);
 if(hRain>0&&seconds>0){
  const times=[0,seconds,...step.stationarySeconds.surface];
  for(const t of times){const value=t===0?initial.surfaceC:t===seconds?step.surfaceC:advanceHeatColumn({...surface,exchangeWm2K:total},lower,{...forcing,reservoirC},initial,t).surfaceC;
   if(value<=0||value>=100)throw Error('Active liquid rain contact reaches freezing/boiling range; phase change is not modeled');
  }
 }
 const boundaryOutJm2=surface.exchangeWm2K*seconds*(step.surfaceMeanC-forcing.reservoirC);
 const waterOutJm2=hRain*seconds*(step.surfaceMeanC-waterC);
 const stored=surface.capacityJm2K*(step.surfaceC-initial.surfaceC)+lower.capacityJm2K*(step.subsurfaceC-initial.subsurfaceC);
 return {...step,boundaryOutJm2,waterOutJm2,energyResidualJm2:step.inputJm2-boundaryOutJm2-waterOutJm2-stored};
}

import {validateProject} from './core.js';
import {heatColumnCurrent} from './heat-column-contract.js';
export function compareRainSensible(project,request){
 validateProject(project);
 const heat=project.heatColumnStudy;
 if(!heat||!heatColumnCurrent(project,heat))throw Error('A current source-bound two-store heat study is required');
 const keys=['source','clockSource','waterC','volumetricHeatCapacityJm3K','contactFraction'];
 if(!request||Object.keys(request).length!==keys.length||!keys.every(k=>Object.hasOwn(request,k))||!request.contactFraction||Object.keys(request.contactFraction).length!==2)throw Error('Supply only the explicit rain-contact declaration fields');
 const text=x=>typeof x==='string'&&x.trim()&&x.length<=600;
 const finite=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
 if(!text(request?.source)||!text(request?.clockSource)||!finite(request.waterC,0,100)||!finite(request.volumetricHeatCapacityJm3K,1e6,5e6)||!['existing','proposal'].every(k=>finite(request.contactFraction?.[k],0,1)))throw Error('Explicit supported rain-water properties, contact fractions and clock/source declarations required');
 let end=0;const rows=heat.heatStudy.schedule.map(row=>{const start=end;end+=row.minutes;return {...row,start,end}});
 const boundaries=[...new Set([0,...rows.map(r=>r.end),Math.min(end,project.weather.stormMinutes)])].sort((a,b)=>a-b);
 const result={schema:RAIN_SENSIBLE_SCHEMA,meaning:RAIN_SENSIBLE_MEANING,source:structuredClone({project,request}),durationMinutes:end,sides:{}};
 for(const side of ['existing','proposal']){
  result.sides[side]={};
  for(const mode of ['baseline','rainContact']){
   const surface=heat.heatStudy[side],lower=heat.lowerLayers[side];let state={surfaceC:surface.initialC,subsurfaceC:lower.initialC};
   const account={inputJm2:0,boundaryOutJm2:0,waterOutJm2:0,rainMm:0,energyResidualJm2:0};const course=[{minute:0,...state,...account}];
   for(let i=1;i<boundaries.length;i++){
    const a=boundaries[i-1],b=boundaries[i],forcing=rows.find(r=>a>=r.start&&a<r.end),rain=a<project.weather.stormMinutes?project.weather.rainMmHr:0;
    const next=rainSensibleStep(surface,lower,forcing,state,(b-a)*60,{rateMmHr:rain,waterC:request.waterC,contactFraction:mode==='baseline'?0:request.contactFraction[side],volumetricHeatCapacityJm3K:request.volumetricHeatCapacityJm3K});
    for(const key of ['inputJm2','boundaryOutJm2','waterOutJm2','energyResidualJm2'])account[key]+=next[key];account.rainMm+=rain*(b-a)/60;
    state={surfaceC:next.surfaceC,subsurfaceC:next.subsurfaceC};course.push({minute:b,...state,...account});
   }
   result.sides[side][mode]={course,final:course.at(-1)};
  }
 }
 return result;
}

export function saveRainSensible(project,request){
 const original=compareRainSensible(project,request).source;
 const text=JSON.stringify({schema:RAIN_SENSIBLE_SCHEMA,...original},null,2);
 if(new TextEncoder().encode(text).length>5*1024*1024)throw Error('Original rain-contact bundle exceeds 5 MiB');
 return text;
}
export function reopenRainSensible(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>5*1024*1024)throw Error('Original rain-contact bundle exceeds 5 MiB');
 const input=JSON.parse(text);if(input.schema!==RAIN_SENSIBLE_SCHEMA)throw Error('Choose original rain-contact source inputs');
 return compareRainSensible(input.project,input.request);
}
