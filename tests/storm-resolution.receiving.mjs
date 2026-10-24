import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const chromeBin = process.env.CHROME_BIN ??
  (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/chromium');
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? root+'.browser-storm-resolution-'+randomUUID();
const checks=[];
await withBrowserSession({root,chromeBin,runDirectory},async({send,evaluate,exceptions})=>{
  await send('Runtime.enable');await send('Page.enable');
  for(let i=0;i<80;i++){
    if(await evaluate('document.querySelectorAll("#existing-grid .cell").length===48'))break;
    await delay(100);
  }
  assert.equal(await evaluate('document.querySelectorAll("#existing-grid .cell").length'),48);
  assert.equal(await evaluate('document.querySelector("#storm-resolution-run")!==null'),true);
  checks.push('actual site and numerical-resolution panel loaded');
  await evaluate('document.querySelector("#copy-existing").click();document.querySelector("[data-brush=lower]").click();document.querySelectorAll("#proposal-grid .cell")[1].click();document.querySelector("[data-brush=inspect]").click()');
  await evaluate('document.querySelector("#storm-intensity-rates").value="6,24,60,120";document.querySelector("#storm-intensity-rates").dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("#storm-intensity-form").requestSubmit()');
  for(let i=0;i<80;i++){
    if((await evaluate('document.querySelector("#storm-intensity-status").textContent')).includes('storms compared'))break;
    await delay(80);
  }
  assert.equal(await evaluate('document.querySelector("#storm-resolution-run").disabled'),false);
  await evaluate('document.querySelector("#storm-resolution-run").click()');
  for(let i=0;i<80;i++){
    if((await evaluate('document.querySelector("#storm-resolution-status").textContent')).includes('numerical steps checked'))break;
    await delay(80);
  }
  assert.match(await evaluate('document.querySelector("#storm-resolution-status").textContent'),/3 numerical steps checked/);
  assert.equal(await evaluate('document.querySelectorAll("#storm-resolution-results tbody tr").length'),16);
  const witness=await evaluate('(()=>{const rows=Array.from(document.querySelectorAll("#storm-resolution-results tbody tr"));const row=rows.find(tr=>tr.cells[0]?.textContent==="24"&&tr.cells[1]?.textContent.includes("Peak standing water"));return row?{state:row.dataset.direction,values:Array.from(row.cells).map(x=>x.textContent)}:null})()');
  assert.equal(witness?.state,'opposed',JSON.stringify(witness));
  assert.ok(witness.values.some(x=>x.includes('0.361')),JSON.stringify(witness));
  assert.ok(witness.values.some(x=>x.includes('-0.479')),JSON.stringify(witness));
  checks.push('actual 2.5-cm cell lowering reverses 24 mm/h peak standing water direction on finer step');
  await evaluate('document.querySelector("#storm-intensity-rates").value="12,36";document.querySelector("#storm-intensity-rates").dispatchEvent(new Event("input",{bubbles:true}))');
  assert.equal(await evaluate('document.querySelector("#storm-resolution-run").disabled'),true);
  assert.equal(await evaluate('document.querySelectorAll("#storm-resolution-results tbody tr").length'),0);
  checks.push('edited rates invalidate the cached numerical comparison');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await delay(180);
  const dims=await evaluate('({inner:innerWidth,scroll:document.documentElement.scrollWidth})');
  assert.ok(dims.scroll<=dims.inner+1,JSON.stringify(dims));
  assert.deepEqual(exceptions,[]);
  checks.push('390px receiving has no outer-page overflow or runtime exceptions');
});
console.log(JSON.stringify({passed:checks.length,checks},null,2));
