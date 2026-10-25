import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';
import {makeExample,validateProject} from '../core.js';
import {prepareSurfaceHeatStudy} from '../surface-heat.js';
import {canonicalLongwaveHeat,compareLongwaveHeat} from '../longwave-heat.js';
import {serializeLongwaveHeat,LONGWAVE_FILE_MAX_BYTES} from '../longwave-portability.js';
import {longwavePortabilityFixture} from './longwave-portability-fixture.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=process.env.BROWSER_RUN_DIRECTORY??root+'.browser-run-longwave-portability-'+randomUUID(),checks=[];
const original=longwavePortabilityFixture({multibyte:true}),context=JSON.parse(original.heatStudy.contextJson);
const project=makeExample();Object.assign(project,{width:2,height:2,selectedIndex:0,source:context.source,
 existing:Array.from({length:4},()=>({...context.existing})),proposal:Array.from({length:4},()=>({...context.proposal})),surfaceHeatStudy:original.heatStudy});
project.weather.cellSizeM=1;
original.heatStudy=prepareSurfaceHeatStudy(project,{cellIndex:0,existing:original.heatStudy.existing,proposal:original.heatStudy.proposal,schedule:original.heatStudy.schedule});
project.surfaceHeatStudy=original.heatStudy;validateProject(project);
try{
 const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome'},async session=>{
  const {send,evaluate,exceptions}=session;await send('Runtime.enable');await send('Page.enable');await send('DOM.enable');
  async function until(expression){for(let i=0;i<150;i++){try{if(await evaluate(expression))return;}catch{}await delay(40);}
   const diagnostic=await evaluate("({status:document.getElementById('longwave-status')?.textContent,formValid:document.getElementById('longwave-form')?.checkValidity(),invalidFields:[...document.querySelectorAll('#longwave-form :invalid')].map(e=>({id:e.id,message:e.validationMessage})),basisChecked:document.getElementById('longwave-basis')?.checked,project:JSON.parse(localStorage.getItem('experimental-earth-site-v1'))?.surfaceHeatStudy?.schedule?.length,documentReady:document.readyState,toast:document.getElementById('toast')?.textContent})");
   const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/timeout.png',Buffer.from(shot.data,'base64'));
   throw Error('Timed out '+expression+' '+JSON.stringify({diagnostic,exceptions,completedChecks:checks}));}
  async function nativeFile(selector,path){const doc=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});await delay(100);}
  const table=()=>evaluate("document.getElementById('longwave-table')?.textContent??''");
  async function field(id,value){await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
  await until("Boolean(document.getElementById('longwave-form'))");const projectPath=runDirectory+'/original-project.json';await writeFile(projectPath,JSON.stringify(project));await nativeFile('#import',projectPath);
  for(const t of ['existing','proposal']){await field('longwave-'+t,.9);await field('longwave-'+t+'-source','場'.repeat(600));}
  await field('longwave-sky',-10);await field('longwave-source','場'.repeat(600));await evaluate("document.getElementById('longwave-basis').checked=true;document.getElementById('longwave-form').requestSubmit()");
  await until("Boolean(document.getElementById('longwave-table'))");const expected=await table(),siteBefore=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  const downloads=runDirectory+'/download';await mkdir(downloads);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});await evaluate("document.getElementById('longwave-download').click()");
  const exported=downloads+'/longwave-heat-investigation.json';for(let i=0;i<100;i++){try{await access(exported);break;}catch{await delay(40);}}
  const bytes=await readFile(exported);assert.ok(bytes.length>120000);assert.ok(bytes.length<=LONGWAVE_FILE_MAX_BYTES);assert.deepEqual(JSON.parse(bytes.toString()),canonicalLongwaveHeat(original));
  await send('Page.reload',{ignoreCache:true});await until("Boolean(document.getElementById('longwave-upload'))");await nativeFile('#longwave-upload',exported);await until("Boolean(document.getElementById('longwave-table'))");assert.equal(await table(),expected);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),siteBefore);
  checks.push('Actual valid143471-byte multibyte source download reopens after reload with unchanged original fields and computed result');
  const malformed=runDirectory+'/malformed.json',oversized=runDirectory+'/oversized.json';await writeFile(malformed,'{broken');await writeFile(oversized,' '.repeat(LONGWAVE_FILE_MAX_BYTES+1));
  for(const path of [malformed,oversized]){await nativeFile('#longwave-upload',path);assert.equal(await table(),expected);assert.equal(await evaluate("document.getElementById('longwave-download').disabled"),false);assert.match(await evaluate("document.getElementById('longwave-status').textContent"),/last accepted investigation is unchanged/);}
  checks.push('Malformed and oversized files refuse without erasing the accepted table or original download');
  const unsupported=structuredClone(original);for(const t of ['existing','proposal']){Object.assign(unsupported.heatStudy[t],{capacityJm2K:1000,exchangeWm2K:0,absorptivity:1,initialC:20});unsupported[t].emissivity=1;}
  unsupported.heatStudy.schedule=[{minutes:10,incidentWm2:2000,reservoirC:20,source:'Authored hot baseline refusal control'}];unsupported.radiationSchedule=[{skyC:-100,source:'Declared radiative reservoir'}];assert.ok(compareLongwaveHeat(unsupported).existing.final.temperatureC<500);
  const unsupportedPath=runDirectory+'/unsupported-linear-baseline.json';await writeFile(unsupportedPath,serializeLongwaveHeat(unsupported));await nativeFile('#longwave-upload',unsupportedPath);
  assert.equal(await table(),expected);assert.match(await evaluate("document.getElementById('longwave-status').textContent"),/last accepted investigation is unchanged/);
  checks.push('A comparison whose original linear baseline cannot be displayed refuses before replacing accepted source or output');
  const delayedPath=runDirectory+'/delayed-longwave.json';await writeFile(delayedPath,bytes);
  await evaluate("window.__originalLongwaveBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=async function(){const bytes=await window.__originalLongwaveBuffer.call(this);if(this.name==='delayed-longwave.json')return new Promise(resolve=>window.__releaseLongwave=()=>resolve(bytes));return bytes;}");
  await nativeFile('#longwave-upload',delayedPath);await until("Boolean(window.__releaseLongwave)");assert.equal(await table(),expected);
  await field('longwave-existing',.3);await evaluate("File.prototype.arrayBuffer=window.__originalLongwaveBuffer;window.__releaseLongwave()");await delay(80);
  assert.equal(await table(),'');assert.equal(await evaluate("document.getElementById('longwave-download').disabled"),true);
  // Reopening original evidence does not adopt its declaration into the live
  // form. Reload reset the required nonradiative-basis acknowledgement, so
  // explicitly make that declaration again before the current-source run.
  await evaluate("if(!document.getElementById('longwave-basis').checked)document.getElementById('longwave-basis').click();document.getElementById('longwave-form').requestSubmit()");await until("Boolean(document.getElementById('longwave-table'))");assert.notEqual(await table(),expected);
  await nativeFile('#longwave-upload',exported);await until("document.getElementById('longwave-status').textContent.includes('Recomputed original file')");assert.equal(await table(),expected);
  await field('longwave-existing',.2);await nativeFile('#longwave-upload',exported);assert.equal(await table(),expected);
  checks.push('Delayed read cannot overwrite a newer draft; reselecting the same actual original file reliably restores its accepted result');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate("document.getElementById('longwave-table-scroll').scrollIntoView({block:'center',behavior:'instant'});document.getElementById('longwave-table-scroll').focus()");
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/narrow.png',Buffer.from(shot.data,'base64'));
  assert.deepEqual(exceptions,[]);checks.push('Maintained narrow-screen result remains usable after original-source recovery without browser exceptions');
  return{checks,exportedBytes:bytes.length,sandbox:session.sandbox,exceptions};
 });console.log(JSON.stringify({status:'PASS',...result.value,receipt:result.receipt},null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null},null,2));process.exitCode=1;}
