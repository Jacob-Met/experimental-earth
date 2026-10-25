import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain } from '../core.js';
import { withInternalCrest } from '../internal-barriers.js';
import { compareSharedGround as compare } from '../terrain-shared-ground.js';
import { compareTerrainSensitivity } from '../terrain-sensitivity.js';
import { compareJointTerrainSensitivity } from '../terrain-joint-sensitivity.js';
const basis='Authored common additive ground-error control, not acquired error correlation';
function fixture(){const p=makeExample();p.proposal=structuredClone(p.existing);p.proposal[1].elevationM-=.025;for(const[i,c]of p.existing.entries())c.terrainSource={kind:'supplied-elevation-table/1',fileName:'footprint.csv',line:i+2,datum:'Authored local zero',source:'Authored computational control',unit:'cm',elevationValue:c.elevationM*100,uncertaintyValue:5,cellSizeM:p.weather.cellSizeM};return p;}
const options={cellIndices:[2,10],basis,transferConfirmed:true};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('one-cell shared error equals all single-cell samples; pair equals the complete joint diagonal',()=>{
 const p=fixture();for(const sampleCount of [3,5,9,17]){
  const single=compareTerrainSensitivity(p,{cellIndex:2,transferConfirmed:true,sampleCount}),shared=compare(p,{...options,cellIndices:[2],sampleCount});
  single.candidates.forEach((s,i)=>{const c=shared.candidates[i];for(const key of ['label','offsetM','metrics','cells','massErrorLiters'])assert.deepEqual(c[key],s[key]);assert.equal(c.elevations[0].existingElevationM,s.existingElevationM);});
 }
 const joint=compareJointTerrainSensitivity(p,{cellIndices:[2,10],transferConfirmed:true,sampleCount:5}),shared=compare(p,{...options,sampleCount:5});
 shared.candidates.forEach((c,i)=>{const j=joint.candidates[i*5+i];for(const key of ['elevations','metrics','cells','massErrorLiters'])assert.deepEqual(c[key],j[key]);});
});
test('every sample matches independently constructed runs at every metric and local cell',()=>{
 const p=fixture();p.existing[10].terrainSource.uncertaintyValue=2;p.proposal[2].elevationM+=.03;
 const r=compare(p,{...options,cellIndices:[1,2,10],sampleCount:5});assert.equal(r.commonHalfWidthM,.02);
 for(const c of r.candidates){const runs={};for(const target of ['existing','proposal']){
  const cells=structuredClone(p[target]);for(const i of r.cellIndices){cells[i].elevationM+=c.offsetM;delete cells[i].terrainSource;}runs[target]=runRain(cells,p.width,p.height,p.weather);
  for(const key of Object.keys(c.metrics))assert.equal(c.metrics[key][target],runs[target][key]);assert.equal(c.massErrorLiters[target],runs[target].massErrorLiters);assert.ok(Math.abs(c.massErrorLiters[target])<1e-7);
 }
 c.cells.forEach((row,i)=>{assert.equal(row.existingFinalMm,runs.existing.finalDepthMm[i]);assert.equal(row.proposalFinalMm,runs.proposal.finalDepthMm[i]);assert.equal(row.existingPeakMm,runs.existing.peakDepthMm[i]);assert.equal(row.proposalPeakMm,runs.proposal.peakDepthMm[i]);});
 c.elevations.forEach((e,a)=>near(e.proposalElevationM-e.existingElevationM,r.axes[a].interventionDeltaM));}
});
test('complete-footprint ground translation preserves bare geometry but not a fixed absolute crest',()=>{
 let p=fixture();const all={...options,cellIndices:p.existing.map((_,i)=>i)};
 const bare=compare(p,all);for(const c of bare.candidates)near(c.metrics.peakPondingLiters.delta,-1.5093844903258287);
 for(const target of ['existing','proposal'])p=withInternalCrest(p,target,1,'east',.11,'Authored fixed absolute crest');
 const fixed=compare(p,all);[-.9708695513108978,-.9708695513108978,-1.5093844903258287].forEach((v,i)=>near(fixed.candidates[i].metrics.peakPondingLiters.delta,v));assert.equal(fixed.fixedReferences.unselectedTerrain.length,0);assert.equal(fixed.fixedReferences.crests.length,2);
 for(const offset of [-.05,.05]){const runs={};for(const target of ['existing','proposal']){const cells=structuredClone(p[target]);for(const cell of cells){cell.elevationM+=offset;delete cell.terrainSource;for(const edge of Object.values(cell.internalBarriers??{}))if('crestElevationM'in edge)edge.crestElevationM+=offset;}runs[target]=runRain(cells,p.width,p.height,p.weather);}near(runs.proposal.peakPondingLiters-runs.existing.peakPondingLiters,-.9708695513108978);}
});
test('the common interval is the supplied intersection; a declared smaller interval is explicit',()=>{
 const p=fixture();p.existing[2].terrainSource.uncertaintyValue=2;const r=compare(p,options);
 assert.equal(r.maximumHalfWidthM,.02);assert.deepEqual(r.limitingCellIndices,[2]);assert.deepEqual(r.offsetsM,[-.02,0,.02]);
 assert.deepEqual(compare(p,{...options,halfWidthM:.01}).offsetsM,[-.01,0,.01]);
 for(const halfWidthM of [.021,0,-.01,NaN,Infinity,'0.01',null])assert.throws(()=>compare(p,{...options,halfWidthM}));
});
test('all selected cells and original sources remain intact, ordered independently of input order',()=>{
 let p=fixture();p=withInternalCrest(p,'existing',1,'east',.11,'Fixed original <img>');p.existing[10].terrainSource.fileName='separate-name.csv';
 const before=JSON.stringify(p),r=compare(p,options);assert.deepEqual(compare(p,{...options,cellIndices:[10,2]}),r);assert.equal(JSON.stringify(p),before);
 assert.deepEqual(r.axes.map(a=>a.source),r.cellIndices.map(i=>p.existing[i].terrainSource));assert.equal(r.fixedReferences.unselectedTerrain.length,46);assert.equal(r.fixedReferences.crests[0].source,'Fixed original <img>');
 r.axes[0].source.source='changed';r.axes[1].originalExisting.terrainSource.source='changed';r.fixedReferences.crests[0].source='changed';assert.equal(JSON.stringify(p),before);
 const declared='  Explicit basis <script>  ';assert.equal(compare(p,{...options,basis:declared}).basis,declared);
});
test('one missing, zero or incompatible source refuses the entire selected footprint',()=>{
 for(const mutate of [p=>delete p.existing[10].terrainSource,p=>p.existing[10].terrainSource.uncertaintyValue=0,p=>p.existing[10].terrainSource.datum='Other datum',p=>p.proposal[10].terrainSource={...p.existing[10].terrainSource,source:'Separate proposal'},p=>p.existing[10].terrainSource.cellSizeM=1]){
  const p=fixture();mutate(p);const before=JSON.stringify(p);assert.throws(()=>compare(p,options));assert.equal(JSON.stringify(p),before);
 }
 for(const cellIndices of [[],[2,2],[2,48],[2,-1],[2,1.5]])assert.throws(()=>compare(fixture(),{...options,cellIndices}));
 for(const declared of ['', '  ', null, 'x'.repeat(1001)])assert.throws(()=>compare(fixture(),{...options,basis:declared}),/basis/);
 assert.throws(()=>compare(fixture(),{...options,transferConfirmed:false}),/Confirm/);
});
test('shared candidates are range-checked after intersecting sources, never clipped',()=>{
 const p=fixture();p.existing[2].elevationM=9.99;p.existing[2].terrainSource.elevationValue=999;p.existing[10].terrainSource.uncertaintyValue=.5;
 const r=compare(p,options);assert.equal(r.commonHalfWidthM,.005);near(r.candidates[2].elevations[0].existingElevationM,9.995);
 assert.throws(()=>compareTerrainSensitivity(p,{cellIndex:2,transferConfirmed:true}),/range/);
 p.existing[10].terrainSource.uncertaintyValue=5;assert.throws(()=>compare(p,options),/range/);
});
test('complete sample budget and sample-count bounds are enforced before execution',()=>{
 const p=fixture(),r=compare(p,{...options,sampleCount:17});assert.equal(r.cellStepUpperBound,34*48*48);
 for(const sampleCount of [2,4,18,'3',NaN])assert.throws(()=>compare(p,{...options,sampleCount}),/samples/);
 p.width=24;p.height=24;p.existing=Array.from({length:576},()=>({surface:'sealed',elevationM:0,provenance:'Authored budget control'}));p.proposal=structuredClone(p.existing);for(const i of [2,10])p.existing[i].terrainSource={...fixture().existing[i].terrainSource,elevationValue:0};p.weather.durationMinutes=720;p.weather.stepMinutes=1;
 assert.throws(()=>compare(p,options),/million/);
});
test('mixed supplied units retain the same common interval and paired results',()=>{
 const p=fixture(),q=structuredClone(p);q.existing[10].terrainSource.unit='mm';q.existing[10].terrainSource.elevationValue*=10;q.existing[10].terrainSource.uncertaintyValue*=10;
 assert.deepEqual(compare(p,options).candidates,compare(q,options).candidates);
});
