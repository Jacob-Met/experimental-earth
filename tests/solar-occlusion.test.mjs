import test from 'node:test';import assert from 'node:assert/strict';
import {makeExample,validateProject,compare} from '../core.js';
import {prepareSolarStudy,compareSolarOcclusion,rayColumn,solarDirection} from '../solar-occlusion.js';
function fixture(){const p=makeExample();p.width=4;p.height=2;p.selectedIndex=0;p.existing=Array.from({length:8},()=>({surface:'turf',elevationM:0,provenance:'Authored flat ground'}));p.proposal=structuredClone(p.existing);p.weather.cellSizeM=2;return p;}
const column=(min=2,max=min)=>({cellIndex:2,heightMinM:min,heightMaxM:max,source:'Authored opaque box: front x4m, back x6m'});
function model(p,over={}){p.solarStudy=prepareSolarStudy(p,{headingDeg:0,elevationDeg:45,sunSource:'Authored direction toward increasing grid columns, not geographic azimuth',existing:[],proposal:[column()],...over});return compareSolarOcclusion(p);}
test('analytic45/30 degree extents and height controls change only conditional point shading',()=>{
 const p=fixture();let r=model(p);assert.equal(r.proposal[1].status,'blocked');assert.equal(r.proposal[0].status,'no-mapped-blocker');assert.equal(r.proposal[2].status,'footprint');
 r=model(p,{elevationDeg:30});assert.equal(r.proposal[0].status,'blocked');r=model(p,{proposal:[column(4)]});assert.equal(r.proposal[0].status,'blocked');
 r=model(p,{headingDeg:180});assert.equal(r.proposal[0].status,'no-mapped-blocker');assert.equal(r.proposal[3].status,'blocked');
});
test('height bounds distinguish robust blocking, unresolved heights and exact grazing',()=>{
 const p=fixture();assert.equal(model(p,{proposal:[column(.5,2)]}).proposal[1].status,'height-dependent');
 assert.equal(model(p,{proposal:[column(0,1)]}).proposal[1].status,'grazing');
 assert.equal(model(p,{proposal:[column(1.01,2)]}).proposal[1].status,'blocked');
 assert.equal(model(p,{proposal:[column(0,.99)]}).proposal[1].status,'no-mapped-blocker');
});
test('overhead and parallel slab rays retain geometry boundary distinctions',()=>{
 const p=fixture();const r=model(p,{elevationDeg:90});assert.ok(r.proposal.every((x,i)=>x.status===(i===2?'footprint':'no-mapped-blocker')));
 assert.deepEqual(solarDirection(0,90),[0,0,1]);assert.equal(rayColumn([0,0,0],[0,0,1],[1,1,1],[2,2,2]),null);
 assert.deepEqual(rayColumn([1.5,1.5,0],[0,0,1],[1,1,1],[2,2,2]),{enter:1,exit:2});
 assert.ok(rayColumn([1,1.5,0],[0,0,1],[1,1,1],[2,2,2]));assert.equal(rayColumn([1,1.5,0],[0,0,1],[1,1,1],[2,2,2],-1e-8),null);
});
test('declared terrain can obstruct; source attribution and paired changes remain inspectable',()=>{
 const p=fixture();p.existing[2].elevationM=2;p.proposal=structuredClone(p.existing);const r=model(p,{proposal:[]});assert.equal(r.existing[1].status,'blocked');assert.equal(r.existing[1].witness.kind,'declared terrain');assert.deepEqual(r.changes,[]);
 const q=fixture();const a=model(q),b=model(q,{existing:[column()],proposal:[]});assert.deepEqual(a.existing,b.proposal);assert.deepEqual(a.proposal,b.existing);
});
test('solar records never modify rain behavior, ground or saved inputs; stale source refuses',()=>{
 const p=fixture(),rain=compare(p);model(p);const before=structuredClone(p);compareSolarOcclusion(p);assert.deepEqual(p,before);assert.deepEqual(compare(p),rain);
 const saved=JSON.parse(JSON.stringify(p));saved.solarStudy.results={status:'sunlit'};assert.equal(compareSolarOcclusion(validateProject(saved)).proposal[1].status,'blocked');
 for(const edit of [q=>q.width=2,q=>q.weather.cellSizeM=1,q=>q.existing[0].elevationM=.1,q=>q.source='changed']){const q=structuredClone(p);edit(q);if(q.width===2){q.height=4;}assert.equal(compareSolarOcclusion(q).status,'context-changed');}
 const q=structuredClone(p);q.weather.rainMmHr=7;assert.equal(compareSolarOcclusion(q).status,'compared');
});
test('explicit source, angle, interval, duplicate and work bounds refuse',()=>{
 const p=fixture();for(const change of [{headingDeg:360},{elevationDeg:0},{sunSource:''},{proposal:[column(3,2)]},{proposal:[column(),column()]},{proposal:[{...column(),source:''}]}])assert.throws(()=>model(p,change));
 assert.throws(()=>model(p,{proposal:Array.from({length:65},(_,cellIndex)=>({...column(),cellIndex}))}));
 assert.equal(model(p,{proposal:[]}).proposal.every(x=>x.status==='no-mapped-blocker'),true);
});

test('retained survey provenance changes invalidate without propagating or erasing its uncertainty',()=>{
 const p=fixture();p.existing[0].terrainSource={kind:'supplied-elevation-table/1',fileName:'authored.csv',line:2,datum:'authored datum',source:'software control',unit:'m',elevationValue:0,uncertaintyValue:.2,cellSizeM:2};model(p);const before=structuredClone(p.existing[0].terrainSource);
 compareSolarOcclusion(p);assert.deepEqual(p.existing[0].terrainSource,before);p.existing[0].terrainSource.line=3;assert.equal(compareSolarOcclusion(p).status,'context-changed');
});
test('maximum admitted grid and metric spacing remain bounded and finite',()=>{
 const p=fixture();p.width=p.height=24;p.weather.cellSizeM=100;p.existing=Array.from({length:576},()=>({...p.existing[0]}));p.proposal=structuredClone(p.existing);const r=model(p,{proposal:[column(50,100)],elevationDeg:1});assert.equal(r.proposal.length,576);assert.ok(r.proposal.every(x=>Object.hasOwn(x,'status')&&(!x.witness||Number.isFinite(x.witness.distanceM))));
});
