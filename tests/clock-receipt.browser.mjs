import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {makeExample} from '../core.js';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const chromeBin=process.env.BROWSER_EXECUTABLE??process.env.CHROME_BIN??'/opt/google/chrome/chrome';
const runDirectory=process.env.RUN_DIRECTORY??(root+'.browser-run-clock-receipt-'+randomUUID());
function fixture(){
 const p=makeExample();p.width=p.height=2;p.selectedIndex=0;
 p.existing=p.proposal=Array.from({length:4},()=>({elevationM:0,surface:'turf',provenance:'authored illustration'}));
 Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:60,mobilityPerHour:0,boundaryExitPerHour:0});
 p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[10,20]};
 p.observations=[
  {cellIndex:0,minute:20,depthMm:10,uncertaintyMm:0,source:'fictional source A',scenario:'existing',use:'calibration'},
  {cellIndex:0,minute:35,depthMm:15,uncertaintyMm:0,source:'fictional source B',scenario:'existing',use:'challenge'},
  {cellIndex:1,minute:21,depthMm:2,uncertaintyMm:1,source:'<img src=x onerror="window.__malicious=1">'+'x'.repeat(130),scenario:'proposal',use:'calibration'}
 ];return p;
}
let checks=[];
const result=await withBrowserSession({root,chromeBin,runDirectory},async({baseUrl,send,evaluate,exceptions,runDirectory:artifactDirectory})=>{
 await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:baseUrl});
 for(let i=0;i<50;i++){await delay(120);try{if(await evaluate("document.querySelectorAll('#existing-grid .cell').length")===48)break;}catch{}}
 const project=fixture();
 await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(project))})`);
 await send('Page.reload',{ignoreCache:true});
 for(let i=0;i<45;i++){await delay(100);try{if(await evaluate("document.querySelectorAll('#existing-grid .cell').length")===4)break;}catch{}}
 assert.equal(await evaluate("document.querySelectorAll('#existing-grid .cell').length"),4);
 await evaluate(`(()=>{
  document.querySelector('#clock-offsets').value='0,10,30';
  document.querySelector('#clock-reason').value='authored recorder-clock check';
  document.querySelector('#compare-clock').click();
 })()`);
 assert.match(await evaluate("document.querySelector('#clock-results').textContent"),/10 min: one-survivor/);
 assert.equal(await evaluate("document.querySelector('#download-clock').disabled"),false);
 const liveEvidence=await evaluate("(()=>{const d=document.querySelector('#clock-results .clock-reading-evidence');return {count:d.querySelectorAll('li').length,text:d.textContent,hasImage:!!d.querySelector('img'),malicious:window.__malicious??null};})()");
 assert.equal(liveEvidence.count,3);assert.match(liveEvidence.text,/original minute 35; depth 15 ± 0 mm/);
 assert.match(liveEvidence.text,/not used in this study/);assert.match(liveEvidence.text,/Authored source: <img src=x/);
 assert.equal(liveEvidence.hasImage,false);assert.equal(liveEvidence.malicious,null);
 const liveTrace=await evaluate("(()=>{const t=document.querySelector('#clock-results .clock-offset-trace');return {groups:t.querySelectorAll('.clock-offset-alternative').length,text:t.textContent};})()");
 assert.equal(liveTrace.groups,3);
 assert.match(liveTrace.text,/Source #2 \(cell A1; existing, challenge\): original minute 35 → modeled minute 65 — OUTSIDE modeled event/);
 assert.match(liveTrace.text,/Source #1 \(cell A1; existing, calibration\): original minute 20 → modeled minute 30/);
 checks.push('live alternative traces map original source numbers to sampled minutes and refusal');
 checks.push('live original reading evidence lists calibration, challenge and ignored source text without rendering HTML');
 checks.push('source-bound live comparison arms user-initiated export');

 const saved=await evaluate(`(async()=>{
  const original=URL.createObjectURL,oldClick=HTMLAnchorElement.prototype.click;
  let blob=null,clicked=false;
  URL.createObjectURL=function(candidate){blob=candidate;return original.call(this,candidate);};
  HTMLAnchorElement.prototype.click=function(){if(this.download==='experimental-earth-clock-diagnostic.json')clicked=true;return oldClick.call(this);};
  try{
   document.querySelector('#download-clock').click();
   const text=await blob.text(),r=JSON.parse(text);
   window.__clockDiagnostic=text;
   return {clicked,bytes:blob.size,kind:r.kind,originalTitle:r.project.title,source:r.project.observations[1].source,offsets:r.offsetsMinutes,second:r.comparison.offsets[1].comparison.survivingRatesMmHr,limitation:r.limitations};
  }finally{URL.createObjectURL=original;HTMLAnchorElement.prototype.click=oldClick;}
 })()`);
 assert.equal(saved.clicked,true);assert.deepEqual(saved.offsets,[0,10,30]);assert.deepEqual(saved.second,[10]);
 assert.equal(saved.source,'fictional source B');assert.match(saved.limitation,/does not authenticate/);
 checks.push('actual downloadable blob retains project, sources, offsets, exact recomputable verdict');

 await evaluate("document.querySelector('#reset').click()");
 assert.equal(await evaluate("document.querySelector('#download-clock').disabled"),true);
 const changedWorkspace=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
 assert.equal(JSON.parse(changedWorkspace).width,8);
 await evaluate(`(async()=>{
  const input=document.querySelector('#clock-import'),file=new File([window.__clockDiagnostic],'clock.json',{type:'application/json'});
  const list=new DataTransfer();list.items.add(file);input.files=list.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(r=>setTimeout(r,160));
 })()`);
 assert.match(await evaluate("document.querySelector('#clock-replay').textContent"),/Recomputed from the file/);
 assert.match(await evaluate("document.querySelector('#clock-replay').textContent"),/10 min: one-survivor/);
 assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),changedWorkspace);
 const replayEvidence=await evaluate("(()=>{const d=document.querySelector('#clock-replay .clock-reading-evidence');return {count:d.querySelectorAll('li').length,text:d.textContent,hasImage:!!d.querySelector('img')};})()");
 assert.equal(replayEvidence.count,3);assert.match(replayEvidence.text,/original minute 35/);
 assert.match(replayEvidence.text,/not used in this study/);assert.equal(replayEvidence.hasImage,false);
 const replayTrace=await evaluate("(()=>{const t=document.querySelector('#clock-replay .clock-offset-trace');return {groups:t.querySelectorAll('.clock-offset-alternative').length,text:t.textContent};})()");
 assert.equal(replayTrace.groups,3);
 assert.equal(replayTrace.text,liveTrace.text);
 checks.push('reopened alternative trace matches live original-to-sampled source mapping');
 checks.push('reopened evidence retains all original source roles without changing workspace');
 checks.push('real file reopening recalculates saved diagnostic without adopting project');

 const tamper=await evaluate(`(async()=>{
  const r=JSON.parse(window.__clockDiagnostic);r.comparison.offsets[1].comparison.survivingRatesMmHr=[20];
  const input=document.querySelector('#clock-import'),file=new File([JSON.stringify(r)],'forged.json');
  const list=new DataTransfer();list.items.add(file);input.files=list.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(r=>setTimeout(r,170));
  return document.querySelector('#clock-replay').textContent;
 })()`);
 assert.match(tamper,/Diagnostic refused: Saved clock conclusions/);
 assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),changedWorkspace);
 checks.push('forged result rejected; current project remains unchanged');

 const stale=await evaluate(`(async()=>{
  const previous=File.prototype.text;let finish;
  File.prototype.text=function(){return new Promise(resolve=>{finish=()=>resolve(window.__clockDiagnostic);});};
  try{
   const input=document.querySelector('#clock-import'),file=new File(['{}'],'delayed.json');
   const list=new DataTransfer();list.items.add(file);input.files=list.files;
   input.dispatchEvent(new Event('change',{bubbles:true}));
   if(!finish)throw Error('File read did not begin');
   const field=document.querySelector('#clock-reason');field.value='changed during read';field.dispatchEvent(new Event('input',{bubbles:true}));
   finish();await new Promise(r=>setTimeout(r,120));
   return {replay:document.querySelector('#clock-replay').textContent,downloadDisabled:document.querySelector('#download-clock').disabled};
  }finally{File.prototype.text=previous;}
 })()`);
 assert.equal(stale.replay,'');assert.equal(stale.downloadDisabled,true);
 checks.push('stale read cannot publish a replay after input changes');

 await evaluate(`(async()=>{const input=document.querySelector('#clock-import'),file=new File([window.__clockDiagnostic],'clock.json');const list=new DataTransfer();list.items.add(file);input.files=list.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,170));document.querySelector('#clock-replay .clock-reading-evidence').open=true;document.querySelector('#clock-replay .clock-offset-trace').open=true;for(const d of document.querySelectorAll('#clock-replay .clock-offset-alternative'))d.open=true;})()`);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await delay(180);
 const dims=await evaluate('({inner:innerWidth,scroll:document.documentElement.scrollWidth,panels:document.querySelectorAll("#clock-study").length})');
 assert.ok(dims.scroll<=dims.inner+1,JSON.stringify(dims));
 const clip=await evaluate("(()=>{const r=document.querySelector('#clock-study').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:Math.min(r.height,1500),scale:1}})()");
 const screenshot=await send('Page.captureScreenshot',{format:'png',clip,captureBeyondViewport:true});
 writeFileSync(artifactDirectory+'/clock-diagnostic-390.png',Buffer.from(screenshot.data,'base64'));
 checks.push('390px expanded long-source evidence wraps without viewport overflow');
 assert.deepEqual(exceptions,[]);
 return {checks,dimensions:dims,exceptions};
});
console.log(JSON.stringify({status:'PASS',...result.value,receipt:result.receipt},null,2));
