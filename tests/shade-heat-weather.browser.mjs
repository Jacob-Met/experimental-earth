import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {writeFile,readFile,mkdir,access} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';
import {parseShadeHeatInvestigation} from '../shade-heat.js';
import {authoredPowerWeather} from './weather-power-fixture.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),runDirectory=root+'.browser-run-weather-'+randomUUID(),checks=[];
const rawPath=runDirectory+'/authored-hourly-weather.json',raw=JSON.stringify(authoredPowerWeather());
try {
const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome'},async session=>{
 await writeFile(rawPath,raw);
 const {send,evaluate,exceptions}=session;await send('Runtime.enable');await send('Page.enable');await send('DOM.enable');
 async function until(code){for(let i=0;i<150;i++){try{if(await evaluate(code))return;}catch{}await delay(40);}throw Error('Timeout '+code+' '+await evaluate("document.getElementById('shade-status')?.textContent"));}
 const click=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
 async function file(selector,path){const doc=await send('DOM.getDocument'),node=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});await send('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[path]});}
 async function run(){await evaluate("document.getElementById('shade-form').requestSubmit()");await until("document.getElementById('shade-status').dataset.state==='compared'");}
 const stored=()=>evaluate("localStorage.getItem('experimental-earth-site-v1')");
 await until("Boolean(document.getElementById('shade-weather-import'))");const original=await stored();await click('shade-example');await until("document.getElementById('shade-status').dataset.state==='compared'");
 const constantSummary=await evaluate("document.getElementById('shade-summary').textContent");
 await file('#shade-weather-import',rawPath);await until("document.getElementById('shade-latitudeDeg').disabled");
 assert.equal(await evaluate("document.getElementById('shade-startUtc').value"),'2025-06-21T00:00:00.000Z');
 assert.equal(await evaluate("document.getElementById('shade-stepMinutes').value"),'60');await run();
 assert.notEqual(await evaluate("document.getElementById('shade-summary').textContent"),constantSummary);assert.equal(await stored(),original);
 assert.match(await evaluate("document.getElementById('shade-inspect').textContent"),/Original weather hour/);checks.push('Actual original hourly JSON binds point and time, drives modeled peak, preserves active site');
 const downloads=runDirectory+'/download';await mkdir(downloads);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});await click('shade-export');const exported=downloads+'/experimental-earth-shade-heat-inputs.json';
 for(let i=0;i<100;i++){try{await access(exported);break;}catch{await delay(40);}}
 const text=await readFile(exported,'utf8'),parsed=parseShadeHeatInvestigation(text);assert.equal(parsed.investigation.kind,'experimental-earth/shade-heat-inputs/2');assert.equal(parsed.investigation.declaration.weather.rawText,raw);
 await send('Page.reload',{ignoreCache:true});await until("Boolean(document.getElementById('shade-import'))");await file('#shade-import',exported);await until("document.getElementById('shade-status').dataset.state==='compared'");
 assert.equal(await evaluate("document.getElementById('shade-reservoirC').disabled"),true);assert.equal(await stored(),original);checks.push('Real v2 download preserves original JSON and recomputes in fresh page with source controls locked');
 const bad=JSON.parse(raw);bad.header.time_standard='LST';const badPath=runDirectory+'/local-time.json';await writeFile(badPath,JSON.stringify(bad));const summary=await evaluate("document.getElementById('shade-summary').textContent");
 await file('#shade-weather-import',badPath);await until("document.getElementById('shade-status').dataset.state==='weather-refused'");assert.equal(await evaluate("document.getElementById('shade-summary').textContent"),summary);assert.equal(await evaluate("document.getElementById('shade-export').disabled"),false);
 const bytesPath=runDirectory+'/invalid-utf8.json';await writeFile(bytesPath,Buffer.from([0xff,0xfe,0x7b]));await file('#shade-weather-import',bytesPath);await until("document.getElementById('shade-status').textContent.includes('encoded data')");assert.equal(await evaluate("document.getElementById('shade-summary').textContent"),summary);checks.push('Local solar time and invalid UTF8 refuse transactionally without replacing the accepted source');
 await evaluate("window.__oldArrayBuffer=File.prototype.arrayBuffer;window.__releaseWeather=null;File.prototype.arrayBuffer=async function(){await new Promise(r=>window.__releaseWeather=r);return window.__oldArrayBuffer.call(this)}");
 await file('#shade-weather-import',rawPath);await until('Boolean(window.__releaseWeather)');await click('shade-example');await until("document.getElementById('shade-status').dataset.state==='compared'");await evaluate('window.__releaseWeather();File.prototype.arrayBuffer=window.__oldArrayBuffer');await delay(80);
 assert.equal(await evaluate("document.getElementById('shade-startUtc').value"),'2026-06-21T04:00:00.000Z');assert.equal(await evaluate("document.getElementById('shade-weather-import').value"),'');
 await file('#shade-weather-import',rawPath);await until("document.getElementById('shade-startUtc').value==='2025-06-21T00:00:00.000Z'");await run();checks.push('Late weather read cannot replace newer authored source; same original file can be selected again');
 await click('shade-weather-clear');assert.equal(await evaluate("document.getElementById('shade-results').children.length"),0);assert.equal(await evaluate("document.getElementById('shade-reservoirC').disabled"),false);checks.push('Returning to constant weather invalidates the hourly result and restores explicit controls');
 await file('#shade-weather-import',rawPath);await until("document.getElementById('shade-reservoirC').disabled");await run();await until("!document.getElementById('toast').classList.contains('show')");
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(100);assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
 await evaluate("document.getElementById('shade-settings').scrollIntoView({block:'start',behavior:'instant'})");const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/weather-narrow.png',Buffer.from(shot.data,'base64'));assert.deepEqual(exceptions,[]);checks.push('Hourly source controls fit390px without runtime exceptions');
 return {checks,sandbox:session.sandbox,exceptions};
});
const receipt={status:'PASS',...result.value,receipt:result.receipt};await writeFile(runDirectory+'/browser.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,runDirectory,receipt:error.receipt??null},null,2));process.exitCode=1;}
