import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {readFileSync} from 'node:fs';
import {meanOracleInputs} from './paired-mean-fixture.mjs';import {inferPairedMeanHistory} from '../paired-mean-history.js';import {rational as q,sub,mul,cmp} from '../vendor/chronos/exact-halfplanes.mjs';
const unpack=x=>[BigInt(x.exact.numerator),BigInt(x.exact.denominator)],key=p=>p.map(v=>v.join('/')).join(','),cross=(a,b,p)=>sub(mul(sub(b[0],a[0]),sub(p[1],a[1])),mul(sub(b[1],a[1]),sub(p[0],a[0])));
test('independent 4D integral planes reproduce the complete joint mean response',()=>{
 const cases=meanOracleInputs();let expected;if(process.env.EARTH_MEAN_ORACLE)expected=JSON.parse(readFileSync(process.env.EARTH_MEAN_ORACLE,'utf8'));else{const run=spawnSync('python3',['tests/paired-mean-oracle.py'],{input:JSON.stringify(cases),encoding:'utf8'});assert.equal(run.status,0,run.stderr);expected=JSON.parse(run.stdout);}
 for(const [i,x]of cases.entries()){
  const r=inferPairedMeanHistory(x),oracle=expected[i].map(p=>p.map(v=>v.split('/').map(BigInt)));if(!oracle.length){assert.notEqual(r.status,'response-compatible');continue;}
  assert.equal(r.status,'response-compatible');const polygon=r.vertices.map(p=>[unpack(p.jump),unpack(p.slopeChange)]),keys=new Set(oracle.map(key));for(const p of polygon)assert(keys.has(key(p)));
  for(const p of oracle){if(polygon.length===1)assert.equal(key(p),key(polygon[0]));else if(polygon.length===2){assert.equal(cmp(cross(polygon[0],polygon[1],p),q(0)),0);for(let k=0;k<2;k++){const a=polygon[0][k],b=polygon[1][k];assert(cmp(p[k],cmp(a,b)<0?a:b)>=0&&cmp(p[k],cmp(a,b)>0?a:b)<=0);}}else for(let j=0;j<polygon.length;j++)assert(cmp(cross(polygon[j],polygon[(j+1)%polygon.length],p),q(0))>=0);}
 }
});
