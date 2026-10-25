import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
import { requireChromiumSandbox } from './support/chromium-sandbox.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const result = await withBrowserSession({root, chromeBin:process.env.CHROME_BIN ?? '/opt/google/chrome/chrome',
  runDirectory:process.env.BROWSER_RUN_DIRECTORY ?? `/tmp/earth-factors-${randomUUID()}`},
async ({send,evaluate,baseUrl,exceptions,runDirectory}) => {
  const sandbox = await requireChromiumSandbox({send});
  assert.equal(sandbox.admitted,true);
  assert.equal(sandbox.observation.rows.layer1,'Namespace');
  for (const protection of ['pid','network','seccomp','adequate']) assert.equal(sandbox.observation.checks[protection],true);
  writeFileSync(`${runDirectory}/edges-ground-sandbox.json`,JSON.stringify(sandbox,null,2));
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:baseUrl});
  for(let i=0;i<40;i++){await delay(100);if(await evaluate("!!document.querySelector('[data-component-partition]')"))break;}
  const results = "document.querySelector('[data-component-results]')";
  const status = "document.querySelector('[data-component-status]').textContent";
  const run = () => evaluate("document.querySelector('[data-component-run]').click()");
  const key = async (name,code) => {for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:name,code:name,windowsVirtualKeyCode:code});};
  const choose = async (selector,value) => evaluate(`{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));}`);
  await evaluate(`document.querySelector('#copy-existing').click();
    document.querySelector('[data-brush="garden"]').click();document.querySelector('#proposal-grid [data-cell-index="27"]').click();
    document.querySelector('[data-brush="lower"]').click();document.querySelector('#proposal-grid [data-cell-index="27"]').click();document.querySelector('#proposal-grid [data-cell-index="27"]').click()`);
  assert.equal(await evaluate("document.querySelector('[data-component-run]').disabled"),true);
  await evaluate("document.querySelector('[data-component-partition]').focus()");await key('ArrowDown',40);await key('ArrowDown',40);
  assert.equal(await evaluate("document.querySelector('[data-component-partition]').value"),'edges-ground');
  assert.equal(await evaluate("document.querySelector('[data-component-run]').disabled"),true);
  const original=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  original.proposal[27].internalBarriers={east:{closed:true,source:'Authored wall'}};
  await evaluate(`(async()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(original))}],'edge-ground.json',{type:'application/json'}));const input=document.querySelector('#import');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,150));})()`);
  assert.equal(await evaluate("document.querySelector('[data-component-run]').disabled"),false);
  const saved=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  await run();
  assert.equal(await evaluate(`${results}.querySelectorAll('tbody tr').length`),5);
  assert.equal(await evaluate(`${results}.querySelectorAll('details p').length`),48);
  assert.match(await evaluate(`${results}.textContent`),/A \(internal edge owner cells\): D4/);
  assert.match(await evaluate(`${results}.textContent`),/B \(surface\/elevation edits\): D4/);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),saved);
  await evaluate(`document.querySelector('#study-target').value='existing';document.querySelector('#study-surface').value='sealed';document.querySelector('#study-rates').value='1, 9';document.querySelector('#infiltration-form').requestSubmit()`);
  assert.equal(await evaluate(`${results}.children.length`),0);
  const studied=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  await choose('[data-component-mode]','all');await run();
  assert.equal(await evaluate("document.querySelectorAll('[data-component-rate] option').length"),2);
  await evaluate("document.querySelector('[data-component-rate]').focus()");await key('ArrowDown',40);
  assert.equal(await evaluate("document.querySelector('[data-component-rate]').selectedIndex"),1);
  assert.equal(await evaluate("document.activeElement.matches('[data-component-rate]')"),true);
  await key('ArrowUp',38);
  assert.equal(await evaluate("document.querySelector('[data-component-rate]').selectedIndex"),0);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),studied);
  async function capture(name){
    for(let i=0;i<60;i++){if(await evaluate("!document.querySelector('#toast')?.classList.contains('show')"))break;await delay(100);}
    assert.equal(await evaluate("!document.querySelector('#toast')?.classList.contains('show')"),true,'transient notice must dismiss before pixel receiving');
    await delay(250);
    const clip=await evaluate(`(async()=>{const p=document.querySelector('#proposal-components');p.scrollIntoView({behavior:'instant',block:'start'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=p.getBoundingClientRect();return{x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height,scale:1};})()`);writeFileSync(`${runDirectory}/${name}.png`,Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip})).data,'base64'));}
  await capture('edges-ground-desktop');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await capture('edges-ground-mobile');
  const dimensions=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(dimensions.scroll<=dimensions.width+1);
  await choose('[data-component-mode]','calibration');await run();
  assert.match(await evaluate(status),/Assign calibration readings/);assert.equal(await evaluate(`${results}.children.length`),0);
  await send('Page.reload',{ignoreCache:true});await delay(350);
  assert.equal(await evaluate(`${results}.children.length`),0);
  await choose('[data-component-partition]','edges-ground');await run();
  assert.equal(await evaluate(`${results}.querySelectorAll('tbody tr').length`),5);
  await evaluate("document.querySelector('#copy-existing').click()");await choose('[data-component-partition]','edges-ground');
  assert.equal(await evaluate("document.querySelector('[data-component-run]').disabled"),true);
  assert.deepEqual(exceptions,[]);
  return {checks:['editor authors co-located surface and height changes','keyboard selects edge/ground factor mode','four-case site and local results identify overlapping D4 factors','source plans unchanged by comparison','saved study changes invalidate results','rate keyboard retains focus in factor mode','missing evidence refuses without fallback','desktop and mobile result pixels and layout','reopened source recomputes without stale results','missing edge factor refuses','identical plans refuse factor mode'],dimensions};
});
console.log(JSON.stringify({status:'PASS',...result},null,2));

