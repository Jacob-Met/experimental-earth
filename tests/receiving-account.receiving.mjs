import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
import {makeReceivingAccountExample,serializeReceivingAccounts,parseReceivingAccounts} from '../receiving-account-evidence.js';
import {serializeDrainingEvidence} from '../draining-layer-evidence.js';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const output=await mkdtemp(join(process.env.HAMON_BROWSER_TMPDIR||tmpdir(),'earth-account-'));
const original=makeReceivingAccountExample(),checks=[],errors=[],sourceHashes={};
const sha256=b=>createHash('sha256').update(b).digest('hex');
for(const path of ['receiving-account-evidence.js','receiving-account-panel.js','draining-evidence-panel.js','draining-layer.css','draining-infiltration.js','core.js','serve.py','tests/receiving-account.receiving.mjs'])sourceHashes[path]=sha256(await readFile(join(root,path)));
const originalFile=join(output,'original.json'),parentFile=join(output,'parent.json');
await writeFile(originalFile,serializeReceivingAccounts(original.project,original.study,original.account));
await writeFile(parentFile,serializeDrainingEvidence(original.project,original.study));
let server,browser,sandbox,failure=null,serverClosed=false,baseUrl='';const serverLog=[];
const receipt={schema:'experimental-earth-receiving-account-browser/1',passed:false,checks,errors,sourceHashes,output,sourceKind:'Authored maintained-kernel control; not field validation'};
try{
  server=spawn(process.env.PYTHON_BIN||'python3',[join(root,'serve.py'),'--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
  server.once('close',()=>{serverClosed=true;});server.stderr.on('data',b=>serverLog.push(b.toString()));
  baseUrl=await new Promise((yes,no)=>{let text='';const timer=setTimeout(()=>no(Error('Maintained serve.py did not become ready')),15000);
    server.once('error',e=>{clearTimeout(timer);no(e);});server.once('exit',()=>{clearTimeout(timer);no(Error('Maintained server exited before readiness'));});
    server.stdout.on('data',b=>{text+=b.toString();const match=text.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match){clearTimeout(timer);yes(match[0]);}});
  });
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,chromiumSandbox:true,args:['--allow-chrome-scheme-url','--disable-background-networking'],timeout:30000});
  let context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage();
  const observe=p=>p.on('pageerror',e=>errors.push(String(e)));observe(page);
  const cdp=await context.newCDPSession(page);sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)});assert.equal(sandbox.admitted,true);
  const requested=new Set();page.on('request',r=>requested.add(new URL(r.url()).pathname));
  const show=async()=>{await page.goto(baseUrl,{waitUntil:'networkidle'});await page.locator('#ra-open').waitFor({state:'attached'});await page.locator('#ra-open').evaluate(input=>{let p=input.parentElement;while(p){if(p.tagName==='DETAILS')p.open=true;p=p.parentElement;}});};
  const run=async expected=>{await page.locator('#ra-run').focus();await page.keyboard.press('Enter');await page.waitForFunction(state=>document.querySelector('#ra-status').dataset.state===state,expected);};
  const candidates=()=>page.locator('#ra-results [data-hypothesis]').evaluateAll(rows=>rows.map(r=>({id:r.dataset.hypothesis,calibration:r.dataset.calibration,challenge:r.dataset.challenge})));
  const open=async path=>{await page.locator('#ra-open').setInputFiles(path);await page.waitForFunction(()=>document.querySelector('#ra-status').textContent.startsWith('Recomputed from original inputs.'));};
  await show();const activeProject=await page.evaluate(()=>localStorage.getItem('experimental-earth-site-v1')),parentBefore=await page.locator('#de-hypotheses').innerHTML();
  await page.locator('#ra-example').click();await run('ambiguous');
  assert.match(await page.locator('#ra-source').textContent(),/4 cells \/ 4 m²/);
  assert.equal(await page.locator('#ra-question [data-best]').getAttribute('data-best'),'retained-180');
  assert.match(await page.locator('#ra-question').textContent(),/no separating unrecorded surface point/);
  assert.match(await page.locator('#ra-offer-detail').textContent(),/29\.2 L.*17\.941105 L/);
  assert.deepEqual(await candidates(),[{id:'initial-water',calibration:'true',challenge:'true'},{id:'empty-fit',calibration:'true',challenge:'true'}]);
  assert.equal(await page.locator('#de-hypotheses').innerHTML(),parentBefore);
  assert.equal(await page.evaluate(()=>localStorage.getItem('experimental-earth-site-v1')),activeProject);
  for(const path of ['receiving-account-evidence.js','receiving-account-panel.js','draining-evidence-panel.js','draining-layer.css']){assert.ok(requested.has('/'+path));const response=await fetch(baseUrl+path);assert.equal(response.status,200);assert.equal(sha256(Buffer.from(await response.arrayBuffer())),sourceHashes[path]);}
  await page.locator('#ra-inspect').selectOption('drained-180');assert.match(await page.locator('#ra-offer-detail').textContent(),/54\.088414 L.*53\.347309 L/);
  checks.push('Maintained served consumer and consumed module hashes; keyboard comparison exposes equal surface courses but different inventories/drainage without mutating active project or parent hypotheses');

  await page.locator('#ra-add-reading').click();const row=page.locator('#ra-readings fieldset').first();
  await row.locator('[data-field="minute"]').fill('180');await row.locator('[data-field="valueLiters"]').fill('29.2');await row.locator('[data-field="uncertaintyLiters"]').fill('0.1');await row.locator('[data-field="source"]').fill('Authored held-aside whole-footprint inventory, not a field sensor');
  await run('one-survivor');assert.deepEqual(await candidates(),[{id:'initial-water',calibration:'true',challenge:'true'},{id:'empty-fit',calibration:'true',challenge:'false'}]);
  assert.equal(await page.locator('#ra-question [data-best]').getAttribute('data-best'),'drained-180');
  const questionBefore=await page.locator('#ra-question').textContent();
  await row.locator('[data-field="valueLiters"]').fill('17.941104748991222');assert.equal(await page.locator('#ra-results').textContent(),'');assert.equal(await page.locator('#ra-save').isDisabled(),true);
  await run('one-survivor');assert.deepEqual(await candidates(),[{id:'initial-water',calibration:'true',challenge:'false'},{id:'empty-fit',calibration:'true',challenge:'true'}]);
  assert.equal(await page.locator('#ra-question').textContent(),questionBefore);
  checks.push('Original held receiver value changes only challenge compatibility; calibration support and prospective question remain identical; already-recorded channel/time is excluded');

  const downloadPromise=page.waitForEvent('download');await page.locator('#ra-save').click();const download=await downloadPromise,savedPath=join(output,'saved-original.json');await download.saveAs(savedPath);
  const raw=JSON.parse(await readFile(savedPath,'utf8')),parsed=parseReceivingAccounts(JSON.stringify(raw));assert.deepEqual(Object.keys(raw),['schema','project','study','account']);assert.deepEqual(parsed.project,original.project);assert.deepEqual(parsed.study,original.study);assert.equal(parsed.account.readings.length,1);assert.equal(parsed.account.readings[0].valueLiters,17.941104748991222);assert.equal(Object.hasOwn(parsed.account.offers[0],'valueLiters'),false);
  await context.close();context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});page=await context.newPage();observe(page);await show();const reopenedActive=await page.evaluate(()=>localStorage.getItem('experimental-earth-site-v1'));await open(savedPath);
  assert.equal(await page.locator('#ra-question').textContent(),questionBefore);assert.equal(await page.evaluate(()=>localStorage.getItem('experimental-earth-site-v1')),reopenedActive);
  checks.push('Actual download contains only original inputs; fresh browser context recomputes the same supported question and challenge without replacing the active project');

  const changed=page.locator('#ra-readings fieldset').first();await changed.locator('[data-field="use"]').selectOption('calibration');await changed.locator('[data-field="valueLiters"]').fill('100');await run('calibration-rejected');
  assert.equal(await page.locator('#ra-results [data-calibration="true"]').count(),0);assert.equal(await page.locator('#ra-question [data-best]').count(),0);
  await changed.locator('[data-field="valueLiters"]').fill('');await run('refused');assert.match(await page.locator('#ra-status').textContent(),/Blank numbers are not zero/);assert.equal(await page.locator('#ra-results').textContent(),'');
  await changed.locator('[data-field="valueLiters"]').fill('29.2');await changed.locator('[data-field="minute"]').fill('181');await run('refused');assert.match(await page.locator('#ra-status').textContent(),/exact retained solver endpoints/);
  const forged={...raw,result:{status:'one-survivor'}};const forgedFile=join(output,'forged.json');await writeFile(forgedFile,JSON.stringify(forged));await page.locator('#ra-open').setInputFiles(forgedFile);await page.waitForFunction(()=>document.querySelector('#ra-status').dataset.state==='refused');assert.match(await page.locator('#ra-status').textContent(),/saved conclusions are not accepted/);assert.equal(await page.locator('#ra-save').isDisabled(),true);
  checks.push('Contradictory calibration rejects every explanation; blank numbers, off-grid account times and forged saved conclusions cannot become a successful or stale result');

  await page.locator('#de-open').setInputFiles(parentFile);await page.waitForFunction(()=>document.querySelector('#de-status').textContent.startsWith('Recomputed from original inputs.'));
  await page.locator('#ra-current').click();assert.equal(await page.locator('#ra-readings fieldset').count(),0);assert.equal(await page.locator('#ra-offers fieldset').count(),0);assert.equal(await page.locator('#ra-basis').inputValue(),'');
  await page.locator('#ra-basis').fill(original.account.footprintBasis);await page.locator('#ra-add-offer').click();const offer=page.locator('#ra-offers fieldset').first();await offer.locator('[data-field="minute"]').fill('180');await offer.locator('[data-field="uncertaintyLiters"]').fill('0.1');await offer.locator('[data-field="basis"]').fill('Explicit hypothetical whole-footprint inventory available for this original event');await run('ambiguous');
  const copiedResult=await page.locator('#ra-results').textContent(),copiedSource=await page.locator('#ra-source').textContent();
  await page.locator('#de-hypotheses fieldset').first().locator('[data-field="initialStoredMm"]').fill('0');assert.equal(await page.locator('#ra-results').textContent(),copiedResult);assert.equal(await page.locator('#ra-source').textContent(),copiedSource);
  const copiedDownload=page.waitForEvent('download');await page.locator('#ra-save').click();const copied=await copiedDownload,copiedPath=join(output,'copied-source.json');await copied.saveAs(copiedPath);assert.equal(JSON.parse(await readFile(copiedPath,'utf8')).study.hypotheses[0].initialStoredMm,3);
  checks.push('Explicit current-source handoff starts an empty new account and freezes its original footprint and parameters; later parent edits cannot retarget measurements or saved source');

  await page.evaluate(()=>{const native=File.prototype.arrayBuffer;window.__releaseAccountRead=null;File.prototype.arrayBuffer=function(){if(this.name==='late-original.json')return new Promise(resolve=>{window.__releaseAccountRead=async()=>resolve(await native.call(this));});return native.call(this);};});
  await page.locator('#ra-open').setInputFiles({name:'late-original.json',mimeType:'application/json',buffer:Buffer.from(await readFile(savedPath))});await page.waitForFunction(()=>document.querySelector('#ra-status').dataset.state==='opening'&&typeof window.__releaseAccountRead==='function');
  await page.locator('#ra-example').click();const freshDraft=await page.locator('#ra-source').textContent();await page.evaluate(async()=>{await window.__releaseAccountRead();});await page.waitForTimeout(50);
  assert.equal(await page.locator('#ra-source').textContent(),freshDraft);assert.equal(await page.locator('#ra-readings fieldset').count(),0);assert.equal(await page.locator('#ra-status').getAttribute('data-state'),'draft');assert.equal(await page.locator('#ra-save').isDisabled(),true);
  await open(savedPath);assert.equal(await page.locator('#ra-readings fieldset').count(),1);
  checks.push('A delayed original-file read cannot overwrite a newer example/source action; the file picker remains reusable and reopening recomputes again');

  for(const [name,width,height]of [['desktop',1440,1000],['narrow',390,844]]){
    await page.setViewportSize({width,height});await page.locator('#receiving-accounts').scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    for(const id of ['ra-run','ra-open','ra-save','ra-inspect'])assert.equal(await page.locator('#'+id).isVisible(),true);
    await page.locator('#receiving-accounts').screenshot({path:join(output,name+'.png')});
  }
  assert.deepEqual(errors,[]);checks.push('Actual consumer remains usable at desktop and 390 px widths with all primary controls visible and zero browser exceptions');receipt.passed=true;
}catch(error){failure=error;receipt.failure=String(error.stack||error);}
finally{
  await browser?.close();if(server&&!serverClosed){server.kill('SIGTERM');await new Promise(resolve=>{if(serverClosed)return resolve();const t=setTimeout(resolve,3000);server.once('close',()=>{clearTimeout(t);resolve();});});}
  receipt.sandbox=sandbox;receipt.maintainedServer={baseUrl,closed:serverClosed};if(!serverClosed){receipt.passed=false;receipt.failure=receipt.failure||'Owned maintained server exit not confirmed';}
  await writeFile(join(output,'server.log'),serverLog.join(''));await writeFile(join(output,'browser.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:receipt.passed,checks:checks.length,output,failure:receipt.failure||null}));
}
if(failure)throw failure;if(!receipt.passed)throw Error(receipt.failure);
