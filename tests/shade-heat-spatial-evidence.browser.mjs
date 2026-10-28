import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { parseSpatialProfileEvidence, prepareSpatialProfileEvidence } from '../shade-heat-spatial-evidence.js';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = root + '.browser-run-spatial-evidence-' + randomUUID(), checks = [];
const sourceText = await readFile(new URL('../examples/shared-sky-two-points.json', import.meta.url), 'utf8');
const reference = parseSpatialProfileEvidence(sourceText), raw = JSON.parse(sourceText);
try {
  const result = await withBrowserSession({ root, runDirectory,
    chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome', commandMs: 30000 }, async session => {
    const { send, evaluate: value, exceptions } = session;
    assert.ok(session.sandbox.admitted && session.sandbox.observation.active);
    await send('DOM.enable'); await send('Page.enable');
    async function until(expression) {
      for (let i = 0; i < 750; i++) { try { if (await value(expression)) return; } catch {} await delay(40); }
      throw Error('Timed out: ' + expression + '; ' + await value("document.getElementById('spatial-status')?.textContent"));
    }
    const click = id => value('document.getElementById(' + JSON.stringify(id) + ').click()');
    async function field(id, content) {
      await value('(()=>{const e=document.getElementById(' + JSON.stringify(id) + ');e.value=' + JSON.stringify(String(content))
        + ';e.dispatchEvent(new Event("input",{bubbles:true}));})()');
    }
    async function files(selector, paths) {
      const document = await send('DOM.getDocument');
      const input = await send('DOM.querySelector', { nodeId: document.root.nodeId, selector }); assert.ok(input.nodeId);
      await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: paths });
    }
    const state = kind => until("document.getElementById('spatial-status').dataset.state===" + JSON.stringify(kind));
    const stored = () => value("localStorage.getItem('experimental-earth-site-v1')");
    async function matches(report) {
      const actual = await value("({...document.getElementById('spatial-results').dataset})");
      assert.equal(actual.status, report.compatibility); assert.equal(Number(actual.bins), report.query.bins);
      assert.equal(Number(actual.cell), report.cellIndex);
      for (const store of ['surfaceC', 'subsurfaceC']) for (const bound of ['lower', 'upper']) {
        const key = store + bound[0].toUpperCase() + bound.slice(1);
        if (report.ranges) assert.equal(Number(actual[key]), report.ranges[store][bound].differenceC[bound]);
        else assert.equal(actual[key], undefined);
      }
    }
    async function download(name) {
      const directory = runDirectory + '/download-' + name; await mkdir(directory);
      await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
      await click('spatial-export');
      const path = directory + '/experimental-earth-shared-sky-spatial-reading-inputs.json'; let found = false;
      for (let i = 0; i < 500; i++) { try { await access(path); found = true; break; } catch { await delay(40); } }
      assert.ok(found); const text = await readFile(path, 'utf8');
      return { path, text, parsed: parseSpatialProfileEvidence(text) };
    }
    await until("Boolean(document.querySelector('a[href=\"sky-spatial-evidence.html\"]'))");
    assert.equal(await value("document.querySelector('a[href=\"sky-spatial-evidence.html\"]').target"), '_blank');
    const originalStorage = await stored();
    await send('Page.navigate', { url: session.baseUrl + 'sky-spatial-evidence.html' });
    await until("document.getElementById('spatial-example')?.disabled===false");
    assert.equal(await value("document.getElementById('spatial-run').disabled"), true);
    await click('spatial-example'); await state('compatible'); await matches(reference.report);
    assert.match(await value("document.getElementById('spatial-sources').textContent"), /point B2.*point A3/);
    assert.match(await value("document.getElementById('spatial-results').textContent"), /64 three-bin vertices/);
    assert.equal(await stored(), originalStorage);
    checks.push('Ordinary reading-panel link opens the independent consumer; actual authored-source worker evaluates both original bases and all 64 three-bin vertices');

    await value("document.querySelector('#spatial-results button[data-store=surfaceC][data-bound=upper]').click()");
    assert.equal(Number(await value("document.getElementById('spatial-witness').dataset.witness")), reference.report.ranges.surfaceC.upper.witnessId);
    const ids = reference.report.witnesses.map(w => w.id); assert.ok(ids.length > 1 && ids[1] >= ids.length);
    await field('spatial-witness-select', ids[0]);
    await value("document.getElementById('spatial-witness-select').scrollIntoView({block:'center',behavior:'instant'});document.getElementById('spatial-witness-select').focus()");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    assert.equal(Number(await value("document.getElementById('spatial-witness').dataset.witness")), ids[1]);
    assert.match(await value("document.getElementById('spatial-witness').textContent"), /B2.*A3.*Exact mixture fractions/);
    checks.push('Real keyboard and extremum-button selection inspect noncontiguous witness IDs, both observation bands and the same shared mixture');

    const saved = await download('authored');
    assert.deepEqual(Object.keys(JSON.parse(saved.text)), ['kind', 'model', 'readings', 'query']);
    assert.deepEqual(JSON.parse(saved.text), raw);
    await send('Page.reload', { ignoreCache: true }); await until("document.getElementById('spatial-example')?.disabled===false");
    await files('#spatial-reopen', [saved.path]); await state('compatible'); await matches(reference.report);
    assert.equal(await stored(), originalStorage);
    checks.push('Actual source-only download reopens on a fresh document and recomputes the same result without parent state or stored result fields');

    const independent = structuredClone(raw.readings); independent[0].query.bins = 4; independent[1].query.bins = 16;
    const firstPath = runDirectory + '/original-first.json', secondPath = runDirectory + '/original-second.json';
    await writeFile(firstPath, JSON.stringify(independent[0])); await writeFile(secondPath, JSON.stringify(independent[1]));
    await files('#spatial-originals', [firstPath, secondPath]); await state('inputs-ready');
    assert.equal(await value("document.getElementById('spatial-results').hidden"), true);
    await value("(()=>{const radio=document.querySelector('#spatial-sources input[value=\"1\"]');radio.checked=true;radio.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await click('spatial-run'); await state('compatible');
    const reversed = prepareSpatialProfileEvidence([...independent].reverse(), raw.query); await matches(reversed.report);
    const reversedSave = await download('other-point');
    assert.deepEqual(reversedSave.parsed.investigation.readings, [...independent].reverse());
    await field('spatial-bins', 4); await click('spatial-run'); await state('compatible');
    const four = prepareSpatialProfileEvidence([...independent].reverse(), { ...raw.query, bins: 4 }); await matches(four.report);
    const fourSave = await download('common-four'); assert.deepEqual(fourSave.parsed.investigation.readings, [...independent].reverse());
    assert.deepEqual(fourSave.parsed.report.readings.map(r => r.originalBins), [16, 4]);
    checks.push('Two actual original files retain distinct receivers and original 4/16-bin histories while point selection and common-bin changes recompute the chosen consequence');

    const malformed = runDirectory + '/bad-original.json'; await writeFile(malformed, JSON.stringify({ ...independent[1], report: {} }));
    await files('#spatial-originals', [firstPath, malformed]); await state('file-refused'); await matches(four.report);
    assert.equal(await value("document.getElementById('spatial-export').disabled"), false);
    await files('#spatial-originals', [firstPath]); await state('file-refused'); await matches(four.report);
    const badUtf8 = runDirectory + '/bad-utf8.json'; await writeFile(badUtf8, Buffer.from([0xc3, 0x28]));
    await files('#spatial-reopen', [badUtf8]); await state('file-refused'); await matches(four.report);
    checks.push('A malformed member, incomplete pair and invalid UTF-8 refuse transactionally without mixing new inputs into the prior accepted pair');

    const slowPath = runDirectory + '/slow-original.json'; await writeFile(slowPath, JSON.stringify(independent[1]));
    await value("window.originalSpatialArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow-original.json')return new Promise(resolve=>{window.releaseOldSpatialFile=()=>window.originalSpatialArrayBuffer.call(this).then(resolve)});return window.originalSpatialArrayBuffer.call(this)}");
    await files('#spatial-originals', [firstPath, slowPath]); await until("typeof window.releaseOldSpatialFile==='function'");
    assert.equal(await value("document.getElementById('spatial-export').disabled"), true);
    await field('spatial-bins', 8); await click('spatial-run'); await state('compatible');
    await matches(reversed.report); await value('window.releaseOldSpatialFile()'); await delay(120); await matches(reversed.report);
    const afterSlow = await download('after-slow'); assert.deepEqual(afterSlow.parsed.investigation.readings, [...independent].reverse());
    await value('File.prototype.arrayBuffer=window.originalSpatialArrayBuffer');
    checks.push('A delayed two-file read cannot reverse or replace a newer comparison after a common-input edit retires the whole batch');

    await value("window.originalSpatialPost=Worker.prototype.postMessage;window.holdSpatialResponse=true;Worker.prototype.postMessage=function(m,...a){if(window.holdSpatialResponse&&m.operation==='prepare'){window.holdSpatialResponse=false;const handler=this.onmessage;this.onmessage=e=>{window.releaseOldSpatialWorker=()=>handler(e)}}return window.originalSpatialPost.call(this,m,...a)}");
    await click('spatial-run'); await until("typeof window.releaseOldSpatialWorker==='function'");
    await field('spatial-bins', 16); await click('spatial-run'); await state('compatible');
    const sixteen = prepareSpatialProfileEvidence([...independent].reverse(), { ...raw.query, bins: 16 }); await matches(sixteen.report);
    await value('window.releaseOldSpatialWorker()'); await delay(120); await matches(sixteen.report);
    await value('Worker.prototype.postMessage=window.originalSpatialPost');
    checks.push('A held response from the actual old worker cannot replace a newer complete 16-bin inquiry');

    const mismatch = structuredClone(raw); mismatch.readings[1].source.declaration.path.gridColumnBearingDeg += 10;
    const mismatchPath = runDirectory + '/different-orientation.json'; await writeFile(mismatchPath, JSON.stringify(mismatch));
    await files('#spatial-reopen', [mismatchPath]); await state('file-refused'); await matches(sixteen.report);
    assert.match(await value("document.getElementById('spatial-status').textContent"), /agree exactly/);
    const impossible = structuredClone(raw); impossible.readings[1].query.reading.temperatureC = 50;
    const impossiblePath = runDirectory + '/no-common-profile.json'; await writeFile(impossiblePath, JSON.stringify(impossible));
    await files('#spatial-reopen', [impossiblePath]); await state('incompatible');
    await matches(parseSpatialProfileEvidence(JSON.stringify(impossible)).report);
    assert.equal(await value("document.getElementById('spatial-witness')"), null);
    assert.equal(await value("document.getElementById('spatial-export').disabled"), false);
    const emptySave = await download('incompatible'); assert.deepEqual(emptySave.parsed.investigation, impossible);
    const forged = runDirectory + '/saved-report.json'; await writeFile(forged, JSON.stringify({ ...raw, report: reference.report }));
    await files('#spatial-reopen', [forged]); await state('file-refused');
    assert.equal(await value("document.getElementById('spatial-results').dataset.status"), 'incompatible');
    checks.push('Mismatched original orientation refuses, incompatible common skies remain an exportable completed empty result, and forged results cannot replace it');

    await files('#spatial-reopen', [saved.path]); await state('compatible'); await matches(reference.report);
    for (const [width, height, mobile] of [[1440, 1000, false], [390, 844, true]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, mobile, deviceScaleFactor: 1 }); await delay(80);
      assert.ok(await value('document.documentElement.scrollWidth<=innerWidth+1'));
      for (const [id, label] of [['spatial-sources', 'originals'], ['spatial-results', 'range'], ['spatial-witness', 'witness']]) {
        await value('document.getElementById(' + JSON.stringify(id) + ').scrollIntoView({block:"start",behavior:"instant"})');
        await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        await writeFile(runDirectory + '/spatial-' + label + '-' + width + '.png', Buffer.from(shot.data, 'base64'));
      }
    }
    assert.equal(await stored(), originalStorage); assert.deepEqual(exceptions, []);
    checks.push('Actual original-file controls, paired ranges and witness tables fit desktop and 390px with no application exceptions or project-storage mutation');
    return { checks, sandbox: session.sandbox, exceptions };
  });
  const receipt = { status: 'PASS', ...result.value, receipt: result.receipt };
  await writeFile(runDirectory + '/browser.json', JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error), checks, receipt: error.receipt ?? null, runDirectory }, null, 2));
  process.exitCode = 1;
}
