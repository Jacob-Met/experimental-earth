import test from 'node:test';
import assert from 'node:assert/strict';
import {findThreeEpochTargetConflict,prepareThreeEpochTargetConflictSeed,THREE_EPOCH_TARGET_CONFLICT_LIMITS} from '../shade-heat-target-conflict.js';
import {minimizeThreeEpochTargetExcess} from '../shade-heat-target-margin.js';
import {verifyThreeEpochTargetLinearCertificate} from '../shade-heat-exact-linear.js';
import {rational as q,sub,mul,cmp} from '../vendor/chronos/exact-halfplanes.mjs';

const ZERO=q(0),ONE=q(1);
const simplex=()=>({rows:Array.from({length:3},(_,k)=>Array.from({length:9},(_,j)=>q(Math.floor(j/3)===k?1:0))),bounds:[ONE,ONE,ONE]});
const rising=()=>Array.from({length:64},(_,i)=>q(Math.floor(i/16)===1?1:0));
const verify=r=>{
 const c=r.conflict;
 assert.equal(c.minimality,'inclusion-minimal-with-all-original-observations-mandatory');
 assert(verifyThreeEpochTargetLinearCertificate(c.linearModel.rows,c.linearModel.bounds,null,c.certificate));
 assert.equal(c.removalWitnesses.length,c.targetIndices.length);
 for(const w of c.removalWitnesses){
  assert.deepEqual(w.requiredTargetIndices,c.targetIndices.filter(i=>i!==w.removedTargetIndex));
  assert(w.requiredTargetIndices.every(i=>cmp(w.targetExcessC[i],ZERO)<=0));
  assert(cmp(w.targetExcessC[w.removedTargetIndex],ZERO)>0);
 }
};

test('a necessary pair excludes a redundant authored ceiling and retains one fixed profile for each removal',()=>{
 const a=rising(),b=a.map(v=>sub(ONE,v)),model=simplex(),rows=[a,b,a.map(v=>mul(q(2),v))],ceilings=[q(.4),q(.4),q(1.8)];
 const before=structuredClone({model,rows,ceilings});
 const r=findThreeEpochTargetConflict(model,rows,ceilings);
 assert.equal(r.status,'incompatible-targets');assert.deepEqual(r.conflict.targetIndices,[0,1]);verify(r);
 assert.deepEqual({model,rows,ceilings},before);assert(r.work.feasibilitySolves<=rows.length+2);
 assert.equal(r.work.removalWitnesses,2);assert.equal(r.originalCertificate.status,'feasible');
});

test('one target can conflict with mandatory original observations while its removal keeps every original row',()=>{
 const model=simplex();model.rows.push([q(-1),...Array.from({length:8},()=>ZERO)]);model.bounds.push(q(-.6));
 const r=findThreeEpochTargetConflict(model,[rising()],[q(.4)]);assert.equal(r.status,'incompatible-targets');
 assert.deepEqual(r.conflict.targetIndices,[0]);assert.equal(r.conflict.originalConstraintCount,4);verify(r);
 assert(cmp(r.conflict.removalWitnesses[0].coordinates[0],q(.6))>=0);
 const constant=findThreeEpochTargetConflict(simplex(),[Array.from({length:64},()=>ZERO)],[q(-1)]);
 assert.deepEqual(constant.conflict.targetIndices,[0]);verify(constant);
});

test('compatible targets retain a full feasible witness and incompatible original evidence withholds any target conflict',()=>{
 const a=rising(),b=a.map(v=>sub(ONE,v));
 const yes=findThreeEpochTargetConflict(simplex(),[a,b],[q(.6),q(.6)]);
 assert.equal(yes.status,'compatible-targets');assert.equal(yes.conflict,null);assert(yes.compatibleWitness.targetExcessC.every(v=>cmp(v,ZERO)<=0));
 const model=simplex();model.rows.push([ONE,...Array.from({length:8},()=>ZERO)],[q(-1),...Array.from({length:8},()=>ZERO)]);model.bounds.push(q(.3),q(-.7));
 const no=findThreeEpochTargetConflict(model,[a,b],[q(100),q(100)]);
 assert.equal(no.status,'incompatible-original-model');assert.equal(no.conflict,null);assert.equal(no.compatibleWitness,null);
 assert.equal(no.work.feasibilitySolves,1);assert.equal(no.originalCertificate.status,'incompatible');
 assert(verifyThreeEpochTargetLinearCertificate(model.rows,model.bounds,null,no.originalCertificate));
});

test('the exact solve allowance is cumulative across the whole deletion series and never returns a partial conflict',()=>{
 const a=rising(),rows=[a,a.map(v=>sub(ONE,v))],ceilings=[q(.4),q(.4)],model=simplex();
 const r=findThreeEpochTargetConflict(model,rows,ceilings),ops=r.work.rationalOperations,pivots=r.work.pivots;
 assert(ops>Math.max(...r.history.map(h=>h.work.rationalOperations)));
 assert.throws(()=>findThreeEpochTargetConflict(model,rows,ceilings,{maxRationalOperations:ops-1}),/allowance exhausted/);
 assert.throws(()=>findThreeEpochTargetConflict(model,rows,ceilings,{maxPivots:pivots-1}),/allowance exhausted/);
 assert.deepEqual(findThreeEpochTargetConflict(model,rows,ceilings,{maxRationalOperations:ops,maxPivots:pivots}).conflict,r.conflict);
 for(const options of [{maxRationalOperations:-1},{maxPivots:2049},{partial:true},{maxPivots:.5}])assert.throws(()=>findThreeEpochTargetConflict(model,rows,ceilings,options));
});

test('fresh margin proof reuse validates the complete hard-target matrix, including a zero-auxiliary positive-anchor case',()=>{
 const a=rising(),b=a.map(v=>sub(ONE,v)),model=simplex(),rows=[a,b],ceilings=[q(.4),q(.4)];
 const margin=minimizeThreeEpochTargetExcess(model,rows,ceilings),seed=prepareThreeEpochTargetConflictSeed(model,rows,ceilings,margin);
 const result=findThreeEpochTargetConflict(model,rows,ceilings,{initialCertificate:seed});verify(result);
 assert.equal(result.work.verifiedInitialCertificates,1);assert.equal(result.work.feasibilitySolves,3);
 const forged=structuredClone(seed);forged.dual[0]=q(-1);assert.throws(()=>findThreeEpochTargetConflict(model,rows,ceilings,{initialCertificate:forged}),/Farkas/);
 assert.throws(()=>findThreeEpochTargetConflict(model,rows,[q(10),q(10)],{initialCertificate:seed}),/Farkas/);
 const constant=[Array.from({length:64},()=>q(5))],low=[q(2)],fixed=minimizeThreeEpochTargetExcess(model,constant,low);
 assert.equal(cmp(fixed.linearCertificate.point[9],ZERO),0);assert(fixed.linearCertificate.dual.every(v=>cmp(v,ZERO)===0));
 const singleton=findThreeEpochTargetConflict(model,constant,low,{initialCertificate:prepareThreeEpochTargetConflictSeed(model,constant,low,fixed)});
 assert.deepEqual(singleton.conflict.targetIndices,[0]);verify(singleton);
 const high=[q(.6),q(.6)],possible=minimizeThreeEpochTargetExcess(model,rows,high),compatible=findThreeEpochTargetConflict(model,rows,high,{initialCertificate:prepareThreeEpochTargetConflictSeed(model,rows,high,possible)});
 assert.equal(compatible.status,'compatible-targets');assert.equal(compatible.work.feasibilitySolves,1);
 assert.deepEqual(compatible.compatibleWitness.coordinates,possible.witness.coordinates);
});

test('all51 mandatory constraints and50 targets remain inside the original maintained target solver limit',()=>{
 const model=simplex();while(model.rows.length<51){model.rows.push(Array.from({length:9},()=>ZERO));model.bounds.push(ONE);}
 const a=rising(),b=a.map(v=>sub(ONE,v)),rows=Array.from({length:50},(_,i)=>i%2?b:a),ceilings=Array.from({length:50},()=>q(.4));
 const r=findThreeEpochTargetConflict(model,rows,ceilings);verify(r);assert.equal(r.work.maximumConstraints,101);
 assert(r.work.feasibilitySolves<=THREE_EPOCH_TARGET_CONFLICT_LIMITS.feasibilitySolves);assert.equal(r.conflict.originalConstraintCount,51);
 assert.throws(()=>findThreeEpochTargetConflict(model,[...rows,a],[...ceilings,ONE]));
 const forged=rising();forged[63]=ONE;assert.throws(()=>findThreeEpochTargetConflict(model,[forged],[ONE]),/additive identity/);
 const broken=simplex();broken.bounds[0]=q(2);assert.throws(()=>findThreeEpochTargetConflict(broken,[a],[ONE]),/simplex constraints/);
 const sparse=[a,b];delete sparse[1];assert.throws(()=>findThreeEpochTargetConflict(simplex(),sparse,[ONE,ONE]));
 const invalid=structuredClone(r.conflict.certificate);invalid.dual[0]=q(-1);
 assert.throws(()=>verifyThreeEpochTargetLinearCertificate(r.conflict.linearModel.rows,r.conflict.linearModel.bounds,null,invalid),/Invalid exact Farkas/);
});
