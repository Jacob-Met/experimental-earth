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
function inspectScenario(project,study,target,direction,epsilonM,onlyIndex){
 const {cells,side,features,columns}=scenarioColumns(project,study,target);
 return (onlyIndex===undefined?cells.map((_,i)=>i):[onlyIndex]).map(cellIndex=>{
  const cell=cells[cellIndex];
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

/** Read-only point investigation. Tightened intervals are hypothetical, never measurements. */
export function investigateSolarHeight(project,{target,cellIndex,intervals=[]}={}){
 validateProject(project);
 if(!['existing','proposal'].includes(target))throw Error('Choose an existing or proposal sample');
 if(!Number.isInteger(cellIndex)||cellIndex<0||cellIndex>=project.width*project.height)throw Error('Choose a valid ground-centre cell');
 const study=project.solarStudy;
 if(!study)return {status:'no-study'};
 if(study.contextJson!==solarContext(project))return {status:'context-changed'};
 if(!Array.isArray(intervals)||intervals.length>64)throw Error('Use at most 64 hypothetical tightened intervals');
 const tightened=new Map();
 for(const row of intervals){
  const saved=study[target].find(c=>c.cellIndex===row?.cellIndex);
  if(!saved||tightened.has(row.cellIndex)||!Number.isFinite(row.heightMinM)||!Number.isFinite(row.heightMaxM)||row.heightMinM<saved.heightMinM||row.heightMaxM>saved.heightMaxM||row.heightMinM>row.heightMaxM)throw Error('Each hypothetical interval must be unique and contained in its saved column bounds');
  tightened.set(row.cellIndex,{heightMinM:row.heightMinM,heightMaxM:row.heightMaxM});
 }
 const epsilonM=1e-9*Math.max(1,project.width*project.weather.cellSizeM,project.height*project.weather.cellSizeM,110),direction=solarDirection(study.headingDeg,study.elevationDeg);
 const hypothetical={...study,[target]:study[target].map(c=>({...c,...tightened.get(c.cellIndex)}))};
 const original=inspectScenario(project,study,target,direction,epsilonM,cellIndex)[0],result=inspectScenario(project,hypothetical,target,direction,epsilonM,cellIndex)[0];
 const {cells,side,columns,features}=scenarioColumns(project,hypothetical,target),point=[(cellIndex%project.width+.5)*side,(Math.floor(cellIndex/project.width)+.5)*side,cells[cellIndex].elevationM];
 const candidates=[],terrain=[];
 if(result.status!=='footprint')for(const column of columns){
  if(column.cellIndex===cellIndex)continue;
  const minHi=[column.hi[0],column.hi[1],column.minTop],maxHi=[column.hi[0],column.hi[1],column.maxTop];
  const interior=hi=>{const r=rayColumn(point,direction,column.lo,hi,-epsilonM);return !!r&&r.exit-r.enter>epsilonM;};
  const status=interior(minHi)?'blocked':interior(maxHi)?'height-dependent':rayColumn(point,direction,column.lo,maxHi,epsilonM)?'grazing':'no-mapped-blocker';
  if(!features.has(column.cellIndex)){if(status!=='no-mapped-blocker')terrain.push({cellIndex:column.cellIndex,source:column.source,status});continue;}
  // A horizontal slab uses the same ray parameter as the full 3D kernel.
  const horizontal=padding=>rayColumn([point[0],point[1],0],[direction[0],direction[1],0],[column.lo[0],column.lo[1],-1],[column.hi[0],column.hi[1],1],padding);
  const possible=horizontal(epsilonM);if(!possible)continue;
  const exact=horizontal(0),inside=horizontal(-epsilonM),ground=cells[column.cellIndex].elevationM;
  const nominal=exact&&Number.isFinite(exact.enter)?point[2]+exact.enter*direction[2]-ground:null;
  const lower=point[2]+possible.enter*direction[2]-ground-epsilonM;
  const upper=inside&&inside.exit-inside.enter>epsilonM?point[2]+(inside.enter+epsilonM)*direction[2]-ground+epsilonM:null;
  const saved=study[target].find(c=>c.cellIndex===column.cellIndex);
  candidates.push({cellIndex:column.cellIndex,source:saved.source,savedInterval:{heightMinM:saved.heightMinM,heightMaxM:saved.heightMaxM},testedInterval:{heightMinM:column.minTop-ground,heightMaxM:column.maxTop-ground},hypothetical:tightened.has(column.cellIndex),status,criticalHeightM:nominal,guardBandM:{lower,upper}});
 }
 return {status:'investigated',target,cellIndex,original,result,candidates,terrain,epsilonM,hypothetical:intervals.length>0,
 semantics:'Critical heights are above each column’s declared ground for this saved point and sun direction. Equality is contact, not robust blocking. Hypothetical tighter intervals are not measurements and do not update the study. Every possible mapped blocker matters; ruling out one does not rule out the others. Terrain remains fixed; survey uncertainty is not propagated. Off-map and omitted geometry remain unknown.'};
}
