import {validateProject} from './core.js';
import {validateStudy} from './study-contract.js';
import {compareRainGauge,validateRainGauge} from './rain-gauge-evidence.js';
import {RAIN_SOIL_WORK_LIMIT} from './rain-soil-evidence.js';
export function compareRainDuration(project,request,gauge,durations){
 validateProject(project);validateStudy(request);validateRainGauge(project,gauge);
 if(!Array.isArray(durations)||durations.length<1||durations.length>9||Array.from(durations).some(x=>!Number.isFinite(x)||x<0||x>project.weather.durationMinutes)||new Set(durations).size!==durations.length)throw Error('Offer1–9 distinct storm-end minutes within the original event.');
 if(!Array.isArray(request.rainRatesMmHr)||request.rainRatesMmHr.length<1||request.rainRatesMmHr.length>9||Array.from(request.rainRatesMmHr).some(x=>!Number.isFinite(x)||x<0||x>250))throw Error('Supply bounded original rainfall offers.');
 const cellSteps=durations.length*request.rainRatesMmHr.length*request.ratesMmHr.length*project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
 if(cellSteps>RAIN_SOIL_WORK_LIMIT)throw Error('Complete duration/rain/soil comparison exceeds3,000,000 cell steps.');
 const reports=durations.map(stormMinutes=>{const variant=structuredClone(project);variant.weather.stormMinutes=stormMinutes;return {stormMinutes,report:compareRainGauge(variant,request,gauge)};});
 const candidates=reports.flatMap(({stormMinutes,report})=>report.candidates.map(c=>({...c,stormMinutes}))).sort((a,b)=>(a.calibration.rmseMm??0)-(b.calibration.rmseMm??0)||a.stormMinutes-b.stormMinutes||a.rainMmHr-b.rainMmHr||a.rateMmHr-b.rateMmHr);
 const identity=c=>({stormMinutes:c.stormMinutes,rainMmHr:c.rainMmHr,rateMmHr:c.rateMmHr}),compatible=candidates.filter(c=>c.compatible),surviving=compatible.filter(c=>c.surviving),counts=reports[0].report.counts;
 const status=reports[0].report.baseStatus==='surface-absent'?'surface-absent':!counts.calibration?'need-calibration':!compatible.length?'calibration-rejected':!counts.challenge&&!counts.gaugeChallenge?'needs-challenge':!surviving.length?'challenged':surviving.length===1?'one-survivor':'ambiguous';
 return {status,counts,cellSteps,candidates,compatibleTriples:compatible.map(identity),survivingTriples:surviving.map(identity),meaning:'Finite explicitly offered constant-rain durations, intensities and soil rates, under the original event clock and all other retained assumptions. Calibration alone orders and filters; held-aside values only challenge. No duration is adopted, no arbitrary rainfall timeline is inferred, and no unique environmental parameter estimate follows.'};
}
export const RAIN_DURATION_SCHEMA='experimental-earth-rain-duration/1';
export function exportRainDuration(project,request,gauge,durations){compareRainDuration(project,request,gauge,durations);const text=JSON.stringify({schema:RAIN_DURATION_SCHEMA,project,request,gauge,durations},null,2);if(new TextEncoder().encode(text).length>4*1024*1024)throw Error('At most4MiB original inputs.');return text;}
export function importRainDuration(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>4*1024*1024)throw Error('At most4MiB original inputs.');const raw=JSON.parse(text),keys=['schema','project','request','gauge','durations'];if(!raw||Array.isArray(raw)||Object.keys(raw).length!==keys.length||!keys.every(k=>Object.hasOwn(raw,k))||raw.schema!==RAIN_DURATION_SCHEMA)throw Error('Open original duration investigation inputs, not results.');return {...raw,report:compareRainDuration(raw.project,raw.request,raw.gauge,raw.durations)};}
