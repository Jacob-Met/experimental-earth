import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
import {makeNoisyReceivingAccountBandExample} from '../receiving-account-band-fit.js';
import {compareReceivingAccountConsequences,serializeReceivingAccountConsequences,RECEIVING_ACCOUNT_CONSEQUENCE_SCHEMA} from '../receiving-account-consequences.js';
import {independentBandGrid,independentBandCourse} from './receiving-band-fixtures.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),output=await mkdtemp(join(process.env.HAMON_BROWSER_TMPDIR||tmpdir(),'earth-receiver-consequences-'));
const checks=[],errors=[],httpFailures=[],requested=new Set(),sourceHashes={},hash=b=>createHash('sha256').update(b).digest('hex');
for(const path of ['receiving-account-consequences.js','receiving-account-consequences-panel.js','receiving-account-proposals-panel.js','draining-layer-study.js','draining-layer.css','core.js','draining-infiltration.js','tests/receiving-account-consequences.receiving.mjs'])sourceHashes[path]=hash(await readFile(join(root,path)));
const example=makeNoisyReceivingAccountBandExample(),options={mode:'bands',transferBasis:'Authored shared receiver and initial water in each selected garden cell across both source layouts; not measured material transfer.'};
const saveOriginal=async(name,e,o=options)=>{const p=join(output,name);await writeFile(p,serializeReceivingAccountConsequences(e.project,e.selection,e.account,o));return p;};
const originalFile=await saveOriginal('original-consequences.json',example);
let server,browser,sandbox,failure=null,serverClosed=false,baseUrl='';const serverLog=[];
const receipt={schema:'experimental-earth-receiving-consequences-browser/1',passed:false,checks,errors,httpFailures,sourceHashes,output,sourceKind:'Actual maintained consumer on authored originals, not field validation'};
try{
  server=spawn(process.env.PYTHON_BIN||'python3',[join(root,'serve.py'),'--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
  server.once('close',()=>serverClosed=true);server.stderr.on('data',b=>serverLog.push(b.toString()));
  baseUrl=await new Promise((resolve,reject)=>{let s='';const timer=setTimeout(()=>reject(Error('Maintained server not ready')),15000);server.once('error',e=>{clearTimeout(timer);reject(e);});server.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited before readiness'));});server.stdout.on('data',b=>{s+=b;const m=s.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0]);}});});
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,chromiumSandbox:true,args:['--allow-chrome-scheme-url','--disable-background-networking'],timeout:30000});
  let context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage();
  const observe=p=>{p.on('pageerror',e=>errors.push(String(e)));p.on('request',r=>requested.add(new URL(r.url()).pathname));p.on('response',r=>{if(r.url().startsWith(baseUrl)&&r.status()>=400)httpFailures.push({url:r.url(),status:r.status()});});};observe(page);
  const cdp=await context.newCDPSession(page);sandbox=await requireChromiumSandbox({send:(m,p)=>cdp.send(m,p)});assert.equal(sandbox.admitted,true);
  const show=async()=>{await page.goto(baseUrl,{waitUntil:'networkidle'});await page.locator('#rac-open').waitFor({state:'attached'});await page.locator('#rac-open').evaluate(input=>{for(let p=input.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});};
  const state=expected=>page.waitForFunction(s=>document.querySelector('#rac-status').dataset.state===s,expected);
  const open=async(path,expected)=>{await page.locator('#rac-open').setInputFiles(path);await state(expected);};
  const run=async expected=>{await page.locator('#rac-run').focus();await page.keyboard.press('Enter');await state(expected);};
  const models=()=>page.locator('#rac-results [data-consequence]').evaluateAll(rows=>rows.map(e=>({id:e.dataset.consequence,challenge:e.dataset.challenge,capacity:Number(e.dataset.capacity),initial:Number(e.dataset.initial),drainage:Number(e.dataset.drainage),surfaceChange:Number(e.dataset.surfaceChange),peakChange:Number(e.dataset.peakChange)})));
  const calRanges=()=>page.locator('#rac-ranges tbody tr').evaluateAll(rows=>rows.map(r=>[r.children[0].textContent,r.children[1].textContent]));
  await show();const active=await page.evaluate(()=>localStorage.getItem('experimental-earth-site-v1')),accountBefore=await page.locator('#ra-source').textContent();
  await page.locator('#rai-band-example').click();await page.locator('#rai-band-run').click();await page.waitForFunction(()=>document.querySelector('#rai-status').dataset.state==='several-surviving-proposals');
  const inverseBefore=await page.locator('#rai-band-results').textContent();
  await page.locator('#rac-current').click();await page.locator('#rac-basis').fill(options.transferBasis);await run('compared');
  const first=await models(),firstRanges=await calRanges();assert.equal(first.length,3);assert.ok(first.every(r=>r.challenge==='true'&&Math.abs(r.surfaceChange+72)<1e-8));
  assert.equal(await page.evaluate(()=>localStorage.getItem('experimental-earth-site-v1')),active);assert.equal(await page.locator('#ra-source').textContent(),accountBefore);assert.equal(await page.locator('#rai-band-results').textContent(),inverseBefore);assert.equal(await page.locator('#rai-status').getAttribute('data-state'),'several-surviving-proposals');
  assert.match(await page.locator('#rac-results').textContent(),/Initial water below ground/);assert.match(await page.locator('#rac-results').textContent(),/Positive differences mean/);
  for(const path of ['receiving-account-consequences.js','receiving-account-consequences-panel.js','draining-layer-study.js']){assert.ok(requested.has('/'+path));const response=await fetch(baseUrl+path);assert.equal(response.status,200);assert.equal(hash(Buffer.from(await response.arrayBuffer())),sourceHashes[path]);}
  checks.push('Actual explicit inverse-source handoff and keyboard comparison carry all three calibrated receivers into both original layouts, with initial-water accounting and unchanged active site');

  const download=page.waitForEvent('download');await page.locator('#rac-save').click();const savedPath=join(output,'downloaded-consequences.json');await(await download).saveAs(savedPath);
  const raw=JSON.parse(await readFile(savedPath,'utf8'));assert.equal(raw.schema,RECEIVING_ACCOUNT_CONSEQUENCE_SCHEMA);assert.deepEqual(Object.keys(raw).sort(),['schema','project','selection','account','options'].sort());assert.deepEqual(raw.account,example.account);
  await context.close();context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});page=await context.newPage();observe(page);await show();await open(savedPath,'compared');
  assert.deepEqual(await models(),first);assert.deepEqual(await calRanges(),firstRanges);assert.match(await page.locator('#rac-status').textContent(),/Recomputed from original inputs/);
  checks.push('Actual original-only download reopens on a fresh page to identical fitted parameters, evidence and paired consequences');

  await page.locator('#rac-mode').selectOption('central');await run('no-compatible-receivers');assert.equal(await page.locator('#rac-results [data-consequence]').count(),0);assert.equal(await page.locator('#rac-ranges').getAttribute('data-calibration-count'),'0');assert.match(await page.locator('#rac-ranges').textContent(),/No compatible models/);
  await page.locator('#rac-mode').selectOption('bands');await run('compared');assert.deepEqual(await models(),first);
  checks.push('The analytic-only incumbent visibly retains its original failure; the original-band union adds supported consequences without a default model');

  const wrong=structuredClone(example);wrong.account.readings.filter(r=>r.use==='challenge').forEach(r=>r.valueLiters=100000);wrong.project.observations.filter(r=>r.use==='challenge').forEach(r=>r.depthMm=500);
  await open(await saveOriginal('wrong-held.json',wrong),'challenged');assert.deepEqual((await models()).map(({challenge,...r})=>r),first.map(({challenge,...r})=>r));assert.deepEqual(await calRanges(),firstRanges);assert.equal(await page.locator('#rac-results [data-challenge="true"]').count(),0);assert.match(await page.locator('#rac-status').textContent(),/every member contradicts/);
  checks.push('Wrong held observations challenge every receiver while retaining the entire original calibration family and identical predicted changes');

  const contradiction=structuredClone(example);contradiction.account.readings.push({...contradiction.account.readings[0],id:'contradiction',valueLiters:contradiction.account.readings[0].valueLiters+10});
  await open(await saveOriginal('contradiction.json',contradiction),'no-compatible-receivers');assert.equal((await models()).length,0);
  const forged=join(output,'forged.json');await writeFile(forged,JSON.stringify({...raw,effects:{calibration:{count:1}}}));await open(forged,'refused');assert.match(await page.locator('#rac-status').textContent(),/saved parameters/);assert.equal(await page.locator('#rac-results').textContent(),'');assert.equal(await page.locator('#rac-save').isDisabled(),true);
  checks.push('Contradictory original calibration gives no consequence range and a forged saved effect cannot restore stale success');

  await open(originalFile,'compared');await page.locator('#rac-basis').fill('');await run('refused');assert.match(await page.locator('#rac-status').textContent(),/same receiver parameters/);
  const large=structuredClone(example);large.project.width=large.project.height=8;large.project.existing=Array.from({length:64},()=>structuredClone(large.project.existing[0]));large.project.proposal=Array.from({length:64},()=>structuredClone(large.project.proposal[0]));for(const r of large.account.readings){r.valueLiters*=16;r.uncertaintyLiters*=16;}for(const r of large.account.offers)r.uncertaintyLiters*=16;
  const over=join(output,'combined-budget.json');await writeFile(over,JSON.stringify({schema:RECEIVING_ACCOUNT_CONSEQUENCE_SCHEMA,...large,options}));await open(over,'refused');assert.match(await page.locator('#rac-status').textContent(),/complete inverse and every possible/);assert.equal(await page.locator('#rac-results').textContent(),'');
  checks.push('Missing transfer basis and a complete combined-work overflow refuse before publishing any family or partial consequence range');

  await open(originalFile,'compared');const copiedSource=await page.locator('#rac-source').textContent();await page.locator('#rai-example').click();assert.equal(await page.locator('#rac-source').textContent(),copiedSource);assert.deepEqual(await models(),first);
  const secondDownload=page.waitForEvent('download');await page.locator('#rac-save').click();const separate=join(output,'separate-after-parent-edit.json');await(await secondDownload).saveAs(separate);assert.deepEqual(JSON.parse(await readFile(separate,'utf8')).account,example.account);
  await page.locator('#rac-current').click();assert.equal(await page.locator('#rac-status').getAttribute('data-state'),'draft');assert.equal(await page.locator('#rac-results').textContent(),'');assert.equal(await page.locator('#rac-basis').inputValue(),'');
  checks.push('Later parent edits cannot retarget the separate comparison; explicit copying retires results and requires a new transfer declaration');

  await page.evaluate(()=>{const original=File.prototype.arrayBuffer;window.__releaseConsequences=null;File.prototype.arrayBuffer=function(){if(this.name==='delayed-consequences.json')return new Promise(resolve=>window.__releaseConsequences=async()=>resolve(await original.call(this)));return original.call(this);};});
  await page.locator('#rac-open').setInputFiles({name:'delayed-consequences.json',mimeType:'application/json',buffer:Buffer.from(await readFile(savedPath))});await page.waitForFunction(()=>document.querySelector('#rac-status').dataset.state==='opening'&&typeof window.__releaseConsequences==='function');
  await page.locator('#rac-example').click();const newer=await page.locator('#rac-source').textContent();await page.evaluate(async()=>window.__releaseConsequences());await page.waitForTimeout(40);assert.equal(await page.locator('#rac-source').textContent(),newer);assert.equal(await page.locator('#rac-status').getAttribute('data-state'),'draft');
  await page.evaluate(()=>{document.querySelector('#rac-run').click();document.querySelector('#rac-example').click();});await page.waitForTimeout(40);assert.equal(await page.locator('#rac-results').textContent(),'');assert.equal(await page.locator('#rac-save').isDisabled(),true);
  checks.push('A delayed original file and a queued complete-family comparison retire on newer intent without resurrecting parameters or effects');

  const eligible=independentBandGrid().find(c=>c.eligible),mixed=independentBandCourse({rainMmHr:eligible.project.weather.rainMmHr,capacityMm:eligible.truth.capacityMm,drainagePerHour:eligible.truth.drainagePerHour,fraction:eligible.truth.initialStoredMm/eligible.truth.capacityMm,stormMinutes:eligible.project.weather.stormMinutes,width:8,height:6,index:0});assert.equal(mixed.eligible,true);
  const expected=compareReceivingAccountConsequences(mixed.project,mixed.selection,mixed.account,options);await open(await saveOriginal('mixed48-original.json',mixed),expected.status);assert.equal((await models()).length,expected.candidates.length);assert.ok(expected.candidates.length>0);receipt.mixed48={status:expected.status,reservation:expected.reservation,counts:expected.counts,effects:expected.effects};
  checks.push('A previously qualified mixed48-cell original source reaches complete paired comparisons inside the combined reservation; no model family is truncated');

  await open(originalFile,'compared');await page.locator('#rac-results [data-consequence]').first().locator('summary').click();
  for(const [name,width,height]of [['desktop',1440,1000],['narrow',390,844]]){
    await page.setViewportSize({width,height});await page.locator('#receiving-account-consequences').scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    for(const id of ['rac-current','rac-mode','rac-basis','rac-run','rac-save','rac-open'])assert.equal(await page.locator('#'+id).isVisible(),true);
    await page.locator('#rac-ranges').scrollIntoViewIfNeeded();await page.screenshot({path:join(output,name+'.png')});
    if(name==='narrow'){const wrap=page.locator('#rac-ranges .rac-table');await wrap.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(200);assert.ok(await wrap.evaluate(e=>e.scrollLeft>0));}
  }
  assert.deepEqual(errors,[]);assert.deepEqual(httpFailures,[]);checks.push('Desktop and390px actual results remain usable without page overflow; wide numeric tables expose keyboard horizontal scrolling and all original controls');receipt.passed=true;
}catch(error){failure=error;receipt.failure=String(error.stack||error);}
finally{
  await browser?.close();if(server&&!serverClosed){server.kill('SIGTERM');await new Promise(resolve=>{if(serverClosed)return resolve();const timer=setTimeout(resolve,3000);server.once('close',()=>{clearTimeout(timer);resolve();});});}
  receipt.sandbox=sandbox;receipt.maintainedServer={baseUrl,closed:serverClosed};if(!serverClosed){receipt.passed=false;receipt.failure=receipt.failure||'Owned server exit not confirmed';}
  await writeFile(join(output,'server.log'),serverLog.join(''));await writeFile(join(output,'browser.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:receipt.passed,checks:checks.length,output,failure:receipt.failure||null}));
}
if(failure)throw failure;if(!receipt.passed)throw Error(receipt.failure);
