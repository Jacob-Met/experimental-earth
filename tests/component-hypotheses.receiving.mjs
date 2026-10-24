import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const result = await withBrowserSession({ root,
  chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome',
  runDirectory: process.env.BROWSER_RUN_DIRECTORY ?? `/tmp/earth-component-hypotheses-${randomUUID()}`,
}, async ({ send, evaluate, baseUrl, exceptions, runDirectory }) => {
  await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate', { url: baseUrl });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  for (let i = 0; i < 40; i++) { await delay(100); if (await evaluate("!!document.querySelector('[data-component-mode]')")) break; }
  await evaluate(`(async () => {
    const p = JSON.parse(localStorage.getItem('experimental-earth-site-v1'));
    p.infiltrationStudy = { target: 'existing', surface: 'sealed', ratesMmHr: [1, 9] };
    const input = document.querySelector('#import'); const dt = new DataTransfer();
    dt.items.add(new File([JSON.stringify(p)], 'authored-component-control.json', {type: 'application/json'}));
    input.files = dt.files; input.dispatchEvent(new Event('change', {bubbles: true}));
    await new Promise(r => setTimeout(r, 150));
  })()`);
  const saved = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  await evaluate(`for (const i of [19,27,35]) document.querySelector('[data-component-cells] input[value="'+i+'"]').click();
    const mode = document.querySelector('[data-component-mode]'); mode.value='all'; mode.dispatchEvent(new Event('change'));
    document.querySelector('[data-component-run]').click()`);
  assert.match(await evaluate("document.querySelector('[data-component-results]').textContent"), /reverses/);
  assert.equal(await evaluate("document.querySelectorAll('[data-component-rate] option').length"), 2);
  const first = await evaluate("document.querySelector('[data-component-results] tbody tr').lastElementChild.textContent");
  assert.ok(first.startsWith('-'), first);
  await evaluate("document.querySelector('[data-component-rate]').focus()");
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  const second = await evaluate("document.querySelector('[data-component-results] tbody tr').lastElementChild.textContent");
  assert.ok(second.startsWith('+'), second);
  assert.equal(await evaluate("document.activeElement.matches('[data-component-rate]')"), true, 'rate inspection must retain keyboard focus after redrawing');
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 });
  assert.ok((await evaluate("document.querySelector('[data-component-results] tbody tr').lastElementChild.textContent")).startsWith('-'));
  assert.equal(await evaluate("document.activeElement.matches('[data-component-rate]')"), true);
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), saved);
  async function capturePanel(name) {
    const clip = await evaluate(`(async()=>{const p=document.querySelector('#proposal-components');p.scrollIntoView({behavior:'instant',block:'start'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=p.getBoundingClientRect();return {x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height,scale:1};})()`);
    writeFileSync(`${runDirectory}/${name}.png`, Buffer.from((await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:true, clip })).data, 'base64'));
  }
  await capturePanel('component-hypotheses-desktop');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await capturePanel('component-hypotheses-mobile');
  const dims = await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');
  assert.ok(dims.scroll <= dims.width + 1);
  await evaluate("{const mode=document.querySelector('[data-component-mode]');mode.value='calibration';mode.dispatchEvent(new Event('change'));document.querySelector('[data-component-run]').click()}");
  assert.match(await evaluate("document.querySelector('[data-component-status]').textContent"), /Assign calibration readings/);
  assert.equal(await evaluate("document.querySelector('[data-component-results]').children.length"), 0);
  const observed = JSON.parse(saved);
  observed.observations = [{cellIndex:27, minute:240, depthMm:27.122973789020786, uncertaintyMm:24,
    source:'Authored broad control, not field data', scenario:'existing', use:'calibration'},
  {cellIndex:27, minute:240, depthMm:27.122973789020786, uncertaintyMm:0.1,
    source:'Authored held-aside control, not physical independence', scenario:'existing', use:'challenge'}];
  async function load(project) {
    await evaluate(`(async()=>{const input=document.querySelector('#import'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(project))}],'observed-control.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,150));})()`);
  }
  const runMode = async mode => evaluate(`(()=>{const e=document.querySelector('[data-component-mode]');e.value=${JSON.stringify(mode)};e.dispatchEvent(new Event('change'));document.querySelector('[data-component-run]').click();})()`);
  await load(observed); await runMode('calibration');
  assert.equal(await evaluate("document.querySelectorAll('[data-component-rate] option').length"), 2);
  await runMode('surviving');
  assert.equal(await evaluate("document.querySelectorAll('[data-component-rate] option').length"), 1);
  assert.equal(await evaluate("document.querySelector('[data-component-rate] option').textContent"), '1 mm/h');
  observed.observations[1].depthMm = 4.585178206054172;
  await load(observed); await runMode('calibration');
  assert.equal(await evaluate("document.querySelectorAll('[data-component-rate] option').length"), 2);
  await runMode('surviving');
  assert.equal(await evaluate("document.querySelector('[data-component-rate] option').textContent"), '9 mm/h');
  observed.observations[1].depthMm = 100;
  await load(observed); await runMode('surviving');
  assert.match(await evaluate("document.querySelector('[data-component-status]').textContent"), /No hypotheses satisfy/);
  assert.equal(await evaluate("document.querySelector('[data-component-results]').children.length"), 0);
  assert.deepEqual(exceptions, []);
  return { checks: ['saved source hypotheses reused', 'interaction reversal visible', 'keyboard rate inspection changes four-case table',
    'no automatic rate adoption', 'missing calibration refuses without fallback', 'desktop and 390px result pixels/layout',
    'calibration and surviving modes use original source bands', 'changed holdout preserves calibration but changes survivors',
    'contradicted evidence has no fallback'], dimensions: dims };
});
console.log(JSON.stringify({ status: 'PASS', ...result }, null, 2));
