import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain } from '../core.js';
import { compareTerrainSensitivity, TERRAIN_SENSITIVITY_BUDGET } from '../terrain-sensitivity.js';

export function fixture() {
  const p = makeExample(); p.proposal = structuredClone(p.existing); p.proposal[1].elevationM -= .025;
  p.existing[1].terrainSource = {kind:'supplied-elevation-table/1',fileName:'authored.csv',line:3,
    datum:'Authored local zero',source:'Authored computational control, not a field survey',unit:'cm',
    elevationValue:p.existing[1].elevationM*100,uncertaintyValue:5,cellSizeM:p.weather.cellSizeM};
  return p;
}
const compare = p => compareTerrainSensitivity(p,{cellIndex:1,transferConfirmed:true});
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
test('supplied interval reverses the authored lowering effect, retaining original sources', () => {
  const p=fixture(), before=JSON.stringify(p), r=compare(p);
  assert.equal(r.metrics.peakPondingLiters.direction,'reverses');
  [0.9396958073084534,-1.5093844903258287,-3.424701051845659].forEach((v,i)=>near(r.candidates[i].metrics.peakPondingLiters.delta,v));
  assert.equal(JSON.stringify(p),before); assert.deepEqual(r.source,p.existing[1].terrainSource);
  r.source.source='changed report'; assert.equal(JSON.stringify(p),before);
  for(const c of r.candidates) near(c.proposalElevationM-c.existingElevationM,-.025);
});
test('every sampled quantity and every local depth equals a separate maintained solver oracle',()=>{
  const p=fixture(),r=compare(p);
  for(const c of r.candidates){const runs={};for(const target of ['existing','proposal']){
    const cells=structuredClone(p[target]);delete cells[1].terrainSource;cells[1].elevationM+=c.offsetM;
    runs[target]=runRain(cells,p.width,p.height,p.weather);
    for(const key of Object.keys(c.metrics))assert.equal(c.metrics[key][target],runs[target][key]);
    assert.ok(Math.abs(c.massErrorLiters[target])<1e-7);
  }
  c.cells.forEach((row,i)=>{assert.equal(row.finalDeltaMm,runs.proposal.finalDepthMm[i]-runs.existing.finalDepthMm[i]);assert.equal(row.peakDeltaMm,runs.proposal.peakDepthMm[i]-runs.existing.peakDepthMm[i]);});
  }
});
test('identical plans retain identical effects and copied survey origins are accepted',()=>{
  const p=fixture();p.proposal=structuredClone(p.existing);const r=compare(p);
  for(const m of Object.values(r.metrics))assert.equal(m.direction,'unchanged');
  for(const c of r.candidates)for(const row of c.cells){assert.equal(row.finalDeltaMm,0);assert.equal(row.peakDeltaMm,0);}
});
test('explicit assumption and sourced positive intervals are required',()=>{
  const p=fixture();assert.throws(()=>compareTerrainSensitivity(p,{cellIndex:1}),/Confirm/);
  for(const cellIndex of [-1,48,1.5,NaN])assert.throws(()=>compareTerrainSensitivity(p,{cellIndex,transferConfirmed:true}),/Choose/);
  delete p.existing[1].terrainSource;assert.throws(()=>compare(p),/source/);
  const q=fixture();q.existing[1].terrainSource.uncertaintyValue=0;assert.throws(()=>compare(q),/positive/);
});
test('separately surveyed proposal and endpoint overflow refuse without source mutation',()=>{
  const p=fixture();p.proposal[1].terrainSource={...p.existing[1].terrainSource,elevationValue:p.proposal[1].elevationM*100,source:'Separate proposal'};
  const before=JSON.stringify(p);assert.throws(()=>compare(p),/separately surveyed/);assert.equal(JSON.stringify(p),before);
  const q=fixture();q.proposal[1].elevationM=9.99;assert.throws(()=>compare(q),/range/);
  const low=fixture();low.existing[1].elevationM=-9.99;low.existing[1].terrainSource.elevationValue=-999;assert.throws(()=>compare(low),/range/);
});
test('unit normalization preserves the experiment and literal source text',()=>{
  const p=fixture(),q=structuredClone(p);q.existing[1].terrainSource.unit='mm';q.existing[1].terrainSource.elevationValue*=10;q.existing[1].terrainSource.uncertaintyValue*=10;
  assert.deepEqual(compare(p).candidates,compare(q).candidates);
  p.existing[1].terrainSource.source='<img onerror=alert(1)>';assert.equal(compare(p).source.source,'<img onerror=alert(1)>');
});
test('work accounting reserves all six runs and refuses supported oversized grids',()=>{
  const p=fixture(),r=compare(p);assert.equal(r.cellStepUpperBound,6*48*Math.ceil(p.weather.durationMinutes/p.weather.stepMinutes));assert.ok(r.cellStepUpperBound<=TERRAIN_SENSITIVITY_BUDGET);
  p.width=24;p.height=24;p.existing=Array.from({length:576},()=>({surface:'sealed',elevationM:0,provenance:'Authored work-limit control'}));p.proposal=structuredClone(p.existing);p.existing[1].terrainSource={...fixture().existing[1].terrainSource,elevationValue:0};p.weather.durationMinutes=720;p.weather.stepMinutes=1;
  assert.throws(()=>compare(p),/million/);
});

test('three same-sign samples do not establish a sign across the continuous interval',()=>{
  const p=fixture();delete p.existing[1].terrainSource;p.existing[0].terrainSource={...fixture().existing[1].terrainSource,line:2,elevationValue:p.existing[0].elevationM*100};
  const r=compareTerrainSensitivity(p,{cellIndex:0,transferConfirmed:true});assert.equal(r.metrics.peakPondingLiters.direction,'lower');
  const runs={};for(const target of ['existing','proposal']){const cells=structuredClone(p[target]);delete cells[0].terrainSource;cells[0].elevationM+=.025;runs[target]=runRain(cells,p.width,p.height,p.weather);}
  near(runs.proposal.peakPondingLiters-runs.existing.peakPondingLiters,.09875758056296036);
});

test('explicit denser samples expose the interior reversal and retain all original hypotheses',()=>{
  const p=fixture();delete p.existing[1].terrainSource;p.existing[0].terrainSource={...fixture().existing[1].terrainSource,line:2,elevationValue:p.existing[0].elevationM*100};
  const before=JSON.stringify(p),base=compareTerrainSensitivity(p,{cellIndex:0,transferConfirmed:true});
  for(const sampleCount of [5,9,17]){
    const r=compareTerrainSensitivity(p,{cellIndex:0,transferConfirmed:true,sampleCount});
    assert.equal(r.candidates.length,sampleCount);assert.equal(r.sampleCount,sampleCount);assert.equal(r.metrics.peakPondingLiters.direction,'reverses');
    assert.equal(r.cellStepUpperBound,2*sampleCount*48*Math.ceil(p.weather.durationMinutes/p.weather.stepMinutes));
    for(const b of base.candidates)assert.deepEqual(r.candidates.find(c=>c.offsetM===b.offsetM),b);
    near(r.candidates.find(c=>c.offsetM===.025).metrics.peakPondingLiters.delta,.09875758056296036);
    for(const c of r.candidates)near(c.proposalElevationM-c.existingElevationM,0);
  }
  assert.equal(JSON.stringify(p),before);
});
test('sample count must be explicit supported integer; larger requested work refuses as a whole',()=>{
  for(const sampleCount of [0,2,4,18,100,'5',null,NaN])assert.throws(()=>compareTerrainSensitivity(fixture(),{cellIndex:1,transferConfirmed:true,sampleCount}),/samples/);
  const p=fixture();p.width=24;p.height=24;p.existing=Array.from({length:576},()=>({surface:'sealed',elevationM:0,provenance:'Authored budget control'}));p.proposal=structuredClone(p.existing);p.existing[1].terrainSource={...fixture().existing[1].terrainSource,elevationValue:0};p.weather.durationMinutes=360;
  assert.ok(compare(p).cellStepUpperBound<1000000);
  assert.throws(()=>compareTerrainSensitivity(p,{cellIndex:1,transferConfirmed:true,sampleCount:17}),/million/);
});
