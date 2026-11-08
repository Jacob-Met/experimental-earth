import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {inspectArchivedRainTiming as inspect,estimateArchivedRainTimingWork as estimate} from '../archived-rain-timing.js';
const gcd=(a,b)=>{a=a<0n?-a:a;while(b)[a,b]=[b,a%b];return a;};
function Q(n,d=1n){assert.notEqual(d,0n);if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return[n/g,d/g];}
const add=(a,b)=>Q(a[0]*b[1]+b[0]*a[1],a[1]*b[1]),sub=(a,b)=>Q(a[0]*b[1]-b[0]*a[1],a[1]*b[1]),mul=(a,b)=>Q(a[0]*b[0],a[1]*b[1]),div=(a,b)=>Q(a[0]*b[1],a[1]*b[0]),cmp=(a,b)=>a[0]*b[1]-b[0]*a[1];
const min=(a,b)=>cmp(a,b)<=0n?a:b,max=(a,b)=>cmp(a,b)>=0n?a:b,Z=Q(0n),ONE=Q(1n),HALF=Q(1n,2n),QUARTER=Q(1n,4n),FIVE=Q(5n),TEN=Q(10n),K=Q(6n),R=Q(20n);
function number(x){assert.ok(Number.isFinite(x)&&x>=0);const b=Buffer.alloc(8);b.writeDoubleBE(x);const v=b.readBigUInt64BE(),e=Number((v>>52n)&2047n),m=(v&((1n<<52n)-1n))+(e?1n<<52n:0n),k=(e||1)-1075;return k>=0?Q(m<<BigInt(k)):Q(m,1n<<BigInt(-k));}
function keys(v,n){assert.ok(v!==null&&typeof v==='object'&&!Array.isArray(v));assert.deepEqual(Object.keys(v).sort(),[...n].sort());}
function dec(v){keys(v,['numerator','denominator']);assert.equal(typeof v.numerator,'string');assert.equal(typeof v.denominator,'string');assert.ok(v.numerator.length<=650&&v.denominator.length<=650);const q=[BigInt(v.numerator),BigInt(v.denominator)];assert.equal(v.numerator,q[0].toString());assert.equal(v.denominator,q[1].toString());assert.ok(q[1]>0n);assert.deepEqual(Q(...q),q);return q;}
const eq=(a,b)=>assert.equal(cmp(a,b),0n),json=JSON.stringify;
const original=()=>JSON.parse(readFileSync(new URL('../examples/authored-rain-timing.json',import.meta.url),'utf8'));
const reading=(quarter='first',valueMm=2,uncertaintyMm=0)=>({schema:'experimental-earth-archived-rain-timing-reading/1',id:'independent-authored-reading',quarter,valueMm,uncertaintyMm,source:'Hypothetical archive declaration, not an acquired record'});
function anchors(read){const lo=max(Z,sub(number(read.valueMm),number(read.uncertaintyMm))),hi=min(FIVE,add(number(read.valueMm),number(read.uncertaintyMm)));if(cmp(lo,hi)>0n)return{lo,hi,a:null};const third=read.quarter==='third';return{lo,hi,a:[{t:Z,l:Z,u:Z},{t:HALF,l:FIVE,u:FIVE},{t:ONE,l:TEN,u:TEN},{t:third?Q(3n,4n):QUARTER,l:third?add(FIVE,lo):lo,u:third?add(FIVE,hi):hi}]};}
// Generic four-anchor Lipschitz envelopes, independent of the consumer formulas.
function envelope(a,lower){
 for(const x of a)for(const y of a)assert.ok(cmp(x.l,add(y.u,mul(R,max(Z,sub(x.t,y.t)))))<=0n);
 const pieces=[];
 for(const x of a){const v=lower?x.l:x.u;if(lower)pieces.push({l:Z,h:x.t,s:R,b:sub(v,mul(R,x.t))},{l:x.t,h:ONE,s:Z,b:v});else pieces.push({l:Z,h:x.t,s:Z,b:v},{l:x.t,h:ONE,s:R,b:sub(v,mul(R,x.t))});}
 const times=a.map(x=>x.t);
 for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++){const p=pieces[i],q=pieces[j],ds=sub(p.s,q.s);if(cmp(ds,Z)===0n)continue;const t=div(sub(q.b,p.b),ds);if(cmp(t,max(p.l,q.l))>=0n&&cmp(t,min(p.h,q.h))<=0n)times.push(t);}
 const knots=[];for(const t of times)if(!knots.some(v=>cmp(v,t)===0n))knots.push(t);knots.sort((a,b)=>cmp(a,b)<0n?-1:cmp(a,b)>0n?1:0);assert.ok(knots.length<=32);eq(knots[0],Z);eq(knots.at(-1),ONE);
 let prefixMin=Z,lastC=Z,lastT=Z,lastW=Z;
 for(const t of knots){const values=a.map(x=>lower?sub(x.l,mul(R,max(Z,sub(x.t,t)))):add(x.u,mul(R,max(Z,sub(t,x.t)))));const C=values.reduce(lower?max:min);assert.ok(cmp(C,lastC)>=0n&&cmp(sub(C,lastC),mul(R,sub(t,lastT)))<=0n);const S=sub(C,mul(K,t));prefixMin=min(prefixMin,S);lastW=sub(S,prefixMin);for(const x of a)if(cmp(t,x.t)===0n)assert.ok(cmp(C,x.l)>=0n&&cmp(C,x.u)<=0n);lastC=C;lastT=t;}
 eq(lastC,TEN);return lastW;
}
function profile(w,read,band,expected,ordering,quarterTotal){
 keys(w,['ordering','quarterTotalMm','bins','segments','knots','terminalSurfaceWaterMm','originalHalfHourTotalsMm','withinDeclaredBand','rateCapVerified']);assert.equal(w.ordering,ordering);eq(dec(w.quarterTotalMm),quarterTotal);assert.ok(cmp(quarterTotal,band.lo)>=0n&&cmp(quarterTotal,band.hi)<=0n);assert.equal(w.withinDeclaredBand,true);assert.equal(w.rateCapVerified,true);
 const bins=read.quarter==='first'?[[Z,QUARTER,quarterTotal],[QUARTER,HALF,sub(FIVE,quarterTotal)],[HALF,ONE,FIVE]]:[[Z,HALF,FIVE],[HALF,Q(3n,4n),quarterTotal],[Q(3n,4n),ONE,sub(FIVE,quarterTotal)]];
 assert.equal(w.bins.length,3);w.bins.forEach((b,i)=>{keys(b,['startHour','endHour','depthMm']);[b.startHour,b.endHour,b.depthMm].forEach((v,j)=>eq(dec(v),bins[i][j]));});assert.ok(w.segments.length>=3&&w.segments.length<=6);assert.equal(w.knots.length,w.segments.length+1);
 let last=Z,C=Z,F=Z,prefix=Z;const totals=bins.map(()=>Z);
 function knot(v,t,W){keys(v,['hour','cumulativeRainMm','cumulativeInfiltrationMm','surfaceWaterMm']);eq(dec(v.hour),t);eq(dec(v.cumulativeRainMm),C);eq(dec(v.cumulativeInfiltrationMm),F);eq(dec(v.surfaceWaterMm),W);}
 knot(w.knots[0],Z,Z);
 w.segments.forEach((s,i)=>{keys(s,['startHour','endHour','rateMmHr','depthMm']);const start=dec(s.startHour),end=dec(s.endHour),rate=dec(s.rateMmHr),depth=dec(s.depthMm);eq(start,last);assert.ok(cmp(end,start)>0n&&cmp(end,ONE)<=0n);assert.ok(cmp(rate,Z)===0n||cmp(rate,R)===0n);eq(depth,mul(rate,sub(end,start)));assert.ok(bins.some(b=>cmp(start,b[0])>=0n&&cmp(end,b[1])<=0n),'segment crosses preserved bin boundary');bins.forEach((b,j)=>{const dt=max(Z,sub(min(end,b[1]),max(start,b[0])));totals[j]=add(totals[j],mul(rate,dt));});C=add(C,depth);const orderedC=bins.reduce((sum,b)=>add(sum,ordering==='earliest'?min(b[2],mul(R,max(Z,sub(end,b[0])))):max(Z,sub(b[2],mul(R,max(Z,sub(b[1],end)))))),Z);eq(C,orderedC);const S=sub(C,mul(K,end));prefix=min(prefix,S);const W=sub(S,prefix),newF=sub(C,W);assert.ok(cmp(W,Z)>=0n&&cmp(newF,F)>=0n);F=newF;knot(w.knots[i+1],end,W);last=end;});
 eq(last,ONE);eq(C,TEN);totals.forEach((v,i)=>eq(v,bins[i][2]));eq(sub(C,F),expected);eq(dec(w.terminalSurfaceWaterMm),expected);assert.equal(w.originalHalfHourTotalsMm.length,2);w.originalHalfHourTotalsMm.forEach(v=>eq(dec(v),FIVE));
}
function verify(o,r,result){
 keys(result,['schema','originalDeclaration','declaredReading','scope','work','assessment','meaning']);assert.equal(result.schema,'experimental-earth-archived-rain-timing/1');assert.deepEqual(result.originalDeclaration,o);assert.deepEqual(result.declaredReading,r);assert.deepEqual(result.scope,{mathematicalDeclaration:true,retrospective:true,physicalAssociationVerified:false,instrumentAccuracyVerified:false,rateCapInferred:false,wholeSitePrediction:false,modelReplayed:false,originalSchedulesExhaustive:false,readingAvailabilityVerified:false,originalHalfHourTotalsAreAssumed:true});
 assert.deepEqual(result.work,{bins:3,maxProfiles:2,maxSegmentsPerProfile:6,maxTotalSegments:12,reservedScalarWork:4096,limits:{originalBytes:16384,readingBytes:4096,persistentBits:8192,intermediateBits:16384}});assert.equal(typeof result.meaning,'string');assert.ok(result.meaning.length>0);
 const a=result.assessment;keys(a,['status','quarterIntervalMinutes','parameters','compatibleQuarterBand','terminalBounds','classification','lowerWitness','upperWitness']);assert.deepEqual(a.quarterIntervalMinutes,r.quarter==='first'?[0,15]:[30,45]);keys(a.parameters,['valueMm','uncertaintyMm','conductivityMmHr','rateCapMmHr','targetMm','originalHalfHourTotalsMm']);for(const[k,v]of Object.entries({valueMm:number(r.valueMm),uncertaintyMm:number(r.uncertaintyMm),conductivityMmHr:K,rateCapMmHr:R,targetMm:FIVE}))eq(dec(a.parameters[k]),v);assert.equal(a.parameters.originalHalfHourTotalsMm.length,2);a.parameters.originalHalfHourTotalsMm.forEach(v=>eq(dec(v),FIVE));
 const b=anchors(r);keys(a.compatibleQuarterBand,['lowerMm','upperMm','empty']);eq(dec(a.compatibleQuarterBand.lowerMm),b.lo);eq(dec(a.compatibleQuarterBand.upperMm),b.hi);assert.equal(a.compatibleQuarterBand.empty,b.a===null);
 if(!b.a){assert.equal(a.status,'declared-reading-incompatible');assert.equal(a.classification,'outside-support');for(const k of ['terminalBounds','lowerWitness','upperWitness'])assert.equal(a[k],null);return;}
 const lower=envelope(b.a,false),upper=envelope(b.a,true);assert.equal(a.status,'declared-reading-compatible');keys(a.terminalBounds,['lowerMm','upperMm','lowerInclusive','upperInclusive']);eq(dec(a.terminalBounds.lowerMm),lower);eq(dec(a.terminalBounds.upperMm),upper);assert.equal(a.terminalBounds.lowerInclusive,true);assert.equal(a.terminalBounds.upperInclusive,true);assert.equal(a.classification,cmp(upper,FIVE)<=0n?'certain-meet':cmp(lower,FIVE)>0n?'certain-miss':'ambiguous');profile(a.lowerWitness,r,b,lower,'earliest',r.quarter==='first'?b.hi:b.lo);profile(a.upperWitness,r,b,upper,'latest',b.lo);
}
function run(r=reading(),o=original()){const before=json([o,r]),result=inspect(json(o),json(r));assert.equal(json([o,r]),before);verify(o,r,result);return result;}
test('exact generic envelopes certify precision reversal and later-quarter contrast',()=>{
 for(const[r,lo,hi,cls]of [[reading('first',2,0),Q(4n),Q(49n,10n),'certain-meet'],[reading('first',2,.5),Q(4n),Q(101n,20n),'ambiguous'],[reading('third',2,0),Q(4n),Q(11n,2n),'ambiguous']]){const a=run(r).assessment;eq(dec(a.terminalBounds.lowerMm),lo);eq(dec(a.terminalBounds.upperMm),hi);assert.equal(a.classification,cls);}
});
test('closed endpoints, strict half-mm miss boundary and both binary64 sides of rational5/3',()=>{
 for(const z of [0,.25,.5,1.5,2,5])run(reading('first',z,0));const center=5/3,b=Buffer.alloc(8);b.writeDoubleBE(center);const bits=b.readBigUInt64BE();const vals=[bits-1n,bits,bits+1n].map(v=>{b.writeBigUInt64BE(v);return b.readDoubleBE();});
 for(const z of vals){const a=run(reading('first',z,0)).assessment;assert.equal(a.classification,cmp(number(z),Q(5n,3n))>=0n?'certain-meet':'ambiguous');}assert.equal(run(reading('first',.5,0)).assessment.classification,'ambiguous');assert.equal(run(reading('first',.25,0)).assessment.classification,'certain-miss');
});
test('third-quarter information remains ambiguous at endpoints and broad bands',()=>{for(const[z,u]of [[0,0],[5,0],[2,.5],[2,10]]){const a=run(reading('third',z,u)).assessment;eq(dec(a.terminalBounds.lowerMm),Q(4n));eq(dec(a.terminalBounds.upperMm),Q(11n,2n));assert.equal(a.classification,'ambiguous');}});
test('empty bands, MAX_VALUE and subnormal precision retain exact rational certificates',()=>{
 for(const quarter of ['first','third'])for(const[z,u]of [[6,0],[Number.MAX_VALUE,0],[Number.MAX_VALUE,Number.MAX_VALUE],[0,Number.MIN_VALUE],[Number.MIN_VALUE,0],[2,Number.MIN_VALUE],[5,Number.MIN_VALUE]])run(reading(quarter,z,u));
});
test('original declaration preserved and exact estimator reservation remains admission-only',()=>{
 const o=original();o.source='Independent authored provenance, not field evidence';run(reading(),o);const w=estimate(json(o),json(reading()));assert.equal(w.reservedScalarWork,4096);assert.equal(w.maxTotalSegments,12);
 for(const change of [x=>x.model.conductivityMmHr=7,x=>x.model.segmentHours=.5,x=>x.schedules[1].ratesMmHr[0]=19,x=>x.target.valueMm=4,x=>x.extra=true]){const bad=structuredClone(o);change(bad);assert.throws(()=>estimate(json(bad),json(reading())));}
});
function counted(o,r,onlyEstimate=false){
 const defs=[['/rainfall-constraint-core.js','export function buildRainfallGraph(included,endpointSet){','graph'],['/rainfall-constraint-core.js','export function solveRainfallFeasibility({times,edges}){','feasibility'],['/rain-gauge-consistency.js','export function rainfallConsistency(project,gauge,offeredRates=[]){','consistency'],['/rain-gauge-evidence.js','export function validateRainGauge(project,gauge){','gauge'],['/rain-soil-evidence.js','export function compareRainSoil(project, request) {','rainSoil'],['/infiltration-study.js','export function compareInfiltration(project, study = project.infiltrationStudy) {','infiltration']];
 const regexDefs=[['/core.js','export function runRain\\([^]*?\\)\\s*\\{','grid'],['/wetting-front.js','export function advanceWettingFront\\([^]*?\\)\\s*\\{','front'],['/pressure-head.js','export function advancePressureHead\\([^]*?\\)\\s*\\{','pressure']];
 const loader=`export async function load(url,context,next){const r=await next(url,context),defs=${json(defs)},rs=${json(regexDefs)};if(![...defs,...rs].some(d=>url.endsWith(d[0])))return r;let s=String(r.source);const entry=key=>'globalThis.__calls??={};globalThis.__calls['+JSON.stringify(key)+']=(globalThis.__calls['+JSON.stringify(key)+']??0)+1;throw Error("forbidden scientific entry");';let markers=[];for(const[suffix,needle,key]of defs)if(url.endsWith(suffix)){if(s.split(needle).length!==2)throw Error('signature '+key);s=s.replace(needle,needle+entry(key));markers.push(key);}for(const[suffix,pattern,key]of rs)if(url.endsWith(suffix)){const re=new RegExp(pattern,'g'),matches=[...s.matchAll(re)];if(matches.length!==1)throw Error('signature '+key);s=s.replace(new RegExp(pattern),m=>m+entry(key));markers.push(key);}s+='\\nglobalThis.__loaded??=[];globalThis.__loaded.push(...'+JSON.stringify(markers)+');';return{...r,source:s};}`;
 const code=`import{register}from'node:module';register(${json('data:text/javascript;base64,'+Buffer.from(loader).toString('base64'))},import.meta.url);const m=await import(${json(new URL('../archived-rain-timing.js',import.meta.url).href)});let refused=false,result=null;try{result=m.${onlyEstimate?'estimateArchivedRainTimingWork':'inspectArchivedRainTiming'}(${json(typeof o==='string'?o:json(o))},${json(typeof r==='string'?r:json(r))});}catch(e){refused=true;}console.log(JSON.stringify({refused,result,loaded:globalThis.__loaded??[],calls:globalThis.__calls??{}}));`;
 const c=spawnSync(process.execPath,['--max-old-space-size=128','--input-type=module','-e',code],{encoding:'utf8',timeout:5000,maxBuffer:1048576});assert.equal(c.status,0,c.stderr);const v=JSON.parse(c.stdout);assert.deepEqual([...v.loaded].sort(),[...defs,...regexDefs].map(d=>d[2]).sort());assert.deepEqual(v.calls,{});return v;
}
test('watched definitions load but no scientific graph/model entry occurs',()=>{
 const o=original(),r=reading();let v=counted(o,r);assert.equal(v.refused,false);verify(o,r,v.result);v=counted(o,r,true);assert.equal(v.refused,false);assert.equal(v.result.reservedScalarWork,4096);v=counted(o,reading('first',6,0));assert.equal(v.refused,false);assert.equal(v.result.assessment.status,'declared-reading-incompatible');
 for(const bad of [{...r,quarter:'second'},{...r,valueMm:-1},{...r,uncertaintyMm:null},{...r,source:' '},{...r,extra:1},'\uFEFF'+json(r),json(r).replace('"valueMm":2','"valueMm":1e400')])assert.equal(counted(o,bad).refused,true);
 const bad=original();bad.model.conductivityMmHr=7;assert.equal(counted(bad,r).refused,true);
});
