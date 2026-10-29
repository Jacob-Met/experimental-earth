import {planDurationGauge} from './rain-duration-question.js';
import {compareRainDuration} from './rain-duration-evidence.js';
import {validateRainGauge} from './rain-gauge-evidence.js';
export function receiveDurationGauge(project,request,gauge,durations,windows,uncertaintyMm,reading){
 // Reserve both complete comparisons before any fitting: forecast and receipt.
 const cellSteps=durations?.length*request.rainRatesMmHr?.length*request.ratesMmHr?.length*project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
 if(!Number.isFinite(cellSteps)||2*cellSteps>3_000_000)throw Error('Complete planned-and-received course exceeds3,000,000 cell steps.');
 const forecast=planDurationGauge(project,request,gauge,durations,windows,uncertaintyMm);
 if(!reading||reading.use!=='challenge')throw Error('Supply an original newly received reading explicitly held aside.');
 if(!forecast.ranked.some(w=>w.window.startMinute===reading.startMinute&&w.window.endMinute===reading.endMinute))throw Error('The received interval must be one of the offered unrecorded windows.');
 const received=validateRainGauge(project,{...structuredClone(gauge),readings:[...structuredClone(gauge.readings),structuredClone(reading)]});
 const result=compareRainDuration(project,request,received,durations);
 return {forecast,received,result,cellSteps:2*cellSteps,meaning:'Actual original held-aside rainfall, with its own supplied uncertainty, challenges the frozen calibration alternatives. The planned precision is not substituted for actual uncertainty and prospective predictions are not observations. Original inputs are preserved; an incompatible readout may challenge every offered explanation.'};
}
