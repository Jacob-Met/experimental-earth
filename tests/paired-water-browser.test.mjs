import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parsePortableProject} from '../project-portability.js';
import {compare} from '../core.js';
import {pairedWaterReport} from '../paired-water-report.js';
import {pairedWaterPayloadFromSources} from '../paired-water-browser.js';
import {safePayloadJson} from '../paired-water-payload.js';
const root=path.dirname(fileURLToPath(new URL('../package.json',import.meta.url)));
const a=fs.readFileSync(path.join(root,'tests/fixtures/water-history-tradeoff.json'));
const bProject=JSON.parse(a.toString('utf8'));
bProject.proposal=bProject.existing.map(cell=>({...cell}));
bProject.title='No intervention, =SUM(A1) "test"';
const b=Buffer.from(JSON.stringify(bProject,null,2));
const src=bytes=>({project:parsePortableProject(bytes.toString('utf8')),
  sourceSHA256:createHash('sha256').update(bytes).digest('hex'),sourceBytes:bytes.length});
const sources=[src(a),src(b)];
test('portable browser field sheet is byte-identical to CLI renderer on original model snapshots',()=>{
  const payload=pairedWaterPayloadFromSources(sources);
  const [x,y]=sources.map(source=>compare(source.project));
  assert.equal(payload.samples.length,x.existing.snapshots.length);
  assert.equal(payload.shaA,sources[0].sourceSHA256);
  assert.equal(payload.shaB,sources[1].sourceSHA256);
  assert.equal(payload.stats.bAboveA+payload.stats.bBelowA+payload.stats.equal,payload.samples.length);
  for(let i=0;i<payload.samples.length;i++){
    const ea=x.existing.snapshots[i],pa=x.proposal.snapshots[i],pb=y.proposal.snapshots[i];
    assert.equal(Number(payload.samples[i][0]),ea.minute);
    assert.equal(Number(payload.samples[i][1]),ea.storedLiters);
    assert.equal(Number(payload.samples[i][2]),pa.storedLiters);
    assert.equal(Number(payload.samples[i][3]),pb.storedLiters);
    assert.equal(Number(payload.samples[i][4]),pb.storedLiters-pa.storedLiters);
  }
  const template=fs.readFileSync(path.join(root,'paired-water-report-template.html'),'utf8');
  const fromBrowser=Buffer.from(template.replace('__EARTH_DATA_JSON__',safePayloadJson(payload)));
  const cli=pairedWaterReport({project:sources[0].project,digest:sources[0].sourceSHA256},
    {project:sources[1].project,digest:sources[1].sourceSHA256},
    x.existing.snapshots,x.proposal.snapshots,y.proposal.snapshots,payload.stats);
  assert.deepEqual(fromBrowser,cli);
  assert(!fromBrowser.toString('utf8').includes('<script src='));
});
test('unchanged proposals and changed-source conditions cannot fabricate a comparison',()=>{
  const zero=pairedWaterPayloadFromSources([sources[0],sources[0]]);
  assert.equal(zero.stats.bAboveA,0);
  assert.equal(zero.stats.bBelowA,0);
  assert.equal(zero.stats.equal,zero.samples.length);
  const altered=JSON.parse(JSON.stringify(sources[1].project));
  altered.weather.rainMmHr+=1;
  assert.throws(()=>pairedWaterPayloadFromSources([sources[0],{...sources[1],project:altered}]),
    /share their complete unchanged source context/);
  assert.throws(()=>pairedWaterPayloadFromSources([sources[0]]),/exactly two/);
});
