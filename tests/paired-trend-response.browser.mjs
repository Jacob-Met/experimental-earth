import {makeExample} from '../core.js';
import {shiftFixture} from './paired-trend-shift-fixture.mjs';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const root=resolve('.'),dir=process.env.BROWSER_ARTIFACT_DIR;await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!p.startsWith(root+'/'))throw Error();const b=await readFile(p);res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html'})[extname(p)]||'application/octet-stream');res.end(b);}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const checks=[];try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH});const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#paired-series > summary').click();
 const load=async last=>{await page.locator('#ps-open').setInputFiles({name:'original-series.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schema:'experimental-earth-paired-series-bundle/1',project:makeExample(),input:shiftFixture(last).inquiry.series}))});await page.waitForFunction(()=>!document.getElementById('ps-save').disabled);};
 await load(1);await page.locator('#paired-trend-region > summary').click();await page.locator('#ptr-basis').fill('Authored separate-history comparison');await page.locator('#ptr-run').click();
 await page.locator('#paired-trend-response > summary').click();await page.locator('#ptrs-run').focus();await page.keyboard.press('Enter');
 assert.match(await page.locator('#ptrs-result').innerText(),/rounded: 2.5 to 5.5 C/);assert.match(await page.locator('#ptrs-result').innerText(),/Slope change, rounded: -3 to -1 C/);assert.match(await page.locator('#ptrs-result').innerText(),/A common slope is incompatible/);
 checks.push('ordinary original series distinguishes supported trend change from rejected constant shift');
 const dl=page.waitForEvent('download');await page.locator('#ptrs-save').click();const path=resolve(dir,'original-response.json');await(await dl).saveAs(path);const raw=await readFile(path,'utf8'),bundle=JSON.parse(raw);
 assert.deepEqual(Object.keys(bundle.input).sort(),['inquiry','model','schema']);assert.equal(bundle.input.model,'separate-linear-periods');assert.ok(!raw.includes('response-compatible'));
 await page.locator('#project-title').fill('Preserved active response workspace');await page.locator('#project-title').press('Tab');await page.locator('#ptrs-open').setInputFiles(path);await page.waitForFunction(()=>!document.getElementById('ptrs-save').disabled);
 assert.equal(await page.locator('#project-title').inputValue(),'Preserved active response workspace');assert.match(await page.locator('#ptrs-source').innerText(),/own reopened source/);assert.match(await page.locator('#ptrs-result').innerText(),/2.5 to 5.5/);
 checks.push('original-only response replay recomputes while preserving active workspace');
 await load(4);assert.ok(await page.locator('#ptrs-save').isDisabled());await page.locator('#ptr-current').click();await page.locator('#ptr-run').click();await page.locator('#ptrs-current').click();await page.locator('#ptrs-run').click();
 assert.match(await page.locator('#ptrs-result').innerText(),/common slope remains possible/);assert.match(await page.locator('#ptrs-result').innerText(),/slice supports gap jump 1 to 1 C/);
 checks.push('changed original source retires output and reproduces exact common-slope slice');
 const open=async b=>{await page.locator('#ptrs-open').setInputFiles({name:'changed-response.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(b))});await page.waitForFunction(()=>!document.getElementById('ptrs-save').disabled);};
 const insufficient=structuredClone(bundle);insufficient.input.inquiry.series.pairs.pop();await open(insufficient);assert.match(await page.locator('#ptrs-result').innerText(),/At least two distinct later instants/);assert.doesNotMatch(await page.locator('#ptrs-result').innerText(),/Gap jump at/);
 const inconsistent=structuredClone(bundle),p=structuredClone(inconsistent.input.inquiry.series.pairs.at(-1));p.time=p.treated.time=p.comparison.time='2026-01-05T00:00:00Z';p.treated.lower=p.treated.upper=100;inconsistent.input.inquiry.series.pairs.push(p);await open(inconsistent);assert.match(await page.locator('#ptrs-result').innerText(),/No later line fits/);
 checks.push('insufficient later history and later contradiction do not invent responses');
 const bad=structuredClone(bundle);bad.input.model='causal-effect';await page.locator('#ptrs-open').setInputFiles({name:'invalid-response.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await page.waitForFunction(()=>document.getElementById('ptrs-result').textContent.includes('Select the separate'));assert.ok(await page.locator('#ptrs-save').isDisabled());
 checks.push('unsupported model retires accepted response');
 await page.evaluate(()=>{const text=File.prototype.text;File.prototype.text=async function(){if(this.name==='delayed-response.json')await new Promise(r=>window.releaseResponse=r);return text.call(this);};});await page.locator('#ptrs-open').setInputFiles({name:'delayed-response.json',mimeType:'application/json',buffer:Buffer.from(raw)});await page.locator('#ptrs-current').click();await page.evaluate(()=>window.releaseResponse());await page.waitForTimeout(50);assert.ok(await page.locator('#ptrs-save').isDisabled());assert.match(await page.locator('#ptrs-source').innerText(),/Next comparison uses/);
 checks.push('late original-file read cannot override newer source choice');
 await page.locator('#ptrs-open').setInputFiles(path);await page.waitForFunction(()=>!document.getElementById('ptrs-save').disabled);
 for(const width of [1280,390]){await page.setViewportSize({width,height:900});await page.locator('#paired-trend-response').scrollIntoViewIfNeeded();await page.locator('#paired-trend-response').screenshot({path:resolve(dir,`response-${width}.png`)});assert.ok(await page.locator('#paired-trend-response').evaluate(e=>e.scrollWidth<=e.clientWidth+1));}
 checks.push('desktop and narrow response consumer retains readable source and model boundaries');assert.deepEqual(errors,[]);
 await writeFile(resolve(dir,'receipt.json'),JSON.stringify({checks,browser:await browser.version()},null,2));console.log(checks);
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
