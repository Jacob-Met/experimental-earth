import test from 'node:test';
import assert from 'node:assert/strict';
import {finitePeakQuestion} from '../heat-column-peak-range.js';
const row=(lowerC,upperC,peakC)=>({lowerC,upperC,peakC});
function enumerate(rows){const ends=[...new Set(rows.flatMap(r=>[r.lowerC,r.upperC]))].sort((a,b)=>a-b);return Math.max(0,...[...ends,...ends.slice(1).map((x,i)=>(x+ends[i])/2)].map(x=>{const peaks=rows.filter(r=>r.lowerC<=x&&r.upperC>=x).map(r=>r.peakC);return peaks.length?Math.max(...peaks)-Math.min(...peaks):0;}));}
test('finite interval outcomes agree with independent enumeration, permutation and duplicate controls',()=>{
 let seed=412831;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
 for(let n=0;n<1000;n++){const rows=Array.from({length:2+Math.floor(random()*30)},()=>{const start=Math.floor(random()*30);return row(start,start+Math.floor(random()*10),Math.floor(random()*50));});const result=finitePeakQuestion(rows);assert.equal(result.worstRemainingC,enumerate(rows));for(const changed of [[...rows,...rows.slice(0,5)],[...rows].reverse()]){const actual=finitePeakQuestion(changed);for(const key of ['beforeC','worstRemainingC','reductionC'])assert.equal(actual[key],result[key]);}}
});
test('nontransitive overlap and touching closed endpoints keep exactly the possible extremes',()=>{
 assert.equal(finitePeakQuestion([row(0,2,0),row(1,3,1),row(2.5,4,100)]).worstRemainingC,99);
 assert.equal(finitePeakQuestion([row(0,1,0),row(1,2,100)]).worstRemainingC,100);
 assert.equal(finitePeakQuestion([row(0,1,0),row(1+Number.EPSILON,2,100)]).worstRemainingC,0);
});
test('separated-pair count can favor a worse target-range question',()=>{
 const a=[row(0,1,0),row(10,11,1),row(20,21,2),row(0,1,100)],b=[row(0,1,0),row(0,1,1),row(0,1,2),row(10,11,100)];
 const separated=rows=>rows.reduce((n,x,i)=>n+rows.slice(i+1).filter(y=>x.upperC<y.lowerC||y.upperC<x.lowerC).length,0);
 assert.equal(separated(a),5);assert.equal(separated(b),3);assert.equal(finitePeakQuestion(a).worstRemainingC,100);assert.equal(finitePeakQuestion(b).worstRemainingC,2);
});
test('single and equal targets provide zero prior reduction; unsupported arithmetic refuses',()=>{
 assert.equal(finitePeakQuestion([row(0,1,2)]).beforeC,0);assert.equal(finitePeakQuestion([row(0,1,2),row(5,6,2)]).reductionC,0);
 for(const bad of [[],[row(1,0,2)],[row(0,1,NaN)],[row(0,1,Number.MAX_VALUE),row(0,1,-Number.MAX_VALUE)],Array.from({length:401},()=>row(0,1,2))])assert.throws(()=>finitePeakQuestion(bad));
});
