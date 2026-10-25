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
const runDirectory = root + '.browser-run-bottom-evidence-' + randomUUID(), checks = [];
const p = makeExample(), s = { absorptivity: .8, capacityJm2K: 20000, exchangeWm2K: 10, initialC: 20, source: 'Authored fixed source' };
p.surfaceHeatStudy = prepareSurfaceHeatStudy(p, { cellIndex: 0, existing: s, proposal: s, schedule: [
  { minutes: 60, incidentWm2: 700, reservoirC: 20, source: 'Authored pulse' },
  { minutes: 360, incidentWm2: 0, reservoirC: 20, source: 'Authored dark interval' }
] });
const lower = { capacityJm2K: 80000, conductanceWm2K: 20, initialC: 20, source: 'Authored lower store' };
p.heatColumnStudy = prepareHeatColumnStudy(p, { existing: lower, proposal: lower });
try {
  const result = await withBrowserSession({ root, runDirectory, chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome' }, async session => {
    const { evaluate, send, exceptions } = session; await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
    async function until(expression) { for (let i = 0; i < 150; i++) { try { if (await evaluate(expression)) return; } catch {} await delay(40); } throw Error('Timed out: ' + expression); }
    async function file(selector, path) { const doc = await send('DOM.getDocument'), input = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector }); await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [path] }); }
    const click = selector => evaluate('document.querySelector(' + JSON.stringify(selector) + ').click()');
    async function set(selector, value) { await evaluate('(()=>{const e=document.querySelector(' + JSON.stringify(selector) + ');e.value=' + JSON.stringify(String(value)) + ';e.dispatchEvent(new Event(e.tagName==="SELECT"?"change":"input",{bubbles:true}));})()'); }
    const hyp = (i, key) => '#bottom-evidence-hypotheses fieldset:nth-child(' + (i + 1) + ') [data-key="' + key + '"]';
    const row = (i, key) => '#bottom-evidence-readings fieldset:nth-child(' + (i + 1) + ') [data-key="' + key + '"]';
    const contents = () => evaluate("document.getElementById('bottom-evidence-results').textContent");
    const statusAt = index => evaluate('document.querySelectorAll("#bottom-evidence-results article")[' + index + '].querySelector("p").textContent');
    async function compare() { await evaluate("document.getElementById('bottom-evidence-form').requestSubmit()"); await until("!document.getElementById('bottom-evidence-download').disabled"); }
    await until("Boolean(document.getElementById('bottom-evidence-form'))");
    const originalPath = runDirectory + '/original-project.json'; await writeFile(originalPath, JSON.stringify(p)); await file('#import', originalPath);
    await until("JSON.parse(localStorage.getItem('experimental-earth-site-v1')).heatColumnStudy?.lowerLayers.existing.capacityJm2K===80000");
    for (const target of ['existing', 'proposal']) for (const [key, value] of Object.entries({ conductance: 10, temperature: 20, source: 'Original authored boundary' })) await set('#bottom-' + target + '-' + key, value);
    await evaluate("document.getElementById('bottom-form').requestSubmit()"); await until("!document.getElementById('bottom-download').disabled");
    await click('#bottom-evidence-source'); await set('#bottom-evidence-association', 'Authored fixed-source surface association; not acquired measurements');
    for (let i = 0; i < 5; i++) {
      if (i) await click('#bottom-evidence-add-hypothesis');
      for (const [key, value] of Object.entries({ label: 'b' + [0, 5, 10, 20, 50][i], conductance: [0, 5, 10, 20, 50][i], low: -20, high: 60,
        source: '<img src=x onerror=window.__bottomEvidenceInjected=1> Authored alternative' })) await set(hyp(i, key), value);
    }
    await click('#bottom-evidence-add-reading');
    for (let i = 0; i < 2; i++) for (const [key, value] of Object.entries({ minute: i ? 420 : 60,
      temperature: i ? 20.171312173325774 : 43.73770625579893, width: .05,
      use: i ? 'challenge' : 'calibration', source: 'Frozen independent authored RK4 control; no field acquisition' })) await set(row(i, key), value);
    await compare();
    assert.equal(await statusAt(0), 'calibration rejected'); assert.equal(await statusAt(2), 'compatible range');
    for (const i of [1, 3, 4]) assert.equal(await statusAt(i), 'challenged');
    assert.match(await contents(), /19.87366 to 20.12634/);
    assert.equal(await evaluate("document.querySelectorAll('#bottom-evidence img').length"), 0);
    assert.equal(await evaluate('window.__bottomEvidenceInjected??null'), null);
    checks.push('Actual accepted-source handoff and original point-band forms retain confounding, then separate offered conductances with held-aside evidence');

    // Parent source/draft changes must not reinterpret retained evidence.
    const prior = await contents(); await set('#bottom-existing-temperature', 50); assert.equal(await contents(), prior);
    await set(row(1, 'temperature'), 50); assert.equal(await evaluate("document.getElementById('bottom-evidence-results').children.length"), 0);
    await click('#bottom-evidence-restore'); assert.equal(await contents(), prior);
    assert.equal(await evaluate('document.querySelector(' + JSON.stringify(row(1, 'temperature')) + ').value'), '20.171312173325774');
    checks.push('Original source is independent of parent drafts; dirty evidence hides results and restores accepted readings');

    // Receive actual complete averaging supports, not endpoint substitutions.
    for (let i = 0; i < 2; i++) {
      await set(row(i, 'aggregation'), 'interval-mean'); await set(row(i, 'from'), i ? 360 : 0);
      await set(row(i, 'temperature'), i ? 20.24339897746524 : 37.26099807977096);
    }
    await compare(); assert.equal(await statusAt(2), 'compatible range'); assert.match(await contents(), /0–60 min mean/);
    await set(row(0, 'aggregation'), 'instant'); await compare(); assert.equal(await statusAt(2), 'challenged');
    await set(row(0, 'aggregation'), 'interval-mean'); await compare(); assert.equal(await statusAt(2), 'compatible range');
    checks.push('True means use complete intervals; interpreting the same first-hour value as an endpoint fails the held-aside intersection');

    const download = runDirectory + '/download'; await mkdir(download);
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: download }); await click('#bottom-evidence-download');
    const exportedPath = download + '/bottom-surface-investigation.json';
    for (let i = 0; i < 125; i++) { try { await access(exportedPath); break; } catch { await delay(40); } }
    const exported = JSON.parse(await readFile(exportedPath, 'utf8'));
    assert.deepEqual(exported.original.heatColumnStudy, p.heatColumnStudy);
    assert.equal(exported.readings[0].aggregation, 'interval-mean'); assert.equal(exported.readings[0].fromMinute, 0);
    assert.equal(exported.readings[1].use, 'challenge'); assert.equal(exported.report, undefined);
    await send('Page.reload', { ignoreCache: true }); await until("Boolean(document.getElementById('bottom-evidence-form'))");
    await file('#bottom-evidence-file', exportedPath); await until("!document.getElementById('bottom-evidence-download').disabled");
    assert.equal(await statusAt(2), 'compatible range'); const reopened = await contents();
    const malformedPath = runDirectory + '/malformed.json'; await writeFile(malformedPath, '{"bad":');
    await file('#bottom-evidence-file', malformedPath); await until("document.getElementById('bottom-evidence-status').textContent.startsWith('Replacement refused')");
    assert.equal(await contents(), reopened); assert.equal(await evaluate("document.getElementById('bottom-evidence-download').disabled"), false);
    checks.push('Actual original-input download/fresh reopen and malformed replacement retain sources, means, roles and accepted results');

    await evaluate("window.__evidenceText=File.prototype.text;File.prototype.text=function(){if(this.name==='bottom-surface-investigation.json')return new Promise(resolve=>{window.__resolveEvidence=resolve;});return window.__evidenceText.call(this);}");
    await file('#bottom-evidence-file', exportedPath); await until("typeof window.__resolveEvidence==='function'");
    await set(row(0, 'temperature'), 12);
    await evaluate('window.__resolveEvidence(' + JSON.stringify(JSON.stringify(exported)) + ')'); await delay(80);
    assert.equal(await evaluate('document.querySelector(' + JSON.stringify(row(0, 'temperature')) + ').value'), '12');
    assert.equal(await evaluate("document.getElementById('bottom-evidence-results').children.length"), 0);
    await evaluate('File.prototype.text=window.__evidenceText'); await click('#bottom-evidence-restore');
    assert.equal(await contents(), reopened);
    checks.push('Late old file completion cannot replace a newer draft or invent a successful comparison');

    await until("(()=>{const e=document.getElementById('toast');return !e||(!e.classList.contains('show')&&Number(getComputedStyle(e).opacity)===0);})()");
    for (const [name, width, height] of [['narrow', 390, 844], ['desktop', 1440, 1000]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: name === 'narrow' });
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      await evaluate("document.getElementById('bottom-evidence-results').scrollIntoView({block:'start',behavior:'instant'})");
      await until("(()=>{const r=document.getElementById('bottom-evidence-results').getBoundingClientRect();return r.top>=-1&&r.top<100;})()");
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(runDirectory + '/bottom-evidence-' + name + '.png', Buffer.from(shot.data, 'base64'));
    }
    assert.deepEqual(exceptions, []); checks.push('Desktop/narrow continuous-interval chart and source records fit the actual viewport without page exceptions');
    return { checks, sandbox: session.sandbox };
  });
  console.log(JSON.stringify({ status: 'PASS', ...result.value, receipt: result.receipt }, null, 2));
} catch (error) { console.error(JSON.stringify({ status: 'FAIL', error: String(error), checks, receipt: error.receipt ?? null }, null, 2)); process.exitCode = 1; }
