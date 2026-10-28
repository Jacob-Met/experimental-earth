import {validateProject} from './core.js';
import {SOLAR_SCHEMA,solarContext,validateSolarStudy} from './solar-occlusion-contract.js';
export function prepareSolarStudy(project,input){validateProject(project);return validateSolarStudy({schema:SOLAR_SCHEMA,geometry:'opaque-ground-columns',contextJson:solarContext(project),headingDeg:input.headingDeg,elevationDeg:input.elevationDeg,sunSource:input.sunSource,existing:structuredClone(input.existing??[]),proposal:structuredClone(input.proposal??[])});}
export function solarDirection(headingDeg,elevationDeg){const a=headingDeg*Math.PI/180,e=elevationDeg*Math.PI/180,c=Math.cos(e);return [c*Math.cos(a),c*Math.sin(a),Math.sin(e)].map(v=>Math.abs(v)<1e-15?0:v);}
/** Positive-ray slab interval. Padding +eps admits grazing, -eps proves interior. */
export function rayColumn(origin,direction,lo,hi,padding=0){
 let enter=0,exit=Infinity;
 for(let axis=0;axis<3;axis++){
  const low=lo[axis]-padding,high=hi[axis]+padding;if(low>high)return null;
  if(direction[axis]===0){if(origin[axis]<low||origin[axis]>high)return null;continue;}
  const a=(low-origin[axis])/direction[axis],b=(high-origin[axis])/direction[axis];enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));if(exit<enter)return null;
 }
 return exit>0?{enter,exit}:null;
}
function scenarioColumns(project,study,target){
 const cells=project[target],side=project.weather.cellSizeM,features=new Map(study[target].map(x=>[x.cellIndex,x]));
 const bottom=Math.min(...cells.map(c=>c.elevationM))-1;
 const columns=cells.map((c,i)=>{const x=i%project.width,y=Math.floor(i/project.width),f=features.get(i);return {cellIndex:i,lo:[x*side,y*side,bottom],hi:[(x+1)*side,(y+1)*side,c.elevationM],minTop:c.elevationM+(f?.heightMinM??0),maxTop:c.elevationM+(f?.heightMaxM??0),source:f?.source??c.provenance,kind:f?'declared column':'declared terrain'};});
 return {cells,side,features,columns};
}
function inspectScenario(project,study,target,direction,epsilonM,indices){
 const {cells,side,features,columns}=scenarioColumns(project,study,target);
 return indices.map(cellIndex=>{const cell=cells[cellIndex];
  if(features.has(cellIndex))return {cellIndex,status:'footprint',witness:null};
  const point=[(cellIndex%project.width+.5)*side,(Math.floor(cellIndex/project.width)+.5)*side,cell.elevationM];let lower=null,upper=null,grazing=null;
  const retain=(old,hit,column)=>!old||hit.enter<old.distanceM?{cellIndex:column.cellIndex,distanceM:hit.enter,source:column.source,kind:column.kind}:old;
  for(const column of columns){if(column.cellIndex===cellIndex)continue;
   const minHi=[column.hi[0],column.hi[1],column.minTop],maxHi=[column.hi[0],column.hi[1],column.maxTop];
   const robustMin=rayColumn(point,direction,column.lo,minHi,-epsilonM);
   if(robustMin&&robustMin.exit-robustMin.enter>epsilonM)lower=retain(lower,robustMin,column);
   const robustMax=rayColumn(point,direction,column.lo,maxHi,-epsilonM);
   if(robustMax&&robustMax.exit-robustMax.enter>epsilonM)upper=retain(upper,robustMax,column);
   const possible=rayColumn(point,direction,column.lo,maxHi,epsilonM);if(possible)grazing=retain(grazing,possible,column);
  }
  return {cellIndex,status:lower?'blocked':upper?'height-dependent':grazing?'grazing':'no-mapped-blocker',witness:lower??upper??grazing};
 });
}
function compareSolarPoints(project,cellIndex,admitted=false){
 if(!admitted)validateProject(project);const study=project.solarStudy;
 const count=project.width*project.height;
 if(cellIndex!==undefined&&(!Number.isInteger(cellIndex)||cellIndex<0||cellIndex>=count))throw Error('Solar sample cell is outside the original grid');
 const indices=cellIndex===undefined?Array.from({length:count},(_,i)=>i):[cellIndex];
 if(!study)return {status:'no-study'};
 if(!admitted&&study.contextJson!==solarContext(project))return {status:'context-changed'};
 const epsilonM=1e-9*Math.max(1,project.width*project.weather.cellSizeM,project.height*project.weather.cellSizeM,110);
 const direction=solarDirection(study.headingDeg,study.elevationDeg),existing=inspectScenario(project,study,'existing',direction,epsilonM,indices),proposal=inspectScenario(project,study,'proposal',direction,epsilonM,indices);
 return {status:'compared',direction,epsilonM,existing,proposal,changes:existing.flatMap((r,i)=>r.status===proposal[i].status?[]:[{cellIndex:r.cellIndex,existing:r.status,proposal:proposal[i].status}]),
 semantics:'Ground-centre samples under declared opaque-column and stepped-terrain geometry. Height bounds vary only declared columns. No mapped blocker does not establish sunlight: off-map structures and omitted objects remain unknown. No area, irradiance, temperature or comfort is inferred.'};
}

export function compareSolarOcclusion(project){return compareSolarPoints(project);}
export function compareSolarOcclusionAt(project,cellIndex){if(!Number.isInteger(cellIndex))throw Error('Choose one integer solar sample cell');const result=compareSolarPoints(project,cellIndex);if(result.status!=='compared')return result;return {...result,cellIndex,existing:result.existing[0],proposal:result.proposal[0]};}

/** The same declared column construction, exposed for continuous sky integration.
 * Returned geometry is independent of source arrays; no grazing padding is applied. */
export function prepareSolarReceiverGeometryAt(project,cellIndex){
 validateProject(project);
 if(!Number.isInteger(cellIndex)||cellIndex<0||cellIndex>=project.width*project.height)throw Error('Solar sample cell is outside the original grid');
 const study=project.solarStudy;
 if(!study)return {status:'no-study'};
 if(study.contextJson!==solarContext(project))return {status:'context-changed'};
 const result={status:'prepared',cellIndex};
 for(const target of ['existing','proposal']){
  const {cells,side,features,columns}=scenarioColumns(project,study,target);
  result[target]={point:[(cellIndex%project.width+.5)*side,(Math.floor(cellIndex/project.width)+.5)*side,cells[cellIndex].elevationM],footprint:features.has(cellIndex),columns:columns.filter(c=>c.cellIndex!==cellIndex)};
 }
 return result;
}

/** Bounded directions at one unchanged original receiver. Admission/context is
 * checked once; each direction retains the maintained ray and witness order. */
export function compareSolarDirectionsAt(project,cellIndex,directions){
 validateProject(project);const count=project.width*project.height;
 if(!Number.isInteger(cellIndex)||cellIndex<0||cellIndex>=count)throw Error('Solar sample cell is outside the original grid');
 if(!Array.isArray(directions)||!directions.length||directions.length>4096||6*(count-1)*directions.length>16000000)throw Error('Solar direction population exceeds the bounded ray-check budget');
 const admitted=Array.from(directions,row=>{
  if(!row||typeof row.headingDeg!=='number'||!Number.isFinite(row.headingDeg)||row.headingDeg<0||row.headingDeg>=360||typeof row.elevationDeg!=='number'||!Number.isFinite(row.elevationDeg)||row.elevationDeg<1||row.elevationDeg>90)throw Error('Declare heading0–<360 and elevation1–90 degrees for every direction');
  return {headingDeg:row.headingDeg,elevationDeg:row.elevationDeg};
 });
 if(!project.solarStudy)return {status:'no-study'};
 if(project.solarStudy.contextJson!==solarContext(project))return {status:'context-changed'};
 const working=structuredClone(project);
 const rays=admitted.map(row=>{working.solarStudy={...working.solarStudy,...row};const result=compareSolarPoints(working,cellIndex,true);return {...result,cellIndex,existing:result.existing[0],proposal:result.proposal[0]};});
 return {status:'compared',rays};
}
