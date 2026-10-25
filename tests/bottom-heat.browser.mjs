import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { makeExample } from '../core.js';
import { prepareSurfaceHeatStudy } from '../surface-heat.js';
import { prepareHeatColumnStudy } from '../heat-column.js';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = root + '.browser-run-bottom-heat-' + randomUUID(), checks = [];
const p = makeExample();
const surface = { absorptivity: .8, capacityJm2K: 20000, exchangeWm2K: 10, initialC: 20, source: 'Independent authored pulse' };
const lower = { capacityJm2K: 80000, conductanceWm2K: 20, initialC: 20, source: 'Authored lower store' };
p.surfaceHeatStudy = prepareSurfaceHeatStudy(p, { cellIndex: 0, existing: surface, proposal: surface, schedule: [
  { minutes: 60, incidentWm2: 700, reservoirC: 20, source: 'Authored pulse' },
  { minutes: 360, incidentWm2: 0, reservoirC: 20, source: 'Authored darkness' }
] });
p.heatColumnStudy = prepareHeatColumnStudy(p, { existing: lower, proposal: lower });
const near = (a, b, t = 1e-7) => assert.ok(Math.abs(a - b) < t, a + ' != ' + b);
try {
  const result = await withBrowserSession({ root, runDirectory, chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome' }, async session => {
    const { evaluate, send, exceptions } = session;
    await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
    async function until(e) {
      for (let i = 0; i < 125; i++) { try { if (await evaluate(e)) return; } catch {} await delay(40); }
      throw Error('Timed out: ' + e);
    }
    async function file(selector, path) {
      const doc = await send('DOM.getDocument');
      const input = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
      await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [path] });
    }
    async function field(id, value) {
      await evaluate('(()=>{const e=document.getElementById(' + JSON.stringify(id) + ');e.value=' +
        JSON.stringify(String(value)) + ';e.dispatchEvent(new Event("input",{bubbles:true}));})()');
    }
    const click = id => evaluate('document.getElementById(' + JSON.stringify(id) + ').click()');
    const content = () => evaluate("document.getElementById('bottom-results').textContent");
    await until("Boolean(document.getElementById('bottom-form'))");
    const input = runDirectory + '/original.json';
    await writeFile(input, JSON.stringify(p)); await file('#import', input);
    await until("JSON.parse(localStorage.getItem('experimental-earth-site-v1')).heatColumnStudy?.lowerLayers.existing.capacityJm2K===80000");
    for (const target of ['existing', 'proposal']) for (const [key, v] of Object.entries({
      conductance: target === 'existing' ? 10 : 0, temperature: 20,
      source: '<img src=x onerror=window.__bottomInjected=1> Authored deep boundary'
    })) await field('bottom-' + target + '-' + key, v);
    await evaluate("document.getElementById('bottom-form').requestSubmit()");
    await until("!document.getElementById('bottom-download').disabled");
    assert.equal(await evaluate("document.querySelectorAll('#bottom-heat img').length"), 0);
    assert.equal(await evaluate('window.__bottomInjected??null'), null);
    assert.match(await content(), /Bottom exchange out/);
    await evaluate("(()=>{const e=document.querySelector('#bottom-results input[data-target=existing]');e.value=60;e.dispatchEvent(new Event('input'));})()");
    near(Number(await evaluate("document.querySelector('#bottom-results [data-surface-c]').dataset.surfaceC")), 43.73770625579907);
    near(Number(await evaluate("document.querySelector('#bottom-results [data-bottom-out-jm2]').dataset.bottomOutJm2")), 161470.9588656207, 1e-5);
    checks.push('Native original source, independent pulse and signed bottom ledger with literal source custody');
    const download = runDirectory + '/download'; await mkdir(download);
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: download }); await click('bottom-download');
    const exported = download + '/bottom-heat-investigation.json';
    for (let i = 0; i < 125; i++) { try { await access(exported); break; } catch { await delay(40); } }
    const raw = JSON.parse(await readFile(exported, 'utf8'));
    assert.deepEqual(raw.heatColumnStudy, p.heatColumnStudy);
    assert.equal(raw.bottoms.proposal.conductanceWm2K, 0); assert.equal(raw.report, undefined);
    await field('bottom-existing-temperature', 50);
    assert.equal(await evaluate("document.getElementById('bottom-results').children.length"), 0);
    assert.equal(await evaluate("document.getElementById('bottom-download').disabled"), true);
    await click('bottom-restore');
    assert.equal(await evaluate("document.getElementById('bottom-existing-temperature').value"), '20');
    assert.equal(await evaluate("document.getElementById('bottom-download').disabled"), false);
    checks.push('Dirty draft is hidden and accepted original inputs can be restored without source reassociation');
    await send('Page.reload', { ignoreCache: true }); await until("Boolean(document.getElementById('bottom-form'))");
    await file('#bottom-file', exported); await until("!document.getElementById('bottom-download').disabled");
    const acceptedText = await content(), acceptedTemperature = await evaluate("document.getElementById('bottom-existing-temperature').value");
    const malformed = runDirectory + '/malformed.json'; await writeFile(malformed, '{"broken":');
    await file('#bottom-file', malformed);
    await until("document.getElementById('bottom-status').textContent.startsWith('Replacement refused')");
    assert.equal(await content(), acceptedText);
    assert.equal(await evaluate("document.getElementById('bottom-existing-temperature').value"), acceptedTemperature);
    assert.equal(await evaluate("document.getElementById('bottom-download').disabled"), false);
    checks.push('Actual download and fresh-page native reopen recompute; malformed replacement retains accepted inputs and result');

    // A delayed old read must neither replace a newer draft nor clear its state.
    await evaluate("window.__bottomOriginalText=File.prototype.text;File.prototype.text=function(){if(this.name==='bottom-heat-investigation.json')return new Promise(resolve=>{window.__bottomResolve=resolve;});return window.__bottomOriginalText.call(this);}");
    await file('#bottom-file', exported); await until("typeof window.__bottomResolve==='function'");
    await field('bottom-existing-temperature', 37);
    await evaluate('window.__bottomResolve(' + JSON.stringify(JSON.stringify(raw)) + ')');
    await delay(80);
    assert.equal(await evaluate("document.getElementById('bottom-existing-temperature').value"), '37');
    assert.equal(await evaluate("document.getElementById('bottom-results').children.length"), 0);
    assert.equal(await evaluate("document.getElementById('bottom-download').disabled"), true);
    await evaluate("File.prototype.text=window.__bottomOriginalText");
    await click('bottom-restore'); assert.equal(await content(), acceptedText);
    checks.push('Out-of-order old file completion cannot replace or clear a newer draft; accepted source restores');

    const forged = structuredClone(raw); forged.report = { surfaceC: -999 };
    forged.heatColumnStudy.report = { surfaceC: -999 };
    const forgedPath = runDirectory + '/forged.json'; await writeFile(forgedPath, JSON.stringify(forged));
    await file('#bottom-file', forgedPath);
    await until("document.getElementById('bottom-status').textContent.startsWith('Showing reopened')");
    assert.equal(await content(), acceptedText);
    checks.push('Forged derived fields cannot replace recomputed original response');

    await until("(()=>{const e=document.getElementById('toast');return !e||(!e.classList.contains('show')&&Number(getComputedStyle(e).opacity)===0);})()");
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate("document.querySelector('#bottom-results input[type=range]').value=60;document.querySelector('#bottom-results input[type=range]').focus()");
    const before = await evaluate("document.querySelector('#bottom-results input[type=range]').value");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    assert.notEqual(await evaluate("document.querySelector('#bottom-results input[type=range]').value"), before);
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
    await evaluate("document.getElementById('bottom-results').scrollIntoView({block:'start',behavior:'instant'})");
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(runDirectory + '/bottom-narrow.png', Buffer.from(shot.data, 'base64'));
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
    await evaluate("document.getElementById('bottom-results').scrollIntoView({block:'start',behavior:'instant'})");
    await until("(()=>{const r=document.getElementById('bottom-results').getBoundingClientRect();return r.top>=-1&&r.top<100;})()");
    shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(runDirectory + '/bottom-desktop.png', Buffer.from(shot.data, 'base64'));
    assert.deepEqual(exceptions, []); checks.push('Actual narrow/desktop plot and keyboard time receiving');
    return { checks, sandbox: session.sandbox };
  });
  console.log(JSON.stringify({ status: 'PASS', ...result.value, receipt: result.receipt }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error), checks, receipt: error.receipt ?? null }, null, 2));
  process.exitCode = 1;
}
