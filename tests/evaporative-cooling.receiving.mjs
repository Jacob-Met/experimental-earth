import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const chromeBin=process.env.CHROME_BIN??'/opt/google/chrome/chrome';
const evidence=process.env.COOLING_RECEIPT_DIR??'/tmp/earth-cooling-'+randomUUID();mkdirSync(evidence,{recursive:false});
async function course(runDirectory,run){return withBrowserSession({root,chromeBin,runDirectory},async ctx=>{
  assert.equal(ctx.sandbox.admitted,true);await ctx.send('Runtime.enable');await ctx.send('Page.enable');
  await ctx.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await ctx.send('Page.navigate',{url:ctx.baseUrl});
  const wait=async exp=>{for(let i=0;i<100;i++){if(await ctx.evaluate(exp))return;await delay(50);}throw Error('Timed out '+exp);};
  await wait("!!document.querySelector('#ec-form')");
  const open=async path=>{const doc=await ctx.send('DOM.getDocument');const q=await ctx.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#ec-open'});await ctx.send('DOM.setFileInputFiles',{nodeId:q.nodeId,files:[path]});};
  const account=()=>ctx.evaluate("Object.fromEntries([...document.querySelectorAll('#ec-account tbody tr')].map(r=>[r.dataset.quantity,[...r.querySelectorAll('td')].map(x=>Number(x.dataset.value))]))");
  const capture=async name=>{const clip=await ctx.evaluate("(async()=>{const p=document.querySelector('#ec-results');p.scrollIntoView({behavior:'instant',block:'start'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=p.getBoundingClientRect();return{x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height,scale:1}})()");writeFileSync(evidence+'/'+name+'.png',Buffer.from((await ctx.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip})).data,'base64'));};
  const result=await run({...ctx,wait,open,account,capture});assert.deepEqual(ctx.exceptions,[]);return result;
});}
const state="document.querySelector('#ec-status').dataset.state";
let savedPath,initial;
const first=await course(evidence+'/first',async({send,evaluate,wait,account,capture})=>{
  const active=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  assert.equal(await evaluate("document.querySelector('#ec-form').hidden"),true);
  await evaluate("document.querySelector('#ec-current').click()");assert.match(await evaluate("document.querySelector('#ec-status').textContent"),/First save/);
  await evaluate("document.querySelector('#ec-example').click();document.querySelector('#ec-form').requestSubmit()");await wait(state+"==='computed'");
  initial=await account();assert.ok(initial.surfaceC[1]<initial.surfaceC[0]);assert.ok(initial.suppliedMm[1]>initial.suppliedMm[0]);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),active);
  await evaluate("document.querySelector('#ec-minute').value='137.5';document.querySelector('#ec-minute').dispatchEvent(new Event('change',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#ec-at-minute').dataset.minute"),'137.5');
  const at=await account();assert.ok(at.availableMm[1]>initial.availableMm[1]);
  for(const side of [0,1])assert.ok(Math.abs(at.waterResidualMm[side])<1e-9&&Math.abs(at.energyResidualJm2[side])<1e-5);
  await evaluate("document.querySelector('#ec-minute-range').focus()");for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
  assert.equal(await evaluate('document.activeElement.id'),'ec-minute-range');assert.ok(Number(await evaluate("document.querySelector('#ec-at-minute').dataset.minute"))<137.5);
  await evaluate("document.querySelector('#ec-proposal-fraction').value='0';document.querySelector('#ec-proposal-fraction').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#ec-form').requestSubmit()");await wait(state+"==='computed'");
  const zero=await account();assert.equal(zero.surfaceLossJm2[1],0);assert.ok(zero.surfaceC[1]>initial.surfaceC[1]);assert.equal(zero.suppliedMm[1],initial.suppliedMm[1]);
  await evaluate("document.querySelector('#ec-example').click();document.querySelector('#ec-form').requestSubmit()");await wait(state+"==='computed'");
  await capture('desktop');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await capture('narrow');
  const dimensions=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(dimensions.scroll<=dimensions.width+1,JSON.stringify(dimensions));
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:evidence});await evaluate("document.querySelector('#ec-save').click()");
  for(let i=0;i<80;i++){const names=readdirSync(evidence);if(names.includes('experimental-earth-cooling-investigation-v1.json'))break;await delay(50);}
  savedPath=evidence+'/experimental-earth-cooling-investigation-v1.json';const file=JSON.parse(readFileSync(savedPath,'utf8'));
  assert.deepEqual(Object.keys(file).sort(),['project','schema','study']);assert.equal(file.study.surfaceLatentFraction.proposal,.6);assert.equal(file.study.latentHeatJkg,2450000);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),active);
  return {checks:['blank current-source entry','isolated authored example','exact arbitrary-time accounting','native keyboard inspection','zero-fraction causal control','active source remains unchanged','actual browser download','desktop and narrow captures'],dimensions};
});
const second=await course(evidence+'/fresh',async({evaluate,wait,open,account})=>{
  const active=await evaluate("localStorage.getItem('experimental-earth-site-v1')");await open(savedPath);await wait(state+"==='reopened'");assert.deepEqual(await account(),initial);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),active);
  const forged=JSON.parse(readFileSync(savedPath,'utf8'));forged.result={surfaceC:-999};const forgedPath=evidence+'/forged-result.json';writeFileSync(forgedPath,JSON.stringify(forged));await open(forgedPath);await wait(state+"==='refused'");assert.deepEqual(await account(),initial);
  await evaluate("document.querySelector('#ec-association').value='<img src=x onerror=alert(1)> literal source';document.querySelector('#ec-association').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#ec-form').requestSubmit()");await wait(state+"==='computed'");assert.equal(await evaluate("document.querySelectorAll('#ec-results img').length"),0);assert.match(await evaluate("document.querySelector('#ec-results').textContent"),/<img src=x/);
  const saved=readFileSync(savedPath,'utf8');await evaluate(`window.__ecOld=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){return new Promise(resolve=>window.__ecFinish=()=>resolve(new TextEncoder().encode(${JSON.stringify(saved)}).buffer))}`);
  await open(savedPath);await wait("typeof window.__ecFinish==='function'");await evaluate("document.querySelector('#ec-latent').value='2400000';document.querySelector('#ec-latent').dispatchEvent(new Event('input',{bubbles:true}));window.__ecFinish();File.prototype.arrayBuffer=window.__ecOld");await delay(100);assert.equal(await evaluate(state),'draft');assert.equal(await evaluate("document.querySelector('#ec-latent').value"),'2400000');assert.equal(await evaluate("document.querySelector('#ec-results').children.length"),0);
  return {checks:['fresh-profile actual-file reopen recomputes identical results','fresh active project preserved','saved conclusion refused without losing accepted result','sources rendered as literal text','new draft cancels delayed file read']};
});
const result={status:'PASS',first,second,initial,evidence};writeFileSync(evidence+'/receipt.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
