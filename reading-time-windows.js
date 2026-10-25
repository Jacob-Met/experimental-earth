import {validateProject,runRain,interpolateDepth} from './core.js';
import {validateStudy} from './study-contract.js';
import {evaluateReadings} from './infiltration-study.js';
export const TIME_WINDOW_CELL_STEPS=3_000_000;
export const TIME_WINDOW_SAMPLE_LIMIT=500_000;

export function validateReadingWindows(project,study,windows){
 validateProject(project);validateStudy(study);
 if(!Array.isArray(windows)||windows.length<1||windows.length>100)throw Error('Declare 1–100 sourced reading-time windows');
 const seen=new Set();
 for(const w of windows){
  const r=project.observations[w?.readingIndex];
  if(!Number.isInteger(w?.readingIndex)||seen.has(w.readingIndex)||!r||r.scenario!==study.target||!['calibration','challenge'].includes(r.use))throw Error('Choose distinct assigned readings in this observed scenario');
  if(!Number.isFinite(w.earliestMinute)||!Number.isFinite(w.latestMinute)||w.earliestMinute<0||w.latestMinute>project.weather.durationMinutes||w.earliestMinute>r.minute||w.latestMinute<r.minute)throw Error('Time window must contain the recorded minute and stay within the modeled event');
  if(typeof w.source!=='string'||!w.source.trim()||w.source.length>200)throw Error('Each time window needs a source of at most 200 characters');
  seen.add(w.readingIndex);
 }
 return windows.map(w=>({...w}));
}

/** Extrema of the retained piecewise-linear depth course, including interior knots. */
export function depthWindow(result,cellIndex,earliestMinute,latestMinute){
 if(!Number.isFinite(earliestMinute)||!Number.isFinite(latestMinute)||earliestMinute>latestMinute)throw Error('Ordered finite reading-time window required');
 const first=interpolateDepth(result,cellIndex,earliestMinute),last=interpolateDepth(result,cellIndex,latestMinute);
 const samples=[{minute:earliestMinute,depthMm:first.depthMm},{minute:latestMinute,depthMm:last.depthMm}];
 for(const s of result.snapshots)if(s.minute>earliestMinute&&s.minute<latestMinute)samples.push({minute:s.minute,depthMm:s.depthsMm[cellIndex]});
 let min=samples[0],max=samples[0];
 for(const s of samples){if(s.depthMm<min.depthMm)min=s;if(s.depthMm>max.depthMm)max=s;}
 return {minimumMm:min.depthMm,maximumMm:max.depthMm,minimumAtMinute:min.minute,maximumAtMinute:max.minute,endpointBrackets:[first,last],sampleCount:samples.length,interpretation:'extrema of retained piecewise-linear solver history'};
}

export function compareReadingWindows(project,windows,study=project.infiltrationStudy){
 const declared=validateReadingWindows(project,study,windows),byIndex=new Map(declared.map(w=>[w.readingIndex,w]));
 const readings=project.observations.flatMap((reading,index)=>reading.scenario===study.target&&['calibration','challenge'].includes(reading.use)?[{reading,index}]:[]);
 const calibration=readings.filter(r=>r.reading.use==='calibration'),challenge=readings.filter(r=>r.reading.use==='challenge');
 const steps=Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes),cellSteps=project.width*project.height*study.ratesMmHr.length*steps;
 const sampleWork=study.ratesMmHr.length*readings.length*(steps+3);
 const context={cellSteps,sampleWork,windows:declared,sourceSignature:JSON.stringify(project),study:structuredClone(study),originalReadings:readings.map(r=>structuredClone(r))};
 if(cellSteps>TIME_WINDOW_CELL_STEPS||sampleWork>TIME_WINDOW_SAMPLE_LIMIT)return {...context,status:'work-limit',candidates:[]};
 if(!project[study.target].some(c=>c.surface===study.surface))return {...context,status:'surface-absent',candidates:[]};
 const candidates=study.ratesMmHr.map(rateMmHr=>{
  const result=runRain(project[study.target],project.width,project.height,project.weather,{surfaceInfiltrationOverride:{surface:study.surface,rateMmHr}});
  const ledger=readings.map(({reading,index})=>{
   const w=byIndex.get(index),earliestMinute=w?.earliestMinute??reading.minute,latestMinute=w?.latestMinute??reading.minute;
   const range=depthWindow(result,reading.cellIndex,earliestMinute,latestMinute);
   const lowerMm=reading.depthMm-reading.uncertaintyMm,upperMm=reading.depthMm+reading.uncertaintyMm;
   const guardMm=1e-9*Math.max(1,reading.depthMm,range.maximumMm);
   const possible=range.maximumMm>=lowerMm-guardMm&&range.minimumMm<=upperMm+guardMm;
   const allTimes=range.minimumMm>=lowerMm-guardMm&&range.maximumMm<=upperMm+guardMm;
   return {index,use:reading.use,earliestMinute,latestMinute,windowDeclared:Boolean(w),windowSource:w?.source??null,...range,lowerMm,upperMm,guardMm,possible,allTimes,status:allTimes?'all-times-compatible':possible?'some-time-compatible':'incompatible-throughout'};
  });
  const group=role=>{const rows=ledger.filter(r=>r.use===role);return {count:rows.length,possible:rows.length?rows.every(r=>r.possible):null,allTimes:rows.length?rows.every(r=>r.allTimes):null};};
  return {rateMmHr,nominalCalibration:evaluateReadings(result,calibration),nominalChallenge:evaluateReadings(result,challenge),calibration:group('calibration'),challenge:group('challenge'),readings:ledger,massErrorLiters:result.massErrorLiters};
 });
 candidates.sort((a,b)=>(a.nominalCalibration.rmseMm??0)-(b.nominalCalibration.rmseMm??0)||a.rateMmHr-b.rateMmHr);
 return {...context,status:'compared',candidates,meaning:'Each declared reading time may vary independently within its own sourced interval. Possible compatibility is existential per reading, not a shared clock offset, acquisition ordering, probability or validated timing correction. Candidate order uses only original-minute calibration RMSE. Depth ranges are extrema of linear interpolation between retained solver snapshots, not physical uncertainty bounds.'};
}
