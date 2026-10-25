import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {withBrowserSession} from '../tests/support/browser-session.mjs';

const runDirectory=resolve(process.env.EARTH_OFFSET_RUN??'/tmp/earth-offset-browser-'+Date.now());
const checks=[];
await withBrowserSession({root:resolve('.'),chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',runDirectory},async({evaluate,send,exceptions})=>{
 await send('Runtime.enable');
 const capturePanel=async name=>{const clip=await evaluate(`(()=>{const r=document.querySelector('#depth-offset-panel').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()`);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(resolve(runDirectory,name),Buffer.from(shot.data,'base64'));};
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:runDirectory});
 await evaluate(`(async()=>{const {makeExample}=await import('/core.js');const p=makeExample();p.width=p.height=2;p.selectedIndex=0;p.existing=Array.from({length:4},()=>({surface:'turf',elevationM:0,provenance:'authored analytic browser control'}));p.proposal=structuredClone(p.existing);Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:180,stepMinutes:5,mobilityPerHour:0,boundaryExitPerHour:0});p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[3,9,22]};p.observations=[{cellIndex:0,minute:60,depthMm:23,uncertaintyMm:.1,source:'authored sensor A calibration',scenario:'existing',use:'calibration'},{cellIndex:0,minute:120,depthMm:14,uncertaintyMm:.1,source:'authored sensor A challenge',scenario:'existing',use:'challenge'}];localStorage.setItem('experimental-earth-site-v1',JSON.stringify(p));})()`);
 await evaluate(`window.offsetReloadMarker=true`);await send('Page.reload');
 for(let i=0;i<100;i++){if(await evaluate(`!window.offsetReloadMarker && !!document.querySelector('#depth-offset-rows')?.textContent.includes('authored sensor A')`))break;await new Promise(r=>setTimeout(r,50));}
 assert.equal(await evaluate(`!!document.querySelector('#depth-offset-run')`),true);
 await evaluate(`document.querySelector('#depth-offset-run').click()`);
 assert.equal(await evaluate(`document.querySelector('#depth-offset-status').dataset.state`),'error');checks.push('missing association/selection refuses without supported result');
 const before=await evaluate(`localStorage.getItem('experimental-earth-site-v1')`);
 await evaluate(`document.querySelector('#depth-offset-association').value='Authored shared sensor zero';for(const e of document.querySelectorAll('#depth-offset-rows input'))e.checked=true;document.querySelector('#depth-offset-run').click()`);
 assert.equal(await evaluate(`document.querySelector('#depth-offset-status').dataset.state`),'one-survivor');
 assert.match(await evaluate(`document.querySelector('#depth-offset-results [data-rate="9"]').textContent`),/1.9 to 2.1/);
 assert.equal(await evaluate(`localStorage.getItem('experimental-earth-site-v1')`),before);checks.push('actual app retains conditional9mmh plus2mm offset without changing source');
 await evaluate(`window.offsetDownload=null;window.originalCreateURL=URL.createObjectURL;URL.createObjectURL=blob=>{window.offsetDownload=blob;return window.originalCreateURL(blob)};document.querySelector('#depth-offset-save').click()`);
 const text=await evaluate(`window.offsetDownload.text()`);let downloaded=null;
 for(let i=0;i<100;i++){try{downloaded=await readFile(resolve(runDirectory,'depth-offset-investigation.json'),'utf8');break;}catch(error){if(error.code!=='ENOENT')throw error;await new Promise(r=>setTimeout(r,50));}}
 assert.equal(downloaded,text);const saved=JSON.parse(text);assert.deepEqual(Object.keys(saved).sort(),['declaration','kind','project']);assert.equal(saved.project.observations[0].depthMm,23);checks.push('actual downloaded file contains original source and declarations only');
 await evaluate(`document.querySelector('#depth-offset-min').value='-4';document.querySelector('#depth-offset-min').dispatchEvent(new Event('input',{bubbles:true}))`);
 assert.equal(await evaluate(`document.querySelector('#depth-offset-save').disabled`),true);assert.equal(await evaluate(`document.querySelector('#depth-offset-results').childElementCount`),0);checks.push('declaration change retires result and download');
 await evaluate(`window.offsetReloadMarker=true`);await send('Page.reload');
 for(let i=0;i<100;i++){if(await evaluate(`!window.offsetReloadMarker && !!document.querySelector('#depth-offset-open')`))break;await new Promise(r=>setTimeout(r,50));}
 await evaluate(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(text)}],'original.json',{type:'application/json'}));const e=document.querySelector('#depth-offset-open');e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 for(let i=0;i<100;i++){if(await evaluate(`document.querySelector('#depth-offset-status').dataset.state==='one-survivor'`))break;await new Promise(r=>setTimeout(r,50));}
 assert.equal(await evaluate(`document.querySelector('#depth-offset-status').dataset.state`),'one-survivor');assert.match(await evaluate(`document.querySelector('#depth-offset-status').textContent`),/Recomputed the reopened original source/);assert.equal(await evaluate(`localStorage.getItem('experimental-earth-site-v1')`),before);checks.push('fresh-module real-file reopening recomputes with active project unchanged');
 await capturePanel('depth-offset-desktop.png');
 const rejected=structuredClone(saved);rejected.project.observations[1].depthMm=100;rejected.declaration.references[1].readingJson=JSON.stringify(rejected.project.observations[1]);
 await evaluate(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(rejected))}],'challenge.json'));const e=document.querySelector('#depth-offset-open');e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 for(let i=0;i<100;i++){if(await evaluate(`document.querySelector('#depth-offset-status').dataset.state==='challenged'`))break;await new Promise(r=>setTimeout(r,50));}
 assert.equal(await evaluate(`document.querySelector('#depth-offset-status').dataset.state`),'challenged');assert.match(await evaluate(`document.querySelector('#depth-offset-results [data-rate="9"]').textContent`),/Calibration-allowed offset: 1.9 to 2.1 mm/);assert.match(await evaluate(`document.querySelector('#depth-offset-results [data-rate="9"]').textContent`),/Shared offset after challenge: None/);checks.push('inconsistent held-aside reading rejects shared fit while original calibration stays visible');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const box=await evaluate(`(()=>{const e=document.querySelector('#depth-offset-panel'),r=e.getBoundingClientRect();return {width:r.width,scroll:e.scrollWidth,client:e.clientWidth}})()`);assert.ok(box.scroll<=box.client+2,JSON.stringify(box));checks.push('390px panel has no internal horizontal overflow');
 await capturePanel('depth-offset-narrow.png');
 assert.equal(exceptions.length,0);checks.push('no uncaught browser exceptions');
});
await writeFile(resolve(runDirectory,'receipt.json'),JSON.stringify({checks},null,2));
console.log(JSON.stringify({checks:checks.length,runDirectory},null,2));
