import {records} from './csv-records.js';
import {decimalValue} from './observation-units.js';

const HEADER=['minute','rain_mm_hr','runon_mm_hr','runoff_mm_hr','source_line'];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const originalAccount=(events)=>JSON.stringify({kind:'experimental-earth-original-rate-events',version:1,events:events.map(e=>({source:e.source,text:e.text}))},null,2);
function label(value,name,max=500){
  if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(`${name} is required (at most ${max} characters).`);
  return value;
}
// Exact integer keys at the explicitly admitted micro-minute resolution.
// No rounding or interpolation creates an aligned observation.
function minuteKey(raw){
  const s=raw.trim();
  if(!/^\d{1,4}(?:\.\d{1,6})?$/.test(s))throw Error('Minutes must be decimal values from 0 to 1440 with at most six fractional digits.');
  const [whole,fraction='']=s.split('.');
  const key=Number(whole)*1000000+Number(fraction.padEnd(6,'0'));
  if(key>1440000000)throw Error('Minutes exceed 1440.');
  return key;
}
function rate(raw,name,allowUnknownNonzero=false){
  const value=raw.trim();
  if(value==='NA')return {kind:'missing',value:null};
  if(allowUnknownNonzero&&/^rate[1-5]$/.test(value))return {kind:'unknown-nonzero',value:null};
  const n=decimalValue(raw,name);
  if(n<0||n>10000||(n===0&&/[1-9]/.test(value.split(/[eE]/)[0])))throw Error(`${name} must be representable from 0 to 10000 mm/h, or NA.`);
  return {kind:'observed',value:n};
}
export function readRateEvent(text,declaration){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>128000)throw Error('Event CSV exceeds 128000 UTF-8 bytes.');
  const source={event:label(declaration?.event,'Event label',200),source:label(declaration?.source,'Source'),fileName:label(declaration?.fileName,'Filename',160)};
  const parsed=records(text,{maxRows:512,label:'Rate event',rowLabel:'sample'});
  if(parsed.length<3)throw Error('An event needs at least two original samples.');
  const headers=parsed.shift().fields.map(v=>v.trim());
  if(headers.length!==HEADER.length||headers.some((v,i)=>v!==HEADER[i]))throw Error(`Use ${HEADER.join(',')} columns in that order.`);
  let previous=-1;const lines=new Set();
  const samples=parsed.map(row=>{
    if(row.fields.length!==HEADER.length)throw Error(`Line ${row.line}: column count differs from header.`);
    const raw=Object.fromEntries(HEADER.map((key,i)=>[key,row.fields[i]]));
    const timeKey=minuteKey(raw.minute);
    if(timeKey<=previous)throw Error(`Line ${row.line}: original times must strictly increase; do not sort or merge conflicting samples.`);
    previous=timeKey;
    if(!/^[1-9]\d{0,7}$/.test(raw.source_line.trim()))throw Error(`Line ${row.line}: original source line is required.`);
    const sourceLine=Number(raw.source_line);
    if(lines.has(sourceLine))throw Error('Repeated original source line.');
    lines.add(sourceLine);
    return {raw,tableLine:row.line,sourceLine,timeKey,minute:timeKey/1000000,
      rain:rate(raw.rain_mm_hr,'Rainfall'),runon:rate(raw.runon_mm_hr,'Run-on',true),runoff:rate(raw.runoff_mm_hr,'Runoff')};
  });
  return {source,text,samples};
}
function summary(event){
  const s=event.samples, observed=s.filter(x=>x.runoff.kind==='observed');
  const peak=observed.length?Math.max(...observed.map(x=>x.runoff.value)):null;
  return {sampleCount:s.length,missingRunoffCount:s.length-observed.length,
    peakSampleRateMmHr:peak,peakSampleMinutes:observed.filter(x=>x.runoff.value===peak).map(x=>x.minute),
    firstPositiveSampleMinute:observed.find(x=>x.runoff.value>0)?.minute??null,
    largestSampleGapMinutes:Math.max(...s.slice(1).map((x,i)=>(x.timeKey-s[i].timeKey)/1000000)),
    firstMinute:s[0].minute,lastMinute:s.at(-1).minute};
}
export function compareRateEvents(left,right){
  // Reparse original CSV and declarations; derived fields are never trusted on reopen.
  const a=readRateEvent(left.text,left.source),b=readRateEvent(right.text,right.source);
  if(new TextEncoder().encode(originalAccount([a,b])).length>300000)throw Error('The complete original pair exceeds the 300000 UTF-8 byte reopen limit. Reduce the source extract without omitting event samples.');
  const indexed=new Map(b.samples.map(row=>[row.timeKey,row]));
  const coincident=[];
  for(const x of a.samples){
    const y=indexed.get(x.timeKey);if(!y)continue;
    const changes={};
    for(const field of ['rain','runon','runoff'])changes[field]=x[field].kind==='observed'&&y[field].kind==='observed'?y[field].value-x[field].value:null;
    coincident.push({minute:x.minute,leftSourceLine:x.sourceLine,rightSourceLine:y.sourceLine,rightMinusLeftMmHr:changes});
  }
  return {left:a,right:b,leftSummary:summary(a),rightSummary:summary(b),coincident};
}
export function exportRateComparison(left,right){
  const result=compareRateEvents(left,right);
  return originalAccount([result.left,result.right]);
}
export function importRateComparison(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>300000)throw Error('Rate comparison file exceeds 300000 UTF-8 bytes.');
  const data=JSON.parse(text);
  if(data?.kind!=='experimental-earth-original-rate-events'||data.version!==1||!Array.isArray(data.events)||data.events.length!==2||!own(data.events,0)||!own(data.events,1))throw Error('Expected two original events in a version 1 rate comparison.');
  return compareRateEvents(data.events[0],data.events[1]);
}
