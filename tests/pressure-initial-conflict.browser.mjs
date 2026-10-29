import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
import { pressureInitialRangeConflictExample } from '../pressure-initial-range-example.js';
const root = fileURLToPath(new URL('../', import.meta.url)), runDirectory = process.env.BROWSER_RUN_DIRECTORY;
const paths = ['pressure-initial-range.js', 'pressure-initial-range-page.js', 'pressure-initial-range-example.js',
  'pressure-initial-range.html', 'pressure-initial-range.css', 'tests/pressure-initial-conflict.browser.mjs'];
const hash = p => createHash('sha256').update(readFileSync(root + p)).digest('hex');
const sourceHashes = Object.fromEntries(paths.map(p => [p, hash(p)])), groups = [];
try {
  await withBrowserSession({ root, runDirectory, chromeBin: process.env.CHROME_BIN }, async session => {
    const { send, evaluate, baseUrl, sandbox, exceptions } = session;
    await send('Runtime.enable'); await send('Page.enable');
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: runDirectory });
    async function until(condition) {
      for (let i = 0; i < 160; i++) { try { if (await evaluate(condition)) return; } catch {} await delay(40); }
      throw Error('Timed out: ' + condition + ' ' + JSON.stringify(await evaluate("({status:document.querySelector('#range-status')?.textContent,import:document.querySelector('#range-import-status')?.textContent,ready:document.readyState})")));
    }
    let importSerial = 0;
    async function openInquiry(input) {
      const filename = "original-conflict-" + (++importSerial) + ".json";
      await evaluate('(()=>{const f=document.querySelector("#range-inquiry-file"),d=new DataTransfer();d.items.add(new File([' +
        JSON.stringify(JSON.stringify(input)) + '],' + JSON.stringify(filename) + ',{type:"application/json"}));f.files=d.files;f.dispatchEvent(new Event("change",{bubbles:true}));})()');
      await until("document.querySelector('#range-import-status').textContent.includes(" + JSON.stringify("Opened " + filename) + ") && !document.querySelector('#range-download').disabled");
    }
    async function capture(name, expression) {
      await evaluate('(()=>{const e=' + expression + ';e.scrollIntoView({block:"start",behavior:"instant"});window.scrollBy(0,-10);const r=e.getBoundingClientRect();if(r.top>innerHeight||r.bottom<0)throw Error("Capture target absent");})()');
      await delay(70); const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(runDirectory + '/' + name, Buffer.from(r.data, 'base64'));
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await until("!!document.querySelector('#pressure-batches-open')");
    const originalSite = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
    await evaluate("document.querySelector('#pressure-batches-open').click()");
    await until("!!document.querySelector('#batch-initial-range-open')");
    await evaluate("document.querySelector('#batch-initial-range-open').click()");
    await until("!!document.querySelector('#range-conflict-example') && document.readyState==='complete'");
    await evaluate("document.querySelector('#range-conflict-example').click()");
    await until("!document.querySelector('#range-download').disabled");
    const example = pressureInitialRangeConflictExample();
    const ids = await evaluate("[...document.querySelectorAll('[data-separating-reading]')].map(e=>e.dataset.separatingReading)");
    assert.deepEqual(ids, [example.study.readings[1].id, example.study.readings[0].id]);
    assert.match(await evaluate("document.querySelectorAll('[data-separating-reading]')[0].textContent"), /requires a larger starting amount/);
    assert.match(await evaluate("document.querySelectorAll('[data-separating-reading]')[1].textContent"), /requires a smaller starting amount/);
    assert.match(await evaluate("document.querySelector('.range-separating-witness').textContent"), /At one checked starting amount/);
    groups.push('visible workbench entry exposes the two original readings and opposite requirements at one shared numerical separator');

    const literal = '  Original <img src=x onerror="window.__separatorInjection=1"> µ source  ';
    for (const r of example.study.readings) { r.volume *= 1000; r.uncertainty *= 1000; r.unit = 'mL'; r.source = literal + r.id; }
    await openInquiry(example);
    const acceptedText = await evaluate("document.querySelector('.range-separating-witness').textContent");
    assert.ok(acceptedText.includes(literal));
    for (const r of example.study.readings) assert.ok(acceptedText.includes(String(r.volume) + ' ± ' + String(r.uncertainty) + ' mL'));
    assert.equal(await evaluate('window.__separatorInjection??null'), null);
    assert.equal(await evaluate("document.querySelectorAll('.range-separating-witness img').length"), 0);
    await evaluate("document.querySelector('#range-download').click()");
    const file = runDirectory + '/experimental-earth-pressure-initial-range.json';
    for (let i = 0; i < 160 && !existsSync(file); i++) await delay(40);
    assert.ok(existsSync(file)); const downloaded = JSON.parse(readFileSync(file, 'utf8'));
    assert.deepEqual(downloaded, example); assert.equal(JSON.stringify(downloaded).includes('separatingWitness'), false);
    await evaluate('window.__oldConflictPage=true');
    await send('Page.navigate', { url: baseUrl + 'pressure-initial-range.html?fresh=conflict' });
    await until("!window.__oldConflictPage && !!document.querySelector('#range-inquiry-file') && document.readyState==='complete'");
    await openInquiry(downloaded);
    assert.equal(await evaluate("document.querySelector('.range-separating-witness').textContent"), acceptedText);
    groups.push('literal original sources and full mL readings survive actual input-only download and fresh certificate recomputation');

    const held = structuredClone(downloaded); for (const r of held.study.readings) r.role = 'challenge';
    await openInquiry(held);
    const roles = await evaluate("[...document.querySelectorAll('[data-separating-reading]')].map(e=>e.textContent)");
    assert.equal(roles.length, 2); assert.ok(roles.every(s => s.includes('Held aside. Original:')));
    assert.match(await evaluate("document.querySelector('#range-detail').textContent"), /No calibration readings/);
    await evaluate("document.querySelector('[data-candidate-id=\"Slow head-neglected control\"]').click()");
    assert.equal(await evaluate("document.querySelectorAll('.range-separating-witness').length"), 0);
    const endpoint = structuredClone(downloaded); endpoint.study.readings = [{ ...endpoint.study.readings[0], volume: 100000 }];
    await openInquiry(endpoint);
    assert.equal(await evaluate("document.querySelectorAll('.range-separating-witness').length"), 0);
    assert.match(await evaluate("document.querySelector('#range-detail').textContent"), /Even at the largest/);
    groups.push('held-aside roles remain separate; retained explanations and single-row endpoint refusals receive no fabricated pair');

    await openInquiry(downloaded);
    const layouts = [];
    for (const [width, height, label] of [[1440, 1000, 'desktop'], [390, 844, 'mobile']]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 390 });
      await capture(label + '-conflict-readings.png', 'document.querySelector(".range-separating-witness")');
      const layout = await evaluate("({width:innerWidth,page:document.documentElement.scrollWidth})");
      assert.ok(layout.page <= width + 1); layouts.push(layout);
    }
    await capture('mobile-requires-less.png', 'document.querySelectorAll("[data-separating-reading]")[1]');
    assert.deepEqual(exceptions, []); assert.ok(sandbox.admitted);
    assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), originalSite);
    assert.deepEqual(paths.filter(p => hash(p) !== sourceHashes[p]), []);
    groups.push('desktop and390px captures retain original bands, fixed allowance and literal source with no overflow, script exceptions or site adoption');
    writeFileSync(runDirectory + '/receipt.json', JSON.stringify({ status: 'pass', groups, layouts, sourceHashes, sandbox,
      qualification: 'Original-reading explanation of a conditional numerical conflict; authored data, no physical validation or deletion of evidence.' }, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'pass', groups: groups.length }));
  });
} catch (error) {
  if (existsSync(runDirectory)) writeFileSync(runDirectory + '/failure.json', JSON.stringify({ status: 'failed', groupsCompleted: groups, sourceHashes, error: String(error.stack ?? error) }, null, 2) + '\n');
  throw error;
}
