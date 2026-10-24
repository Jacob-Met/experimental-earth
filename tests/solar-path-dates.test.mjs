import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {prepareSolarStudy} from '../solar-occlusion.js';
import {compareSunPath,sunPathPosition} from '../solar-path.js';
import {compareSunPathDates,planSunPathDates,inspectSunPathDates,serializeSunPathDatesInvestigation,parseSunPathDatesInvestigation,checkSunPathDatesBytes,SUN_DATES_LIMITS} from '../solar-path-dates.js';

function authored(width=8,height=2){
 const project=makeExample();project.width=width;project.height=height;project.selectedIndex=0;project.weather.cellSizeM=2;
 project.existing=Array.from({length:width*height},()=>({surface:'turf',elevationM:0,provenance:'Authored calendar comparison'}));project.proposal=structuredClone(project.existing);
 project.solarStudy=prepareSolarStudy(project,{headingDeg:0,elevationDeg:45,sunSource:'Retained original direction',existing:[],proposal:[{cellIndex:7,heightMinM:10,heightMaxM:10,source:'Authored H1 column'}]});
 const declaration={latitudeDeg:51.5,longitudeDeg:-.1,gridColumnBearingDeg:sunPathPosition('2026-06-21T06:30:00Z',51.5,-.1,0).azimuthDeg,locationSource:'Authored London location',orientationSource:'Unchanged original bearing',startUtc:'2026-06-21T06:00:00Z',endUtc:'2026-06-21T08:00:00Z',stepMinutes:1};
 return {project,declaration};
}
test('same-source calendar comparisons retain consequential differences and every winter limitation',()=>{
 const {project,declaration}=authored(),before=structuredClone(project),dates=['2026-03-21','2026-09-21','2026-12-21'];
 const result=compareSunPathDates(project,declaration,dates),a1=inspectSunPathDates(result,0),f1=inspectSunPathDates(result,5);
 assert.deepEqual(a1.map(r=>r.counts.additional),[47,0,0,0]);assert.deepEqual(f1.map(r=>r.counts.additional),[121,41,39,0]);
 assert.equal(a1[3].counts['below-horizon'],121);assert.equal(a1[3].counts['unchanged-no-blocker'],0);assert.equal(a1[3].limitedSamples,121);
 assert.equal(a1[1].counts['low-elevation'],7);assert.equal(result.totalSamples,484);assert.equal(result.estimatedRayTests,174240*4);
 assert.deepEqual(project,before);assert.deepEqual(dates,['2026-03-21','2026-09-21','2026-12-21']);
 for(const course of result.courses)assert.deepEqual(course.report,compareSunPath(project,course.report.declaration));
 assert.equal(result.courses[0].report.samples[30].proposal[0].witness.source,'Authored H1 column');
});
test('elapsed duration and endpoint coverage survive leap days, midnight and year boundaries',()=>{
 const {project,declaration}=authored();declaration.startUtc='2024-02-28T23:30:00Z';declaration.endUtc='2024-02-29T00:37:00Z';declaration.stepMinutes=30;
 const result=compareSunPathDates(project,declaration,['2024-02-29','2099-12-31']);
 assert.deepEqual(result.courses[1].report.samples.map(r=>r.utc),['2024-02-29T23:30:00.000Z','2024-03-01T00:00:00.000Z','2024-03-01T00:30:00.000Z','2024-03-01T00:37:00.000Z']);
 assert.equal(result.courses[2].report.declaration.endUtc,'2100-01-01T00:37:00.000Z');
 assert.throws(()=>compareSunPathDates(project,declaration,['2100-12-31']),/1900 through 2100/);
});
test('complete aggregate work refuses even though each separate date would fit',()=>{
 const {project,declaration}=authored(8,8),dates=['2026-03-21','2026-04-21','2026-05-21','2026-07-21','2026-08-21'];
 assert.ok(compareSunPath(project,declaration).estimatedRayTests<SUN_DATES_LIMITS.maxRayTests);
 assert.throws(()=>planSunPathDates(project,declaration,dates),/complete date set.*16 million/);
 assert.throws(()=>compareSunPathDates(project,declaration,dates),/complete date set.*16 million/);
});
test('calendar, duplicate, source and selection admission never substitutes a nearby date',()=>{
 const {project,declaration}=authored();
 for(const dates of [[],['2026-06-21'],['2026-03-21','2026-03-21'],['2026-02-30'],['2026-3-21'],['2026-03-21T00:00:00Z'],['1899-12-31'],[null],Array(8).fill('2026-03-21')])assert.throws(()=>compareSunPathDates(project,declaration,dates));
 const altered=structuredClone(project);altered.existing[0].elevationM=1;assert.throws(()=>compareSunPathDates(altered,declaration,['2026-03-21']),/source changed/);
 const result=compareSunPathDates(project,declaration,['2026-03-21']);for(const index of [-1,16,.5,NaN])assert.throws(()=>inspectSunPathDates(result,index),/ground centre/);
});
test('input-only native reopening preserves original site, date order, selections and calculated witnesses',()=>{
 const {project,declaration}=authored(),dates=['2026-12-21','2026-03-21'],before=structuredClone(project);
 const text=serializeSunPathDatesInvestigation(project,declaration,dates,5,2),raw=JSON.parse(text),reopened=parseSunPathDatesInvestigation(text);
 assert.deepEqual(Object.keys(raw).sort(),['additionalDates','investigation','kind','selectedCourseIndex']);assert.equal(raw.selectedCourseIndex,2);assert.equal(raw.investigation.selectedCellIndex,5);
 assert.equal(Object.hasOwn(raw,'comparison'),false);assert.equal(Object.hasOwn(raw.investigation,'report'),false);assert.deepEqual(project,before);
 assert.deepEqual(reopened.comparison,compareSunPathDates(project,declaration,dates));assert.equal(inspectSunPathDates(reopened.comparison,5)[2].counts.additional,41);
 const other=makeExample();other.title='Different active site';assert.equal(reopened.envelope.investigation.project.width,8);assert.equal(other.title,'Different active site');
 const forged=structuredClone(raw);forged.comparison={sunny:true};assert.throws(()=>parseSunPathDatesInvestigation(JSON.stringify(forged)),/only retained inputs/);
 const wrongModel=structuredClone(raw);wrongModel.investigation.model.version='future';assert.throws(()=>parseSunPathDatesInvestigation(JSON.stringify(wrongModel)),/unsupported sun-position model/);
 const wrongSelection=structuredClone(raw);wrongSelection.selectedCourseIndex=3;assert.throws(()=>parseSunPathDatesInvestigation(JSON.stringify(wrongSelection)),/complete retained date courses/);
 const cached=structuredClone(raw);cached.investigation.report={samples:[]};assert.throws(()=>parseSunPathDatesInvestigation(JSON.stringify(cached)),/only retained inputs/);
});
test('portable admission preserves the ordinary project boundary and bounded UTF-8 intake',()=>{
 const {project,declaration}=authored();assert.throws(()=>serializeSunPathDatesInvestigation(project,declaration,['2026-03-21'],16,0),/selected ground sample/);
 assert.throws(()=>parseSunPathDatesInvestigation('{'),/JSON is invalid/);assert.throws(()=>parseSunPathDatesInvestigation(1),/JSON text/);
 checkSunPathDatesBytes(SUN_DATES_LIMITS.maxBytes);for(const value of [-1,.1,Infinity,SUN_DATES_LIMITS.maxBytes+1])assert.throws(()=>checkSunPathDatesBytes(value),/6 MiB/);
 assert.throws(()=>parseSunPathDatesInvestigation(' '.repeat(SUN_DATES_LIMITS.maxBytes+1)),/6 MiB/);
});
