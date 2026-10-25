import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const artifacts=process.env.BROWSER_ARTIFACT_DIR || '/tmp/earth-clock-full';await mkdir(artifacts,{recursive:true});
const root=new URL('../',import.meta.url);
const server=createServer(async(req,res)=>{try{res.setHeader('Content-Type',req.url==='/'?'text/html':req.url.endsWith('.css')?'text/css':'text/javascript');res.end(await readFile(new URL(req.url==='/'?'index.html':'.'+req.url,root)))}catch{res.statusCode=404;res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
 const errors=[],external=[];
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto('chrome://sandbox');const sandbox=await page.locator('body').innerText();assert.match(sandbox,/Seccomp-BPF sandbox\s+Yes/);
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:'+server.address().port))external.push(r.url())});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>document.getElementById('observation-table-status').textContent.includes('Choose'));
 const body='cell,timestamp,event_start,depth,uncertainty,unit,source,scenario,use\nA1,2026-10-25T01:15:30+02:00,2026-10-24T23:00:00Z,1,.1,cm,logger,existing,calibration';
 const upload=buffer=>page.locator('#observation-table-file').setInputFiles({name:'logger.csv',mimeType:'text/csv',buffer:Buffer.from(buffer)});
 await upload(body);await page.waitForFunction(()=>!document.getElementById('append-observation-table').disabled);
 assert.match(await page.locator('#observation-table-preview li').innerText(),/15.5 min.*original 2026-10-25T01:15:30\+02:00/);
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.locator('[aria-labelledby=observation-import-title]').scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');await page.locator('[aria-labelledby=observation-import-title]').screenshot({path:artifacts+'/preview-'+width+'.png'});}
 await page.locator('#append-observation-table').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('experimental-earth-site-v1')).observations[0].minute),15.5);
 const pending=page.waitForEvent('download');await page.locator('#export').click();const download=await pending;await download.saveAs(artifacts+'/original-project.json');
 await page.reload();await page.waitForFunction(()=>document.getElementById('observation-table-status').textContent.includes('Choose'));
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('experimental-earth-site-v1')).observations[0].tableSource.timestamp),'2026-10-25T01:15:30+02:00');
 await page.locator('#import').setInputFiles(artifacts+'/original-project.json');
 await upload(body.replace('2026-10-25T01:15:30+02:00','2026-02-30T00:00:00Z'));await page.waitForFunction(()=>document.getElementById('observation-table-status').textContent.startsWith('Import refused'));
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('experimental-earth-site-v1')).observations.length),1);assert.equal(await page.locator('#append-observation-table').isDisabled(),true);
 await page.locator('[aria-labelledby=observation-import-title]').scrollIntoViewIfNeeded();await page.locator('[aria-labelledby=observation-import-title]').screenshot({path:artifacts+'/refusal.png'});assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await writeFile(artifacts+'/browser.json',JSON.stringify({consumer:'full maintained app with timestamp importer',timestampPreview:true,keyboardAppend:true,invalidCalendarRefused:true,priorNotebookPreserved:true,desktopAnd390Preview:true,noHorizontalOverflow:true,pageErrors:errors,externalRequests:external,sandbox},null,2));console.log('PASS maintained importer panel timestamp preview, keyboard append, refusal and preserved notebook');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
