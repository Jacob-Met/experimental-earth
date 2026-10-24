import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { parseShadeHeatInvestigation } from '../shade-heat.js';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = root + '.browser-run-shade-heat-' + randomUUID(), checks = [];
const example = makeShadeHeatExample();
example.project.heatColumnStudy.lowerLayers.existing.source = '<img src=x onerror=window.__shadeInjected=1> Literal authored lower-store source';
try {
  const result = await withBrowserSession({ root, runDirectory, chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome' }, async session => {
    const { send, evaluate, exceptions } = session;
    await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
    async function until(expression) {
      for (let i = 0; i < 125; i++) { try { if (await evaluate(expression)) return; } catch {} await delay(40); }
      throw Error('Timed out: ' + expression + '; ' + await evaluate("document.getElementById('shade-status')?.textContent"));
    }
    const click = id => evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
    async function field(id, value) { await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));})()`); }
    async function nativeFile(selector, path) {
      const doc = await send('DOM.getDocument'), input = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
      assert.ok(input.nodeId, selector); await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [path] });
    }
    async function run() { await evaluate("document.getElementById('shade-form').requestSubmit()"); await until("document.getElementById('shade-status').dataset.state==='compared'"); }
    const stored = () => evaluate("localStorage.getItem('experimental-earth-site-v1')");
    const temperatures = () => evaluate("({existing:Number(document.getElementById('shade-inspect').dataset.existingLower),proposal:Number(document.getElementById('shade-inspect').dataset.proposalUpper)})");
    await until("Boolean(document.getElementById('shade-form'))");
    const original = await stored(); await click('shade-example'); await until("document.getElementById('shade-status').dataset.state==='compared'");
    let t = await temperatures(); assert.ok(t.proposal < t.existing - 10); assert.equal(await stored(), original);
    assert.match(await evaluate("document.getElementById('shade-basis').textContent"), /Isolated authored example/);
    checks.push('Authored coupled example changes both temperature histories while preserving the active site');

    const projectPath = runDirectory + '/original-site.json'; await writeFile(projectPath, JSON.stringify(example.project));
    await nativeFile('#import', projectPath); await until("JSON.parse(localStorage.getItem('experimental-earth-site-v1')).title==='Authored courtyard · morning shade'");
    await click('shade-current'); await run(); const current = await stored();
    await evaluate("document.getElementById('shade-sources').open=true");
    assert.ok((await evaluate("document.getElementById('shade-sources').textContent")).includes(example.project.heatColumnStudy.lowerLayers.existing.source));
    assert.equal(await evaluate("document.querySelectorAll('#shade-heat img').length"), 0); assert.equal(await evaluate('window.__shadeInjected??null'), null);
    checks.push('Actual original-site file import uses saved geometry and thermal properties, preserves literal source text');

    await field('shade-directNormalWm2', 0); assert.equal(await evaluate("document.getElementById('shade-results').children.length"), 0);
    assert.equal(await evaluate("document.getElementById('shade-export').disabled"), true); await run();
    t = await temperatures(); assert.ok(Math.abs(t.existing - t.proposal) < 1e-8); assert.ok(t.existing > 20);
    await field('shade-directNormalWm2', 700); await run(); assert.equal(await stored(), current);
    checks.push('Changed direct input invalidates results; diffuse-only control heats both sites equally and never edits source');

    const download = runDirectory + '/download'; await mkdir(download); await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: download });
    await click('shade-export'); const exportedPath = download + '/experimental-earth-shade-heat-inputs.json';
    for (let i = 0; i < 100; i++) { try { await access(exportedPath); break; } catch { await delay(40); } }
    const exportedText = await readFile(exportedPath, 'utf8'), reopened = parseShadeHeatInvestigation(exportedText);
    assert.deepEqual(reopened.investigation.project, example.project); assert.equal(Object.hasOwn(JSON.parse(exportedText), 'report'), false);
    await send('Page.reload', { ignoreCache: true }); await until("Boolean(document.getElementById('shade-import'))");
    const beforeReopen = await stored(); await nativeFile('#shade-import', exportedPath); await until("document.getElementById('shade-status').dataset.state==='compared'");
    assert.equal(await stored(), beforeReopen); t = await temperatures(); assert.ok(t.proposal < t.existing - 10);
    checks.push('Real downloaded input-only investigation recomputes in a fresh page without replacing the working site');

    const bad = JSON.parse(exportedText); bad.report = { maximumC: -999 }; const badPath = runDirectory + '/forged-result.json'; await writeFile(badPath, JSON.stringify(bad));
    const acceptedTemps = await temperatures(); await nativeFile('#shade-import', badPath); await until("document.getElementById('shade-status').dataset.state==='file-refused'");
    assert.deepEqual(await temperatures(), acceptedTemps); assert.equal(await evaluate("document.getElementById('shade-export').disabled"), false);
    checks.push('Derived-result injection is refused transactionally, preserving the prior accepted original investigation');

    await evaluate("window.__shadeOriginalText=File.prototype.text;window.__shadeRelease=null;File.prototype.text=async function(){await new Promise(resolve=>window.__shadeRelease=resolve);return window.__shadeOriginalText.call(this)}");
    await nativeFile('#shade-import', exportedPath); await until('Boolean(window.__shadeRelease)');
    await field('shade-weatherSource', 'Changed explicit weather basis while file read was pending');
    await evaluate('window.__shadeRelease();File.prototype.text=window.__shadeOriginalText'); await delay(100);
    assert.equal(await evaluate("document.getElementById('shade-results').children.length"), 0);
    assert.notEqual(await evaluate("document.getElementById('shade-status').dataset.state"), 'compared');
    assert.equal(await evaluate("document.getElementById('shade-import').value"), '');
    checks.push('Late file completion cannot overwrite a newer weather draft or revive a stale result');

    await nativeFile('#shade-import', exportedPath); await until("document.getElementById('shade-status').dataset.state==='compared'");
    await click('shade-current'); await run(); await evaluate("(()=>{const e=document.getElementById('rain');e.value=25;e.dispatchEvent(new Event('change',{bubbles:true}));})()");
    assert.equal(await evaluate("document.getElementById('shade-results').children.length"), 0);
    assert.equal(await evaluate("document.getElementById('shade-run').disabled"), true);
    await nativeFile('#shade-import', exportedPath); await until("document.getElementById('shade-status').dataset.state==='compared'");
    assert.equal(JSON.parse(await stored()).weather.rainMmHr, 25);
    assert.equal(parseShadeHeatInvestigation(exportedText).investigation.project.weather.rainMmHr, example.project.weather.rainMmHr);
    checks.push('Working-site changes retire a live snapshot; independent original-file replay keeps its own source');

    const uncertain = JSON.parse(exportedText); uncertain.project.solarStudy.proposal[0].heightMinM = 0;
    const uncertainPath = runDirectory + '/uncertain-column.json'; await writeFile(uncertainPath, JSON.stringify(uncertain));
    await nativeFile('#shade-import', uncertainPath); await until("document.getElementById('shade-status').dataset.state==='compared'");
    assert.match(await evaluate("document.getElementById('shade-summary').textContent"), /13 intervals with unresolved beam/);
    await evaluate("(()=>{const e=document.getElementById('shade-store');e.value='subsurfaceC';e.dispatchEvent(new Event('change'));})()");
    assert.match(await evaluate("document.getElementById('shade-inspect').textContent"), /to/);
    checks.push('Uncertain column height displays thermal ranges and inspectable lower-store history');

    await until("!document.getElementById('toast').classList.contains('show')");
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await evaluate("document.getElementById('shade-results').scrollIntoView({block:'start',behavior:'instant'})");
    let shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(runDirectory + '/shade-desktop.png', Buffer.from(shot.data, 'base64'));
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await delay(80);
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
    await evaluate("document.getElementById('shade-time').scrollIntoView({block:'center',behavior:'instant'});document.getElementById('shade-time').focus()");
    const beforeKey = await evaluate("document.getElementById('shade-time').value");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
    assert.notEqual(await evaluate("document.getElementById('shade-time').value"), beforeKey);
    await evaluate("document.getElementById('shade-results').scrollIntoView({block:'start',behavior:'instant'})");
    shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(runDirectory + '/shade-narrow.png', Buffer.from(shot.data, 'base64'));
    await evaluate("document.getElementById('shade-inspect').scrollIntoView({block:'start',behavior:'instant'})");
    shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(runDirectory + '/shade-inspect-narrow.png', Buffer.from(shot.data, 'base64'));
    assert.deepEqual(exceptions, []); checks.push('Desktop and 390px charts, ranges and original-source controls fit; keyboard moves the time inspection');
    return { checks, sandbox: session.sandbox, exceptions };
  });
  const receipt = { status: 'PASS', ...result.value, receipt: result.receipt };
  await writeFile(runDirectory + '/browser.json', JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt, null, 2));
} catch (error) { console.error(JSON.stringify({ status: 'FAIL', error: String(error), checks, receipt: error.receipt ?? null, runDirectory }, null, 2)); process.exitCode = 1; }
