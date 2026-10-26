import test from 'node:test';
import assert from 'node:assert/strict';
import {fields,parseHourlyText,selectCourse,receiveHourlyBytes,replayHourlyReceipt} from '../noaa-hourly.js';
// Independently supplied Chronos review controls: fictional subzero course, not acquired data.
const sourceUrl='https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/2024/CRNH0203-2024-AK_Test_1_E.txt';
function line(changes={}){const values={WBANNO:'12345',UTC_DATE:'20240301',UTC_TIME:'0000',LST_DATE:'20240229',LST_TIME:'1500',CRX_VN:'2.623',LONGITUDE:'-150.10',LATITUDE:'65.20',T_HR_AVG:'-12.0',SOLARAD:'0',SUR_TEMP_TYPE:'R',SUR_TEMP:'-15.0',...changes},out=Array(243).fill(' ');for(const field of fields){const value=String(values[field.name]??'0').padStart(field.end-field.start);assert.equal(value.length,field.end-field.start);out.splice(field.start,value.length,...value);}return out.join('');}
const selection={firstLine:1,count:2,correctionType:'R',initialState:{timeUtc:'2024-02-29T23:00:00.000Z',surfaceC:-14,lowerC:-8,assumption:'Authored leap-day endpoint boundary'}};
test('independently offered subzero raw-corrected CRLF course crosses leap-day midnight',async()=>{
 const rawText=[line(),line({UTC_TIME:'0100',LST_TIME:'1600'})].join('\r\n')+'\r\n';const intake=await receiveHourlyBytes(new TextEncoder().encode(rawText),{sourceUrl});
 const course=await replayHourlyReceipt({schema:'experimental-earth-noaa-input/1',sourceUrl,sha256:intake.sha256,rawText,selection});
 assert.equal(course.rows.length,2);assert.equal(course.rows[0].intervalStartUtc,'2024-02-29T23:00:00.000Z');assert.equal(course.rows[1].intervalEndUtc,'2024-03-01T01:00:00.000Z');assert.equal(course.rows[0].numbers.SUR_TEMP.value,-15);
});
test('invalid calendars, nonhourly endpoints and discontinuous original rows refuse',()=>{
 for(const changes of [{UTC_DATE:'20230229'},{UTC_TIME:'0030'}])assert.throws(()=>parseHourlyText(line(changes)+'\n',{sourceUrl}));
 for(const changes of [{UTC_TIME:'0200'},{UTC_TIME:'0000'}]){const intake=parseHourlyText(line()+'\n'+line(changes)+'\n',{sourceUrl});assert.throws(()=>selectCourse(intake,selection),/Gap/);}
});
test('required flags, missing fields, changed station/location and correction refuse complete selection',()=>{
 for(const changes of [{SUR_TEMP_FLAG:'3'},{SOLARAD_FLAG:'3'},{SUR_TEMP:'-9999.0'},{T_HR_AVG:'-9999.0'},{SOLARAD:'-99999'},{WBANNO:'23456'},{LONGITUDE:'-151.10'},{SUR_TEMP_TYPE:'C'},{SOLARAD:'-1'}]){
  const intake=parseHourlyText(line()+'\n'+line({UTC_TIME:'0100',...changes})+'\n',{sourceUrl});assert.throws(()=>selectCourse(intake,selection),undefined,JSON.stringify(changes));
 }
});
