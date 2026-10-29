import assert from'node:assert/strict';import{advanceFinite}from'../finite-profile-node.js';
const base={waterMm:0,storedMm:0,capacityMm:2,drainagePerHour:1,arrivalMmHr:0,uptakeMmHr:4,outflowMmHr:0,hours:1},rows=[];const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function run(name,input,expected){const r=advanceFinite({...base,...input});for(const[k,v]of Object.entries(expected))close(r[k],v);close(r.balanceMm,0);rows.push({name,input,result:r});return r;}
run('initial full receiver',{storedMm:2,arrivalMmHr:5,outflowMmHr:1},{waterMm:2,absorbedMm:2,drainedMm:2,outMm:1,storedMm:2});
run('wet to dry receiver',{waterMm:1,arrivalMmHr:2,hours:2},{waterMm:0,absorbedMm:5,storedMm:2+(4*(1-Math.exp(-.5))-2)*Math.exp(-1.5)});
run('no drainage fills then spills',{waterMm:1,arrivalMmHr:2,drainagePerHour:0,outflowMmHr:1},{waterMm:1/3,storedMm:2,absorbedMm:2,outMm:2/3,drainedMm:0});
run('empty dry receiver',{storedMm:1},{waterMm:0,storedMm:Math.exp(-1),drainedMm:1-Math.exp(-1)});
run('zero capacity',{capacityMm:0,arrivalMmHr:3,outflowMmHr:2},{waterMm:1,absorbedMm:0,outMm:2,storedMm:0});
for(const input of[{waterMm:1,arrivalMmHr:2,hours:2},{storedMm:2,arrivalMmHr:5,outflowMmHr:1},{waterMm:3,arrivalMmHr:.1,outflowMmHr:2,drainagePerHour:0},{capacityMm:20,arrivalMmHr:5,drainagePerHour:1e-9}]){const p={...base,...input},whole=advanceFinite(p);for(const n of[2,7,32]){let w=p.waterMm,s=p.storedMm,out=0,drain=0,uptake=0;for(let i=0;i<n;i++){const r=advanceFinite({...p,waterMm:w,storedMm:s,hours:p.hours/n});w=r.waterMm;s=r.storedMm;out+=r.outMm;drain+=r.drainedMm;uptake+=r.absorbedMm;}for(const[a,b]of[[w,whole.waterMm],[s,whole.storedMm],[out,whole.outMm],[drain,whole.drainedMm],[uptake,whole.absorbedMm]])close(a,b);}}
assert.throws(()=>advanceFinite({...base,storedMm:3}),/declarations/);assert.throws(()=>advanceFinite({...base,waterMm:5e-324,uptakeMmHr:2,capacityMm:10,drainagePerHour:0}),/Unrepresentable/);
