import {withBrowserSession} from './support/browser-session.mjs';
import {receiveObservationMap} from './observation-map.receiving.mjs';
import {mkdir, mkdtemp, readFile, readdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.env.OBSERVATION_MAP_RECEIPT_DIR
  ? resolve(process.env.OBSERVATION_MAP_RECEIPT_DIR)
  : await mkdtemp(join(tmpdir(), 'earth-observation-map-'));
await mkdir(output, {recursive: true});
const report = [], delay = ms => new Promise(r => setTimeout(r, ms));
const sourceFiles = (await readdir(root)).filter(p => /\.(js|css|html)$/.test(p));
sourceFiles.push('tests/observation-map.receiving.mjs', 'tests/observation-map.browser.mjs');
const sourceHashes = {};
for (const path of sourceFiles) {
  sourceHashes[path] = createHash('sha256').update(await readFile(join(root, path))).digest('hex');
}

await withBrowserSession({root, chromeBin: process.env.CHROME_BIN,
  runDirectory: join(output, 'browser-session')}, async session => {
  const {evaluate, send, exceptions} = session;
  await send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false});
  for (let i = 0; i < 100; i++) {
    if (await evaluate("!!document.querySelector('#evidence-map-grid button')")) break;
    await delay(50);
  }
  let failure = null;
  try { await receiveObservationMap({evaluate, send, delay, report}); }
  catch (error) { failure = error; }
  const project = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  if (project) await writeFile(join(output, 'project.json'), project + '\n');
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 500});
    await delay(80);
    const clip = await evaluate("(()=>{const r=document.querySelector('#observation-map').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
    const png = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true, clip});
    await writeFile(join(output, name + '.png'), Buffer.from(png.data, 'base64'));
  }
  const receipt = {passed: !failure && !exceptions.length, report, exceptions,
    sandboxAdmitted: session.sandbox.admitted, browser: session.sandbox.browser.product,
    executable: process.env.CHROME_BIN, sourceHashes, failure: failure ? String(failure.stack) : null};
  await writeFile(join(output, 'browser-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({passed: receipt.passed, output, checks: report.length}));
  if (failure) throw failure;
  if (exceptions.length) throw Error('Browser page exceptions');
});
