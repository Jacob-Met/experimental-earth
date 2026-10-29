import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
import {makeReceivingAccountExample,serializeReceivingAccounts} from '../receiving-account-evidence.js';
import {makeReceivingAccountProposalExample,makePostDryDrainageAccountProposalExample,serializeReceivingAccountProposals,parseReceivingAccountProposals} from '../receiving-account-proposals.js';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),output=await mkdtemp(join(process.env.HAMON_BROWSER_TMPDIR||tmpdir(),'earth-receiver-inverse-'));
const checks=[],errors=[],httpFailures=[],sourceHashes={},sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const path of ['receiving-account-inverse.js','post-dry-receiving-inverse.js','receiving-account-proposals.js','receiving-account-proposals-panel.js','receiving-account-evidence.js','receiving-account-panel.js','draining-evidence-panel.js','draining-layer.css','draining-infiltration.js','core.js','serve.py','tests/receiving-account-proposals.receiving.mjs'])sourceHashes[path]=sha256(await readFile(join(root,path)));
const wet=makeReceivingAccountProposalExample(),drained=makePostDryDrainageAccountProposalExample(),parent=makeReceivingAccountExample();
const writeOriginal=async(name,input)=>{const path=join(output,name);await writeFile(path,serializeReceivingAccountProposals(input.project,input.selection,input.account));return path;};
const drainFile=await writeOriginal('drainage-original.json',drained),parentFile=join(output,'parent-original.json');
await writeFile(parentFile,serializeReceivingAccounts(wet.project,parent.study,wet.account));
let server,browser,sandbox,failure=null,serverClosed=false,baseUrl='';const serverLog=[];
const receipt={schema:'experimental-earth-receiving-inverse-browser/1',passed:false,checks,errors,httpFailures,sourceHashes,output,sourceKind:'Authored controls in the maintained consumer; not field validation'};
try{
  server=spawn(process.env.PYTHON_BIN||'python3',[join(root,'serve.py'),'--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
  server.once('close',()=>{serverClosed=true;});server.stderr.on('data',bytes=>serverLog.push(bytes.toString()));
  baseUrl=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Maintained server did not become ready')),15000);
    server.once('error',error=>{clearTimeout(timer);reject(error);});server.once('exit',()=>{clearTimeout(timer);reject(Error('Maintained server exited before readiness'));});
    server.stdout.on('data',bytes=>{text+=bytes.toString();const match=text.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match){clearTimeout(timer);resolve(match[0]);}});
  });
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,chromiumSandbox:true,args:['--allow-chrome-scheme-url','--disable-background-networking'],timeout:30000});
  let context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage();
  const requested=new Set();
  const observe=p=>{p.on('pageerror',error=>errors.push(String(error)));p.on('request',r=>requested.add(new URL(r.url()).pathname));p.on('response',r=>{if(r.url().startsWith(baseUrl)&&r.status()>=400)httpFailures.push({url:r.url(),status:r.status()});});};observe(page);
  const cdp=await context.newCDPSession(page);sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)});assert.equal(sandbox.admitted,true);
  const show=async()=>{await page.goto(baseUrl,{waitUntil:'networkidle'});await page.locator('#rai-open').waitFor({state:'attached'});await page.locator('#rai-open').evaluate(input=>{let parent=input.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}});};
  const run=async expected=>{await page.locator('#rai-run').focus();await page.keyboard.press('Enter');await page.waitForFunction(state=>document.querySelector('#rai-status').dataset.state===state,expected);};
  const open=async(path,expected)=>{await page.locator('#rai-open').setInputFiles(path);await page.waitForFunction(state=>document.querySelector('#rai-status').dataset.state===state,expected);};
  const candidates=()=>page.locator('#rai-results [data-hypothesis]').evaluateAll(rows=>rows.map(r=>({id:r.dataset.hypothesis,calibration:r.dataset.calibration,challenge:r.dataset.challenge,capacity:Number(r.dataset.capacity),initial:Number(r.dataset.initial),drainage:Number(r.dataset.drainage)})));
  await show();const activeProject=await page.evaluate(()=>localStorage.getItem('experimental-earth-site-v1')),parentBefore=await page.locator('#ra-source').textContent();
  await page.locator('#rai-example').click();await run('one-surviving-proposal');
  let rows=await candidates();assert.equal(rows.length,2);const correct=rows.find(r=>r.calibration==='true'&&r.challenge==='true');assert.ok(correct);assert.ok(Math.abs(correct.capacity-7.3)<1e-8);assert.ok(Math.abs(correct.initial-3)<1e-8);assert.ok(Math.abs(correct.drainage-.63)<1e-8);
  assert.equal(await page.locator('#ra-source').textContent(),parentBefore);assert.equal(await page.evaluate(()=>localStorage.getItem('experimental-earth-site-v1')),activeProject);
  for(const path of ['receiving-account-inverse.js','post-dry-receiving-inverse.js','receiving-account-proposals.js','receiving-account-proposals-panel.js','receiving-account-evidence.js','receiving-account-panel.js','draining-layer.css']){assert.ok(requested.has('/'+path));const response=await fetch(baseUrl+path);assert.equal(response.status,200);assert.equal(sha256(Buffer.from(await response.arrayBuffer())),sourceHashes[path]);}
  checks.push('Actual maintained consumer loads exact modules; keyboard inference recovers storage, initial water and drainage without changing the active project or parent source');

  await page.locator('#rai-late-example').click();await run('several-surviving-proposals');
  rows=await candidates();const compatible=rows.filter(r=>r.calibration==='true'&&r.challenge==='true');assert.equal(compatible.length,2);
  assert.equal(await page.locator('#rai-question [data-best]').getAttribute('data-best'),'drained-360');
  await page.locator('#rai-inspect').selectOption('retained-360');assert.match(await page.locator('#rai-inspect').inputValue(),/retained/);
  assert.match(await page.locator('#rai-offer-detail').textContent(),/6\.?[\d,]* L|modeled/);
  await page.locator('#rai-inspect').selectOption('drained-360');await page.locator('#rai-offer-detail details').evaluate(details=>{details.open=true;});await page.waitForFunction(()=>document.querySelector('#rai-offer-detail').textContent.includes('combined numerical guard'));
  assert.match(await page.locator('#rai-offer-detail').textContent(),/separated; gap 49\.916/);
  checks.push('Late retained-water ambiguity remains visible; the actual offer selector exposes the separated drainage pair and its numerical guard');

  await page.locator('#rai-drain-example').click();await run('one-surviving-proposal');
  const drainRows=await candidates(),drainQuestion=await page.locator('#rai-question').textContent();
  assert.equal(drainRows.length,5);assert.equal(drainRows.filter(r=>r.calibration==='true').length,1);
  const survivor=page.locator('#rai-results [data-calibration="true"]');await survivor.locator('details').evaluate(details=>{details.open=true;});
  await page.waitForFunction(()=>document.querySelector('#rai-results [data-calibration="true"]').textContent.includes('Derived course, not additional observations'));
  assert.equal(await survivor.locator('[data-reading]').count(),4);assert.match(await survivor.textContent(),/drained-240.*drained-300.*drained-420.*retained-held-540/s);
  assert.match(await survivor.textContent(),/Only the original drainage rows supply evidence/);
  checks.push('Unequal-time drainage inference uses all three original calibration totals; derived inventories are labeled separately and the rejected capacity branch stays visible');

  const downloadPromise=page.waitForEvent('download');await page.locator('#rai-save').click();const download=await downloadPromise,savedPath=join(output,'saved-original.json');await download.saveAs(savedPath);
  const raw=JSON.parse(await readFile(savedPath,'utf8'));assert.deepEqual(Object.keys(raw),['schema','project','selection','account']);
  const parsed=parseReceivingAccountProposals(JSON.stringify(raw));assert.deepEqual(parsed.project,drained.project);assert.deepEqual(parsed.account,drained.account);
  await context.close();context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});page=await context.newPage();observe(page);await show();
  const reopenedActive=await page.evaluate(()=>localStorage.getItem('experimental-earth-site-v1'));await open(savedPath,'one-surviving-proposal');
  assert.deepEqual(await candidates(),drainRows);assert.equal(await page.locator('#rai-question').textContent(),drainQuestion);assert.equal(await page.evaluate(()=>localStorage.getItem('experimental-earth-site-v1')),reopenedActive);
  checks.push('Actual original-input download reopens in a fresh browser context and recomputes the same proposal without adopting it');

  const wrongHeld=structuredClone(drained);wrongHeld.account.readings.at(-1).valueLiters=100;await open(await writeOriginal('wrong-held.json',wrongHeld),'challenged');
  const challenged=await candidates();assert.deepEqual(challenged.map(({challenge,...row})=>row),drainRows.map(({challenge,...row})=>row));assert.equal(challenged.filter(r=>r.calibration==='true'&&r.challenge==='true').length,0);
  assert.equal(await page.locator('#rai-question').textContent(),drainQuestion);
  checks.push('A wrong original held value challenges the accepted family without changing its parameters, calibration support or question');

  const contradiction=structuredClone(drained);contradiction.account.readings.push({...contradiction.account.readings[0],id:'independent-contradiction',valueLiters:contradiction.account.readings[0].valueLiters+100});
  await open(await writeOriginal('contradiction.json',contradiction),'no-compatible-proposal');assert.equal(await page.locator('#rai-results [data-calibration="true"]').count(),0);assert.equal(await page.locator('#rai-question [data-best]').count(),0);
  const forgedPath=join(output,'forged.json');await writeFile(forgedPath,JSON.stringify({...raw,result:{status:'one-surviving-proposal'}}));await open(forgedPath,'refused');
  assert.match(await page.locator('#rai-status').textContent(),/saved conclusions/);assert.equal(await page.locator('#rai-results').textContent(),'');assert.equal(await page.locator('#rai-save').isDisabled(),true);
  await page.locator('#rai-example').click();await page.locator('#rai-basis').fill('');await run('refused');assert.match(await page.locator('#rai-status').textContent(),/uniform receiving layer/);
  checks.push('Contradictory original bands reject every model; forged saved conclusions and blank uniformity declarations cannot retain a stale successful result');

  await page.locator('#ra-open').setInputFiles(parentFile);await page.waitForFunction(()=>document.querySelector('#ra-status').textContent.startsWith('Recomputed from original inputs.'));
  await page.locator('#rai-current').click();assert.equal(await page.locator('#rai-basis').inputValue(),'');assert.equal(await page.locator('#rai-save').isDisabled(),true);
  await page.locator('#rai-basis').fill(wet.selection.uniformReceiverBasis);await run('one-surviving-proposal');
  const copiedResult=await page.locator('#rai-results').textContent(),copiedSource=await page.locator('#rai-source').textContent();
  await page.locator('#ra-readings fieldset').first().locator('[data-field="valueLiters"]').fill('100');
  assert.equal(await page.locator('#rai-results').textContent(),copiedResult);assert.equal(await page.locator('#rai-source').textContent(),copiedSource);
  const copiedDownload=page.waitForEvent('download');await page.locator('#rai-save').click();const copied=await copiedDownload,copiedPath=join(output,'copied-source.json');await copied.saveAs(copiedPath);
  assert.deepEqual(JSON.parse(await readFile(copiedPath,'utf8')).account,wet.account);
  checks.push('Explicit account handoff copies original measurements without offered parameters; later parent edits cannot retarget the independent inverse or its saved source');

  await page.evaluate(()=>{const native=File.prototype.arrayBuffer;window.__releaseInverseRead=null;File.prototype.arrayBuffer=function(){if(this.name==='late-original.json')return new Promise(resolve=>{window.__releaseInverseRead=async()=>resolve(await native.call(this));});return native.call(this);};});
  await page.locator('#rai-open').setInputFiles({name:'late-original.json',mimeType:'application/json',buffer:Buffer.from(await readFile(savedPath))});
  await page.waitForFunction(()=>document.querySelector('#rai-status').dataset.state==='opening'&&typeof window.__releaseInverseRead==='function');
  await page.locator('#rai-example').click();const newerSource=await page.locator('#rai-source').textContent();
  await page.evaluate(async()=>{await window.__releaseInverseRead();});await page.waitForTimeout(50);
  assert.equal(await page.locator('#rai-source').textContent(),newerSource);assert.equal(await page.locator('#rai-status').getAttribute('data-state'),'draft');assert.equal(await page.locator('#rai-results').textContent(),'');assert.equal(await page.locator('#rai-save').isDisabled(),true);
  await page.evaluate(()=>{document.querySelector('#rai-form').requestSubmit();document.querySelector('#rai-drain-example').click();});await page.waitForTimeout(50);
  assert.equal(await page.locator('#rai-status').getAttribute('data-state'),'draft');assert.equal(await page.locator('#rai-results').textContent(),'');
  await open(savedPath,'one-surviving-proposal');
  checks.push('Delayed file reads and queued inference cannot overwrite a newer source action; reopening remains reusable');

  const overflow=structuredClone(drained);overflow.account.readings=Array.from({length:7},(_,i)=>({...drained.account.readings[0],id:'drain-'+i,minute:240+60*i,valueLiters:100+i}));
  await open(await writeOriginal('complete-overflow.json',overflow),'refused');assert.match(await page.locator('#rai-status').textContent(),/complete original wet and post-dry calibration family/);
  assert.equal(await page.locator('#rai-results').textContent(),'');assert.equal(await page.locator('#rai-save').isDisabled(),true);
  await open(drainFile,'one-surviving-proposal');
  checks.push('An over-budget complete source family refuses without displaying a prefix or previous success; a subsequent valid original account recomputes normally');

  for(const [name,width,height]of [['desktop',1440,1000],['narrow',390,844]]){
    await page.setViewportSize({width,height});await page.locator('#receiving-account-proposals').scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    for(const id of ['rai-current','rai-example','rai-late-example','rai-drain-example','rai-basis','rai-run','rai-save','rai-open','rai-inspect'])assert.equal(await page.locator('#'+id).isVisible(),true);
    await page.locator('#receiving-account-proposals').screenshot({path:join(output,name+'.png')});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(httpFailures,[]);
  checks.push('Actual controls and results remain usable at desktop and 390 px widths with no horizontal overflow, failed local resources or browser exceptions');receipt.passed=true;
}catch(error){failure=error;receipt.failure=String(error.stack||error);}
finally{
  await browser?.close();if(server&&!serverClosed){server.kill('SIGTERM');await new Promise(resolve=>{if(serverClosed)return resolve();const timer=setTimeout(resolve,3000);server.once('close',()=>{clearTimeout(timer);resolve();});});}
  receipt.sandbox=sandbox;receipt.maintainedServer={baseUrl,closed:serverClosed};if(!serverClosed){receipt.passed=false;receipt.failure=receipt.failure||'Owned server exit not confirmed';}
  await writeFile(join(output,'server.log'),serverLog.join(''));await writeFile(join(output,'browser.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:receipt.passed,checks:checks.length,output,failure:receipt.failure||null}));
}
if(failure)throw failure;if(!receipt.passed)throw Error(receipt.failure);

