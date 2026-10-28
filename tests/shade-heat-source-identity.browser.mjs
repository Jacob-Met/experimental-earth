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
 p.heatColumnStudy=undefined;p.surfaceHeatStudy=undefined;
 p.surfaceHeatStudy=prepareSurfaceHeatStudy(p,{cellIndex:index,existing:old.heatStudy.existing,proposal:old.heatStudy.proposal,schedule:old.heatStudy.schedule});
 p.heatColumnStudy=prepareHeatColumnStudy(p,old.lowerLayers);
 return prepareShadeHeatSampling(p,{path:{...ex.declaration.path,latitudeDeg:weather.latitudeDeg,longitudeDeg:weather.longitudeDeg,startUtc:weather.startUtc,endUtc:weather.endUtc,stepMinutes:60},weather:{format:weather.format,rawText:raw}});
}
const a=source('Accepted source A',5),b=source('Accepted source B',7);
const label=(title,cell)=>title+' · 4 × 4 grid · receiver '+cell+' · weather day 2025-06-21 UTC';
try{
 const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN||'/opt/google/chrome/chrome',commandMs:30000},async session=>{
  assert(session.sandbox.admitted);assert(session.sandbox.observation.active);
  const{send,evaluate}=session;await send('DOM.enable');await send('Page.enable');
  const until=async e=>{for(let i=0;i<300;i++){try{if(await evaluate(e))return;}catch{}await delay(40);}throw Error('Timeout '+e);};
  const file=async(selector,path)=>{const doc=await send('DOM.getDocument'),n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});assert(n.nodeId);await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[path]});};
  const text=id=>evaluate('document.getElementById('+JSON.stringify(id)+').textContent');
  const check=async expected=>{assert((await text('shade-sampling-source')).includes(expected));assert.equal(await text('shade-window-source'),expected);};
  const pa=runDirectory+'/a.json',pb=runDirectory+'/b.json',bad=runDirectory+'/bad.json',site=runDirectory+'/site.json';
  await writeFile(pa,serializeCoolingWindow(a.investigation,query));await writeFile(pb,JSON.stringify(b.investigation));await writeFile(bad,'{}');
  await writeFile(site,JSON.stringify(b.investigation.source.project));
  await until("Boolean(document.querySelector('#shade-window-import'))");
  await file('#import',site);await until("document.querySelector('#heat-cell').value==='7'");
  const workspace=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  await file('#shade-window-import',pa);await until("document.querySelector('#shade-window-results').children.length===3");await check(label('Accepted source A','B2'));
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),workspace);
  await file('#shade-window-import',bad);await until("document.querySelector('#shade-window-status').textContent.startsWith('File refused:')");await check(label('Accepted source A','B2'));
  await file('#shade-sampling-import',bad);await until("document.querySelector('#shade-sampling-status').dataset.state==='file-refused'");await check(label('Accepted source A','B2'));
  await file('#shade-sampling-import',pb);await until("document.querySelector('#shade-sampling-source')?.textContent.includes('Accepted source B')");
  assert.equal(await text('shade-window-source'),'');
  await evaluate("document.querySelector('#shade-window-form').requestSubmit()");await check(label('Accepted source B','D2'));
  const downloads=runDirectory+'/downloads';await mkdir(downloads);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await evaluate("document.querySelector('#shade-window-export').click()");
  const downloaded=downloads+'/experimental-earth-cooling-window-inputs.json';let exported;
  for(let i=0;i<100;i++){try{exported=JSON.parse(await readFile(downloaded,'utf8'));break;}catch{await delay(40);}}
  assert.deepEqual(exported,JSON.parse(serializeCoolingWindow(b.investigation,query)));
  await writeFile(site,JSON.stringify(a.investigation.source.project));await file('#import',site);await until("document.querySelector('#heat-cell').value==='5'");
  await send('Page.reload',{ignoreCache:true});await until("Boolean(document.querySelector('#shade-window-import'))");
  await file('#shade-window-import',downloaded);await until("document.querySelector('#shade-window-results').children.length===3");await check(label('Accepted source B','D2'));
  assert.equal(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).heatColumnStudy.heatStudy.cellIndex,5);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await delay(200);await evaluate("document.querySelector('#shade-window').scrollIntoView({block:'start',behavior:'instant'})");await delay(200);
  const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/narrow.png',Buffer.from(png.data,'base64'));
  assert.deepEqual(session.exceptions,[]);
  return{checks:['A window source remains independent of B workspace and survives both refused replacement formats','Ordinary B sampling replacement clears A window stamp; new inquiry names B','Actual raw-only B download freshly reopens over A workspace with B receiver and date'],sandbox:session.sandbox};
 });
 await writeFile(runDirectory+'/receipt.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:'PASS',runDirectory,result}));
}catch(error){console.log(JSON.stringify({status:'FAIL',runDirectory,error:String(error),receipt:error.receipt}));process.exitCode=1;}
