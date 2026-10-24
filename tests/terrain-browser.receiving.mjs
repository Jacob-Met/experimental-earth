import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const result = await withBrowserSession({ root, chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome',
  runDirectory: process.env.BROWSER_RUN_DIRECTORY ?? `/tmp/earth-terrain-${randomUUID()}` }, async ({send,evaluate,baseUrl,exceptions}) => {
  await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate',{url:baseUrl});
  for(let i=0;i<40;i++){await delay(100);if(await evaluate("document.querySelectorAll('#existing-grid .cell').length")===48)break;}
  assert.equal(await evaluate("document.querySelectorAll('#existing-grid .cell').length"),48);
  const saved=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  const original=JSON.parse(saved);
  const csv='cell,elevation,uncertainty,unit,source\n'+Array.from({length:48},(_,i)=>`${String.fromCharCode(65+i%8)}${Math.floor(i/8)+1},${i},0.1,cm,Authored analytic fixture`).join('\n');
  const upload=async text=>{
    await evaluate(`(async()=>{document.querySelector('#terrain-datum').value='Fixture reference';document.querySelector('#terrain-spacing').value='2';const input=document.querySelector('#terrain-file');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(text)}],'terrain.csv',{type:'text/csv'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,150));})()`);
  };
  await upload(csv);
  assert.equal(await evaluate("document.querySelectorAll('#terrain-preview li').length"),48);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),saved,'preview must not mutate');
  await evaluate("document.querySelector('#apply-terrain').click()");
  let next=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  assert.ok(Math.abs(next.existing[47].elevationM-.47)<1e-12);assert.equal(next.existing[0].terrainSource.datum,'Fixture reference');assert.deepEqual(next.proposal,original.proposal);
  await send('Page.reload',{ignoreCache:true});await delay(350);
  next=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));assert.equal(next.existing[47].terrainSource.elevationValue,47);
  await evaluate("document.querySelector('#existing-grid .cell').click()");
  assert.match(await evaluate("document.querySelector('#terrain-origin').textContent"),/terrain.csv/);
  const checkpoint=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  await upload(csv.replace('A1,0,0.1,cm','A1,0,0.1,feet'));
  assert.match(await evaluate("document.querySelector('#terrain-status').textContent"),/refused/);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),checkpoint);
  await upload(csv);await evaluate("document.querySelector('#project-title').value='changed';document.querySelector('#project-title').dispatchEvent(new Event('change'))");
  assert.equal(await evaluate("document.querySelector('#apply-terrain').disabled"),true);
  await evaluate("document.querySelector('[data-brush=raise]').click();document.querySelector('#existing-grid .cell').click()");
  next=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));assert.equal(next.existing[0].terrainSource,undefined);assert.equal(next.existing[0].elevationM,.025);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(150);
  const dims=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(dims.scroll<=dims.width+1);
  assert.deepEqual(exceptions,[]);
  return {checks:['preview without mutation','normalized elevation application preserving other scenario','reload and visible supplied provenance','invalid-unit transactional refusal','changed-project stale preview rejection','height edit removes obsolete survey origin','390px layout'],dimensions:dims};
});
console.log(JSON.stringify({status:'PASS',...result},null,2));
