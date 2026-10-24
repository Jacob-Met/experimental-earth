import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const chromeBin=process.env.CHROME_BIN??'/usr/bin/chromium';
const runDirectory=process.env.BROWSER_RUN_DIRECTORY??root+'.browser-storm-minimum-'+randomUUID();
const checks=[];
await withBrowserSession({root,chromeBin,runDirectory},async({send,evaluate,exceptions})=>{
  await send('Runtime.enable');await send('Page.enable');
  for(let i=0;i<80;i++){
    if(await evaluate('document.querySelectorAll("#existing-grid .cell").length===48'))break;
    await delay(100);
  }
  assert.equal(await evaluate('document.querySelectorAll("#existing-grid .cell").length'),48);
  assert.equal(await evaluate('document.querySelector("#storm-minimum-run").disabled'),true);
  checks.push('optional one-minute boundary is initially unavailable, preserving normal work');

  await evaluate('document.querySelector("#copy-existing").click();document.querySelector("[data-brush=raise]").click();document.querySelectorAll("#proposal-grid .cell")[35].click();document.querySelector("[data-brush=inspect]").click()');
  await evaluate('document.querySelector("#storm-intensity-rates").value="6,24,60,120";document.querySelector("#storm-intensity-rates").dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("#storm-intensity-form").requestSubmit()');
  for(let i=0;i<80;i++){
    if((await evaluate('document.querySelector("#storm-intensity-status").textContent')).includes('storms compared'))break;
    await delay(80);
  }
  await evaluate('document.querySelector("#storm-resolution-run").click()');
  for(let i=0;i<80;i++){
    if((await evaluate('document.querySelector("#storm-resolution-status").textContent')).includes('numerical steps checked'))break;
    await delay(80);
  }
  assert.match(await evaluate('document.querySelector("#storm-resolution-status").textContent'),/3 numerical steps checked/);
  const before=await evaluate('(()=>{const a=[...document.querySelectorAll("#storm-resolution-results tbody tr")];const r=a.find(x=>x.cells[0]?.textContent==="24"&&x.cells[1]?.textContent.includes("Final standing water"));return r?{state:r.dataset.direction,cells:[...r.cells].map(c=>c.textContent)}:null})()');
  assert.equal(before?.state,'consistent',JSON.stringify(before));
  assert.ok(before.cells.some(x=>x.includes('0.156548')),JSON.stringify(before));
  assert.equal(await evaluate('document.querySelector("#storm-minimum-run").disabled'),false);
  checks.push('ordinary 5/2.5/1.25-minute report leaves hidden boundary reversal unresolved');

  await evaluate('document.querySelector("#storm-minimum-run").click()');
  for(let i=0;i<80;i++){
    if((await evaluate('document.querySelector("#storm-minimum-status").textContent')).includes('now included'))break;
    await delay(80);
  }
  assert.match(await evaluate('document.querySelector("#storm-resolution-status").textContent'),/4 numerical steps checked/);
  const after=await evaluate('(()=>{const a=[...document.querySelectorAll("#storm-resolution-results tbody tr")];const r=a.find(x=>x.cells[0]?.textContent==="24"&&x.cells[1]?.textContent.includes("Final standing water"));return r?{state:r.dataset.direction,cells:[...r.cells].map(c=>c.textContent)}:null})()');
  assert.equal(after?.state,'opposed',JSON.stringify(after));
  assert.ok(after.cells.some(x=>x.includes('-0.076449')),JSON.stringify(after));
  assert.equal(await evaluate('document.querySelector("#storm-minimum-run").disabled'),true);
  checks.push('extra 1-minute boundary reveals withheld sign reversal without changing project evidence');

  await evaluate('document.querySelector("#storm-intensity-rates").value="12,36";document.querySelector("#storm-intensity-rates").dispatchEvent(new Event("input",{bubbles:true}))');
  assert.equal(await evaluate('document.querySelector("#storm-minimum-run").disabled'),true);
  assert.equal(await evaluate('document.querySelectorAll("#storm-resolution-results tbody tr").length'),0);
  checks.push('rate edits invalidate both the baseline and minimum-boundary result');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await delay(180);
  const dims=await evaluate('({inner:innerWidth,scroll:document.documentElement.scrollWidth})');
  assert.ok(dims.scroll<=dims.inner+1,JSON.stringify(dims));
  assert.deepEqual(exceptions,[]);
  checks.push('390px layout has no outer overflow or browser exceptions');
});
console.log(JSON.stringify({passed:checks.length,checks},null,2));
