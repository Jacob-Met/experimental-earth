import {compareRainSoil,RAIN_SOIL_WORK_LIMIT} from './rain-soil-evidence.js';
import {runRain} from './core.js';
import {greatestDepthDisagreement} from './depth-disagreement.js';
// Planning under finite joint explanations; no probability or acquisition is inferred.
export function validateQuestionScope(project,{fromMinute,toMinute,cellIndices,uncertaintyMm}={}){
 if(!Number.isFinite(fromMinute)||!Number.isFinite(toMinute)||fromMinute<0||toMinute<fromMinute||toMinute>project.weather.durationMinutes||!Number.isFinite(uncertaintyMm)||uncertaintyMm<0||uncertaintyMm>1000||!Array.isArray(cellIndices)||!cellIndices.length||cellIndices.length>project.width*project.height||new Set(cellIndices).size!==cellIndices.length||Array.from(cellIndices).some(c=>!Number.isInteger(c)||c<0||c>=project.width*project.height))throw Error('Explicit bounded acquisition scope required');
 return {fromMinute,toMinute,cellIndices:[...cellIndices],uncertaintyMm};
}
export function investigateQuestion(project,request,declaration){
 const {fromMinute,toMinute,cellIndices,uncertaintyMm}=validateQuestionScope(project,declaration);
 const work=2*request.ratesMmHr.length*request.rainRatesMmHr.length*project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
 if(work>RAIN_SOIL_WORK_LIMIT)throw Error('Complete comparison and planning work exceeds budget');
 const result=compareRainSoil(project,request),pairs=result.compatiblePairs??[];
 if(pairs.length<2)return {status:'insufficient-alternatives',pairs};
 const runs=pairs.map(({rainMmHr,rateMmHr})=>runRain(project[request.target],project.width,project.height,{...project.weather,rainMmHr},{surfaceInfiltrationOverride:{surface:request.surface,rateMmHr}}));
 const q=greatestDepthDisagreement(runs,{fromMinute,toMinute,cellIndices,recorded:project.observations.filter(r=>r.scenario===request.target)});
 const guard=1e-9*Math.max(1,...(q.best?.depthsMm??[]));
 return {status:!q.best?'no-unrecorded-question':q.best.spanMm>2*uncertaintyMm+guard?'separating-extremes':'no-separated-extremes',pairs,...q,uncertaintyMm};
}
