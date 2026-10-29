import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {runRain,SURFACES} from '../core.js';
import {hypothesisLayer} from '../draining-layer-evidence.js';
import {inferPostDryRetainedReceivers} from '../post-dry-receiving-inverse.js';
import {evaluateReadings} from '../infiltration-study.js';
import {evaluateReceivingAccountRows,receivingAccountVerdict} from '../receiving-account-evidence.js';
import {independentRetainedCourses} from '../tests/receiving-retained-fixtures.mjs';

const targetFractions=[0,.25,.5,.75,1],rateFractions=[0,.125,.25,.375,.5,.625,.75,.875,1],initialFractions=[0,.5,1];
const protocol={schema:'experimental-earth-retained-phase-start-diagnostic/1',frozenAtUtc:new Date().toISOString(),
  dataset:'Previously consumed independent18tuple course;15truth-eligible. This is development diagnosis, not another independent qualification.',
  fixedRules:{filled:'First original calibration storm center and earliest/latest retained calibration rows.5fixed points in each original retained band,25pairs; existing maintained post-dry inverse only. Every resulting boundary/interior model rechecked on all original bands.',
    unfilled:'For a storm-center band admitting the unlimited-intake surface course,9fixed rate fractions inside the pair-derived positive interval; intersect all retained calibration bands to obtain possible initial-water intervals.3fixed interval points and2explicit arbitrary capacities above the computed maximum inventory. All predictions use maintained forward model.',
    targetFractions,rateFractions,initialFractions,maximumFullGridCourses:25*6+9*3*2,wholeSiteStepLimit:1000000},
  meaning:'Computational proposal targets are not substituted observations. Future/held values cannot supply starts, choose models or tune any rule. Arbitrary never-filled capacities are witnesses, not estimates or certified bounds.',sourceHashes:{}};
for(const path of ['experiments/retained-phase-start-diagnostic.mjs','post-dry-receiving-inverse.js','core.js','draining-infiltration.js','tests/receiving-retained-fixtures.mjs'])protocol.sourceHashes[path]=createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex');
const freezeUrl=new URL('./retained-phase-start-protocol.json',import.meta.url),resultUrl=new URL('./retained-phase-start-result.json',import.meta.url);
writeFileSync(freezeUrl,JSON.stringify(protocol,null,2)+'\n');
const receipt={protocol,records:[],summary:{courses:0,filledCalibration:0,unfilledCalibration:0,unionCalibration:0,unionHeld:0},startedAtUtc:new Date().toISOString()};
const save=()=>writeFileSync(resultUrl,JSON.stringify(receipt,null,2)+'\n');save();
const point=(row,f)=>Math.max(0,row.valueLiters-row.uncertaintyLiters)+f*(row.valueLiters+row.uncertaintyLiters-Math.max(0,row.valueLiters-row.uncertaintyLiters));
for(const course of independentRetainedCourses().filter(c=>c.eligible)){
  const {project,selection,account}=course,w=project.weather,original=JSON.stringify({project,selection,account});
  const fullSteps=project.width*project.height*Math.ceil(w.durationMinutes/w.stepMinutes),reserved=protocol.fixedRules.maximumFullGridCourses*fullSteps;
  assert.ok(reserved<=1000000); // Full reserve precedes either inverse or model.
  const originals=project.observations.map((reading,index)=>({reading,index})).filter(row=>row.reading.scenario===selection.target),calibration=originals.filter(row=>row.reading.use==='calibration');
  const storm=calibration.find(row=>row.reading.minute===w.stormMinutes&&project[selection.target][row.reading.cellIndex].surface===selection.surface);
  const retained=account.readings.filter(row=>row.use==='calibration'&&row.channel==='retained'&&row.minute>w.stormMinutes).sort((a,b)=>a.minute-b.minute);
  const first=retained[0],last=retained.at(-1),area=project[selection.target].filter(cell=>cell.surface===selection.surface).length*w.cellSizeM**2;
  const candidates=[],refusals=[];let forwardCalls=0,inverseCalls=0;
  function keep(h,origin){
    if(![h.capacityMm,h.initialStoredMm,h.drainagePerHour].every(Number.isFinite)||h.capacityMm<0||h.capacityMm>10000||h.initialStoredMm<0||h.initialStoredMm>h.capacityMm||h.drainagePerHour<=0||h.drainagePerHour>100){refusals.push({origin,reason:'outside maintained parameter domain'});return;}
    const key=[h.capacityMm,h.initialStoredMm,h.drainagePerHour].join('/'),prior=candidates.find(row=>row.key===key);
    if(prior){prior.origins.push(origin);return;}
    if(++forwardCalls>protocol.fixedRules.maximumFullGridCourses)throw Error('Reserved full-grid diagnostic work exceeded.');
    const hypothesis={capacityMm:h.capacityMm,initialStoredMm:h.initialStoredMm,drainagePerHour:h.drainagePerHour,source:'Computational original-band phase witness; not an identified physical material'};
    const result=runRain(project[selection.target],project.width,project.height,w,{drainingLayer:hypothesisLayer(selection,hypothesis)});
    const surface=evaluateReadings(result,calibration),rows=evaluateReceivingAccountRows(result,account.readings.filter(row=>row.use==='calibration'));
    candidates.push({key,hypothesis,origins:[origin],calibration:receivingAccountVerdict(surface,rows),run:result});
  }
  for(const a of targetFractions)for(const b of targetFractions){
    const targetFirst=point(first,a),targetLast=point(last,b);inverseCalls++;
    const result=inferPostDryRetainedReceivers({rainMmHr:w.rainMmHr,infiltrationMmHr:SURFACES[selection.surface].infiltrationMmHr,stormMinutes:w.stormMinutes,stormEndDepthMm:storm.reading.depthMm,areaM2:area,
      earlier:{...first,valueLiters:targetFirst},later:{...last,valueLiters:targetLast}});
    const origin={family:'filled-target',bandCoordinates:[a,b],targetLiters:[targetFirst,targetLast],sourceRows:[first.id,last.id],meaning:'Computational points inside original calibration bands, never inserted as original evidence'};
    for(const h of result.proposals??[])keep(h,{...origin,phase:h.phase,capacityBranch:h.capacityBranch});
    if(!(result.proposals?.length))refusals.push({origin,reason:result.reason??result.status});
  }
  const F=SURFACES[selection.surface].infiltrationMmHr,T=w.stormMinutes/60,J=Math.min(w.rainMmHr,F),H=(w.rainMmHr-J)*T,U=T+H/F;
  if(Math.abs(H-storm.reading.depthMm)<=storm.reading.uncertaintyMm&&retained.every(row=>row.minute/60>=U)){
    const firstL=Math.max(0,first.valueLiters-first.uncertaintyLiters),firstU=first.valueLiters+first.uncertaintyLiters,lastL=Math.max(0,last.valueLiters-last.uncertaintyLiters),lastU=last.valueLiters+last.uncertaintyLiters,dt=(last.minute-first.minute)/60;
    const lower=Math.max(1e-10,firstL>0?(Math.log(firstL)-Math.log(lastU))/dt:0),upper=Math.min(100,lastL>0?(Math.log(firstU)-Math.log(lastL))/dt:100);
    for(const q of rateFractions){
      const k=lower+q*(upper-lower);if(!(lower<=upper&&k>0&&k<=100))continue;
      // S(t)e^(kt) = S0 + J/k(expm1(kT)) + F/k(exp(kU)-exp(kT)).
      // R>=F reduces to a single constant-F intake interval. The general form
      // retains the R<F case without introducing a new physical model.
      const inputAmplitude=J/k*Math.expm1(k*T)+F/k*Math.exp(k*T)*Math.expm1(k*(U-T));
      let lowerInitial=0,upperInitial=10000;
      for(const row of retained){const multiplier=Math.exp(k*row.minute/60)/area;lowerInitial=Math.max(lowerInitial,Math.max(0,row.valueLiters-row.uncertaintyLiters)*multiplier-inputAmplitude);upperInitial=Math.min(upperInitial,(row.valueLiters+row.uncertaintyLiters)*multiplier-inputAmplitude);}
      if(![inputAmplitude,lowerInitial,upperInitial].every(Number.isFinite)||lowerInitial>upperInitial){refusals.push({family:'unfilled',rateFraction:q,rate:k,reason:'No finite nonnegative initial-water interval at this fixed rate point'});continue;}
      for(const f of initialFractions){
        const S0=lowerInitial+f*(upperInitial-lowerInitial),atStorm=S0*Math.exp(-k*T)+J/k*(-Math.expm1(-k*T)),atDry=atStorm*Math.exp(-k*(U-T))+F/k*(-Math.expm1(-k*(U-T))),maximum=Math.max(S0,atStorm,atDry);
        const margin=Math.max(1e-8,1e-9*maximum),small=maximum+margin,large=Math.max(maximum*2,maximum+1);
        for(const [capacityChoice,C]of [['near-maximum',small],['larger-witness',large]])keep({capacityMm:C,initialStoredMm:S0,drainagePerHour:k},{family:'unfilled',rateFraction:q,initialFraction:f,initialIntervalMm:[lowerInitial,upperInitial],capacityChoice,maximumModeledStorageMm:maximum,
          meaning:'Explicit arbitrary never-filled capacity witness; this course does not identify capacity. No physical lower-bound enclosure is certified by these arithmetic values.'});
      }
    }
  }else refusals.push({family:'unfilled',reason:'The original storm band or late times do not admit this conditional unlimited-intake surface course.'});
  // Parameters and every calibration verdict are frozen before any held value
  // is read. Held predictions score the complete retained candidate family.
  for(const candidate of candidates){const surface=evaluateReadings(candidate.run,originals.filter(row=>row.reading.use==='challenge')),rows=evaluateReceivingAccountRows(candidate.run,account.readings.filter(row=>row.use==='challenge'));
    candidate.challenge=receivingAccountVerdict(surface,rows);delete candidate.run;delete candidate.key;}
  assert.equal(JSON.stringify({project,selection,account}),original);
  const filled=candidates.filter(c=>c.calibration.compatible&&c.origins.some(o=>o.family==='filled-target')),unfilled=candidates.filter(c=>c.calibration.compatible&&c.origins.some(o=>o.family==='unfilled')),supported=candidates.filter(c=>c.calibration.compatible),held=supported.filter(c=>c.challenge.compatible);
  receipt.summary.courses++;if(filled.length)receipt.summary.filledCalibration++;if(unfilled.length)receipt.summary.unfilledCalibration++;if(supported.length)receipt.summary.unionCalibration++;if(held.length)receipt.summary.unionHeld++;
  receipt.records.push({id:course.id,knownTruth:course.truth,reservedCellSteps:reserved,counts:{inverseCalls,forwardCalls},filledSupported:filled.length,unfilledSupported:unfilled.length,supported:supported.length,surviving:held.length,candidates,refusals});save();
  console.log(JSON.stringify({id:course.id,filled:filled.length,unfilled:unfilled.length,held:held.length,forwardCalls}));
}
receipt.completedAtUtc=new Date().toISOString();save();console.log(JSON.stringify(receipt.summary));
