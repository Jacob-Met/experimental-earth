import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
import {makeExample} from '../core.js';
import {exportSharedObservedConnection} from '../observed-shared-connection.js';
const directory=await fs.mkdtemp('/tmp/earth285-browser-'),receipt={schema:'earth-shared-observed-browser/1',directory,status:'running',startedAt:new Date().toISOString(),checks:[]};
const project=makeExample(),query={scenario:'existing',minutes:[10,20],thresholdMm:5,startIndex:8,endIndex:10,allowedIndices:[0,1,2,8,10,16,17,18]};
project.observations=[10,20].flatMap(minute=>query.allowedIndices.map(cellIndex=>({minute,cellIndex,scenario:'existing',depthMm:(minute===10?[16,17,18]:[0,1,2]).includes(cellIndex)?10:0,uncertaintyMm:0,use:'challenge',source:'Authored browser original-row control'})));
const original=exportSharedObservedConnection(project,query),errors=[];let browser;
try{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const preflight=await browser.newPage();try{const cdp=await preflight.context().newCDPSession(preflight);receipt.sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)});}catch(e){receipt.sandbox=e.receipt;throw e;}finally{await preflight.close();}
 const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.EARTH_URL||'http://127.0.0.1:8765');
 const panel=page.locator('#shared-observed-connection');await panel.waitFor();
 const active=await page.evaluate(()=>localStorage.getItem('experimental-earth-site-v1'));
 const upload=async text=>{await panel.locator('[data-import]').setInputFiles({name:'original-visits.json',mimeType:'application/json',buffer:Buffer.from(text)});};
 await upload(original);await page.waitForFunction(()=>document.querySelector('#shared-observed-connection [data-result]')?.textContent.includes('Every offered connection'));
 let text=await panel.locator('[data-result]').innerText();assert.match(text,/At 10 min alone: band supported/);assert.match(text,/At 20 min alone: band supported/);assert.match(text,/Blocking boundary cell A1: 20 min/);assert.match(text,/Blocking boundary cell A3: 10 min/);
 assert.equal(await page.evaluate(()=>localStorage.getItem('experimental-earth-site-v1')),active);receipt.checks.push('different individually supported paths do not certify a shared path; isolated original source preserved');
 await panel.locator('[data-result] > details').evaluate(el=>el.open=true);assert.match(await panel.locator('[data-result] > details').innerText(),/role challenge; source Authored browser original-row control/);await panel.locator('[data-result] > details').evaluate(el=>el.open=false);
 const waitDownload=page.waitForEvent('download');await panel.locator('[data-export]').focus();await page.keyboard.press('Enter');const download=await waitDownload,downloaded=await fs.readFile(await download.path(),'utf8');
 assert.deepEqual(JSON.parse(downloaded).project,project);assert.deepEqual(Object.keys(JSON.parse(downloaded)).sort(),['project','query','schema']);await fs.writeFile(directory+'/original-investigation.json',downloaded);receipt.checks.push('keyboard completed source-only download retains all original rows and roles');
 const unknown=structuredClone(project);unknown.observations=unknown.observations.filter(o=>!(o.minute===20&&[0,1,2].includes(o.cellIndex)));
 await upload(exportSharedObservedConnection(unknown,query));await page.waitForFunction(()=>document.querySelector('#shared-observed-connection [data-result]')?.textContent.includes('do not settle'));assert.match(await panel.locator('[data-result]').innerText(),/A1 at 20 min/);receipt.checks.push('removed original readings become explicit unresolved cell/time pairs');
 const supported=structuredClone(unknown);supported.observations.push(...[0,1,2].map(cellIndex=>({minute:20,cellIndex,scenario:'existing',depthMm:4,uncertaintyMm:1,source:'Authored inclusive bound'})));
 await upload(exportSharedObservedConnection(supported,query));await page.waitForFunction(()=>document.querySelector('#shared-observed-connection [data-result]')?.textContent.includes('Supported shared path'));
 const unobserved={...query,minutes:[10,15,20]};await upload(exportSharedObservedConnection(supported,unobserved));await page.waitForFunction(()=>document.querySelector('#shared-observed-connection [data-result]')?.textContent.includes('at 15 min'));receipt.checks.push('inclusive support and missing intermediate visit remain distinct without interpolation');
 await page.locator('#rain').fill('20');await page.locator('#rain').dispatchEvent('change');assert.equal(await panel.locator('[data-result]').innerText(),'');
 const newer=await page.evaluate(()=>localStorage.getItem('experimental-earth-site-v1'));await upload(downloaded);await page.waitForFunction(()=>document.querySelector('#shared-observed-connection [data-result]')?.textContent.includes('Every offered connection'));assert.equal(await page.evaluate(()=>localStorage.getItem('experimental-earth-site-v1')),newer);
 await panel.screenshot({path:directory+'/desktop.png'});await page.setViewportSize({width:390,height:844});await panel.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await panel.screenshot({path:directory+'/narrow.png'});receipt.checks.push('reopen recomputes original result preserving newer working notebook; desktop/390px');
 const bad=JSON.parse(downloaded);bad.query.minutes=[10,10];await upload(JSON.stringify(bad));await page.waitForFunction(()=>document.querySelector('#shared-observed-connection [data-error]')?.textContent.includes('distinct'));assert.equal(await panel.locator('[data-result]').innerText(),'');assert.equal(await panel.locator('[data-export]').isDisabled(),true);
 await page.evaluate(raw=>{const root=document.querySelector('#shared-observed-connection'),input=root.querySelector('[data-import]'),dt=new DataTransfer();dt.items.add(new File(['{}'],'delayed.json'));input.files=dt.files;input.files[0].text=()=>new Promise(resolve=>window.releaseSharedRead=resolve);input.dispatchEvent(new Event('change'));root.querySelector('[data-minutes]').value='10,30';root.querySelector('[data-minutes]').dispatchEvent(new Event('input',{bubbles:true}));window.releaseSharedRead(raw);},downloaded);
 assert.equal(await panel.locator('[data-result]').innerText(),'');assert.equal(await panel.locator('[data-minutes]').inputValue(),'10,30');receipt.checks.push('malformed and stale asynchronous reads cannot restore a successful result');
 assert.deepEqual(errors,[]);receipt.sourceHashes={};for(const file of ['observed-shared-connection.js','observed-shared-connection-panel.js','app.js'])receipt.sourceHashes[file]=createHash('sha256').update(await fs.readFile(new URL('../'+file,import.meta.url))).digest('hex');receipt.status='passed';
}catch(error){receipt.status='failed';receipt.failure={message:error.message,stack:error.stack};throw error;}
finally{receipt.pageErrors=errors;receipt.completedAt=new Date().toISOString();await fs.writeFile(directory+'/receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));await browser?.close();}
