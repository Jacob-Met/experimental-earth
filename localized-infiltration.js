import {validateProject,runRain,SURFACES} from './core.js';
import {evaluateReadings} from './infiltration-study.js';
import {validateStudy} from './study-contract.js';
import {checkProjectFileBytes} from './project-portability.js';
export const LOCALIZED_INFILTRATION_KIND='experimental-earth/localized-infiltration/1';
export const LOCALIZED_INFILTRATION_WORK_LIMIT=3_000_000;
const materialDefaults=()=>Object.fromEntries(Object.entries(SURFACES).map(([name,s])=>[name,s.infiltrationMmHr]));
const keys=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...names].sort().join(',');
function admittedWork(project,query){
 const work=2*query.ratesMmHr.length*project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
 if(work>LOCALIZED_INFILTRATION_WORK_LIMIT)throw Error('Localized comparison exceeds 3 million model cell-steps; reduce duration, grid or candidate rates');
 return work;
}
export function validateLocalizedQuery(project,input){
 validateProject(project);
 if(!keys(input,['target','cellIndex','ratesMmHr','basis']))throw Error('Declare the scenario, selected cell, rates and spatial basis');
 const {target,cellIndex,ratesMmHr,basis}=input;
 if(!['existing','proposal'].includes(target)||!Number.isInteger(cellIndex)||cellIndex<0||cellIndex>=project[target].length)throw Error('Choose a cell inside the observed scenario');
 if(typeof basis!=='string'||!basis.trim()||basis.length>500)throw Error('Declare a spatial hypothesis basis of at most 500 characters');
 if(!Array.isArray(ratesMmHr)||!Array.from({length:ratesMmHr.length},(_,i)=>Object.hasOwn(ratesMmHr,i)).every(Boolean))throw Error('Declare a dense list of candidate rates');
 const surface=project[target][cellIndex].surface;
 validateStudy({target,surface,ratesMmHr});
 return {target,cellIndex,ratesMmHr:[...ratesMmHr],basis:basis.trim()};
}
export function compareLocalizedInfiltration(project,input){
 const query=validateLocalizedQuery(project,input),{target,cellIndex,ratesMmHr}=query,surface=project[target][cellIndex].surface;
 const work=admittedWork(project,query);
 const readings=project.observations.map((reading,index)=>({reading:structuredClone(reading),index}));
 const calibration=readings.filter(r=>r.reading.scenario===target&&r.reading.use==='calibration');
 const challenge=readings.filter(r=>r.reading.scenario===target&&r.reading.use==='challenge');
 const candidates=[];
 for(const scope of ['uniform','localized'])for(const rateMmHr of ratesMmHr){
  const options=scope==='uniform'?{surfaceInfiltrationOverride:{surface,rateMmHr}}:{infiltrationOverride:{cellIndex,rateMmHr}};
  const result=runRain(project[target],project.width,project.height,project.weather,options);
  candidates.push({id:`${scope}:${rateMmHr}`,scope,rateMmHr,affectedCells:scope==='uniform'?project[target].filter(c=>c.surface===surface).length:1,
   calibration:evaluateReadings(result,calibration),challenge:evaluateReadings(result,challenge),
   declaredCapacityLitersPerHour:project[target].reduce((sum,cell,i)=>sum+(scope==='uniform'&&cell.surface===surface||scope==='localized'&&i===cellIndex?rateMmHr:SURFACES[cell.surface].infiltrationMmHr),0)*project.weather.cellSizeM**2,
   absorbedLiters:result.absorbedLiters,exitLiters:result.exitLiters,storedLiters:result.storedLiters,massErrorLiters:result.massErrorLiters});
 }
 candidates.sort((a,b)=>(a.calibration.rmseMm??0)-(b.calibration.rmseMm??0)||a.scope.localeCompare(b.scope)||a.rateMmHr-b.rateMmHr);
 const compatible=candidates.filter(c=>c.calibration.compatible===true),survivors=compatible.filter(c=>c.challenge.compatible!==false);
 let status='ambiguous';
 if(!calibration.length)status='need-calibration';else if(!compatible.length)status='calibration-rejected';else if(challenge.length&&!survivors.length)status='challenged';else if(!challenge.length)status='needs-challenge';else if(survivors.length===1)status='one-survivor';
 return {status,query,surface,cellAreaM2:project.weather.cellSizeM**2,sourceSignature:JSON.stringify(project),work,candidates,readings,
  counts:{calibration:calibration.length,challenge:challenge.length,ignored:readings.length-calibration.length-challenge.length},
  defaultRatesMmHr:materialDefaults(),
  compatibleIds:compatible.map(c=>c.id),survivingIds:survivors.map(c=>c.id),
  semantics:'Finite comparison of a uniform surface capacity and a declared single-cell departure from current material defaults. Calibration alone orders candidates; held-aside values never choose the cell or rate. Compatible alternatives do not establish spatial soil properties, field accuracy or a unique cause.'};
}
export function buildLocalizedReceipt(project,query){
 const canonical=validateLocalizedQuery(project,query);admittedWork(project,canonical);
 return {kind:LOCALIZED_INFILTRATION_KIND,project:structuredClone(project),query:canonical,materialDefaultsMmHr:materialDefaults()};
}
export function serializeLocalizedReceipt(project,query){
 const text=JSON.stringify(buildLocalizedReceipt(project,query),null,2);checkProjectFileBytes(new TextEncoder().encode(text).length);return text;
}
export function reopenLocalizedReceipt(text){
 if(typeof text!=='string')throw Error('Expected original investigation JSON');
 checkProjectFileBytes(new TextEncoder().encode(text).length);
 let input;try{input=JSON.parse(text);}catch{throw Error('Invalid localized infiltration JSON');}
 if(!keys(input,['kind','project','query','materialDefaultsMmHr'])||input.kind!==LOCALIZED_INFILTRATION_KIND)throw Error('Unsupported localized investigation envelope; supply original inputs only');
 const defaults=materialDefaults();if(!keys(input.materialDefaultsMmHr,Object.keys(defaults))||Object.keys(defaults).some(k=>input.materialDefaultsMmHr[k]!==defaults[k]))throw Error('Material defaults changed; replay requires the originally declared solver defaults');
 const receipt=buildLocalizedReceipt(input.project,input.query),report=compareLocalizedInfiltration(receipt.project,receipt.query);
 return {receipt,report};
}
