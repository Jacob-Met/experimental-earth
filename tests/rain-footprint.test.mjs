import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {makeExample} from '../core.js';
import {serializePortableProject} from '../project-portability.js';
import {compareProposalFiles} from '../compare-rain-proposals.mjs';

const cli=fileURLToPath(new URL('../compare-rain-proposals.mjs',import.meta.url));
const run=paths=>spawnSync(process.execPath,[cli,...paths],{encoding:'utf8',timeout:30000});
async function withProjects(projects,fn){
  const dir=await mkdtemp(join(tmpdir(),'earth-footprint-receive-'));
  const paths=[];
  try{
    for(let i=0;i<projects.length;i++){
      const path=join(dir,'proposal-'+i+'.json');
      await writeFile(path,serializePortableProject(projects[i]));
      paths.push(path);
    }
    await fn(paths);
  }finally{await rm(dir,{recursive:true,force:true});}
}
function options(){
  const six=makeExample();
  const none=structuredClone(six);none.title='Do nothing';none.proposal=structuredClone(none.existing);
  const all=structuredClone(six);all.title='All garden';all.proposal=all.proposal.map(cell=>({...cell,surface:'garden',provenance:'authored extensive change'}));
  return [six,none,all];
}

test('source-backed authored 0/6/48-cell alternatives survive the footprint-aware decision while original two-objective result stays intact',async()=>{
  await withProjects(options(),async paths=>{
    const before=await Promise.all(paths.map(p=>readFile(p)));
    const cliRun=run(paths);assert.equal(cliRun.status,0,cliRun.stderr);
    const report=JSON.parse(cliRun.stdout);
    assert.deepEqual(report.namedObjectiveFrontier,[3],'original hydrology-only result is preserved');
    assert.deepEqual(report.candidates.map(x=>x.modeledFootprint.changedCellCount),[6,0,48]);
    assert.deepEqual(report.footprintAwareFrontier,[1,2,3],'all three have a modeled-effect-vs-intervention-footprint tradeoff');
    for(let i=0;i<3;i++){
      assert.equal(report.candidates[i].onFootprintAwareFrontier,true);
      assert.equal(report.candidates[i].modeledFootprint.changedCellIndices.length,[6,0,48][i]);
      assert.deepEqual(await readFile(paths[i]),before[i]);
    }
    assert.match(report.footprintInterpretation,/not.*(cost|construction|physical)/i);
  });
});

test('changed edge without cell edits accounts for both shared edge endpoints; source-only changes do not inflate footprint',async()=>{
  const original=makeExample();
  const noChange=structuredClone(original);
  noChange.proposal=structuredClone(noChange.existing);
  const changed=structuredClone(noChange);
  changed.proposal[9].internalBarriers={east:{closed:true,source:'hypothetical flood barrier'}};
  const sourceOnly=structuredClone(noChange);
  sourceOnly.existing[9].internalBarriers={east:{closed:true,source:'observed source A'}};
  sourceOnly.proposal[9].internalBarriers={east:{closed:true,source:'proposal source B'}};
  await withProjects([noChange,changed],async paths=>{
    const report=await compareProposalFiles(paths);
    assert.deepEqual(report.candidates.map(x=>x.modeledFootprint.changedCellIndices),[[],[9,10]]);
    assert.deepEqual(report.candidates.map(x=>x.modeledFootprint.changedCellCount),[0,2]);
  });
  await withProjects([sourceOnly,structuredClone(sourceOnly)],async paths=>{
    const report=await compareProposalFiles(paths);
    assert.deepEqual(report.candidates.map(x=>x.modeledFootprint.changedCellIndices),[[],[]]);
  });
});

test('surface, elevation and internal edge changes union distinct original grid indexes without counting metadata',async()=>{
  const first=makeExample();
  first.proposal=structuredClone(first.existing);
  const second=structuredClone(first);
  second.proposal[0].elevationM+=0.01;
  second.proposal[10].surface='garden';
  second.proposal[9].internalBarriers={east:{crestElevationM:0.4,source:'authored proposed crest'}};
  second.proposal[11].provenance='rewritten description, no geometry changes';
  await withProjects([first,second],async paths=>{
    const report=await compareProposalFiles(paths);
    assert.deepEqual(report.candidates[0].modeledFootprint.changedCellIndices,[]);
    assert.deepEqual(report.candidates[1].modeledFootprint.changedCellIndices,[0,9,10]);
    assert.equal(report.candidates[1].modeledFootprint.changedCellCount,3);
  });
});

test('three-objective dominance reports a strict win and independent tradeoffs without overwriting two-objective API',async()=>{
  const original=makeExample();original.proposal=structuredClone(original.existing);
  const same=structuredClone(original);
  const poor=structuredClone(original);
  poor.proposal[3]={...poor.proposal[3],surface:'sealed',provenance:'hypothetical change'};
  await withProjects([original,same,poor],async paths=>{
    const report=await compareProposalFiles(paths);
    assert.deepEqual(report.namedObjectiveFrontier,report.candidates.filter(c=>c.onNamedObjectiveFrontier).map(c=>c.inputOrdinal));
    for(const c of report.candidates){
      assert.equal(c.onFootprintAwareFrontier,c.footprintAwareDominatedBy.length===0);
      assert.ok(c.footprintAwareDominatedBy.every(i=>Number.isInteger(i)&&i>=1&&i<=3));
    }
    assert.equal(report.footprintAwareObjectives.length,3);
    assert.equal(report.footprintAwareObjectives[2].field,'changedCellCount');
  });
});
