import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {inspectRainfallLedger as inspect,estimateRainfallLedgerWork as estimate} from '../rainfall-ledger.js';
import {rainfallHistoryConsistency} from '../rain-gauge-history.js';
const fixture=()=>JSON.parse(readFileSync(new URL('../examples/mechanism-challenge-conflict-original.json',import.meta.url),'utf8'));
const gcd=(a,b)=>{a=a<0n?-a:a;while(b){[a,b]=[b,a%b];}return a;};
function q(n,d=1n){if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return [n/g,d/g];}
const add=(a,b)=>q(a[0]*b[1]+b[0]*a[1],a[1]*b[1]);
const sub=(a,b)=>add(a,[-b[0],b[1]]);
const mul=(a,b)=>q(a[0]*b[0],a[1]*b[1]);
const cmp=(a,b)=>a[0]*b[1]-b[0]*a[1];
const zero=[0n,1n];
function binary(x){const b=Buffer.alloc(8);b.writeDoubleBE(x);const u=b.readBigUInt64BE(),e=Number((u>>52n)&2047n),m=(u&((1n<<52n)-1n))+(e?1n<<52n:0n),k=(e||1)-1075,sign=u>>63n?-1n:1n;return k>=0?q(sign*(m<<BigInt(k))):q(sign*m,1n<<BigInt(-k));}
function decode(x){assert.match(x.numerator,/^-?(0|[1-9][0-9]*)$/);assert.match(x.denominator,/^[1-9][0-9]*$/);const a=[BigInt(x.numerator),BigInt(x.denominator)];assert.deepEqual(q(...a),a);return a;}
const unit={mm:1,cm:10,in:25.4};
function bounds(r){const d=mul(binary(r.depth),binary(unit[r.unit])),u=mul(binary(r.uncertainty),binary(unit[r.unit])),lo=sub(d,u);return [cmp(lo,zero)<0?zero:lo,add(d,u)];}
function row(id,a,b,d,u=0,use='calibration',units='mm'){return {id,startMinute:a,endMinute:b,depth:d,uncertainty:u,unit:units,source:'Authored independent ledger control; no field measurement',use};}
function input(rows){const x=fixture();x.source.gauge.readings=rows;return x;}
function verify(x,r){assert.deepEqual(r.originalProposal,x);const rows=x.source.gauge.readings.map((reading,index)=>({reading,index})).filter(x=>x.reading.use!=='unassigned'),times=[...new Set([0,x.source.project.weather.durationMinutes,...rows.flatMap(x=>[x.reading.startMinute,x.reading.endMinute])])].sort((a,b)=>a-b);assert.deepEqual(r.joint.records.map(z=>z.index),rows.map(z=>z.index));
 for(let i=0;i<rows.length;i++){const rr=r.joint.records[i],[lo,hi]=bounds(rows[i].reading);assert.deepEqual(rr.reading,rows[i].reading);assert.equal(cmp(decode(rr.lowerMm),lo),0n);assert.equal(cmp(decode(rr.upperMm),hi),0n);}
 if(r.joint.status==='nonnegative-history-compatible'){
  assert.equal(r.joint.negativeCycle,null);const h=r.joint.history;assert.deepEqual(h.knots.map(z=>z.minute),times);assert.equal(cmp(decode(h.knots[0].cumulativeMm),zero),0n);assert.equal(h.segments.length,times.length-1);
  for(let i=0;i<h.segments.length;i++){const s=h.segments[i],delta=sub(decode(h.knots[i+1].cumulativeMm),decode(h.knots[i].cumulativeMm));assert.ok(cmp(delta,zero)>=0n);assert.equal(s.startMinute,times[i]);assert.equal(s.endMinute,times[i+1]);assert.equal(cmp(decode(s.depthMm),delta),0n);assert.equal(cmp(mul(decode(s.rateMmHr),sub(binary(times[i+1]),binary(times[i]))),mul(delta,[60n,1n])),0n);}
  for(const {reading,index} of rows){const a=times.indexOf(reading.startMinute),b=times.indexOf(reading.endMinute),total=sub(decode(h.knots[b].cumulativeMm),decode(h.knots[a].cumulativeMm)),[lo,hi]=bounds(reading);assert.ok(cmp(total,lo)>=0n&&cmp(total,hi)<=0n);const c=r.joint.intervalChecks.find(z=>z.index===index);assert.equal(c.withinNominalBand,true);assert.equal(cmp(decode(c.totalMm),total),0n);}
 }else{
  assert.equal(r.joint.status,'interval-totals-inconsistent');assert.equal(r.joint.history,null);assert.deepEqual(r.joint.intervalChecks,[]);const es=r.joint.negativeCycle.edges;assert.ok(es.length>0&&es.length<=times.length);let sum=zero;
  for(let i=0;i<es.length;i++){const e=es[i];assert.equal(e.to,es[(i+1)%es.length].from);assert.equal(e.fromMinute,times[e.from]);assert.equal(e.toMinute,times[e.to]);let expected;
   if(e.kind==='monotonic'){assert.equal(e.from,e.to+1);assert.equal(e.id,'monotonic:'+e.from);assert.equal(e.recordIndex,null);assert.equal(e.recordRef,null);expected=zero;}
   else{const rr=x.source.gauge.readings[e.recordIndex];assert.ok(rr&&rr.use!=='unassigned');const [lo,hi]=bounds(rr);assert.equal(e.recordRef,'rain-gauge:'+rr.id);assert.equal(e.id,e.kind+':'+e.recordIndex);assert.ok(['lower','upper'].includes(e.kind));const upper=e.kind==='upper';assert.equal(e.fromMinute,upper?rr.startMinute:rr.endMinute);assert.equal(e.toMinute,upper?rr.endMinute:rr.startMinute);expected=upper?hi:sub(zero,lo);}
   assert.equal(cmp(decode(e.weightMm),expected),0n);sum=add(sum,expected);
  }assert.ok(cmp(sum,zero)<0n);assert.equal(cmp(decode(r.joint.negativeCycle.sumMm),sum),0n);const indices=[...new Set(es.filter(e=>e.recordIndex!==null).map(e=>e.recordIndex))].sort((a,b)=>a-b);assert.deepEqual(r.joint.negativeCycle.recordIndices,indices);assert.deepEqual(r.joint.negativeCycle.recordRefs,indices.map(i=>'rain-gauge:'+x.source.gauge.readings[i].id));
 }
}
test('authored finite-family conflict nevertheless admits a verified nonnegative history',()=>{const x=fixture(),before=JSON.stringify(x),r=inspect(before);assert.equal(r.joint.status,'nonnegative-history-compatible');verify(x,r);assert.deepEqual(r.calibration,rainfallHistoryConsistency(x.source.project,x.source.gauge));assert.equal(JSON.stringify(x),before);});
test('nested totals produce a source-derived closed negative cycle including monotonicity',()=>{const x=input([row('outer',0,10,0),row('inner',5,10,1,0,'challenge')]),r=inspect(JSON.stringify(x));assert.equal(r.calibration.status,'nonnegative-history-compatible');assert.equal(r.joint.status,'interval-totals-inconsistent');verify(x,r);assert.ok(r.joint.negativeCycle.edges.some(e=>e.kind==='monotonic'));});
test('zero, touching equality, disjoint and additive overlap are exact nominal constraints',()=>{
 const cases=[[[row('clamp',0,10,0,1)],true],[[row('zero',0,10,0)],true],[[row('a',0,10,1,1),row('b',0,10,3,1,'challenge')],true],[[row('a',0,10,1),row('b',10,20,9,0,'challenge')],true],[[row('a',0,10,1),row('b',10,20,1),row('whole',0,20,3,0,'challenge')],false],[[row('a',0,10,1),row('b',10,20,1),row('whole',0,20,2,0,'challenge')],true]];
 for(const [rows,feasible] of cases){const x=input(rows),r=inspect(JSON.stringify(x));assert.equal(r.joint.status,feasible?'nonnegative-history-compatible':'interval-totals-inconsistent');verify(x,r);}
});
test('calibration authority, unassigned exclusion and opaque original context survive changes',()=>{
 const x=input([row('cal',0,10,1),row('challenge',0,10,1,0,'challenge'),row('ignored',0,10,999,0,'unassigned')]);x.fronts={retained:'not interpreted as a model'};x.goal={retained:'not a qualified target'};const a=inspect(JSON.stringify(x));verify(x,a);assert.equal(a.scope.excludedUnassigned.length,1);const y=structuredClone(x);y.source.gauge.readings[1].depth=5;y.source.gauge.readings[2].depth=0;const b=inspect(JSON.stringify(y));verify(y,b);assert.deepEqual(a.calibration,b.calibration);assert.deepEqual(a.calibration,rainfallHistoryConsistency(x.source.project,x.source.gauge));assert.equal(b.joint.status,'interval-totals-inconsistent');
 const bad=input([row('cal-zero',0,10,0),row('cal-one',0,10,1),row('broad-challenge',0,10,0,100,'challenge')]),badResult=inspect(JSON.stringify(bad));assert.equal(badResult.calibration.status,'interval-totals-inconsistent');assert.equal(badResult.joint.status,'interval-totals-inconsistent');assert.deepEqual(badResult.calibration,rainfallHistoryConsistency(bad.source.project,bad.source.gauge));verify(bad,badResult);
 const c=input([row('challenge-only',0,10,1,0,'challenge')]),r=inspect(JSON.stringify(c));assert.equal(r.calibration.status,'no-calibration');verify(c,r);
});
test('represented decimal units and subnormal time gaps yield exact rates without Number coercion',()=>{
 for(const rows of [[row('cm',0,10,0.1,0,'calibration','cm'),row('in',10,20,0.1,0,'challenge','in')],[row('tiny',0,Number.MIN_VALUE,1)]]){const x=input(rows),r=inspect(JSON.stringify(x));verify(x,r);assert.equal(r.joint.status,'nonnegative-history-compatible');if(rows[0].id==='tiny'){const rate=decode(r.joint.history.segments[0].rateMmHr);assert.ok(rate[0]>BigInt(Number.MAX_VALUE)*rate[1]);}}
});
test('64-row full endpoint reservation is118362;65 records refuse without invented work-limit case',()=>{
 const rows=Array.from({length:64},(_,i)=>row('row-'+i,1+i*0.5,1.25+i*0.5,0));const x=input(rows),w=estimate(JSON.stringify(x));assert.equal(w.calibrationVertices,128);assert.equal(w.jointVertices,130);assert.equal(w.totalWork,118362);verify(x,inspect(JSON.stringify(x)));x.source.gauge.readings.push(row('extra',40,41,0));assert.throws(()=>estimate(JSON.stringify(x)));
});
function counted(x,estimateOnly=false){
 const loader=`export async function load(url,context,next){const r=await next(url,context);if(!['/rain-gauge-history.js','/rain-mechanism-proposal.js','/core.js'].some(x=>url.endsWith(x)))return r;let s=String(r.source);const targets=[['/rain-gauge-history.js','export function rainfallHistoryConsistency(project,gauge){','globalThis.__baseline=(globalThis.__baseline??0)+1;'],['/rain-mechanism-proposal.js','export function importMechanismProposal(text){','globalThis.__models=(globalThis.__models??0)+1;throw Error("forbidden importer");']];for(const [suffix,needle,insertion] of targets)if(url.endsWith(suffix)){if(s.split(needle).length!==2)throw Error('instrumentation signature');s=s.replace(needle,needle+insertion);}if(url.endsWith('/core.js')){const re=/export function runRain\\([^]*?\\)\\s*\\{/;if(!re.test(s))throw Error('grid instrumentation signature');s=s.replace(re,m=>m+'globalThis.__models=(globalThis.__models??0)+1;throw Error("forbidden grid");');}return {...r,source:s};}`;
 const u='data:text/javascript;base64,'+Buffer.from(loader).toString('base64'),consumer=new URL('../rainfall-ledger.js',import.meta.url).href;
 const code=`import {register} from 'node:module';register(${JSON.stringify(u)},import.meta.url);const m=await import(${JSON.stringify(consumer)});let refused=false;try{m.${estimateOnly?'estimateRainfallLedgerWork':'inspectRainfallLedger'}(${JSON.stringify(JSON.stringify(x))});}catch(e){refused=true;}console.log(JSON.stringify({refused,baseline:globalThis.__baseline??0,models:globalThis.__models??0}));`;
 const p=spawnSync(process.execPath,['--max-old-space-size=128','--input-type=module','-e',code],{encoding:'utf8',timeout:5000,maxBuffer:1048576});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);
}
test('one baseline on success, none in estimator or65-row refusal, no grid/importer calls',()=>{
 const x=fixture();assert.deepEqual(counted(x),{refused:false,baseline:1,models:0});assert.deepEqual(counted(x,true),{refused:false,baseline:0,models:0});const y=input(Array.from({length:65},(_,i)=>row('row-'+i,0,10,0)));assert.deepEqual(counted(y),{refused:true,baseline:0,models:0});
});
