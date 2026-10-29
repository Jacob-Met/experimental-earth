import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {conditionMinimumSkyConsequence,verifyMinimumSkyConditionalConsequence} from '../shade-heat-sky-conditional.js';
import {add,mul,sub,cmp} from '../vendor/chronos/exact-halfplanes.mjs';
const Q=x=>{const [n,d='1']=String(x).split('/');return[BigInt(n),BigInt(d)];},eq=(a,b)=>assert.equal(cmp(a,b),0);
const row=r=>({constant:Q(r.constant??0),coefficients:r.coefficients.map(x=>[Q(x),Q(0),Q(0)])});
const pair=p=>({lower:row(p.lower),upper:row(p.upper)});
const ids=v=>v.map(Number);
test('all668 independent conditioned Fraction vertex cases retain the original class, simultaneous rows, extrema, components, gaps and ties',async()=>{
 const fixtures=JSON.parse(await readFile(new URL('./sky-conditional-oracles.json',import.meta.url),'utf8'));assert.equal(fixtures.cases.length,668);assert.equal(fixtures.originalFamilies,176);assert.equal(fixtures.selftest.status,'PASS');
 let surviving=0,excluded=0,profiles=0,components=0,gaps=0;
 for(const c of fixtures.cases){
  const observed=c.observations.map(row),bands=c.observations.map(o=>({lower:Q(o.lower),upper:Q(o.upper)})),requirements=c.requirements.map(r=>({relation:r.relation,limit:Q(r.limit),...pair(r)})),consequence=pair(c.consequence),delta=Q(c.allowance);
  const result=conditionMinimumSkyConsequence(observed,bands,requirements,delta,consequence),e=c.expected;
  assert(verifyMinimumSkyConditionalConsequence(observed,bands,requirements,delta,consequence,result));
  assert.equal(result.analysis.minimumChanges,e.originalMinimumChanges,c.name);
  assert.equal(result.status,e.status==='conditional-ranges'?'conditional-range':e.status,c.name);
  assert.deepEqual(result.cases.map(p=>p.patternIndex),ids(e.originalMinimumPatterns),c.name);
  assert.deepEqual(result.conditionalPatternIndices,ids(e.patterns.filter(p=>p.status==='feasible').map(p=>p.pattern)));
  assert.deepEqual(result.conditionalExcludedPatternIndices,ids(e.patterns.filter(p=>p.status==='conditional-empty').map(p=>p.pattern)));
  assert.deepEqual(result.lowerAttainingPatternIndices,ids(e.minimumPatterns));assert.deepEqual(result.upperAttainingPatternIndices,ids(e.maximumPatterns));
  if(e.outerRange){eq(result.hull.lower,Q(e.outerRange[0]));eq(result.hull.upper,Q(e.outerRange[1]));}else assert.equal(result.hull,null);
  for(const [i,p]of result.cases.entries()){
   const want=e.patterns[i];assert.equal(p.patternIndex,Number(want.pattern));assert.equal(p.status,want.status==='feasible'?'feasible':'incompatible');
   if(p.status==='incompatible'){assert.equal(p.range,null);excluded++;continue;}
   surviving++;eq(p.range.lower,Q(want.range[0]));eq(p.range.upper,Q(want.range[1]));eq(p.conditionedOrder.maximumDifference,Q(want.order.maximumLowerMinusUpper));
   for(const role of ['lower','upper']){
    const w=p[role].witness;assert(w.selectedRequirementStatuses.every(s=>s==='met'));eq(w.consequencePair[role],p[role].value);profiles++;
    const raw=c.consequence[role];let v=Q(raw.constant);
    for(let j=0;j<c.intervals;j++){const phase=p.splits.filter(cut=>cut<=j).length;v=add(v,mul(Q(raw.coefficients[j]),w.phaseProfiles[phase][1]));}
    eq(v,p[role].value);
   }
  }
  assert.equal(result.components.length,e.components.length);assert.equal(result.gaps.length,e.gaps.length);
  for(const [i,part]of result.components.entries()){
   const expected=e.components[i];eq(part.lower,Q(expected.range[0]));eq(part.upper,Q(expected.range[1]));assert.deepEqual(part.patternIndices,ids(expected.patterns));
   const members=e.patterns.filter(p=>expected.patterns.includes(p.pattern));
   assert.deepEqual(part.lowerAttainingPatternIndices,ids(members.filter(p=>cmp(Q(p.range[0]),Q(expected.range[0]))===0).map(p=>p.pattern)));
   assert.deepEqual(part.upperAttainingPatternIndices,ids(members.filter(p=>cmp(Q(p.range[1]),Q(expected.range[1]))===0).map(p=>p.pattern)));components++;
  }
  for(const [i,g]of result.gaps.entries()){eq(g.lower,Q(e.gaps[i].range[0]));eq(g.upper,Q(e.gaps[i].range[1]));assert.equal(g.lowerIncluded,false);assert.equal(g.upperIncluded,false);gaps++;}
  const all=result.cases.length,good=result.conditionalPatternIndices.length;
  assert.equal(result.work.solves,result.analysis.work.solves+2*all+2*good);assert.equal(result.work.objectives,3*all+2*good);
  assert.equal(result.work.verifiedCertificates,result.analysis.work.verifiedCertificates+4*all+5*good);
 }
 console.log(JSON.stringify({independentOriginalFamilies:176,independentConditionedCases:fixtures.cases.length,survivingPatterns:surviving,excludedPatterns:excluded,extremeProfiles:profiles,components,gaps}));
});
