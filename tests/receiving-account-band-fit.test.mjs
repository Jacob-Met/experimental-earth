import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fitReceivingAccountBands,reserveReceivingAccountBandWork,serializeReceivingAccountBandSearch,parseReceivingAccountBandSearch,makeNoisyReceivingAccountBandExample} from '../receiving-account-band-fit.js';
import {proposeReceivingAccountLayers} from '../receiving-account-proposals.js';
import {evaluateReadings} from '../infiltration-study.js';
import {evaluateReceivingAccountRows,receivingAccountVerdict} from '../receiving-account-evidence.js';
import {independentBandCourse,independentBandGrid} from './receiving-band-fixtures.mjs';
import {noisyCourses} from '../experiments/noisy-original-bands.mjs';

const run=e=>fitReceivingAccountBands(e.project,e.selection,e.account),clone=x=>structuredClone(x);
const hypotheses=r=>r.candidates.map(c=>c.hypothesis);
const receipt={schema:'experimental-earth-original-band-fit-native/1',checks:[],sourceKind:'Authored model controls and unfamiliar parameter grid, not field validation',sourceHashes:{},prequalificationFailures:['The first mixed-surface negative-control fixture was not surface-dry at its first receiver reading and failed its eligibility assertion before exercising the control. The fixture now selects the first truth-eligible member of the predeclared independent grid, before any inverse result is inspected. Production method bytes are unchanged.']};
for(const path of ['receiving-account-band-fit.js','receiving-account-proposals.js','post-dry-receiving-inverse.js','draining-infiltration.js','core.js','receiving-account-evidence.js','vendor/worldlaw-linear-fit.mjs','tests/receiving-band-fixtures.mjs'])
  receipt.sourceHashes[path]=createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex');
receipt.methodFreeze={recordedUtc:new Date().toISOString(),meaning:'These exact method bytes and unfamiliar authored grid were fixed before this first independent-grid execution. Development184-course outcomes are separate.',sourceHashes:clone(receipt.sourceHashes)};
if(process.env.RECEIVING_BAND_FREEZE)writeFileSync(process.env.RECEIVING_BAND_FREEZE,JSON.stringify(receipt.methodFreeze,null,2)+'\n');
let groups=0;
function group(name,body){groups++;test(name,async()=>{await body();receipt.checks.push(name);if(process.env.RECEIVING_BAND_RECEIPT)writeFileSync(process.env.RECEIVING_BAND_RECEIPT,JSON.stringify(receipt,null,2)+'\n');});}
function originalTruthVerdicts(c){
  const surface=c.project.observations.map((reading,index)=>({reading,index})).filter(row=>row.reading.scenario===c.selection.target);
  const rows=evaluateReceivingAccountRows(c.result,c.account.readings);
  return Object.fromEntries(['calibration','challenge'].map(use=>[use,receivingAccountVerdict(evaluateReadings(c.result,surface.filter(r=>r.reading.use===use)),rows.filter(r=>r.use===use))]));
}

group('actual noisy original example gains witnesses while preserving the analytic incumbent and every original source',()=>{
  const e=makeNoisyReceivingAccountBandExample(),before=clone(e),baseline=proposeReceivingAccountLayers(e.project,e.selection,e.account),r=run(e);
  assert.equal(baseline.compatibleIds.length,0);assert.equal(r.compatibleIds.length,3);assert.equal(r.survivingIds.length,3);
  assert.deepEqual(r.baseline,baseline);assert.deepEqual(e,before);
  for(const candidate of r.candidates){assert.equal(candidate.accountReadings.length,e.account.readings.length);assert.equal(candidate.calibration.compatible,true);assert.equal(candidate.challenge.compatible,true);}
  assert.ok(r.counts.reducedTrials<=r.reservation.reducedTrials);assert.ok(r.counts.seedKernelCalls<=r.reservation.seedKernelCalls);
  assert.equal(r.counts.originalGridChecks,3);receipt.example={baseline:baseline.status,status:r.status,counts:r.counts,reservation:r.reservation,candidates:r.candidates.map(c=>({hypothesis:c.hypothesis,calibration:c.calibration,challenge:c.challenge}))};
});

group('held values only challenge frozen parameters and do not change starts, trials or prospective questions',()=>{
  const e=makeNoisyReceivingAccountBandExample(),first=run(e);
  e.project.observations.filter(r=>r.use==='challenge').forEach(r=>r.depthMm=500);
  e.account.readings.filter(r=>r.use==='challenge').forEach(r=>r.valueLiters=100000);
  const wrong=run(e);assert.equal(wrong.status,'challenged');assert.equal(wrong.survivingIds.length,0);
  assert.deepEqual(hypotheses(wrong),hypotheses(first));assert.deepEqual(wrong.searches,first.searches);assert.deepEqual(wrong.counts,first.counts);assert.deepEqual(wrong.question,first.question);assert.deepEqual(wrong.compatibleIds,first.compatibleIds);
});

group('contradictory original bands cannot become a witness or a fallback success',()=>{
  const e=makeNoisyReceivingAccountBandExample();e.account.readings.push({...e.account.readings[0],id:'contradictory-same-minute',valueLiters:e.account.readings[0].valueLiters+10});
  const r=run(e);assert.equal(r.compatibleIds.length,0);assert.equal(r.survivingIds.length,0);assert.equal(r.status,'no-band-witness');assert.equal(r.question.best,null);
  assert.ok(r.searches.every(s=>s.status!=='reduced-band-witness'));receipt.contradiction={status:r.status,counts:r.counts};
});

group('source-only replay is strict and saved conclusions never supply parameters',()=>{
  const e=makeNoisyReceivingAccountBandExample(),saved=serializeReceivingAccountBandSearch(e.project,e.selection,e.account),raw=JSON.parse(saved),opened=parseReceivingAccountBandSearch(saved);
  assert.deepEqual(Object.keys(raw).sort(),['schema','project','selection','account'].sort());assert.deepEqual(run(opened),run(e));
  for(const name of ['candidates','fit','result','searches','truth'])assert.throws(()=>parseReceivingAccountBandSearch(JSON.stringify({...raw,[name]:{status:'several-surviving-proposals'}})),/saved conclusions/);
  for(const mutate of [e=>e.project.weather.mobilityPerHour=.1,e=>e.project.weather.boundaryExitPerHour=.1,e=>e.account.readings[0].minute+=.5,e=>e.selection.uniformReceiverBasis='']){const bad=clone(e);mutate(bad);assert.throws(()=>run(bad));}
});

async function instrumented({corruptOriginal=false}={}){
  const url=new URL('../receiving-account-band-fit.js',import.meta.url);let source=readFileSync(url,'utf8');
  for(const [before,after]of [
    ['{runRain,SURFACES}','{runRain as actualRunRain,SURFACES}'],
    ['{advanceDrainingLayer}','{advanceDrainingLayer as actualAdvance}'],
    ['{inferPostDryDrainedReceivers}','{inferPostDryDrainedReceivers as actualInverse}'],
    ['{proposeReceivingAccountLayers,','{proposeReceivingAccountLayers as actualProducer,'],
  ]){assert.equal(source.split(before).length,2);source=source.replace(before,after);}
  source=source.replace(/from '(\.[^']+)';/g,(_,path)=>"from '"+new URL(path,url).href+"';");
  source+='\nexport const calls={forward:0,kernel:0,inverse:0,incumbent:0};\n'+
    `const runRain=(cells,width,height,...args)=>{calls.forward++;const r=actualRunRain(cells,width,height,...args);if(${corruptOriginal}&&width===4&&height===3){for(const row of r.snapshots)row.depthsMm[0]+=20;for(const row of r.drainingLayer.snapshots){row.retainedLiters+=20;row.drainedLiters+=20;}}return r;};\n`+
    'const advanceDrainingLayer=(...args)=>{calls.kernel++;return actualAdvance(...args);};\n'+
    'const inferPostDryDrainedReceivers=(...args)=>{calls.inverse++;return actualInverse(...args);};\n'+
    'const proposeReceivingAccountLayers=(...args)=>{calls.incumbent++;return actualProducer(...args);};\n';
  return await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}

group('complete expanded budget refuses before the incumbent, inverse, kernel or forward model runs',async()=>{
  const m=await instrumented(),e=makeNoisyReceivingAccountBandExample();e.project.weather.stepMinutes=1;
  assert.throws(()=>m.fitReceivingAccountBands(e.project,e.selection,e.account),/complete original-band search/);
  assert.deepEqual(m.calls,{forward:0,kernel:0,inverse:0,incumbent:0});
  const valid=makeNoisyReceivingAccountBandExample(),r=m.fitReceivingAccountBands(valid.project,valid.selection,valid.account);
  assert.equal(m.calls.forward,r.counts.reducedTrials+r.counts.originalGridChecks);assert.equal(m.calls.kernel,r.counts.seedKernelCalls);assert.equal(m.calls.inverse,1);assert.equal(m.calls.incumbent,1);
  receipt.budget={refusedCalls:{forward:0,kernel:0,inverse:0,incumbent:0},validCalls:clone(m.calls),reservation:r.reservation};
});

group('unselected original surfaces remain binding and reduced-grid success cannot replace full-grid verification',async()=>{
  const e=independentBandGrid().find(course=>course.eligible);assert.ok(e);
  const normal=run(e);assert.ok(normal.compatibleIds.length>0);
  const m=await instrumented({corruptOriginal:true}),corrupt=m.fitReceivingAccountBands(e.project,e.selection,e.account);
  assert.ok(corrupt.searches.some(s=>s.status==='reduced-band-witness'));assert.equal(corrupt.compatibleIds.length,0);assert.equal(corrupt.survivingIds.length,0);assert.equal(corrupt.status,'no-band-witness');
  const fixedDepth=e.result.snapshots.find(r=>r.minute===100).depthsMm[2];e.project.observations.push({cellIndex:2,minute:100,depthMm:fixedDepth,uncertaintyMm:.001,scenario:'proposal',use:'calibration',source:'Authored independent unselected sealed surface'});
  const withFixed=run(e);assert.ok(withFixed.compatibleIds.length>0);assert.equal(withFixed.counts.originalGridChecks,4);
  e.project.observations.at(-1).depthMm+=2;const wrongFixed=run(e);assert.equal(wrongFixed.compatibleIds.length,0);assert.equal(wrongFixed.status,'no-band-witness');
  receipt.fullGridNegative={originalWidth:4,originalHeight:3,reducedWitness:true,corruptFullGridSupport:corrupt.compatibleIds.length,contradictoryUnselectedSupport:wrongFixed.compatibleIds.length};
});

group('frozen method receives a new mixed-surface parameter grid without selecting on held values',()=>{
  const all=independentBandGrid(),eligible=all.filter(c=>c.eligible),records=[];const started=performance.now();
  let baselineSupported=0,calibrationSupported=0,surviving=0,maxReserved=0,totalReduced=0;
  for(const c of eligible){
    const truth=originalTruthVerdicts(c);assert.equal(truth.calibration.compatible,true);assert.equal(truth.challenge.compatible,true);
    const r=run(c);if(r.baseline.compatibleIds.length)baselineSupported++;if(r.compatibleIds.length)calibrationSupported++;if(r.survivingIds.length)surviving++;
    maxReserved=Math.max(maxReserved,r.reservation.totalCellEquivalentSteps);totalReduced+=r.counts.reducedTrials;
    assert.ok(r.reservation.totalCellEquivalentSteps<=r.reservation.limit);assert.ok(r.counts.reducedTrials<=r.reservation.reducedTrials);
    for(const row of r.candidates){assert.equal(row.calibration.compatible,row.surfaceCalibration.compatible!==false&&row.accountReadings.filter(x=>x.use==='calibration').every(x=>x.withinBand));}
    records.push({truth:c.truth,weather:c.project.weather,truthCalibration:truth.calibration,truthChallenge:truth.challenge,status:r.status,baselineSupported:r.baseline.compatibleIds.length,calibrationWitnesses:r.compatibleIds.length,survivingWitnesses:r.survivingIds.length,counts:r.counts,models:r.candidates.map(x=>({hypothesis:x.hypothesis,calibration:x.calibration,challenge:x.challenge}))});
  }
  assert.ok(eligible.length>20);assert.ok(calibrationSupported>baselineSupported);assert.ok(surviving>0);
  receipt.independentGrid={totalParameterTuples:all.length,eligible:eligible.length,excluded:all.filter(c=>!c.eligible).map(c=>({truth:c.truth,weather:c.project.weather,reasons:c.reasons})),baselineSupported,calibrationSupported,surviving,totalReduced,maxReserved,milliseconds:performance.now()-started,records,
    limits:'Unfamiliar authored parameters and mixed-source geometry; not measured soil validation or continuous uncertainty coverage. Held failures are retained and cannot tune this recorded method.'};
});

group('development noisy grid remains separate from unfamiliar-grid evidence',()=>{
  const cases=noisyCourses().filter(c=>c.eligible);let baselineSupported=0,calibrationSupported=0,surviving=0;const records=[];
  for(const c of cases){const r=run(c);if(r.baseline.compatibleIds.length)baselineSupported++;if(r.compatibleIds.length)calibrationSupported++;if(r.survivingIds.length)surviving++;records.push({tupleIndex:c.tupleIndex,pattern:c.pattern,status:r.status,baseline:r.baseline.compatibleIds.length,calibration:r.compatibleIds.length,surviving:r.survivingIds.length,counts:r.counts});}
  receipt.developmentGrid={courses:cases.length,baselineSupported,calibrationSupported,surviving,records,limits:'Consumed184-course development set. Prototypev1/v2 receipts are retained; this is not an independent holdout.'};
});

test('write exact-source receipt after every native group executes',()=>{
  assert.equal(receipt.checks.length,groups);receipt.passed=true;
  if(process.env.RECEIVING_BAND_RECEIPT)writeFileSync(process.env.RECEIVING_BAND_RECEIPT,JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({groups,independent:{total:receipt.independentGrid.totalParameterTuples,eligible:receipt.independentGrid.eligible,baseline:receipt.independentGrid.baselineSupported,calibration:receipt.independentGrid.calibrationSupported,surviving:receipt.independentGrid.surviving},development:{courses:receipt.developmentGrid.courses,calibration:receipt.developmentGrid.calibrationSupported,surviving:receipt.developmentGrid.surviving}}));
});
