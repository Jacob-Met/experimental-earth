import {validateProject, runRain, SURFACES} from './core.js';
import {evaluateReadings} from './infiltration-study.js';
import {DRAINING_LAYER_SCHEMA} from './draining-infiltration.js';
export function inferReceivingProposal({rainMmHr,infiltrationMmHr,stormMinutes,laterMinute,stormEndDepthMm,laterDepthMm}) {
 const numbers=[rainMmHr,infiltrationMmHr,stormMinutes,laterMinute,stormEndDepthMm,laterDepthMm];
 if(numbers.some(x=>typeof x!=='number'||!Number.isFinite(x))) return {status:'refused',reason:'nonfinite-input'};
 const T=stormMinutes/60,t=laterMinute/60,R=rainMmHr,f=infiltrationMmHr,H=stormEndDepthMm,L=laterDepthMm;
 if(!(R>f&&f>0&&R<=250&&f<=2000&&T>0&&t>T&&t<=12&&H>0&&L>0&&H<=1000&&L<=1000))return {status:'refused',reason:'unsupported-rain-or-ponding-regime'};
 const fullStoreRate=(H-L)/(t-T),entered=R*T-H;
 if(!(fullStoreRate>=0&&fullStoreRate<f))return {status:'refused',reason:'unsupported-dry-recession'};
 const fillHours=(entered-fullStoreRate*T)/(f-fullStoreRate);
 if(!(fillHours>0&&fillHours<T))return {status:'refused',reason:'no-interior-filling-transition'};
 const drainagePerHour=fullStoreRate===0?0:-Math.log1p(-fullStoreRate/f)/fillHours;
 const capacityMm=fullStoreRate===0?entered:fullStoreRate/drainagePerHour;
 if(!Number.isFinite(capacityMm)||!Number.isFinite(drainagePerHour)||capacityMm<=0||capacityMm>10000||drainagePerHour<0||drainagePerHour>100||(fullStoreRate>0&&drainagePerHour===0))return {status:'refused',reason:'unsupported-parameters'};
 return {status:'proposal',capacityMm,initialStoredMm:0,drainagePerHour,fillMinute:fillHours*60,fullStoreRateMmHr:fullStoreRate};
}
export const RECEIVING_PROPOSAL_PAIR_LIMIT=128;
export const RECEIVING_PROPOSAL_CELL_STEP_LIMIT=1000000;
export function proposeReceivingLayers(project,{target,surface,initialStoredMm,basis}={}) {
 validateProject(project);
 if(!['existing','proposal'].includes(target)||!Object.hasOwn(SURFACES,surface))throw Error('Choose an original scenario and known surface.');
 if(initialStoredMm!==0||typeof basis!=='string'||!basis.trim()||basis.length>200)throw Error('Explicitly declare an initially empty receiving layer and its basis within 200 characters.');
 const weather=project.weather;
 if(weather.mobilityPerHour!==0||weather.boundaryExitPerHour!==0)throw Error('This inverse requires the original source to declare zero lateral mobility and zero boundary outflow.');
 const f=SURFACES[surface].infiltrationMmHr;
 if(!(weather.rainMmHr>f&&weather.stormMinutes>0&&weather.durationMinutes>weather.stormMinutes))throw Error('This inverse requires rain above the fixed surface intake rate, followed by a dry period.');
 const readings=project.observations.map((reading,index)=>({reading,index}));
 const calibration=readings.filter(({reading})=>reading.scenario===target&&reading.use==='calibration');
 const challenge=readings.filter(({reading})=>reading.scenario===target&&reading.use==='challenge');
 const atEndpoint=minute=>Number.isInteger(minute/weather.stepMinutes)||minute===weather.durationMinutes;
 const starts=calibration.filter(({reading:r})=>r.minute===weather.stormMinutes&&atEndpoint(r.minute)&&project[target][r.cellIndex].surface===surface);
 const pairs=[];
 for(const start of starts)for(const later of calibration)if(later.reading.cellIndex===start.reading.cellIndex&&later.reading.minute>weather.stormMinutes&&atEndpoint(later.reading.minute))pairs.push({start,later});
 const cellSteps=pairs.length*project.width*project.height*Math.ceil(weather.durationMinutes/weather.stepMinutes);
 if(pairs.length>RECEIVING_PROPOSAL_PAIR_LIMIT||cellSteps>RECEIVING_PROPOSAL_CELL_STEP_LIMIT)throw Error('The complete calibration-pair family exceeds the supported inverse search; no partial proposals were computed.');
 const candidates=[],refusedPairs=[];
 for(const {start,later} of pairs){
  const rows=[start.index,later.index];
  const inferred=inferReceivingProposal({rainMmHr:weather.rainMmHr,infiltrationMmHr:f,stormMinutes:weather.stormMinutes,laterMinute:later.reading.minute,stormEndDepthMm:start.reading.depthMm,laterDepthMm:later.reading.depthMm});
  if(inferred.status!=='proposal'){refusedPairs.push({rows,reason:inferred.reason});continue;}
  const duplicate=candidates.find(c=>c.hypothesis.capacityMm===inferred.capacityMm&&c.hypothesis.drainagePerHour===inferred.drainagePerHour);
  if(duplicate){duplicate.originalPairs.push(rows);continue;}
  const hypothesis={id:'inferred-'+(candidates.length+1),label:'Proposal from original rows '+rows.map(i=>i+1).join(' and '),capacityMm:inferred.capacityMm,initialStoredMm:0,drainagePerHour:inferred.drainagePerHour,source:'Central-value inverse from calibration rows '+rows.map(i=>i+1).join(', ')+'. Initially empty, isolated receiver. Basis: '+basis.trim()};
  const result=runRain(project[target],project.width,project.height,weather,{drainingLayer:{schema:DRAINING_LAYER_SCHEMA,surface,capacityMm:hypothesis.capacityMm,initialStoredMm:0,drainagePerHour:hypothesis.drainagePerHour,source:hypothesis.source}});
  candidates.push({hypothesis,originalPairs:[rows],fillMinute:inferred.fillMinute,calibration:evaluateReadings(result,calibration),challenge:evaluateReadings(result,challenge)});
 }
 return {status:!pairs.length?'need-calibration-pair':!candidates.length?'unsupported-pairs':candidates.some(c=>c.calibration.compatible===true)?'proposals':'calibration-conflict',target,surface,basis:basis.trim(),pairCount:pairs.length,cellSteps,candidates,refusedPairs};
}
