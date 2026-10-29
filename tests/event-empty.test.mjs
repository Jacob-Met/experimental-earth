import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advance} from '../event-graph.mjs';
const guard='if(rain===0&&water.every(v=>v===0)&&stores.every(v=>v===0)){time=h;break;}';
const source=readFileSync(new URL('../event-graph.mjs',import.meta.url),'utf8');
assert.equal(source.split(guard).length,2);
const {advance:baseline}=await import('data:text/javascript;base64,'+Buffer.from(source.replace(guard,'')).toString('base64'));
const budget=()=>({used:0,limit:3000000});
const clean=r=>Object.fromEntries(Object.entries(r).filter(([k])=>!['steps','roots','residueEvents','residueInventory'].includes(k)));
let cases=0;
for(const rain of [0,.5])for(const initial of [[0,0],[1,0]])for(const stored of [0,.2]){
 const args=[initial,[1,0],[{a:0,b:1,crestMm:null}],[[1,1]],1,.5,1,rain,[.3,.7]];
 const receivers=[{capacityMm:1,storedMm:stored,drainagePerHour:1},null];
 const a=budget(),b=budget();const old=baseline(...args,a,receivers),next=advance(...args,b,receivers);
 assert.deepEqual(clean(next),clean(old));assert.ok(b.used<=a.used);cases++;
}
assert.equal(advance([0],[0],[],[[0,1]],1e20,0,1,0,[0],budget()).water[0],0);
assert.throws(()=>advance([0],[0],[],[[0,1]],1e20,0,1,1,[0],budget()),/step bound/);
assert.throws(()=>advance([0],[0],[],[],1,0,0,0,[0],{used:0,limit:0}),/work/);
assert.throws(()=>advance([0,0],[1e308,-1e308],[{a:0,b:1,crestMm:null}],[],1,1,0,0,[0,0],budget()),/nonfinite rates/);
assert.throws(()=>advance([0],[0],[],[],1,0,0,0,[NaN],budget()),/admission/);
console.log({passed:true,cases,controls:5});
