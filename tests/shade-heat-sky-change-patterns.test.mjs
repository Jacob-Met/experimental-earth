import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {findMinimumSkyChanges,verifyMinimumSkyChangeResult,originalSkyChangePatterns,
  projectOriginalSkyPattern,SKY_CHANGE_PATTERN_LIMITS} from '../shade-heat-sky-change-patterns.js';
import {rational as q,add,mul,cmp} from '../vendor/chronos/exact-halfplanes.mjs';

const oracle=JSON.parse(fs.readFileSync(new URL('./sky-change-pattern-oracles.json',import.meta.url),'utf8'));
const exact=text=>{const [a,b='1']=text.split('/');return [BigInt(a),BigInt(b)];};
const inputs=entry=>({observed:entry.observations.map(o=>({constant:q(0),coefficients:o.coefficients.map(v=>[exact(v),q(0),q(0)])})),
  bands:entry.observations.map(o=>({lower:exact(o.lower),upper:exact(o.upper)}))});
const lookup=name=>inputs(oracle.cases.find(c=>c.name===name));
const same=(a,b)=>JSON.stringify(a,(_key,v)=>typeof v==='bigint'?v.toString():v)===JSON.stringify(b,(_key,v)=>typeof v==='bigint'?v.toString():v);

test('all 54 independent exact cube/slab oracles retain the complete minimum class',()=>{
  assert.equal(oracle.cases.length,54);
  for(const entry of oracle.cases){
    const {observed,bands}=inputs(entry),before=structuredClone({observed,bands});
    const result=findMinimumSkyChanges(observed,bands);
    assert.equal(result.minimumChanges,entry.expected.minimumChanges,entry.name);
    assert.deepEqual(result.compatiblePatterns,entry.expected.allCompatiblePatterns.map(p=>p.cuts),entry.name);
    assert.equal(verifyMinimumSkyChangeResult(observed,bands,result),true);
    assert.equal(same({observed,bands},before),true);
    assert.equal(result.cases.length,originalSkyChangePatterns(entry.intervals).filter(p=>result.minimumChanges===null||p.length<=result.minimumChanges).length);
  }
});

test('exact phase grouping preserves every lower-change profile under refinement',()=>{
  const observed=[{constant:exact('7/11'),coefficients:Array.from({length:7},(_,i)=>[exact((i%2?-1:1)*(i+1)+'/13'),exact((i+2)+'/17'),exact((-i-1)+'/19')])}];
  const bands=[{lower:q(-100),upper:q(100)}],share=[exact('1/5'),exact('2/7'),exact('1/11')];
  const value=(model,point)=>add(model.projected[0].constant,model.projected[0].coefficients.reduce((sum,v,i)=>add(sum,mul(v,point[i])),q(0)));
  const staticValue=value(projectOriginalSkyPattern(observed,bands,[]),share);
  for(const splits of originalSkyChangePatterns(7)){
    const model=projectOriginalSkyPattern(observed,bands,splits),point=Array.from({length:splits.length+1},()=>share).flat();
    assert.equal(cmp(staticValue,value(model,point)),0);
  }
  const earlier=projectOriginalSkyPattern(observed,bands,[3]),later=projectOriginalSkyPattern(observed,bands,[3,5]);
  const other=[exact('1/9'),exact('1/8'),exact('1/7')];
  assert.equal(cmp(value(earlier,[...share,...other]),value(later,[...share,...other,...other])),0);
});

test('no minimum class, compatible alternative or original-matrix proof may be omitted or forged',()=>{
  const {observed,bands}=lookup('all-one-splits-5'),original=findMinimumSkyChanges(observed,bands);
  const mutations=[
    d=>d.cases.pop(),d=>d.compatiblePatterns.pop(),d=>d.minimumChanges=2,
    d=>d.cases[1].splits=[2],d=>d.cases[0].linearModel.bounds[0]=q(2),
    d=>d.cases[0].certificate.dual[0]=q(-1),
    d=>d.cases[1].witness.phaseProfiles[0][0]=q(2),
    d=>d.cases[1].witness.productMasses[0]=q(2),
    d=>d.cases[1].witness.observedC[0]=q(2),
    d=>d.unexaminedHigherChangePatterns=0,
    d=>d.limits.rationalOperations++,d=>d.work.rationalOperations++,
  ];
  for(const mutate of mutations){const forged=structuredClone(original);mutate(forged);assert.throws(()=>verifyMinimumSkyChangeResult(observed,bands,forged));}
  const changed=structuredClone(bands);changed[0].upper=q(2);
  assert.throws(()=>verifyMinimumSkyChangeResult(observed,changed,original));
});

test('cumulative arithmetic and pattern admission refuse atomically without changing sources',()=>{
  const {observed,bands}=lookup('unique-two-8'),before=structuredClone({observed,bands});
  const full=findMinimumSkyChanges(observed,bands);
  assert.throws(()=>findMinimumSkyChanges(observed,bands,{maxRationalOperations:full.work.rationalOperations-1}),/allowance/);
  assert.throws(()=>findMinimumSkyChanges(observed,bands,{maxPivots:0}),/allowance/);
  assert.throws(()=>findMinimumSkyChanges(observed,bands,{maxRationalOperations:0}),/allowance/);
  assert.throws(()=>findMinimumSkyChanges(observed,bands,{maxRationalOperations:SKY_CHANGE_PATTERN_LIMITS.rationalOperations+1}));
  assert.equal(same({observed,bands},before),true);
  for(const maximumChanges of [null,-1,3,1.5])assert.throws(()=>findMinimumSkyChanges(observed,bands,{maximumChanges}));
  const sparse=structuredClone(observed);delete sparse[0].coefficients[1];assert.throws(()=>findMinimumSkyChanges(sparse,bands));
  assert.throws(()=>projectOriginalSkyPattern(observed,bands,[2,2]));
  assert.throws(()=>projectOriginalSkyPattern(observed,bands,[0]));
  assert.throws(()=>projectOriginalSkyPattern(observed,bands,[8]));
  const bounded=findMinimumSkyChanges(observed,bands,{maximumChanges:1});
  assert.equal(bounded.status,'incompatible');assert.equal(bounded.cases.length,8);
  assert.equal(originalSkyChangePatterns(24).length,277);
  assert.throws(()=>originalSkyChangePatterns(25));
});
