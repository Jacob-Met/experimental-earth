import assert from 'node:assert/strict';
import {pairedShadeCooling,greatestSampledCooling} from '../shade-heat-benefit.js';
const v=(x)=>({trajectory:[{minute:731,surfaceC:x,subsurfaceC:x}],means:{surfaceC:x,subsurfaceC:x},surface:{maximumC:x},subsurface:{maximumC:x}});
const r=(e,p)=>({courses:[{solarStepMinutes:60,targets:{existing:{lower:v(e[0]),upper:v(e[1])},proposal:{lower:v(p[0]),upper:v(p[1])}}}]});
for(const [e,p,want] of [[[10,20],[12,15],[-5,8]],[[10,10],[12,12],[-2,-2]],[[10,10],[10,10],[0,0]]]){
 const result=pairedShadeCooling(r(e,p),731)[0];
 assert.deepEqual(result.cooling,{lowerC:want[0],upperC:want[1]});
 for(const a of e)for(const b of p)assert(a-b>=want[0]&&a-b<=want[1]);
}
assert.throws(()=>pairedShadeCooling(r([1,1],[1,1]),731.5));
console.log('Independent interval endpoint, warmer/equal, domain controls PASS');

const distinct = r([10,20],[12,15]);
const targets=distinct.courses[0].targets;
targets.existing.lower.means.surfaceC=40;targets.existing.upper.means.surfaceC=50;
targets.proposal.lower.means.surfaceC=20;targets.proposal.upper.means.surfaceC=25;
targets.existing.lower.surface={maximumC:80,maximumMinute:600};
targets.existing.upper.surface={maximumC:90,maximumMinute:600};
targets.proposal.lower.surface={maximumC:60,maximumMinute:900};
targets.proposal.upper.surface={maximumC:70,maximumMinute:900};
assert.deepEqual(pairedShadeCooling(distinct,731)[0],{
 solarStepMinutes:60,minute:731,store:'surfaceC',
 cooling:{lowerC:-5,upperC:8},
 meanCooling:{lowerC:15,upperC:30},
 separatePeakDifference:{lowerC:10,upperC:30}
});
console.log('Distinct point, analytic mean and separate-time peak statistics PASS');

const full=()=>({courses:[60,30,15].map(solarStepMinutes=>({solarStepMinutes,targets:Object.fromEntries(['existing','proposal'].map(t=>[t,Object.fromEntries(['lower','upper'].map(b=>[b,{trajectory:Array.from({length:1441},(_,minute)=>({minute,surfaceC:t==='existing'?(b==='lower'?10:20):(b==='lower'?30:40)}))}]))]))}))});
let model=full();
for(const c of model.courses){
 c.targets.existing.lower.trajectory[7].surfaceC=15;
 c.targets.existing.lower.trajectory[8].surfaceC=15;
 c.targets.existing.upper.trajectory[9].surfaceC=25;
}
for(const x of greatestSampledCooling(model)){
 assert.deepEqual(x.lower,{coolingC:-25,minute:7});
 assert.deepEqual(x.upper,{coolingC:-5,minute:9});
 assert.equal(x.sampleCount,1441);
}
for(const damage of [
 x=>x.pop(), x=>x.push({...x[0]}),x=>x[1].surfaceC=NaN,x=>x[0].minute=Infinity]){
 const bad=structuredClone(model);damage(bad.courses[2].targets.proposal.upper.trajectory);
 assert.throws(()=>greatestSampledCooling(bad));
}
const stagger=full();
for(const c of stagger.courses){for(const b of ['lower','upper']){
 c.targets.existing[b].trajectory=Array.from({length:1441},(_,minute)=>({minute,surfaceC:minute===5?100:20}));
 c.targets.proposal[b].trajectory=Array.from({length:1441},(_,minute)=>({minute,surfaceC:minute===8?90:10}));
}}
assert.equal(100-90,10);assert.deepEqual(greatestSampledCooling(stagger)[0].lower,{coolingC:90,minute:5});
console.log('Complete sampled maxima, distinct witnesses, earliest ties, negative values, partial refusal and staggered peak control PASS');
