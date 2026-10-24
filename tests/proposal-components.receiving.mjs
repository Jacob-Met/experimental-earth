import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const result = await withBrowserSession({ root,
  chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome',
  runDirectory: process.env.BROWSER_RUN_DIRECTORY ?? `/tmp/earth-components-${randomUUID()}`,
}, async ({ send, evaluate, baseUrl, exceptions, runDirectory }) => {
  await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate', { url: baseUrl });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  for (let i = 0; i < 40; i++) { await delay(100); if (await evaluate("!!document.querySelector('[data-component-run]')")) break; }
  assert.equal(await evaluate("document.querySelectorAll('[data-component-cells] input').length"), 6);
  const saved = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  await evaluate("document.querySelector('[data-component-run]').click()");
  assert.match(await evaluate("document.querySelector('[data-component-status]').textContent"), /Select distinct edited/);
  await evaluate("document.querySelector('[data-component-cells] input').focus()");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  assert.equal(await evaluate("document.querySelector('[data-component-cells] input').checked"), true);
  await evaluate("document.querySelector('[data-component-run]').click()");
  assert.equal(await evaluate("document.querySelectorAll('[data-component-results] tbody tr').length"), 5);
  assert.equal(await evaluate("document.querySelectorAll('[data-component-results] details p').length"), 48);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), saved);
  assert.match(await evaluate("document.querySelector('[data-component-status]').textContent"), /Four combinations computed/);
  async function capturePanel(filename) {
    const clip = await evaluate(`(async () => {
      const panel = document.querySelector('#proposal-components');
      panel.scrollIntoView({behavior: 'instant', block: 'start'});
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const r = panel.getBoundingClientRect();
      return {x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, scale: 1};
    })()`);
    assert.ok(clip.width > 200 && clip.height > 300, JSON.stringify(clip));
    writeFileSync(`${runDirectory}/${filename}`, Buffer.from((await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true, clip,
    })).data, 'base64'));
  }
  await capturePanel('components-desktop.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(100);
  const dims = await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');
  assert.ok(dims.scroll <= dims.width + 1, JSON.stringify(dims));
  await capturePanel('components-mobile.png');
  await evaluate("document.querySelector('.component-table-wrap').focus()");
  assert.equal(await evaluate("document.activeElement.className"), 'component-table-wrap');
  assert.equal(await evaluate("document.querySelector('.component-table-wrap').scrollLeft"), 0);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await delay(250);
  assert.ok(await evaluate("document.querySelector('.component-table-wrap').scrollLeft > 0"), 'focused comparison region must scroll with ArrowRight');
  await evaluate("document.querySelector('#rain').value='40'; document.querySelector('#rain').dispatchEvent(new Event('change'))");
  assert.equal(await evaluate("document.querySelector('[data-component-results]').children.length"), 0);
  await evaluate("document.querySelector('[data-component-run]').click()");
  assert.equal(await evaluate("document.querySelectorAll('[data-component-results] tbody tr').length"), 5);
  await send('Page.reload', { ignoreCache: true }); await delay(350);
  assert.equal(await evaluate("document.querySelector('[data-component-results]').children.length"), 0);
  assert.equal(await evaluate("document.querySelectorAll('[data-component-cells] input').length"), 6);
  await evaluate("document.querySelector('#copy-existing').click()");
  assert.equal(await evaluate("document.querySelector('[data-component-run]').disabled"), true);
  await evaluate(`(async () => {
    const weather = JSON.parse(localStorage.getItem('experimental-earth-site-v1')).weather;
    Object.assign(weather, {rainMmHr:30, stormMinutes:60, durationMinutes:60,
      stepMinutes:5, mobilityPerHour:0.5, boundaryExitPerHour:0, cellSizeM:1});
    const existing = [0.04,-0.02,0.02,-0.04].map(elevationM => ({elevationM, surface:'sealed', provenance:'authored crest control'}));
    const proposal = structuredClone(existing);
    proposal[0].internalBarriers = {east:{crestElevationM:0.06, source:'authored upper crest'}};
    proposal[2].internalBarriers = {east:{crestElevationM:0.04, source:'authored lower crest'}};
    const p = {schema:'experimental-earth-site/1', title:'Crest-only control', width:2, height:2,
      weather, existing, proposal, observations:[], selectedIndex:0, source:'authored, not field data'};
    const input=document.querySelector('#import'), dt=new DataTransfer();
    dt.items.add(new File([JSON.stringify(p)],'crest-components.json',{type:'application/json'}));
    input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,150));
  })()`);
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('[data-component-cells] input')).map(e=>Number(e.value))"), [0, 2]);
  await evaluate("document.querySelector('[data-component-cells] input').click();document.querySelector('[data-component-run]').click()");
  assert.equal(await evaluate("document.querySelectorAll('[data-component-results] details p').length"), 4);
  assert.match(await evaluate("document.querySelector('[data-component-status]').textContent"), /Four combinations computed/);
  assert.deepEqual(exceptions, []);
  return { checks: ['keyboard Space selects edited cell', 'invalid empty subset', 'four-case metric and all-cell results',
    'no saved input mutation', 'desktop and 390px results', 'weather invalidation and recomputation',
    'reopened project has no stale derived result', 'identical plans refuse partition',
    'focused table region scrolls with keyboard ArrowRight', 'crest-only proposal import and canonical component partition'], dimensions: dims };
});
console.log(JSON.stringify({ status: 'PASS', ...result }, null, 2));
