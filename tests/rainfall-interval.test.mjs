import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {boundRainfallInterval as inspect,estimateRainfallIntervalWork as estimate} from '../rainfall-interval.js';
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
function certificate(x,r,extraTimes=[]){assert.deepEqual(r.originalProposal,x);const rows=x.source.gauge.readings.map((reading,index)=>({reading,index})).filter(x=>x.reading.use==='calibration'),times=[...new Set([0,x.source.project.weather.durationMinutes,...extraTimes,...rows.flatMap(x=>[x.reading.startMinute,x.reading.endMinute])])].sort((a,b)=>a-b);assert.deepEqual(r.joint.records.map(z=>z.index),rows.map(z=>z.index));
 for(let i=0;i<rows.length;i++){const rr=r.joint.records[i],[lo,hi]=bounds(rows[i].reading);assert.equal(rr.ref,'rain-gauge:'+rows[i].reading.id);assert.deepEqual(rr.reading,rows[i].reading);assert.equal(cmp(decode(rr.lowerMm),lo),0n);assert.equal(cmp(decode(rr.upperMm),hi),0n);}
 if(r.joint.status==='nonnegative-history-compatible'){
  assert.equal(r.joint.negativeCycle,null);const h=r.joint.history;assert.deepEqual(h.knots.map(z=>z.minute),times);assert.equal(cmp(decode(h.knots[0].cumulativeMm),zero),0n);assert.equal(h.segments.length,times.length-1);
  for(let i=0;i<h.segments.length;i++){const s=h.segments[i],delta=sub(decode(h.knots[i+1].cumulativeMm),decode(h.knots[i].cumulativeMm));assert.ok(cmp(delta,zero)>=0n);assert.equal(s.startMinute,times[i]);assert.equal(s.endMinute,times[i+1]);assert.equal(cmp(decode(s.depthMm),delta),0n);assert.equal(cmp(mul(decode(s.rateMmHr),sub(binary(times[i+1]),binary(times[i]))),mul(delta,[60n,1n])),0n);}
  assert.deepEqual(r.joint.intervalChecks.map(z=>({index:z.index,ref:z.ref})),rows.map(z=>({index:z.index,ref:'rain-gauge:'+z.reading.id})));
  for(const {reading,index} of rows){const a=times.indexOf(reading.startMinute),b=times.indexOf(reading.endMinute),total=sub(decode(h.knots[b].cumulativeMm),decode(h.knots[a].cumulativeMm)),[lo,hi]=bounds(reading);assert.ok(cmp(total,lo)>=0n&&cmp(total,hi)<=0n);const c=r.joint.intervalChecks.find(z=>z.index===index);assert.equal(c.withinNominalBand,true);assert.equal(cmp(decode(c.totalMm),total),0n);}
 }else{
  assert.equal(r.joint.status,'interval-totals-inconsistent');assert.equal(r.joint.history,null);assert.deepEqual(r.joint.intervalChecks,[]);const es=r.joint.negativeCycle.edges;assert.ok(es.length>0&&es.length<=times.length);let sum=zero;
  for(let i=0;i<es.length;i++){const e=es[i];assert.equal(e.to,es[(i+1)%es.length].from);assert.equal(e.fromMinute,times[e.from]);assert.equal(e.toMinute,times[e.to]);let expected;
   if(e.kind==='monotonic'){assert.equal(e.from,e.to+1);assert.equal(e.id,'monotonic:'+e.from);assert.equal(e.recordIndex,null);assert.equal(e.recordRef,null);expected=zero;}
   else{const rr=x.source.gauge.readings[e.recordIndex];assert.ok(rr&&rr.use==='calibration');const [lo,hi]=bounds(rr);assert.equal(e.recordRef,'rain-gauge:'+rr.id);assert.equal(e.id,e.kind+':'+e.recordIndex);assert.ok(['lower','upper'].includes(e.kind));const upper=e.kind==='upper';assert.equal(e.fromMinute,upper?rr.startMinute:rr.endMinute);assert.equal(e.toMinute,upper?rr.endMinute:rr.startMinute);expected=upper?hi:sub(zero,lo);}
   assert.equal(cmp(decode(e.weightMm),expected),0n);sum=add(sum,expected);
  }assert.ok(cmp(sum,zero)<0n);assert.equal(cmp(decode(r.joint.negativeCycle.sumMm),sum),0n);const indices=[...new Set(es.filter(e=>e.recordIndex!==null).map(e=>e.recordIndex))].sort((a,b)=>a-b);assert.deepEqual(r.joint.negativeCycle.recordIndices,indices);assert.deepEqual(r.joint.negativeCycle.recordRefs,indices.map(i=>'rain-gauge:'+x.source.gauge.readings[i].id));
 }
}
const query=(x,a,b)=>({schema:'experimental-earth-rainfall-interval-query/1',eventRef:x.source.gauge.eventRef,startMinute:a,endMinute:b,source:'Authored interval question; no measurement'});
const enc=a=>({numerator:String(a[0]),denominator:String(a[1])});
function total(h,a,b){return sub(decode(h.knots.find(k=>k.minute===b).cumulativeMm),decode(h.knots.find(k=>k.minute===a).cumulativeMm));}
function verify(x,q,r){
 assert.deepEqual(r.originalProposal,x);assert.deepEqual(r.query,q);const a=r.assessment,extra=[q.startMinute,q.endMinute],rows=x.source.gauge.readings.map((reading,index)=>({reading,index})).filter(z=>z.reading.use==='calibration');
 const facade=(history,checks,records=a.records)=>({originalProposal:x,joint:{status:'nonnegative-history-compatible',records,history,intervalChecks:checks,negativeCycle:null}});
 if(a.status==='interval-totals-inconsistent'){assert.equal(a.bounds,null);certificate(x,{originalProposal:x,joint:{...a,history:null,intervalChecks:[]}},extra);return;}
 const times=[...new Set([0,x.source.project.weather.durationMinutes,...extra,...rows.flatMap(z=>[z.reading.startMinute,z.reading.endMinute])])].sort((a,b)=>a-b);
 function edge(e){assert.equal(e.fromMinute,times[e.from]);assert.equal(e.toMinute,times[e.to]);if(e.kind==='monotonic'){assert.equal(e.from,e.to+1);assert.equal(e.id,'monotonic:'+e.from);assert.equal(e.recordIndex,null);assert.equal(e.recordRef,null);assert.equal(cmp(decode(e.weightMm),zero),0n);}else{const z=x.source.gauge.readings[e.recordIndex];assert.equal(z.use,'calibration');const [lo,hi]=bounds(z),up=e.kind==='upper';assert.ok(up||e.kind==='lower');assert.equal(e.id,e.kind+':'+e.recordIndex);assert.equal(e.recordRef,'rain-gauge:'+z.id);assert.equal(e.fromMinute,up?z.startMinute:z.endMinute);assert.equal(e.toMinute,up?z.endMinute:z.startMinute);assert.equal(cmp(decode(e.weightMm),up?hi:sub(zero,lo)),0n);}}
 for(const side of ['lower','upper']){const b=a.bounds[side];if(b.status!=='attained')continue;certificate(x,facade(b.history,b.intervalChecks),extra);assert.equal(cmp(total(b.history,q.startMinute,q.endMinute),decode(b.totalMm)),0n);const es=b.path.edges;assert.ok(es.length>0&&es.length<times.length);let sum=zero;const visited=new Set([es[0].from]);for(let i=0;i<es.length;i++){edge(es[i]);assert.ok(!visited.has(es[i].to),'bound certificate must be a simple path');visited.add(es[i].to);if(i)assert.equal(es[i-1].to,es[i].from);sum=add(sum,decode(es[i].weightMm));}assert.equal(es[0].fromMinute,side==='lower'?q.endMinute:q.startMinute);assert.equal(es.at(-1).toMinute,side==='lower'?q.startMinute:q.endMinute);assert.equal(cmp(sum,decode(b.path.sumMm)),0n);assert.equal(cmp(side==='lower'?sub(zero,sum):sum,decode(b.totalMm)),0n);}
 if(a.bounds.upper.status==='unbounded'){
  const u=a.bounds.upper;assert.deepEqual(u.base.history,a.bounds.lower.history);certificate(x,facade(u.base.history,u.base.intervalChecks),extra);assert.equal(cmp(total(u.base.history,q.startMinute,q.endMinute),decode(u.base.queryTotalMm)),0n);
  const y=structuredClone(x);for(const z of y.source.gauge.readings)if(z.use==='calibration'){z.depth=0;z.uncertainty=0;}
  const records=rows.map(({index})=>({index,ref:'rain-gauge:'+y.source.gauge.readings[index].id,reading:y.source.gauge.readings[index],lowerMm:enc(zero),upperMm:enc(zero)}));const checks=records.map(z=>({index:z.index,ref:z.ref,totalMm:enc(zero),withinNominalBand:true}));certificate(y,{originalProposal:y,joint:{status:'nonnegative-history-compatible',records,history:u.direction.history,intervalChecks:checks,negativeCycle:null}},extra);assert.equal(cmp(total(u.direction.history,q.startMinute,q.endMinute),[1n,1n]),0n);assert.equal(cmp(decode(u.direction.queryIncrementMm),[1n,1n]),0n);assert.deepEqual(u.direction.calibrationIncrements.map(z=>z.index),rows.map(z=>z.index));for(const z of u.direction.calibrationIncrements){assert.equal(z.ref,'rain-gauge:'+x.source.gauge.readings[z.index].id);assert.equal(cmp(decode(z.incrementMm),zero),0n);}
  const reachable=new Set([times.indexOf(q.startMinute)]);let change=true;while(change){change=false;const pairs=times.slice(1).map((_,i)=>[i+1,i]);for(const {reading:z} of rows)pairs.push([times.indexOf(z.startMinute),times.indexOf(z.endMinute)],[times.indexOf(z.endMinute),times.indexOf(z.startMinute)]);for(const [from,to] of pairs)if(reachable.has(from)&&!reachable.has(to)){reachable.add(to);change=true;}}
  assert.deepEqual(u.direction.reachableVertices,[...reachable].sort((a,b)=>a-b));for(let i=0;i<times.length;i++)assert.equal(cmp(decode(u.direction.history.knots[i].cumulativeMm),[reachable.has(i)?0n:1n,1n]),0n);
 }
}
function check(x,a,b,lo,hi){const q=query(x,a,b),r=inspect(JSON.stringify(x),JSON.stringify(q));verify(x,q,r);assert.equal(cmp(decode(r.assessment.bounds.lower.totalMm),binary(lo)),0n);if(hi===null)assert.equal(r.assessment.bounds.upper.status,'unbounded');else assert.equal(cmp(decode(r.assessment.bounds.upper.totalMm),binary(hi)),0n);return r;}
test('finite half-total and indirect overlapping bounds are attained with original paths',()=>{check(input([row('whole',0,10,10)]),0,5,0,10);check(input([row('first',0,10,10),row('overlap',5,15,5)]),0,5,5,10);});
test('equal endpoints, zero cycles and disconnected potential extension',()=>{check(input([row('a',0,5,3),row('b',5,10,7)]),0,10,10,10);check(input([row('zero',0,10,0),row('same',0,10,0)]),0,5,0,0);check(input([row('isolated',20,30,7),row('whole',0,10,10)]),0,5,0,10);});
test('unbounded tail and challenge-only calibration produce verified recession directions',()=>{check(fixture(),55,60,0,null);const x=input([row('held',0,10,100,0,'challenge')]);const r=check(x,0,5,0,null);assert.equal(r.calibration.status,'no-calibration');});
test('excluded roles and opaque context do not fit bounds; inconsistent calibration has no range',()=>{
 const x=input([row('cal',0,10,10),row('held',0,5,999,0,'challenge'),row('ignored',0,5,999,0,'unassigned')]);x.fronts={opaque:'retained not qualified'};x.goal={opaque:true};const a=check(x,0,5,0,10);const y=structuredClone(x);y.source.gauge.readings[1].depth=0;y.source.gauge.readings[2].depth=0;const b=check(y,0,5,0,10);assert.deepEqual(a.calibration,b.calibration);assert.deepEqual(a.assessment,b.assessment);assert.equal(a.scope.excluded.length,2);assert.deepEqual(a.calibration,rainfallHistoryConsistency(x.source.project,x.source.gauge));
 const bad=input([row('zero',0,10,0),row('one',5,10,1)]),q=query(bad,0,5),r=inspect(JSON.stringify(bad),JSON.stringify(q));assert.equal(r.assessment.status,'interval-totals-inconsistent');assert.equal(r.assessment.relaxations.lower,0);assert.equal(r.assessment.relaxations.upper,0);verify(bad,q,r);
});
test('mixed binary64 unit values and subnormal query endpoints stay exact',()=>{
 const x=input([row('inch',0,10,0.1,0,'calibration','in'),row('cm',10,20,0.1,0,'calibration','cm')]),q=query(x,0,20),r=inspect(JSON.stringify(x),JSON.stringify(q));verify(x,q,r);const expected=add(mul(binary(0.1),binary(25.4)),mul(binary(0.1),binary(10)));assert.equal(cmp(decode(r.assessment.bounds.lower.totalMm),expected),0n);assert.equal(cmp(decode(r.assessment.bounds.upper.totalMm),expected),0n);
 const tiny=input([row('fixed',0,Number.MIN_VALUE,1)]);check(tiny,0,Number.MIN_VALUE,1,1);
});
test('64 distinct calibration endpoints attain max202574 reservation;65 refused',()=>{const x=input(Array.from({length:64},(_,i)=>row('r'+i,1+i*0.5,1.25+i*0.5,0))),q=query(x,40,41),w=estimate(JSON.stringify(x),JSON.stringify(q));assert.equal(w.calibrationVertices,128);assert.equal(w.queryVertices,132);assert.equal(w.totalWork,202574);check(x,40,41,0,null);x.source.gauge.readings.push(row('extra',45,46,0));assert.throws(()=>estimate(JSON.stringify(x),JSON.stringify(q)));});
function counted(x,queryText,estimateOnly=false){
 const loader=`export async function load(url,context,next){const r=await next(url,context);if(!['/rain-gauge-history.js','/rain-mechanism-proposal.js','/core.js'].some(x=>url.endsWith(x)))return r;let s=String(r.source);const targets=[['/rain-gauge-history.js','export function rainfallHistoryConsistency(project,gauge){','globalThis.__baseline=(globalThis.__baseline??0)+1;'],['/rain-mechanism-proposal.js','export function importMechanismProposal(text){','globalThis.__models=(globalThis.__models??0)+1;throw Error("forbidden importer");']];for(const [suffix,needle,insertion] of targets)if(url.endsWith(suffix)){if(s.split(needle).length!==2)throw Error('instrumentation signature');s=s.replace(needle,needle+insertion);}if(url.endsWith('/core.js')){const re=/export function runRain\\([^]*?\\)\\s*\\{/;if(!re.test(s))throw Error('grid instrumentation signature');s=s.replace(re,m=>m+'globalThis.__models=(globalThis.__models??0)+1;throw Error("forbidden grid");');}return {...r,source:s};}`;
 const u='data:text/javascript;base64,'+Buffer.from(loader).toString('base64'),consumer=new URL('../rainfall-interval.js',import.meta.url).href;
 const code=`import {register} from 'node:module';register(${JSON.stringify(u)},import.meta.url);const m=await import(${JSON.stringify(consumer)});let refused=false;try{m.${estimateOnly?'estimateRainfallIntervalWork':'boundRainfallInterval'}(${JSON.stringify(JSON.stringify(x))},${JSON.stringify(queryText)});}catch(e){refused=true;}console.log(JSON.stringify({refused,baseline:globalThis.__baseline??0,models:globalThis.__models??0}));`;
 const p=spawnSync(process.execPath,['--max-old-space-size=128','--input-type=module','-e',code],{encoding:'utf8',timeout:5000,maxBuffer:1048576});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);
}
test('query admission before baseline; successful consumer one baseline and no physical importer',()=>{
 const x=fixture(),q=query(x,0,5),text=JSON.stringify(q);assert.deepEqual(counted(x,text),{refused:false,baseline:1,models:0});assert.deepEqual(counted(x,text,true),{refused:false,baseline:0,models:0});
 const invalid=[{...q,schema:'wrong'},{...q,eventRef:'other-event'},{...q,startMinute:5,endMinute:5},{...q,startMinute:-1},{...q,endMinute:61},{...q,extra:true},{...q,source:' ' }];
 for(const bad of invalid){const t=JSON.stringify(bad);assert.throws(()=>estimate(JSON.stringify(x),t));assert.deepEqual(counted(x,t),{refused:true,baseline:0,models:0});}
 const overflow=text.replace('"startMinute":0','"startMinute":1e400');assert.throws(()=>estimate(JSON.stringify(x),overflow));assert.deepEqual(counted(x,overflow),{refused:true,baseline:0,models:0});
 const tooMany=input(Array.from({length:65},(_,i)=>row('r'+i,0,10,0)));assert.deepEqual(counted(tooMany,JSON.stringify(query(tooMany,0,5))),{refused:true,baseline:0,models:0});
});
