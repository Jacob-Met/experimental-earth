import {runRain, SURFACES, DEFAULT_WEATHER} from '../core.js';
import {runSubstepped, MAX_METHOD_CELL_STEPS} from './rain-integrator.js';

/** Exact smooth reference for a declared symmetric, closed, fully wet problem.
 * This identifies a numerical equation in one regime, not physical hydrology. */
export function compareWetColumnReference({rainMmHr=36,mobilityPerHour=.5,
  durationMinutes=60,stepsMinutes=[30,15,5,2.5,2,1],substeps=[1,2,4,8]}={}){
 const low=SURFACES.sealed.infiltrationMmHr,high=SURFACES.turf.infiltrationMmHr;
 const finite=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
 if(!finite(rainMmHr,0,250)||rainMmHr<=high||!finite(mobilityPerHour,1e-6,10)||
    !finite(durationMinutes,5,720)||!Array.isArray(stepsMinutes)||stepsMinutes.length<1||stepsMinutes.length>8||
    !Array.isArray(substeps)||substeps.length<1||substeps.length>8||
    new Set(stepsMinutes).size!==stepsMinutes.length||new Set(substeps).size!==substeps.length||
    substeps.some(x=>!Number.isInteger(x)||x<1||x>8))throw Error('Invalid bounded wet-column reference; rain must exceed turf infiltration');
 for(const step of stepsMinutes){
  if(!finite(step,1,30)||!Number.isInteger(durationMinutes/step)||2*mobilityPerHour*step/60>1)
   throw Error('Reference requires supported, whole-duration, nonoscillatory steps');
 }
 const estimatedCellSteps=4*stepsMinutes.reduce((sum,step)=>sum+durationMinutes/step*(1+substeps.reduce((a,b)=>a+b,0)),0);
 if(estimatedCellSteps>MAX_METHOD_CELL_STEPS)throw Error('Wet-column reference exceeds maintained method cell-step budget');
 const cells=Array.from({length:4},(_,i)=>({elevationM:0,surface:i%2?'turf':'sealed',provenance:'Authored symmetric wet-column reference; not field data'}));
 const t=durationMinutes/60,mean=(rainMmHr-(low+high)/2)*t;
 const contrast=(high-low)/(2*mobilityPerHour)*(-Math.expm1(-2*mobilityPerHour*t));
 const exactDepthMm=[mean+contrast/2,mean-contrast/2,mean+contrast/2,mean-contrast/2];
 const rows=[];
 for(const stepMinutes of stepsMinutes){
  const weather={...DEFAULT_WEATHER,rainMmHr,mobilityPerHour,stormMinutes:durationMinutes,durationMinutes,stepMinutes,boundaryExitPerHour:0};
  for(const parts of [null,...substeps]){
   const result=parts===null?runRain(cells,2,2,weather):runSubstepped(cells,2,2,weather,{substeps:parts});
   const h=stepMinutes/(60*(parts??1)),n=durationMinutes/stepMinutes*(parts??1),q=1-2*mobilityPerHour*h;
   const discreteContrast=q*(high-low)/(2*mobilityPerHour)*(q===0?1:-Math.expm1(n*Math.log1p(-2*mobilityPerHour*h)));
   const actualContrast=result.finalDepthMm[0]-result.finalDepthMm[1];
   rows.push({method:parts===null?'incumbent':'maintained-substeps',stepMinutes,substeps:parts??1,
    actualCellSteps:4*n,finalDepthMm:result.finalDepthMm,exactDepthMm:[...exactDepthMm],
    continuousContrastMm:contrast,discreteContrastMm:discreteContrast,
    discreteResidualMm:actualContrast-discreteContrast,contrastErrorMm:actualContrast-contrast,
    maxDepthErrorMm:Math.max(...result.finalDepthMm.map((v,i)=>Math.abs(v-exactDepthMm[i]))),
    massErrorLiters:result.massErrorLiters,minDepthMm:Math.min(...result.finalDepthMm),
    meanDepthErrorMm:result.finalDepthMm.reduce((a,b)=>a+b,0)/4-mean});
  }
 }
 return {schema:'experimental-earth-wet-column-reference/1',researchOnly:true,physicalEvidence:false,
  assumptions:{rainMmHr,mobilityPerHour,durationMinutes,infiltrationMmHr:[low,high],closedBoundary:true,flatSymmetricGrid:true},
  estimatedCellSteps,exactDepthMm,rows,
  meaning:'Analytic solution of the declared smooth wet-column equation, not measured site behavior. Drying, walls, crests and nonuniform forcing are outside this reference.'};
}
