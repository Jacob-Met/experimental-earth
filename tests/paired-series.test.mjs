import assert from 'node:assert/strict';
import {changeExample} from '../measured-change.js';
import {comparePairedSeries} from '../paired-series.js';
const x=changeExample();const make=()=>{const s={schema:'experimental-earth-paired-series/1',...Object.fromEntries(['quantity','unit','treatedPlace','comparisonPlace','association','parallelChange'].map(k=>[k,x[k]])),intervention:'2026-06-03T00:00:00Z',pairs:[]};for(const [i,v]of [[29,31,19,21],[33,35,23,25],[33,35,27,29]].entries()){const time=`2026-06-0${i===2?4:i+1}T12:00:00Z`;s.pairs.push({time,role:i===2?'post':'pre',treated:{lower:v[0],upper:v[1],source:'Authored control',unit:x.unit,place:x.treatedPlace,time},comparison:{lower:v[2],upper:v[3],source:'Authored control',unit:x.unit,place:x.comparisonPlace,time}});}return s;};
const s=make(),r=comparePairedSeries(s);assert.equal(r.status,'compatible');assert.deepEqual(r.commonGap,{lower:8,upper:12});assert.deepEqual(r.postContrasts[0].contrast,{lower:-8,upper:0});
s.pairs[1].comparison.lower=28;s.pairs[1].comparison.upper=30;const conflict=comparePairedSeries(s);assert.equal(conflict.status,'incompatible');assert.deepEqual(conflict.witnesses,{lower:0,upper:1});assert.equal(conflict.postContrasts.length,0);
s.pairs[1].comparison.lower=27;s.pairs[1].comparison.upper=29;assert.equal(comparePairedSeries(s).status,'boundary');
const other=make();other.pairs[2].treated.lower=-100;other.pairs[2].treated.upper=-80;const rr=comparePairedSeries(other);assert.deepEqual(rr.commonGap,r.commonGap);assert.equal(rr.status,r.status);
for(const mutate of [s=>s.pairs[0].treated.unit='K',s=>s.pairs[0].treated.source='',s=>s.pairs[1].time=s.pairs[0].time,s=>s.pairs[2].role='pre',s=>s.pairs.pop()]){const bad=make();mutate(bad);assert.throws(()=>comparePairedSeries(bad));}
console.log('Repeated-source prototype passes stable, incompatible witness, boundary, post independence and admission controls');
// Independent enumeration over permitted original integer readings.
for(let n=0;n<100;n++){
 const s=make();s.pairs.forEach((p,i)=>{const a=(n*7+i*3)%20,b=(n*11+i*5)%20;p.treated.lower=a;p.treated.upper=a+3;p.comparison.lower=b;p.comparison.upper=b+4;});
 const original=structuredClone(s),r=comparePairedSeries(s),allowed=[];
 for(let g=-30;g<=30;g++)if(s.pairs.slice(0,2).every(p=>{for(let t=p.treated.lower;t<=p.treated.upper;t++)for(let c=p.comparison.lower;c<=p.comparison.upper;c++)if(t-c===g)return true;return false;}))allowed.push(g);
 assert.equal(r.status==='incompatible',allowed.length===0);
 if(allowed.length)assert.deepEqual(r.commonGap,{lower:Math.min(...allowed),upper:Math.max(...allowed)});
 assert.deepEqual(s,original);
}
const max=make();for(let i=0;i<61;i++){const p=structuredClone(max.pairs[0]);p.time=new Date(Date.UTC(2026,0,1,0,i)).toISOString().replace('.000Z','Z');p.treated.time=p.comparison.time=p.time;max.pairs.push(p);}assert.equal(max.pairs.length,64);comparePairedSeries(max);max.pairs.push(structuredClone(max.pairs[0]));assert.throws(()=>comparePairedSeries(max),/at most64/);
const touch=make();touch.pairs[1].comparison.lower=27;touch.pairs[1].comparison.upper=29;touch.pairs[1].treated.upper=35-Number.EPSILON*32;const near=comparePairedSeries(touch);assert.equal(near.status,'numerical-contact');assert.deepEqual(near.postContrasts,[]);
console.log('100 independent original-value enumerations;64pair work boundary; numerical-contact refusal; source immutability pass');
