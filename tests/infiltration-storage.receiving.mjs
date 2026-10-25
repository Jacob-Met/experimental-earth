import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? '/tmp/earth-storage-receive-' + randomUUID();
const report = [];
await withBrowserSession({root, chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome', runDirectory}, async session => {
  const {send, evaluate} = session;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
  await send('Page.reload', {ignoreCache: true});
  async function wait(expression, label) {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(50); }
    throw Error('Timed out: ' + label);
  }
  const state = value => "document.querySelector('#is-status')?.dataset.state===" + JSON.stringify(value);
  const metric = (side, kind, key) => evaluate("Number(document.querySelector('#is-results td[data-side=\"" + side + "\"][data-kind=\"" + kind + "\"][data-metric=\"" + key + "\"]').dataset.value)");
  async function runExample() {
    await evaluate("document.getElementById('is-example').click();document.getElementById('is-form').requestSubmit()");
    await wait(state('computed'), 'example comparison');
  }
  async function openFile(path) {
    const doc = await send('DOM.getDocument');
    const element = await send('DOM.querySelector', {nodeId: doc.root.nodeId, selector: '#is-open'});
    await send('DOM.setFileInputFiles', {nodeId: element.nodeId, files: [path]});
  }
  await wait("Boolean(document.getElementById('is-form')) && document.querySelectorAll('#existing-grid .cell').length===48", 'maintained app');
  const original = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  assert.ok(original);
  report.push('maintained application renders both site maps and the capacity consumer');

  await runExample();
  assert.equal(await metric('proposal', 'unlimited', 'absorbedLiters'), 144);
  assert.equal(await metric('proposal', 'limited', 'absorbedLiters'), 20);
  assert.equal(await metric('proposal', 'limited', 'storedLiters'), 124);
  assert.equal(await metric('proposal', 'limited', 'massErrorLiters'), 0);
  assert.equal(await evaluate("document.querySelectorAll('#is-chart polyline').length"), 4);
  assert.equal(await evaluate("document.querySelectorAll('[data-is-cell]').length"), 8);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), original);
  report.push('independent 144 L / 20 L / 124 L shallow-store values are visible and working site remains unchanged');

  await evaluate("(()=>{const cell=document.getElementById('is-cell');cell.value='3';cell.dispatchEvent(new Event('change',{bubbles:true}));cell.focus()})()");
  assert.equal(await evaluate("Number(document.querySelector('#is-cell-account [data-side=\"proposal\"]').dataset.finalDepth)"), 31);
  assert.equal(await evaluate("document.activeElement.id"), 'is-cell');
  assert.equal(await evaluate("document.querySelectorAll('[data-is-cell=\"3\"][aria-pressed=\"true\"]').length"), 2);
  report.push('original-cell selection connects both maps to the accepted local water account');

  const downloads = runDirectory + '/downloads'; await mkdir(downloads);
  await send('Browser.setDownloadBehavior', {behavior: 'allow', downloadPath: downloads});
  await evaluate("document.getElementById('is-save').click()");
  const savedPath = downloads + '/experimental-earth-closed-store.json';
  let text;
  for (let i = 0; i < 80; i++) { try { text = await readFile(savedPath, 'utf8'); break; } catch { await delay(50); } }
  assert.ok(text, 'real browser download must exist');
  const originalInput = JSON.parse(text);
  assert.equal(originalInput.storage.remainingCapacityMm, 5);
  assert.equal(originalInput.project.width, 2);
  assert.equal(Object.hasOwn(originalInput, 'results'), false);
  report.push('actual browser download retains complete original site and declaration without computed results');

  await evaluate("(()=>{const x=document.getElementById('is-capacity');x.value='20';x.dispatchEvent(new Event('input',{bubbles:true}))})()");
  assert.equal(await evaluate("document.getElementById('is-save').disabled"), true);
  assert.equal(await evaluate("document.getElementById('is-results').childElementCount"), 0);
  await evaluate("document.getElementById('is-form').requestSubmit()");
  await wait(state('computed'), 'changed capacity');
  assert.equal(await metric('proposal', 'limited', 'absorbedLiters'), 80);
  assert.equal(await metric('proposal', 'limited', 'storedLiters'), 64);
  report.push('changed capacity clears the old result and changes actual water retention');

  await send('Page.reload', {ignoreCache: true});
  await wait("Boolean(document.getElementById('is-open'))", 'fresh application');
  await openFile(savedPath); await wait(state('reopened'), 'actual saved file reopen');
  assert.equal(await metric('proposal', 'limited', 'storedLiters'), 124);
  assert.equal(await evaluate("document.getElementById('is-capacity').value"), '5');
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), original);
  report.push('fresh application reopens the actual downloaded bytes, recomputes and preserves the working site');

  const forgedPath = downloads + '/forged-result.json';
  await writeFile(forgedPath, JSON.stringify({...originalInput, results: {storedLiters: 0}}));
  await openFile(forgedPath); await wait(state('refused'), 'forged verdict refusal');
  assert.equal(await evaluate("document.getElementById('is-save').disabled"), true);
  assert.equal(await evaluate("document.getElementById('is-results').childElementCount"), 0);
  report.push('a saved-result forgery is refused without presenting the prior comparison as current');

  await evaluate("window.storageNativeRead=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){const file=this;return new Promise((resolve,reject)=>{window.releaseStorageRead=()=>window.storageNativeRead.call(file).then(resolve,reject)})}");
  await openFile(savedPath); await wait(state('opening'), 'delayed read');
  await evaluate("(()=>{const x=document.getElementById('is-capacity');x.value='17';x.dispatchEvent(new Event('input',{bubbles:true}));window.releaseStorageRead();File.prototype.arrayBuffer=window.storageNativeRead})()");
  await delay(100);
  assert.equal(await evaluate("document.getElementById('is-capacity').value"), '17');
  assert.equal(await evaluate("document.getElementById('is-status').dataset.state"), 'draft');
  assert.equal(await evaluate("document.getElementById('is-save').disabled"), true);
  assert.equal(await evaluate("document.getElementById('is-run').disabled"), false);
  report.push('late file input cannot replace a newer capacity edit or revive a stale accepted result');

  await evaluate("document.getElementById('is-current').click();document.getElementById('is-capacity').value='5';document.getElementById('is-source').value='<img id=storage-injected src=x onerror=alert(1)> authored source';document.getElementById('is-form').requestSubmit()");
  await wait(state('computed'), 'working source comparison');
  assert.equal(await evaluate("document.getElementById('storage-injected')===null"), true);
  assert.ok((await evaluate("document.getElementById('is-results').textContent")).includes('<img id=storage-injected'));
  assert.equal(await evaluate("document.querySelectorAll('[data-is-cell]').length"), 96);
  await evaluate("(()=>{const x=document.getElementById('rain');x.value='47';x.dispatchEvent(new Event('change',{bubbles:true}))})()");
  assert.equal(await evaluate("document.getElementById('is-status').dataset.state"), 'draft');
  assert.equal(await evaluate("document.getElementById('is-save').disabled"), true);
  report.push('current-source changes invalidate the comparison and attributed source text is inert');

  await runExample();
  for (const [width, height, name] of [[1280, 900, 'desktop'], [390, 844, 'mobile']]) {
    await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 600});
    await evaluate("document.getElementById('infiltration-storage').scrollIntoView({block:'start'});document.fonts.ready");
    await delay(200);
    const dimensions = await evaluate("(()=>{const e=document.getElementById('infiltration-storage'),r=e.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scroll:e.scrollWidth,client:e.clientWidth,viewport:innerWidth}})()");
    assert.ok(dimensions.scroll <= dimensions.client + 1, JSON.stringify(dimensions));
    assert.ok(dimensions.width <= width + 1, JSON.stringify(dimensions));
    const shot = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true,
      clip: {x: Math.max(0, dimensions.x), y: Math.max(0, dimensions.y), width: dimensions.width, height: dimensions.height, scale: 1}});
    await writeFile(runDirectory + '/storage-' + name + '.png', Buffer.from(shot.data, 'base64'));
  }
  report.push('desktop and 390 px original-source result layouts captured with no panel overflow');
  assert.deepEqual(session.exceptions, []);
  await writeFile(runDirectory + '/browser.json', JSON.stringify({status: 'passed', groups: report.length, report, sandbox: session.sandbox}, null, 2));
});
console.log(JSON.stringify({status: 'passed', groups: report.length, report, runDirectory}, null, 2));
