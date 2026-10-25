import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {compareThreeFactors} from '../proposal-factorial.js';
const pop=n=>n.toString(2).replaceAll('0','').length;
let checks=0;
for(let seed=0;seed<40;seed++){
 const p=makeExample();p.width=p.height=2;p.selectedIndex=0;
 p.existing=Array.from({length:4},(_,i)=>({surface:'sealed',elevationM:((seed*7+i*3)%11)/100,provenance:'Authored held-aside family'}));
 p.proposal=structuredClone(p.existing);p.proposal[seed%4].surface=seed%2?'garden':'turf';p.proposal[(seed+1)%4].elevationM-=.03;
 p.proposal[0].internalBarriers={east:seed%2?{closed:true,source:'Authored wall'}:{crestElevationM:.15,source:'Authored crest'}};
 Object.assign(p.weather,{rainMmHr:5+seed,stormMinutes:30,durationMinutes:60,stepMinutes:5,cellSizeM:1});
 const before=JSON.stringify(p),r=compareThreeFactors(p);
 assert.equal(JSON.stringify(p),before);
 for(let mask=0;mask<8;mask++){
  const cells=structuredClone(p.existing);
  for(let i=0;i<cells.length;i++){
   if(mask&1)cells[i].surface=p.proposal[i].surface;
   if(mask&2)cells[i].elevationM=p.proposal[i].elevationM;
   if(mask&4){delete cells[i].internalBarriers;if(p.proposal[i].internalBarriers)cells[i].internalBarriers=structuredClone(p.proposal[i].internalBarriers);}
  }
  const direct=runRain(cells,p.width,p.height,p.weather);
  for(const m of r.metrics)assert.ok(Math.abs(direct[m.key]-m.values[mask])<1e-7);
 }
 for(const m of r.metrics)for(let mask=1;mask<8;mask++){
  let expected=0;for(let sub=0;sub<8;sub++)if((sub&mask)===sub)expected+=(-1)**(pop(mask)-pop(sub))*m.values[sub];
  assert.ok(Math.abs(expected-m.effects[mask])<1e-7);checks++;
 }
 for(const residual of r.balances)assert.ok(Math.abs(residual)<1e-7);
}
console.log({families:40,independentSubsetOracleChecks:checks});
import {runRain} from '../core.js';
import {compareThreeFactorHypotheses} from '../proposal-factorial.js';
const p=makeExample();p.proposal=structuredClone(p.existing);p.proposal[27].surface='garden';p.proposal[27].elevationM-=.05;p.proposal[27].internalBarriers={east:{closed:true,source:'Authored wall'}};
const study={target:'proposal',surface:'sealed',ratesMmHr:[1,9]};
const predicted=study.ratesMmHr.map(rateMmHr=>runRain(p.proposal,p.width,p.height,p.weather,{surfaceInfiltrationOverride:{surface:'sealed',rateMmHr}}).finalDepthMm[27]);
p.observations=[{cellIndex:27,minute:240,depthMm:predicted[0],uncertaintyMm:100,source:'Authored broad calibration',scenario:'proposal',use:'calibration'},{cellIndex:27,minute:240,depthMm:predicted[0],uncertaintyMm:.1,source:'Authored challenge',scenario:'proposal',use:'challenge'}];
const first=compareThreeFactorHypotheses(p,{study,subset:'calibration'});assert.deepEqual(first.candidates.map(c=>c.rateMmHr),[1,9]);assert.deepEqual(compareThreeFactorHypotheses(p,{study,subset:'surviving'}).candidates.map(c=>c.rateMmHr),[1]);
p.observations[1].depthMm=predicted[1];assert.deepEqual(compareThreeFactorHypotheses(p,{study,subset:'calibration'}),first);assert.deepEqual(compareThreeFactorHypotheses(p,{study,subset:'surviving'}).candidates.map(c=>c.rateMmHr),[9]);
console.log('Original full-proposal source and challenge-value independence pass');
const immobile=structuredClone(p);immobile.weather.mobilityPerHour=0;
for(const m of compareThreeFactors(immobile).metrics)for(const mask of [4,5,6,7])assert.ok(Math.abs(m.effects[mask])<1e-7);
for(const field of ['surface','elevationM','internalBarriers']){
 const missing=structuredClone(p);if(field==='internalBarriers')delete missing.proposal[27][field];else missing.proposal[27][field]=missing.existing[27][field];
 assert.throws(()=>compareThreeFactors(missing),/all three/);
 assert.throws(()=>compareThreeFactorHypotheses(missing,{study,subset:'calibration'}),/all three/);
}
const labels=structuredClone(p);labels.existing[27].internalBarriers=structuredClone(labels.proposal[27].internalBarriers);labels.existing[27].internalBarriers.east.source='Different source label';assert.throws(()=>compareThreeFactors(labels),/all three/);
const large=structuredClone(p);large.width=large.height=24;large.observations=[];large.existing=Array.from({length:576},()=>({surface:'sealed',elevationM:0,provenance:'Authored budget control'}));large.proposal=structuredClone(large.existing);large.proposal[27].surface='garden';large.proposal[27].elevationM=-.05;large.proposal[27].internalBarriers={east:{closed:true,source:'Authored wall'}};Object.assign(large.weather,{durationMinutes:720,stepMinutes:1});
assert.throws(()=>compareThreeFactors(large),/budget/);assert.throws(()=>compareThreeFactorHypotheses(large,{study}),/budget/);
const invalid=structuredClone(p);invalid.proposal[27].internalBarriers.east.crestElevationM=.2;assert.throws(()=>compareThreeFactors(invalid),/internal edge/i);
assert.throws(()=>compareThreeFactorHypotheses(p,{study,subset:'unknown'}),/Unknown/);
console.log('Zero-transfer, absent-factor, source-label, malformed-edge and complete-budget refusals pass');
