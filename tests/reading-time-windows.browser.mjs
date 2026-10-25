import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {makeExample} from '../core.js';
import {withBrowserSession} from './support/browser-session.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const p=makeExample();p.title='Window source — authored courtyard';p.width=p.height=2;p.selectedIndex=0;p.existing=Array.from({length:4},()=>({elevationM:0,surface:'turf',provenance:'authored'}));p.proposal=structuredClone(p.existing);Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:180,mobilityPerHour:0,boundaryExitPerHour:0});p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[3,9,22]};p.observations=[{cellIndex:0,minute:60,depthMm:21,uncertaintyMm:.01,source:'<img src=x onerror="window.__bad=1"> authored interior-peak control',scenario:'existing',use:'calibration'}];
const checks=[];
const result=await withBrowserSession({root,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',runDirectory:process.env.RUN_DIRECTORY??root+'.browser-run-reading-windows-'+randomUUID()},async({baseUrl,send,evaluate,exceptions,runDirectory})=>{
 let sandboxAdmission;
 try{
  sandboxAdmission=await requireChromiumSandbox({send});
 }catch(error){
  if(error.receipt){writeFileSync(runDirectory+'/reading-windows-sandbox-admission.json',JSON.stringify(error.receipt,null,2));writeFileSync(runDirectory+'/reading-windows-sandbox-status.txt',error.receipt.text??'');}
  throw error;
 }
 writeFileSync(runDirectory+'/reading-windows-sandbox-admission.json',JSON.stringify(sandboxAdmission,null,2));
 writeFileSync(runDirectory+'/reading-windows-sandbox-status.txt',sandboxAdmission.text);
 assert.equal(sandboxAdmission.observation.rows.layer1,'Namespace','This course requires actual namespace sandbox admission');
 for(const key of ['pid','network','seccomp','tsync'])assert.equal(sandboxAdmission.observation.checks[key],true,`Actual sandbox protection missing: ${key}`);
 assert.equal(sandboxAdmission.admitted,true);
 checks.push('same-browser chrome://sandbox reports Namespace, PID, network, seccomp and TSYNC active');
 await send('Page.navigate',{url:baseUrl});await delay(300);
 await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(p))})`);await send('Page.reload',{ignoreCache:true});
 for(let i=0;i<60;i++){await delay(100);if(await evaluate("Boolean(document.querySelector('#window-load')) && document.querySelectorAll('#existing-grid .cell').length===4"))break;}
 assert.equal(await evaluate("document.querySelectorAll('#existing-grid .cell').length"),4);
 const source=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
 await evaluate(`(()=>{document.querySelector('#window-load').click();const f=document.querySelector('#window-inputs fieldset');f.querySelector('[data-select]').checked=true;f.querySelector('[data-field="earliestMinute"]').value='30';f.querySelector('[data-field="latestMinute"]').value='90';f.querySelector('[data-field="source"]').value='<svg onload=window.__bad=1> authored interval';const button=document.querySelector('#window-compare');button.scrollIntoView({block:'center'});button.focus({preventScroll:true});})()`);
 await send('Page.bringToFront');
 await evaluate(`(()=>{const b=document.querySelector('#window-compare');b.focus({preventScroll:true});window.__windowKeyTrace=[];for(const type of ['keydown','keyup','click'])b.addEventListener(type,e=>window.__windowKeyTrace.push({type:e.type,key:e.key??null,trusted:e.isTrusted}));})()`);
 assert.equal(await evaluate('document.activeElement?.id'),'window-compare','Comparison button must own keyboard focus');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
 for(let i=0;i<20;i++){if(await evaluate("document.querySelector('#window-results').textContent.length>0"))break;await delay(20);}
 const live=await evaluate("document.querySelector('#window-results').textContent");
 assert.ok(live.length>0,JSON.stringify(await evaluate("({focus:document.activeElement?.id,documentFocused:document.hasFocus(),events:window.__windowKeyTrace,disabled:document.querySelector('#window-compare').disabled,fields:document.querySelectorAll('#window-inputs fieldset').length,exceptions:window.__bad??null})")));
assert.match(live,/Included source project: Window source — authored courtyard/);assert.match(live,/Observed scenario: existing; surface: turf/);assert.match(live,/21 mm at 60 min/);assert.match(live,/some-time-compatible/);assert.match(live,/<img src=x/);assert.equal(await evaluate("Boolean(document.querySelector('#window-results img,#window-results svg'))"),false);assert.equal(await evaluate('window.__bad??null'),null);assert.equal(await evaluate("document.querySelector('#window-download').disabled"),false);assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),source);checks.push('keyboard comparison finds interior peak, preserves original source and renders literal descriptions');
 await evaluate(`(async()=>{const old=URL.createObjectURL;let blob;URL.createObjectURL=x=>{blob=x;return old.call(URL,x);};try{document.querySelector('#window-download').click();window.__savedWindow=await blob.text();}finally{URL.createObjectURL=old;}})()`);
 const saved=await evaluate('JSON.parse(window.__savedWindow)');assert.deepEqual(Object.keys(saved).sort(),['kind','project','windows']);assert.equal(saved.windows[0].earliestMinute,30);assert.equal(saved.project.observations[0].minute,60);checks.push('actual downloadable blob contains original project and sourced windows only');
 await evaluate("document.querySelector('#reset').click()");assert.equal(await evaluate("document.querySelector('#window-download').disabled"),true);
 const reset=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
 const reopen=`(async()=>{const i=document.querySelector('#window-import'),d=new DataTransfer();d.items.add(new File([window.__savedWindow],'windows.json',{type:'application/json'}));i.files=d.files;i.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,180));})()`;
 await evaluate(reopen);assert.match(await evaluate("document.querySelector('#window-replay').textContent"),/Recomputed from included original project/);assert.match(await evaluate("document.querySelector('#window-replay').textContent"),/Included source project: Window source — authored courtyard/);assert.notEqual(JSON.parse(reset).title,p.title);assert.match(await evaluate("document.querySelector('#window-replay').textContent"),/21 mm at 60 min/);assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),reset);checks.push('real file reopening recomputes independently without adopting its site');
 await evaluate(`(async()=>{const old=File.prototype.text;let finish;File.prototype.text=function(){return new Promise(r=>{finish=()=>r(window.__savedWindow);});};try{const i=document.querySelector('#window-import'),d=new DataTransfer();d.items.add(new File(['{}'],'delayed.json'));i.files=d.files;i.dispatchEvent(new Event('change'));document.querySelector('#reset').click();finish();await new Promise(r=>setTimeout(r,120));}finally{File.prototype.text=old;}})()`);assert.equal(await evaluate("document.querySelector('#window-replay').textContent"),'');checks.push('late file read cannot repaint results after workspace reset');
 await evaluate(reopen);await evaluate("document.querySelectorAll('#window-replay details').forEach(x=>x.open=true)");
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await delay(150);
 const desktopDimensions=await evaluate('({inner:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(desktopDimensions.scroll<=desktopDimensions.inner+1,JSON.stringify(desktopDimensions));
 const desktopClip=await evaluate("(()=>{const r=document.querySelector('#reading-time-windows').getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:Math.min(1500,r.height),scale:1};})()");
 const desktopScreenshot=await send('Page.captureScreenshot',{format:'png',clip:desktopClip,captureBeyondViewport:true});writeFileSync(runDirectory+'/reading-windows-1440.png',Buffer.from(desktopScreenshot.data,'base64'));
 checks.push('expanded 1440px desktop source and extrema captured without viewport overflow');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(150);const dimensions=await evaluate('({inner:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(dimensions.scroll<=dimensions.inner+1,JSON.stringify(dimensions));
 const clip=await evaluate("(()=>{const r=document.querySelector('#reading-time-windows').getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:Math.min(1500,r.height),scale:1};})()");const screenshot=await send('Page.captureScreenshot',{format:'png',clip,captureBeyondViewport:true});writeFileSync(runDirectory+'/reading-windows-390.png',Buffer.from(screenshot.data,'base64'));checks.push('expanded narrow-screen source and extrema remain within viewport');assert.deepEqual(exceptions,[]);return{checks,dimensions,desktopDimensions,sandboxAdmission};
});console.log(JSON.stringify({status:'PASS',...result.value,receipt:result.receipt},null,2));
