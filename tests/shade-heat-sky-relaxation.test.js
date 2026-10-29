import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {minimizeMinimumSkyRelaxation,verifyMinimumSkyRelaxation} from '../shade-heat-sky-relaxation.js';
import {testMinimumSkyRequirements} from '../shade-heat-sky-joint-requirements.js';
import {add,sub,mul,cmp,neg} from '../vendor/chronos/exact-halfplanes.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./sky-relaxation-oracles.json',import.meta.url),'utf8'));
const Q=value=>{const [n,d='1']=String(value).split('/');return [BigInt(n),BigInt(d)];};
const Z=()=>Q(0),row=(coefficients,constant='0')=>({constant:Q(constant),coefficients:coefficients.map(v=>[Q(v),Z(),Z()])});
function input(item){return {observed:item.observations.map(o=>row(o.coefficients)),bands:item.observations.map(o=>({lower:Q(o.lower),upper:Q(o.upper)})),
 requirements:item.requirements.map(r=>({relation:r.relation,limit:Q(r.limit),lower:row(r.lower.coefficients,r.lower.constant),upper:row(r.upper.coefficients,r.upper.constant)}))};}
const named=name=>{const item=fixture.cases.find(c=>c.name===name);assert(item,name);return {item,...input(item)};};
const run=({observed,bands,requirements},options={})=>minimizeMinimumSkyRelaxation(observed,bands,requirements,options);
const serialize=value=>JSON.stringify(value,(_k,v)=>typeof v==='bigint'?v.toString():v);
const eq=(a,b,message)=>assert.equal(cmp(a,b),0,message);
test('173 independent Fraction vertex families retain every original minimum pattern, own optimum and global exact ties',()=>{
 assert.equal(fixture.cases.length,173);let empty=0,zero=0,positive=0,nonattainers=0;
 for(const item of fixture.cases){
  const raw=input(item),before=serialize(raw),actual=run(raw),e=item.expected;
  assert.equal(serialize(raw),before,item.name);assert.equal(actual.analysis.minimumChanges,e.minimumChanges,item.name);
  assert.deepEqual(actual.cases.map(c=>c.patternIndex),e.patterns.map(p=>p.pattern),item.name);
  assert.deepEqual(actual.attainingPatternIndices,e.attainingPatterns,item.name);
  assert.equal(verifyMinimumSkyRelaxation(raw.observed,raw.bands,raw.requirements,actual),true);
  if(e.minimumRelaxation===null){empty++;assert.equal(actual.status,'original-incompatible');assert.equal(actual.minimumRelaxation,null);assert.equal(actual.originalRequirementsCompatible,null);assert.deepEqual(actual.zeroCompatiblePatternIndices,[]);}
  else{
   eq(actual.minimumRelaxation,Q(e.minimumRelaxation),item.name);actual.minimumRelaxation[0]===0n?zero++:positive++;
   assert.equal(actual.status,'minimum-common-relaxation');assert.equal(actual.originalRequirementsCompatible,actual.minimumRelaxation[0]===0n);
   assert.deepEqual(actual.zeroCompatiblePatternIndices,e.patterns.filter(p=>Q(p.optimum)[0]===0n).map(p=>p.pattern));
   for(const [i,c]of actual.cases.entries()){
    eq(c.relaxation.value,Q(e.patterns[i].optimum),item.name);if(cmp(c.relaxation.value,actual.minimumRelaxation)>0)nonattainers++;
    eq(c.relaxation.value,c.relaxation.certificate.point.at(-1));eq(c.relaxation.value,neg(c.relaxation.certificate.value));
    assert.deepEqual(c.relaxation.witness.relaxedRequirementStatuses,['met','met']);
    assert.equal(c.relaxation.witness.phaseProfiles.length,c.splits.length+1);
   }
  }
 }
 assert(empty>0&&zero>0&&positive>0&&nonattainers>0);
});
test('3645 independent closed-form scalar optima and direct witnesses include870 exact zero cases',()=>{
 let count=0,zeros=0;
 for(let ai=0;ai<=4;ai++)for(let bi=ai;bi<=4;bi++)for(let li=-2;li<=6;li++)for(let ui=-2;ui<=6;ui++)for(let wi=0;wi<=2;wi++){
  const [a,b,l,u,w]=[ai,bi,li,ui,wi].map(v=>Q(v+'/4'));
  const bounds=[Z(),add(mul(sub(l,u),Q('1/2')),w),sub(add(a,w),u),add(sub(l,b),w)];
  const expected=bounds.reduce((a,b)=>cmp(a,b)>=0?a:b),mid=mul(add(l,u),Q('1/2')),x=cmp(mid,a)<0?a:cmp(mid,b)>0?b:mid;
  assert(cmp(add(x,w),add(u,expected))<=0);assert(cmp(sub(x,w),sub(l,expected))>=0);
  const band=()=>({lower:{...row(['1','0']),constant:neg(w)},upper:{...row(['1','0']),constant:w}});
  const raw={observed:[row(['1','0'])],bands:[{lower:a,upper:b}],requirements:[{relation:'at-most',limit:u,...band()},{relation:'at-least',limit:l,...band()}]};
  const result=run(raw);eq(result.minimumRelaxation,expected,[ai,bi,li,ui,wi].join(':'));assert.deepEqual(result.attainingPatternIndices,[0]);
  if(expected[0]===0n)zeros++;count++;
 }
 assert.equal(count,3645);assert.equal(zeros,870);
});
test('original class, disjoint tied patterns, nonwinning optima and exact2^-100 conflicts remain separate',()=>{
 const fixed=run(named('fixed-original-minimum'));assert.equal(fixed.analysis.minimumChanges,0);eq(fixed.minimumRelaxation,Q('1/4'));assert.equal(fixed.analysis.unexaminedHigherChangePatterns,1);
 const gap=run(named('tied-pattern-witnesses-cannot-mix'));eq(gap.minimumRelaxation,Q('3/4'));assert.deepEqual(gap.attainingPatternIndices,[1,2]);assert.deepEqual(gap.cases.map(c=>c.splits),[[1],[2]]);
 const tied=run(named('two-tied-attainers-and-two-nonattainers'));assert.deepEqual(tied.attainingPatternIndices,[2,3]);assert.equal(tied.cases.length,4);eq(tied.cases[0].relaxation.value,Q('3/4'));eq(tied.minimumRelaxation,Q('1/4'));
 eq(run(named('whole-interval-is-stronger')).minimumRelaxation,Q('1/2'));
 eq(run(named('tiny-conflict')).minimumRelaxation,[1n,2n**101n]);eq(run(named('touch')).minimumRelaxation,Z());eq(run(named('tiny-overlap')).minimumRelaxation,Z());
 eq(run(named('constant-only-required-relaxation')).minimumRelaxation,Q(1));
 const subnormal=named('touch');subnormal.requirements[0].limit=Q(0);subnormal.requirements[1].limit=[1n,2n**1074n];
 const tiny=run(subnormal);eq(tiny.minimumRelaxation,[1n,2n**1075n]);assert.equal(tiny.originalRequirementsCompatible,false);assert.deepEqual(tiny.zeroCompatiblePatternIndices,[]);
 for(const name of ['touch','tiny-conflict','tiny-overlap','both-tied-patterns-jointly-admitted','tied-pattern-witnesses-cannot-mix']){
  const raw=named(name),r=run(raw),j=testMinimumSkyRequirements(raw.observed,raw.bands,raw.requirements);assert.deepEqual(r.zeroCompatiblePatternIndices,j.jointPatternIndices);
 }
});
test('coupled three-bin coordinates, common Celsius scale/offset and endpoint order use the original polytope',()=>{
 const observed=[{constant:Z(),coefficients:[[Z(),Z(),Z()],[Z(),Z(),Z()]]}],bands=[{lower:Z(),upper:Z()}];
 const endpoint=bin=>({constant:Z(),coefficients:[[bin===0?Q(1):Z(),bin===1?Q(1):Z(),Z()],[Z(),Z(),Z()]]});
 const requirements=[0,1].map(bin=>({relation:'at-least',limit:Q('3/4'),lower:endpoint(bin),upper:endpoint(bin)}));
 const coupled=minimizeMinimumSkyRelaxation(observed,bands,requirements);eq(coupled.minimumRelaxation,Q('1/4'));
 eq(coupled.cases[0].relaxation.witness.phaseProfiles[0][1],Q('1/2'));eq(coupled.cases[0].relaxation.witness.phaseProfiles[0][2],Q('1/2'));
 for(const scale of ['1/3','2','7/2'])for(const shift of ['-2','0','3/5']){
  const raw=named('two-tied-attainers-and-two-nonattainers'),s=Q(scale),h=Q(shift);
  for(const r of raw.requirements){r.limit=add(mul(r.limit,s),h);for(const side of ['lower','upper']){r[side].constant=add(mul(r[side].constant,s),h);r[side].coefficients=r[side].coefficients.map(v=>v.map(x=>mul(x,s)));}}
  const result=run(raw);eq(result.minimumRelaxation,mul(Q('1/4'),s));assert.deepEqual(result.attainingPatternIndices,[2,3]);
 }
 const raw={observed:[row(['0','0'])],bands:[{lower:Z(),upper:Z()}],requirements:[{relation:'at-most',limit:Z(),lower:row(['2','0']),upper:row(['1','0'],'1/4')},{relation:'at-most',limit:Q(1),lower:row(['0','1']),upper:row(['0','1'])}]};
 assert.throws(()=>run(raw),/unordered/);raw.observed=[row(['1','0'])];raw.bands=[{lower:Z(),upper:Q('1/4')}];eq(run(raw).cases[0].endpointOrder.tests[0].maximumDifference,Z());
 raw.bands[0].upper=add(Q('1/4'),[1n,2n**100n]);assert.throws(()=>run(raw),/unordered/);
});
test('augmented signs, objective, delta coordinate, exact common profiles, every optimum and ties resist semantic forgeries',()=>{
 const raw=named('two-tied-attainers-and-two-nonattainers'),result=run(raw);
 const mutations=[
  r=>r.analysis.minimumChanges=0,r=>r.analysis.cases.pop(),r=>r.cases.pop(),r=>r.cases[0].patternIndex=99,
  r=>r.requirements[0].limit=Q(99),r=>r.cases[0].targetProjection[0].upper.constant=Q(3),
  r=>r.cases[0].endpointOrder.tests[0].maximumDifference=Q(1),r=>r.cases[0].endpointOrder.tests[0].certificate.dual[0]=Q(-1),
  r=>r.cases[0].relaxation.linearModel.rows[0].pop(),r=>r.cases[0].relaxation.linearModel.rows.at(-1)[0]=Q(100),
  r=>r.cases[0].relaxation.linearModel.rows.at(-1)[r.cases[0].relaxation.linearModel.rows.at(-1).length-1]=Q(1),
  r=>r.cases[0].relaxation.linearModel.bounds[0]=Q(2),r=>r.cases[0].relaxation.certificate.value=Q(1),
  r=>r.cases[0].relaxation.certificate.point[r.cases[0].relaxation.certificate.point.length-1]=Q(0),
  r=>r.cases[0].relaxation.certificate.dual[0]=Q(-1),r=>r.cases[0].relaxation.value=Q(0),
  r=>r.cases[0].relaxation.witness.relaxation=Q(0),r=>r.cases[0].relaxation.witness.phaseProfiles[0][0]=Q(2),
  r=>r.cases[0].relaxation.witness.productMasses[0]=Q(2),r=>r.cases[0].relaxation.witness.observedC[0]=Q(2),
  r=>r.cases[0].relaxation.witness.targetPairs[0].upper=Q(2),r=>r.cases[0].relaxation.witness.relaxedLimits[0]=Q(99),
  r=>r.cases[0].relaxation.witness.requirementStatuses[0]='met',r=>r.cases[0].relaxation.witness.relaxedRequirementStatuses[0]='not-met',
  r=>r.cases[0].relaxation.witness.bindingRequirementIndices=[],r=>r.minimumRelaxation=Q(0),
  r=>r.attainingPatternIndices.pop(),r=>r.zeroCompatiblePatternIndices=[2],r=>r.originalRequirementsCompatible=true,
  r=>r.work.solves--,r=>r.work.rationalOperations--,r=>r.cases[0].relaxation.work.constraints--
 ];
 for(const change of mutations){const forged=structuredClone(result);change(forged);assert.throws(()=>verifyMinimumSkyRelaxation(raw.observed,raw.bands,raw.requirements,forged));}
 const emptyRaw=named('original-family-empty'),empty=run(emptyRaw);empty.minimumRelaxation=Q(0);assert.throws(()=>verifyMinimumSkyRelaxation(emptyRaw.observed,emptyRaw.bands,emptyRaw.requirements,empty));
});
test('inference plus all order and relaxation solves share one budget; strict complete inputs refuse without mutation',()=>{
 const raw=named('two-tied-attainers-and-two-nonattainers'),before=serialize(raw),result=run(raw),n=result.cases.length;
 assert.equal(result.work.solves,result.analysis.work.solves+2*n);assert.equal(result.work.objectives,3*n);
 assert.equal(result.work.verifiedCertificates,result.analysis.work.verifiedCertificates+5*n);
 assert.throws(()=>run(raw,{maxRationalOperations:result.work.rationalOperations-1}),/allowance/);
 assert.throws(()=>run(raw,{maxPivots:result.work.pivots-1}),/allowance/);assert.throws(()=>run(raw,{maxRationalOperations:0}),/allowance/);
 assert.equal(serialize(raw),before);
 for(const mutate of [r=>r.requirements.pop(),r=>r.requirements.push(r.requirements[0]),r=>r.requirements[0].relation='some',
  r=>r.requirements[0].limit=[1n,0n],r=>r.requirements[0].limit=[2n**4097n,1n],r=>r.requirements[0].lower.coefficients.pop(),
  r=>r.requirements[0].lower.coefficients[0].pop(),r=>r.requirements[0].savedWitness={},r=>delete r.requirements[0].upper.coefficients[0]]){
  const changed=structuredClone(raw);mutate(changed);assert.throws(()=>run(changed));
 }
});
