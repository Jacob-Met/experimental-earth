import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {inferPairedTrendResponse,TREND_RESPONSE_SCHEMA} from '../paired-trend-response.js';
import {inferPairedTrendRegion} from '../paired-trend-region.js';
import {inferPairedTrendShift} from '../paired-trend-shift.js';
import {shiftFixture,shiftOracleInputs} from './paired-trend-shift-fixture.mjs';
import {rational as q,sub,mul,cmp} from '../vendor/chronos/exact-halfplanes.mjs';
const input=x=>({schema:TREND_RESPONSE_SCHEMA,model:'separate-linear-periods',inquiry:x.inquiry});
const unpack=x=>[BigInt(x.exact.numerator),BigInt(x.exact.denominator)];
const value=x=>Number(x.exact.numerator)/Number(x.exact.denominator);
const key=p=>p.map(v=>v[0]+'/'+v[1]).join(',');
const cross=(a,b,p)=>sub(mul(sub(b[0],a[0]),sub(p[1],a[1])),mul(sub(b[1],a[1]),sub(p[0],a[0])));
test('separate later slope distinguishes a response rejected by the common-shift model',()=>{
 const x=shiftFixture(1),original=structuredClone(x),r=inferPairedTrendResponse(input(x));
 assert.equal(inferPairedTrendShift(x).status,'shift-incompatible');assert.equal(r.status,'response-compatible');
 assert.deepEqual(r.vertices.map(p=>[value(p.jump),value(p.slopeChange)]),[[2.5,-3],[5.5,-1]]);
 assert.equal(r.zeroSlopeChange.status,'incompatible');assert.deepEqual(r.earlier,inferPairedTrendRegion(x.inquiry));assert.deepEqual(x,original);
});
test('insufficient later history and contradictory periods have distinct results',()=>{
 const x=shiftFixture();x.inquiry.series.pairs.pop();assert.equal(inferPairedTrendResponse(input(x)).status,'insufficient-later-history');
 const y=shiftFixture(),p=structuredClone(y.inquiry.series.pairs.at(-1));p.time=p.treated.time=p.comparison.time='2026-01-05T00:00:00Z';p.treated.lower=p.treated.upper=100;y.inquiry.series.pairs.push(p);
 const r=inferPairedTrendResponse(input(y));assert.equal(r.status,'later-incompatible');assert.equal(r.jump,null);assert.deepEqual(r.earlier,inferPairedTrendRegion(y.inquiry));
 const z=shiftFixture();z.inquiry.series.intervention='2026-01-03T12:00:00Z';z.inquiry.series.pairs[2].role='pre';
 assert.equal(inferPairedTrendResponse(input(z)).status,'earlier-incompatible');
});
test('exact zero slope-change slice reproduces common-shift support across original courses',()=>{
 let same=0,broader=0;
 for(const x of shiftOracleInputs()){const r=inferPairedTrendResponse(input(x)),s=inferPairedTrendShift(x);
  if(s.status==='shift-compatible'){assert.equal(r.status,'response-compatible');assert.equal(r.zeroSlopeChange.status,'compatible');assert.deepEqual(r.zeroSlopeChange.jump,s.shift);same++;}
  else if(r.status==='response-compatible'){assert.equal(r.zeroSlopeChange.status,'incompatible');broader++;}
 }
 assert.equal(same,33);assert.equal(broader,6);
});
test('all declared work bounds and malformed model inputs refuse without a partial result',()=>{
 const x=input(shiftFixture());x.inquiry.series.pairs[0].treated.lower=-1;x.inquiry.series.pairs[0].treated.upper=1;
 for(const options of [{maxPairChecks:1},{maxConstraintChecks:1},{maxVertexPairs:1},{maxHullChecks:1}])assert.throws(()=>inferPairedTrendResponse(x,options));
 for(const options of [{maxHullChecks:131073},{maxVertexPairs:4097},{maxVertexPairs:NaN}])assert.throws(()=>inferPairedTrendResponse(x,options));
 assert.throws(()=>inferPairedTrendResponse({...x,model:'causal-effect'}));assert.throws(()=>inferPairedTrendResponse({...x,selectedSlope:0}));
});
test('fixed intervention changes the joint jump evaluation and complete 64-row evidence stays bounded',()=>{
 const x=input(shiftFixture(1)),first=inferPairedTrendResponse(x);x.inquiry.series.intervention='2026-01-02T06:00:00Z';
 const changed=inferPairedTrendResponse(x);assert.deepEqual(changed.vertices.map(p=>[value(p.jump),value(p.slopeChange)]),[[3.25,-3],[5.75,-1]]);
 assert.deepEqual(changed.earlier.vertices,first.earlier.vertices);assert.deepEqual(changed.later.vertices,first.later.vertices);
 const many=input(shiftFixture()),template=many.inquiry.series.pairs[0];many.inquiry.series.pairs=[];
 many.inquiry.series.intervention='2026-02-01T12:00:00Z';
 for(let i=0;i<64;i++){const p=structuredClone(template),time=new Date(Date.parse('2026-01-01T00:00:00Z')+i*86400000).toISOString().replace('.000Z','Z'),center=i<32?1+i/4:4+i/2,width=1+(i%3)/4;p.time=p.treated.time=p.comparison.time=time;p.role=i<32?'pre':'post';p.treated.lower=center-width;p.treated.upper=center+width;many.inquiry.series.pairs.push(p);}
 const r=inferPairedTrendResponse(many);assert.equal(r.status,'response-compatible');assert.equal(r.work.pairChecks,992);
 assert(r.work.vertexPairs<=4096);assert(r.work.hullChecks<=131072);assert(r.work.constraintChecks<=200000);
 assert(value(r.jump.lower)<=10.875&&value(r.jump.upper)>=10.875);assert(value(r.slopeChange.lower)<=.25&&value(r.slopeChange.upper)>=.25);
});
test('independent exact 4D boundary-plane oracle equals every complete joint response',()=>{
 const sources=shiftOracleInputs().map(input);
 let expected;
 if(process.env.EARTH_RESPONSE_ORACLE)expected=JSON.parse(readFileSync(process.env.EARTH_RESPONSE_ORACLE,'utf8'));
 else{const run=spawnSync('python3',['tests/paired-trend-response-oracle.py'],{input:JSON.stringify(sources),encoding:'utf8',maxBuffer:4*1024*1024});assert.equal(run.status,0,run.stderr);expected=JSON.parse(run.stdout);}
 let checked=0;
 for(const [i,x]of sources.entries()){
  const r=inferPairedTrendResponse(x),oracle=expected[i].map(p=>p.map(v=>v.split('/').map(BigInt)));
  if(!oracle.length){assert.notEqual(r.status,'response-compatible');continue;}
  assert.equal(r.status,'response-compatible');checked++;
  const polygon=r.vertices.map(p=>[unpack(p.jump),unpack(p.slopeChange)]),oracleKeys=new Set(oracle.map(key));
  for(const p of polygon)assert(oracleKeys.has(key(p)),'Each reported extreme is an attained original 4D vertex projection');
  for(const p of oracle){
   if(polygon.length===1)assert.equal(key(p),key(polygon[0]));
   else if(polygon.length===2){assert.equal(cmp(cross(polygon[0],polygon[1],p),q(0)),0);for(let k=0;k<2;k++){const a=polygon[0][k],b=polygon[1][k];assert(cmp(p[k],cmp(a,b)<0?a:b)>=0);assert(cmp(p[k],cmp(a,b)>0?a:b)<=0);}}
   else for(let j=0;j<polygon.length;j++)assert(cmp(cross(polygon[j],polygon[(j+1)%polygon.length],p),q(0))>=0,'All independently projected original vertices lie in returned joint hull');
  }
 }
 assert.equal(checked,39);
});
