import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';
import {coolingExample} from '../evaporative-cooling-example.js';
import {prepareCooling,evaluateCoolingTarget} from '../evaporative-cooling.js';
const root=fileURLToPath(new URL('../',import.meta.url)),chromeBin=process.env.CHROME_BIN??'/opt/google/chrome/chrome';
const evidence=process.env.COOLING_FRACTION_RECEIPT_DIR??'/tmp/earth-cooling-fraction-'+randomUUID();mkdirSync(evidence,{recursive:false});
const state="document.querySelector('#cf-status').dataset.state",ranges="[...document.querySelectorAll('[data-fraction-range]')].map(x=>JSON.parse(x.dataset.value))";
async function course(name,run){return withBrowserSession({root,chromeBin,runDirectory:evidence+'/'+name},async ctx=>{
  assert.equal(ctx.sandbox.admitted,true);await ctx.send('Runtime.enable');await ctx.send('Page.enable');
  await ctx.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await ctx.send('Page.navigate',{url:ctx.baseUrl});
  const wait=async exp=>{for(let i=0;i<100;i++){if(await ctx.evaluate(exp))return;await delay(50);}throw Error('Timed out '+exp);};
  await wait("!!document.querySelector('#cf-form')");
  const open=async path=>{const doc=await ctx.send('DOM.getDocument');const q=await ctx.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#cf-open'});await ctx.send('DOM.setFileInputFiles',{nodeId:q.nodeId,files:[path]});};
  const capture=async name=>{const clip=await ctx.evaluate("(async()=>{const p=document.querySelector('#cf-results');p.scrollIntoView({behavior:'instant',block:'start'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=p.getBoundingClientRect();return{x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height,scale:1}})()");writeFileSync(evidence+'/'+name+'.png',Buffer.from((await ctx.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip})).data,'base64'));};
  const result=await run({...ctx,wait,open,capture});assert.deepEqual(ctx.exceptions,[]);return result;
});}
let savedPath,expectedRanges;
const first=await course('first',async({send,evaluate,wait,capture})=>{
  const active=await evaluate("localStorage.getItem('experimental-earth-site-v1')");assert.equal(await evaluate("document.querySelector('#cf-use').disabled"),true);
  await evaluate("document.querySelector('#ec-example').click();document.querySelector('#ec-form').requestSubmit();document.querySelector('#cf-use').click();document.querySelector('#cf-example').click();document.querySelector('#cf-form').requestSubmit()");await wait(state+"==='compatible-range'");
  expectedRanges=await evaluate(ranges);assert.ok(expectedRanges[0][0]<.4&&expectedRanges[0][1]>.4);
  await evaluate("document.querySelector('#cf-minute').value='137.5';document.querySelector('#cf-minute').dispatchEvent(new Event('change',{bubbles:true}))");assert.equal(await evaluate("document.querySelector('#cf-prediction').dataset.minute"),'137.5');
  await evaluate("document.querySelector('#cf-range').focus()");for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});assert.equal(await evaluate('document.activeElement.id'),'cf-range');assert.ok(Number(await evaluate("document.querySelector('#cf-prediction').dataset.minute"))<137.5);
  await evaluate("document.querySelectorAll('[data-cf=temperatureC]')[1].value='27.423860240826695';document.querySelectorAll('[data-cf=temperatureC]')[1].dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#cf-form').requestSubmit()");await wait(state+"==='challenged'");
  const challenged=await evaluate(ranges);assert.deepEqual(challenged[0],expectedRanges[0]);assert.equal(challenged[1],null);
  await evaluate("document.querySelector('#cf-example').click();document.querySelector('#cf-form').requestSubmit()");await wait(state+"==='compatible-range'");
  await evaluate("document.querySelector('#ec-latent').value='2300000';document.querySelector('#ec-latent').dispatchEvent(new Event('input',{bubbles:true}))");assert.deepEqual(await evaluate(ranges),expectedRanges);assert.match(await evaluate("document.querySelector('#cf-source').textContent"),/now differs/);assert.equal(await evaluate("document.querySelector('#cf-use').disabled"),true);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),active);
  await capture('desktop');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await capture('narrow');const dimensions=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(dimensions.scroll<=dimensions.width+1,JSON.stringify(dimensions));
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:evidence});await evaluate("document.querySelector('#cf-save').click()");
  for(let i=0;i<80;i++){if(readdirSync(evidence).includes('experimental-earth-cooling-readings-v1.json'))break;await delay(50);}
  savedPath=evidence+'/experimental-earth-cooling-readings-v1.json';const saved=JSON.parse(readFileSync(savedPath,'utf8'));assert.deepEqual(Object.keys(saved).sort(),['evidence','project','schema','study']);assert.equal(saved.study.latentHeatJkg,2450000);
  return {checks:['explicit original cooling adoption','authored fraction interval control','exact-time and native keyboard prediction inspector','held-aside rejection leaves calibration unchanged','later cooling edits preserve retained original readings','active site unchanged','desktop and narrow receiving','actual source-only download'],dimensions};
});
const second=await course('fresh',async({evaluate,wait,open})=>{
  const active=await evaluate("localStorage.getItem('experimental-earth-site-v1')");await open(savedPath);await wait(state+"==='reopened'");assert.deepEqual(await evaluate(ranges),expectedRanges);assert.equal(await evaluate("document.querySelector('#ec-form').hidden"),true);assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),active);
  const saved=JSON.parse(readFileSync(savedPath,'utf8'));saved.result={survivingRange:[.9,1]};const forged=evidence+'/forged.json';writeFileSync(forged,JSON.stringify(saved));await open(forged);await wait(state+"==='refused'");assert.deepEqual(await evaluate(ranges),expectedRanges);
  const x=coolingExample();x.study.surfaceLatentFraction.proposal=.4;const original=prepareCooling(x.project,x.study),window={fromMinute:30,minute:300};const mean=evaluateCoolingTarget(original,'proposal',[],[window]).averages[0].surfaceMeanC;
  await evaluate(`const row=document.querySelector('.cf-reading');row.querySelector('[data-cf=aggregation]').value='interval-mean';row.querySelector('[data-cf=aggregation]').dispatchEvent(new Event('change',{bubbles:true}));row.querySelector('[data-cf=fromMinute]').value='30';row.querySelector('[data-cf=minute]').value='300';row.querySelector('[data-cf=temperatureC]').value=${mean};row.querySelector('[data-cf=halfWidthC]').value='0.05';row.querySelector('[data-cf=source]').value='<img src=x onerror=alert(1)> literal authored mean';row.querySelector('[data-cf=source]').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#cf-form').requestSubmit()`);await wait(state+"==='compatible-range'");assert.equal(await evaluate("document.querySelectorAll('#cf-results img').length"),0);assert.match(await evaluate("document.querySelector('#cf-results').textContent"),/30–300 min mean/);const meanRanges=await evaluate(ranges);assert.ok(meanRanges[0][0]<.4&&meanRanges[0][1]>.4);
  const raw=readFileSync(savedPath,'utf8');await evaluate(`window.__cfOld=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){return new Promise(resolve=>window.__cfFinish=()=>resolve(new TextEncoder().encode(${JSON.stringify(raw)}).buffer))}`);await open(savedPath);await wait("typeof window.__cfFinish==='function'");await evaluate("document.querySelector('#cf-high').value='.7';document.querySelector('#cf-high').dispatchEvent(new Event('input',{bubbles:true}));window.__cfFinish();File.prototype.arrayBuffer=window.__cfOld");await delay(100);assert.equal(await evaluate(state),'draft');assert.equal(await evaluate("document.querySelector('#cf-high').value"),'.7');assert.equal(await evaluate("document.querySelector('#cf-results').children.length"),0);
  return {checks:['fresh-profile actual file recomputation','original active cooling/site preserved','forged result refused without discarding accepted result','actual interval-mean form with literal source','new draft cancels delayed file read']};
});
const result={status:'PASS',first,second,expectedRanges,evidence};writeFileSync(evidence+'/receipt.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
