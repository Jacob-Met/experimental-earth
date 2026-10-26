import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {inferUnpartitionedMeans} from '../unpartitioned-mean-history.js';import {inferPairedMeanHistory,PAIRED_MEAN_SCHEMA} from '../paired-mean-history.js';import {receiveNoaaMeanSource,receiveNoaaPairedMeans,NOAA_PAIRED_MEAN_SCHEMA} from '../noaa-paired-means.js';import {unpartitionedFixture,unpartitionedNoaaRecipe} from './unpartitioned-mean-fixture.mjs';
const value=x=>Number(x.exact.numerator)/Number(x.exact.denominator);
test('all chronological support gaps are compared with the unchanged alternative and exact onset',()=>{
 const x=unpartitionedFixture(),copy=structuredClone(x),r=inferUnpartitionedMeans(x);assert.deepEqual(x,copy);assert.equal(r.partitions.length,5);assert.equal(r.unchangedSupported,false);assert.equal(r.status,'continuous-change-supported');
 const supported=r.partitions.filter(p=>p.status==='response-compatible');assert.equal(supported.length,1);assert.deepEqual(supported[0].earlierIndices,[0,1,2]);assert.equal(supported[0].onset.gap.start,'2026-01-06T00:00:00Z');assert.equal(value(supported[0].onset.branches[0].offsetAfterLastEarlierDays.lower),.5);assert.equal(value(supported[0].onset.branches[0].offsetAfterLastEarlierDays.upper),.5);assert(!('boundary' in r.source));assert(r.source.pairs.every(p=>!('role'in p)));
 const shuffled=structuredClone(x);shuffled.pairs.reverse();const reversed=inferUnpartitionedMeans(shuffled);assert.deepEqual(reversed.partitions.map(p=>p.gap),r.partitions.map(p=>p.gap));assert.deepEqual(reversed.partitions[2].earlierIndices,[5,4,3]);assert.deepEqual(reversed.partitions[2].onset.branches,r.partitions[2].onset.branches);
});
test('every bounded partition matches independently declared original mean inference without adopting it',()=>{
 const x=unpartitionedFixture();for(const p of x.pairs)p.treated.halfWidth=.5;const r=inferUnpartitionedMeans(x);
 for(const p of r.partitions){if(p.earlierIndices.length<2)continue;const source=structuredClone(x);source.schema=PAIRED_MEAN_SCHEMA;delete source.modelBasis;source.boundary=p.gap.start;source.boundaryBasis='Independent explicitly declared partition';source.pairs.forEach((row,i)=>row.role=p.earlierIndices.includes(i)?'pre':'post');const direct=inferPairedMeanHistory(source);assert.deepEqual(p.earlier.vertices,direct.earlier.vertices);if(p.response){assert.deepEqual(p.response.vertices,direct.vertices);assert.deepEqual(p.onset.branches,direct.onset.branches);}}
});
test('independent subset enumeration proves no admissible overlapping-window partition is omitted',()=>{
 let seed=379;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed;};
 for(let c=0;c<24;c++){
  const x=unpartitionedFixture(8);for(let i=0;i<8;i++){const start=(c%3===0?i*4:Math.floor(i/2)*4+random()%3)*86400+i,end=start+86400*(1+random()%5);for(const name of ['treated','comparison']){x.pairs[i][name].from=new Date(Date.parse('2026-01-01T00:00:00Z')+start*1000).toISOString().replace('.000Z','Z');x.pairs[i][name].to=new Date(Date.parse('2026-01-01T00:00:00Z')+end*1000).toISOString().replace('.000Z','Z');x.pairs[i][name].value=20;}}if(c%2)x.pairs.reverse();
  const expected=[];for(let mask=1;mask<(1<<8)-1;mask++){const a=[],b=[];for(let i=0;i<8;i++)((mask>>i)&1?a:b).push(i);if(Math.max(...a.map(i=>Date.parse(x.pairs[i].treated.to)))<=Math.min(...b.map(i=>Date.parse(x.pairs[i].treated.from))))expected.push(a.join(','));}
  const r=inferUnpartitionedMeans(x);assert.deepEqual(r.partitions.map(p=>[...p.earlierIndices].sort((a,b)=>a-b).join(',')).sort(),expected.sort());assert.equal(r.unchangedSupported,true);
 }
});
test('overlapping supports, singleton gaps and rank-deficient alternatives are retained distinctly',()=>{
 const x=unpartitionedFixture(2);for(const p of x.pairs)p.treated.value=20;
 for(const name of ['treated','comparison']){x.pairs[0][name].to='2026-01-05T00:00:00Z';x.pairs[1][name].from='2026-01-02T00:00:00Z';x.pairs[1][name].to='2026-01-04T00:00:00Z';}
 const overlap=inferUnpartitionedMeans(x);assert.equal(overlap.partitions.length,0);assert.equal(overlap.unchangedSupported,true);assert.equal(overlap.unchangedBounded,false);x.pairs[1].treated.value++;assert.equal(inferUnpartitionedMeans(x).status,'no-supported-history');
 const adjacent=unpartitionedFixture(4);for(let i=0;i<4;i++)for(const name of ['treated','comparison'])adjacent.pairs[i][name].to=adjacent.pairs[i+1]?.[name].from??adjacent.pairs[i][name].to;const all=inferUnpartitionedMeans(adjacent);assert.equal(all.partitions[1].gap.start,all.partitions[1].gap.end);
 const short=unpartitionedFixture(2),s=inferUnpartitionedMeans(short);assert.equal(s.partitions[0].status,'insufficient-operator-support');assert.equal(s.status,'unbounded-change-alternatives');assert.equal(s.unchangedSupported,true);
});
test('shared complete work preflight and admission never return a partial choice',()=>{
 const x=unpartitionedFixture();for(const p of x.pairs)p.treated.halfWidth=1;
 for(const opts of [{maxPairChecks:1},{maxConstraintChecks:1},{maxVertexPairs:1},{maxHullChecks:1},{maxRootEvaluations:1}])assert.throws(()=>inferUnpartitionedMeans(x,opts));
 for(const edit of [x=>x.boundary='2026-01-02T00:00:00Z',x=>x.pairs[0].role='pre',x=>x.modelBasis='',x=>x.pairs[0].treated.sourceAggregation.weighting='guessed']){const bad=structuredClone(x);edit(bad);assert.throws(()=>inferUnpartitionedMeans(bad));}
 const many=unpartitionedFixture(64);for(const p of many.pairs)p.treated.value=20;const r=inferUnpartitionedMeans(many);assert.equal(r.partitions.length,63);assert.equal(r.unchangedSupported,true);assert.equal(r.partitions.filter(p=>p.status==='response-compatible').length,61);assert(r.work.constraintChecks<=200000);assert(r.work.pairChecks<=100000);
});
test('whole original NOAA course retains all supported gaps and the adverse narrower-band result',async()=>{
 const raw=readFileSync('examples/noaa-tucson-hourly/tucson-hourly-excerpt.txt','utf8');
 for(const width of [0,.5,1,2]){const recipe=unpartitionedNoaaRecipe(raw,width),copy=structuredClone(recipe),received=await receiveNoaaMeanSource(recipe,{partitioned:false}),r=inferUnpartitionedMeans(received.input);assert.deepEqual(recipe,copy);assert.equal(r.partitions.length,8);assert.equal(r.unchangedSupported,false);assert.deepEqual(r.partitions.filter(p=>p.status==='response-compatible').map(p=>p.earlierIndices.length),width===2?[4,5,6]:[]);assert.deepEqual(r.partitions.filter(p=>p.onset?.branches.length).map(p=>p.gap.start),width===2?['2025-01-01T20:00:00Z','2025-01-01T21:00:00Z']:[]);assert(received.input.pairs.every(p=>!('role'in p)&&p.treated.sourceAggregation.weighting==='unknown'));}
});
test('shared original intake preserves the declared-boundary NOAA result exactly',async()=>{
 if(!process.env.EARTH_MEAN_BASELINE)return;
 const {receiveNoaaPairedMeans:previous}=await import(process.env.EARTH_MEAN_BASELINE+'/noaa-paired-means.js'),raw=readFileSync('examples/noaa-tucson-hourly/tucson-hourly-excerpt.txt','utf8'),x=unpartitionedNoaaRecipe(raw,0);x.schema=NOAA_PAIRED_MEAN_SCHEMA;delete x.modelBasis;x.boundary='2025-01-01T17:00:00Z';x.boundaryBasis='Authored descriptive split';x.selection.count=4;assert.deepEqual(await receiveNoaaPairedMeans(x),await previous(x));
});
