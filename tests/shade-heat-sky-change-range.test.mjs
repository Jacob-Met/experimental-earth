import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rational as q,cmp,add} from '../vendor/chronos/exact-halfplanes.mjs';
import {rangeMinimumSkyChanges,verifyMinimumSkyChangeRange} from '../shade-heat-sky-change-range.js';
const ZERO=q(0),ONE=q(1),Q=s=>{const[a,b='1']=String(s).split('/');return[BigInt(a),BigInt(b)];};
const row=values=>({constant:ZERO,coefficients:values.map(v=>[Q(v),ZERO,ZERO])});
const band=(a,b=a)=>({lower:Q(a),upper:Q(b)});
const pair=r=>({lower:structuredClone(r),upper:structuredClone(r)});
const eq=(a,b,m)=>assert.equal(cmp(a,b),0,m);
test('164 independent Fraction vertex extrema retain every minimum-pattern endpoint tie',async()=>{
 const oracle=JSON.parse(await readFile(new URL('./sky-change-range-oracles.json',import.meta.url),'utf8'));assert.equal(oracle.cases.length,164);
 let ties=0,incompatible=0,widths=0;
 for(const c of oracle.cases){
  const observed=c.observations.map(v=>row(v.coefficients)),bands=c.observations.map(v=>band(v.lower,v.upper)),target=pair(row(c.target));
  const result=rangeMinimumSkyChanges(observed,bands,target);assert.equal(result.analysis.minimumChanges,c.minimumChanges,c.name);assert.equal(verifyMinimumSkyChangeRange(observed,bands,target,structuredClone(result)),true);
  if(c.expected.lower===null){assert.equal(result.status,'incompatible');assert.equal(result.lower,null);assert.equal(result.upper,null);assert.deepEqual(result.components,[]);incompatible++;continue;}
  eq(result.lower,Q(c.expected.lower),c.name);eq(result.upper,Q(c.expected.upper),c.name);
  assert.deepEqual(result.lowerPatternIndices.map(i=>result.analysis.cases[i].splits),c.expected.lowerPatterns);
  assert.deepEqual(result.upperPatternIndices.map(i=>result.analysis.cases[i].splits),c.expected.upperPatterns);
  if(result.lowerPatternIndices.length>1||result.upperPatternIndices.length>1)ties++;
  if(cmp(result.lower,result.upper)<0)widths++;
 }
 assert.equal(ties,21);assert.ok(incompatible>0&&widths>0);
});
test('a feasible example is not a consequence range and exact constants translate both extrema',()=>{
 const observed=[row([1,0,0])],bands=[band('1/4','3/4')],target=pair(row([2,0,0]));target.lower.constant=target.upper.constant=Q(-2);
 const result=rangeMinimumSkyChanges(observed,bands,target);eq(result.lower,Q('-3/2'));eq(result.upper,Q('-1/2'));
 eq(result.ranges[0].lower.witness.phaseProfiles[0][1],Q('1/4'));eq(result.ranges[0].upper.witness.phaseProfiles[0][1],Q('3/4'));
 const shifted=structuredClone(target);shifted.lower.constant=add(shifted.lower.constant,Q('7/3'));shifted.upper.constant=add(shifted.upper.constant,Q('7/3'));
 const next=rangeMinimumSkyChanges(observed,bands,shifted);eq(next.lower,add(result.lower,Q('7/3')));eq(next.upper,add(result.upper,Q('7/3')));
});
test('pointwise endpoint order is proved on original feasible profiles, including exact2^-100 contact distinctions',()=>{
 const observed=[row([1,0,0])],target={lower:row([2,0,0]),upper:row([1,0,0])};target.upper.constant=Q('1/4');
 assert.throws(()=>rangeMinimumSkyChanges(observed,[band(0,1)],target),/ordered/);
 const repaired=rangeMinimumSkyChanges(observed,[band(0,'1/4')],target);eq(repaired.ranges[0].endpointOrder.maximumDifference,ZERO);
 assert.throws(()=>rangeMinimumSkyChanges(observed,[band('3/10','2/5')],target),/ordered/);
 const den=2n**100n,quarter=den/4n;
 for(const offset of [-1n,0n,1n]){
  const bands=[{lower:ZERO,upper:[quarter+offset,den]}];
  if(offset>0n)assert.throws(()=>rangeMinimumSkyChanges(observed,bands,target),/ordered/);
  else{const r=rangeMinimumSkyChanges(observed,bands,target);eq(r.ranges[0].endpointOrder.maximumDifference,[offset,den]);}
 }
 const overlaps=pair(row([1,0,0]));overlaps.upper.constant=Q('1/10');
 const valid=rangeMinimumSkyChanges(observed,[band(0,1)],overlaps);eq(valid.ranges[0].endpointOrder.maximumDifference,Q('-1/10'));
});
test('the same original record can leave a positive gap between its two compatible minimum patterns',()=>{
 const observed=[row([1,0,0]),row([0,0,1])],bands=[band(0,'1/4'),band('3/4',1)],target=pair(row([0,1,0]));
 const result=rangeMinimumSkyChanges(observed,bands,target);assert.equal(result.analysis.minimumChanges,1);eq(result.lower,ZERO);eq(result.upper,ONE);
 assert.equal(result.components.length,2);eq(result.components[0].upper,Q('1/4'));eq(result.components[1].lower,Q('3/4'));
 assert.deepEqual(result.components.map(c=>c.patternIndices.map(i=>result.analysis.cases[i].splits)),[[[2]],[[1]]]);
 assert.equal(result.gaps.length,1);assert.equal(result.gaps[0].boundary,'open');eq(result.gaps[0].after,Q('1/4'));eq(result.gaps[0].before,Q('3/4'));
 assert.ok(result.ranges.every(r=>cmp(r.lower.value,Q('1/2'))>0||cmp(r.upper.value,Q('1/2'))<0));
 for(const mutate of [r=>r.gaps.pop(),r=>r.components.pop(),r=>{r.components[0].upper=ONE;},r=>r.components[0].patternIndices.push(1)]){
  const changed=structuredClone(result);mutate(changed);assert.throws(()=>verifyMinimumSkyChangeRange(observed,bands,target,changed));
 }
});
test('all source rows, optimality proofs, products, pattern identities, global ties and work remain bound',()=>{
 const observed=[row([1,0,0,0]),row([0,0,0,1])],bands=[band(0),band(1)],target=pair(row([0,0,0,0])),result=rangeMinimumSkyChanges(observed,bands,target);
 assert.equal(result.ranges.length,3);assert.equal(result.lowerPatternIndices.length,3);
 const changes=[r=>r.ranges.pop(),r=>r.lowerPatternIndices.pop(),r=>r.upperPatternIndices.pop(),r=>{r.lower=ONE;},r=>{r.ranges[0].patternIndex=999;},r=>r.ranges.reverse(),
  r=>{r.ranges[0].targetProjection.lower.constant=ONE;},r=>{r.targetRows.lower.coefficients[0][0]=ONE;},r=>{r.ranges[0].lower.value=ONE;},
  r=>{r.ranges[0].lower.certificate.dual[0]=Q(-1);},r=>{r.ranges[0].lower.certificate.point[0]=ONE;},
  r=>{r.ranges[0].lower.witness.productMasses[0]=ONE;},r=>r.ranges[0].lower.witness.phaseProfiles.pop(),r=>{r.ranges[0].upper.witness.observedC[0]=ONE;},
  r=>{r.work.rationalOperations=0;},r=>{r.analysis.minimumChanges=0;},r=>r.analysis.cases.pop(),r=>{r.ranges[0].work.objectives=2;},
  r=>{r.ranges[0].endpointOrder.maximumDifference=ONE;},r=>{r.ranges[0].endpointOrder.certificate.dual[0]=Q(-1);},r=>{r.ranges[0].endpointOrder.certificate.status='feasible';}];
 for(const mutate of changes){const changed=structuredClone(result);mutate(changed);assert.throws(()=>verifyMinimumSkyChangeRange(observed,bands,target,changed));}
});
test('inference and three objectives share a cumulative allowance; malformed source refuses without mutation',()=>{
 const observed=[row([1,0,0])],bands=[band('1/4','3/4')],target=pair(row([2,0,0])),before=structuredClone({observed,bands,target}),result=rangeMinimumSkyChanges(observed,bands,target);
 assert.ok(result.work.rationalOperations>result.analysis.work.rationalOperations);assert.equal(result.work.objectives,3);
 assert.throws(()=>rangeMinimumSkyChanges(observed,bands,target,{maxRationalOperations:result.work.rationalOperations-1}),/allowance/);
 assert.throws(()=>rangeMinimumSkyChanges(observed,bands,target,{maxPivots:0}),/allowance/);
 assert.throws(()=>rangeMinimumSkyChanges(observed,bands,target,null));assert.throws(()=>rangeMinimumSkyChanges(observed,bands,{...target,chosenPattern:0}));
 const sparse=structuredClone(target);delete sparse.upper.coefficients[1];assert.throws(()=>rangeMinimumSkyChanges(observed,bands,sparse));
 const huge=structuredClone(target);huge.lower.constant=[1n<<4096n,1n];assert.throws(()=>rangeMinimumSkyChanges(observed,bands,huge));
 assert.deepEqual({observed,bands,target},before);
});
