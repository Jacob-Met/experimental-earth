import test from 'node:test';
import assert from 'node:assert/strict';
import {compareSustainedConnections as compare} from '../sustained-connection.js';
import {comparePondingConnections} from '../ponding-connectivity.js';
const q={startIndex:3,endIndex:5,allowedIndices:[0,1,2,3,5,6,7,8]};
const series=values=>({snapshots:values.map((depthsMm,i)=>({minute:i*10,depthsMm}))});
const first=[0,0,0,0,99,0,10,10,10],last=[10,10,10,0,99,0,0,0,0];
test('changing zero-depth paths cannot masquerade as one sustained connection',()=>{
 const results={existing:series([first,last]),proposal:series([first,first])},before=structuredClone(results);
 const native=comparePondingConnections(results,3,3,q);assert.ok(native.rows.every(r=>r.existing.bottleneckMm===0));
 const actual=compare(results,3,3,q,{startMinute:0,endMinute:10});
 assert.equal(actual.existing.bottleneckMm,10);assert.equal(actual.proposal.bottleneckMm,0);
 assert.deepEqual(actual.existing.path,[3,0,1,2,5]);assert.deepEqual(results,before);
});
test('fractional endpoints and interior peaks use declared interpolation, not nearest snapshot',()=>{
 const results={existing:series([first,last,first]),proposal:series([first,last,first])};
 const r=compare(results,3,3,q,{startMinute:2,endMinute:8});assert.equal(r.existing.bottleneckMm,8);
 const peak=compare(results,3,3,{...q,allowedIndices:[3,0,1,2,5]},{startMinute:2,endMinute:18});
 assert.equal(peak.existing.bottleneckMm,10);assert.equal(peak.existing.pathPeaks.find(x=>x.cellIndex===1).minute,10);
});
test('disconnected footprint and malformed or out-of-event windows do not report success',()=>{
 const results={existing:series([first,last]),proposal:series([first,last])};
 assert.equal(compare(results,3,3,{...q,allowedIndices:[3,5]},{startMinute:0,endMinute:10}).existing.connected,false);
 for(const w of [{startMinute:0,endMinute:0},{startMinute:-1,endMinute:5},{startMinute:0,endMinute:11},{startMinute:NaN,endMinute:5}])assert.throws(()=>compare(results,3,3,q,w));
 const bad=structuredClone(results);bad.proposal.snapshots[1].depthsMm[8]=NaN;assert.throws(()=>compare(bad,3,3,q,{startMinute:0,endMinute:1}));
 const holes=structuredClone(results);delete holes.existing.snapshots[1];assert.throws(()=>compare(holes,3,3,q,{startMinute:0,endMinute:1}));
 const sparse=structuredClone(results);delete sparse.proposal.snapshots[1].depthsMm[8];assert.throws(()=>compare(sparse,3,3,q,{startMinute:0,endMinute:1}));
 const excessive={snapshots:Array(2000)};assert.throws(()=>compare({existing:excessive,proposal:excessive},24,24,{startIndex:0,endIndex:1,allowedIndices:[0,1]},{startMinute:0,endMinute:1}),/work limit/);
});

test('independent enumeration of every simple path agrees across unfamiliar depth histories',()=>{
 const question={startIndex:0,endIndex:8,allowedIndices:Array.from({length:9},(_,i)=>i)};
 const paths=[];
 function walk(path){const i=path.at(-1);if(i===8){paths.push(path);return;}for(const j of [i-3,i+3,...(i%3?[i-1]:[]),...(i%3<2?[i+1]:[])])if(j>=0&&j<9&&!path.includes(j))walk([...path,j]);}
 walk([0]);let seed=12345;const next=()=>{seed=(1664525*seed+1013904223)>>>0;return seed%21;};
 for(let k=0;k<100;k++){
  const values=Array.from({length:4},()=>Array.from({length:9},next)),result=series(values);
  const actual=compare({existing:result,proposal:result},3,3,question,{startMinute:5,endMinute:25}).existing;
  // Independent half-step endpoint arithmetic and exhaustive path scoring.
  const heights=values[0].map((_,i)=>Math.max((values[0][i]+values[1][i])/2,values[1][i],values[2][i],(values[2][i]+values[3][i])/2));
  const costs=paths.map(path=>({cost:Math.max(...path.map(i=>heights[i])),length:path.length}));
  const best=Math.min(...costs.map(p=>p.cost)),length=Math.min(...costs.filter(p=>p.cost===best).map(p=>p.length));
  assert.equal(actual.bottleneckMm,best);assert.equal(actual.path.length,length);
 }
});

test('actual maintained solver retains original source and dry control',async()=>{
 const {makeExample,compare:run}=await import('../core.js');
 const project=makeExample(),before=structuredClone(project),question={startIndex:8,endIndex:11,allowedIndices:Array.from({length:project.width*project.height},(_,i)=>i)};
 const result=run(project),window={startMinute:0,endMinute:project.weather.durationMinutes};
 const actual=compare(result,project.width,project.height,question,window);
 for(const key of ['existing','proposal']){
  const independentlyScored=Math.max(...result[key].snapshots.flatMap(s=>actual[key].path.map(i=>s.depthsMm[i])));
  assert.equal(actual[key].bottleneckMm,independentlyScored);assert.ok(independentlyScored>0);
 }
 const dry=structuredClone(project);dry.weather.rainMmHr=0;
 assert.equal(compare(run(dry),dry.width,dry.height,question,window).existing.bottleneckMm,0);
 assert.deepEqual(project,before);
});
