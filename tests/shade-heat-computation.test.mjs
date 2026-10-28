import test from 'node:test';
import assert from 'node:assert/strict';
import { createShadeHeatComputation } from '../shade-heat-computation.js';
const complete=()=>({investigation:{kind:'transport fixture'},report:{status:'compared'}});
class FakeWorker {
 constructor(){this.terminated=0;}
 postMessage(value){this.request=value;if(this.postFailure)throw Error('Fixture post failure');}
 terminate(){this.terminated++;}
 respond(data){this.onmessage({data});}
}

test('cancelled and duplicate worker completions cannot retire a successor',async()=>{
 const workers=[],c=createShadeHeatComputation(()=>{const w=new FakeWorker();workers.push(w);return w;});
 const first=c.compute({operation:'prepare'}),cancelled=first.then(()=>null,error=>error);
 const second=c.compute({operation:'prepare'});assert.equal((await cancelled).code,'superseded');
 workers[0].respond({ok:true,result:complete()});assert.equal(c.pending,true);
 const value=complete();workers[1].respond({ok:true,result:value});assert.equal(await second,value);assert.equal(c.pending,false);
 const third=c.compute({operation:'prepare'}),thirdOutcome=third.then(()=>null,error=>error);
 workers[1].respond({ok:true,result:complete()});assert.equal(c.pending,true);
 c.cancel();assert.equal((await thirdOutcome).code,'superseded');assert.equal(c.pending,false);
 for(const w of workers)assert.equal(w.terminated,1);
});

test('worker construction and dispatch errors refuse without a synchronous fallback',async()=>{
 const broken=createShadeHeatComputation(()=>{throw Error('Fixture constructor failure');});
 await assert.rejects(broken.compute({operation:'prepare'}),/constructor failure/);assert.equal(broken.pending,false);
 const worker=new FakeWorker();worker.postFailure=true;const c=createShadeHeatComputation(()=>worker);
 await assert.rejects(c.compute({operation:'prepare'}),/post failure/);assert.equal(c.pending,false);assert.equal(worker.terminated,1);
});

test('worker failure and incomplete results never become successful investigations',async()=>{
 for(const reply of [{ok:false,error:'Fixture model refusal'},{ok:true,result:null},{ok:true,result:{investigation:{},report:{status:'refused'}}},{ok:'yes',result:complete()}]){
  const worker=new FakeWorker(),c=createShadeHeatComputation(()=>worker),request=c.compute({operation:'parse'});
  worker.respond(reply);await assert.rejects(request);assert.equal(c.pending,false);assert.equal(worker.terminated,1);
 }
 const worker=new FakeWorker(),c=createShadeHeatComputation(()=>worker),request=c.compute({operation:'prepare'});
 worker.onerror({preventDefault(){}});await assert.rejects(request,/could not complete/);assert.equal(c.pending,false);
});

test('serialization accepts only a complete string and terminates its own worker',async()=>{
 const workers=[],c=createShadeHeatComputation(()=>{const w=new FakeWorker();workers.push(w);return w;});
 const bad=c.compute({operation:'serialize'});workers[0].respond({ok:true,result:42});await assert.rejects(bad);
 const good=c.compute({operation:'serialize'});workers[1].respond({ok:true,result:'{"kind":"transport fixture"}'});
 assert.equal(await good,'{"kind":"transport fixture"}');assert.equal(c.pending,false);
});
