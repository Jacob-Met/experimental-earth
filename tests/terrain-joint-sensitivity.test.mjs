import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain } from '../core.js';
import { compareTerrainSensitivity } from '../terrain-sensitivity.js';
import { compareJointTerrainSensitivity as compare } from '../terrain-joint-sensitivity.js';
export function jointFixture() {
  const p=makeExample(); p.proposal=structuredClone(p.existing); p.proposal[1].elevationM-=.025;
  for(const i of [2,10])p.existing[i].terrainSource={kind:'supplied-elevation-table/1',fileName:'joint.csv',line:i+2,datum:'Authored local zero',source:'Computational control, not acquired survey',unit:'cm',elevationValue:p.existing[i].elevationM*100,uncertaintyValue:5,cellSizeM:p.weather.cellSizeM};
  return p;
}
const options={cellIndices:[2,10],transferConfirmed:true};
test('joint corner reverses an effect absent from both densely sampled isolated axes',()=>{
  const p=jointFixture(),r=compare(p,options);
  for(const cellIndex of options.cellIndices)assert.equal(compareTerrainSensitivity(p,{cellIndex,transferConfirmed:true,sampleCount:17}).metrics.peakPondingLiters.direction,'lower');
  assert.equal(r.metrics.peakPondingLiters.direction,'reverses');
  assert.ok(Math.abs(r.candidates[8].metrics.peakPondingLiters.delta-.5697751328889353)<1e-10);
  assert.equal(r.candidateCount,9);
});
test('every complete combination equals direct runs, including all local depths and mass balance',()=>{
  const p=jointFixture(),r=compare(p,options);
  for(const c of r.candidates){const runs={};for(const target of ['existing','proposal']){
    const cells=structuredClone(p[target]);r.cellIndices.forEach((i,a)=>{cells[i].elevationM+=c.offsetsM[a];delete cells[i].terrainSource;});
    runs[target]=runRain(cells,p.width,p.height,p.weather);
    for(const key of Object.keys(c.metrics))assert.equal(c.metrics[key][target],runs[target][key]);
    assert.equal(c.massErrorLiters[target],runs[target].massErrorLiters);assert.ok(Math.abs(c.massErrorLiters[target])<1e-7);
  }
  c.cells.forEach((row,i)=>{assert.equal(row.existingFinalMm,runs.existing.finalDepthMm[i]);assert.equal(row.proposalFinalMm,runs.proposal.finalDepthMm[i]);assert.equal(row.existingPeakMm,runs.existing.peakDepthMm[i]);assert.equal(row.proposalPeakMm,runs.proposal.peakDepthMm[i]);assert.equal(row.finalDeltaMm,runs.proposal.finalDepthMm[i]-runs.existing.finalDepthMm[i]);assert.equal(row.peakDeltaMm,runs.proposal.peakDepthMm[i]-runs.existing.peakDepthMm[i]);});}
});
test('central slices retain single-axis parity; supplied axis order cannot alter the report',()=>{
  const p=jointFixture(),r=compare(p,options);assert.deepEqual(r,compare(p,{...options,cellIndices:[10,2]}));
  for(let a=0;a<2;a++){const single=compareTerrainSensitivity(p,{cellIndex:options.cellIndices[a],transferConfirmed:true});
    single.candidates.forEach((s,i)=>{const c=r.candidates.find(c=>c.axisIndices[a]===i&&c.axisIndices[1-a]===1);for(const key of ['metrics','cells','massErrorLiters'])assert.deepEqual(c[key],s[key]);});}
});
test('both authored changes and source custody survive all combinations',()=>{
  const p=jointFixture();p.proposal[2].elevationM+=.03;p.proposal[10].elevationM-=.02;
  const before=JSON.stringify(p),r=compare(p,options);assert.equal(JSON.stringify(p),before);
  for(const c of r.candidates)c.elevations.forEach((e,a)=>assert.ok(Math.abs((e.proposalElevationM-e.existingElevationM)-r.axes[a].interventionDeltaM)<1e-15));
  r.axes[0].source.source='mutated report';r.axes[1].originalExisting.terrainSource.source='mutated clone';assert.equal(JSON.stringify(p),before);
});
test('complete family budget refuses rather than silently reducing requested samples',()=>{
  const p=jointFixture();assert.equal(compare(p,{...options,sampleCount:5}).candidateCount,25);
  assert.equal(compare(p,{...options,sampleCount:9}).candidateCount,81);
  assert.throws(()=>compare(p,{...options,sampleCount:17}),/million/);
  assert.throws(()=>compare(p,{...options,sampleCount:4}),/samples/);
});
test('distinct supplied axes, common datum, explicit transfer and compatible proposal are required',()=>{
  assert.throws(()=>compare(jointFixture(),{...options,cellIndices:[2,2]}),/distinct/);
  assert.throws(()=>compare(jointFixture(),{...options,cellIndices:[2,10,1]}),/distinct/);
  assert.throws(()=>compare(jointFixture(),{...options,transferConfirmed:false}),/Confirm/);
  for(const mutate of [p=>delete p.existing[10].terrainSource,p=>p.existing[10].terrainSource.uncertaintyValue=0,p=>p.existing[10].terrainSource.datum='Different datum',p=>p.proposal[10].terrainSource={...p.existing[10].terrainSource,source:'Separate'},p=>p.proposal[10].elevationM=9.99]){
    const p=jointFixture();mutate(p);const before=JSON.stringify(p);assert.throws(()=>compare(p,options));assert.equal(JSON.stringify(p),before);
  }
});
test('mixed units preserve normalized hypotheses; unchanged plans retain zero effects',()=>{
  const p=jointFixture(),r=compare(p,options);p.existing[10].terrainSource.unit='mm';p.existing[10].terrainSource.elevationValue*=10;p.existing[10].terrainSource.uncertaintyValue*=10;assert.deepEqual(compare(p,options).candidates,r.candidates);
  p.proposal=structuredClone(p.existing);for(const summary of Object.values(compare(p,options).metrics))assert.equal(summary.direction,'unchanged');
});
