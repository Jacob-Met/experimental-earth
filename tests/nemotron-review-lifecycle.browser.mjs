import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=Object.fromEntries(['app.js','nemotron-review.js','tests/nemotron-review-lifecycle.browser.mjs'].map(p=>[p,createHash('sha256').update(readFileSync(root+p)).digest('hex')]));
const checks=[];
function installGate(){
 const originalFetch=globalThis.fetch.bind(globalThis),pending=[];globalThis.__reviewGate={pending};
 globalThis.fetch=(input,init)=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href);
  if(url.origin!==location.origin||url.pathname!=='/api/nemotron-review')return originalFetch(input,init);
  return new Promise((resolve,reject)=>pending.push({figures:JSON.parse(init.body).figures,resolve,reject}));
 };
}
try{
 const result=await withBrowserSession({root,chromeBin:process.env.CHROME_BIN,runDirectory:process.env.BROWSER_RUN_DIRECTORY??root+'.browser-review-'+randomUUID()},async session=>{
 const {send,evaluate,baseUrl}=session;
 const run=(fn,...args)=>evaluate('('+fn.toString()+')(...'+JSON.stringify(args)+')');
 await send('Runtime.enable');await send('Page.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'('+installGate.toString()+')()'});
 await send('Page.navigate',{url:process.env.EARTH_REVIEW_BASE_URL??baseUrl});
 async function until(expression,label){for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(50);}assert.fail('Timed out: '+label);}
 const ready=()=>until("document.querySelector('#rain-comparison-status')?.dataset.state==='ready'",'ready');
 const view=()=>run(()=>({hidden:document.querySelector('#nemotron-review-output').hidden,text:document.querySelector('#nemotron-review-output').textContent,status:document.querySelector('#nemotron-review-status').textContent,disabled:document.querySelector('#nemotron-review-run').disabled}));
 async function start(){
  const index=await evaluate('__reviewGate.pending.length');assert.equal((await view()).disabled,false,'Current comparison can request review');
  await evaluate("document.querySelector('#nemotron-review-run').click()");await until('__reviewGate.pending.length==='+String(index+1),'captured request');return index;
 }
 async function settle(index,marker,failure=false,exact=false){
  await run(async(index,marker,failure,exact)=>{
   const request=__reviewGate.pending[index];
   if(failure)request.reject(new TypeError('Controlled transport failure'));
   else request.resolve(new Response(JSON.stringify({model:'controlled-model',text:exact?marker:marker+' Rain is '+request.figures.find(r=>r.label==='Hypothetical rain on the site').existing+' L.'}),{status:200,headers:{'Content-Type':'application/json'}}));
   await new Promise(resolve=>setTimeout(resolve,0));
  },index,marker,failure,exact);
 }
 async function changeRain(){
  const before=await evaluate("document.querySelector('#rain-comparison-status').dataset.generation");
  await run(()=>{const e=document.querySelector('#rain');e.value=Number(e.value)===41?'42':'41';e.dispatchEvent(new Event('change',{bubbles:true}));});
  await ready();assert.notEqual(await evaluate("document.querySelector('#rain-comparison-status').dataset.generation"),before);
 }
 await ready();
 let id=await start();await settle(id,'CURRENT CONTROL');let current=await view();
 assert.equal(current.hidden,false);assert.match(current.text,/CURRENT CONTROL/);assert.match(current.status,/All .*numbers.*match/);assert.equal(current.disabled,false);
 checks.push('Current success is displayed and checked');
 id=await start();await settle(id,'A qualitative reading with no quoted figures.',false,true);assert.match((await view()).status,/quotes no figures/);assert.equal((await view()).hidden,false);
 id=await start();await settle(id,'Unverified total is 987654321 L.',false,true);assert.match((await view()).status,/Treat the flagged sentences as unverified/);assert.match((await view()).text,/Unverified number/);
 checks.push('No figures and unverified current replies preserve distinct feedback');
 id=await start();await changeRain();let before=await view();assert.equal(before.hidden,true);await settle(id,'RETIRED SUCCESS');assert.deepEqual(await view(),before,'Retired success must not mutate current review UI');checks.push('Delayed success after rain edit is retired');
 id=await start();await changeRain();before=await view();await settle(id,'',true);assert.deepEqual(await view(),before,'Retired error must not mutate current review UI');checks.push('Delayed error after rain edit is retired');
 const a=await start();await changeRain();const b=await start();before=await view();assert.equal(before.disabled,true);await settle(a,'OLDER REQUEST');assert.deepEqual(await view(),before,'Old completion cannot mutate newer pending request');await settle(b,'LATEST REQUEST');current=await view();assert.equal(current.hidden,false);assert.match(current.text,/LATEST REQUEST/);assert.doesNotMatch(current.text,/OLDER REQUEST/);assert.equal(current.disabled,false);checks.push('A/B race preserves B pending state and accepts only B');
 id=await start();
 await run(()=>{const original=JSON.parse(localStorage.getItem('experimental-earth-site-v1'));original.title='Explicit review lifecycle import';const file=new File([JSON.stringify(original)],'review-project.json',{type:'application/json'});const transfer=new DataTransfer();transfer.items.add(file);const input=document.querySelector('#import');input.files=transfer.files;input.files[0].text=()=>new Promise(resolve=>{__reviewGate.releaseImport=()=>resolve(JSON.stringify(original));});input.dispatchEvent(new Event('change',{bubbles:true}));});
 await until("document.querySelector('#rain-comparison-status').dataset.state==='loading' && typeof __reviewGate.releaseImport==='function'",'delayed import');before=await view();assert.equal(before.disabled,true);await settle(id,'PRE IMPORT REQUEST');assert.deepEqual(await view(),before,'Prior review cannot appear during loading');await evaluate('__reviewGate.releaseImport()');await ready();assert.equal(await evaluate("JSON.parse(localStorage.getItem('experimental-earth-site-v1')).title"),'Explicit review lifecycle import');assert.doesNotMatch((await view()).text,/PRE IMPORT REQUEST/);checks.push('Import retires review before asynchronous file read');
 id=await start();const saved=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
 try{
  await run(()=>{__reviewGate.originalWorker=globalThis.Worker;globalThis.Worker=class{constructor(){throw Error('Controlled worker startup refusal');}};const e=document.querySelector('#duration');e.value='720';e.dispatchEvent(new Event('change',{bubbles:true}));});
  await until("document.querySelector('#rain-comparison-status').dataset.state==='failed'",'worker failure');assert.match(await evaluate("document.querySelector('#rain-comparison-message').textContent"),/Controlled worker startup refusal/);
  before=await view();assert.equal(before.disabled,true);await settle(id,'BEFORE FAILED COMPARISON');assert.deepEqual(await view(),before);
  const count=await evaluate('__reviewGate.pending.length');await evaluate("document.querySelector('#nemotron-review-run').dispatchEvent(new Event('click',{bubbles:true}))");assert.equal(await evaluate('__reviewGate.pending.length'),count);
 }finally{await evaluate('globalThis.Worker=__reviewGate.originalWorker');}
 await evaluate("document.querySelector('#restore-rain-comparison').click()");await ready();assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),saved);assert.equal((await view()).disabled,false);assert.equal((await view()).hidden,true);id=await start();await settle(id,'RESTORED COMPARISON');assert.match((await view()).text,/RESTORED COMPARISON/);checks.push('Failed comparison refuses review; restore recovers original source and review');
 id=await start();await evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide'))");before=await view();await settle(id,'PRE PAGEHIDE REQUEST');assert.deepEqual(await view(),before);checks.push('Synthetic pagehide retires outstanding review');
 assert.deepEqual(session.exceptions,[]);return{source,checks,exceptions:session.exceptions,sandbox:session.sandbox,sandboxPath:session.sandboxPath,lifecycleLimit:'pagehide was dispatched synthetically; real BFCache traversal untested'};
 });
 console.log(JSON.stringify({status:'PASS',...result.value,session:result.receipt},null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',source,checks,error:{name:error.name,message:error.message,stack:error.stack,actual:error.actual,expected:error.expected},receiptFailure:error.receipt?.failure??null,receiptPath:error.receipt?.receiptFile??null},null,2));process.exitCode=1;}
