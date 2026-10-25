import {runRain,validateProject} from './core.js';
import {surfaceElevationEdits,edgeGroundEdits,COMPONENT_WORK_LIMIT,COMPONENT_METRICS} from './proposal-components.js';
export function compareThreeFactors(project, options={}) {
 validateProject(project);
 const edits=surfaceElevationEdits(project),edges=edgeGroundEdits(project);
 if(!edits.surfaceIndices.length||!edits.elevationIndices.length||!edges.edgeIndices.length)throw Error('Declare all three physical factors.');
 const estimatedCellSteps=8*project.existing.length*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
 if(estimatedCellSteps>COMPONENT_WORK_LIMIT)throw Error('Full eight-world comparison exceeds cell-step budget.');
 const runs=Array.from({length:8},(_,mask)=>{
  const cells=structuredClone(mask&2?project.proposal:project.existing);
  for(let i=0;i<cells.length;i++){
   cells[i].surface=(mask&1?project.proposal:project.existing)[i].surface;
   delete cells[i].internalBarriers;
   const edge=(mask&4?project.proposal:project.existing)[i].internalBarriers;
   if(edge!==undefined)cells[i].internalBarriers=structuredClone(edge);
   cells[i].provenance='Derived three-factor comparison; original source plans retained';
  }
  return runRain(cells,project.width,project.height,project.weather,options);
 });
 return {estimatedCellSteps,metrics:COMPONENT_METRICS.map(metric=>{
  const values=runs.map(r=>r[metric.key]), effects=[...values];effects[0]=0;
  for(let mask=1;mask<8;mask++){
   effects[mask]=values[mask]-values[0];
   for(let sub=(mask-1)&mask;sub;sub=(sub-1)&mask)effects[mask]-=effects[sub];
  }
  const conditionalPairs=[[1,2,4],[1,4,2],[2,4,1]].map(([a,b,c])=>({a,b,third:c,without:values[a|b]-values[a]-values[b]+values[0],with:values[a|b|c]-values[a|c]-values[b|c]+values[c]}));
  return {...metric,values,effects,conditionalPairs};
 }),balances:runs.map(r=>r.massErrorLiters)};
}

import {compareInfiltration} from './infiltration-study.js';
import {DEFAULT_STUDY,validateStudy} from './study-contract.js';
export function compareThreeFactorHypotheses(project,{study=project.infiltrationStudy??DEFAULT_STUDY,subset='all'}={}){
 validateProject(project);validateStudy(study);
 const factorEdits=surfaceElevationEdits(project),edgeEdits=edgeGroundEdits(project);
 if(!factorEdits.surfaceIndices.length||!factorEdits.elevationIndices.length||!edgeEdits.edgeIndices.length)throw Error('Declare all three physical factors.');
 if(!['all','calibration','surviving'].includes(subset))throw Error('Unknown hypothesis subset');
 const estimatedCellSteps=9*study.ratesMmHr.length*project.existing.length*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
 if(estimatedCellSteps>COMPONENT_WORK_LIMIT)throw Error('Complete source/eight-world comparison exceeds work budget');
 const evidence=subset==='all'?null:compareInfiltration(project,study);
 const empty=status=>({status,candidates:[],estimatedCellSteps});
 if(evidence?.status==='surface-absent')return empty('surface-absent-in-observed-source');
 if(evidence&&!evidence.counts.calibration)return empty('need-calibration');
 if(subset==='surviving'&&!evidence.counts.challenge)return empty('need-challenge');
 const rates=subset==='all'?study.ratesMmHr:subset==='calibration'?evidence.compatibleRatesMmHr:evidence.survivingRatesMmHr;
 if(!rates.length)return empty('no-compatible-rates');
 if(![...project.existing,...project.proposal].some(c=>c.surface===study.surface))return empty('surface-absent');
 return {status:'compared',estimatedCellSteps,candidates:rates.map(rateMmHr=>({rateMmHr,result:compareThreeFactors(project,{surfaceInfiltrationOverride:{surface:study.surface,rateMmHr}})}))};
}
