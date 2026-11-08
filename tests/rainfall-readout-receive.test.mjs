import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {inspectReceivedRainfallReadout as inspect,estimateReceivedRainfallReadoutWork as estimate} from '../rainfall-readout-receive.js';
import {inspectRainfallReadout as plan} from '../rainfall-readout.js';
const gcd=(a,b)=>{a=a<0n?-a:a;while(b)[a,b]=[b,a%b];return a;};
function q(n,d=1n){assert.notEqual(d,0n);if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return[n/g,d/g];}
const Z=q(0n),ONE=q(1n),add=(a,b)=>q(a[0]*b[1]+b[0]*a[1],a[1]*b[1]),neg=a=>[-a[0],a[1]],sub=(a,b)=>add(a,neg(b)),mul=(a,b)=>q(a[0]*b[0],a[1]*b[1]),div=(a,b)=>q(a[0]*b[1],a[1]*b[0]),cmp=(a,b)=>a[0]*b[1]-b[0]*a[1];
function number(x){assert.ok(Number.isFinite(x)&&x>=0);const b=Buffer.alloc(8);b.writeDoubleBE(x);const v=b.readBigUInt64BE(),e=Number((v>>52n)&2047n),m=(v&((1n<<52n)-1n))+(e?1n<<52n:0n),k=(e||1)-1075;return k>=0?q(m<<BigInt(k)):q(m,1n<<BigInt(-k));}
function decode(x){assert.deepEqual(Object.keys(x).sort(),['denominator','numerator']);const a=[BigInt(x.numerator),BigInt(x.denominator)];assert.ok(a[1]>0n);assert.deepEqual(q(...a),a);return a;}
const eq=(a,b)=>assert.equal(cmp(a,b),0n),json=JSON.stringify;
const row=(id,a,b,depth,uncertainty=0,use='calibration')=>({id,startMinute:a,endMinute:b,depth,uncertainty,unit:'mm',source:'Authored independent fixture, not acquired data',use});
function original(rows){const x=JSON.parse(readFileSync(new URL('../examples/conditional-rainfall-original.json',import.meta.url),'utf8'));x.source.gauge.readings=rows;return x;}
const query=(x,u=.5,T=4,a=0,b=5,c=10)=>({schema:'experimental-earth-rainfall-readout-query/1',eventRef:x.source.gauge.eventRef,startMinute:a,splitMinute:b,endMinute:c,uncertaintyMm:u,thresholdMm:T,source:'Authored prospective plan'});
const reading=(p,z=6.5,u=.5)=>({schema:'experimental-earth-rainfall-readout-reading/1',id:'independent-declaration',eventRef:p.eventRef,startMinute:p.startMinute,endMinute:p.splitMinute,valueMm:z,uncertaintyMm:u,source:'Authored declaration, not an acquired measurement'});
// Independent original-row halfplanes and exact boundary intersections.
// These authored fixtures use three marked endpoints, not producer slice formulas.
function halfplanes(x,p,r){
 const h=[{a:-1,b:0,c:Z},{a:0,b:-1,c:Z}];
 for(const v of x.source.gauge.readings.filter(v=>v.use==='calibration')){
  assert.equal(v.unit,'mm');let a,b;
  if(v.startMinute===p.startMinute&&v.endMinute===p.splitMinute){a=1;b=0;}
  else if(v.startMinute===p.splitMinute&&v.endMinute===p.endMinute){a=0;b=1;}
  else{assert.equal(v.startMinute,p.startMinute);assert.equal(v.endMinute,p.endMinute);a=1;b=1;}
  const d=number(v.depth),u=number(v.uncertainty),raw=sub(d,u),lo=cmp(raw,Z)>0n?raw:Z;
  h.push({a,b,c:add(d,u)},{a:-a,b:-b,c:neg(lo)});
 }
 const z=number(r.valueMm),u=number(r.uncertaintyMm);h.push({a:1,b:0,c:add(z,u)},{a:-1,b:0,c:sub(u,z)});return h;
}
const dot=(h,x,y)=>add(mul(q(BigInt(h.a)),x),mul(q(BigInt(h.b)),y));
function vertices(h){const out=[];for(let i=0;i<h.length;i++)for(let j=i+1;j<h.length;j++){
 const a=h[i],b=h[j],det=a.a*b.b-a.b*b.a;if(!det)continue;
 const x=div(sub(mul(q(BigInt(b.b)),a.c),mul(q(BigInt(a.b)),b.c)),q(BigInt(det)));
 const y=div(sub(mul(q(BigInt(a.a)),b.c),mul(q(BigInt(b.a)),a.c)),q(BigInt(det)));
 if(h.every(v=>cmp(dot(v,x,y),v.c)<=0n)&&!out.some(v=>cmp(v[0],x)===0n&&cmp(v[1],y)===0n))out.push([x,y]);
 }return out;}
function witness(w,h,z,u){assert.equal(w.withinDeclaredBand,true);assert.equal(w.withinJointRegion,true);const x=decode(w.xMm),y=decode(w.yMm);assert.ok(cmp(x,Z)>=0n&&cmp(y,Z)>=0n);assert.ok(cmp(x,sub(z,u))>=0n&&cmp(x,add(z,u))<=0n);for(const c of h)assert.ok(cmp(dot(c,x,y),c.c)<=0n);return[x,y];}
function verify(x,p,r,out){
 assert.equal(out.schema,'experimental-earth-rainfall-readout-receive/1');assert.deepEqual(out.declaredReading,r);assert.deepEqual(out.planningReport,plan(json(x),json(p)));assert.ok(!Object.hasOwn(out,'originalProposal'));assert.deepEqual(out.planningReport.jointRegion.originalProposal,x);
 assert.equal(out.scope.physicalInference,false);assert.equal(out.scope.physicalValidation,false);assert.equal(out.scope.chronologyValidation,false);assert.equal(out.scope.originalRolesUnchanged,true);
 assert.equal(out.work.additionalPreflightWork,2048);assert.equal(out.work.symbolicWork,4096);assert.equal(out.work.additionalWork,6144);assert.equal(out.work.totalWork,out.work.planning.totalWork+6144);assert.equal(out.work.limits.maxDecodedRationals,17);
 const a=out.assessment,z=number(r.valueMm),u=number(r.uncertaintyMm),T=number(p.thresholdMm);eq(decode(a.parameters.valueMm),z);eq(decode(a.parameters.actualUncertaintyMm),u);eq(decode(a.parameters.plannedUncertaintyMm),number(p.uncertaintyMm));eq(decode(a.parameters.thresholdMm),T);
 assert.equal(a.uncertaintyComparison,r.uncertaintyMm<p.uncertaintyMm?'less':r.uncertaintyMm>p.uncertaintyMm?'greater':'equal');
 if(out.planningReport.assessment.status==='original-calibration-inconsistent'){assert.equal(a.status,'original-calibration-inconsistent');for(const k of ['plannedAtom','actual','classificationChanged','sameErrorClassificationVerified'])assert.equal(a[k],null);return;}
 const atoms=out.planningReport.assessment.atoms,matches=atoms.map((v,i)=>({v,i})).filter(({v})=>{const lo=cmp(z,decode(v.lowerMm)),hi=v.upperMm===null?-1n:cmp(z,decode(v.upperMm));return(lo>0n||(lo===0n&&v.lowerInclusive))&&(hi<0n||(hi===0n&&v.upperInclusive));});assert.equal(matches.length,1);assert.deepEqual(a.plannedAtom,{index:matches[0].i,atom:matches[0].v});
 const h=halfplanes(x,p,r),vs=vertices(h),actual=a.actual;
 if(!vs.length){assert.equal(a.status,'declared-readout-incompatible');assert.equal(actual.classification,'outside-support');assert.equal(actual.earlyIntersection.empty,true);assert.ok(cmp(decode(actual.earlyIntersection.lowerMm),decode(actual.earlyIntersection.upperMm))>0n);for(const k of ['lateBounds','lowerWitness','upperWitness','unboundedDirection'])assert.equal(actual[k],null);}
 else{
  assert.equal(a.status,'declared-readout-compatible');assert.equal(actual.earlyIntersection.empty,false);const xs=vs.map(v=>v[0]).sort((a,b)=>cmp(a,b)<0n?-1:cmp(a,b)>0n?1:0);eq(decode(actual.earlyIntersection.lowerMm),xs[0]);eq(decode(actual.earlyIntersection.upperMm),xs.at(-1));
  const ys=vs.map(v=>v[1]).sort((a,b)=>cmp(a,b)<0n?-1:cmp(a,b)>0n?1:0),unbounded=h.every(v=>v.b<=0);eq(decode(actual.lateBounds.lowerMm),ys[0]);assert.equal(actual.lateBounds.lowerInclusive,true);eq(witness(actual.lowerWitness,h,z,u)[1],ys[0]);
  if(unbounded){assert.equal(actual.lateBounds.upperMm,null);assert.equal(actual.lateBounds.upperInclusive,false);assert.equal(actual.upperWitness,null);const d=actual.unboundedDirection;eq(decode(d.xIncrementMm),Z);eq(decode(d.yIncrementMm),ONE);assert.equal(d.withinHomogeneousRegion,true);assert.equal(d.preservesDeclaredBand,true);for(const v of h)assert.ok(cmp(dot(v,Z,ONE),Z)<=0n);}
  else{eq(decode(actual.lateBounds.upperMm),ys.at(-1));assert.equal(actual.lateBounds.upperInclusive,true);eq(witness(actual.upperWitness,h,z,u)[1],ys.at(-1));assert.equal(actual.unboundedDirection,null);}
  const cls=!unbounded&&cmp(ys.at(-1),T)<=0n?'certain-meet':cmp(ys[0],T)>0n?'certain-miss':'ambiguous';assert.equal(actual.classification,cls);
 }
 assert.equal(a.classificationChanged,actual.classification!==a.plannedAtom.atom.classification);assert.equal(a.sameErrorClassificationVerified,r.uncertaintyMm===p.uncertaintyMm?true:null);if(r.uncertaintyMm===p.uncertaintyMm)assert.equal(a.classificationChanged,false);
}
function run(x,p=query(x),r=reading(p)){const before=json([x,p,r]),out=inspect(json(x),json(p),json(r));assert.equal(json([x,p,r]),before);verify(x,p,r,out);return out;}
test('matched, wider and narrower declarations compare at same value with exact endpoint witnesses',()=>{
 const x=original([row('whole',0,10,10)]),p=query(x);
 for(const [z,u,lo,hi,planned,actual] of [[6.5,.5,3,4,'certain-meet','certain-meet'],[6.5,1.5,2,5,'certain-meet','ambiguous'],[6.25,.25,3.5,4,'ambiguous','certain-meet']]){const a=run(x,p,reading(p,z,u)).assessment;eq(decode(a.actual.lateBounds.lowerMm),number(lo));eq(decode(a.actual.lateBounds.upperMm),number(hi));assert.equal(a.plannedAtom.atom.classification,planned);assert.equal(a.actual.classification,actual);}
});
test('outside support in both directions and equal-error outside retain nonvacuous results',()=>{
 const x=original([row('early',0,5,2),row('late',5,10,3)]),p=query(x);
 const a=run(x,p,reading(p,3,1)).assessment;assert.equal(a.plannedAtom.atom.classification,'outside-support');assert.equal(a.actual.classification,'certain-meet');
 const b=run(x,p,reading(p,2.5,0)).assessment;assert.equal(b.plannedAtom.atom.classification,'certain-meet');assert.equal(b.actual.classification,'outside-support');
 run(x,p,reading(p,3,.5));run(x,p,reading(p,2,.5));
});
test('zero uncertainty, threshold equality, singleton and coincident boundaries',()=>{
 const x=original([row('whole',0,10,10)]),p=query(x,0,4);for(const z of [0,6,10,10+Number.EPSILON*8])run(x,p,reading(p,z,0));
 const y=original([row('early',0,5,2),row('late',5,10,3)]),s=query(y,0,3);const a=run(y,s,reading(s,2,0)).assessment.actual;eq(decode(a.lateBounds.lowerMm),number(3));eq(decode(a.lateBounds.upperMm),number(3));assert.equal(a.classification,'certain-meet');
});
test('original contradiction, unbounded direction and excluded/opaque originals are preserved',()=>{
 const bad=original([row('zero',0,10,0),row('late',5,10,1)]);run(bad,query(bad),reading(query(bad),6.5,1.5));
 const x=original([row('held',0,10,99,0,'challenge'),row('unused',0,5,42,0,'unassigned')]);x.goal={opaque:'retained, not interpreted'};run(x);const early=original([row('early',0,5,2)]);run(early,query(early),reading(query(early),2,.5));
 const y=original([row('whole',0,10,10),row('held',0,5,99,0,'challenge')]),a=run(y);y.source.gauge.readings[1].depth=0;assert.deepEqual(a.assessment,run(y).assessment);
});
test('MAX_VALUE, subnormals and adjacent values stay exact without Number overflow',()=>{
 const x=original([row('whole',0,10,10)]),p=query(x);run(x,p,reading(p,Number.MAX_VALUE,Number.MAX_VALUE));run(x,p,reading(p,Number.MAX_VALUE,0));run(x,p,reading(p,6,Number.MIN_VALUE));run(x,p,reading(p,6+Number.EPSILON*4,0));
 const tiny=original([row('whole',0,10,2*Number.MIN_VALUE)]),s=query(tiny,Number.MIN_VALUE,Number.MIN_VALUE);run(tiny,s,reading(s,Number.MIN_VALUE,Number.MIN_VALUE));
});
test('complete valid reservation310493 and stronger65-record admission limit',()=>{
 const x=original(Array.from({length:64},(_,i)=>row('r'+i,1+i*.5,1.25+i*.5,0))),p=query(x,.5,4,40,41,42),r=reading(p,0,0),w=estimate(json(x),json(p),json(r));assert.equal(w.planning.totalWork,304349);assert.equal(w.totalWork,310493);assert.equal(w.additionalWork,6144);assert.equal(w.limits.maxDecodedRationals,17);x.source.gauge.readings.push(row('extra',50,51,0));assert.throws(()=>estimate(json(x),json(p),json(r)));
});
function counted(x,p,r,estimateOnly=false){
 const defs=[['/rainfall-readout.js','export function estimateRainfallReadoutWork(originalText,outcomeQueryText){','readoutEstimate'],['/rainfall-readout.js','export function inspectRainfallReadout(originalText,outcomeQueryText){','readout'],['/rainfall-joint-region.js','export function estimateRainfallJointRegionWork(originalText,queryText){','jointEstimate'],['/rainfall-joint-region.js','export function inspectRainfallJointRegion(originalText,queryText){','joint'],['/rain-gauge-history.js','export function rainfallHistoryConsistency(project,gauge){','baseline'],['/rainfall-constraint-core.js','export function solveRainfallFeasibility({times,edges}){','feasibility'],['/rainfall-interval.js','function shortest(graph,source){','shortest'],['/rainfall-interval.js','export function conditionRainfallInterval(originalText,queryText,conditionText){','condition'],['/rain-mechanism-proposal.js','export function importMechanismProposal(text){','models']];
 const loader=`export async function load(url,context,next){const r=await next(url,context),defs=${json(defs)};if(!defs.some(d=>url.endsWith(d[0]))&&!url.endsWith('/core.js'))return r;let s=String(r.source);for(const [suffix,needle,key]of defs)if(url.endsWith(suffix)){if(s.split(needle).length!==2)throw Error('instrumentation signature '+key);s=s.replace(needle,needle+'globalThis.__'+key+'=(globalThis.__'+key+'??0)+1;');}if(url.endsWith('/core.js')){const re=/export function runRain\\([^]*?\\)\\s*\\{/;if(!re.test(s))throw Error('grid signature');s=s.replace(re,m=>m+'globalThis.__models=(globalThis.__models??0)+1;throw Error("forbidden grid");');}return {...r,source:s};}`;
 const code=`import {register} from 'node:module';register(${json('data:text/javascript;base64,'+Buffer.from(loader).toString('base64'))},import.meta.url);const m=await import(${json(new URL('../rainfall-readout-receive.js',import.meta.url).href)});let refused=false;try{m.${estimateOnly?'estimateReceivedRainfallReadoutWork':'inspectReceivedRainfallReadout'}(${[x,p,r].map(v=>json(typeof v==='string'?v:json(v))).join(',')});}catch(e){refused=true;}console.log(JSON.stringify({refused,...Object.fromEntries(${json(defs.map(d=>d[2]))}.map(k=>[k,globalThis['__'+k]??0]))}));`;
 const child=spawnSync(process.execPath,['--max-old-space-size=128','--input-type=module','-e',code],{encoding:'utf8',timeout:5000,maxBuffer:1048576});assert.equal(child.status,0,child.stderr);return JSON.parse(child.stdout);
}
test('nested calls and invalid receipt/association admission precede any consumer',()=>{
 const x=original([row('whole',0,10,10)]),p=query(x),r=reading(p),none={refused:true,readoutEstimate:0,readout:0,jointEstimate:0,joint:0,baseline:0,feasibility:0,shortest:0,condition:0,models:0},valid={...none,refused:false,readoutEstimate:1,readout:1,jointEstimate:2,joint:1,baseline:1,feasibility:1,shortest:3};
 assert.deepEqual(counted(x,p,r),valid);assert.deepEqual(counted(x,p,r,true),{...none,refused:false,readoutEstimate:1,jointEstimate:1});const bad=original([row('zero',0,10,0),row('one',5,10,1)]);assert.deepEqual(counted(bad,query(bad),reading(query(bad))),{...valid,shortest:0});
 for(const v of [{...r,schema:'wrong'},{...r,valueMm:-1},{...r,uncertaintyMm:null},{...r,extra:true},{...r,id:' '},{...r,source:'x'.repeat(601)},'\uFEFF'+json(r),json(r).replace('"valueMm":6.5','"valueMm":1e400')])assert.deepEqual(counted(x,p,v),none);
 for(const v of [{...r,eventRef:'other-event'},{...r,endMinute:4}])assert.deepEqual(counted(x,p,v),{...none,readoutEstimate:1,jointEstimate:1});
 assert.deepEqual(counted(x,{...p,schema:'wrong'},r),{...none,readoutEstimate:1});
});
