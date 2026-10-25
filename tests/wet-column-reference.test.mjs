import test from 'node:test';
import assert from 'node:assert/strict';
import {compareWetColumnReference} from '../evaluation/wet-column-reference.js';

test('incumbent and maintained substeps match independently derived discrete wet equation',()=>{
 const result=compareWetColumnReference();
 assert.equal(result.rows.length,30);
 for(const row of result.rows){
  assert.ok(Math.abs(row.discreteResidualMm)<1e-9);
  assert.ok(Math.abs(row.meanDepthErrorMm)<1e-9);
  assert.ok(Math.abs(row.massErrorLiters)<1e-8);
  assert.ok(row.minDepthMm>0);
 }
 const base=result.rows.filter(r=>r.method==='incumbent');
 assert.ok(base.every((r,i)=>!i||Math.abs(r.contrastErrorMm)<Math.abs(base[i-1].contrastErrorMm)));
 const ratio=base.at(-2).contrastErrorMm/base.at(-1).contrastErrorMm;
 assert.ok(ratio>1.9&&ratio<2.1);
 assert.ok(Math.abs(base.at(-1).continuousContrastMm-5.056964470628461)<1e-12);
 for(const row of result.rows.filter(r=>r.method==='maintained-substeps'&&r.substeps===1)){
  assert.deepEqual(row.finalDepthMm,base.find(r=>r.stepMinutes===row.stepMinutes).finalDepthMm);
 }
});
test('changed forcing/mobility/duration preserve analytic checks with q=0 boundary',()=>{
 const options={rainMmHr:20,mobilityPerHour:1,durationMinutes:120,stepsMinutes:[30,15,5,1],substeps:[1,8]};
 const copy=structuredClone(options),result=compareWetColumnReference(options);assert.deepEqual(options,copy);
 for(const row of result.rows)assert.ok(Math.abs(row.discreteResidualMm)<1e-9);
 assert.equal(result.rows[0].discreteContrastMm,0);
});
test('dry, unsupported and malformed declarations refuse the smooth reference',()=>{
 for(const options of [{rainMmHr:8},{rainMmHr:9},{rainMmHr:NaN},{mobilityPerHour:0},{stepsMinutes:[.5]},{stepsMinutes:[7]},{stepsMinutes:[5,5]},{mobilityPerHour:2},{substeps:[0]},{substeps:[2,2]},{durationMinutes:721}])
  assert.throws(()=>compareWetColumnReference(options));
});
