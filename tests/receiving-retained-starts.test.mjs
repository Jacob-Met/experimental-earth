import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fitReceivingAccountBands,reserveReceivingAccountBandWork,makeUncertainRetainedBandExample,serializeReceivingAccountBandSearch,parseReceivingAccountBandSearch} from '../receiving-account-band-fit.js';
import {compareReceivingAccountConsequences} from '../receiving-account-consequences.js';
import {independentRetainedCourses} from './receiving-retained-fixtures.mjs';

const run=e=>fitReceivingAccountBands(e.project,e.selection,e.account),clone=x=>structuredClone(x),sha=x=>createHash('sha256').update(x).digest('hex');
const methodUrl=new URL('../receiving-account-band-fit.js',import.meta.url);
const baselineBytes=readFileSync(new URL('../experiments/retained-baseline-band-fit.js.txt',import.meta.url));
const baseline=await import('data:text/javascript;base64,'+Buffer.from(baselineBytes.toString().replace(/from '(\.[^']+)';/g,(_,path)=>"from '"+new URL(path,methodUrl).href+"';")).toString('base64'));
const receipt={schema:'experimental-earth-retained-start-native/1',checks:[],sourceHashes:{},interpretation:'Original-band calibration coverage, not identified soil parameters. Held failures and unresolved searches remain explicit.'};
for(const path of ['receiving-account-band-fit.js','receiving-account-proposals-panel.js','tests/receiving-retained-starts.test.mjs','tests/receiving-retained-fixtures.mjs','experiments/independent-retained-tuples.json'])receipt.sourceHashes[path]=sha(readFileSync(new URL('../'+path,import.meta.url)));
let groups=0;
function group(name,body){groups++;test(name,async()=>{await body();receipt.checks.push(name);if(process.env.RECEIVING_RETAINED_RECEIPT)writeFileSync(process.env.RECEIVING_RETAINED_RECEIPT,JSON.stringify(receipt,null,2)+'\n');});}
const hypotheses=result=>result.candidates.map(row=>row.hypothesis);

group('valid increasing-center retained bands gain a full-grid witness while informative held failures remain failures',()=>{
  const e=makeUncertainRetainedBandExample(),before=clone(e),old=baseline.fitReceivingAccountBands(e.project,e.selection,e.account),result=run(e);
  assert.equal(old.status,'no-search-starts');assert.equal(old.compatibleIds.length,0);
  assert.equal(result.status,'challenged');assert.equal(result.compatibleIds.length,1);assert.equal(result.survivingIds.length,0);
  assert.deepEqual(e,before);assert.ok(result.searches.some(row=>row.status==='reduced-band-witness'));
  const supported=result.candidates.filter(row=>row.calibration.compatible);
  assert.ok(supported.every(row=>row.accountReadings.filter(r=>r.use==='challenge').every(r=>!r.withinBand)));
  assert.equal(result.counts.seedKernelCalls,0);assert.equal(result.counts.seedRetainedRatePairs,1);
  assert.equal(result.counts.projectedKernelCalls,result.counts.reducedTrials*58);
  assert.ok(result.counts.projectedKernelCalls<=result.reservation.projectedKernelCalls);
  receipt.example={baseline:old.status,status:result.status,support:result.compatibleIds,heldSupport:result.survivingIds,counts:result.counts,reservation:result.reservation};
});

group('held-only changes cannot affect projected starts, parameters, work, calibration support or offered questions',()=>{
  const e=makeUncertainRetainedBandExample(),first=run(e);
  e.account.readings.filter(row=>row.use==='challenge').forEach(row=>row.valueLiters=100000);
  e.project.observations.filter(row=>row.use==='challenge').forEach(row=>row.depthMm=500);
  const wrong=run(e);
  assert.deepEqual(hypotheses(wrong),hypotheses(first));assert.deepEqual(wrong.searches,first.searches);
  assert.deepEqual(wrong.counts,first.counts);assert.deepEqual(wrong.compatibleIds,first.compatibleIds);assert.deepEqual(wrong.question,first.question);
  assert.equal(wrong.status,'challenged');assert.equal(wrong.survivingIds.length,0);
});

group('contradictory same-time bands, increasing disjoint bands and all-zero nonidentifying bands supply no fallback',()=>{
  const examples=[];
  const same=makeUncertainRetainedBandExample();same.account.readings.push({...same.account.readings[0],id:'disjoint-original-same-time',valueLiters:1000,uncertaintyLiters:.001});examples.push(['same-time-contradiction',same]);
  const increasing=makeUncertainRetainedBandExample();increasing.account.readings.filter(r=>r.use==='calibration').forEach((row,i)=>{row.valueLiters=i+1;row.uncertaintyLiters=.001;});examples.push(['increasing-disjoint',increasing]);
  const zero=makeUncertainRetainedBandExample();zero.account.readings.filter(r=>r.use==='calibration').forEach(row=>{row.valueLiters=0;row.uncertaintyLiters=0;});examples.push(['all-zero',zero]);
  receipt.refusals=[];
  for(const [name,e]of examples){const result=run(e);assert.equal(result.compatibleIds.length,0);assert.equal(result.survivingIds.length,0);assert.equal(result.status,'no-search-starts');assert.equal(result.counts.projectedKernelCalls,0);assert.equal(result.question.best,null);receipt.refusals.push({name,status:result.status,counts:result.counts,refusals:result.refusals});}
});

async function instrumented(corruptOriginal=false){
  let source=readFileSync(methodUrl,'utf8');
  for(const [before,after]of [['{runRain,SURFACES}','{runRain as actualRunRain,SURFACES}'],['{advanceDrainingLayer}','{advanceDrainingLayer as actualAdvance}'],['{proposeReceivingAccountLayers,','{proposeReceivingAccountLayers as actualProducer,']]){
    assert.equal(source.split(before).length,2);source=source.replace(before,after);
  }
  source=source.replace(/from '(\.[^']+)';/g,(_,path)=>"from '"+new URL(path,methodUrl).href+"';");
  source+='\nexport const calls={forward:0,kernel:0,incumbent:0};\n'+
    `const runRain=(cells,width,height,...args)=>{calls.forward++;const r=actualRunRain(cells,width,height,...args);if(${corruptOriginal}&&width===4&&height===3){for(const row of r.snapshots)row.depthsMm[0]+=20;for(const row of r.drainingLayer.snapshots)row.retainedLiters+=100;}return r;};\n`+
    'const advanceDrainingLayer=(...args)=>{calls.kernel++;return actualAdvance(...args);};\n'+
    'const proposeReceivingAccountLayers=(...args)=>{calls.incumbent++;return actualProducer(...args);};\n';
  return await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
function resize(e,width,height){
  const scale=width*height/(e.project.width*e.project.height);e.project.width=width;e.project.height=height;
  for(const side of ['existing','proposal'])e.project[side]=Array.from({length:width*height},()=>({...e.project[side][0]}));
  for(const row of [...e.account.readings,...e.account.offers]){if('valueLiters'in row)row.valueLiters*=scale;row.uncertaintyLiters*=scale;}
  e.account.footprintBasis='Authored original whole-footprint account for '+width*height+' cells of one square metre each.';return e;
}

group('the extra projected work alone can refuse before any incumbent, forward model or kernel runs',async()=>{
  const e=resize(makeUncertainRetainedBandExample(),17,18),old=baseline.reserveReceivingAccountBandWork(e.project,e.selection,e.account);
  assert.ok(old.totalCellEquivalentSteps<1000000);
  const m=await instrumented();assert.throws(()=>m.fitReceivingAccountBands(e.project,e.selection,e.account),/complete original-band search/);
  assert.deepEqual(m.calls,{forward:0,kernel:0,incumbent:0});
  const valid=makeUncertainRetainedBandExample(),result=m.fitReceivingAccountBands(valid.project,valid.selection,valid.account);
  assert.equal(m.calls.kernel,result.counts.seedKernelCalls+result.counts.projectedKernelCalls);
  assert.equal(m.calls.forward,result.counts.reducedTrials+result.counts.originalGridChecks);assert.equal(m.calls.incumbent,1);
  receipt.budget={oldReserved:old.totalCellEquivalentSteps,newRefusedBeforeAnyCalculation:true,validCalls:m.calls,validReservation:result.reservation};
});

group('projected reduced-grid success cannot survive corrupt original-grid verification',async()=>{
  const e=resize(makeUncertainRetainedBandExample(),4,3),valid=run(e);assert.ok(valid.compatibleIds.length>0);
  const m=await instrumented(true),bad=m.fitReceivingAccountBands(e.project,e.selection,e.account);
  assert.ok(bad.searches.some(row=>row.status==='reduced-band-witness'));
  assert.equal(bad.status,'no-band-witness');assert.equal(bad.compatibleIds.length,0);assert.equal(bad.survivingIds.length,0);
  receipt.fullGridNegative={reducedWitness:true,corruptedFullSiteSupport:0,originalDimensions:[4,3]};
});

group('source-only replay recomputes projected search and rejects saved conclusions',()=>{
  const e=makeUncertainRetainedBandExample(),text=serializeReceivingAccountBandSearch(e.project,e.selection,e.account),raw=JSON.parse(text),opened=parseReceivingAccountBandSearch(text);
  assert.deepEqual(Object.keys(raw).sort(),['schema','project','selection','account'].sort());assert.deepEqual(run(opened),run(e));
  for(const key of ['searches','candidates','truth','fit','rateInterval'])assert.throws(()=>parseReceivingAccountBandSearch(JSON.stringify({...raw,[key]:{compatible:true}})),/saved conclusions/);
});

group('the paired consumer retains the calibration witness and its consequences while held support stays empty',()=>{
  const e=makeUncertainRetainedBandExample(),options={mode:'bands',transferBasis:'Authored same receiver and initial water in every garden cell in both original layouts; no physical adoption.'};
  const report=compareReceivingAccountConsequences(e.project,e.selection,e.account,options);
  assert.equal(report.status,'challenged');assert.equal(report.candidates.length,1);assert.equal(report.survivingIds.length,0);
  assert.equal(report.effects.calibration.count,1);assert.equal(report.effects.surviving.count,0);
  assert.ok(Object.values(report.effects.surviving.metrics).every(value=>value===null));
  assert.equal(report.counts.comparisonRuns,6);assert.ok(report.candidates[0].calibration.compatible);
});

group('the frozen independently authored comparison reproduces8of15calibration and1of15held without changing eligibility',()=>{
  const saved=JSON.parse(readFileSync(new URL('../experiments/independent-retained-comparison.json',import.meta.url)));
  assert.equal(saved.freeze.sourceHashes['receiving-account-band-fit.js'],sha(readFileSync(methodUrl)));
  assert.equal(saved.baselineMethodSha256,sha(baselineBytes));
  const all=independentRetainedCourses(),eligible=all.filter(row=>row.eligible);assert.equal(all.length,18);assert.equal(eligible.length,15);
  const summary={baselineCalibration:0,currentCalibration:0,baselineHeld:0,currentHeld:0};
  for(const e of eligible){const old=baseline.fitReceivingAccountBands(e.project,e.selection,e.account),current=run(e),record=saved.records.find(row=>row.id===e.id);
    assert.deepEqual(hypotheses(current),record.current.candidates.map(row=>row.hypothesis));
    assert.deepEqual(current.compatibleIds,record.current.compatibleIds);assert.deepEqual(current.survivingIds,record.current.survivingIds);
    if(old.compatibleIds.length)summary.baselineCalibration++;if(current.compatibleIds.length)summary.currentCalibration++;
    if(old.survivingIds.length)summary.baselineHeld++;if(current.survivingIds.length)summary.currentHeld++;
  }
  assert.deepEqual(summary,{baselineCalibration:0,currentCalibration:8,baselineHeld:0,currentHeld:1});
  assert.deepEqual(summary,saved.summary);receipt.independent={summary,eligible:eligible.length,total:all.length,excluded:saved.excluded,allAdverseResultsRetained:true};
});

test('write receipt after every retained-start group completes',()=>{
  assert.equal(receipt.checks.length,groups);receipt.passed=true;
  if(process.env.RECEIVING_RETAINED_RECEIPT)writeFileSync(process.env.RECEIVING_RETAINED_RECEIPT,JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({passed:true,groups,independent:receipt.independent}));
});
