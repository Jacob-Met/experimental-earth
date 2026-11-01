// Actual offline Chromium receiving for the opt-in, original-snapshot field sheet.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {compare} from '../core.js';
import {parsePortableProject} from '../project-portability.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUTROOT=process.env.EARTH_PAIRED_REPORT_BROWSER_OUTPUT || os.tmpdir();
fs.mkdirSync(OUTROOT,{recursive:true});
const OUT=fs.mkdtempSync(path.join(OUTROOT,'earth-paired-html-browser-'));
const aBytes=fs.readFileSync(path.join(ROOT,'tests/fixtures/water-history-tradeoff.json'));
const aProject=JSON.parse(aBytes.toString('utf8'));
const bProject=structuredClone(aProject);
bProject.proposal=bProject.existing.map(v=>({...v}));
bProject.title='</script><img src=x onerror=alert(42)> literal, not markup';
const B=Buffer.from(JSON.stringify(bProject));
const AFile=path.join(OUT,'input-a.json'),BFile=path.join(OUT,'input-b.json');
fs.writeFileSync(AFile,aBytes);fs.writeFileSync(BFile,B);
function run(fileA,fileB,name){
  const target=path.join(OUT,name);
  const result=spawnSync(process.execPath,['compare-saved-water-histories.mjs',fileA,fileB,target,'--report'],
   {cwd:ROOT,encoding:'utf8',timeout:30000,maxBuffer:1000000});
  assert.equal(result.status,0,result.stderr);
  return path.join(target,'paired-water-report.html');
}
const mixed=run(AFile,BFile,'mixed');
const dry=run(AFile,AFile,'same');
const oracleA=compare(parsePortableProject(aBytes.toString('utf8')));
const oracleB=compare(parsePortableProject(B.toString('utf8')));
const serve=http.createServer((req,res)=>{
  if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const fp=req.url==='/mixed'?mixed:req.url==='/same'?dry:null;
  if(!fp){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
  res.end(fs.readFileSync(fp));
});
await new Promise(resolve=>serve.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+serve.address().port;
const browser=await chromium.launch({
  executablePath:process.env.CHROME_BIN || '/usr/bin/chromium-browser',
  headless:true, args:['--no-sandbox','--disable-dev-shm-usage']
});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[],offsite=[];
  page.on('pageerror',err=>errors.push(err.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
  page.on('request',req=>{if(!req.url().startsWith(origin+'/'))offsite.push(req.url())});
  await page.goto(origin+'/mixed',{waitUntil:'load'});
  await page.locator('#delta').waitFor();
  assert.equal(await page.locator('#count').textContent(),String(oracleA.existing.snapshots.length));
  assert.equal(await page.locator('#title-b').textContent(),bProject.title);
  assert.equal(await page.locator('img').count(),0);
  assert.equal(await page.locator('#minute').textContent(),String(oracleA.existing.snapshots[0].minute));
  assert.equal(await page.locator('#plot .curve').count(),3);
  assert.equal(await page.locator('#difference .diff-curve').count(),1);
  await page.screenshot({path:path.join(OUT,'desktop.png'),fullPage:true});
  const slider=page.locator('#sample');
  await slider.focus();await slider.press('ArrowRight');
  assert.equal(await page.locator('#minute').textContent(),String(oracleA.existing.snapshots[1].minute));
  assert.equal(await page.locator('#existing').textContent(),String(oracleA.existing.snapshots[1].storedLiters));
  const differenceBox=await page.locator('#difference').boundingBox();
  await page.locator('#difference').click({position:{x:differenceBox.width*((75+960)/2)/1000,y:differenceBox.height*0.5}});
  assert.equal(await page.locator('#minute').textContent(),String(oracleA.existing.snapshots[24].minute));
  assert.equal(await slider.evaluate(n=>document.activeElement===n),true);
  await page.locator('#difference').click({position:{
    x:differenceBox.width*(75+(960-75)*(2.5/240))/1000,y:differenceBox.height*0.5}});
  assert.equal(await page.locator('#minute').textContent(),'0','exact midpoint tie must choose earlier sample');
  await slider.press('End');
  const n=oracleA.existing.snapshots.length-1;
  assert.equal(await page.locator('#minute').textContent(),String(oracleA.existing.snapshots[n].minute));
  assert.equal(await page.locator('#both').textContent(),String(oracleA.proposal.snapshots[n].storedLiters)+' / '+String(oracleB.proposal.snapshots[n].storedLiters));
  assert.equal(await page.locator('#next').isDisabled(),true);
  await page.locator('#prev').click();
  assert.equal(await page.locator('#minute').textContent(),String(oracleA.existing.snapshots[n-1].minute));
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(OUT,'mobile.png'),fullPage:true});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=1,'Unexpected mobile horizontal overflow '+overflow);
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.interact').evaluate(n=>getComputedStyle(n).display),'none');
  assert.notEqual(await page.locator('.print-only').evaluate(n=>getComputedStyle(n).display),'none');
  assert.equal(await page.locator('footer').evaluate(n=>getComputedStyle(n).display),'none');
  const printPath=path.join(OUT,'paper.pdf');
  const printBytes=await page.pdf({path:printPath,printBackground:true,preferCSSPageSize:true});
  assert.equal(printBytes.subarray(0,5).toString(),'%PDF-');
  assert.ok(printBytes.length>10000);
  const pdfInfo=spawnSync('pdfinfo',[printPath],{encoding:'utf8',timeout:15000});
  if(!pdfInfo.error){
    assert.equal(pdfInfo.status,0,pdfInfo.stderr);
    assert.match(pdfInfo.stdout,/^Pages:\s*1$/m,'ordinary 49-sample A4 field sheet must fit on one page');
  }
  await page.emulateMedia({media:'screen'});
  await page.goto(origin+'/same',{waitUntil:'load'});
  assert.equal(await page.locator('#above').textContent(),'0');
  assert.equal(await page.locator('#below').textContent(),'0');
  assert.equal(await page.locator('#equal').textContent(),String(oracleA.existing.snapshots.length));
  assert.equal(await page.locator('#summary-heading').textContent(),'Two identical retained courses');
  assert.equal(await page.locator('#delta').textContent(),'0');
  assert.deepEqual(errors,[]);
  assert.deepEqual(offsite,[]);
  console.log(JSON.stringify({status:'passed',originalSamples:oracleA.existing.snapshots.length,desktop:'desktop.png',mobile:'mobile.png',overflow,consoleErrors:errors.length,offsiteRequests:offsite.length,keyboardAndButtons:true,originalSourceAndValueChecks:true,mobileLayout:true,printPaper:true,allZero:true}));
} finally {await browser.close();await new Promise(resolve=>serve.close(resolve));}
