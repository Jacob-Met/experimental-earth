import {records} from './csv-records.js';
import {RAIN_GAUGE_SCHEMA,validateRainGauge} from './rain-gauge-evidence.js';
export const GAUGE_CSV_HEADER='id,start,end,depth,uncertainty,unit,source,use';
// Strict calendar timestamp with a known numeric offset. No locale clock inference.
export function gaugeInstant(text){
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(text);
 if(!m||Number(m[1])<1900||m[8]==='-00:00')throw Error('Use a calendar timestamp with seconds and a known explicit offset (Z or ±HH:MM).');
 const [y,mo,d,h,mi,s]=m.slice(1,7).map(Number),ms=Number((m[7]??'').padEnd(3,'0'));
 const local=Date.UTC(y,mo-1,d,h,mi,s,ms),date=new Date(local);
 if(date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d||date.getUTCHours()!==h||date.getUTCMinutes()!==mi||date.getUTCSeconds()!==s)throw Error('Invalid calendar date or clock time.');
 const zone=m[8],zh=zone==='Z'?0:Number(zone.slice(1,3)),zm=zone==='Z'?0:Number(zone.slice(4));
 if(zh>14||zm>59||(zh===14&&zm!==0))throw Error('Offset is outside ±14 hours.');
 return local-(zone[0]==='-'?-1:1)*(zh*60+zm)*60000;
}
export function importGaugeCsv(project,text,{eventOrigin,eventRef,sameEventBasis,siteCoverageBasis,intervalBasis}){
 const origin=gaugeInstant(eventOrigin),parsed=records(text,{maxRows:64,label:'Rain-gauge CSV',rowLabel:'rainfall'});
 if(!parsed.length||parsed[0].fields.join(',')!==GAUGE_CSV_HEADER)throw Error('Use exactly these CSV columns: '+GAUGE_CSV_HEADER);
 const number=s=>{if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))throw Error('Depth and uncertainty must be explicit nonnegative decimal numbers.');return Number(s);};
 const readings=parsed.slice(1).map(({fields,line})=>{
  if(fields.length!==8)throw Error('Line '+line+': expected eight fields.');
  const [id,start,end,depth,uncertainty,unit,source,use]=fields;
  if(!source.trim())throw Error('Line '+line+': retain the original reading source.');
  return {id,startMinute:(gaugeInstant(start)-origin)/60000,endMinute:(gaugeInstant(end)-origin)/60000,depth:number(depth),uncertainty:number(uncertainty),unit,source:source+'\nOriginal CSV interval: '+start+' / '+end+'; event origin: '+eventOrigin,use};
 });
 return validateRainGauge(project,{schema:RAIN_GAUGE_SCHEMA,eventRef,sameEventBasis,siteCoverageBasis,intervalBasis,readings});
}
