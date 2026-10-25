import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {makeExample} from '../core.js';
import {withBrowserSession} from './support/browser-session.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=process.env.BROWSER_RUN_DIRECTORY??root+'.browser-run-soil-resolution-'+randomUUID();
const project=makeExample();project.observations=[{cellIndex:37,minute:120,depthMm:27.128813082303168,uncertaintyMm:.1,source:'Authored one-minute numerical control, not field evidence',scenario:'existing',use:'calibration'}];
const checks=[];
const received=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome'},async session=>{
 const {send,evaluate,baseUrl,exceptions}=session;
 await send('Runtime.enable');await send('Page.enable');await send('DOM.enable');
 async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(50);}throw Error('Timed out '+expression);}
 const status=()=>evaluate("document.querySelector('#soil-search-status').textContent");
 async function visible(selector,focus=false){
  await evaluate(`(()=>{document.documentElement.style.scrollBehavior='auto';document.body.style.scrollBehavior='auto';const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({behavior:'instant',block:'center',inline:'nearest'});${focus?"e.focus({preventScroll:true});":""}})()`);
  let previous=null;
  for(let i=0;i<40;i++){
   const box=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,viewport:innerHeight}})()`);
   if(previous&&Math.abs(box.x-previous.x)<.1&&Math.abs(box.y-previous.y)<.1&&box.w>0&&box.h>0&&box.y>=0&&box.y+Math.min(box.h,40)<=box.viewport)return box;
   previous=box;await delay(25);
  }throw Error('Control not visibly settled: '+selector);
 }
 async function key(selector,key='Enter'){
  const box=await visible(selector,true);
  assert.equal(await evaluate(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`),true);
  assert.equal(await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+Math.min(r.height/2,20));return hit===e||e.contains(hit)})()`),true,'Control is covered: '+selector);
  const code=key===' '?'Space':'Enter',virtual=key===' '?32:13;
  await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtual,...(key==='Enter'?{text:'\r'}:{})});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual});
 }
 async function edit(name,value){const selector='#soil-search-form [name='+name+']';await visible(selector,true);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await send('Input.insertText',{text:value});}
 async function capture(name,selector){
  await evaluate(`(()=>{document.documentElement.style.scrollBehavior='auto';document.body.style.scrollBehavior='auto';document.querySelector(${JSON.stringify(selector)}).scrollIntoView({behavior:'instant',block:'start'})})()`);
  const a=await evaluate('scrollY');await delay(80);const b=await evaluate('scrollY');assert.equal(a,b,'Screenshot scroll must settle');
  const box=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {top:r.top,bottom:r.bottom}})()`);assert.ok(box.top>=-1&&box.top<120,JSON.stringify(box));
  const png=await send('Page.captureScreenshot',{format:'png'});writeFileSync(runDirectory+'/'+name+'.png',Buffer.from(png.data,'base64'));
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1360,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:baseUrl});await until("!!document.querySelector('#soil-search')");
 await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(project))})`);await send('Page.reload',{ignoreCache:true});await until("!!document.querySelector('#soil-search')");
 await key('#soil-search > summary');
 await edit('kmin','5');await edit('kmax','15');await edit('kcount','3');await edit('amin','0');await edit('amax','40');await edit('acount','3');
 const original=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
 await key('#soil-search-form button[type=submit]');await until("document.querySelectorAll('#soil-search-results tbody tr').length===9");
 assert.match(await status(),/0 agree with every calibration band/);
 async function resolution(){await key('#soil-search-resolution-run');await until("document.querySelector('#soil-search-resolution [role=status]').textContent.includes('depend on the tested')");}
 await resolution();
 const conclusion=await evaluate("document.querySelector('#soil-search-resolution').textContent");
 assert.match(conclusion,/5 min: 0 calibration-compatible/);assert.match(conclusion,/2.5 min: 0 calibration-compatible/);assert.match(conclusion,/1.25 min: 1 calibration-compatible/);assert.match(conclusion,/K 10 \/ A 20/);assert.match(conclusion,/all 9 identical/);
 assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),original);
 await capture('soil-resolution-desktop','#soil-search-resolution');
 checks.push('Visible keyboard search and finer calculation show actual calibration compatibility reversal on the identical nine-pair grid without adopting soil or dt');
 await evaluate(`(()=>{window.soilDownload={original:URL.createObjectURL,click:HTMLAnchorElement.prototype.click};URL.createObjectURL=function(b){window.soilDownload.blob=b;return window.soilDownload.original.call(this,b)};HTMLAnchorElement.prototype.click=function(){return window.soilDownload.click.call(this)}})()`);
 await key('#soil-search-save');const saved=await evaluate(`(async()=>{try{return await window.soilDownload.blob.text()}finally{URL.createObjectURL=window.soilDownload.original;HTMLAnchorElement.prototype.click=window.soilDownload.click;delete window.soilDownload}})()`);
 const bundle=JSON.parse(saved);assert.deepEqual(Object.keys(bundle),['schema','project','query']);assert.equal(bundle.project.weather.stepMinutes,5);assert.deepEqual(bundle.project.observations,project.observations);
 const savedPath=runDirectory+'/original-soil-search.json';writeFileSync(savedPath,saved);
 await visible('#rain',true);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await send('Input.insertText',{text:'40'});await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 await until("document.querySelector('#soil-search-resolution')===null");const changed=await evaluate("localStorage.getItem('experimental-earth-site-v1')");assert.notEqual(changed,original);
 await visible('#soil-search-import');const document=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:document.root.nodeId,selector:'#soil-search-import'});await send('DOM.setFileInputFiles',{nodeId,files:[savedPath]});await until("document.querySelectorAll('#soil-search-results tbody tr').length===9");await resolution();
 assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),changed);assert.match(await evaluate("document.querySelector('#soil-search-resolution').textContent"),/1.25 min: 1 calibration-compatible/);
 checks.push('Changed actual weather retires every sensitivity conclusion; input-only source download and native reopening recompute original dt sensitivity independently');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(100);
 const layout=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,table:document.querySelector('#soil-search-results table').getBoundingClientRect().width})");assert.ok(layout.scroll<=layout.width+1);assert.ok(layout.table>=880);
 await capture('soil-resolution-mobile','#soil-search-resolution');
 await edit('kmin','4');assert.equal(await evaluate("document.querySelector('#soil-search-resolution')===null"),true);
 checks.push('Narrow sensitivity summary and original grid retain local readability; edited search invalidates replay and finer results');
 assert.deepEqual(exceptions,[]);const receipt={passed:true,checks,layout,runDirectory,browser:session.sandbox.browser.product,sandboxAdmitted:session.sandbox.admitted};writeFileSync(runDirectory+'/browser-receipt.json',JSON.stringify(receipt,null,2));return receipt;
});assert.equal(received.value.passed,true);console.log(JSON.stringify(received.value));
