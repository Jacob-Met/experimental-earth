import test from 'node:test';
import assert from 'node:assert/strict';
import {paretoIndices,comparePlacementTradeoffs,validatePlacementTradeoffs} from '../placement-tradeoffs.js';
import {makeExample,runRain} from '../core.js';
import {interpolateDepth} from '../infiltration-study.js';
import {comparePlacements} from '../placement-search.js';
const study={target:'existing',surface:'sealed',ratesMmHr:[.2,1,4]};
const query=(extra={})=>({eligibleCells:[0,1,2],maxEdits:2,surface:'garden',metric:'unabsorbedLiters',subset:'all',study,...extra});
function fixture(){const p=makeExample();p.width=p.height=2;p.selectedIndex=0;p.observations=[];p.existing=Array.from({length:4},()=>({surface:'sealed',elevationM:0,provenance:'Authored software control'}));p.proposal=structuredClone(p.existing);p.weather={...p.weather,rainMmHr:61,stormMinutes:10,durationMinutes:10,stepMinutes:5,mobilityPerHour:0,boundaryExitPerHour:0,cellSizeM:1};return p;}
const declaration=(extra={})=>({metrics:['unabsorbedLiters','maxDepthMm'],costUnit:'authored cost units',budget:25,cellCosts:[0,1,2].map(cellIndex=>({cellIndex,cost:10*(cellIndex+1),source:'Authored additive control, not a quote'})),...extra});
test('frontier preserves cost/effect choices and equal alternatives',()=>{
 assert.deepEqual(paretoIndices([[0,0],[2,-4],[3,-3],[2,-4],[1,-1]]),[0,1,3,4]);assert.deepEqual(paretoIndices([]),[]);assert.deepEqual(paretoIndices([[1,2],[1,2]]),[0,1]);
});
test('frontier agrees with independent sign-count oracle on all 729 three-point sets',()=>{
 const points=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)points.push([x,y]);
 for(const a of points)for(const b of points)for(const c of points){const rows=[a,b,c],expected=[];for(let i=0;i<3;i++){let beaten=false;for(let j=0;j<3;j++){const differences=rows[j].map((v,k)=>v-rows[i][k]);if(differences.filter(v=>v>0).length===0&&differences.filter(v=>v<0).length>0)beaten=true;}if(!beaten)expected.push(i);}assert.deepEqual(paretoIndices(rows),expected);}
});
test('malformed or partial coordinates cannot produce a frontier',()=>{
 for(const bad of [[[1,2],[1]],[[NaN,0]],[[Infinity,0]],[[]],new Array(2),[new Array(2)],[[1,,3]],Array.from({length:80},()=>[0])])assert.throws(()=>paretoIndices(bad));
});
test('actual solver retains complete source enumeration while cheaper alternatives survive budget',()=>{
 const p=fixture(),before=structuredClone(p),q=query(),baseline=comparePlacements(p,q),result=comparePlacementTradeoffs(p,q,declaration());const {tradeoffs,...unchanged}=result;
 assert.deepEqual(unchanged,baseline);assert.deepEqual(p,before);assert.equal(result.plans.length,7);assert.equal(tradeoffs.plans.length,7);assert.equal(tradeoffs.feasibleCount,3);
 assert.deepEqual(tradeoffs.frontier.map(i=>result.plans[i].cells).sort((a,b)=>a.length-b.length),[[],[0]]);
 for(const plan of tradeoffs.plans)assert.deepEqual(plan.coordinates.slice(1),tradeoffs.declaration.metrics.map(key=>result.plans[plan.index].metrics[key].max));
 assert.equal(tradeoffs.plans.filter(p=>p.rejection==='declared-budget').length,4);assert.ok(baseline.best.every(c=>c.length===2));
});
test('zero budget and impossible local targets never choose a closest layout',()=>{
 const zero=comparePlacementTradeoffs(fixture(),query(),declaration({budget:0}));assert.deepEqual(zero.tradeoffs.frontier.map(i=>zero.plans[i].cells),[[]]);
 const impossible=comparePlacementTradeoffs(fixture(),query({targets:[{cellIndex:3,maxPeakChangeMm:-1,basis:'Authored impossible untouched-cell control'}]}),declaration({budget:100}));assert.equal(impossible.tradeoffs.feasibleCount,0);assert.deepEqual(impossible.tradeoffs.frontier,[]);assert.ok(impossible.tradeoffs.plans.every(p=>p.rejection==='declared-targets'));
});
test('cost declarations reject missing duplicate nonfinite and unsupported coordinates',()=>{
 const p=fixture(),q=query(),d=declaration();
 for(const change of [{metrics:[]},{metrics:new Array(1)},{cellCosts:new Array(3)},{metrics:['exitLiters','exitLiters']},{metrics:['wrong']},{costUnit:' '},{budget:-1},{budget:Infinity},{cellCosts:d.cellCosts.slice(1)},{cellCosts:[d.cellCosts[0],d.cellCosts[0],d.cellCosts[2]]},{cellCosts:d.cellCosts.map((r,i)=>i?r:{...r,cost:NaN})},{cellCosts:d.cellCosts.map((r,i)=>i?r:{...r,source:''})}])assert.throws(()=>validatePlacementTradeoffs(p,q,{...d,...change}));
});
test('held-aside values cannot refit calibration support and incompatible evidence has no frontier',()=>{
 const p=fixture(),model=runRain(p.existing,p.width,p.height,p.weather,{surfaceInfiltrationOverride:{surface:'sealed',rateMmHr:1}}),depthMm=interpolateDepth(model,0,10).depthMm;
 p.observations=[{cellIndex:0,minute:10,depthMm,uncertaintyMm:0,source:'Authored calibration control, not field evidence',scenario:'existing',use:'calibration'},{cellIndex:0,minute:10,depthMm:1000,uncertaintyMm:0,source:'Authored held-aside contradiction',scenario:'existing',use:'challenge'}];
 const q=query({subset:'calibration'}),d=declaration(),first=comparePlacementTradeoffs(p,q,d);assert.equal(first.status,'compared');assert.deepEqual(first.ratesMmHr,[1]);
 const incompatible=comparePlacementTradeoffs(p,{...q,subset:'surviving'},d);assert.equal(incompatible.status,'no-compatible-rates');assert.deepEqual(incompatible.tradeoffs.frontier,[]);
 p.observations[1].depthMm=0;const changed=comparePlacementTradeoffs(p,q,d);assert.deepEqual(changed.plans,first.plans);assert.deepEqual(changed.tradeoffs,first.tradeoffs);
 p.observations[0].depthMm=1000;const failed=comparePlacementTradeoffs(p,q,d);assert.equal(failed.status,'no-compatible-rates');assert.deepEqual(failed.tradeoffs.frontier,[]);
 p.observations=[];const missing=comparePlacementTradeoffs(p,q,d);assert.equal(missing.status,'need-calibration');assert.deepEqual(missing.tradeoffs.frontier,[]);
});
