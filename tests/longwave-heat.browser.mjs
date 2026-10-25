import { withBrowserSession } from './support/browser-session.mjs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir, readFile, access, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),report=[];
try {
 const sessionResult=await withBrowserSession({root,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',runDirectory:root+'.browser-run-longwave-'+randomUUID()},async({send,evaluate,runDirectory,exceptions,sandbox})=>{
  await send('Runtime.enable');await send('Page.enable');await send('DOM.enable');
  for(let i=0;i<60;i++){if(await evaluate("Boolean(document.querySelector('#longwave-form'))"))break;await delay(100);}
  assert.equal(await evaluate("Boolean(document.querySelector('#longwave-form'))"),true);
  await evaluate("document.querySelector('#heat-example').click();document.querySelector('#heat-form').requestSubmit()");
  const before=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  await evaluate("document.querySelector('#longwave-basis').checked=true;document.querySelector('#longwave-form').requestSubmit()");
  assert.equal(await evaluate("document.querySelectorAll('#longwave-chart path').length"),2);
  const original=await evaluate("document.querySelector('#longwave-table').textContent");
  assert.match(await evaluate("document.querySelector('#longwave-results').textContent"),/relative to the retained linear-only/);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),before);
  report.push('Mounted nonlinear comparison displays both trajectories and independent signed energy channels without changing saved project');
  await evaluate("document.querySelector('#longwave-existing').value='0';document.querySelector('#longwave-existing').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#longwave-results').textContent"),'');
  assert.equal(await evaluate("document.querySelector('#longwave-download').disabled"),true);
  assert.equal(await evaluate("document.querySelector('#heat-run').disabled"),false);
  await evaluate("document.querySelector('#longwave-form').requestSubmit()");
  assert.notEqual(await evaluate("document.querySelector('#longwave-table').textContent"),original);
  report.push('Changing emissivity retires longwave results, preserves independent saved-layer controls and changes model response');
  const directory=runDirectory+'/download';await mkdir(directory);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});
  await evaluate("document.querySelector('#longwave-download').click()");const path=directory+'/longwave-heat-investigation.json';
  for(let i=0;i<60;i++){try{await access(path);break;}catch{await delay(50);}}
  const saved=JSON.parse(await readFile(path,'utf8'));assert.equal(saved.schema,'experimental-earth-longwave-heat/1');assert.equal(saved.existing.emissivity,0);assert.equal(saved.exchangeBasis,'excludes-longwave');assert.equal(saved.integrationAttempts,undefined);
  const expected=await evaluate("document.querySelector('#longwave-table').textContent");
  await send('Page.reload',{ignoreCache:true});await delay(500);const doc=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#longwave-upload'});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});await delay(100);
  assert.equal(await evaluate("document.querySelector('#longwave-table').textContent"),expected);
  assert.match(await evaluate("document.querySelector('#longwave-status').textContent"),/Recomputed original file/);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),before);
  report.push('Actual source-only download and fresh-page native file reopen recompute identical results without adopting source into current project');
  const forged=structuredClone(saved);forged.result={temperatureC:999};forged.integrationAttempts=0;forged.existing.final={temperatureC:999};forged.heatStudy.results={approved:true};forged.heatStudy.existing.temperatureC=999;forged.radiationSchedule[0].computedFlux=999;
  const forgedPath=runDirectory+'/forged.json';await writeFile(forgedPath,JSON.stringify(forged));await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[forgedPath]});await delay(100);
  assert.equal(await evaluate("document.querySelector('#longwave-table').textContent"),expected);
  const cleanDir=runDirectory+'/clean-download';await mkdir(cleanDir);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:cleanDir});await evaluate("document.querySelector('#longwave-download').click()");const cleanPath=cleanDir+'/longwave-heat-investigation.json';
  for(let i=0;i<60;i++){try{await access(cleanPath);break;}catch{await delay(50);}}
  assert.deepEqual(JSON.parse(await readFile(cleanPath,'utf8')),saved);
  report.push('Forged derived results at multiple input levels do not affect recomputation and are removed from the actual source-only re-download');
  for(const width of [1440,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width===390});await evaluate("document.querySelector('#longwave-results').scrollIntoView({block:'start',behavior:'instant'})");await delay(80);const dimensions=await evaluate('({viewport:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(dimensions.scroll<=dimensions.viewport+1,JSON.stringify(dimensions));const image=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/longwave-'+width+'.png',Buffer.from(image.data,'base64'));}
  const scrollSize=await evaluate("(()=>{const e=document.querySelector('#longwave-table-scroll');return{viewport:e.clientWidth,content:e.scrollWidth}})()");assert.ok(scrollSize.content>scrollSize.viewport,JSON.stringify(scrollSize));
  await evaluate("document.querySelector('#longwave-table-scroll').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await delay(200);assert.ok(await evaluate("document.querySelector('#longwave-table-scroll').scrollLeft")>0);
  report.push('Narrow energy table keeps whole labels and numbers in an internally overflowing keyboard-scrollable region without widening the page');
  await evaluate("document.querySelector('#longwave-minute').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Home',code:'Home',windowsVirtualKeyCode:36});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Home',code:'Home',windowsVirtualKeyCode:36});assert.match(await evaluate("document.querySelector('#longwave-reading').textContent"),/^0 min:/);
  report.push('Desktop/390px rendering stays in viewport; actual keyboard Home inspects initial conditions');
  await evaluate(`(()=>{const input=document.querySelector('#longwave-upload'),dt=new DataTransfer();dt.items.add(new File(['{}'],'invalid.json'));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(100);assert.equal(await evaluate("document.querySelector('#longwave-results').textContent"),'');assert.match(await evaluate("document.querySelector('#longwave-status').textContent"),/retained longwave/);
  await evaluate(`(()=>{const input=document.querySelector('#longwave-upload'),dt=new DataTransfer(),bytes=new TextEncoder().encode(${JSON.stringify(JSON.stringify(saved))}).buffer;dt.items.add(new File([bytes],'delayed-valid.json',{type:'application/json'}));input.files=dt.files;input.files[0].arrayBuffer=()=>new Promise(resolve=>{window.__releaseLongwaveUpload=()=>resolve(bytes)});input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  assert.equal(await evaluate("typeof window.__releaseLongwaveUpload"),'function');
  await evaluate("document.querySelector('#longwave-sky').dispatchEvent(new Event('input',{bubbles:true}));window.__releaseLongwaveUpload();delete window.__releaseLongwaveUpload");await delay(100);
  assert.equal(await evaluate("document.querySelector('#longwave-results').textContent"),'');assert.equal(await evaluate("document.querySelector('#longwave-download').disabled"),true);assert.match(await evaluate("document.querySelector('#longwave-status').textContent"),/Draft changed/);
  report.push('Malformed source refuses; a valid file delayed during reading cannot overwrite a newer draft or enable source download');
  assert.deepEqual(exceptions,[]);return{checks:report,sandbox,exceptions};
 });console.log(JSON.stringify({status:'PASS',...sessionResult.value,receipt:sessionResult.receipt},null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks:report,receipt:error.receipt??null},null,2));process.exitCode=1;}
