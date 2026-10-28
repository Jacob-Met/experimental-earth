import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { compareShadeHeat, parseShadeHeatInvestigation, serializeShadeHeatInvestigation } from '../shade-heat.js';
import { authoredPowerWeather } from './weather-power-fixture.mjs';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = root + '.browser-run-continuous-sky-' + randomUUID(), checks = [];
const example = makeShadeHeatExample();
const declaration = { ...example.declaration, directNormalWm2: 0, diffuseSky: { method: 'continuous-columns' } };
try {
  const result = await withBrowserSession({ root, runDirectory, chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome' }, async session => {
    const { send, evaluate: value, exceptions } = session;
    await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
    async function until(expression) {
      for (let i = 0; i < 750; i++) {
        try { if (await value(expression)) return; } catch {}
        await delay(40);
      }
      throw Error('Timed out: ' + expression + '; ' + await value("document.getElementById('shade-status')?.textContent"));
    }
    const click = id => value('document.getElementById(' + JSON.stringify(id) + ').click()');
    async function field(id, content, event = 'input') {
      await value("(()=>{const e=document.getElementById(" + JSON.stringify(id) + ");e.value=" + JSON.stringify(String(content))
        + ";e.dispatchEvent(new Event(" + JSON.stringify(event) + ",{bubbles:true}));})()");
    }
    async function file(selector, path) {
      const document = await send('DOM.getDocument');
      const input = await send('DOM.querySelector', { nodeId: document.root.nodeId, selector });
      assert.ok(input.nodeId, selector);
      await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [path] });
    }
    const stored = () => value("localStorage.getItem('experimental-earth-site-v1')");
    async function run() {
      await value("document.getElementById('shade-form').requestSubmit()");
      await until("document.getElementById('shade-status').dataset.state==='compared'");
    }
    async function matches(report) {
      const actual = await value("({existing:+document.getElementById('shade-inspect').dataset.existingLower,proposal:+document.getElementById('shade-inspect').dataset.proposalUpper})");
      const last = report.trajectory.at(-1);
      assert.ok(Math.abs(actual.existing - last.existing.lower.surfaceC) < 1e-8);
      assert.ok(Math.abs(actual.proposal - last.proposal.upper.surfaceC) < 1e-8);
    }
    async function download(name) {
      const directory = runDirectory + '/download-' + name; await mkdir(directory);
      await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
      await click('shade-export');
      const path = directory + '/experimental-earth-shade-heat-inputs.json';
      let found = false;
      for (let i = 0; i < 750; i++) { try { await access(path); found = true; break; } catch { await delay(40); } }
      assert.ok(found, 'Actual input-only download completed');
      const text = await readFile(path, 'utf8'); return { path, text, parsed: parseShadeHeatInvestigation(text) };
    }
    await until("Boolean(document.getElementById('shade-sky-method'))");
    const original = await stored();
    await value("window.continuousWorkerRequests=[];const originalPost=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){window.continuousWorkerRequests.push(m.operation);return originalPost.call(this,m,...args)}");
    await click('shade-example'); await until("document.getElementById('shade-status').dataset.state==='compared'");
    await field('shade-directNormalWm2', 0); await click('shade-sky-enabled'); await field('shade-sky-method', 'continuous-columns');
    assert.equal(await value("document.getElementById('shade-sky-azimuthSamples').disabled"), true);
    assert.equal(await value("getComputedStyle(document.getElementById('shade-sky-sampling')).display"), 'none');
    await run(); await matches(compareShadeHeat(example.project, declaration));
    assert.equal(await value("document.getElementById('shade-sky-inspection').dataset.method"), 'continuous-columns');
    assert.match(await value("document.getElementById('shade-sky-inspection').textContent"), /78\.0829/);
    assert.equal(await stored(), original);
    checks.push('Actual worker connects the continuous horizon to diffuse-only thermal output; sampling controls retire and working-site bytes remain unchanged');

    const constant = await download('constant'), envelope = JSON.parse(constant.text);
    assert.equal(envelope.kind, 'experimental-earth/shade-heat-inputs/4');
    assert.deepEqual(Object.keys(envelope), ['kind', 'model', 'project', 'declaration']);
    assert.deepEqual(envelope.declaration.diffuseSky, { method: 'continuous-columns' });
    assert.deepEqual(envelope.project, example.project);
    assert.deepEqual(await value('window.continuousWorkerRequests'), ['prepare', 'prepare', 'serialize']);
    await send('Page.reload', { ignoreCache: true }); await until("Boolean(document.getElementById('shade-import'))");
    await file('#shade-import', constant.path); await until("document.getElementById('shade-status').dataset.state==='compared'");
    await matches(constant.parsed.report);
    assert.equal(await value("document.getElementById('shade-sky-method').value"), 'continuous-columns');
    assert.equal(await stored(), original);
    checks.push('A real v4 input-only download reopens in a fresh document with the same source, method and recomputed thermal trajectory');

    const badPath = runDirectory + '/forged-v4.json';
    await writeFile(badPath, JSON.stringify({ ...envelope, report: { status: 'compared', transmission: 1 } }));
    await file('#shade-import', badPath); await until("document.getElementById('shade-status').dataset.state==='file-refused'");
    await matches(constant.parsed.report);
    await value("window.originalFileText=File.prototype.text;File.prototype.text=function(){if(this.name==='slow-v4.json')return new Promise(resolve=>{window.finishOldSky=()=>window.originalFileText.call(this).then(resolve)});return window.originalFileText.call(this)}");
    const slowPath = runDirectory + '/slow-v4.json'; await writeFile(slowPath, constant.text);
    await file('#shade-import', slowPath); await until("typeof window.finishOldSky==='function'");
    assert.equal(await value("document.getElementById('shade-status').dataset.state"), 'file-pending');
    await field('shade-sky-method', 'sampled');
    assert.equal(await value("document.getElementById('shade-results').children.length"), 0);
    await value('window.finishOldSky()'); await delay(100);
    assert.equal(await value("document.getElementById('shade-sky-method').value"), 'sampled');
    assert.equal(await value("document.getElementById('shade-results').children.length"), 0);
    assert.equal(await value("document.getElementById('shade-export').disabled"), true);
    await value('File.prototype.text=window.originalFileText');
    await run();
    assert.match(await value("document.getElementById('shade-sky-inspection').textContent"), /512 equally weighted directions/);
    checks.push('Derived-result injection refuses transactionally; changing sky method retires a delayed old v4 load and can recompute the sampled method');

    await field('shade-sky-method', 'continuous-columns');
    const weatherText = JSON.stringify(authoredPowerWeather()), weatherPath = runDirectory + '/hourly.json';
    await writeFile(weatherPath, weatherText); await file('#shade-weather-import', weatherPath);
    await until("document.getElementById('shade-weather-clear').hidden===false"); await run();
    const hourly = await download('hourly');
    assert.equal(hourly.parsed.investigation.kind, 'experimental-earth/shade-heat-inputs/4');
    assert.equal(hourly.parsed.investigation.declaration.weather.rawText, weatherText);
    await send('Page.reload', { ignoreCache: true }); await until("Boolean(document.getElementById('shade-import'))");
    await file('#shade-import', hourly.path); await until("document.getElementById('shade-status').dataset.state==='compared'");
    await matches(hourly.parsed.report);
    assert.equal(await value("document.getElementById('shade-reservoirC').disabled"), true);
    assert.equal(await value("document.getElementById('shade-sky-method').value"), 'continuous-columns');
    assert.equal(await stored(), original);
    checks.push('Original hourly weather remains byte-attached through v4 download and fresh reopening with recomputed continuous sky and locked weather controls');

    const uncertain = structuredClone(example.project); uncertain.solarStudy.proposal[0].heightMinM = 0;
    const uncertainText = serializeShadeHeatInvestigation(uncertain, declaration), uncertainPath = runDirectory + '/uncertain.json';
    await writeFile(uncertainPath, uncertainText); await file('#shade-import', uncertainPath);
    await until("document.getElementById('shade-status').dataset.state==='compared'");
    await matches(parseShadeHeatInvestigation(uncertainText).report);
    await value("document.getElementById('shade-sky-inspection').open=true");
    await field('shade-sky-scenario', 'proposal:minimumRoofs', 'change');
    assert.match(await value("document.getElementById('shade-sky-arc').textContent"), /No mapped roof/);
    await field('shade-sky-scenario', 'proposal:maximumRoofs', 'change');
    await value("document.getElementById('shade-sky-sector').scrollIntoView({block:'center',behavior:'instant'});document.getElementById('shade-sky-sector').focus()");
    const before = await value("document.getElementById('shade-sky-sector').value");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    assert.notEqual(await value("document.getElementById('shade-sky-sector').value"), before);
    assert.equal(await value("document.getElementById('shade-sky-arc').dataset.sector"), await value("document.getElementById('shade-sky-sector').value"));
    assert.match(await value("document.getElementById('shade-sky-arc').textContent"), /angular width/);
    checks.push('Declared height endpoints have separate inspectable skylines and actual keyboard input changes the selected horizon sector');

    await until("!document.getElementById('toast').classList.contains('show')");
    for (const [width, height, mobile] of [[1440, 1000, false], [390, 844, true]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, mobile, deviceScaleFactor: 1 });
      await delay(100); assert.ok(await value('document.documentElement.scrollWidth<=innerWidth+1'));
      await value("document.getElementById('shade-sky-inspection').open=true;document.getElementById('shade-sky-inspection').scrollIntoView({block:'start',behavior:'instant'})");
      await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(runDirectory + '/continuous-sky-' + width + '.png', Buffer.from(shot.data, 'base64'));
    }
    await value("document.getElementById('shade-settings').open=true;document.getElementById('shade-sky-method').scrollIntoView({block:'center',behavior:'instant'})");
    await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))'); await delay(100);
    assert.equal(await value("getComputedStyle(document.getElementById('shade-sky-sampling')).display"), 'none');
    const settings = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(runDirectory + '/continuous-sky-settings-390.png', Buffer.from(settings.data, 'base64'));
    assert.deepEqual(exceptions, []);
    checks.push('Continuous method controls and sector inspection fit desktop and 390px layouts without application exceptions');
    return { checks, sandbox: session.sandbox, exceptions };
  });
  const receipt = { status: 'PASS', ...result.value, receipt: result.receipt };
  await writeFile(runDirectory + '/browser.json', JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error), checks, receipt: error.receipt ?? null, runDirectory }, null, 2));
  process.exitCode = 1;
}
