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
function inspectScenario(project,study,target,direction,epsilonM){
 const cells=project[target],side=project.weather.cellSizeM,features=new Map(study[target].map(x=>[x.cellIndex,x]));
 const bottom=Math.min(...cells.map(c=>c.elevationM))-1;
 const columns=cells.map((c,i)=>{const x=i%project.width,y=Math.floor(i/project.width),f=features.get(i);return {cellIndex:i,lo:[x*side,y*side,bottom],hi:[(x+1)*side,(y+1)*side,c.elevationM],minTop:c.elevationM+(f?.heightMinM??0),maxTop:c.elevationM+(f?.heightMaxM??0),source:f?.source??c.provenance,kind:f?'declared column':'declared terrain'};});
 return cells.map((cell,cellIndex)=>{
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
export function compareSolarOcclusion(project){
 validateProject(project);const study=project.solarStudy;
 if(!study)return {status:'no-study'};
 if(study.contextJson!==solarContext(project))return {status:'context-changed'};
 const epsilonM=1e-9*Math.max(1,project.width*project.weather.cellSizeM,project.height*project.weather.cellSizeM,110);
 const direction=solarDirection(study.headingDeg,study.elevationDeg),existing=inspectScenario(project,study,'existing',direction,epsilonM),proposal=inspectScenario(project,study,'proposal',direction,epsilonM);
 return {status:'compared',direction,epsilonM,existing,proposal,changes:existing.flatMap((r,i)=>r.status===proposal[i].status?[]:[{cellIndex:i,existing:r.status,proposal:proposal[i].status}]),
 semantics:'Ground-centre samples under declared opaque-column and stepped-terrain geometry. Height bounds vary only declared columns. No mapped blocker does not establish sunlight: off-map structures and omitted objects remain unknown. No area, irradiance, temperature or comfort is inferred.'};
}
