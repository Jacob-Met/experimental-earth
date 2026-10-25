import {withBrowserSession} from './support/browser-session.mjs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {evidenceFixture} from './longwave-heat-evidence-fixture.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),checks=[];
try{
 const received=await withBrowserSession({root,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',runDirectory:root+'.browser-run-longwave-evidence-'+randomUUID()},async({send,evaluate,runDirectory,exceptions,sandbox})=>{
  await send('Runtime.enable');await send('Page.enable');await send('DOM.enable');
  for(let i=0;i<60;i++){if(await evaluate("Boolean(document.querySelector('#longwave-evidence-form'))"))break;await delay(100);}
  assert.equal(await evaluate("Boolean(document.querySelector('#longwave-evidence-form'))"),true);
  const {project}=evidenceFixture();
  await evaluate(`(async()=>{const input=document.querySelector('#import'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(project))}],'source-project.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,180));})()`);
  const originalProject=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  await evaluate("document.querySelector('#longwave-basis').checked=true;document.querySelector('#longwave-form').requestSubmit();document.querySelector('#longwave-evidence-basis').checked=true;document.querySelector('#longwave-evidence-source').value='Authored nonradiative exchange for every original alternative';document.querySelector('#longwave-evidence-form').requestSubmit()");
  assert.equal(await evaluate("document.querySelectorAll('#longwave-evidence-summary tbody tr').length"),2);
  assert.equal(await evaluate("document.querySelector('#longwave-evidence-summary tbody tr').dataset.calibration"),'true');
  assert.equal(await evaluate("document.querySelectorAll('#longwave-evidence-summary tbody tr')[1].dataset.calibration"),'false');
  assert.equal(await evaluate("document.querySelectorAll('#longwave-evidence-temperatures tbody tr').length"),2);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),originalProject);
  checks.push('Actual saved-source consumer preserves project and original two-candidate order, distinguishes radiative fit and retains all reading rows');
  await evaluate("document.querySelector('#longwave-evidence-source').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#longwave-evidence-results').textContent"),'');
  assert.ok(await evaluate("Boolean(document.querySelector('#longwave-table'))"));
  await evaluate("document.querySelector('#longwave-evidence-form').requestSubmit()");
  const expected=await evaluate("document.querySelector('#longwave-evidence-summary').textContent");
  const download=runDirectory+'/download';await mkdir(download);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:download});await evaluate("document.querySelector('#longwave-evidence-download').click()");const path=download+'/longwave-evidence-inquiry.json';
  for(let i=0;i<60;i++){try{await access(path);break;}catch{await delay(50);}}
  const raw=JSON.parse(await readFile(path,'utf8'));assert.equal(raw.schema,'experimental-earth-longwave-evidence/1');assert.equal(raw.result,undefined);assert.equal(raw.work,undefined);assert.equal(raw.evidence.readings.length,2);
  await send('Page.reload',{ignoreCache:true});await delay(500);const doc=await send('DOM.getDocument');const fileInput=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#longwave-evidence-upload'});await send('DOM.setFileInputFiles',{nodeId:fileInput.nodeId,files:[path]});await delay(150);
  assert.equal(await evaluate("document.querySelector('#longwave-evidence-summary').textContent"),expected);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),originalProject);
  checks.push('Source-only download and fresh-page native reopen recompute same original evidence inquiry independently of the unsaved radiation panel');
  const forged=structuredClone(raw);forged.result={winner:'B'};forged.evidence.readings[0].withinBand=true;forged.evidence.hypotheses[0].predictedC=999;const forgedPath=runDirectory+'/forged.json';await writeFile(forgedPath,JSON.stringify(forged));await send('DOM.setFileInputFiles',{nodeId:fileInput.nodeId,files:[forgedPath]});await delay(150);assert.equal(await evaluate("document.querySelector('#longwave-evidence-summary').textContent"),expected);
  const clean=runDirectory+'/clean';await mkdir(clean);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:clean});await evaluate("document.querySelector('#longwave-evidence-download').click()");const cleanPath=clean+'/longwave-evidence-inquiry.json';for(let i=0;i<60;i++){try{await access(cleanPath);break;}catch{await delay(50);}}assert.deepEqual(JSON.parse(await readFile(cleanPath,'utf8')),raw);
  checks.push('Forged derived outputs neither change comparison nor survive real source-only re-download');
  for(const width of [1440,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width===390});await evaluate("document.querySelector('#longwave-evidence-results').scrollIntoView({block:'start',behavior:'instant'})");await delay(100);const size=await evaluate('({viewport:innerWidth,page:document.documentElement.scrollWidth})');assert.ok(size.page<=size.viewport+1,JSON.stringify(size));const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/evidence-'+width+'.png',Buffer.from(shot.data,'base64'));}
  const overflow=await evaluate("(()=>{const e=document.querySelector('#longwave-evidence-summary-scroll');return e.scrollWidth>e.clientWidth})()");assert.equal(overflow,true);await evaluate("document.querySelector('#longwave-evidence-summary-scroll').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await delay(200);assert.ok(await evaluate("document.querySelector('#longwave-evidence-summary-scroll').scrollLeft")>0);
  await evaluate("document.querySelector('#longwave-evidence-candidate').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await delay(50);assert.equal(await evaluate("document.querySelector('#longwave-evidence-candidate').value"),'1');assert.match(await evaluate("document.querySelector('#longwave-evidence-candidate-results h4').textContent"),/^B$/);
  checks.push('Desktop/390px results remain within page; native keyboard scroll and candidate choice inspect original alternatives');
  const mismatch=structuredClone(raw);mismatch.evidence.heatStudy.existing.initialC+=1;const mismatchPath=runDirectory+'/mismatch.json';await writeFile(mismatchPath,JSON.stringify(mismatch));await send('DOM.setFileInputFiles',{nodeId:fileInput.nodeId,files:[mismatchPath]});await delay(100);assert.equal(await evaluate("document.querySelector('#longwave-evidence-results').textContent"),'');assert.match(await evaluate("document.querySelector('#longwave-evidence-status').textContent"),/same retained/);
  const expensive=structuredClone(raw);expensive.evidence.hypotheses=Array.from({length:12},(_,i)=>({...raw.evidence.hypotheses[0],label:'H'+i,capacityJm2K:1000,exchangeWm2K:100}));const expensivePath=runDirectory+'/expensive.json';await writeFile(expensivePath,JSON.stringify(expensive));await send('DOM.setFileInputFiles',{nodeId:fileInput.nodeId,files:[expensivePath]});await delay(100);assert.equal(await evaluate("document.querySelector('#longwave-evidence-results').textContent"),'');assert.match(await evaluate("document.querySelector('#longwave-evidence-status').textContent"),/complete.*budget/);
  checks.push('Changed original exposure and over-budget complete inquiry refuse without stale or partial candidate results');
  await evaluate(`(()=>{const input=document.querySelector('#longwave-evidence-upload'),dt=new DataTransfer(),bytes=new TextEncoder().encode(${JSON.stringify(JSON.stringify(raw))}).buffer;dt.items.add(new File([bytes],'delayed-valid.json'));input.files=dt.files;input.files[0].arrayBuffer=()=>new Promise(resolve=>window.__releaseEvidence=()=>resolve(bytes));input.dispatchEvent(new Event('change',{bubbles:true}));})()`);assert.equal(await evaluate('typeof window.__releaseEvidence'),'function');
  await evaluate("document.querySelector('#longwave-sky').dispatchEvent(new Event('input',{bubbles:true}));window.__releaseEvidence();delete window.__releaseEvidence");await delay(100);assert.equal(await evaluate("document.querySelector('#longwave-evidence-results').textContent"),'');assert.equal(await evaluate("document.querySelector('#longwave-evidence-download').disabled"),true);
  checks.push('A delayed valid evidence file cannot overwrite a newer radiation-source edit');assert.deepEqual(exceptions,[]);return {checks,sandbox,exceptions};
 });console.log(JSON.stringify({status:'PASS',...received.value,receipt:received.receipt},null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null},null,2));process.exitCode=1;}
