#!/usr/bin/env node
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from '../tests/support/browser-session.mjs';
import { receiveInfiltration } from '../tests/infiltration.receiving.mjs';
import { receivePlacements } from '../tests/placement.receiving.mjs';

const root = resolve(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url)));
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? join(root, '.browser-rain-static-' + randomUUID());
const report = [];
try {
  const result = await withBrowserSession({root, chromeBin: process.env.CHROME_BIN ?? '/usr/bin/google-chrome-stable', runDirectory}, async session => {
    const {send, evaluate, exceptions} = session;
    const ready = async () => {
      for (let i = 0; i < 100; i++) {
        if (await evaluate("document.querySelectorAll('#existing-grid .cell').length") === 48) return;
        await delay(50);
      }
      throw Error('Maintained courtyard did not render');
    };
    await send('Runtime.enable'); await send('Page.enable'); await ready();
    await evaluate('localStorage.clear()'); await send('Page.reload', {ignoreCache:true}); await ready();
    assert.equal(await evaluate("document.querySelectorAll('.metric').length"), 6);
    assert.equal(await evaluate("document.querySelectorAll('#chart path').length"), 2);
    const metrics = () => evaluate("Array.from(document.querySelectorAll('.metric'),e=>e.textContent)");
    const originalMetrics = await metrics();
    await evaluate("document.querySelector('[data-brush=garden]').click();document.querySelector('#proposal-grid .cell').click()");
    assert.equal(await evaluate("document.querySelector('#proposal-grid .cell').getAttribute('aria-label').includes('Rain garden')"), true);
    const saved = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
    await evaluate("document.querySelector('#rain').value='71';document.querySelector('#rain').dispatchEvent(new Event('change',{bubbles:true}))");
    assert.notDeepEqual(await metrics(), originalMetrics, 'changed original rain must reach actual displayed metrics');
    const changed = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
    assert.equal(JSON.parse(changed).weather.rainMmHr, 71);
    await send('Page.reload', {ignoreCache:true}); await ready();
    assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), changed);
    await evaluate(`(async()=>{const input=document.querySelector('#import');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(saved)}],'original-project.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,150));})()`);
    assert.equal(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).weather.rainMmHr, 36);
    report.push('maintained map/charts, edit, changed weather, reload and original-file reopen');
    await receiveInfiltration({evaluate, send, delay, report, artifactDirectory:session.runDirectory});
    await receivePlacements({evaluate, send, delay, report, artifactDirectory:session.runDirectory});
    await send('Emulation.setDeviceMetricsOverride', {width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate('scrollTo(0,0)'); await delay(100);
    const shot = await send('Page.captureScreenshot', {format:'png',captureBeyondViewport:false});
    writeFileSync(join(session.runDirectory, 'rain-static-desktop.png'), Buffer.from(shot.data, 'base64'));
    assert.deepEqual(exceptions, []);
    const raw = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
    return {checks:report,exceptions,sandbox:session.sandbox,finalSourceSha256:createHash('sha256').update(raw).digest('hex')};
  });
  console.log(JSON.stringify({status:'pass',servedRoot:root,...result.value,session:result.receipt},null,2));
} catch(error) {console.error(JSON.stringify({status:'fail',error:String(error),cause:error.cause?String(error.cause):null,checks:report,receipt:error.receipt??null},null,2));process.exitCode=1;}
