import {validateRainGauge} from './rain-gauge-evidence.js';
import {rainfallHistoryConsistency} from './rain-gauge-history.js';
export const RECHECK_WORK_LIMIT=3_000_000;
export function investigateGaugeRechecks(project,gauge,{maxRelaxations=RECHECK_WORK_LIMIT}={}){
 const original=validateRainGauge(project,gauge),rows=original.readings.map((reading,index)=>({reading,index})).filter(e=>e.reading.use==='calibration');
 if(!Number.isInteger(maxRelaxations)||maxRelaxations<0||maxRelaxations>RECHECK_WORK_LIMIT)throw Error('Declare a bounded complete recheck budget.');
 const count=rows.length,vertices=new Set(rows.flatMap(e=>[e.reading.startMinute,e.reading.endMinute])).size;
 // Reserve base and every original calibration exclusion before inspecting results.
 const reservedRelaxations=(count+1)*vertices*Math.max(0,vertices-1+2*count);
 if(reservedRelaxations>maxRelaxations)return {status:'work-limit',reservedRelaxations,choices:[]};
 const base=rainfallHistoryConsistency(project,original);
 if(base.status!=='interval-totals-inconsistent')return {status:base.status,reservedRelaxations,choices:[],base};
 const choices=[];
 for(const {reading,index}of rows){const trial=structuredClone(original);trial.readings[index].use='unassigned';const result=count===1?{status:'no-calibration'}:rainfallHistoryConsistency(project,trial);if(['no-calibration','nonnegative-history-compatible'].includes(result.status))choices.push({index,reading,remainingCalibration:count-1,remainingStatus:result.status});}
 return {status:choices.length?'single-reading-rechecks':'no-single-reading-resolution',reservedRelaxations,choices,base,
 meaning:'Each listed original reading is a possible source to recheck: excluding only that calibration constraint would restore compatibility with some nonnegative rainfall history. This does not show that the reading is wrong, choose among competing sources, or establish a rainfall profile or soil fit. No original value or evidence role has been changed. If none qualifies, rechecking only one reading cannot resolve all current nominal-band contradictions.'};
}
