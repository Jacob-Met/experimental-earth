import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? '/tmp/earth-draining-receive-' + randomUUID();
const report = [];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} differs from ${b}`);
await withBrowserSession({root, chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome', runDirectory}, async session => {
  const {send, evaluate} = session;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 960, deviceScaleFactor: 1, mobile: false});
  await send('Page.reload', {ignoreCache: true});
  async function wait(expression, label) {
    for (let i = 0; i < 100; i++) {if (await evaluate(expression)) return; await delay(50);}
    throw Error('Timed out: ' + label);
  }
  const state = value => "document.querySelector('#dl-status')?.dataset.state===" + JSON.stringify(value);
  const metric = (side, kind, key) => evaluate("Number(document.querySelector('#dl-results td[data-side=\"" + side +
    "\"][data-kind=\"" + kind + "\"][data-metric=\"" + key + "\"]').dataset.value)");
  async function run() {
    await evaluate("document.getElementById('dl-form').requestSubmit()");
    await wait(state('computed'), 'computed layer comparison');
  }
  async function change(id, value) {
    await evaluate("(()=>{let e=document.getElementById('dl-" + id + "');e.value=" + JSON.stringify(value) +
      ";e.dispatchEvent(new Event('input',{bubbles:true}))})()");
  }
  async function openFile(path) {
    const doc = await send('DOM.getDocument');
    const element = await send('DOM.querySelector', {nodeId: doc.root.nodeId, selector: '#dl-open'});
    await send('DOM.setFileInputFiles', {nodeId: element.nodeId, files: [path]});
  }
  await wait("Boolean(document.getElementById('dl-form')) && document.querySelectorAll('#existing-grid .cell').length===48", 'maintained application');
  const original = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  assert.ok(original); report.push('maintained app and original paired site are present');
  await evaluate("document.getElementById('dl-example').click()"); await run();
  const infiltration = 4 * (20 + 19 * Math.log(24 / 19));
  close(await metric('proposal', 'draining', 'absorbedLiters'), infiltration);
  close(await metric('proposal', 'draining', 'storedLiters'), 144 - infiltration);
  close(await metric('proposal', 'closed', 'storedLiters'), 124);
  close(await metric('proposal', 'unlimited', 'storedLiters'), 0);
  close(await evaluate("Number(document.querySelector('#dl-results .dl-accounts [data-side=\"proposal\"]').dataset.drained)"), infiltration - 20);
  assert.equal(await evaluate("document.querySelectorAll('#dl-chart polyline').length"), 3);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), original);
  report.push('independent filling/drainage result is visible with separate receiver account and unchanged working site');

  await change('drainage', '0');
  assert.equal(await evaluate("document.getElementById('dl-save').disabled"), true);
  assert.equal(await evaluate("document.getElementById('dl-results').childElementCount"), 0);
  await run(); close(await metric('proposal', 'draining', 'storedLiters'), 124);
  close(await evaluate("Number(document.querySelector('#dl-results .dl-accounts [data-side=\"proposal\"]').dataset.drained)"), 0);
  report.push('zero-drain changed input reproduces the closed result and retires old output');

  await change('drainage', '1'); await change('initial', '2'); await run();
  close(await evaluate("Number(document.querySelector('#dl-results .dl-accounts [data-side=\"proposal\"]').dataset.initial)"), 8);
  close(await metric('proposal', 'draining', 'rainLiters'), 144);
  await evaluate("(()=>{let e=document.getElementById('dl-cell');e.value='3';e.dispatchEvent(new Event('change'));e.focus()})()");
  assert.equal(await evaluate("document.activeElement.id"), 'dl-cell');
  assert.match(await evaluate("document.getElementById('dl-cell-account').textContent"), /B2/);
  assert.match(await evaluate("document.getElementById('dl-cell-account').textContent"), /began with 2 mm/);
  await evaluate("(()=>{let e=document.getElementById('dl-side');e.value='existing';e.dispatchEvent(new Event('change'))})()");
  assert.match(await evaluate("document.getElementById('dl-chart').getAttribute('aria-label')"), /^Existing/);
  report.push('initial below-ground water remains distinct from rain; original-cell and side controls work by keyboard');

  await change('initial', '0'); await run();
  const downloads = runDirectory + '/downloads'; await mkdir(downloads);
  await send('Browser.setDownloadBehavior', {behavior: 'allow', downloadPath: downloads});
  await evaluate("document.getElementById('dl-save').click()");
  const savedPath = downloads + '/experimental-earth-draining-layer.json';
  let text;
  for (let i = 0; i < 80; i++) {try {text = await readFile(savedPath, 'utf8'); break;} catch {await delay(50);}}
  assert.ok(text); const originalInput = JSON.parse(text);
  assert.equal(originalInput.layer.drainagePerHour, 1);
  assert.deepEqual(Object.keys(originalInput).sort(), ['layer', 'project', 'schema']);
  await send('Page.reload', {ignoreCache: true});
  await wait("Boolean(document.getElementById('dl-open'))", 'fresh app');
  await openFile(savedPath); await wait(state('reopened'), 'original file reopen');
  close(await metric('proposal', 'draining', 'storedLiters'), 144 - infiltration);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), original);
  report.push('real download and fresh-page upload replay original inputs without replacing the working site');

  const forged = downloads + '/forged.json';
  await writeFile(forged, JSON.stringify({...originalInput, results: {success: true}}));
  await openFile(forged); await wait(state('refused'), 'saved-result forgery refusal');
  assert.equal(await evaluate("document.getElementById('dl-results').childElementCount"), 0);
  await change('initial', '6'); await runRefusal();
  async function runRefusal() {
    await evaluate("document.getElementById('dl-form').requestSubmit()");
    await wait(state('refused'), 'initial state exceeds storage');
  }
  assert.equal(await evaluate("document.getElementById('dl-save').disabled"), true);
  report.push('forged saved conclusion and overfull initial layer cannot become successful comparisons');

  await evaluate("window.layerNativeRead=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){const f=this;return new Promise((resolve,reject)=>{window.releaseLayerRead=()=>window.layerNativeRead.call(f).then(resolve,reject)})}");
  await openFile(savedPath); await wait(state('opening'), 'delayed original input');
  await change('initial', '0'); await change('drainage', '2');
  await evaluate("window.releaseLayerRead();File.prototype.arrayBuffer=window.layerNativeRead"); await delay(100);
  assert.equal(await evaluate("document.getElementById('dl-drainage').value"), '2');
  assert.equal(await evaluate("document.getElementById('dl-status').dataset.state"), 'draft');
  assert.equal(await evaluate("document.getElementById('dl-save').disabled"), true);
  report.push('late file input cannot revive a retired result or overwrite a new declaration');

  await evaluate("document.getElementById('dl-current').click()");
  await change('source', '<img id=draining-injected src=x onerror=alert(1)> authored basis'); await run();
  assert.equal(await evaluate("document.getElementById('draining-injected')===null"), true);
  await evaluate("(()=>{let e=document.getElementById('rain');e.value='40';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()");
  await wait("document.getElementById('dl-save').disabled", 'current source retirement');
  assert.equal(await evaluate("document.getElementById('dl-results').childElementCount"), 0);
  report.push('source text stays inert and actual current-site edits retire the current-source result');

  await evaluate("document.getElementById('dl-example').click()"); await run();
  await evaluate("document.getElementById('draining-layer').scrollIntoView()");
  await writeFile(runDirectory + '/desktop.png', Buffer.from((await send('Page.captureScreenshot', {format: 'png'})).data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
  await evaluate("document.getElementById('dl-results').scrollIntoView()");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), true);
  assert.equal(await evaluate("(()=>{let e=document.querySelector('#dl-results .dl-table');return e.scrollWidth>e.clientWidth})()"), true);
  await writeFile(runDirectory + '/mobile.png', Buffer.from((await send('Page.captureScreenshot', {format: 'png'})).data, 'base64'));
  assert.equal(session.exceptions.length, 0, JSON.stringify(session.exceptions));
  report.push('desktop and 390px course captured; comparison table scrolls without document overflow or runtime errors');
  await writeFile(runDirectory + '/browser.json', JSON.stringify({schema: 'experimental-earth-draining-layer-receiving/1',
    passed: report.length, checks: report, sandbox: session.sandbox, analytic: {infiltrationLiters: infiltration,
      finalSurfaceLiters: 144 - infiltration, drainedLiters: infiltration - 20}}, null, 2) + '\n');
  console.log(JSON.stringify({passed: report.length, checks: report, runDirectory}, null, 2));
});
