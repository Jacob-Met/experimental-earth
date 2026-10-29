import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compareMinimumSkyCoverage,verifyMinimumSkyCoverage} from '../shade-heat-sky-coverage.js';
import {add,sub,mul,cmp,neg} from '../vendor/chronos/exact-halfplanes.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./sky-coverage-oracles.json',import.meta.url),'utf8'));
const Q=value=>{const [n,d='1']=String(value).split('/');return [BigInt(n),BigInt(d)];};
const Z=()=>Q(0),row=(coefficients,constant='0')=>({constant:Q(constant),coefficients:coefficients.map(v=>[Q(v),Z(),Z()])});
function input(item){return {observed:item.observations.map(o=>row(o.coefficients)),bands:item.observations.map(o=>({lower:Q(o.lower),upper:Q(o.upper)})),
 requirements:item.requirements.map(r=>({relation:r.relation,limit:Q(r.limit),lower:row(r.lower.coefficients,r.lower.constant),upper:row(r.upper.coefficients,r.upper.constant)}))};}
const named=name=>{const item=fixture.cases.find(c=>c.name===name);assert(item,name);return {item,...input(item)};};
const run=({observed,bands,requirements},options={})=>compareMinimumSkyCoverage(observed,bands,requirements,options);
const serialize=value=>JSON.stringify(value,(_k,v)=>typeof v==='bigint'?v.toString():v);
const eq=(a,b,message)=>assert.equal(cmp(a,b),0,message);
test('176 independent Fraction families retain original inference, both existential and universal extrema and every exact tie',()=>{
 assert.equal(fixture.cases.length,176);let empty=0,strict=0,floorOnly=0,contacts=0;
 for(const item of fixture.cases){
  const raw=input(item),before=serialize(raw),r=run(raw),e=item.expected;
  assert.equal(serialize(raw),before,item.name);assert.equal(r.minimum.analysis.minimumChanges,e.some.minimumChanges,item.name);
  assert.deepEqual(r.cases.map(c=>c.patternIndex),e.all.patterns.map(p=>p.id),item.name);
  assert(verifyMinimumSkyCoverage(raw.observed,raw.bands,raw.requirements,r));
  if(e.all.allProfileRelaxation===null){
   empty++;assert.equal(r.status,'original-incompatible');for(const key of ['someProfileRelaxation','allProfileRelaxation','rawMaximumViolation','coverageGap','allProfilesMeetOriginal','floorActive','floorOnly'])assert.equal(r[key],null);
   assert.deepEqual(r.controllingPairs,[]);assert.deepEqual(r.rawMaximumPairs,[]);assert.deepEqual(r.allProfileAttainingPatternIndices,[]);
  }else{
   assert.equal(r.status,'compared-common-relaxations');eq(r.someProfileRelaxation,Q(e.some.minimumRelaxation),item.name);eq(r.allProfileRelaxation,Q(e.all.allProfileRelaxation),item.name);
   eq(r.rawMaximumViolation,Q(e.rawMaximumViolation),item.name);eq(r.coverageGap,sub(r.allProfileRelaxation,r.someProfileRelaxation));assert(cmp(r.coverageGap,Z())>=0);
   if(r.coverageGap[0]>0n)strict++;if(r.floorOnly)floorOnly++;if(r.floorActive&&!r.floorOnly)contacts++;
   assert.equal(r.floorOnly,e.floorOnly);assert.equal(r.floorActive,e.all.floorActive);assert.equal(r.allProfilesMeetOriginal,r.allProfileRelaxation[0]===0n);
   assert.deepEqual(r.rawMaximumPairs,e.rawMaximumPairs.map(x=>({patternIndex:x.pattern,requirementIndex:x.requirement})));
   assert.deepEqual(r.controllingPairs,e.all.controllingPairs.map(x=>({patternIndex:x.pattern,requirementIndex:x.requirement})));
   assert.deepEqual(r.allProfileAttainingPatternIndices,e.all.attainingPatterns);
   for(const [i,c]of r.cases.entries()){
    const p=e.all.patterns[i];eq(c.allProfileRelaxation,Q(p.allProfileRelaxation));
    const maxima=p.requirements.map(x=>Q(x.signedMaximum)),rawMax=maxima.reduce((a,b)=>cmp(a,b)>=0?a:b);eq(c.rawMaximumViolation,rawMax);
    assert.deepEqual(c.rawMaximumRequirementIndices,maxima.flatMap((m,j)=>cmp(m,rawMax)===0?[j]:[]));
    assert.deepEqual(c.bindingRequirementIndices,maxima.flatMap((m,j)=>cmp(m,c.allProfileRelaxation)===0?[j]:[]));
    for(const [j,t]of c.tests.entries()){
     assert.equal(t.requirementIndex,j);eq(t.maximumViolation,maxima[j]);eq(t.witness.violations[j],maxima[j]);
     assert.equal(t.certificate.point.length,3*(c.splits.length+1));assert.equal(t.witness.phaseProfiles.length,c.splits.length+1);
     assert(cmp(t.witness.requiredRelaxation,c.allProfileRelaxation)<=0);assert(cmp(t.witness.requiredRelaxation,r.minimum.cases[i].relaxation.value)>=0);
    }
   }
  }
 }
 assert(empty>0&&strict>0&&floorOnly>0&&contacts>0);
});
test('3645 independent scalar bounds separate495 universal zeros,2155 strict gaps and240 floor-only zero cases',()=>{
 let count=0,zeros=0,gaps=0,floorOnly=0;
 for(let ai=0;ai<=4;ai++)for(let bi=ai;bi<=4;bi++)for(let li=-2;li<=6;li++)for(let ui=-2;ui<=6;ui++)for(let wi=0;wi<=2;wi++){
  const [a,b,l,u,w]=[ai,bi,li,ui,wi].map(v=>Q(v+'/4'));
  const rawMaxima=[sub(add(b,w),u),add(sub(l,a),w)],rawMaximum=rawMaxima.reduce((a,b)=>cmp(a,b)>=0?a:b),all=cmp(rawMaximum,Z())<0?Z():rawMaximum;
  const some=[Z(),add(mul(sub(l,u),Q('1/2')),w),sub(add(a,w),u),add(sub(l,b),w)].reduce((a,b)=>cmp(a,b)>=0?a:b);
  const band=()=>({lower:{...row(['1','0']),constant:neg(w)},upper:{...row(['1','0']),constant:w}});
  const input={observed:[row(['1','0'])],bands:[{lower:a,upper:b}],requirements:[{relation:'at-most',limit:u,...band()},{relation:'at-least',limit:l,...band()}]};
  const r=run(input);eq(r.someProfileRelaxation,some);eq(r.allProfileRelaxation,all);eq(r.rawMaximumViolation,rawMaximum);
  eq(r.cases[0].tests[0].witness.phaseProfiles[0][1],b);eq(r.cases[0].tests[1].witness.phaseProfiles[0][1],a);
  assert.deepEqual(r.controllingPairs,rawMaxima.flatMap((v,j)=>cmp(v,all)===0?[{patternIndex:0,requirementIndex:j}]:[]));
  if(all[0]===0n)zeros++;if(cmp(some,all)<0)gaps++;if(rawMaximum[0]<0n)floorOnly++;count++;
 }
 assert.equal(count,3645);assert.equal(zeros,495);assert.equal(gaps,2155);assert.equal(floorOnly,240);
});
test('negative signed maxima, exact contacts, subnormal positives and role-specific pattern ties stay distinct',()=>{
 const slack=run(named('universal-strict-slack'));eq(slack.rawMaximumViolation,Q('-1/4'));eq(slack.allProfileRelaxation,Z());assert.equal(slack.floorOnly,true);
 assert.deepEqual(slack.rawMaximumPairs,[{patternIndex:0,requirementIndex:0},{patternIndex:0,requirementIndex:1}]);assert.deepEqual(slack.controllingPairs,[]);assert.deepEqual(slack.allProfileAttainingPatternIndices,[0]);
 const contact=run(named('universal-exact-contact'));eq(contact.rawMaximumViolation,Z());assert.equal(contact.floorOnly,false);assert.equal(contact.controllingPairs.length,2);
 const tiny=run(named('universal-subnormal-positive'));eq(tiny.someProfileRelaxation,Z());eq(tiny.allProfileRelaxation,[1n,2n**1075n]);assert.equal(tiny.allProfilesMeetOriginal,false);assert.equal(tiny.floorActive,false);
 const tied=run(named('two-tied-attainers-and-two-nonattainers'));assert.deepEqual(tied.minimum.attainingPatternIndices,[2,3]);assert.deepEqual(tied.allProfileAttainingPatternIndices,[1,4]);
 eq(tied.someProfileRelaxation,Q('1/4'));eq(tied.allProfileRelaxation,Q('3/4'));assert.deepEqual(tied.controllingPairs,[{patternIndex:1,requirementIndex:0},{patternIndex:4,requirementIndex:1}]);
 const gap=run(named('tied-pattern-witnesses-cannot-mix'));eq(gap.someProfileRelaxation,Q('3/4'));eq(gap.allProfileRelaxation,Q('3/4'));assert.deepEqual(gap.allProfileAttainingPatternIndices,[1,2]);
 eq(run(named('whole-interval-is-stronger')).allProfileRelaxation,Q(1));
});
test('coupled coordinates require separate maximizing profiles; common units preserve bounds and original endpoint order',()=>{
 const observed=[{constant:Z(),coefficients:[[Q(1),Q(1),Z()],[Z(),Z(),Z()]]}],bands=[{lower:Q(1),upper:Q(1)}];
 const endpoint=bin=>({constant:Z(),coefficients:[[bin===0?Q(1):Z(),bin===1?Q(1):Z(),Z()],[Z(),Z(),Z()]]});
 const requirements=[0,1].map(bin=>({relation:'at-least',limit:Q('3/4'),lower:endpoint(bin),upper:endpoint(bin)}));
 const r=compareMinimumSkyCoverage(observed,bands,requirements);eq(r.someProfileRelaxation,Q('1/4'));eq(r.allProfileRelaxation,Q('3/4'));
 const a=r.cases[0].tests[0].witness.phaseProfiles[0],b=r.cases[0].tests[1].witness.phaseProfiles[0];eq(a[1],Z());eq(a[2],Q(1));eq(b[1],Q(1));eq(b[2],Z());
 for(const scale of ['1/3','2','7/2'])for(const shift of ['-2','0','3/5']){
  const raw=named('two-tied-attainers-and-two-nonattainers'),s=Q(scale),h=Q(shift);
  for(const t of raw.requirements){t.limit=add(mul(t.limit,s),h);for(const side of ['lower','upper']){t[side].constant=add(mul(t[side].constant,s),h);t[side].coefficients=t[side].coefficients.map(v=>v.map(x=>mul(x,s)));}}
  const actual=run(raw);eq(actual.someProfileRelaxation,mul(Q('1/4'),s));eq(actual.allProfileRelaxation,mul(Q('3/4'),s));assert.deepEqual(actual.allProfileAttainingPatternIndices,[1,4]);
 }
 const raw={observed:[row(['0','0'])],bands:[{lower:Z(),upper:Z()}],requirements:[{relation:'at-most',limit:Z(),lower:row(['2','0']),upper:row(['1','0'],'1/4')},{relation:'at-most',limit:Q(1),lower:row(['0','1']),upper:row(['0','1'])}]};
 assert.throws(()=>run(raw),/unordered/);raw.observed=[row(['1','0'])];raw.bands=[{lower:Z(),upper:Q('1/4')}];assert.equal(run(raw).cases.length,1);
 raw.bands[0].upper=add(Q('1/4'),[1n,2n**100n]);assert.throws(()=>run(raw),/unordered/);
});
test('original-polytope residual optima, witnesses, constants, all ties and floor semantics resist independent field forgeries',()=>{
 const raw=named('two-tied-attainers-and-two-nonattainers'),result=run(raw);
 const mutations=[
  r=>r.minimum.minimumRelaxation=Q(0),r=>r.minimum.cases.pop(),r=>r.cases.pop(),r=>r.cases[0].patternIndex=99,
  r=>r.cases[0].targetProjection[0].limit=Q(99),r=>r.cases[0].linearModel.rows[0].push(Z()),
  r=>r.cases[0].linearModel.rows[0][0]=Q(99),r=>r.cases[0].linearModel.bounds[0]=Q(99),
  r=>r.cases[0].tests.pop(),r=>r.cases[0].tests[0].requirementIndex=1,
  r=>r.cases[0].tests[0].maximumViolation=Q(99),r=>r.cases[0].tests[0].certificate.value=Q(99),
  r=>r.cases[0].tests[0].certificate.point[0]=Q(7),r=>r.cases[0].tests[0].certificate.point.push(Z()),r=>r.cases[0].tests[0].certificate.dual[0]=Q(-1),
  r=>r.cases[0].tests[0].witness.requirementIndex=1,r=>r.cases[0].tests[0].witness.maximumViolation=Q(99),
  r=>r.cases[0].tests[0].witness.phaseProfiles[0][0]=Q(2),r=>r.cases[0].tests[0].witness.productMasses[0]=Q(2),
  r=>r.cases[0].tests[0].witness.observedC[0]=Q(2),r=>r.cases[0].tests[0].witness.targetPairs[0].upper=Q(99),
  r=>r.cases[0].tests[0].witness.violations[0]=Q(99),r=>r.cases[0].tests[0].witness.requiredRelaxation=Q(99),
  r=>r.cases[0].tests[0].witness.requirementStatuses[0]='met',
  r=>r.cases[0].rawMaximumViolation=Q(99),r=>r.cases[0].allProfileRelaxation=Q(0),
  r=>r.cases[0].rawMaximumRequirementIndices=[],r=>r.cases[0].bindingRequirementIndices=[],
  r=>r.cases[0].floorActive=true,r=>r.cases[0].floorOnly=true,
  r=>r.someProfileRelaxation=Q(0),r=>r.allProfileRelaxation=Q(0),r=>r.rawMaximumViolation=Q(0),r=>r.coverageGap=Q(0),
  r=>r.allProfilesMeetOriginal=true,r=>r.floorActive=true,r=>r.floorOnly=true,
  r=>r.rawMaximumPairs.pop(),r=>r.controllingPairs.pop(),r=>r.allProfileAttainingPatternIndices.pop(),r=>r.zeroCoverPatternIndices=[99],
  r=>r.work.solves--,r=>r.work.coverageObjectives--,r=>r.work.rationalOperations--,r=>r.cases[0].work.constraints--
 ];
 for(const change of mutations){const forged=structuredClone(result);change(forged);assert.throws(()=>verifyMinimumSkyCoverage(raw.observed,raw.bands,raw.requirements,forged));}
 const safe=named('universal-strict-slack'),slack=run(safe);slack.controllingPairs=[{patternIndex:0,requirementIndex:0}];assert.throws(()=>verifyMinimumSkyCoverage(safe.observed,safe.bands,safe.requirements,slack));
 const empty=named('original-family-empty'),none=run(empty);none.allProfileRelaxation=Q(0);assert.throws(()=>verifyMinimumSkyCoverage(empty.observed,empty.bands,empty.requirements,none));
});
test('one original inference and all five objectives per pattern share the existing budget and strict admission',()=>{
 const raw=named('two-tied-attainers-and-two-nonattainers'),before=serialize(raw),r=run(raw),n=r.cases.length;
 assert.equal(r.work.solves,r.minimum.analysis.work.solves+3*n);assert.equal(r.work.objectives,5*n);assert.equal(r.work.verifiedCertificates,r.minimum.analysis.work.verifiedCertificates+8*n);
 assert.equal(r.work.coverageSolves,n);assert.equal(r.work.coverageObjectives,2*n);assert(r.work.rationalOperations>r.minimum.work.rationalOperations);
 assert.throws(()=>run(raw,{maxRationalOperations:r.work.rationalOperations-1}),/allowance/);assert.throws(()=>run(raw,{maxPivots:r.work.pivots-1}),/allowance/);
 assert.throws(()=>run(raw,{maxRationalOperations:0}),/allowance/);assert.equal(serialize(raw),before);
 for(const mutate of [r=>r.requirements.pop(),r=>r.requirements.push(r.requirements[0]),r=>r.requirements[0].relation='some',
  r=>r.requirements[0].limit=[1n,0n],r=>r.requirements[0].limit=[2n**4097n,1n],r=>r.requirements[0].lower.coefficients.pop(),
  r=>r.requirements[0].lower.coefficients[0].pop(),r=>r.requirements[0].savedWitness={},r=>delete r.requirements[0].upper.coefficients[0]]){
  const changed=structuredClone(raw);mutate(changed);assert.throws(()=>run(changed));
 }
});
