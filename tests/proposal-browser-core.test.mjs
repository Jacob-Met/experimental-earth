import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeExample} from '../core.js';
import {parsePortableProject,serializePortableProject,checkProjectFileBytes} from '../project-portability.js';
import {canonicalSiteSource,compareProposalSources} from '../rain-proposal-comparison.js';

const cli=fileURLToPath(new URL('../compare-rain-proposals.mjs',import.meta.url));
const nodeHash=bytes=>createHash('sha256').update(bytes).digest('hex');
const webHash=async bytes=>Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
const hashIdentity=project=>webHash(new TextEncoder().encode(canonicalSiteSource(project)));
const reverseKeys=value=>Array.isArray(value)?value.map(reverseKeys):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).reverse().map(key=>[key,reverseKeys(value[key])])):value;
const freeze=value=>{
  if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
};
async function readBytes(bytes){
  checkProjectFileBytes(bytes.byteLength);
  return {project:freeze(parsePortableProject(new TextDecoder('utf-8',{fatal:true}).decode(bytes))),
    sourceSHA256:await webHash(bytes),sourceBytes:bytes.byteLength};
}
const compareBytes=sources=>compareProposalSources(sources,{readSource:readBytes,hashIdentity});
const bytes=project=>new TextEncoder().encode(serializePortableProject(project));
function retainedProject(){
  const p=makeExample();
  p.observations=[{cellIndex:9,minute:15,depthMm:10,uncertaintyMm:1,
    source:'logger',scenario:'existing',use:'calibration',tableSource:{
      fileName:'original.csv',line:2,unit:'cm',depthValue:'1',uncertaintyValue:'.1',
      stationValue:'east',stationMapping:{station:'east',cell:'B2',
        source:'Independent receiving placement',gridWidth:8,gridHeight:6}}}];
  p.retainedIndependentInvestigation={source:'Original notebook',readings:[{token:'01.20',role:'held aside'}]};
  p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[3,9,22]};
  return p;
}

test('browser byte/WebCrypto adapter and actual CLI produce identical reports without changing original exports',async()=>{
  const a=retainedProject(),b=structuredClone(a),c=structuredClone(a);
  b.title='Retained original paving';b.selectedIndex=2;b.proposal=structuredClone(b.existing);
  c.title='Retained gardens';c.proposal=c.proposal.map(cell=>({...cell,surface:'garden',provenance:'declared hypothetical alternative'}));
  // The UTF-8 BOM affects original-byte identity even though strict decoding removes it.
  const sourceBytes=[Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(bytes(a))]),
    Buffer.from(JSON.stringify(reverseKeys(b))),Buffer.from(bytes(c))];
  const originals=sourceBytes.map(value=>Buffer.from(value));
  const dir=await mkdtemp(join(tmpdir(),'earth-browser-comparison-'));
  try{
    const paths=sourceBytes.map((_,i)=>join(dir,'proposal-'+i+'.json'));
    await Promise.all(paths.map((path,i)=>writeFile(path,sourceBytes[i])));
    const processResult=spawnSync(process.execPath,[cli,...paths],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
    assert.equal(processResult.status,0,processResult.stderr);assert.equal(processResult.stderr,'');
    const shared=await compareBytes(sourceBytes);
    assert.deepEqual(shared,JSON.parse(processResult.stdout));
    assert.equal(shared.originalSite.sha256OfCanonicalUnchangedFields,nodeHash(canonicalSiteSource(a)));
    for(let i=0;i<sourceBytes.length;i++){
      assert.deepEqual(shared.candidates[i].originalFile,{sha256:nodeHash(originals[i]),bytes:originals[i].length});
      assert.deepEqual(sourceBytes[i],originals[i]);assert.deepEqual(await readFile(paths[i]),originals[i]);
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('shared adapter keeps semantic equality distinct from original-byte identity and admits identical proposals',async()=>{
  const a=retainedProject(),b=reverseKeys(structuredClone(a));b.title='Display name only';b.selectedIndex=1;
  const rawA=bytes(a),rawB=new TextEncoder().encode(JSON.stringify(b));
  const report=await compareBytes([rawA,rawB]);
  assert.notEqual(report.candidates[0].originalFile.sha256,report.candidates[1].originalFile.sha256);
  assert.equal(canonicalSiteSource(a),canonicalSiteSource(b));
  assert.deepEqual(report.candidates[0].proposal,report.candidates[1].proposal);
  assert.deepEqual(report.namedObjectiveFrontier,[1,2]);
  assert.deepEqual(report.footprintAwareFrontier,[1,2]);
  for(const entry of report.candidates){assert.deepEqual(entry.dominatedBy,[]);assert.deepEqual(entry.footprintAwareDominatedBy,[]);}
});

test('unchanged retained proposals produce zero modeled footprint and no invented improvement through the browser adapter',async()=>{
  const a=retainedProject();a.proposal=structuredClone(a.existing);
  const b=structuredClone(a);b.title='Same retained layout';
  const report=await compareBytes([bytes(a),bytes(b)]);
  for(const candidate of report.candidates){
    assert.deepEqual(candidate.proposal,report.originalSite.existing);
    assert.deepEqual(candidate.modeledFootprint,{changedCellCount:0,changedCellIndices:[]});
    assert.ok(Object.values(candidate.proposalMinusExisting).every(value=>value===0));
  }
  assert.deepEqual(report.namedObjectiveFrontier,[1,2]);
  assert.deepEqual(report.footprintAwareFrontier,[1,2]);
});

test('shared asynchronous adapter refuses changed retained evidence instead of silently reducing the project',async t=>{
  const original=retainedProject();
  const changes={
    unknownExtension:p=>{p.retainedIndependentInvestigation.readings[0].token='1.20';},
    originalProvenance:p=>{p.existing[0].provenance='Different source';},
    modelStep:p=>{p.weather.stepMinutes=6;},
    observationRole:p=>{p.observations[0].use='challenge';},
    originalTableSource:p=>{p.observations[0].tableSource.fileName='other.csv';},
    investigationRemoved:p=>{delete p.retainedIndependentInvestigation;},
    knownInvestigation:p=>{p.infiltrationStudy.ratesMmHr=[3,9,23];},
    knownInvestigationRemoved:p=>{delete p.infiltrationStudy;},
    explicitNullExtension:p=>{p.anotherInvestigation=null;},
  };
  for(const [name,change] of Object.entries(changes))await t.test(name,async()=>{
    const other=structuredClone(original);change(other);
    const sources=[bytes(original),bytes(other)],before=sources.map(value=>Buffer.from(value));
    await assert.rejects(compareBytes(sources),/not the same original site/);
    for(let i=0;i<sources.length;i++)assert.deepEqual(Buffer.from(sources[i]),before[i]);
  });
});

test('browser adapter retains declared edge source while counting both involved cells',async()=>{
  const a=retainedProject();a.proposal=structuredClone(a.existing);
  const b=structuredClone(a);b.title='Declared edge alternative';
  b.proposal[9].internalBarriers={east:{closed:true,source:'Hypothetical internal barrier'}};
  const original=structuredClone(b),report=await compareBytes([bytes(a),bytes(b)]);
  assert.deepEqual(report.candidates[0].modeledFootprint,{changedCellCount:0,changedCellIndices:[]});
  assert.deepEqual(report.candidates[1].modeledFootprint,{changedCellCount:2,changedCellIndices:[9,10]});
  assert.deepEqual(b,original);
  assert.equal(b.proposal[9].internalBarriers.east.source,'Hypothetical internal barrier');
});

test('adapter failures and strict decoding reject rather than return a partial comparison',async()=>{
  const valid=bytes(retainedProject());
  await assert.rejects(compareBytes([valid,new Uint8Array([0xc3,0x28])]),/encoded data|encoding/i);
  const sentinel=new Error('Original source unavailable');let reads=0;
  await assert.rejects(compareProposalSources([valid,valid,valid],{
    readSource:async value=>{if(++reads===2)throw sentinel;return readBytes(value);},hashIdentity,
  }),error=>error===sentinel);
  assert.equal(reads,2,'A failed source must stop the sequential comparison before later sources');
});
