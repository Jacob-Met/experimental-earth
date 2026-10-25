import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {makeExample} from '../core.js';
import {withBrowserSession} from './support/browser-session.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=process.env.BROWSER_RUN_DIRECTORY??root+'.browser-run-soil-search-'+randomUUID();
const project=makeExample();project.width=project.height=2;project.selectedIndex=0;
project.existing=Array.from({length:4},()=>({surface:'turf',elevationM:0,provenance:'Authored analytic control'}));project.proposal=structuredClone(project.existing);
Object.assign(project.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:60,stepMinutes:5,cellSizeM:1,mobilityPerHour:0,boundaryExitPerHour:0});
project.observations=[{cellIndex:0,minute:60,depthMm:5.404720888434597,uncertaintyMm:.000001,source:'Authored equal-endpoint control, not field data',scenario:'existing',use:'calibration'}];
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
 await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(project))})`);await send('Page.reload',{ignoreCache:true});await until("document.querySelectorAll('#existing-grid .cell').length===4");
 await key('#soil-search > summary');
 await edit('kmin','10');await edit('kmax','24.595279111565403');await edit('kcount','2');await edit('amin','0');await edit('amax','20');await edit('acount','2');
 await edit('basis','<b>Authored search bounds</b>');const original=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
 await key('#soil-search-form button[type=submit]');
 await until("document.querySelectorAll('#soil-search-results tbody tr').length===4");
 assert.match(await status(),/2 agree with every calibration band/);assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),original);
 checks.push('Keyboard inverse search retains all four pairs and two equal-endpoint explanations without source mutation');
 await capture('soil-search-desktop-controls','#soil-search-form');await capture('soil-search-desktop-results','#soil-search-status');
 await evaluate(`(()=>{window.soilDownload={original:URL.createObjectURL,click:HTMLAnchorElement.prototype.click};URL.createObjectURL=function(b){window.soilDownload.blob=b;return window.soilDownload.original.call(this,b)};HTMLAnchorElement.prototype.click=function(){if(this.download==='experimental-earth-soil-search.json')window.soilDownload.clicked=true;return window.soilDownload.click.call(this)}})()`);
 await key('#soil-search-save');
 const saved=await evaluate(`(async()=>{try{return {clicked:window.soilDownload.clicked,text:await window.soilDownload.blob.text()}}finally{URL.createObjectURL=window.soilDownload.original;HTMLAnchorElement.prototype.click=window.soilDownload.click;delete window.soilDownload}})()`);
 assert.equal(saved.clicked,true);const bundle=JSON.parse(saved.text);assert.deepEqual(Object.keys(bundle),['schema','project','query']);assert.deepEqual(bundle.project.observations,project.observations);
 const savedPath=runDirectory+'/saved-search.json';writeFileSync(savedPath,saved.text);
 await key('#soil-search-results input[data-id="2"]',' ');await key('#soil-search-results input[data-id="3"]',' ');await key('#soil-search-prepare');
 assert.equal(await evaluate("document.querySelectorAll('#wetting-front-hypotheses .wf-hypothesis').length"),2);
 assert.equal(await evaluate("document.querySelector('#wetting-front-basis').value"),'<b>Authored search bounds</b>');
 assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),original);
 await key('#wetting-front-run');await until("!document.querySelector('#wetting-front-download').disabled");
 const compared=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));assert.deepEqual(compared.wettingFrontStudy.hypotheses,[{conductivityMmHr:10,capillaryDriveMm:20},{conductivityMmHr:24.595279111565403,capillaryDriveMm:0}]);assert.deepEqual(compared.existing,project.existing);
 assert.equal(await evaluate("document.querySelector('#soil-search-results').textContent"),'');
 checks.push('Explicit selection enters maintained paired comparison; only study inputs persist, and source refresh invalidates search');
 const current=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
 await visible('#soil-search-import');
 const document=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:document.root.nodeId,selector:'#soil-search-import'});await send('DOM.setFileInputFiles',{nodeId,files:[savedPath]});await until("document.querySelectorAll('#soil-search-results tbody tr').length===4");
 assert.match(await status(),/2 agree/);assert.equal(await evaluate("document.querySelector('#soil-search-prepare')===null"),true);assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),current);
 checks.push('Actual source download and file reopen recompute original ambiguity independently of working source');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(100);
 const layout=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth})");assert.ok(layout.scroll<=layout.width+1,JSON.stringify(layout));
 const tableLayout=await evaluate(`(()=>{const region=document.querySelector('#soil-search-results .wf-table'),table=region.querySelector('table');return {region:region.clientWidth,table:table.getBoundingClientRect().width,scroll:region.scrollWidth,focusable:region.tabIndex,columns:[...table.querySelectorAll('th')].map(e=>e.getBoundingClientRect().width)}})()`);
 assert.equal(tableLayout.focusable,0);assert.ok(tableLayout.table>=880,JSON.stringify(tableLayout));assert.ok(tableLayout.scroll>tableLayout.region,JSON.stringify(tableLayout));assert.ok(tableLayout.columns.every(w=>w>=100),JSON.stringify(tableLayout));
 await visible('#soil-search-results .wf-table',true);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
 await until("document.querySelector('#soil-search-results .wf-table').scrollLeft>0");
 assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
 await evaluate("document.querySelector('#soil-search-results .wf-table').scrollLeft=0");
 assert.ok(await evaluate("[...document.querySelectorAll('#soil-search-results tbody tr')].some(r=>/[Ee]/.test(r.cells[3].textContent))"),'Tiny nonzero RMSE uses scientific notation');

 await capture('soil-search-mobile-controls','#soil-search-form');await capture('soil-search-mobile-results','#soil-search-status');
 await edit('kmin','5');assert.equal(await evaluate("document.querySelector('#soil-search-results').textContent"),'');assert.equal(await evaluate("document.querySelector('#soil-search-save').disabled"),true);
 checks.push('Narrow viewport preserves readable 100px-plus columns with keyboard local scrolling, scientific tiny RMSE and no page overflow; edits retire replay and disable saving');
 assert.deepEqual(exceptions,[]);const receipt={passed:true,checks,layout,tableLayout,runDirectory,browser:session.sandbox.browser.product,sandboxAdmitted:session.sandbox.admitted};writeFileSync(runDirectory+'/browser-receipt.json',JSON.stringify(receipt,null,2));return receipt;
});assert.equal(received.value.passed,true);console.log(JSON.stringify(received.value));
