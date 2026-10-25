import test from 'node:test';
import assert from 'node:assert/strict';
import { previewTemperatureTable } from '../temperature-table.js';
const header='minute,from_minute,aggregation,temperature,half_width,unit,use,source\n';
const parse=(rows,duration=60,name='sensor.csv')=>previewTemperatureTable(header+rows,duration,name);

test('three explicit scales convert absolute temperature and bands differently',()=>{
 const result=parse('0,,instant,32,1.8,F,calibration,ice point\n1,,instant,273.15,1,K,challenge,kelvin point\n2,,instant,0,1,C,challenge,celsius point');
 assert.deepEqual(result.readings.map(r=>[r.temperatureC,r.halfWidthC]),[[0,1],[0,1],[0,1]]);
 assert.equal(result.readings[0].use,'calibration');
 assert.equal(result.readings[1].use,'challenge');
 assert.deepEqual(JSON.parse(result.readings[0].source.slice('Original temperature CSV: '.length)),result.originals[0]);
});
test('unfamiliar negative Fahrenheit and interval means retain original lexical input',()=>{
 const result=parse('12.50,2.5,interval-mean,-4.00,9.0,F,challenge,"sensor A, original\nwindow"');
 const r=result.readings[0];assert.equal(r.temperatureC,-20);assert.equal(r.halfWidthC,5);
 assert.equal(r.fromMinute,2.5);assert.equal(r.minute,12.5);assert.equal(r.aggregation,'interval-mean');
 assert.equal(result.originals[0].temperature,'-4.00');assert.match(r.source,/sensor A/);assert.equal(result.originals[0].line,2);
});
test('mixed instant and mean at the same endpoint are distinct, duplicate windows refuse',()=>{
 const rows='10,,instant,20,1,C,calibration,point\n10,0,interval-mean,20,1,C,challenge,mean';
 assert.equal(parse(rows).readings.length,2);
 assert.throws(()=>parse(rows+'\n10,0,interval-mean,21,1,C,challenge,duplicate'),/unique/);
});
test('ambiguous quantity, malformed numeric/header and unsupported source refuse completely',()=>{
 const bad=[
 '1,,instant,20,1,celsius,calibration,sensor',
 '1,,instant,20,-1,C,calibration,sensor',
 '1,,instant,0x20,1,C,calibration,sensor',
 '1,,instant,Infinity,1,C,calibration,sensor',
 '1,,instant,,1,C,calibration,sensor',
 '1,0,instant,20,1,C,calibration,sensor',
 '1,,interval-mean,20,1,C,calibration,sensor',
 '1,1,interval-mean,20,1,C,calibration,sensor',
 '61,,instant,20,1,C,calibration,sensor',
 '1,,instant,20,1,C,unassigned,sensor',
 '1,,instant,20,1,C,calibration,',
 '1,,instant,20,1,C,calibration,"unterminated',
 '1,,instant,20,1,C,calibration,sensor,extra',
 ];
 for(const row of bad)assert.throws(()=>parse(row),undefined,row);
 assert.throws(()=>previewTemperatureTable(header.replace('unit','temperature')+'1,,instant,20,1,C,calibration,sensor',60,'sensor.csv'),/columns/);
 assert.throws(()=>parse(''),/at least one/);
 assert.throws(()=>parse('1,,instant,20,1,C,calibration,'+'x'.repeat(600)),/provenance/);
 assert.throws(()=>parse('1,,instant,20,1,C,calibration,sensor',60,'x'.repeat(161)),/file name/);
});
test('whole import admits at most100 bounded readings, no prefix returned on a bad final row',()=>{
 const rows=Array.from({length:100},(_,i)=>`${i/2},,instant,20,1,C,calibration,sensor`).join('\n');
 assert.equal(parse(rows).readings.length,100);
 assert.throws(()=>parse(rows+'\n55,,instant,20,1,C,challenge,sensor'),/At most/);
 assert.throws(()=>parse(rows.replace('49.5,,instant','61,,instant')),/within the exposure/);
 assert.throws(()=>parse(' '.repeat(128001)),/128 KB/);
 assert.throws(()=>parse('1,,instant,20,1,C,calibration,sensor',undefined,''),/file name/);
});
test('UTF8 BOM, reordered columns and quoted original source retain provenance',()=>{
 const r=previewTemperatureTable('\ufeffsource,use,unit,half_width,temperature,aggregation,from_minute,minute\r\n"instrument ""A""",challenge,K,2,300,instant,,3',60,'original.csv');
 assert.ok(Math.abs(r.readings[0].temperatureC-26.85)<1e-12);
 assert.equal(r.readings[0].halfWidthC,2);assert.equal(r.originals[0].source,'instrument "A"');
});
