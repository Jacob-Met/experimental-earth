import { prepareSolarStudy } from '../solar-occlusion.js';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { prepareSurfaceHeatStudy } from '../surface-heat.js';
import { prepareHeatColumnStudy } from '../heat-column.js';
import { prepareShadeHeatSampling } from '../shade-heat-sampling.js';
import { serializeCoolingWindow } from '../shade-heat-window.js';
import { parsePowerHourly } from '../weather-power.js';
import { authoredPowerWeather } from './weather-power-fixture.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),runDirectory='/tmp/earth-source-identity-'+randomUUID();
const raw=JSON.stringify(authoredPowerWeather()),weather=parsePowerHourly(raw),query={fromMinute:600,toMinute:780,thresholdC:6,store:'surfaceC'};
function source(title,index){
 const ex=makeShadeHeatExample(),p=ex.project,old=p.heatColumnStudy;p.title=title;
 if(title==='Uncertain source')p.solarStudy=prepareSolarStudy(p,{headingDeg:0,elevationDeg:45,sunSource:'Authored uncertainty control',existing:[],proposal:[{cellIndex:6,heightMinM:0,heightMaxM:3,source:'Authored uncertain column'}]});
 p.heatColumnStudy=undefined;p.surfaceHeatStudy=undefined;
 p.surfaceHeatStudy=prepareSurfaceHeatStudy(p,{cellIndex:index,existing:old.heatStudy.existing,proposal:old.heatStudy.proposal,schedule:old.heatStudy.schedule});
 p.heatColumnStudy=prepareHeatColumnStudy(p,old.lowerLayers);
 return prepareShadeHeatSampling(p,{path:{...ex.declaration.path,latitudeDeg:weather.latitudeDeg,longitudeDeg:weather.longitudeDeg,startUtc:weather.startUtc,endUtc:weather.endUtc,stepMinutes:60},weather:{format:weather.format,rawText:raw}});
}
const a=source('Accepted source A',5),b=source('Accepted source B',7);
const label=(title,cell)=>title+' · 4 × 4 grid · receiver '+cell+' · weather day 2025-06-21 UTC';
try {
 const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN||'/opt/google/chrome/chrome',commandMs:30000},async session=>{
  assert(session.sandbox.admitted);assert(session.sandbox.observation.active);
  const{send,evaluate}=session;await send('DOM.enable');await send('Page.enable');
  const until=async e=>{for(let i=0;i<300;i++){try{if(await evaluate(e))return;}catch{}await delay(40);}throw Error('Timeout '+e);};
  const file=async(selector,path)=>{const doc=await send('DOM.getDocument'),n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});assert(n.nodeId);await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[path]});};
  const text=()=>evaluate("document.querySelector('#shade-window-search-results').textContent");
  const pa=runDirectory+'/a.json',pb=runDirectory+'/b.json',bad=runDirectory+'/bad.json';
  await writeFile(pa,JSON.stringify(a.investigation));await writeFile(pb,JSON.stringify(b.investigation));await writeFile(bad,'{}');
  await until("Boolean(document.querySelector('#shade-window-search-form'))");
  await file('#shade-sampling-import',pb);await until("document.querySelector('#shade-sampling-status').dataset.state==='compared'");
  await evaluate("document.querySelector('#shade-window-search-form').requestSubmit()");
  for(const[grid,start]of[[60,850],[30,850],[15,832]]){
   const section=await evaluate("document.querySelector('#shade-window-search-results section[data-grid=\""+grid+"\"]').textContent");
   assert(section.includes('Earliest supported sampled window: '+start+'–'+(start+120)));
   assert(section.includes((start-360)+' refuted; 0 unresolved.'));
  }
  assert((await text()).includes('Accepted source B'));assert((await text()).includes('receiver D2'));
  const before=await text();await file('#shade-window-import',bad);await until("document.querySelector('#shade-window-status').textContent.startsWith('File refused:')");assert.equal(await text(),before);
  await evaluate("document.querySelector('#shade-window-search-results button[data-grid=\"15\"]').click()");
  assert.equal(await evaluate("Number(document.querySelector('#shade-window-form').elements.fromMinute.value)"),832);
  assert.equal(await evaluate("Number(document.querySelector('#shade-window-form').elements.toMinute.value)"),952);
  assert((await evaluate("document.querySelector('#shade-window-results').textContent")).includes('15 minute solar grid: supported'));
  assert.equal(await text(),before);
  const downloads=runDirectory+'/downloads';await mkdir(downloads);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await evaluate("document.querySelector('#shade-window-export').click()");const downloaded=downloads+'/experimental-earth-cooling-window-inputs.json';let exported;
  for(let i=0;i<100;i++){try{exported=JSON.parse(await readFile(downloaded,'utf8'));break;}catch{await delay(40);}}
  assert.deepEqual(exported.query,{fromMinute:832,toMinute:952,thresholdC:6,store:'surfaceC'});assert.deepEqual(exported.sampling,b.investigation);
  await evaluate("window.staleSearchJump=document.querySelector('#shade-window-search-results button');const f=document.querySelector('#shade-window-search-form');f.elements.endpointSpanMinutes.value='0';f.elements.endpointSpanMinutes.dispatchEvent(new Event('input',{bubbles:true}));window.staleSearchJump.click()");
  assert.equal(await text(),'');assert.equal(await evaluate("Number(document.querySelector('#shade-window-form').elements.fromMinute.value)"),832);
  await evaluate("document.querySelector('#shade-window-search-form').requestSubmit()");assert((await text()).includes('1 required integer samples'));
  await evaluate("window.staleSearchJump=document.querySelector('#shade-window-search-results button')");
  const uncertain=source('Uncertain source',7),pc=runDirectory+'/uncertain.json';await writeFile(pc,JSON.stringify(uncertain.investigation));
  await file('#shade-sampling-import',pc);await until("document.querySelector('#shade-sampling-source').textContent.includes('Uncertain source')");
  await evaluate("document.querySelector('#shade-window-search-form').requestSubmit()");
  assert((await text()).includes('No supported window found; unresolved starts remain.'));assert((await text()).includes('Earliest unresolved window:'));
  assert.equal(await evaluate("document.querySelectorAll('#shade-window-search-results button').length"),0);
  await evaluate("document.querySelector('#shade-window-search-results').scrollIntoView({block:'start',behavior:'instant'})");await delay(200);
  const ambiguousPng=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/unresolved.png',Buffer.from(ambiguousPng.data,'base64'));
  await file('#shade-sampling-import',pa);await until("document.querySelector('#shade-sampling-source').textContent.includes('Accepted source A')");
  assert.equal(await text(),'');await evaluate("window.staleSearchJump.click()");assert.equal(await evaluate("document.querySelector('#shade-window-results').children.length"),0);
  await send('Page.reload',{ignoreCache:true});await until("Boolean(document.querySelector('#shade-window-import'))");await file('#shade-window-import',downloaded);
  await until("document.querySelector('#shade-window-results').children.length===3");assert.equal(await text(),'');
  assert.equal(await evaluate("Number(document.querySelector('#shade-window-form').elements.fromMinute.value)"),832);
  await evaluate("document.querySelector('#shade-window-search-form').requestSubmit()");
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await delay(200);
  await evaluate("document.querySelector('#shade-window-search-results').scrollIntoView({block:'start',behavior:'instant'})");await delay(200);
  const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/narrow.png',Buffer.from(png.data,'base64'));
  assert.deepEqual(session.exceptions,[]);
  return{checks:['Actual three-grid earliest starts and earlier refutation counts; accepted source stamp and failed replacement retention','Jump rechecks selected window and actual raw-only export; live query edit and detached stale button cannot revive result','Original uncertain-height source shows unresolved starts without a supported jump; successful replacement retires search; fresh selected-window reopen and span0'],sandbox:session.sandbox};
 });
 await writeFile(runDirectory+'/receipt.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:'PASS',runDirectory,result}));
}catch(error){console.log(JSON.stringify({status:'FAIL',runDirectory,error:String(error),receipt:error.receipt}));process.exitCode=1;}
