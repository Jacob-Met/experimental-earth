import test from 'node:test';
import assert from 'node:assert/strict';
import {rational as q,cmp} from '../vendor/chronos/exact-halfplanes.mjs';
import {solveRationalLinearObjectives as solve,verifyRationalLinearCertificate as verify} from '../shade-heat-exact-linear.js';
const rows=value=>value.map(row=>row.map(q)),vector=value=>value.map(q);
const check=(a,b,c)=>{const A=rows(a),B=vector(b),C=rows(c),result=solve(A,B,C);verify(A,B,null,result.certificate);result.results.forEach((proof,i)=>verify(A,B,C[i],proof));return result;};

test('exact complete objective family returns primal and dual bounds without changing originals',()=>{
  const A=rows([[1,1],[1,0],[0,1]]),b=vector([4,2,3]),c=rows([[3,2],[-1,0],[0,-1],[0,0]]);
  const before=structuredClone({A,b,c});for(const row of [...A,c[0],...c.slice(1)]){for(const value of row)Object.freeze(value);Object.freeze(row);}
  const r=solve(A,b,c);assert.equal(r.status,'feasible');assert.equal(cmp(r.results[0].value,q(10)),0);assert.deepEqual(r.results[0].point,vector([2,2]));
  assert.equal(cmp(r.results[1].value,q(0)),0);assert.equal(cmp(r.results[2].value,q(0)),0);assert.equal(cmp(r.results[3].value,q(0)),0);
  r.results.forEach((proof,i)=>verify(A,b,c[i],proof));assert.deepEqual({A,b,c},before);
  r.results[0].point[0][0]=999n;assert.equal(cmp(solve(A,b,c).results[0].value,q(10)),0);
});

test('negative original bounds, exact equality and redundant constraints keep correct feasibility',()=>{
  const r=check([[-1],[1],[2]],[-1,1,2],[[1],[-1]]);assert.equal(r.status,'feasible');assert.deepEqual(r.results.map(x=>x.value),vector([1,-1]));assert(r.work.phaseIPivots>0);
  const emptyObjectives=check([[-1],[1]],[-1,2],[]);assert.equal(emptyObjectives.status,'feasible');assert.deepEqual(emptyObjectives.results,[]);
});

test('incompatible originals carry a strict Farkas certificate, including zero coefficient contradictions',()=>{
  for(const [A,b]of [[[[1],[-1]],[0,-1]],[[[0]],[-1]]]){
    const r=check(A,b,[[1]]);assert.equal(r.status,'incompatible');assert.deepEqual(r.results,[]);assert(r.certificate.contradiction[0]<0n);
    const forged=structuredClone(r.certificate);forged.contradiction=q(0);assert.throws(()=>verify(rows(A),vector(b),null,forged),/contradiction/);
  }
});

test('unbounded objectives carry an original feasible point and a checked positive ray',()=>{
  const r=check([[-1]],[-1],[[1],[-1]]);assert.equal(r.results[0].status,'unbounded');assert.equal(r.results[1].status,'optimal');assert.deepEqual(r.results[1].value,q(-1));
  const forged=structuredClone(r.results[0]);forged.ray=vector([0]);assert.throws(()=>verify(rows([[-1]]),vector([-1]),vector([1]),forged),/gain/);
});

test('Bland pivots escape the degenerate cycling control without perturbing coefficients',()=>{
  const r=check([[.5,-5.5,-2.5,9],[.5,-1.5,-.5,1],[1,0,0,0]],[0,0,1],[[10,-57,-9,-24]]);
  assert.equal(r.results[0].status,'optimal');assert.deepEqual(r.results[0].value,q(1));assert(r.work.pivots>1);
});

test('strict dimensions, complete arrays and bounded arithmetic/pivots refuse without a partial result',()=>{
  const A=rows([[1,1],[1,0],[0,1]]),b=vector([4,2,3]),c=rows([[3,2]]);
  for(const options of [{maxPivots:0},{maxRationalOperations:0},{maxPivots:2049},{maxRationalOperations:4000001},{unexpected:true}])assert.throws(()=>solve(A,b,c,options));
  const sparse=rows([[1,1],[1,0],[0,1]]);delete sparse[0][1];assert.throws(()=>solve(sparse,b,c));
  const bad=structuredClone(A);bad[0][0]=[1n,0n];assert.throws(()=>solve(bad,b,c));bad[0][0]=[1n<<4096n,1n];assert.throws(()=>solve(bad,b,c));
  assert.throws(()=>solve(A,b,Array(1)));assert.throws(()=>solve(Array.from({length:51},()=>vector([1])),Array.from({length:51},()=>q(1)),[vector([1])]));
  const proof=solve(A,b,c).results[0],changed=structuredClone(proof);changed.value=q(11);assert.throws(()=>verify(A,b,c[0],changed),/equality/);
  const wrongDual=structuredClone(proof);wrongDual.dual=vector([0,0,0]);assert.throws(()=>verify(A,b,c[0],wrongDual),/dual/);
});
