import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SURFACES} from '../core.js';
import {canonicalSiteSource,compareProposalSources} from '../rain-proposal-comparison.js';
import {compareProposalCellSources} from '../rain-proposal-local-depth.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const cell=surface=>({surface,elevationM:0,provenance:'Declared analytical no-flow control'});
function projects(durationMinutes=60){
 const a={schema:'experimental-earth-site/1',title:'Layout A',width:2,height:2,
  existing:['sealed','garden','turf','turf'].map(cell),proposal:['sealed','garden','turf','turf'].map(cell),
  weather:{rainMmHr:36,stormMinutes:durationMinutes,durationMinutes,stepMinutes:5,cellSizeM:1,mobilityPerHour:0,boundaryExitPerHour:0},
  observations:[],selectedIndex:0,source:'Authored control, not measured site'};
 const b=structuredClone(a);b.title='Layout B';b.proposal=['garden','turf','turf','turf'].map(cell);return [a,b];
}
const source=project=>{const bytes=JSON.stringify(project);return freeze({project,sourceSHA256:hash(bytes),sourceBytes:Buffer.byteLength(bytes)});};
const readSource=async input=>input;
const hashIdentity=async project=>hash(canonicalSiteSource(project));
const aggregate=sources=>compareProposalSources(sources,{readSource,hashIdentity});
const local=(sources,comparisonReport,cellIndex=1,extra={})=>compareProposalCellSources(sources,{cellIndex,comparisonReport,readSource,hashIdentity,...extra});
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=1e-9,`${actual} != ${expected}`);

test('lower whole-site stored water can coexist with worse B1 depth; retain source and aggregate unchanged',async()=>{
 const sources=projects().map(source),report=freeze(await aggregate(sources));
 const before=JSON.stringify({sources,report});const result=await local(sources,report);
 close(report.candidates[0].proposal.storedLiters,101);close(report.candidates[1].proposal.storedLiters,93);
 assert.equal(result.cell.index,1);assert.equal(result.cell.label,'B1');
 assert.equal(result.originalSite.width,2);assert.equal(result.originalSite.height,2);assert.equal(result.originalSite.cellSizeM,1);
 assert.equal(result.originalSite.sha256OfCanonicalUnchangedFields,await hashIdentity(sources[0].project));
 assert.deepEqual(result.snapshotMinutes,Array.from({length:13},(_,i)=>i*5));
 assert.equal(result.existing.surfaceName,SURFACES.garden.label);
 assert.equal(result.candidates[0].surfaceName,SURFACES.garden.label);assert.equal(result.candidates[1].surfaceName,SURFACES.turf.label);
 for(let i=0;i<result.snapshotMinutes.length;i++){
  const hour=result.snapshotMinutes[i]/60;close(result.existing.depthsMm[i],12*hour);
  for(const [j,rate] of [12,27].entries()){close(result.candidates[j].depthsMm[i],rate*hour);close(result.candidates[j].proposalMinusExistingMm[i],(rate-12)*hour);}
 }
 close(result.candidates[1].depthsMm.at(-1)-result.candidates[0].depthsMm.at(-1),15);
 for(let i=0;i<2;i++){assert.equal(result.candidates[i].inputOrdinal,i+1);assert.equal(result.candidates[i].title,sources[i].project.title);assert.deepEqual(result.candidates[i].originalFile,{sha256:sources[i].sourceSHA256,bytes:sources[i].sourceBytes});}
 assert.equal(JSON.stringify({sources,report}),before);
});

test('uses actual zero and shortened fractional final snapshots for every supplied candidate',async()=>{
 const [a,b]=projects(7.5);const sources=Array.from({length:16},(_,i)=>{const p=structuredClone(i%2?b:a);p.title='Layout '+i;return source(p);});
 const report=await aggregate(sources),result=await local(sources,report);
 assert.equal(result.candidates.length,16);assert.deepEqual(result.snapshotMinutes,[0,5,7.5]);
 for(let i=0;i<16;i++){assert.equal(result.candidates[i].inputOrdinal,i+1);assert.equal(result.candidates[i].depthsMm[0],0);close(result.candidates[i].depthsMm.at(-1),(i%2?27:12)/8);}
});

test('refuses stale candidate bytes, source context, aggregate identity and invalid cells without mutation',async()=>{
 const sources=projects().map(source),report=freeze(await aggregate(sources));
 const before=JSON.stringify({sources,report});
 const changedHash=[sources[0],freeze({...sources[1],sourceSHA256:'0'.repeat(64)})];
 await assert.rejects(local(changedHash,report));
 const changedProject=structuredClone(sources[1].project);changedProject.weather.rainMmHr=37;
 const changedWeatherSource=source(changedProject),weatherReport=structuredClone(report);
 weatherReport.candidates[1].originalFile={sha256:changedWeatherSource.sourceSHA256,bytes:changedWeatherSource.sourceBytes};
 await assert.rejects(local([sources[0],changedWeatherSource],weatherReport));
 const changedEvidence=structuredClone(sources[1].project);changedEvidence.observations=[{cellIndex:1,minute:5,depthMm:2,uncertaintyMm:1,source:'Retained observation'}];
 const changedEvidenceSource=source(changedEvidence),evidenceReport=structuredClone(report);
 evidenceReport.candidates[1].originalFile={sha256:changedEvidenceSource.sourceSHA256,bytes:changedEvidenceSource.sourceBytes};
 await assert.rejects(local([sources[0],changedEvidenceSource],evidenceReport));
 const staleReport=structuredClone(report);staleReport.originalSite.sha256OfCanonicalUnchangedFields='f'.repeat(64);
 await assert.rejects(local(sources,staleReport));
 const wrongDimensions=structuredClone(report);wrongDimensions.originalSite.width=3;
 await assert.rejects(local(sources,wrongDimensions));
 for(const index of [-1,4,1.5,NaN])await assert.rejects(local(sources,report,index));
 assert.equal(JSON.stringify({sources,report}),before);
});

test('does not silently omit invalid tail candidates or accept out-of-contract source counts',async()=>{
 const sources=projects().map(source),report=await aggregate(sources);
 for(const bad of [[],sources.slice(0,1),Array.from({length:17},(_,i)=>sources[i%2])])await assert.rejects(local(bad,report));
 let reads=0;
 await assert.rejects(local(sources,report,1,{readSource:async input=>{if(++reads===2)throw Error('Unusable second original file');return input;}}),/Unusable second original file/);
});
