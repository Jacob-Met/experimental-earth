#!/usr/bin/env node
// Exact-output qualification of the maintained rain consumer against a separate
// pinned source tree. Authored controls establish software parity, not field accuracy.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const here = fileURLToPath(new URL('..', import.meta.url));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const blob = text => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const coreBlob = root => blob(readFileSync(resolve(root, 'core.js')));
const pinnedBaselineBlob = '3543b403766510fede61f8fca05ab6d13197981a';
async function core(root) { return import(pathToFileURL(resolve(root, 'core.js'))); }

function fixture(api, seed, large = false) {
  const p = api.makeExample();
  p.width = large ? 24 : [2, 3, 4, 6, 8, 12][seed % 6];
  p.height = large ? 24 : [2, 3, 5, 6][seed % 4];
  p.selectedIndex = 0;
  let state = seed * 7919;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  p.existing = Array.from({ length: p.width * p.height }, (_, i) => ({
    elevationM: seed === 0 ? 0 : Math.round((random() - .5) * 1000) / 1000,
    surface: ['sealed', 'turf', 'garden'][(i + seed) % 3],
    provenance: `Authored software parity case ${seed}`,
  }));
  for (let i = 0; i < p.existing.length; i++) {
    const edges = {};
    for (const [key, valid, neighbor] of [
      ['east', i % p.width < p.width - 1, i + 1],
      ['south', i + p.width < p.existing.length, i + p.width],
    ]) {
      if (!valid || seed % 3 === 0 || random() > .25) continue;
      const source = 'Authored wall/crest control';
      edges[key] = seed % 3 === 1 ? { closed: random() > .2, source } :
        { crestElevationM: Math.max(p.existing[i].elevationM, p.existing[neighbor].elevationM) + (random() - .25) * .1, source };
    }
    if (Object.keys(edges).length) p.existing[i].internalBarriers = edges;
  }
  p.proposal = structuredClone(p.existing);
  p.proposal[Math.floor(p.proposal.length / 2)].surface = 'garden';
  Object.assign(p.weather, {
    rainMmHr: seed === 11 ? 0 : 17 + random() * 100,
    stormMinutes: large ? 173.7 : 17.3, durationMinutes: large ? 720 : 47.7,
    stepMinutes: large ? 1 : seed % 2 ? 2.3 : 7,
    mobilityPerHour: seed === 0 ? 0 : .2 + random() * 2,
    boundaryExitPerHour: seed % 4 ? random() : 0,
    cellSizeM: .5 + random() * 3,
  });
  return p;
}

function options() {
  return [
    {}, { infiltrationOverride: { cellIndex: 0, rateMmHr: 0 } },
    { surfaceInfiltrationOverride: { surface: 'sealed', rateMmHr: 13.25 } },
    { surfaceWettingFront: { surface: 'sealed', conductivityMmHr: 17.3, capillaryDriveMm: 6.2 } },
    { infiltrationStorage: { schema: 'experimental-earth-closed-infiltration-store/1', surface: 'turf', remainingCapacityMm: 1.25, source: 'Authored store' } },
    { drainingLayer: { schema: 'experimental-earth-draining-layer/1', surface: 'garden', capacityMm: 5, initialStoredMm: 1, drainagePerHour: .7, source: 'Authored drainage' } },
    { traceBudget: true, rainTrace: { sourceCells: [0, 1] }, rainOrigins: { targetCells: [0, 2], fate: 'stored' } },
    { traceBudget: true, rainOrigins: { targetCells: [1, 3], fate: 'absorbed' }, surfaceInfiltrationOverride: { surface: 'turf', rateMmHr: 19 } },
    { rainOrigins: { targetCells: [0, 1, 2, 3], fate: 'exit' }, rainTrace: { sourceCells: [0, 2] } },
  ];
}

async function parity(baseline) {
  assert.equal(coreBlob(baseline), pinnedBaselineBlob, 'baseline must be the original pinned source, not the candidate');
  assert.notEqual(coreBlob(here), pinnedBaselineBlob, 'candidate must contain the proposed change');
  const a = await core(baseline), b = await core(here), rows = [];
  const run = (api, p, o) => api.runRain(p.existing, p.width, p.height, p.weather, o);
  for (let seed = 0; seed < 18; seed++) for (const [mode, o] of options().entries()) {
    const p = fixture(a, seed), original = digest({ p, o });
    const expected = run(a, p, o), actual = run(b, p, o);
    assert.deepEqual(actual, expected, `seed ${seed}, mode ${mode}`);
    assert.equal(digest({ p, o }), original, 'source/options must remain unchanged');
    rows.push({ seed, mode, outputSha256: digest(actual) });
  }
  // Reuse the same object across edits: a cache keyed only by object identity,
  // or an incomplete geometry key, must not pass this ordinary editing course.
  const p = a.makeExample(), o = { traceBudget: true };
  p.width = p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({length: 4}, (_, i) => ({surface: i === 1 ? 'turf' : 'sealed',
    elevationM: 0, provenance: 'Authored same-object edit control'}));
  p.proposal = structuredClone(p.existing);
  Object.assign(p.weather, {rainMmHr: 90, stormMinutes: 17.3, durationMinutes: 47.7,
    stepMinutes: 2.3, cellSizeM: 1, mobilityPerHour: .4, boundaryExitPerHour: .2});
  let prior = run(b, p, o);
  const editResults = [];
  for (const [name, edit] of [
    ['surface', () => { p.existing[0].surface = p.existing[0].surface === 'garden' ? 'sealed' : 'garden'; }],
    ['elevation', () => { p.existing[0].elevationM += .1; }],
    ['wall', () => { p.existing[0].internalBarriers = { east: { closed: true, source: 'Changed authored wall' } }; }],
    ['crest', () => { p.existing[0].internalBarriers.east = { crestElevationM: .10001, source: 'Changed authored crest' }; }],
    ['override', () => { o.surfaceInfiltrationOverride = { surface: 'turf', rateMmHr: 100 }; }],
    ['weather', () => { p.weather.rainMmHr += 49; }],
  ]) {
    edit(); const next = run(b, p, o);
    assert.deepEqual(next, run(a, p, o), name);
    assert.notDeepEqual(next, prior, `${name}: changed source must reach result`);
    editResults.push({ name, outputSha256: digest(next) }); prior = next;
  }
  const wrong = structuredClone(prior); wrong.finalDepthMm[0] += 1;
  assert.throws(() => assert.deepEqual(wrong, prior), assert.AssertionError);
  for (const invalid of [{ traceBudget: 'yes' }, { infiltrationOverride: { cellIndex: -1, rateMmHr: 2 } },
    { surfaceInfiltrationOverride: { surface: 'missing', rateMmHr: 2 } }]) {
    assert.throws(() => run(a, p, invalid)); assert.throws(() => run(b, p, invalid));
  }
  console.log(JSON.stringify({ status: 'pass', baselineCoreBlob: coreBlob(baseline), candidateCoreBlob: coreBlob(here),
    fullOutputCases: rows, sameObjectEdits: editResults,
    negativeControls: ['wrong original source refused', 'candidate cannot be its own baseline', 'altered full result rejected', 'invalid model options refused'] }, null, 2));
}

async function sample(root, name) {
  const api = await core(root), p = name === 'courtyard' || name === 'sensitivity' ? api.makeExample() : fixture(api, name === 'large-crests' ? 2 : 3, true);
  const run = name === 'sensitivity' ? () => api.chooseInfiltrationObservation(p) : () => api.compare(p);
  const repeats = name === 'courtyard' ? 100 : name === 'sensitivity' ? 3 : 4;
  let result; const firstStart = performance.now(); result = run(); const firstUseMs = performance.now() - firstStart;
  for (let i = 0; i < 8; i++) run(); globalThis.gc?.();
  const cpu = process.cpuUsage(), start = performance.now();
  for (let i = 0; i < repeats; i++) result = run();
  const wallMs = (performance.now() - start) / repeats, used = process.cpuUsage(cpu);
  console.log(JSON.stringify({ name, firstUseMs, wallMs, cpuMs: (used.user + used.system) / 1000 / repeats,
    processMaxRssKiB: process.resourceUsage().maxRSS, outputSha256: digest(result), repeats, coreBlob: coreBlob(root), node: process.version }));
}

function benchmark(baseline) {
  assert.equal(coreBlob(baseline), pinnedBaselineBlob, 'benchmark requires the pinned original baseline');
  const rows = [], median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length / 2)];
  const environment = {node:process.version,platform:process.platform,arch:process.arch,
    cpu:os.cpus()[0]?.model,cpuCount:os.cpus().length,load:os.loadavg()};
  for (const name of ['courtyard','sensitivity','large-open','large-crests']) {
    const samples = {baseline:[],candidate:[]};
    for (let trial = 0; trial < 5; trial++) for (const label of trial % 2 ? ['candidate','baseline'] : ['baseline','candidate']) {
      const child = spawnSync(process.execPath, ['--expose-gc',fileURLToPath(import.meta.url),'--sample',label === 'baseline' ? baseline : here,name], {encoding:'utf8',timeout:120000});
      assert.equal(child.status,0,child.error?.message ?? child.stderr);
      samples[label].push(JSON.parse(child.stdout));
    }
    assert.equal(new Set([...samples.baseline,...samples.candidate].map(x => x.outputSha256)).size,1,'benchmark outputs must match');
    const baselineMs = median(samples.baseline.map(x => x.wallMs)), candidateMs = median(samples.candidate.map(x => x.wallMs));
    rows.push({name,baselineMedianMs:baselineMs,candidateMedianMs:candidateMs,speedup:baselineMs/candidateMs,
      baselineFirstUseMedianMs:median(samples.baseline.map(x => x.firstUseMs)),candidateFirstUseMedianMs:median(samples.candidate.map(x => x.firstUseMs)),samples});
  }
  console.log(JSON.stringify({status:'pass',environment,baselineCoreBlob:coreBlob(baseline),candidateCoreBlob:coreBlob(here),
    method:'Five alternating fresh-process pairs; eight warmups, equal fixed repeats, full-output hashes; first use and whole-process peak RSS reported separately',rows},null,2));
}

const [mode, root, name] = process.argv.slice(2);
try {
  if (mode === '--parity' && root) await parity(resolve(root));
  else if (mode === '--benchmark' && root) benchmark(resolve(root));
  else if (mode === '--sample' && root && ['courtyard', 'sensitivity', 'large-open', 'large-crests'].includes(name)) await sample(resolve(root), name);
  else throw Error('Usage: rain-static-comparison.mjs --parity|--benchmark BASELINE | --sample SOURCE courtyard|sensitivity|large-open|large-crests');
} catch (error) { console.error(error); process.exitCode = 1; }
