import {validateProject,runRain} from './core.js';
import {validateStudy} from './study-contract.js';
import {evaluateReadings} from './infiltration-study.js';
import {depthWindow} from './reading-time-windows.js';
import {feasibleReadingTimes,intersectIntervals} from './clock-offset-intervals.js';
export function compareCommonClock(project,declaration,study=project.infiltrationStudy){
 validateProject(project);validateStudy(study);
 const lo=declaration?.minimumOffsetMinutes,hi=declaration?.maximumOffsetMinutes;
 if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo< -60||hi>60||lo>hi||typeof declaration.source!=='string'||!declaration.source.trim()||declaration.source.length>200)throw Error('Declare a sourced ordered common-offset range within ±60 minutes');
 const readings=project.observations.flatMap((reading,index)=>reading.scenario===study.target&&['calibration','challenge'].includes(reading.use)?[{reading,index}]:[]);
 if(!readings.length)return{status:'need-assigned-readings',candidates:[]};
 const steps=Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes),cellSteps=project.width*project.height*study.ratesMmHr.length*steps,scanWork=3*readings.length*study.ratesMmHr.length*(steps+1);
 // Intersections can split components; bound accumulated interval comparisons,
 // not only the first trajectory scan. This is conservative preflight work.
 const intervalWork=study.ratesMmHr.length*(steps+1)*readings.length*(readings.length+11)/2;
 if(cellSteps>3_000_000||scanWork>500_000||intervalWork>2_000_000)return{status:'work-limit',cellSteps,scanWork,intervalWork,candidates:[]};
 const domain=[Math.max(lo,...readings.map(r=>-r.reading.minute)),Math.min(hi,...readings.map(r=>project.weather.durationMinutes-r.reading.minute))];
 if(!project[study.target].some(c=>c.surface===study.surface))return{status:'surface-absent',candidates:[]};
 const calibration=readings.filter(r=>r.reading.use==='calibration'),challenge=readings.filter(r=>r.reading.use==='challenge');
 const candidates=study.ratesMmHr.map(rateMmHr=>{
  const result=runRain(project[study.target],project.width,project.height,project.weather,{surfaceInfiltrationOverride:{surface:study.surface,rateMmHr}});
  const ledger=readings.map(({reading,index})=>{
   const ownDomain=[Math.max(lo,-reading.minute),Math.min(hi,project.weather.durationMinutes-reading.minute)];
   if(ownDomain[0]>ownDomain[1])return{index,reading:structuredClone(reading),guardMm:null,admittedOffsetDomain:null,offsetIntervals:[],status:'outside-modeled-window'};
   const maximum=depthWindow(result,reading.cellIndex,reading.minute+ownDomain[0],reading.minute+ownDomain[1]).maximumMm;
   const guardMm=1e-9*Math.max(1,reading.depthMm,maximum);
   const times=feasibleReadingTimes(result.snapshots,reading.cellIndex,reading.depthMm-reading.uncertaintyMm-guardMm,reading.depthMm+reading.uncertaintyMm+guardMm,reading.minute+ownDomain[0],reading.minute+ownDomain[1]);
   return{index,reading:structuredClone(reading),guardMm,admittedOffsetDomain:ownDomain,status:'compared',offsetIntervals:times.map(([a,b])=>[a-reading.minute,b-reading.minute])};
  });
  const combine=role=>ledger.filter(r=>r.reading.use===role).reduce((bands,r)=>intersectIntervals(bands,r.offsetIntervals),[[lo,hi]]);
  const cal=combine('calibration'),held=combine('challenge');
  return{rateMmHr,nominalCalibration:evaluateReadings(result,calibration),nominalChallenge:evaluateReadings(result,challenge),calibrationCount:calibration.length,challengeCount:challenge.length,calibrationOffsets:calibration.length?cal:null,challengeOffsets:challenge.length?held:null,survivingOffsets:calibration.length?intersectIntervals(cal,held):null,readings:ledger,massErrorLiters:result.massErrorLiters};
 });
 candidates.sort((a,b)=>(a.nominalCalibration.rmseMm??0)-(b.nominalCalibration.rmseMm??0)||a.rateMmHr-b.rateMmHr);
 return{status:'compared',study:structuredClone(study),declaration:structuredClone(declaration),declaredDomain:[lo,hi],admittedDomain:domain[0]<=domain[1]?domain:null,cellSteps,scanWork,intervalWork,candidates,meaning:'Closed feasible common-offset intervals under the retained piecewise-linear model and explicit depth guard. Disconnected sets remain disconnected. All assigned readings must share one offset. Each reading separately retains its event-admitted domain; calibration support is shown before held-aside restrictions. Common survival requires every reading to be inside the retained event. Nominal calibration order is unchanged, no rate or clock is refitted or adopted, and feasible offsets are not physical timing confidence intervals.'};
}
