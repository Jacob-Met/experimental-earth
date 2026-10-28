import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { authoredPowerWeather } from './weather-power-fixture.mjs';
import { parseShadeHeatSampling } from '../shade-heat-sampling.js';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = root + '.browser-run-sky-sampling-' + randomUUID(), checks = [];
try {
  const result = await withBrowserSession({ root, runDirectory,
    chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome' }, async session => {
    const { send, evaluate, exceptions } = session;
    assert.equal(session.sandbox.admitted, true);
    assert.equal(session.sandbox.observation.active, true);
    await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
    async function until(expression) {
      for (let i = 0; i < 750; i++) {
        try { if (await evaluate(expression)) return; } catch {}
        await delay(40);
      }
      throw Error('Timed out: ' + expression + '; ' + await evaluate("document.getElementById('shade-status')?.textContent"));
    }
    const click = id => evaluate('document.getElementById(' + JSON.stringify(id) + ').click()');
    async function method(value) {
      await evaluate("document.getElementById('shade-sky-method').value=" + JSON.stringify(value)
        + ";document.getElementById('shade-sky-method').dispatchEvent(new Event('input',{bubbles:true}))");
    }
    async function file(selector, path) {
      const doc = await send('DOM.getDocument');
      const el = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
      assert.ok(el.nodeId, selector);
      await send('DOM.setFileInputFiles', { nodeId: el.nodeId, files: [path] });
    }
    async function parentRun() {
      await evaluate("document.getElementById('shade-form').requestSubmit()");
      await until("document.getElementById('shade-status').dataset.state==='compared'");
    }
    async function samplingRun() {
      await click('shade-sampling-run');
      await until("document.getElementById('shade-sampling-status').dataset.state==='compared'");
    }
    const stored = () => evaluate("localStorage.getItem('experimental-earth-site-v1')");
    const childEmpty = () => evaluate("document.getElementById('shade-sampling-results').children.length===0");
    await until("Boolean(document.getElementById('shade-sampling-run')&&document.getElementById('shade-sky-method'))");
    const original = await stored();
    await click('shade-example');
    await until("document.getElementById('shade-status').dataset.state==='compared'");
    const raw = JSON.stringify(authoredPowerWeather()), rawPath = runDirectory + '/original-hourly.json';
    await writeFile(rawPath, raw); await file('#shade-weather-import', rawPath);
    await until("document.getElementById('shade-weather-clear').hidden===false");
    await parentRun();
    assert.equal(await evaluate("document.getElementById('shade-sampling-run').disabled"), false);
    await samplingRun();
    assert.equal(await evaluate("document.querySelectorAll('#shade-sampling-chart path[data-bound]').length"), 6);
    const downloads = runDirectory + '/downloads'; await mkdir(downloads);
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    await click('shade-sampling-export');
    const sampledPath = downloads + '/experimental-earth-shade-heat-sampling-inputs.json';
    let sampledText;
    for (let i = 0; i < 250; i++) { try { sampledText = await readFile(sampledPath, 'utf8'); break; } catch { await delay(40); } }
    assert.equal(typeof sampledText, 'string');
    const saved = parseShadeHeatSampling(sampledText);
    assert.equal(saved.investigation.source.kind, 'experimental-earth/shade-heat-inputs/2');
    assert.equal(saved.investigation.source.declaration.weather.rawText, raw);
    checks.push('Actual worker-fed hourly parent supports all three original solar grids and an actual source-only download');

    await click('shade-sky-enabled');
    assert.equal(await childEmpty(), true);
    assert.equal(await evaluate("document.getElementById('shade-sampling-run').disabled"), true);
    await parentRun();
    assert.equal(await evaluate("document.getElementById('shade-sampling-run').disabled"), true);
    assert.match(await evaluate("document.getElementById('shade-sampling-status').textContent"), /uniform diffuse input/);
    assert.match(await evaluate("document.getElementById('shade-sky-inspection').textContent"), /512 equally weighted directions/);
    await method('continuous-columns'); await parentRun();
    assert.equal(await evaluate("document.getElementById('shade-sky-inspection').dataset.method"), 'continuous-columns');
    assert.equal(await evaluate("document.getElementById('shade-sampling-run').disabled"), true);
    assert.equal(await childEmpty(), true);
    checks.push('Selecting either mapped-sky model retires the old solar-grid comparison and explains the current uniform-diffuse requirement');

    const parentBefore = await evaluate("document.getElementById('shade-results').textContent");
    await file('#shade-sampling-import', sampledPath);
    await until("document.getElementById('shade-sampling-status').dataset.state==='compared'");
    assert.equal(await evaluate("document.getElementById('shade-sampling-results').dataset.sourceMode"), 'Reopened sampling inputs');
    assert.equal(await evaluate("document.getElementById('shade-results').textContent"), parentBefore);
    assert.equal(await evaluate("document.getElementById('shade-sampling-run').disabled"), true);
    assert.equal(await stored(), original);
    checks.push('Original sampling inputs reopen independently beside a continuous-sky parent without replacing either parent or working site');

    const slow = runDirectory + '/slow-sampling.json'; await writeFile(slow, sampledText);
    await evaluate("window.__originalSamplingBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow-sampling.json')return new Promise(resolve=>{window.__releaseSampling=()=>window.__originalSamplingBuffer.call(this).then(resolve)});return window.__originalSamplingBuffer.call(this)}");
    await file('#shade-sampling-import', slow); await until("typeof window.__releaseSampling==='function'");
    await method('sampled');
    assert.equal(await childEmpty(), true);
    await evaluate('window.__releaseSampling();File.prototype.arrayBuffer=window.__originalSamplingBuffer'); await delay(120);
    assert.equal(await childEmpty(), true);
    assert.equal(await evaluate("document.getElementById('shade-sampling-export').disabled"), true);
    await click('shade-sky-enabled'); await parentRun(); await samplingRun();
    assert.equal(await evaluate("document.getElementById('shade-sampling-run').disabled"), false);
    checks.push('Changing the sky method retires a delayed sampling read; returning to uniform diffuse input restores the original three-grid consumer');

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await delay(100);
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
    await evaluate("document.getElementById('shade-sampling').scrollIntoView({block:'start',behavior:'instant'})");
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(runDirectory + '/sky-sampling-narrow.png', Buffer.from(shot.data, 'base64'));
    assert.deepEqual(exceptions, []); assert.equal(await stored(), original);
    return { checks, sandbox: session.sandbox, exceptions };
  });
  const files = {};
  for (const name of ['shade-heat.js', 'shade-heat-panel.js', 'shade-heat-sampling.js',
    'shade-heat-sampling-panel.js', 'shade-heat.css', 'tests/shade-heat-sky-sampling.browser.mjs']) {
    files[name] = createHash('sha256').update(await readFile(root + name)).digest('hex');
  }
  const receipt = { status: 'PASS', sourceRoot: root, sourceFiles: files, ...result.value, receipt: result.receipt };
  await writeFile(runDirectory + '/browser.json', JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error), stack: error.stack, checks, runDirectory, receipt: error.receipt ?? null }, null, 2));
  process.exitCode = 1;
}
