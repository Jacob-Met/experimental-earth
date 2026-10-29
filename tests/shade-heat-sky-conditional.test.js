import test from 'node:test';
import assert from 'node:assert/strict';
import {conditionMinimumSkyConsequence,verifyMinimumSkyConditionalConsequence,SKY_CONDITIONAL_LIMITS} from '../shade-heat-sky-conditional.js';
import {add,sub,mul,cmp} from '../vendor/chronos/exact-halfplanes.mjs';
const Q=x=>{const [n,d='1']=String(x).split('/');return[BigInt(n),BigInt(d)];},Z=()=>Q(0),eq=(a,b)=>assert.equal(cmp(a,b),0);
const encode=x=>JSON.stringify(x,(_k,v)=>typeof v==='bigint'?String(v):v);
const row=(values,c=0)=>({constant:Q(c),coefficients:values.map(x=>[Q(x),Z(),Z()])});
const pair=(values,width=0,c=0)=>({lower:row(values,sub(Q(c),Q(width))[0]+'/'+sub(Q(c),Q(width))[1]),upper:row(values,add(Q(c),Q(width))[0]+'/'+add(Q(c),Q(width))[1])});
function run(raw,delta=Z(),options={}){return conditionMinimumSkyConsequence(raw.observed,raw.bands,raw.requirements,delta,raw.consequence,options);}
function verify(raw,delta,result){return verifyMinimumSkyConditionalConsequence(raw.observed,raw.bands,raw.requirements,delta,raw.consequence,result);}
function valueAt(source,splits,profiles){
 let out=source.constant;
 for(let i=0;i<source.coefficients.length;i++){
  const phase=splits.filter(cut=>cut<=i).length;
  for(let bin=0;bin<3;bin++)out=add(out,mul(source.coefficients[i][bin],profiles[phase][bin+1]));
 }
 return out;
}
function inspect(raw,delta,result){
 assert.equal(result.analysis.status==='incompatible',result.status==='original-incompatible');
 assert.deepEqual(result.cases.map(c=>c.patternIndex),result.analysis.cases.flatMap((c,i)=>c.status==='feasible'?[i]:[]));
 assert.deepEqual(result.conditionalPatternIndices,result.cases.filter(c=>c.status==='feasible').map(c=>c.patternIndex));
 assert.deepEqual(result.conditionalExcludedPatternIndices,result.cases.filter(c=>c.status==='incompatible').map(c=>c.patternIndex));
 for(const c of result.cases){
  assert.equal(c.linearModel.rows.length,result.analysis.cases[c.patternIndex].linearModel.rows.length+2);
  assert.equal(c.conditionedOrderWork.objectives,1);
  if(c.status==='incompatible'){assert.equal(c.feasibilityCertificate.status,'incompatible');for(const key of ['lower','upper','range','conditionedOrder'])assert.equal(c[key],null);continue;}
  assert.equal(c.conditionedOrder.scope,'conditioned-polytope');assert(cmp(c.conditionedOrder.maximumDifference,Z())<=0);
  for(const role of ['lower','upper']){
   const w=c[role].witness;assert.equal(w.role,role);assert.equal(c[role].work.objectives,1);
   for(const [i,source]of raw.observed.entries()){const exact=valueAt(source,c.splits,w.phaseProfiles);eq(w.observedC[i],exact);assert(cmp(exact,raw.bands[i].lower)>=0&&cmp(exact,raw.bands[i].upper)<=0);}
   const residuals=[];
   for(const [i,target]of raw.requirements.entries()){
    const p={lower:valueAt(target.lower,c.splits,w.phaseProfiles),upper:valueAt(target.upper,c.splits,w.phaseProfiles)};
    eq(w.requirementPairs[i].lower,p.lower);eq(w.requirementPairs[i].upper,p.upper);
    const residual=target.relation==='at-most'?sub(p.upper,target.limit):sub(target.limit,p.lower);residuals.push(residual);
    assert(cmp(residual,delta)<=0);assert.equal(w.originalRequirementStatuses[i],cmp(residual,Z())<=0?'met':'not-met');assert.equal(w.selectedRequirementStatuses[i],'met');eq(w.violations[i],residual);
   }
   eq(w.requiredRelaxation,[Z(),...residuals].reduce((a,b)=>cmp(a,b)>=0?a:b));
   const third={lower:valueAt(raw.consequence.lower,c.splits,w.phaseProfiles),upper:valueAt(raw.consequence.upper,c.splits,w.phaseProfiles)};
   eq(w.consequencePair.lower,third.lower);eq(w.consequencePair.upper,third.upper);eq(c[role].value,third[role]);
   assert(cmp(third.lower,third.upper)<=0);assert(cmp(c.range.lower,third.lower)<=0&&cmp(third.upper,c.range.upper)<=0);
  }
 }
}
function scalar(a,b,l,u,w){
 const endpoint=pair(['1','0'],w),third=pair(['2','0'],'1/8','-1');
 return{observed:[row(['1','0'])],bands:[{lower:Q(a),upper:Q(b)}],requirements:[{relation:'at-most',limit:Q(u),...endpoint},{relation:'at-least',limit:Q(l),...endpoint}],consequence:third};
}
test('10935 exact scalar conditioned polytopes match direct interval intersection and affine endpoint extrema',()=>{
 let cases=0,empty=0,contacts=0,distinct=0;
 for(let ai=0;ai<=4;ai++)for(let bi=ai;bi<=4;bi++)for(let li=-2;li<=6;li++)for(let ui=-2;ui<=6;ui++)for(let wi=0;wi<=2;wi++)for(const di of [0,1,3]){
  const [a,b,l,u,w,d]=[ai,bi,li,ui,wi,di].map(x=>Q(x+'/4')),raw=scalar(ai+'/4',bi+'/4',li+'/4',ui+'/4',wi+'/4'),result=run(raw,d,{maximumChanges:0});
  const lower=cmp(a,sub(add(l,w),d))>=0?a:sub(add(l,w),d),upper=cmp(b,add(sub(u,w),d))<=0?b:add(sub(u,w),d);
  assert.equal(result.analysis.minimumChanges,0);assert.equal(result.cases.length,1);
  if(cmp(lower,upper)>0){assert.equal(result.status,'conditional-empty');assert.equal(result.hull,null);assert.deepEqual(result.components,[]);empty++;}
  else{
   assert.equal(result.status,'conditional-range');eq(result.hull.lower,sub(mul(Q(2),lower),Q('9/8')));eq(result.hull.upper,sub(mul(Q(2),upper),Q('7/8')));
   eq(result.cases[0].lower.witness.phaseProfiles[0][1],lower);eq(result.cases[0].upper.witness.phaseProfiles[0][1],upper);
   assert.equal(result.components.length,1);assert.deepEqual(result.gaps,[]);if(cmp(lower,upper)===0)contacts++;else distinct++;
  }
  inspect(raw,d,result);cases++;
 }
 assert.equal(cases,10935);assert.equal(empty+contacts+distinct,cases);console.log(JSON.stringify({directScalarCases:cases,conditionalEmpty:empty,singleProfileContacts:contacts,distinctExtremeProfiles:distinct}));
});
function coupled(){
 const x={constant:Z(),coefficients:[[Q(1),Z(),Z()],[Z(),Z(),Z()]]},y={constant:Z(),coefficients:[[Z(),Q(1),Z()],[Z(),Z(),Z()]]},sum={constant:Z(),coefficients:[[Q(1),Q(1),Z()],[Z(),Z(),Z()]]};
 return{observed:[sum],bands:[{lower:Z(),upper:Q(1)}],requirements:[x,y].map(r=>({relation:'at-least',limit:Q('3/4'),lower:r,upper:r})),consequence:{lower:sum,upper:sum}};
}
test('both conditions constrain the same coupled profile; separately feasible consequence ranges cannot establish joint feasibility',()=>{
 const raw=coupled(),before=encode(raw);
 for(const [delta,expected]of [['0',null],['1/8',null],['1/4',['1','1']],['1/2',['1/2','1']],['3/4',['0','1']],['1',['0','1']]]){
  const d=Q(delta),result=run(raw,d);inspect(raw,d,result);
  if(expected){eq(result.hull.lower,Q(expected[0]));eq(result.hull.upper,Q(expected[1]));}
  else{assert.equal(result.status,'conditional-empty');assert.deepEqual(result.conditionalExcludedPatternIndices,[0]);}
 }
 for(const retained of [0,1]){
  const single=structuredClone(raw);single.requirements[1-retained].limit=Z();const result=run(single);eq(result.hull.lower,Q('3/4'));eq(result.hull.upper,Q(1));
 }
 assert.equal(encode(raw),before);
});
function disjoint(n=3,width='0',scale='1'){
 const observed=[row(Array.from({length:n},(_,i)=>i===0?'1':'0')),row(Array.from({length:n},(_,i)=>i===n-1?'1':'0'))],zero=row(Array(n).fill('0'));
 const middle=Array.from({length:n},(_,i)=>i>0&&i<n-1?scale:'0');
 return{observed,bands:[{lower:Z(),upper:Z()},{lower:Q(1),upper:Q(1)}],requirements:[0,1].map(()=>({relation:'at-most',limit:Z(),lower:zero,upper:zero})),consequence:pair(middle,width)};
}
test('the original minimum class remains fixed when conditioning removes it, even if a higher class could meet both conditions',()=>{
 const raw=disjoint(),mid=row(['0','1','0']);raw.requirements=[{relation:'at-least',limit:Q('3/4'),lower:mid,upper:mid},{relation:'at-most',limit:Q('1/4'),lower:mid,upper:mid}];
 for(const d of [Z(),Q('1/4'),Q('1/2')]){
  const result=run(raw,d);assert.equal(result.analysis.minimumChanges,1);assert.equal(result.analysis.unexaminedHigherChangePatterns,1);
  assert.deepEqual(result.cases.map(c=>c.splits),[[1],[2]]);assert.equal(result.status,'conditional-empty');assert.deepEqual(result.conditionalExcludedPatternIndices,[1,2]);inspect(raw,d,result);
 }
 const higherProfiles=[[Q(1),Z(),Z(),Z()],[Q('1/2'),Q('1/2'),Z(),Z()],[Z(),Q(1),Z(),Z()]];
 for(const [i,source]of raw.observed.entries())eq(valueAt(source,[1,2],higherProfiles),raw.bands[i].lower);
 for(const target of raw.requirements){const p=valueAt(target.lower,[1,2],higherProfiles);assert(cmp(target.relation==='at-most'?sub(p,target.limit):sub(target.limit,p),Q('1/4'))<=0);}
 const restored=run(raw,Q('3/4'));assert.equal(restored.analysis.minimumChanges,1);assert.equal(restored.components.length,2);assert.equal(restored.gaps.length,1);
 eq(restored.hull.lower,Z());eq(restored.hull.upper,Q(1));eq(restored.gaps[0].lower,Z());eq(restored.gaps[0].upper,Q(1));inspect(raw,Q('3/4'),restored);
});

test('closed interval unions merge exact contact, preserve positive tiny gaps and retain every contributor and attaining tie',()=>{
 for(const width of ['1/2','1/4']){
  const raw=disjoint(4,width),result=run(raw);inspect(raw,Z(),result);
  if(width==='1/2'){
   assert.equal(result.components.length,1);assert.deepEqual(result.components[0].patternIndices,[1,2,3]);
   eq(result.hull.lower,Q('-1/2'));eq(result.hull.upper,Q('5/2'));assert.deepEqual(result.gaps,[]);
  }else{
   assert.equal(result.components.length,3);assert.equal(result.gaps.length,2);eq(result.gaps[0].lower,Q('1/4'));eq(result.gaps[0].upper,Q('3/4'));
   for(const gap of result.gaps){assert.equal(gap.lowerIncluded,false);assert.equal(gap.upperIncluded,false);}
  }
 }
 const tiny=[1n,2n**1075n],raw=disjoint(3,'0',tiny[0]+'/'+tiny[1]),result=run(raw);
 assert.equal(result.components.length,2);eq(result.gaps[0].lower,Z());eq(result.gaps[0].upper,tiny);assert(cmp(result.gaps[0].upper,result.gaps[0].lower)>0);inspect(raw,Z(),result);
 const tied=disjoint(4);tied.consequence=pair(['0','1','0','0']);const ties=run(tied);
 assert.deepEqual(ties.lowerAttainingPatternIndices,[2,3]);assert.deepEqual(ties.upperAttainingPatternIndices,[1]);assert.deepEqual(ties.components[0].patternIndices,[2,3]);assert.deepEqual(ties.components[0].lowerAttainingPatternIndices,[2,3]);assert.deepEqual(ties.components[0].upperAttainingPatternIndices,[2,3]);
 const selected=disjoint(),middle=row(['0','1','0']);selected.requirements[0]={relation:'at-least',limit:Q('3/4'),lower:middle,upper:middle};
 const retained=run(selected);assert.deepEqual(retained.conditionalPatternIndices,[1]);assert.deepEqual(retained.conditionalExcludedPatternIndices,[2]);eq(retained.hull.lower,Q(1));eq(retained.hull.upper,Q(1));
});
test('third-interval ordering is certified on the conditioned polytope while original requirements remain ordered on the original polytope',()=>{
 const x=row(['1','0']),zero=row(['0','0']);
 const raw={observed:[x],bands:[{lower:Z(),upper:Q(1)}],requirements:[{relation:'at-most',limit:Q('1/4'),lower:x,upper:x},{relation:'at-most',limit:Z(),lower:zero,upper:zero}],consequence:{lower:x,upper:row(['-1','0'],1)}};
 const restricted=run(raw);eq(restricted.cases[0].conditionedOrder.maximumDifference,Q('-1/2'));assert.equal(restricted.cases[0].conditionedOrder.scope,'conditioned-polytope');inspect(raw,Z(),restricted);
 const contact=run(raw,Q('1/4'));eq(contact.cases[0].conditionedOrder.maximumDifference,Z());
 assert.throws(()=>run(raw,Q('1/2')),/unordered/);
 const bad=structuredClone(raw);bad.requirements[0].lower=x;bad.requirements[0].upper=row(['-1','0'],1);bad.requirements[0].limit=Q('1/4');
 assert.throws(()=>run(bad),/requirement.*unordered/);
});
test('conditional ranges expand monotonically and recover the original interval when both conditions become redundant',()=>{
 const raw=scalar('0','1','3/4','1/4','0');let previous=null;
 for(const text of ['0','1/8','1/4','3/8','1/2','5/8','3/4','1','2']){
  const delta=Q(text),result=run(raw,delta);inspect(raw,delta,result);
  if(!result.hull){assert.equal(previous,null);continue;}
  if(previous){assert(cmp(result.hull.lower,previous.lower)<=0);assert(cmp(result.hull.upper,previous.upper)>=0);}
  previous=result.hull;
  if(cmp(delta,Q('3/4'))>=0){eq(result.hull.lower,Q('-9/8'));eq(result.hull.upper,Q('9/8'));}
 }
 const at=run(raw,Q('1/4'));eq(at.hull.lower,Q('-1/8'));eq(at.hull.upper,Q('1/8'));
 eq(at.cases[0].lower.witness.phaseProfiles[0][1],Q('1/2'));eq(at.cases[0].upper.witness.phaseProfiles[0][1],Q('1/2'));
 assert.notEqual(cmp(at.hull.lower,at.hull.upper),0);
});
test('original-incompatible and conditional-empty remain different and neither can supply a fabricated zero range',()=>{
 const raw=scalar('2','2','0','1','0'),result=run(raw,Q(100));
 assert.equal(result.status,'original-incompatible');assert.equal(result.analysis.minimumChanges,null);assert.deepEqual(result.cases,[]);assert.equal(result.hull,null);assert.deepEqual(result.components,[]);assert.deepEqual(result.gaps,[]);
 const empty=run(coupled());assert.equal(empty.status,'conditional-empty');assert.equal(empty.analysis.minimumChanges,0);assert.equal(empty.cases.length,1);assert.equal(empty.hull,null);
});
test('all conditioned rows must fit unchanged solver arithmetic; ordinary-magnitude high-bit fractions and malformed declarations refuse atomically',()=>{
 const raw=scalar('0','1','0','1','0'),before=encode(raw),bound=2n**4096n;
 const large=structuredClone(raw);large.requirements[0].limit=[1n,bound-3n];const delta=[bound-2n,bound-1n];
 assert.throws(()=>run(large,delta),/capacity|allowance/);assert.equal(encode(raw),before);
 for(const badDelta of [[-1n,1n],[1n,0n],[1n,-1n],[bound,1n],[1n,bound],[1,2],null])assert.throws(()=>run(raw,badDelta));
 for(const mutate of [r=>r.requirements.pop(),r=>r.requirements.push(r.requirements[0]),r=>r.requirements[0].relation='approximately',r=>r.requirements[0].limit=1,
  r=>r.consequence.lower.coefficients.pop(),r=>r.consequence.upper.constant=[1n,0n],r=>r.consequence.extra=true,r=>delete r.requirements[1].upper]){
  const altered=structuredClone(raw);mutate(altered);assert.throws(()=>run(altered));
 }
 assert.throws(()=>run(raw,Z(),{maxObjectives:3}));assert.equal(SKY_CONDITIONAL_LIMITS.conditionalObjectivesPerCall,1);assert.equal(SKY_CONDITIONAL_LIMITS.conditionalConstraints,53);
});
test('every conditional solve shares the exact original cumulative budget and preserves the source',()=>{
 const raw=coupled(),delta=Q('1/2'),before=encode(raw),result=run(raw,delta);assert(result.work.pivots>0&&result.work.rationalOperations>0);
 assert.equal(result.work.requirementOrderSolves,1);assert.equal(result.work.conditionalOrderSolves,1);assert.equal(result.work.lowerSolves,1);assert.equal(result.work.upperSolves,1);
 assert.equal(result.work.objectives,5);assert.equal(result.work.verifiedCertificates,result.analysis.work.verifiedCertificates+9);
 eq(run(raw,delta,{maxPivots:result.work.pivots}).hull.lower,result.hull.lower);
 eq(run(raw,delta,{maxRationalOperations:result.work.rationalOperations}).hull.upper,result.hull.upper);
 assert.throws(()=>run(raw,delta,{maxPivots:result.work.pivots-1}),/allowance/);
 assert.throws(()=>run(raw,delta,{maxRationalOperations:result.work.rationalOperations-1}),/allowance/);
 assert.equal(encode(raw),before);
});
test('complete verification rejects omitted conditions, unconditioned extrema, reassigned roles, altered gaps, missing patterns and work counter forgeries',()=>{
 const raw=disjoint(4,'1/4'),delta=Z(),result=run(raw,delta);
 const mutations=[
  r=>r.cases.pop(),r=>r.analysis.minimumChanges=2,r=>r.allowance=Q(1),r=>r.requirements[0].limit=Q(1),r=>r.selectedRequirements[0].limit=Q(1),
  r=>r.consequence.upper.constant=Q(99),r=>r.cases[0].linearModel.rows.pop(),r=>r.cases[0].linearModel.bounds.pop(),
  r=>r.cases[0].linearModel.rows.at(-1)[0]=Q(99),r=>r.cases[0].conditionedOrder.scope='original-polytope',
  r=>r.cases[0].conditionedOrder.maximumDifference=Q(1),r=>r.cases[0].lower.value=Q(-99),
  r=>r.cases[0].upper.certificate.value=Q(99),r=>r.cases[0].lower.witness.role='upper',
  r=>r.cases[0].lower.witness.phaseProfiles[0][0]=Q('1/2'),r=>r.cases[0].lower.witness.requirementPairs[0].upper=Q(1),
  r=>r.cases[0].upper.witness.selectedRequirementStatuses[0]='not-met',r=>r.cases[0].upper.witness.consequencePair.upper=Q(99),
  r=>r.conditionalPatternIndices.pop(),r=>r.lowerAttainingPatternIndices.push(99),r=>r.upperAttainingPatternIndices=[],
  r=>r.components[0].patternIndices.push(99),r=>r.components[0].upper=r.hull.upper,r=>r.gaps.pop(),r=>r.gaps[0].lowerIncluded=true,
  r=>r.hull.lower=Q(0),r=>r.cases[0].lower.work.objectives=2,r=>r.cases[0].upper.work.verifiedCertificates=1,
  r=>r.cases[0].conditionedOrderWork.maximumTableauCells++,r=>r.work.pivots++,r=>r.work.lowerSolves++
 ];
 for(const mutate of mutations){const altered=structuredClone(result);mutate(altered);assert.throws(()=>verify(raw,delta,altered));}
 const emptyRaw=coupled(),empty=run(emptyRaw);
 for(const mutate of [r=>r.status='original-incompatible',r=>r.cases[0].range={lower:Z(),upper:Z()},r=>r.cases[0].feasibilityCertificate.dual[0]=Q(999),r=>r.conditionalExcludedPatternIndices=[],r=>r.cases[0].conditionedOrderWork.objectivePivots=1]){
  const altered=structuredClone(empty);mutate(altered);assert.throws(()=>verify(emptyRaw,Z(),altered));
 }
 console.log(JSON.stringify({conditionalForgeryRefusals:mutations.length+5}));
});
