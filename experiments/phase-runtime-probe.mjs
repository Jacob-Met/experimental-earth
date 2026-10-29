import {spawn} from 'node:child_process';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeUnfilledReceivingPhaseExample,fitReceivingAccountPhases} from '../receiving-account-phase-fit.js';
import {requireChromiumSandbox} from '../tests/support/chromium-sandbox.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),output=await mkdtemp(join(tmpdir(),'earth-phase-runtime-')),source=makeUnfilledReceivingPhaseExample();
const compact=r=>({status:r.status,calibration:r.compatibleIds.length,held:r.survivingIds.length,ratePoints:r.unfilled?.ratePoints,refusals:r.unfilled?.refusals});
const native=compact(fitReceivingAccountPhases(source.project,source.selection,source.account));
const server=spawn(process.env.PYTHON_BIN||'python3',[join(root,'serve.py'),'--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});let closed=false,browser;
server.once('close',()=>closed=true);server.stderr.on('data',()=>{});
try{
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('server start timeout')),15000);server.once('error',reject);server.stdout.on('data',b=>{out+=b;const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0]);}});});
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,chromiumSandbox:true,args:['--allow-chrome-scheme-url','--disable-background-networking']});
  const context=await browser.newContext(),page=await context.newPage(),cdp=await context.newCDPSession(page);const sandbox=await requireChromiumSandbox({send:(m,p)=>cdp.send(m,p)});
  await page.goto(url,{waitUntil:'networkidle'});
  const observed=await page.evaluate(async source=>{const m=await import('/receiving-account-phase-fit.js');const compact=r=>({status:r.status,calibration:r.compatibleIds.length,held:r.survivingIds.length,ratePoints:r.unfilled?.ratePoints,refusals:r.unfilled?.refusals});const factory=m.makeUnfilledReceivingPhaseExample();return {sameOriginals:JSON.stringify(factory)===JSON.stringify(source),factorySource:factory,fixedNativeOriginals:compact(m.fitReceivingAccountPhases(source.project,source.selection,source.account)),browserFactoryOriginals:compact(m.fitReceivingAccountPhases(factory.project,factory.selection,factory.account))};},source);
  await writeFile(join(output,'probe.json'),JSON.stringify({source,native,observed,sandbox},null,2)+'\n');console.log(JSON.stringify({output,native:{status:native.status,calibration:native.calibration,held:native.held},sameOriginals:observed.sameOriginals,browser:{status:observed.fixedNativeOriginals.status,calibration:observed.fixedNativeOriginals.calibration,held:observed.fixedNativeOriginals.held},nativeLastRate:native.ratePoints?.at(-1),browserLastRate:observed.fixedNativeOriginals.ratePoints?.at(-1)}));
}finally{await browser?.close();if(!closed){server.kill('SIGTERM');await new Promise(resolve=>{if(closed)return resolve();server.once('close',resolve);});}}
