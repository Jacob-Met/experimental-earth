import test from 'node:test';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import{buildNoaaExample}from'../examples/noaa-tucson-hourly/build.mjs';
import{proposeOriginalHourlyCourses}from'../noaa-hourly-courses.js';
const sha=raw=>createHash('sha256').update(raw).digest('hex');
function source(){const b=buildNoaaExample();return {rawText:b.intake.rawText,sourceUrl:b.intake.sourceUrl,sha256:b.intake.sha256};}
function edit(raw,line,start,end,value){const rows=raw.split('\n');rows[line-1]=rows[line-1].slice(0,start)+value.padStart(end-start)+rows[line-1].slice(end);return rows.join('\n');}
test('complete six-hour original windows are offered without manual row-number discovery',async()=>{const result=await proposeOriginalHourlyCourses(source(),{hours:6,correctionType:'C'});assert.deepEqual(result.windows.map(w=>w.firstLine),[1,2,3,4]);assert.equal(result.windows[0].startUtc,'2025-01-01T15:00:00.000Z');assert.equal(result.windows.at(-1).endUtc,'2025-01-02T00:00:00.000Z');assert.equal(result.excluded.length,0);});
test('flagged row is retained and splits exact windows; it is never silently skipped',async()=>{const s=source();s.rawText=edit(s.rawText,4,134,135,'3');s.sha256=sha(s.rawText);const result=await proposeOriginalHourlyCourses(s,{hours:3,correctionType:'C'});assert.deepEqual(result.runs.map(r=>[r.firstLine,r.count]),[[1,3],[5,5]]);assert.deepEqual(result.windows.map(w=>w.firstLine),[1,5,6,7]);assert.equal(result.excluded[0].line,4);assert.equal(result.excluded[0].rawLine,s.rawText.split('\n')[3]);assert.equal(result.excluded[0].rawLine[134],'3');});
test('surface values and forged fit labels do not select windows',async()=>{const s=source(),before=await proposeOriginalHourlyCourses(s,{hours:3,correctionType:'C'});for(let i=1;i<=9;i++)s.rawText=edit(s.rawText,i,126,133,String(100+i));s.sha256=sha(s.rawText);s.report={status:'one-survivor'};const after=await proposeOriginalHourlyCourses(s,{hours:3,correctionType:'C'});assert.deepEqual(after.windows,before.windows);assert.deepEqual(after.runs,before.runs);});
test('incompatible policy retains every excluded original row and never falls back',async()=>{const result=await proposeOriginalHourlyCourses(source(),{hours:1,correctionType:'R'});assert.equal(result.windows.length,0);assert.equal(result.status,'no-complete-source-course');assert.deepEqual(result.excluded.map(r=>r.line),[1,2,3,4,5,6,7,8,9]);});
test('station boundaries retain valid original rows but prohibit a spanning window',async()=>{const s=source();s.rawText=edit(s.rawText,4,0,5,'12345');s.sha256=sha(s.rawText);const r=await proposeOriginalHourlyCourses(s,{hours:3,correctionType:'C'});assert.deepEqual(r.runs.map(x=>[x.firstLine,x.count]),[[1,3],[4,1],[5,5]]);assert.equal(r.excluded.length,0);assert.equal(r.boundaries.length,2);assert.deepEqual(r.windows.map(w=>w.firstLine),[1,5,6,7]);});
test('insufficient contiguous hours and wrong source identity refuse useful-course claims',async()=>{const s=source();const r=await proposeOriginalHourlyCourses(s,{hours:10,correctionType:'C'});assert.equal(r.status,'no-complete-source-course');assert.equal(r.runs[0].count,9);await assert.rejects(proposeOriginalHourlyCourses({...s,sha256:'0'.repeat(64)},{hours:3,correctionType:'C'}),/SHA/);await assert.rejects(proposeOriginalHourlyCourses({...s,sha256:undefined},{hours:3,correctionType:'C'}));});
test('clock choice never snaps missing hours or collapses duplicated original records',async()=>{
 const {findOriginalCourseStart}=await import('../noaa-hourly-courses.js');
 const s=source(),single=await proposeOriginalHourlyCourses(s,{hours:6,correctionType:'C'});
 assert.equal(findOriginalCourseStart(single,{startUtc:'2025-01-01T15:00:00Z'}).matches[0].firstLine,1);
 assert.equal(findOriginalCourseStart(single,{startUtc:'2025-01-01T15:30:00Z'}).status,'no-original-course');
 assert.equal(findOriginalCourseStart(single,{startUtc:'2025-01-01T16:00:00+01:00'}).matches[0].firstLine,1);
 assert.throws(()=>findOriginalCourseStart(single,{startUtc:'2025-02-30T15:00:00Z'}));
 const twice={...s,rawText:s.rawText+s.rawText};twice.sha256=sha(twice.rawText);
 const repeated=await proposeOriginalHourlyCourses(twice,{hours:6,correctionType:'C'});
 const ambiguous=findOriginalCourseStart(repeated,{startUtc:'2025-01-01T15:00:00Z',station:'53131'});
 assert.equal(ambiguous.status,'ambiguous-original-courses');assert.deepEqual(ambiguous.matches.map(w=>w.firstLine),[1,10]);
});
