import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeSunPathSpatial,inspectSunPathSpatial,SUN_PAIR_CATEGORIES} from '../solar-path-spatial.js';
import {compareSunPath,sunPathPosition} from '../solar-path.js';
import {makeExample} from '../core.js';
import {prepareSolarStudy} from '../solar-occlusion.js';
const grid=states=>states.map((status,cellIndex)=>({status,cellIndex,witness:status==='blocked'?{cellIndex:3,kind:'declared-column',source:'Original retained witness'}:null}));
function ledger(){return {schema:'experimental-earth-sun-path/1',width:2,height:2,sourceContext:'original-source',samples:[
 {utc:'2026-06-21T00:00:00.000Z',condition:'modeled',existing:grid(['no-mapped-blocker','blocked','blocked','no-mapped-blocker']),proposal:grid(['blocked','no-mapped-blocker','blocked','height-dependent'])},
 {utc:'2026-06-21T01:00:00.000Z',condition:'modeled',existing:grid(['blocked','no-mapped-blocker','no-mapped-blocker','no-mapped-blocker']),proposal:grid(['no-mapped-blocker','blocked','no-mapped-blocker','footprint'])},
 {utc:'2026-06-21T02:00:00.000Z',condition:'below-horizon',existing:null,proposal:null},
 {utc:'2026-06-21T03:00:00.000Z',condition:'low-elevation',existing:null,proposal:null},
]};}
test('independent paired ledger retains both change directions, every category and all original witnesses',()=>{
 const report=ledger(),before=structuredClone(report),s=summarizeSunPathSpatial(report);
 assert.deepEqual(s.times[0].categories,['additional','removed','unchanged-blocked','unresolved']);
 assert.deepEqual(s.times[1].categories,['removed','additional','unchanged-no-blocker','footprint']);
 assert.equal(s.cells[0].pattern,'mixed');assert.equal(s.cells[0].counts.additional,1);assert.equal(s.cells[0].counts.removed,1);assert.equal(s.cells[0].limitedSamples,2);
 assert.equal(s.cells[3].pattern,'limited');assert.equal(s.cells[3].counts.unresolved,1);assert.equal(s.cells[3].counts.footprint,1);
 for(const cell of s.cells){assert.equal(Object.values(cell.counts).reduce((a,b)=>a+b),4);for(const name of ['existingCounts','proposalCounts'])assert.equal(Object.values(cell[name]).reduce((a,b)=>a+b),4);}
 for(const time of s.times)assert.equal(Object.values(time.counts).reduce((a,b)=>a+b),4);
 const at=inspectSunPathSpatial(report,s,0,0);assert.deepEqual(at.proposal.witness,report.samples[0].proposal[0].witness);assert.equal(at.category,'additional');assert.deepEqual(report,before);
});
function authored(reverse=false){
 const p=makeExample();p.width=8;p.height=2;p.selectedIndex=0;p.weather.cellSizeM=2;
 p.existing=Array.from({length:16},()=>({surface:'turf',elevationM:0,provenance:'Authored flat spatial control'}));p.proposal=structuredClone(p.existing);
 const columns=[{cellIndex:7,heightMinM:10,heightMaxM:10,source:'Authored distant opaque column'}];
 p.solarStudy=prepareSolarStudy(p,{headingDeg:0,elevationDeg:45,sunSource:'Original source',existing:reverse?columns:[],proposal:reverse?[]:columns});
 const d={latitudeDeg:51.5,longitudeDeg:-.1,gridColumnBearingDeg:sunPathPosition('2026-06-21T06:30:00Z',51.5,-.1,0).azimuthDeg,locationSource:'Authored location',orientationSource:'Authored alignment',startUtc:'2026-06-21T06:00:00Z',endUtc:'2026-06-21T08:00:00Z',stepMinutes:1};
 return compareSunPath(p,d);
}
test('real maintained course exposes consequential spatial variation without turning a footprint into a clear cell',()=>{
 const report=authored(),before=structuredClone(report),s=summarizeSunPathSpatial(report);
 assert.equal(s.sampleCount,121);assert.deepEqual(s.cells.map(c=>c.counts.additional),[47,56,64,74,90,121,121,0,10,7,2,0,0,0,0,0]);
 assert.equal(s.cells[7].counts.footprint,121);assert.equal(s.cells[7].counts['unchanged-no-blocker'],0);assert.equal(s.cells[7].pattern,'limited');
 const reversed=summarizeSunPathSpatial(authored(true));assert.deepEqual(reversed.cells.map(c=>c.counts.removed),s.cells.map(c=>c.counts.additional));assert.ok(reversed.cells.every(c=>c.counts.additional===0));assert.deepEqual(report,before);
 for(let t=0;t<report.samples.length;t++)for(let i=0;i<s.cells.length;i++){const row=inspectSunPathSpatial(report,s,i,t);assert.equal(row.existing,report.samples[t].existing[i]);assert.equal(row.proposal,report.samples[t].proposal[i]);}
});
test('grazing and height-dependent cases remain unresolved even beside a definite result',()=>{
 for(const status of ['grazing','height-dependent'])for(const other of ['blocked','no-mapped-blocker',status]){
  const r=ledger();r.samples[0].existing[0].status=status;r.samples[0].proposal[0].status=other;
  assert.equal(summarizeSunPathSpatial(r).times[0].categories[0],'unresolved');
 }
 assert.equal(Object.keys(SUN_PAIR_CATEGORIES).length,8);
});
test('incomplete, changed, excessive and unknown reports refuse without partial conclusions',()=>{
 const r=ledger(),s=summarizeSunPathSpatial(r);
 assert.throws(()=>inspectSunPathSpatial({...r,sourceContext:'different'},s,0,0),/different source/);
 assert.throws(()=>inspectSunPathSpatial({...r,declaration:{gridColumnBearingDeg:17}},s,0,0),/different source/);
 assert.throws(()=>inspectSunPathSpatial(r,s,4,0),/Select a cell/);assert.throws(()=>inspectSunPathSpatial(r,s,0,4),/original sampled/);
 const changed=structuredClone(r);changed.samples[0].proposal[0].status='no-mapped-blocker';assert.throws(()=>inspectSunPathSpatial(changed,s,0,0),/course changed/);
 const incomplete=structuredClone(r);incomplete.samples[0].proposal.pop();assert.throws(()=>summarizeSunPathSpatial(incomplete),/complete paired grid/);
 const unknown=structuredClone(r);unknown.samples[0].proposal[0].status='sunny';assert.throws(()=>summarizeSunPathSpatial(unknown),/Unknown sun-path/);
 assert.throws(()=>summarizeSunPathSpatial({...r,width:200,height:200}),/work bound/);
 const reversed=structuredClone(r);reversed.samples.reverse();assert.throws(()=>summarizeSunPathSpatial(reversed),/increasing/);
});
