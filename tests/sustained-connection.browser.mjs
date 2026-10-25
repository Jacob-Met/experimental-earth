// Run against the maintained app: EARTH_URL=http://127.0.0.1:8765
// PLAYWRIGHT_MODULE may name an installed absolute module entry.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
import {createHash} from 'node:crypto';
const outputDirectory=await fs.mkdtemp('/tmp/earth272-browser-');
const receipt={schema:'experimental-earth-sustained-browser/1',startedAt:new Date().toISOString(),status:'running',outputDirectory,assertions:[],sandbox:null};
const errors=[];let browser;
try{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const preflight=await browser.newPage();
 try{const session=await preflight.context().newCDPSession(preflight);receipt.sandbox=await requireChromiumSandbox({send:(method,params)=>session.send(method,params)});}
 catch(error){receipt.sandbox=error.receipt??null;throw error;}
 finally{await preflight.close();}
 await fs.writeFile(outputDirectory+'/sandbox.json',JSON.stringify(receipt.sandbox,null,2));
 receipt.sourceHashes={};for(const name of ['sustained-connection.js','sustained-connection-panel.js','ponding-connectivity-panel.js'])receipt.sourceHashes[name]=createHash('sha256').update(await fs.readFile(new URL('../'+name,import.meta.url))).digest('hex');
 const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.EARTH_URL||'http://127.0.0.1:8765');
 await page.locator('#connection-form button').click();
 const panel=page.locator('#ponding-connectivity section').filter({has:page.locator('[data-start]')});
 await panel.locator('[data-start]').fill('2');await panel.locator('[data-end]').fill('58');
 await panel.locator('button').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('[data-result]')?.textContent.includes('Fixed path:'));
 const expected=await panel.locator('[data-result]').innerText();assert.match(expected,/existing:/);assert.match(expected,/proposal:/);
 const downloadPromise=page.waitForEvent('download');await page.locator('#connection-export').click();const download=await downloadPromise;
 const text=await fs.readFile(await download.path(),'utf8'),saved=JSON.parse(text);
 assert.deepEqual(saved.sustainedWindow,{startMinute:2,endMinute:58});assert.equal(saved.schema,'experimental-earth-connection/1');assert.equal(saved.results,undefined);
 await panel.locator('[data-end]').fill('57');assert.equal(await panel.locator('[data-result]').innerText(),'');
 await page.locator('#rain').fill('20');await page.locator('#rain').dispatchEvent('change');
 const active=await page.evaluate(()=>localStorage.getItem('experimental-earth-site-v1'));
 await page.locator('#connection-import').setInputFiles({name:'fixed-connection.json',mimeType:'application/json',buffer:Buffer.from(text)});
 await page.waitForFunction(()=>document.querySelector('#connection-source')?.textContent.includes('Reopened isolated'));
 assert.equal(await panel.locator('[data-result]').innerText(),expected);
 assert.equal(await page.evaluate(()=>localStorage.getItem('experimental-earth-site-v1')),active);
 saved.sustainedWindow.endMinute=-1;
 await page.locator('#connection-import').setInputFiles({name:'bad-window.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
 await page.waitForFunction(()=>document.querySelector('#connection-error')?.textContent.includes('positive-duration'));
 assert.equal(await page.locator('#connection-controls').isVisible(),false);assert.equal(await panel.isVisible(),false);
 await page.locator('#connection-import').setInputFiles({name:'fixed-connection.json',mimeType:'application/json',buffer:Buffer.from(text)});
 await page.waitForFunction(()=>document.querySelector('[data-result]')?.textContent.includes('Fixed path:'));
 await page.locator('#ponding-connectivity').screenshot({path:outputDirectory+'/desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await panel.scrollIntoViewIfNeeded();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.locator('#ponding-connectivity').screenshot({path:outputDirectory+'/narrow.png'});
 await page.locator('#connection-start').fill('A1');assert.equal(await panel.isVisible(),false);
 assert.deepEqual(errors,[]);
 receipt.status='passed';receipt.passed=5;receipt.assertions=['keyboard comparison','source-only download','reopen recomputes exact window and preserves newer workspace','malformed replay retires result','390px and changed-question retirement'];
}catch(error){receipt.status='failed';receipt.failure={name:error.name,message:error.message,stack:error.stack};throw error;}
finally{receipt.completedAt=new Date().toISOString();receipt.pageErrors=errors;await fs.writeFile(outputDirectory+'/receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));await browser?.close();}

