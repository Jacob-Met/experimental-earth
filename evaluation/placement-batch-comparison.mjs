#!/usr/bin/env node
// Complete maintained placement outputs against a separately retained baseline.
// Fixtures are authored computational controls, not measurements or validation
// of physical rainfall behavior. No candidates or unsupported results are hidden.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {spawnSync} from 'node:child_process';
import os from 'node:os';

const here = resolve(fileURLToPath(new URL('..', import.meta.url)));
const hash = value => createHash('sha256').update(value).digest('hex');
const digest = value => hash(JSON.stringify(value));
const sourceNames = ['core.js', 'intervention-study.js', 'placement-search.js'];
const sourceHashes = root => Object.fromEntries(sourceNames.map(name => [name, hash(readFileSync(resolve(root, name)))]));
async function consumers(root) {
  const names = ['core.js', 'placement-search.js', 'placement-resolution.js'];
  const [core, placement, resolution] = await Promise.all(names.map(name => import(pathToFileURL(resolve(root, name)).href)));
  return {core, placement, resolution};
}
function courtyard(api) {
  const project = api.core.makeExample(); project.proposal = structuredClone(project.existing);
  const query = {eligibleCells: project.existing.flatMap((c,i) => c.surface === 'sealed' ? [i] : []),
    maxEdits: 2, surface: 'garden', metric: 'unabsorbedLiters', subset: 'all',
    study: {target: 'existing', surface: 'sealed', ratesMmHr: [.2,1,4]}};
  return {project, query};
}
function duration(api) {
  const c = courtyard(api); c.query.eligibleCells = [18,19,27,36];
  c.query.durationGoal = {cellIndices:[10],thresholdMm:5,maxAdditionalMinutes:-50,
    basis:'Authored software control, not a safety threshold'};
  return c;
}
function cases(api) {
  const out = [{name:'courtyard-79-layouts',...courtyard(api)},
    {name:'courtyard-duration-11-layouts',...duration(api)}];
  for (let seed = 1; seed <= 12; seed++) {
    let state = seed * 7919;
    const rand = () => ((state = (Math.imul(state,1664525) + 1013904223) >>> 0) / 2**32);
    const project = api.core.makeExample(), width = [4,8,12][seed%3], height = seed%2 ? 6 : 4;
    project.width = width; project.height = height; project.selectedIndex = 0;
    project.existing = Array.from({length:width*height}, (_,i) => ({surface:i%3 ? 'turf':'sealed',
      elevationM:Math.round(rand()*.15*1000)/1000,provenance:`Authored computational seed ${seed}`}));
    project.existing[0].internalBarriers = {east:seed%2 ? {closed:true,source:'Authored wall'} : {crestElevationM:.2,source:'Authored crest'}};
    project.proposal = structuredClone(project.existing);
    project.proposal.at(-1).surface = 'garden';
    Object.assign(project.weather,{rainMmHr:seed===12 ? 0 : 20+rand()*80,stormMinutes:25,durationMinutes:60,
      stepMinutes:seed%2 ? 5 : 7,mobilityPerHour:.1+rand(),boundaryExitPerHour:rand()});
    const query = {eligibleCells:[0,1,2,3,4],maxEdits:seed%3 ? 2:1,surface:'garden',
      metric:seed%2 ? 'unabsorbedLiters':'maxDepthMm',subset:'all',
      study:{target:'existing',surface:seed%3 ? 'sealed':'turf',ratesMmHr:seed%3 ? [.2,1,4] : [0,3,9,22,50]}};
    if (seed%4===0) query.durationGoal = {cellIndices:[0,4],thresholdMm:5,maxAdditionalMinutes:0,basis:'Authored duration constraint'};
    if (seed%4===1) query.targets = [{cellIndex:2,maxPeakChangeMm:0,basis:'Authored peak constraint'}];
    out.push({name:`authored-seed-${seed}`,project,query});
  }
  for (const mode of ['calibration','surviving','rejected-challenge','absent-calibration']) {
    const c = courtyard(api); c.query.eligibleCells=[18,19,27]; c.query.subset=mode==='calibration'?'calibration':'surviving';
    const model=api.core.runRain(c.project.existing,c.project.width,c.project.height,c.project.weather,
      {surfaceInfiltrationOverride:{surface:'sealed',rateMmHr:1}});
    const reading={cellIndex:27,minute:60,depthMm:api.core.interpolateDepth(model,27,60).depthMm,
      uncertaintyMm:0,source:'Authored exact-rate software control',scenario:'existing',use:'calibration'};
    c.project.observations=[reading,{...reading,use:'challenge'}];
    if(mode==='rejected-challenge') c.project.observations[1].depthMm=1000;
    if(mode==='absent-calibration') c.project.observations=[];
    out.push({name:mode,...c});
  }
  return out;
}
async function parity(baseline) {
  const a=await consumers(baseline), b=await consumers(here), rows=[];
  for(const c of cases(a)) {
    const before=digest(c), expected=a.placement.comparePlacements(c.project,c.query), actual=b.placement.comparePlacements(c.project,c.query);
    assert.deepEqual(actual,expected,c.name); assert.equal(digest(c),before,`${c.name}: source mutation`);
    rows.push({name:c.name,inputSha256:before,outputSha256:digest(actual),status:actual.status,layouts:actual.plans.length});
  }
  const c=duration(a), expected=a.resolution.comparePlacementResolution(c.project,c.query), actual=b.resolution.comparePlacementResolution(c.project,c.query);
  assert.deepEqual(actual,expected,'all calculation intervals and fixed source support');
  rows.push({name:'duration-resolution',status:actual.status,outputSha256:digest(actual)});
  const corrupt=structuredClone(actual); corrupt.status='unsupported-fallback';
  assert.throws(()=>assert.deepEqual(corrupt,expected),assert.AssertionError);
  const p=courtyard(a), before=b.placement.comparePlacements(p.project,p.query);
  p.project.weather.rainMmHr=72;
  const changed=b.placement.comparePlacements(p.project,p.query);
  assert.notDeepEqual(changed.plans,before.plans);
  assert.deepEqual(changed,a.placement.comparePlacements(p.project,p.query));
  assert.equal(rows.find(r=>r.name==='rejected-challenge').status,'no-compatible-rates');
  assert.equal(rows.find(r=>r.name==='absent-calibration').status,'need-calibration');
  console.log(JSON.stringify({status:'pass',method:'exact full-output and input-immutability comparison',
    baselineSourceSha256:sourceHashes(baseline),candidateSourceSha256:sourceHashes(here),cases:rows,
    negativeControls:['altered status rejected','changed source changes full plans','incompatible evidence returns no layouts','missing evidence stays unsupported']},null,2));
}
function workloads(api) {
  const large=courtyard(api), limited=duration(api), small=cases(api).find(c=>c.name==='authored-seed-3');
  return {
    '79-layout-placement':{repeats:5,run:()=>api.placement.comparePlacements(large.project,large.query)},
    '11-layout-duration':{repeats:10,run:()=>api.placement.comparePlacements(limited.project,limited.query)},
    '6-layout-small':{repeats:50,run:()=>api.placement.comparePlacements(small.project,small.query)},
    'duration-resolution':{repeats:3,run:()=>api.resolution.comparePlacementResolution(limited.project,limited.query)},
  };
}
async function sample(root,name) {
  const api=await consumers(root), task=workloads(api)[name]; assert.ok(task,'Unknown maintained workload');
  const firstStart=performance.now(); task.run(); const firstUseMs=performance.now()-firstStart;
  for(let i=0;i<4;i++)task.run(); globalThis.gc?.();
  const cpu=process.cpuUsage(), start=performance.now(); let result;
  for(let i=0;i<task.repeats;i++)result=task.run();
  const wallMs=(performance.now()-start)/task.repeats, used=process.cpuUsage(cpu), memory=process.memoryUsage();
  console.log(JSON.stringify({firstUseMs,wallMs,cpuMs:(used.user+used.system)/1000/task.repeats,
    processMaxRssKiB:process.resourceUsage().maxRSS,heapUsedBytes:memory.heapUsed,
    outputSha256:digest(result),repeats:task.repeats}));
}
function benchmark(baseline) {
  const rows=[];
  for(const name of ['79-layout-placement','11-layout-duration','6-layout-small','duration-resolution']) {
    const samples={baseline:[],candidate:[]};
    for(let trial=0;trial<5;trial++)for(const label of trial%2 ? ['candidate','baseline'] : ['baseline','candidate']) {
      const child=spawnSync(process.execPath,['--expose-gc',fileURLToPath(import.meta.url),'--sample',label==='baseline'?baseline:here,name],{encoding:'utf8',timeout:120000});
      assert.equal(child.status,0,child.error?.message??child.stderr); samples[label].push(JSON.parse(child.stdout));
    }
    assert.equal(new Set([...samples.baseline,...samples.candidate].map(s=>s.outputSha256)).size,1,`${name}: output mismatch`);
    const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
    const baselineMs=median(samples.baseline.map(s=>s.wallMs)), candidateMs=median(samples.candidate.map(s=>s.wallMs));
    rows.push({name,baselineMedianMs:baselineMs,candidateMedianMs:candidateMs,speedup:baselineMs/candidateMs,
      baselineFirstUseMedianMs:median(samples.baseline.map(s=>s.firstUseMs)),candidateFirstUseMedianMs:median(samples.candidate.map(s=>s.firstUseMs)),samples});
  }
  console.log(JSON.stringify({status:'pass',method:'five alternating fresh process pairs; first use separate; four more warmups; fixed full comparisons; all output hashes identical',
    baselineSourceSha256:sourceHashes(baseline),candidateSourceSha256:sourceHashes(here),
    environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,cpuCount:os.cpus().length,load:os.loadavg()},
    memoryMeaning:'Peak RSS includes imports and warmups in each fresh process; it is not isolated retained-cache memory.',rows},null,2));
}
const [mode,argument,name]=process.argv.slice(2);
try {
  if(mode==='--sample')await sample(resolve(argument),name);
  else if(mode==='--parity')await parity(resolve(argument));
  else if(mode==='--benchmark')benchmark(resolve(argument));
  else throw Error('Usage: placement-batch-comparison.mjs --parity|--benchmark /path/to/pinned/baseline');
} catch(error) {console.error(error);process.exitCode=1;}
