import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const chromeBin = process.env.CHROME_BIN ??
  (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/chromium');
const directory = process.env.BROWSER_RUN_DIRECTORY ?? root + '.browser-storm-' + randomUUID();
const cases = [];

await withBrowserSession({root, chromeBin, runDirectory:directory}, async ({send,evaluate,exceptions}) => {
  await send('Runtime.enable');
  await send('Page.enable');
  for(let n=0;n<30;n++){
    if(await evaluate('document.querySelector("#storm-intensity-form") !== null'))break;
    await delay(120);
  }
  assert.equal(await evaluate('document.querySelector("#storm-intensity-form") !== null'),true);
  assert.equal(await evaluate('document.querySelector("#existing-grid .cell") !== null'),true);
  assert.deepEqual(exceptions,[]);
  cases.push('maintained app actually mounts storm-range panel with original site');

  const initial = await evaluate('localStorage.getItem("experimental-earth-site-v1")');
  await evaluate('document.querySelector("#storm-intensity-form").requestSubmit()');
  for (let n=0;n<30;n++) {
    if ((await evaluate('document.querySelector("#storm-intensity-status").textContent')).includes('storms compared'))break;
    await delay(100);
  }
  const status = await evaluate('document.querySelector("#storm-intensity-status").textContent');
  assert.match(status,/3 hypothetical storms compared/);
  assert.equal(await evaluate('document.querySelectorAll("#storm-intensity-results tbody tr").length'),3);
  assert.equal(await evaluate('document.querySelectorAll("#storm-intensity-results ul li").length'),4);
  assert.equal(await evaluate('localStorage.getItem("experimental-earth-site-v1")'), initial);
  cases.push('real browser compares three storms with four sign summaries and no stored-state mutation');

  await evaluate('document.querySelector("#rain").value="50"; document.querySelector("#rain").dispatchEvent(new Event("change",{bubbles:true}));');
  assert.equal(await evaluate('document.querySelectorAll("#storm-intensity-results tbody tr").length'),0);
  assert.match(await evaluate('document.querySelector("#storm-intensity-status").textContent'),/changed/);
  cases.push('site/weather changed-input invalidates previous conclusion');

  await evaluate('document.querySelector("#storm-intensity-rates").value="36, 36"; document.querySelector("#storm-intensity-form").requestSubmit()');
  for(let n=0;n<30;n++){
    if((await evaluate('document.querySelector("#storm-intensity-status").textContent')).includes('Comparison refused'))break;
    await delay(80);
  }
  assert.match(await evaluate('document.querySelector("#storm-intensity-status").textContent'),/Comparison refused/);
  assert.equal(await evaluate('document.querySelectorAll("#storm-intensity-results tbody tr").length'),0);
  cases.push('duplicate rate refuses without stale results');

  await evaluate('document.querySelector("#storm-intensity-rates").value="0, 50, 200"; document.querySelector("#storm-intensity-form").requestSubmit()');
  for(let n=0;n<30;n++){
    if((await evaluate('document.querySelector("#storm-intensity-status").textContent')).includes('storms compared'))break;
    await delay(80);
  }
  assert.equal(await evaluate('document.querySelectorAll("#storm-intensity-results tbody tr").length'),3);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await delay(180);
  const dimensions = await evaluate('({viewport:innerWidth, scroll:document.documentElement.scrollWidth, tableRows:document.querySelectorAll("#storm-intensity-results tbody tr").length})');
  assert.ok(dimensions.scroll <= dimensions.viewport+1, JSON.stringify(dimensions));
  assert.equal(dimensions.tableRows,3);
  assert.deepEqual(exceptions,[]);
  cases.push('390-pixel viewport keeps wide comparison internally scrollable and no JS exceptions');
});
console.log(JSON.stringify({passed:cases.length,cases},null,2));
