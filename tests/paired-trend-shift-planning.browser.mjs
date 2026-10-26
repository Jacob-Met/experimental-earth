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
 browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#paired-series > summary').click();
 const input=shiftFixture();for(const p of input.inquiry.series.pairs.slice(0,2)){p.treated.lower=-1;p.treated.upper=1;}for(const p of input.inquiry.series.pairs.slice(2)){p.treated.lower-=.01;p.treated.upper+=.01;}
 await page.locator('#ps-open').setInputFiles({name:'original-series.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schema:'experimental-earth-paired-series-bundle/1',project:makeExample(),input:input.inquiry.series}))});
 await page.waitForFunction(()=>!document.getElementById('ps-save').disabled);
 await page.locator('#paired-trend-region > summary').click();await page.locator('#ptr-basis').fill('Authored planning control');await page.locator('#ptr-run').click();
 await page.locator('#paired-trend-shift > summary').click();await page.locator('#pts-run').click();
 assert.match(await page.locator('#pts-result').innerText(),/cannot shrink the range below 0.98 C/);
 assert.match(await page.locator('#pts-result').innerText(),/Inconsistent later evidence can reject the model/);
 checks.push('ordinary original-series consumer calculates positive later-only identification floor');
 const dl=page.waitForEvent('download');await page.locator('#pts-save').click();const path=resolve(dir,'original-planning-source.json');await(await dl).saveAs(path);
 const raw=await readFile(path,'utf8'),bundle=JSON.parse(raw);assert.ok(!raw.includes('laterOnlyPlanning'));assert.deepEqual(Object.keys(bundle.input).sort(),['inquiry','model','schema']);
 await page.locator('#project-title').fill('Preserved active planning workspace');await page.locator('#project-title').press('Tab');await page.locator('#pts-open').setInputFiles(path);await page.waitForFunction(()=>!document.getElementById('pts-save').disabled);
 assert.equal(await page.locator('#project-title').inputValue(),'Preserved active planning workspace');assert.match(await page.locator('#pts-result').innerText(),/below 0.98 C/);
 checks.push('original-only download and reopen recompute floor without adopting active workspace');
 const refined=structuredClone(bundle);for(const [day,gap]of [[4,5],[5,6]]){const p=structuredClone(refined.input.inquiry.series.pairs.at(-1)),time=new Date(Date.parse('2026-01-01T00:00:00Z')+day*86400000).toISOString().replace('.000Z','Z');p.time=p.treated.time=p.comparison.time=time;p.treated.lower=p.treated.upper=gap;refined.input.inquiry.series.pairs.push(p);}
 const open=async b=>{await page.locator('#pts-open').setInputFiles({name:'changed-original.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(b))});await page.waitForFunction(()=>!document.getElementById('pts-save').disabled);};
 await open(refined);assert.match(await page.locator('#pts-result').innerText(),/current shift-range width is 1 C/);assert.match(await page.locator('#pts-result').innerText(),/cannot shrink the range below 1 C/);
 checks.push('additional exact later readings retain positive baseline uncertainty');
 await open({...bundle,input:shiftFixture()});assert.match(await page.locator('#pts-result').innerText(),/zero lower bound/);assert.doesNotMatch(await page.locator('#pts-result').innerText(),/cannot shrink the range below/);
 await open({...bundle,input:shiftFixture(1)});assert.match(await page.locator('#pts-result').innerText(),/No one constant later shift/);assert.doesNotMatch(await page.locator('#pts-result').innerText(),/Planning later measurements/);
 checks.push('zero floor and incompatible model replace prior positive planning result');
 await page.locator('#pts-open').setInputFiles(path);await page.waitForFunction(()=>!document.getElementById('pts-save').disabled);
 for(const width of [1280,390]){await page.setViewportSize({width,height:900});await page.locator('#paired-trend-shift').scrollIntoViewIfNeeded();await page.locator('#paired-trend-shift').screenshot({path:resolve(dir,`shift-planning-${width}.png`)});assert.ok(await page.locator('#paired-trend-shift').evaluate(e=>e.scrollWidth<=e.clientWidth+1));}
 checks.push('desktop and narrow planning result fits');assert.deepEqual(errors,[]);
 await writeFile(resolve(dir,'receipt.json'),JSON.stringify({checks,browser:await browser.version()},null,2));console.log(checks);
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
