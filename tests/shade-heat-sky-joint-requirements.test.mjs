import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {testMinimumSkyRequirements,verifyMinimumSkyRequirements} from '../shade-heat-sky-joint-requirements.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./sky-joint-requirement-oracles.json',import.meta.url),'utf8'));
const Q=value=>{const [n,d='1']=String(value).split('/');return [BigInt(n),BigInt(d)];};
const zero=()=>Q(0),row=(coefficients,constant='0')=>({constant:Q(constant),coefficients:coefficients.map(v=>[Q(v),zero(),zero()])});
function input(item){return {observed:item.observations.map(o=>row(o.coefficients)),bands:item.observations.map(o=>({lower:Q(o.lower),upper:Q(o.upper)})),
 requirements:item.requirements.map(r=>({relation:r.relation,limit:Q(r.limit),lower:row(r.lower.coefficients,r.lower.constant),upper:row(r.upper.coefficients,r.upper.constant)}))};}
const named=name=>{const item=fixture.cases.find(c=>c.name===name);assert(item,name);return {item,...input(item)};};
const run=({observed,bands,requirements},options={})=>testMinimumSkyRequirements(observed,bands,requirements,options);
const serialize=value=>JSON.stringify(value,(_k,v)=>typeof v==='bigint'?v.toString():v);
test('171 independent Fraction vertex families retain the original minimum class, every individual pattern and all common joint patterns',()=>{
 assert.equal(fixture.cases.length,171);let originalEmpty=0,jointCompatible=0,jointIncompatible=0;
 for(const item of fixture.cases){
  const raw=input(item),before=serialize(raw),actual=run(raw),expected=item.expected;
  assert.equal(serialize(raw),before,item.name);assert.equal(actual.analysis.minimumChanges,expected.minimumChanges,item.name);
  assert.deepEqual(actual.cases.map(c=>c.patternIndex),expected.minimumPatterns,item.name);
  assert.deepEqual(actual.jointPatternIndices,expected.joint.filter(c=>c.feasible).map(c=>c.pattern),item.name);
  assert.equal(verifyMinimumSkyRequirements(raw.observed,raw.bands,raw.requirements,actual),true);
  if(expected.minimumChanges===null){originalEmpty++;assert.equal(actual.status,'original-incompatible');assert.equal(actual.individual,null);assert.deepEqual(actual.cases,[]);}
  else{
   for(const i of [0,1])assert.deepEqual(actual.individual[i].patternIndices,expected.individual[i].patterns.filter(c=>c.feasible).map(c=>c.pattern),item.name);
   if(actual.jointPatternIndices.length){jointCompatible++;assert.equal(actual.status,'joint-compatible');}else{jointIncompatible++;assert.equal(actual.status,'joint-incompatible');}
   for(const c of actual.cases){assert.equal(c.individual.length,2);for(const result of [...c.individual,c.joint]){
    assert.equal(result.witness===null,result.status==='incompatible');
    if(result.witness)for(const index of result.requirementIndices)assert.equal(result.witness.requirementStatuses[index],'met');
   }}
  }
 }
 assert(originalEmpty>0&&jointCompatible>0&&jointIncompatible>0);
});
test('individually feasible witnesses cannot change the original minimum class or mix tied pattern identities',()=>{
 const staticInput=named('fixed-original-minimum'),a=run(staticInput);
 assert.equal(a.analysis.minimumChanges,0);assert.deepEqual(a.individual.map(r=>r.patternIndices),[[0],[0]]);assert.deepEqual(a.jointPatternIndices,[]);
 assert.equal(a.analysis.cases.length,1);assert.equal(a.analysis.unexaminedHigherChangePatterns,1);
 assert.equal(staticInput.item.expected.higherClassDiagnostic[0].feasible,true);
 const b=run(named('tied-pattern-witnesses-cannot-mix'));assert.equal(b.analysis.minimumChanges,1);assert.deepEqual(b.individual.map(r=>r.patternIndices),[[2],[1]]);assert.deepEqual(b.jointPatternIndices,[]);
 assert.deepEqual(b.cases.map(c=>c.splits),[[1],[2]]);assert(b.cases.every(c=>c.joint.certificate.status==='incompatible'&&c.joint.certificate.contradiction[0]<0n));
 const positive=run(named('both-tied-patterns-jointly-admitted'));assert.deepEqual(positive.jointPatternIndices,[1,2]);assert(positive.cases.every(c=>c.joint.witness.requirementStatuses.every(s=>s==='met')));
 const individual=run(named('one-individual-impossible'));assert.equal(individual.individual[0].status,'incompatible');assert.equal(individual.individual[1].status,'compatible');
});
test('whole-interval requirements use the correct paired endpoints and distinguish exact2^-100 contact',()=>{
 const raw=named('whole-interval-is-stronger'),actual=run(raw);
 assert.equal(raw.item.someEndpointDiagnostic.joint[0].feasible,true);assert.equal(actual.status,'joint-incompatible');assert(actual.individual.every(r=>r.status==='compatible'));
 for(const [name,status]of [['touch','joint-compatible'],['tiny-conflict','joint-incompatible'],['tiny-overlap','joint-compatible']])assert.equal(run(named(name)).status,status);
 assert.throws(()=>run(raw,{interpretation:'some'}),/Unsupported/);
});
test('endpoint order is proved on every original-compatible profile before favorable target restrictions',()=>{
 const observed=[row(['0','0'])],bands=[{lower:Q(0),upper:Q(0)}];
 const crossed={relation:'at-most',limit:Q(0),lower:row(['2','0']),upper:row(['1','0'],'1/4')};
 const requirements=[crossed,{relation:'at-most',limit:Q(1),lower:row(['0','1']),upper:row(['0','1'])}];
 assert.throws(()=>testMinimumSkyRequirements(observed,bands,requirements),/unordered/);
 const restricted=[row(['1','0'])],limits=[{lower:Q(0),upper:Q('1/4')}];
 const valid=testMinimumSkyRequirements(restricted,limits,requirements);assert.equal(valid.cases[0].endpointOrder.tests[0].maximumDifference[0],0n);
 const epsilon=2n**100n;
 limits[0].upper=[epsilon/4n+1n,epsilon];assert.throws(()=>testMinimumSkyRequirements(restricted,limits,requirements),/unordered/);
 limits[0].upper=[epsilon/4n-1n,epsilon];assert.equal(testMinimumSkyRequirements(restricted,limits,requirements).status,'joint-incompatible');
});
test('original matrices, all pattern identities, pointwise proofs, common profiles and work resist independent field forgeries',()=>{
 const raw=named('both-tied-patterns-jointly-admitted'),result=run(raw);
 const mutations=[
  r=>r.analysis.minimumChanges=0,r=>r.analysis.cases.pop(),r=>r.cases.pop(),r=>r.cases[0].patternIndex=99,
  r=>r.cases[0].targetProjection[0].upper.constant=Q(3),r=>r.requirements[0].relation='at-least',
  r=>r.cases[0].endpointOrder.tests[0].maximumDifference=Q(1),r=>r.cases[0].endpointOrder.tests[0].certificate.dual[0]=Q(-1),
  r=>r.cases[0].individual[0].requirementIndices=[1],r=>r.cases[0].joint.linearModel.bounds[0]=Q(2),
  r=>r.cases[0].joint.linearModel.rows.at(-1)[0]=Q(100),r=>r.cases[0].joint.certificate.point[0]=Q(2),
  r=>r.cases[0].joint.witness.phaseProfiles[0][0]=Q(2),r=>r.cases[0].joint.witness.productMasses[0]=Q(2),
  r=>r.cases[0].joint.witness.observedC[0]=Q(2),r=>r.cases[0].joint.witness.targetPairs[0].upper=Q(2),
  r=>r.cases[0].joint.witness.requirementStatuses[0]='not-met',r=>r.cases[0].individual.pop(),
  r=>r.individual[0].patternIndices.pop(),r=>r.jointPatternIndices.pop(),r=>r.status='joint-incompatible',
  r=>r.work.solves--,r=>r.work.rationalOperations--,r=>r.cases[0].joint.work.constraints--
 ];
 for(const change of mutations){const forged=structuredClone(result);change(forged);assert.throws(()=>verifyMinimumSkyRequirements(raw.observed,raw.bands,raw.requirements,forged));}
 const impossibleRaw=named('tied-pattern-witnesses-cannot-mix'),impossible=run(impossibleRaw);
 for(const change of [r=>r.cases[0].joint.certificate.dual[0]=Q(-1),r=>r.cases[0].joint.certificate.contradiction=Q(0),r=>r.cases[0].joint.witness={}]){
  const forged=structuredClone(impossible);change(forged);assert.throws(()=>verifyMinimumSkyRequirements(impossibleRaw.observed,impossibleRaw.bands,impossibleRaw.requirements,forged));
 }
});
test('all new solves share the inference work ceiling; malformed complete requirements refuse without source mutation',()=>{
 const raw=named('both-tied-patterns-jointly-admitted'),before=serialize(raw),result=run(raw);
 assert.equal(result.work.solves,result.analysis.work.solves+4*result.cases.length);
 assert.equal(result.work.objectives,2*result.cases.length);assert.equal(result.work.verifiedCertificates,result.analysis.work.verifiedCertificates+6*result.cases.length);
 assert.throws(()=>run(raw,{maxRationalOperations:result.work.rationalOperations-1}),/allowance/);
 assert.throws(()=>run(raw,{maxPivots:result.work.pivots-1}),/allowance/);
 assert.throws(()=>run(raw,{maxRationalOperations:0}),/allowance/);
 assert.equal(serialize(raw),before);
 for(const mutate of [r=>r.requirements.pop(),r=>r.requirements.push(r.requirements[0]),r=>r.requirements[0].relation='some',
  r=>r.requirements[0].limit=[1n,0n],r=>r.requirements[0].limit=[2n**4097n,1n],r=>r.requirements[0].lower.coefficients.pop(),
  r=>r.requirements[0].lower.coefficients[0].pop(),r=>r.requirements[0].savedWitness={}]){
  const changed=structuredClone(raw);mutate(changed);assert.throws(()=>run(changed));
 }
});
