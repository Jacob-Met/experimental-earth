#!/usr/bin/env node
/** node receive-original-year.mjs ORIGINAL_PATH NOAA_URL REPO_ROOT [RECEIPT_PATH]
 * Reads local original bytes; never fetches or redistributes the original file.
 * REPO_ROOT must contain the exact receiving tree's production modules.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,webcrypto} from 'node:crypto';
import {performance} from 'node:perf_hooks';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const [sourcePath,sourceUrl,repoPath,outputPath]=process.argv.slice(2);
if(!sourcePath||!sourceUrl||!repoPath)throw Error('Usage: node receive-original-year.mjs ORIGINAL_PATH NOAA_URL REPO_ROOT [RECEIPT_PATH]');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),start=performance.now(),startMemory=process.memoryUsage();
const receipt={schema:'independent-noaa-annual-receiving/1',status:'RUNNING',sourcePath:resolve(sourcePath),sourceUrl,repoRoot:resolve(repoPath),node:process.version,source:null,modules:{},checks:[],courses:[]};
async function save(){receipt.elapsedMs=performance.now()-start;receipt.memory={before:startMemory,after:process.memoryUsage(),maxRssKiB:process.resourceUsage().maxRSS,scope:'Whole independent receiving harness, including retained receipts and authored negative control; not browser memory'};if(outputPath)await writeFile(outputPath,JSON.stringify(receipt,null,2)+'\n');}
try{
 const bytes=await readFile(sourcePath);receipt.source={bytes:bytes.length,sha256:hash(bytes)};
 for(const name of ['noaa-hourly.js','noaa-hourly-courses.js','observation-clock.js'])receipt.modules[name]=hash(await readFile(resolve(repoPath,name)));
 const {receiveHourlyBytes,selectCourse}=await import(pathToFileURL(resolve(repoPath,'noaa-hourly.js'))),{proposeOriginalHourlyCourses}=await import(pathToFileURL(resolve(repoPath,'noaa-hourly-courses.js')));
 const intakeStart=performance.now(),intake=await receiveHourlyBytes(new Uint8Array(bytes),{sourceUrl,expectedSha256:receipt.source.sha256});receipt.intakeMs=performance.now()-intakeStart;
 assert.equal(intake.sha256,receipt.source.sha256);assert.equal(intake.rawText,bytes.toString('ascii'));
 const lines=intake.rawText.split(/\r?\n/);if(lines.at(-1)==='')lines.pop();assert.equal(lines.length,intake.rows.length);receipt.source.rows=lines.length;
 // Independent fixed positions and eligibility, deliberately not using exported
 // field definitions or hourlySourceIssue/selectCourse to choose expected rows.
 const cut=(line,a,b)=>line.slice(a-1,b).trim(),missing=(value,width)=>value.length===width&&/^-9+(?:\.0+)?$/.test(value);
 function clock(date,time){const t=time.padStart(4,'0'),s=`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T${t.slice(0,2)}:${t.slice(2)}:00.000Z`,ms=Date.parse(s);assert.equal(new Date(ms).toISOString(),s);assert.equal(t.slice(2),'00');return ms;}
 const independent=lines.map((rawLine,i)=>{assert.equal(rawLine.length,243);const end=clock(cut(rawLine,7,14),cut(rawLine,16,19));return {line:i+1,rawLine,station:cut(rawLine,1,5),longitude:cut(rawLine,42,48),latitude:cut(rawLine,50,56),start:end-3600000,end,type:cut(rawLine,125,125),air:cut(rawLine,66,72),solar:cut(rawLine,98,103),surface:cut(rawLine,127,133),solarFlag:cut(rawLine,105,105),surfaceFlag:cut(rawLine,135,135)};});
 function reason(r,policy){if(r.type!==policy)return 'correction-policy';for(const [name,value,width]of [['T_HR_AVG',r.air,7],['SOLARAD',r.solar,6],['SUR_TEMP',r.surface,7]])if(missing(value,width))return 'missing-'+name;if(r.solarFlag!=='0'||r.surfaceFlag!=='0')return 'required-qc';if(Number(r.solar)<0)return 'negative-radiation';return null;}
 const iso=ms=>new Date(ms).toISOString();
 function enumerate(hours,policy){const windows=[];for(let begin=0;begin+hours<=independent.length;begin++){const first=independent[begin];let valid=true;for(let k=0;k<hours;k++){const row=independent[begin+k],previous=independent[begin+k-1];if(reason(row,policy)||row.station!==first.station||row.longitude!==first.longitude||row.latitude!==first.latitude||(k&&previous.end!==row.start)){valid=false;break;}}if(valid)windows.push({firstLine:begin+1,count:hours,station:first.station,startUtc:iso(first.start),endUtc:iso(independent[begin+hours-1].end)});}return windows;}
 for(const policy of ['C','R'])for(const hours of [1,6,24]){
  const t=performance.now(),report=await proposeOriginalHourlyCourses(intake,{hours,correctionType:policy}),proposeMs=performance.now()-t,enumerationStart=performance.now(),expected=enumerate(hours,policy),independentEnumerationMs=performance.now()-enumerationStart;
  assert.deepEqual(report.windows.map(({runIndex,...w})=>w),expected);
  const excluded=independent.filter(r=>reason(r,policy));assert.equal(report.excluded.length,excluded.length);
  for(let i=0;i<excluded.length;i++){const a=excluded[i],b=report.excluded[i];assert.equal(b.line,a.line);assert.equal(b.code,reason(a,policy));assert.equal(b.rawLine,a.rawLine);assert.equal(b.intervalStartUtc,iso(a.start));assert.equal(b.intervalEndUtc,iso(a.end));}
  // Exact coverage: every admitted row belongs once to a run; no excluded row does.
  const coverage=new Set();for(const run of report.runs)for(let k=0;k<run.count;k++){const line=run.firstLine+k;assert.ok(!coverage.has(line));coverage.add(line);assert.equal(reason(independent[line-1],policy),null);}
  assert.equal(coverage.size+excluded.length,independent.length);
  for(const i of new Set([0,Math.floor(expected.length/2),expected.length-1]))if(expected[i]){const w=expected[i],course=selectCourse(intake,{firstLine:w.firstLine,count:hours,correctionType:policy,initialState:{timeUtc:w.startUtc,surfaceC:20,lowerC:20,assumption:'Authored receiver-only admission states, no model fit'}});assert.deepEqual(course.rows.map(r=>r.rawLine),lines.slice(w.firstLine-1,w.firstLine-1+hours));}
  const byReason={};for(const e of report.excluded)byReason[e.code]=(byReason[e.code]??0)+1;
  receipt.courses.push({policy,hours,proposeMs,independentEnumerationMs,windows:expected.length,runs:report.runs,boundaries:report.boundaries,excludedCount:excluded.length,excludedByReason:byReason,excluded:report.excluded.map(({rawLine,...e})=>({...e,originalRowSha256:hash(rawLine)})),windowListSha256:hash(JSON.stringify(expected)),first:expected[0]??null,last:expected.at(-1)??null,elapsedMs:performance.now()-t});
 }
 receipt.checks.push('All original1/6/24-hour windows under C/R exactly equal independent full enumeration; all excluded raw rows/UTC/reasons retained and hash-bound; every original row accounted once');
 // Explicit authored negative control: remove all soil observations without
 // changing thermal source eligibility. This is never labeled original data.
 const replaced=lines.map(line=>line.slice(0,164)+['-99.000','-99.000','-99.000','-99.000','-99.000','-9999.0','-9999.0','-9999.0','-9999.0','-9999.0'].join(' ')).join('\n')+'\n';
 const depthFree=await receiveHourlyBytes(new TextEncoder().encode(replaced),{sourceUrl});
 for(const policy of ['C','R']){const report=await proposeOriginalHourlyCourses(depthFree,{hours:24,correctionType:policy});assert.deepEqual(report.windows.map(({runIndex,...w})=>w),enumerate(24,policy));}
 receipt.checks.push('Authored all-soil-fields-missing perturbation leaves24-hour source course choices unchanged under both policies; no soil depth or fit outcome selects courses');
 receipt.status='PASS';await save();console.log(JSON.stringify({status:receipt.status,source:receipt.source,intakeMs:receipt.intakeMs,elapsedMs:receipt.elapsedMs,maxRssKiB:receipt.memory.maxRssKiB,courses:receipt.courses.map(({policy,hours,windows,excludedCount,proposeMs,independentEnumerationMs,elapsedMs})=>({policy,hours,windows,excludedCount,proposeMs,independentEnumerationMs,elapsedMs})),receiptPath:outputPath??null},null,2));
}catch(error){receipt.status='FAIL';receipt.error={name:error.name,message:error.message,stack:error.stack};await save();console.error(JSON.stringify({status:'FAIL',error:receipt.error,source:receipt.source,receiptPath:outputPath??null},null,2));process.exitCode=1;}
