import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{advance}from'../event-graph.mjs';
const source=readFileSync(new URL('../event-graph.mjs',import.meta.url),'utf8'),start=source.indexOf('if(rain===0'),end=source.indexOf('let dt=h-time;',start);assert.ok(start>0&&end>start);
const oldGuard='if(rain===0&&water.every(v=>v===0)&&stores.every(v=>v===0)){time=h;break;}';
const{advance:old}=await import('data:text/javascript;base64,'+Buffer.from(source.slice(0,start)+oldGuard+source.slice(end)).toString('base64'));
const budget=()=>({used:0,limit:3000000});let cases=0;
for(const stored of[.001,.2,1,100])for(const d of[0,.01,.5,10])for(const h of[.01,1,12]){
 const r=[{capacityMm:stored,storedMm:stored,drainagePerHour:d}],a=budget(),b=budget(),args=[[0],[0],[],[],h,0,0,0,[1]],x=old(...args,a,r),y=advance(...args,b,r),expected=stored*Math.exp(-d*h);
 assert.equal(y.stores[0],expected);assert.ok(Math.abs(y.stores[0]-x.stores[0])<=1e-12*Math.max(1,stored));assert.equal(y.water[0],0);assert.equal(y.absorbed,0);assert.ok(Math.abs(y.balance)<1e-12*Math.max(1,stored));assert.ok(b.used<=a.used);cases++;
}
for(const [water,rain]of[[1,0],[0,1],[1,1],[1e-100,0]]){
 const args=[[water],[0],[],[],.01,0,0,rain,[0]],r=[{capacityMm:1,storedMm:.2,drainagePerHour:1}];assert.deepEqual(advance(...args,budget(),r),old(...args,budget(),r));
}
const tiny=advance([0],[0],[],[],100,0,0,0,[0],budget(),[{capacityMm:1,storedMm:1,drainagePerHour:1}]);assert.equal(tiny.stores[0],Math.exp(-100));assert.ok(tiny.stores[0]>0); // no subtractive cancellation to zero
assert.throws(()=>advance([0],[0],[],[],1,0,0,0,[0],{used:0,limit:0},[{capacityMm:1,storedMm:1,drainagePerHour:1}]),/work/);
assert.throws(()=>advance([0],[0],[],[],1,0,0,0,[0],budget(),[{capacityMm:1e308,storedMm:1e308,drainagePerHour:1e308}]),/nonfinite rates/);
console.log({passed:true,analyticCases:cases,positiveStateParity:4,controls:3});
