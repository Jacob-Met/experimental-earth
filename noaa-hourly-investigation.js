import {replayHourlyReceipt} from './noaa-hourly.js';
import {makeExample} from './core.js';
import {prepareSurfaceHeatStudy} from './surface-heat.js';
import {prepareHeatColumnStudy} from './heat-column.js';
import {prepareHeatColumnEvidence,compareHeatColumnEvidence} from './heat-column-evidence.js';
import {checkProjectFileBytes} from './project-portability.js';

const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key));
const text=(value,limit)=>typeof value==='string'&&!!value.trim()&&value.length<=limit;
export function validateHourlyRecipe(input){
 if(!keys(input,['schema','sourceUrl','sha256','rawText','selection','surface','hypotheses','band','calibrationCount','associationSource'])||input.schema!=='experimental-earth-noaa-input/1')throw Error('Retain a versioned original-input NOAA investigation');
 if(typeof input.rawText!=='string'||!input.rawText.length||input.rawText.length>4_000_000||/[^\x00-\x7f]/.test(input.rawText)||typeof input.sourceUrl!=='string'||typeof input.sha256!=='string'||!/^[0-9a-f]{64}$/.test(input.sha256))throw Error('Retain bounded original ASCII text, declared URL and its full SHA-256');
 if(!keys(input.selection,['firstLine','count','correctionType','initialState'])||!keys(input.selection.initialState,['timeUtc','surfaceC','lowerC','assumption']))throw Error('Retain explicit original course selection and point initial states');
 if(!Number.isInteger(input.selection.firstLine)||input.selection.firstLine<1||!Number.isInteger(input.selection.count)||input.selection.count<1||input.selection.count>24)throw Error('Select 1–24 original consecutive hourly rows');
 if(!text(input.selection.initialState.assumption,250))throw Error('Explain the point initial-state assumption in 1–250 characters');
 if(!keys(input.surface,['capacityJm2K','exchangeWm2K','absorptivity','source'])||!text(input.surface.source,300))throw Error('Declare sourced surface properties separately from the point initial state');
 if(!keys(input.band,['halfWidthC','source'])||typeof input.band.halfWidthC!=='number'||!Number.isFinite(input.band.halfWidthC)||input.band.halfWidthC<0||input.band.halfWidthC>100||!text(input.band.source,250))throw Error('Declare a 0–100 °C comparison half-width and its source; do not infer it from printed precision');
 if(!Number.isInteger(input.calibrationCount)||input.calibrationCount<0||input.calibrationCount>input.selection.count)throw Error('Declare how many initial original rows are calibration; remaining rows are challenge');
 if(!text(input.associationSource,500))throw Error('Explain the surface observation/model association in 1–500 characters');
 if(!Array.isArray(input.hypotheses)||input.hypotheses.length<2||input.hypotheses.length>12||input.hypotheses.some(h=>!keys(h,['label','capacityJm2K','conductanceWm2K','source'])))throw Error('Retain 2–12 sourced lower-store alternatives without inferred initial states');
 return input;
}
export function serializeHourlyRecipe(input){validateHourlyRecipe(input);const json=JSON.stringify(input,null,2);checkProjectFileBytes(new TextEncoder().encode(json).length);return json;}
export function parseHourlyRecipe(json){if(typeof json!=='string')throw Error('Original investigation must be JSON text');checkProjectFileBytes(new TextEncoder().encode(json).length);return validateHourlyRecipe(JSON.parse(json));}

/** A separate illustrative station experiment; never mutates a working site. */
export async function compareHourlyInvestigation(input){
 input=structuredClone(input);
 validateHourlyRecipe(input);serializeHourlyRecipe(input);
 const course=await replayHourlyReceipt(input),initial=course.initialState;
 const station=course.rows[0].raw.WBANNO,project=makeExample();
 project.title=`NOAA station ${station} · declared thermal investigation`;
 project.source=`Separate NOAA ${station} thermal exercise; illustrative cell, not a station survey or an existing user's site`;
 project.existing[0].provenance='Illustrative cell associated with original NOAA surface means; no physical column or station terrain was measured.';
 project.proposal[0].provenance=project.existing[0].provenance;
 const top={...input.surface,initialC:initial.surfaceC,source:input.surface.source+'; point initial-state basis: '+initial.assumption};
 const rowSource=(row,index)=>`NOAA WBAN ${station}; supplied-file line ${input.selection.firstLine+index}; UTC (${row.intervalStartUtc}, ${row.intervalEndUtc}]; original SHA256 ${input.sha256}`;
 const schedule=course.rows.map((row,index)=>({minutes:60,incidentWm2:row.numbers.SOLARAD.value,reservoirC:row.numbers.T_HR_AVG.value,source:rowSource(row,index)+`; hourly SOLARAD/T_HR_AVG assumed constant inside each hour.`}));
 project.surfaceHeatStudy=prepareSurfaceHeatStudy(project,{cellIndex:0,existing:top,proposal:top,schedule});
 const first=input.hypotheses[0],lower={capacityJm2K:first.capacityJm2K,conductanceWm2K:first.conductanceWm2K,initialC:initial.lowerC,source:first.source};
 project.heatColumnStudy=prepareHeatColumnStudy(project,{existing:lower,proposal:lower});
 project.heatColumnEvidence=prepareHeatColumnEvidence(project,{target:'existing',associationSource:input.associationSource,hypotheses:input.hypotheses,
  readings:course.rows.map((row,index)=>({aggregation:'interval-mean',fromMinute:index*60,minute:(index+1)*60,temperatureC:row.numbers.SUR_TEMP.value,halfWidthC:input.band.halfWidthC,use:index<input.calibrationCount?'calibration':'challenge',source:rowSource(row,index)+`; SUR_TEMP=${row.raw.SUR_TEMP} C, type ${row.raw.SUR_TEMP_TYPE}, flag ${row.raw.SUR_TEMP_FLAG}; comparison band: ${input.band.source}`}))});
 return {course,project,report:compareHeatColumnEvidence(project)};
}
