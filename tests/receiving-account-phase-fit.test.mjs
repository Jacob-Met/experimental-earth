import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runRain} from '../core.js';
import {hypothesisLayer} from '../draining-layer-evidence.js';
import {proposeUnfilledReceivingBandWitnesses} from '../post-dry-receiving-inverse.js';
import {fitReceivingAccountBands,reserveReceivingAccountBandWork} from '../receiving-account-band-fit.js';
import {fitReceivingAccountPhases,reserveReceivingAccountPhaseWork,makeUnfilledReceivingPhaseExample,serializeReceivingAccountPhases,parseReceivingAccountPhases} from '../receiving-account-phase-fit.js';
import {compareReceivingAccountConsequences,reserveReceivingAccountConsequenceWork} from '../receiving-account-consequences.js';
import {independentRetainedCourses} from './receiving-retained-fixtures.mjs';

const clone=x=>structuredClone(x),run=e=>fitReceivingAccountPhases(e.project,e.selection,e.account),hypotheses=r=>r.candidates.map(row=>row.hypothesis);
const receipt={schema:'experimental-earth-phase-family-native/1',checks:[],sourceHashes:{},meaning:'Authored controls and consumed-course development comparison; independent heldback tuples will be reported separately.'};
for(const path of ['post-dry-receiving-inverse.js','receiving-account-phase-fit.js','receiving-account-band-fit.js','receiving-account-consequences.js','tests/receiving-account-phase-fit.test.mjs'])receipt.sourceHashes[path]=createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex');
let groups=0;
function group(name,body){groups++;test(name,async()=>{await body();receipt.checks.push(name);if(process.env.RECEIVING_PHASE_RECEIPT)writeFileSync(process.env.RECEIVING_PHASE_RECEIPT,JSON.stringify(receipt,null,2)+'\n');});}

group('independent piecewise exponential oracle validates never-filled proposals below and above infiltration rate',()=>{
  const records=[];
  for(const R of [12,24,39])for(const initial of [0,7]){
    const F=24,T=.5,J=Math.min(R,F),H=(R-J)*T,dry=T+H/F,k=.7,area=4;
    const amplitude=initial+J/k*Math.expm1(k*T)+F/k*Math.exp(k*T)*Math.expm1(k*(dry-T));
    const readings=[90,180].map(minute=>({channel:'retained',use:'calibration',minute,valueLiters:area*amplitude*Math.exp(-k*minute/60),uncertaintyLiters:1e-4}));
    const proposed=proposeUnfilledReceivingBandWitnesses({rainMmHr:R,infiltrationMmHr:F,stormMinutes:T*60,stormEndDepthMm:H,stormUncertaintyMm:1e-5,areaM2:area,readings});
    assert.ok(proposed.proposals.length>0);assert.ok(proposed.proposals.length<=54);assert.equal(proposed.bandIntersections,18);
    const e=makeUnfilledReceivingPhaseExample();e.project.weather={...e.project.weather,rainMmHr:R,stormMinutes:30,durationMinutes:240};
    for(const h of proposed.proposals){const actual=runRain(e.project.proposal,2,2,e.project.weather,{drainingLayer:hypothesisLayer(e.selection,{...h,source:'Independent authored exponential-oracle proposal'})});
      for(const row of readings){const amount=actual.drainingLayer.snapshots.find(x=>x.minute===row.minute).retainedLiters;assert.ok(Math.abs(amount-row.valueLiters)<=row.uncertaintyLiters+1e-7);}
      const same=proposed.proposals.find(x=>x.capacityMm!==h.capacityMm&&x.initialStoredMm===h.initialStoredMm&&x.drainagePerHour===h.drainagePerHour);
      assert.ok(same);assert.match(h.meaning,/not an estimated soil capacity/);
    }
    records.push({rainMmHr:R,knownInitialMm:initial,conditionalDryMinute:dry*60,proposals:proposed.proposals.length});
  }
  receipt.exponentialOracle=records;
});

group('rate endpoint starts stay inside original broad and narrow intervals and never enlarge an exact point',()=>{
  const records=[];
  for(const uncertaintyLiters of [1e-4,1e-14,0]){
    const input={rainMmHr:.1,infiltrationMmHr:24,stormMinutes:30,stormEndDepthMm:0,stormUncertaintyMm:0,areaM2:4,
      readings:[{minute:90,valueLiters:12,uncertaintyLiters,use:'calibration',channel:'retained'},{minute:180,valueLiters:6,uncertaintyLiters,use:'calibration',channel:'retained'}]},before=clone(input),r=proposeUnfilledReceivingBandWitnesses(input),lo=r.minimumRatePerHour,hi=r.maximumRatePerHour;
    assert.deepEqual(input,before);assert.equal(r.ratePoints.length,9);assert.equal(r.bandIntersections,18);
    assert.ok(r.ratePoints.every(p=>p.drainagePerHour>=lo&&p.drainagePerHour<=hi));
    if(uncertaintyLiters){assert.ok(lo<hi);assert.ok(r.ratePoints[0].drainagePerHour>lo);assert.ok(r.ratePoints.at(-1).drainagePerHour<hi);assert.ok(r.endpointInsetPerHour<=(hi-lo)/4);assert.ok(r.ratePoints[0].sampledRateFraction>0);assert.ok(r.ratePoints.at(-1).sampledRateFraction<1);}
    else{assert.equal(lo,hi);assert.equal(r.endpointInsetPerHour,0);assert.ok(r.ratePoints.every(p=>p.drainagePerHour===lo&&p.sampledRateFraction===null));}
    for(const h of r.proposals){assert.ok(h.initialIntervalMm[0]<=h.initialIntervalMm[1]);assert.ok(h.initialStoredMm>=h.initialIntervalMm[0]&&h.initialStoredMm<=h.initialIntervalMm[1]);}
    records.push({uncertaintyLiters,lo,hi,inset:r.endpointInsetPerHour,points:r.ratePoints,proposals:r.proposals.length});
  }
  receipt.endpointSampling=records;
});

group('actual never-filled example preserves the old search and adds supported but nonidentifying capacity alternatives',()=>{
  const e=makeUnfilledReceivingPhaseExample(),before=clone(e),old=fitReceivingAccountBands(e.project,e.selection,e.account),r=run(e);
  assert.equal(old.compatibleIds.length,0);assert.deepEqual(r.bandIncumbent,old);assert.equal(r.compatibleIds.length,12);assert.equal(r.survivingIds.length,6);assert.deepEqual(e,before);
  const supported=r.candidates.filter(c=>c.calibration.compatible),pair=supported.find(c=>supported.some(d=>d.hypothesis.capacityMm!==c.hypothesis.capacityMm&&d.hypothesis.initialStoredMm===c.hypothesis.initialStoredMm&&d.hypothesis.drainagePerHour===c.hypothesis.drainagePerHour));
  assert.ok(pair);assert.ok(supported.every(c=>c.phaseOrigins.some(o=>o.family==='unfilled')));
  assert.equal(r.counts.phaseInverseCalls,6);assert.ok(r.counts.finalOriginalGridChecks<=r.reservation.finalGridChecks);
  receipt.example={status:r.status,oldCalibration:0,calibration:r.compatibleIds.length,held:r.survivingIds.length,counts:r.counts,reservation:r.reservation};
});

group('held changes alter only challenge support and cannot select phase parameters or prospective measurements',()=>{
  const e=makeUnfilledReceivingPhaseExample(),first=run(e);e.account.readings.filter(r=>r.use==='challenge').forEach(r=>r.valueLiters=100000);e.project.observations.filter(r=>r.use==='challenge').forEach(r=>r.depthMm=500);
  const wrong=run(e);assert.equal(wrong.status,'challenged');assert.equal(wrong.survivingIds.length,0);
  assert.deepEqual(hypotheses(wrong),hypotheses(first));assert.deepEqual(wrong.compatibleIds,first.compatibleIds);assert.deepEqual(wrong.counts,first.counts);assert.deepEqual(wrong.unfilled,first.unfilled);assert.deepEqual(wrong.question,first.question);
  assert.deepEqual(wrong.candidates.map(c=>c.phaseOrigins),first.candidates.map(c=>c.phaseOrigins));
});

group('contradictory originals, zero inventories and nonfinite amplitude points cannot become fallback support',()=>{
  const e=makeUnfilledReceivingPhaseExample();e.account.readings.push({...e.account.readings[0],id:'conflicting-original',valueLiters:1000,uncertaintyLiters:.001});const bad=run(e);
  assert.equal(bad.compatibleIds.length,0);assert.equal(bad.survivingIds.length,0);assert.equal(bad.question.best,null);
  const zero=makeUnfilledReceivingPhaseExample();zero.account.readings.filter(r=>r.use==='calibration').forEach(r=>{r.valueLiters=0;r.uncertaintyLiters=0;});assert.equal(run(zero).compatibleIds.length,0);
  const high=proposeUnfilledReceivingBandWitnesses({rainMmHr:12,infiltrationMmHr:24,stormMinutes:30,stormEndDepthMm:0,stormUncertaintyMm:0,areaM2:4,readings:[{minute:700,valueLiters:1,uncertaintyLiters:0,use:'calibration',channel:'retained'},{minute:720,valueLiters:1e-10,uncertaintyLiters:0,use:'calibration',channel:'retained'}]});
  assert.equal(high.proposals.length,0);assert.equal(high.status,'unresolved');assert.ok(high.refusals.every(r=>r.reason==='no-finite-nonnegative-initial-band-at-fixed-rate'));
  const absent=makeUnfilledReceivingPhaseExample();absent.selection.surface='turf';assert.equal(run(absent).status,'surface-absent');
  receipt.refusals={contradictoryStatus:bad.status,contradictorySupport:0,zeroSupport:0,overflowStatus:high.status,absentSurface:'surface-absent'};
});

function resize(e,width,height,mixed=false){
  const cells=width*height,selected=mixed?Array.from({length:cells},(_,i)=>i%3!==2).filter(Boolean).length:cells,scale=selected/4;
  e.project.width=width;e.project.height=height;e.project.existing=Array.from({length:cells},()=>({...e.project.existing[0]}));
  e.project.proposal=Array.from({length:cells},(_,i)=>({...e.project.proposal[0],surface:mixed&&i%3===2?'sealed':'garden'}));
  for(const row of [...e.account.readings,...e.account.offers]){if('valueLiters'in row)row.valueLiters*=scale;row.uncertaintyLiters*=scale;}
  e.account.footprintBasis='Authored whole-footprint account over '+selected+' selected cells, each one square metre.';return e;
}
async function instrumented(corrupt=false){
  const url=new URL('../receiving-account-phase-fit.js',import.meta.url);let text=readFileSync(url,'utf8');
  for(const [before,after]of [['{runRain,SURFACES}','{runRain as actualRunRain,SURFACES}'],['{inferPostDryRetainedReceivers,proposeUnfilledReceivingBandWitnesses,','{inferPostDryRetainedReceivers as actualFilled,proposeUnfilledReceivingBandWitnesses as actualUnfilled,'],['{fitReceivingAccountBands,','{fitReceivingAccountBands as actualBand,']]){assert.equal(text.split(before).length,2);text=text.replace(before,after);}
  text=text.replace(/from '(\.[^']+)';/g,(_,path)=>"from '"+new URL(path,url).href+"';");
  text+='\nexport const calls={forward:0,filled:0,unfilled:0,incumbent:0};\n'+
    `const runRain=(cells,width,height,...args)=>{calls.forward++;const r=actualRunRain(cells,width,height,...args);if(${corrupt}&&width===4&&height===3){for(const row of r.drainingLayer.snapshots)row.retainedLiters+=1000;}return r;};\n`+
    'const inferPostDryRetainedReceivers=(...args)=>{calls.filled++;return actualFilled(...args);};\n'+
    'const proposeUnfilledReceivingBandWitnesses=(...args)=>{calls.unfilled++;return actualUnfilled(...args);};\n'+
    'const fitReceivingAccountBands=(...args)=>{calls.incumbent++;return actualBand(...args);};\n';
  return await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
}

group('complete enlarged reservation refuses before any inverse, incumbent or model and counts actual original-grid work',async()=>{
  const e=resize(makeUnfilledReceivingPhaseExample(),8,6),old=reserveReceivingAccountBandWork(e.project,e.selection,e.account);assert.ok(old.totalCellEquivalentSteps<1000000);
  const m=await instrumented();assert.throws(()=>m.fitReceivingAccountPhases(e.project,e.selection,e.account),/complete original-band incumbent/);assert.deepEqual(m.calls,{forward:0,filled:0,unfilled:0,incumbent:0});
  const valid=makeUnfilledReceivingPhaseExample(),r=m.fitReceivingAccountPhases(valid.project,valid.selection,valid.account);assert.equal(m.calls.forward,r.counts.finalOriginalGridChecks);assert.equal(m.calls.filled,5);assert.equal(m.calls.unfilled,1);assert.equal(m.calls.incumbent,1);
  const paired=resize(makeUnfilledReceivingPhaseExample(),4,2);assert.ok(reserveReceivingAccountPhaseWork(paired.project,paired.selection,paired.account).totalCellEquivalentSteps<1000000);
  assert.throws(()=>reserveReceivingAccountConsequenceWork(paired.project,paired.selection,paired.account,{mode:'phases',transferBasis:'Authored same per-cell receiver in both layouts.'}),/every possible paired six-run/);
  receipt.budget={old48cellReserved:old.totalCellEquivalentSteps,phase48cellRefusedBeforeAnyCalculation:true,actualCalls:m.calls,actualReservation:r.reservation,paired8cellRefused:true};
});

group('all original surfaces and final full-map receiver checks bind the extra phase models',async()=>{
  const e=resize(makeUnfilledReceivingPhaseExample(),4,3,true),h={capacityMm:50,initialStoredMm:12.5,drainagePerHour:.25,source:'Authored mixed-map oracle'};
  const truth=runRain(e.project.proposal,4,3,e.project.weather,{drainingLayer:hypothesisLayer(e.selection,h)});
  e.project.observations.push({cellIndex:2,minute:120,depthMm:truth.snapshots.find(r=>r.minute===120).depthsMm[2],uncertaintyMm:1e-5,scenario:e.selection.target,use:'calibration',source:'Independent original unselected surface reading'});
  assert.ok(run(e).compatibleIds.length>0);
  const m=await instrumented(true),corrupt=m.fitReceivingAccountPhases(e.project,e.selection,e.account);assert.ok(corrupt.counts.phaseUniqueParameters>0);assert.equal(corrupt.compatibleIds.length,0);assert.equal(corrupt.survivingIds.length,0);
  e.project.observations.at(-1).depthMm+=10;const wrong=run(e);assert.equal(wrong.compatibleIds.length,0);
  receipt.fullMap={extraModelsWereGenerated:true,corruptedFinalSupport:0,contradictoryUnselectedSurfaceSupport:0};
});

group('strict original-source phase replay and paired consumer retain every generated calibration-compatible parameter set',()=>{
  const e=makeUnfilledReceivingPhaseExample(),r=run(e),text=serializeReceivingAccountPhases(e.project,e.selection,e.account),raw=JSON.parse(text);
  assert.deepEqual(Object.keys(raw).sort(),['schema','project','selection','account'].sort());assert.deepEqual(run(parseReceivingAccountPhases(text)),r);
  for(const key of ['candidates','unfilled','phaseOrigins','parameters','fit'])assert.throws(()=>parseReceivingAccountPhases(JSON.stringify({...raw,[key]:{compatible:true}})),/saved conclusions/);
  const c=compareReceivingAccountConsequences(e.project,e.selection,e.account,{mode:'phases',transferBasis:'Authored uniform receiver and per-cell initial water in both layouts; no physical adoption.'});
  assert.equal(c.status,'compared');assert.equal(c.candidates.length,12);assert.equal(c.survivingIds.length,6);assert.equal(c.counts.comparisonRuns,72);
  assert.deepEqual(c.candidates.map(x=>[x.hypothesis.capacityMm,x.hypothesis.initialStoredMm,x.hypothesis.drainagePerHour]).sort(),r.candidates.filter(x=>x.calibration.compatible).map(x=>[x.hypothesis.capacityMm,x.hypothesis.initialStoredMm,x.hypothesis.drainagePerHour]).sort());
  receipt.paired={models:12,held:6,runs:72,completeReservation:c.reservation.totalCellEquivalentSteps};
});

group('all15consumed development cases retain incumbent coverage and expose only2held-supported courses',()=>{
  let oldCal=0,newCal=0,oldHeld=0,newHeld=0;const records=[];
  for(const e of independentRetainedCourses().filter(c=>c.eligible)){const r=run(e);oldCal+=!!r.bandIncumbent.compatibleIds.length;newCal+=!!r.compatibleIds.length;oldHeld+=!!r.bandIncumbent.survivingIds.length;newHeld+=!!r.survivingIds.length;
    for(const id of r.bandIncumbent.compatibleIds)assert.ok(r.compatibleIds.includes(id));
    records.push({id:e.id,oldCalibration:r.bandIncumbent.compatibleIds.length,newCalibration:r.compatibleIds.length,oldHeld:r.bandIncumbent.survivingIds.length,newHeld:r.survivingIds.length,status:r.status,counts:r.counts});
  }
  assert.deepEqual({oldCal,newCal,oldHeld,newHeld},{oldCal:8,newCal:15,oldHeld:1,newHeld:2});receipt.consumedDevelopment={oldCal,newCal,oldHeld,newHeld,records,meaning:'Previously consumed15-case set used to diagnose this mechanism; not independent qualification.'};
});

test('write receipt after every phase-family native group passes',()=>{
  assert.equal(receipt.checks.length,groups);receipt.passed=true;
  if(process.env.RECEIVING_PHASE_RECEIPT)writeFileSync(process.env.RECEIVING_PHASE_RECEIPT,JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({passed:true,groups,development:{calibration:receipt.consumedDevelopment.newCal,held:receipt.consumedDevelopment.newHeld,total:15}}));
});
