import assert from 'node:assert/strict';
import {isAbsolute,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';

const repository=process.argv[2];
if(!repository || !isAbsolute(repository)) throw new Error('Supply repository absolute path');
const moduleAt=name=>import(pathToFileURL(join(repository,name)).href);
const {makeExample,compare,validateProject}=await moduleAt('core.js');
const {pondingExposure}=await moduleAt('ponding-exposure.js');
const {inspectTimedRoute,timedRouteWindows}=await moduleAt('route-traversal.js');
const {parseRouteCells}=await moduleAt('route-ponding.js');
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

function serpentine(width,height,count) {
  const route=[];
  for(let y=0;y<height && route.length<count;y++) {
    for(let j=0;j<width && route.length<count;j++) {
      const x=y%2?width-1-j:j;
      route.push(y*width+x);
    }
  }
  assert.equal(route.length,count);
  return route;
}
function checkedRoute(project,indices) {
  const labels=indices.map(i=>String.fromCharCode(65+i%project.width)+(1+Math.floor(i/project.width)));
  assert.deepEqual(parseRouteCells(labels.join(' '),project.width,project.height).indices,indices);
  return indices;
}
function largeProject() {
  const project=makeExample();
  project.title='Authored maximum-grid latency fixture';
  project.source='Synthetic benchmark geometry; not field evidence';
  project.width=24;project.height=24;
  project.weather={...project.weather,durationMinutes:720,stepMinutes:1};
  project.existing=Array.from({length:576},(_,i)=>({
    elevationM:Number((0.05+0.002*(23-Math.floor(i/24))).toFixed(3)),
    surface:i%24>=8 && i%24<=15?'sealed':'turf',
    provenance:'Authored benchmark assumption'
  }));
  project.proposal=project.existing.map((cell,i)=>({...cell,
    ...(i%24>=10 && i%24<=13?{surface:'garden',provenance:'Authored benchmark proposal'}:{})
  }));
  project.selectedIndex=0;
  return validateProject(project);
}

// Imports, solver generation, serialization, assertions and hashing are all
// outside timed regions. Timings cover synchronous query computations only.
function measure(label,fn) {
  const invoke=()=>{const start=performance.now();const value=fn();return {ms:performance.now()-start,value};};
  const first=invoke();
  const expected=first.value;
  let largestObserved=first.ms;
  const durations=[];
  const shortened=()=>largestObserved>1000;
  let warmups=0;
  if(!shortened()) {
    for(let i=0;i<3;i++) {
      const sample=invoke();assert.deepEqual(sample.value,expected,label+' warmup equivalence');
      largestObserved=Math.max(largestObserved,sample.ms);warmups++;
      if(shortened()) break;
    }
  }
  const planned=shortened()?1:10;
  for(let i=0;i<planned;i++) {
    const sample=invoke();assert.deepEqual(sample.value,expected,label+' measured equivalence');
    durations.push(sample.ms);largestObserved=Math.max(largestObserved,sample.ms);
    if(shortened()) break;
  }
  const ordered=durations.slice().sort((a,b)=>a-b),mid=Math.floor(ordered.length/2);
  const median=ordered.length%2?ordered[mid]:(ordered[mid-1]+ordered[mid])/2;
  return {label,firstCallMs:first.ms,warmups,measuredRepetitions:durations.length,
    shortened:shortened(),medianMs:median,maxMs:Math.max(...durations),
    samplesMs:durations,resultSha256:fingerprint(expected)};
}

const normal=makeExample();
const normalBefore=fingerprint(normal);
const normalResults=compare(normal);
assert.equal(fingerprint(normal),normalBefore,'normal solver input unchanged');
const large=largeProject(),largeBefore=fingerprint(large);
const largeResults=compare(large);
assert.equal(fingerprint(large),largeBefore,'large solver input unchanged');
const cases=[
  {name:'default-three-cell',project:normal,results:normalResults,indices:[19,20,21]},
  {name:'default-48-cell',project:normal,results:normalResults,indices:serpentine(8,6,48)},
  {name:'maximum-supported-128-cell',project:large,results:largeResults,indices:serpentine(24,24,128)}
];
const findings=[];
for(const entry of cases) {
  const {name,project,results}=entry;
  const indices=checkedRoute(project,entry.indices),steps=Array(indices.length-1).fill(1);
  const threshold=1,from=0,until=10;
  const first=results.existing.snapshots[0].minute,last=results.existing.snapshots.at(-1).minute;
  assert.ok(until+steps.length<=last);
  const input={project,results,indices,steps};
  const before=fingerprint(input);
  const pairedInspect=()=>['existing','proposal'].map(key=>inspectTimedRoute(results[key],indices,steps,from,threshold));
  const pairedFull=()=>['existing','proposal'].map(key=>({
    windows:timedRouteWindows(pondingExposure(results[key],threshold),indices,steps,first,last,from,until),
    requested:inspectTimedRoute(results[key],indices,steps,from,threshold)
  }));
  const inspection=measure('paired inspector',pairedInspect);
  assert.equal(fingerprint(input),before,'inspector input custody');
  const full=measure('full paired traversal',pairedFull);
  assert.equal(fingerprint(input),before,'full traversal input custody');
  findings.push({name,grid:[project.width,project.height],routeCells:indices.length,
    snapshots:results.existing.snapshots.length,departureRange:[from,until],
    stepMinutes:1,thresholdMm:threshold,inspection,full,inputUnchanged:true});
  console.log(JSON.stringify({caseComplete:findings.at(-1)}));
}
console.log(JSON.stringify({repository,node:process.version,
  methodology:'Retained actual solver results; synchronous queries only; first call separate; 3 warmups and 10 measurements unless a call exceeds 1000 ms; no browser timing',findings},null,2));
