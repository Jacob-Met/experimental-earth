import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';
import {temperatureProject,temperatureCSV,temperatureHeader} from './temperature-table-fixture.mjs';
import {previewTemperatureTable} from '../temperature-table.js';
const root=fileURLToPath(new URL('../',import.meta.url)),runDirectory=root+'.browser-run-temperature-'+randomUUID(),checks=[];
try{
 const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/usr/bin/google-chrome-stable'},async session=>{
  const {evaluate,send,exceptions}=session;
  await send('Runtime.enable');await send('Page.enable');await send('DOM.enable');
  async function until(expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await delay(40);}throw Error('Timeout: '+expression);}
  const click=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
  const stored=async()=>JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  async function file(selector,path){const doc=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});}
  async function loadProject(value,name='project.json'){const path=runDirectory+'/'+name;await writeFile(path,JSON.stringify(value));await file('#import',path);await delay(120);}
  async function upload(value,name='original.csv'){const path=runDirectory+'/'+name;await writeFile(path,value);await file('#column-temperature-file',path);await until("document.getElementById('column-temperature-file').value === ''");}
  async function save(){await evaluate("document.getElementById('column-evidence-form').requestSubmit()");assert.notEqual(await evaluate("document.getElementById('column-evidence-status').dataset.state"),'refused',await evaluate("document.getElementById('column-evidence-status').textContent"));}
  async function run(status){await click('column-evidence-run');await until("!document.getElementById('column-evidence-run').disabled");assert.equal(await evaluate("document.getElementById('column-evidence-status').dataset.state"),status);}
  const draft=()=>evaluate("Array.from(document.querySelectorAll('#column-readings [data-field]'),e=>[e.dataset.field,e.value])");
  await until("Boolean(document.getElementById('column-temperature-file'))");
  await loadProject(temperatureProject());const baseline=await stored(),oldDraft=await draft();
  await evaluate("document.getElementById('column-temperature-import').open=true");
  await upload(temperatureCSV);assert.equal(await evaluate("document.querySelectorAll('#column-temperature-preview li').length"),2);
  assert.match(await evaluate("document.getElementById('column-temperature-preview').textContent"),/112.15579813943923.*F/);
  assert.deepEqual(await draft(),oldDraft);assert.deepEqual(await stored(),baseline);
  // Trusted keyboard activates the reviewed replacement, not an automatic file mutation.
  await evaluate("document.getElementById('column-temperature-apply').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.equal(await evaluate("document.querySelector('#column-readings [data-field=minute]').value"),'60');
  assert.deepEqual(await stored(),baseline);await save();await run('one-survivor');
  const accepted=await stored(),expected=previewTemperatureTable(temperatureCSV,420,'original.csv').readings;
  assert.deepEqual(accepted.heatColumnEvidence.readings,expected);
  assert.deepEqual(accepted.heatColumnEvidence.hypotheses,baseline.heatColumnEvidence.hypotheses);
  checks.push('Real F/K file previews every original row; keyboard replacement changes only draft; saved input screens five original alternatives to one');
  const download=runDirectory+'/download';await mkdir(download);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:download});await click('export');
  const exportPath=download+'/experimental-earth-site.json';for(let i=0;i<100;i++){try{await access(exportPath);break;}catch{await delay(40);}}
  const exported=JSON.parse(await readFile(exportPath,'utf8'));assert.deepEqual(exported.heatColumnEvidence.readings,expected);
  await evaluate("localStorage.clear()");await send('Page.reload',{ignoreCache:true});await until("Boolean(document.getElementById('column-temperature-file'))");await file('#import',exportPath);await delay(120);await run('one-survivor');
  assert.deepEqual((await stored()).heatColumnEvidence.readings,expected);
  checks.push('Actual downloaded project reopens after storage clearing and reload; original lexical values/roles/sources survive and comparison recomputes');
  const beforeBad=await stored(),draftBeforeBad=await draft();
  for(const [name,data]of [['bad.csv',temperatureCSV+'\n120,,instant,1,1,C,challenge,duplicate'],['invalid-utf8.csv',Buffer.from([0xff,0xfe,0x61])]]){
   await upload(data,name);assert.match(await evaluate("document.getElementById('column-temperature-status').textContent"),/Import refused/);
   assert.equal(await evaluate("document.getElementById('column-temperature-apply').disabled"),true);assert.deepEqual(await draft(),draftBeforeBad);assert.deepEqual(await stored(),beforeBad);
  }
  checks.push('Duplicate final row and invalid UTF8 refuse atomically; no prefix/draft/source adoption (comparison is conservatively retired)');
  await upload(temperatureCSV);await evaluate("const e=document.getElementById('column-evidence-association');e.value+=' edited';e.dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.getElementById('column-temperature-apply').disabled"),true);assert.equal(await evaluate("document.querySelectorAll('#column-temperature-preview li').length"),0);
  await upload(temperatureCSV);await loadProject(temperatureProject(),'replacement.json');assert.equal(await evaluate("document.getElementById('column-temperature-apply').disabled"),true);
  // Hold file decoding, then invalidate before releasing it.
  for(const invalidation of ['draft','project']){
   await evaluate("delete window.__releaseTemperatureRead;window.__originalArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){return new Promise(resolve=>{window.__releaseTemperatureRead=async()=>resolve(await window.__originalArrayBuffer.call(this))})}");
   const pendingPath=runDirectory+'/pending.csv';await writeFile(pendingPath,temperatureCSV);await file('#column-temperature-file',pendingPath);await until("typeof window.__releaseTemperatureRead==='function'");
   if(invalidation==='draft')await evaluate("document.getElementById('column-evidence-association').dispatchEvent(new Event('input',{bubbles:true}))");
   else await loadProject(temperatureProject(),'async-replacement.json');
   await evaluate("window.__releaseTemperatureRead();File.prototype.arrayBuffer=window.__originalArrayBuffer");
   await until("document.getElementById('column-temperature-file').value === ''");assert.equal(await evaluate("document.getElementById('column-temperature-apply').disabled"),true);
  }
  checks.push('Preview retires on draft edit or project replacement; delayed stale file completion cannot restore it');
  await upload(temperatureCSV.replace('300.58965430499205','373.15'),'changed.csv');await click('column-temperature-apply');await save();await run('challenged');
  assert.deepEqual((await stored()).heatColumnEvidence.hypotheses,baseline.heatColumnEvidence.hypotheses);
  checks.push('Unfamiliar changed challenge file rejects all calibration survivors without altering original hypotheses');
  await upload(temperatureHeader+'60,0,interval-mean,310,100,K,calibration,Authored broad mean','mean.csv');await click('column-temperature-apply');await save();await run('needs-challenge');
  assert.equal((await stored()).heatColumnEvidence.readings[0].aggregation,'interval-mean');assert.equal(await evaluate("document.querySelectorAll('.column-reading-mean').length"),1);
  checks.push('Original interval-mean file reaches the full-window operator and visible mean band');
  await upload(temperatureCSV);await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate("document.getElementById('column-temperature-import').open=true;document.getElementById('column-temperature-import').scrollIntoView({block:'start',behavior:'instant'})");
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/temperature-import-narrow.png',Buffer.from(shot.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate("document.getElementById('column-temperature-import').scrollIntoView({block:'start',behavior:'instant'})");
  const desktop=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/temperature-import-desktop.png',Buffer.from(desktop.data,'base64'));
  assert.deepEqual(exceptions,[]);checks.push('Narrow preview fits viewport; actual desktop/narrow screenshots retained; no application exceptions');
  return {checks,sandbox:session.sandbox,exceptions};
 });console.log(JSON.stringify({status:'PASS',...result.value,receipt:result.receipt},null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null},null,2));process.exitCode=1;}
