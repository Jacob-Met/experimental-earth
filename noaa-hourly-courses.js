import {timestampMillis} from './observation-clock.js';
import {receiveHourlyBytes,hourlySourceIssue} from './noaa-hourly.js';

/** Source-only original-course discovery. Every offered window is source-admissible,
 * not a promise that a declared physical model will fit or propagate it. */
export async function proposeOriginalHourlyCourses(source,{hours,correctionType}={}){
 const {rawText,sourceUrl,sha256}=source??{};
 if(typeof rawText!=='string'||typeof sha256!=='string'||!/^[0-9a-f]{64}$/.test(sha256))throw Error('Retain original text and full source identity');
 if(!Number.isInteger(hours)||hours<1||hours>24||!['C','R'].includes(correctionType))throw Error('Declare 1–24 original hours and correction policy');
 const intake=await receiveHourlyBytes(new TextEncoder().encode(rawText),{sourceUrl,expectedSha256:sha256});
 const runs=[],excluded=[],boundaries=[];let active=null;
 for(let index=0;index<intake.rows.length;index++){
  const row=intake.rows[index],issue=hourlySourceIssue(row,correctionType);
  if(issue){excluded.push({line:index+1,code:issue.code,reason:issue.message,rawLine:row.rawLine,intervalStartUtc:row.intervalStartUtc,intervalEndUtc:row.intervalEndUtc,station:row.raw.WBANNO});active=null;continue;}
  const prev=active?intake.rows[index-1]:null,reasons=[];
  if(prev){if(prev.intervalEndUtc!==row.intervalStartUtc)reasons.push('Original UTC intervals are not contiguous');if(prev.raw.WBANNO!==row.raw.WBANNO)reasons.push('Original station changes');if(prev.raw.LONGITUDE!==row.raw.LONGITUDE||prev.raw.LATITUDE!==row.raw.LATITUDE)reasons.push('Original station location changes');}
  if(!prev||reasons.length){if(reasons.length)boundaries.push({previousLine:index,line:index+1,reasons});active={firstLine:index+1,count:0,station:row.raw.WBANNO,startUtc:row.intervalStartUtc,endUtc:row.intervalEndUtc};runs.push(active);}
  active.count++;active.endUtc=row.intervalEndUtc;
 }
 const windows=[];
 for(const [runIndex,run]of runs.entries())for(let offset=0;offset+hours<=run.count;offset++){
  const firstLine=run.firstLine+offset,first=intake.rows[firstLine-1],last=intake.rows[firstLine+hours-2];
  windows.push({runIndex,firstLine,count:hours,station:run.station,startUtc:first.intervalStartUtc,endUtc:last.intervalEndUtc});
 }
 return {sha256:intake.sha256,sourceUrl,originalRows:intake.rows.length,hours,correctionType,runs,excluded,boundaries,windows,
  status:windows.length?'source-courses-available':'no-complete-source-course',semantics:'Complete original-row windows in supplied-file order. Only original source admissibility and continuity select them; no fit, observation band, candidate physics or outcome was evaluated. Every excluded original row is retained explicitly. Applying a course still requires declared initial states and complete maintained model admission.'};
}

/** Resolve an explicitly offered clock start without snapping to another hour
 * or silently collapsing duplicate original courses. */
export function findOriginalCourseStart(proposals,{startUtc,station}={}){
 const stamp=timestampMillis(startUtc);
 const canonical=new Date(stamp).toISOString();
 const matches=proposals.windows.filter(window=>window.startUtc===canonical&&(station===undefined||window.station===station));
 return {status:matches.length===1?'one-original-course':matches.length?'ambiguous-original-courses':'no-original-course',matches};
}
