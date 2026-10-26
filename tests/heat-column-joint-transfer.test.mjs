import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareJointHeatTransfer,compareJointHeatTransfer,serializeJointHeatTransfer,parseJointHeatTransfer} from '../heat-column-joint-transfer.js';
import {transferBundle,transferHeader} from './heat-column-transfer-fixture.mjs';
const evidence=(reference,candidate='B')=>{const transfer=transferBundle();if(candidate==='C')transfer.readingFile.text=transferHeader+'\n15,,instant,34.80452164293739,0.01,C,challenge,Authored independent matrix point\n45,30,interval-mean,30.16673606192061,0.01,C,challenge,Authored independent matrix mean\n';return{reference,transfer};};
const bundle=()=>prepareJointHeatTransfer([evidence('Cooling record one'),evidence('Cooling record two','C'),evidence('Cooling record three')]);
test('each separate exposure can pass while no common original alternative remains',()=>{
 const input=bundle(),before=JSON.stringify(input),r=compareJointHeatTransfer(input);
 assert.deepEqual(r.results.map(x=>x.result.transferLabels),[['B · reference lower store'],['C · offered lower store'],['B · reference lower store']]);
 assert.equal(r.status,'joint-transfer-rejected');assert.deepEqual(r.jointLabels,[]);assert.equal(r.candidates.length,5);assert.deepEqual(r.minimalConflicts.map(x=>x.indices),[[0,1],[1,2]]);assert.equal(JSON.stringify(input),before);
});
test('matching independent declarations retain common support without doubling evidence or ranking candidates',()=>{
 const input=prepareJointHeatTransfer([evidence('First'),evidence('Second')]),r=compareJointHeatTransfer(input);assert.equal(r.status,'one-common-finite-alternative');assert.deepEqual(r.jointLabels,['B · reference lower store']);assert.deepEqual(r.minimalConflicts,[]);
 for(const x of input.exposures)x.transfer.readingFile.text=x.transfer.readingFile.text.replaceAll(',0.1,C,',',100,C,');const wide=compareJointHeatTransfer(input);assert.equal(wide.status,'joint-ambiguity');assert.equal(wide.jointLabels.length,5);
});
test('single-exposure contradiction is reported separately from joint-only conflicts',()=>{
 const input=bundle();input.exposures[0].transfer.readingFile.text=transferHeader+'\n15,,instant,100,0.01,C,challenge,Authored contradiction\n';const r=compareJointHeatTransfer(input);assert.deepEqual(r.minimalConflicts.map(c=>c.indices),[[0],[1,2]]);assert.equal(r.originalCalibrationLabels.length,5);
});
test('missing original calibration and rejected original family do not become newly discovered exposure conflicts',()=>{
 const input=bundle();for(const x of input.exposures)x.transfer.originalProject.heatColumnEvidence.readings[0].use='challenge';let r=compareJointHeatTransfer(input);assert.equal(r.jointLabels,null);assert.equal(r.status,'need-original-calibration');assert.deepEqual(r.minimalConflicts,[]);
 for(const x of input.exposures){const row=x.transfer.originalProject.heatColumnEvidence.readings[0];row.use='calibration';row.temperatureC=150;}r=compareJointHeatTransfer(input);assert.equal(r.jointLabels,null);assert.equal(r.status,'original-family-rejected');assert.deepEqual(r.minimalConflicts,[]);
});
test('a changed original investigation, role or duplicated reference refuses the whole collection',()=>{
 let input=bundle();input.exposures[1].transfer.originalProject.title+=' changed';assert.throws(()=>compareJointHeatTransfer(input),/same complete original/);
 input=bundle();input.exposures[1].transfer.readingFile.text=input.exposures[1].transfer.readingFile.text.replaceAll(',challenge,',',calibration,');assert.throws(()=>compareJointHeatTransfer(input),/held aside/);
 input=bundle();input.exposures[1].reference=' '+input.exposures[0].reference+' ';assert.throws(()=>compareJointHeatTransfer(input),/distinct/);
});
test('source-only reopening recomputes all outcomes and preserves original project fields and CSVs',()=>{
 const input=bundle(),text=serializeJointHeatTransfer(input),back=parseJointHeatTransfer(text);assert.deepEqual(back,input);assert.deepEqual(compareJointHeatTransfer(back),compareJointHeatTransfer(input));
 const raw=JSON.parse(text);raw.results={jointLabels:['forged']};assert.throws(()=>parseJointHeatTransfer(JSON.stringify(raw)),/Retain two/);
 const reordered=bundle();const original=reordered.exposures[1].transfer.originalProject;reordered.exposures[1].transfer.originalProject=Object.fromEntries(Object.entries(original).reverse());assert.deepEqual(compareJointHeatTransfer(reordered).jointLabels,[]);
});
test('finite population limit is enforced before comparison and source permutation preserves named conflicts',()=>{
 assert.throws(()=>prepareJointHeatTransfer(Array.from({length:9},(_,i)=>evidence('Exposure '+i))),/two to eight/);
 const input=bundle(),r=compareJointHeatTransfer(input),permuted=compareJointHeatTransfer(prepareJointHeatTransfer([...input.exposures].reverse()));
 const named=x=>x.minimalConflicts.map(c=>[...c.references].sort().join('|')).sort();assert.deepEqual(named(permuted),named(r));
});
test('all eight-source minimal conflicts agree with an independent known-support set oracle',()=>{
 const values={A:[34.62475757792193,31.463054952285585],B:[34.68300177529785,30.704771782103844],C:[34.80452164293739,30.16673606192061],D:[34.924019294801745,29.761351031018584]};
 const kinds=['A','B','C','A','wide','B','C','D'];const exposures=kinds.map((kind,i)=>{const e=evidence('Original '+i);const v=values[kind]||values.B;e.transfer.readingFile.text=transferHeader+`\n15,,instant,${v[0]},${kind==='wide'?100:.001},C,challenge,Independent matrix point\n45,30,interval-mean,${v[1]},${kind==='wide'?100:.001},C,challenge,Independent matrix mean\n`;return e;});
 const expected=[];for(let i=0;i<kinds.length;i++)for(let j=i+1;j<kinds.length;j++)if(kinds[i]!=='wide'&&kinds[j]!=='wide'&&kinds[i]!==kinds[j])expected.push([i,j]);
 const r=compareJointHeatTransfer(prepareJointHeatTransfer(exposures));assert.equal(expected.length,18);assert.deepEqual(r.minimalConflicts.map(c=>c.indices),expected);assert.equal(r.candidates.length,5);assert.deepEqual(r.jointLabels,[]);
});
test('pairwise compatible original exposures can require all three sources to expose a joint conflict',()=>{
 const input=parseJointHeatTransfer(readFileSync(new URL('./fixtures/heat-joint-triple-conflict.json',import.meta.url),'utf8'));
 const r=compareJointHeatTransfer(input);assert.deepEqual(r.results.map(x=>x.result.transferLabels),[['B','C'],['A','B'],['A','C']]);assert.deepEqual(r.jointLabels,[]);assert.deepEqual(r.minimalConflicts.map(c=>c.indices),[[0,1,2]]);
 for(const pair of [[0,1],[0,2],[1,2]])assert.equal(compareJointHeatTransfer(prepareJointHeatTransfer(pair.map(i=>input.exposures[i]))).jointLabels.length,1);
});
