import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
import { parsePressureInitialRange, serializePressureInitialRange, normalizePressureInitialRange,
  PRESSURE_INITIAL_RANGE_FILE_LIMIT } from '../pressure-initial-range.js';
import { pressureInitialRangeExample } from '../pressure-initial-range-example.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? root + '.browser-initial-range-' + randomUUID();
const chromeBin = process.env.CHROME_BIN ?? '/opt/google/chrome/chrome';
const paths = ['pressure-initial-range.js', 'pressure-initial-range-example.js', 'pressure-initial-range-page.js',
  'pressure-initial-range.html', 'pressure-initial-range.css', 'pressure-batches.js', 'pressure-batches.html',
  'pressure-batches.css', 'pressure-head.js', 'tests/pressure-initial-range.browser.mjs'];
const hash = name => createHash('sha256').update(readFileSync(root + name)).digest('hex');
const sourceHashes = Object.fromEntries(paths.map(p => [p, hash(p)])), groups = [];
try {
  await withBrowserSession({ root, chromeBin, runDirectory }, async session => {
    const { send, evaluate, baseUrl, sandbox, exceptions } = session;
    await send('Runtime.enable'); await send('Page.enable');
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: runDirectory, eventsEnabled: true });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    async function until(expression) {
      for (let i = 0; i < 160; i++) { try { if (await evaluate(expression)) return; } catch {} await delay(40); }
      throw Error('Timed out: ' + expression + ' ' + JSON.stringify(await evaluate("({status:document.querySelector('#range-status')?.textContent,import:document.querySelector('#range-import-status')?.textContent})")));
    }
    async function importText(id, text, name = 'original-inputs.json') {
      await evaluate('(()=>{const f=document.querySelector(' + JSON.stringify('#range-' + id) + '),d=new DataTransfer();d.items.add(new File([' +
        JSON.stringify(text) + '],' + JSON.stringify(name) + ',{type:"application/json"}));f.files=d.files;f.dispatchEvent(new Event("change",{bubbles:true}));})()');
    }
    async function file(name) {
      const path = runDirectory + '/' + name;
      for (let i = 0; i < 160 && !existsSync(path); i++) await delay(40);
      assert.ok(existsSync(path), 'actual downloaded file ' + name); return readFileSync(path, 'utf8');
    }
    async function capture(name, selector) {
      await evaluate('document.querySelector(' + JSON.stringify(selector) + ').scrollIntoView({block:"start",behavior:"instant"});window.scrollBy({top:-10,left:0,behavior:"instant"})');
      await delay(70);
      const png = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(runDirectory + '/' + name, Buffer.from(png.data, 'base64'));
    }
    await send('Page.navigate', { url: baseUrl });
    await until("!!document.querySelector('#pressure-batches-open')");
    const originalSite = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
    await evaluate("document.querySelector('#pressure-batches-open').click()");
    await until("!!document.querySelector('#batch-example') && document.readyState==='complete'");
    await evaluate("document.querySelector('#batch-example').click();document.querySelector('#batch-download').click()");
    const batchInputs = await file('experimental-earth-pressure-batches.json');
    await evaluate("document.querySelector('#batch-initial-range-open').click()");
    await until("!!document.querySelector('#range-example') && document.readyState==='complete'");
    assert.equal(await evaluate("document.querySelector('#range-run').disabled"), true);
    await importText('study-file', batchInputs, 'actual-downloaded-batch.json');
    await until("document.querySelector('#range-import-status').textContent.includes('No initial uncertainty was inferred')");
    assert.equal(await evaluate("document.querySelector('[name=lower]').value"), '');
    assert.equal(await evaluate("document.querySelector('[name=upper]').value"), '');
    assert.equal(await evaluate("document.querySelector('#range-form').checkValidity()"), false);
    assert.match(await evaluate("document.querySelector('#range-source').textContent"), /Original nominal starting water: 0 L/);
    groups.push('actual workbench to batch download to initial-water entry preserves the source and leaves physical uncertainty undeclared');

    await evaluate("document.querySelector('#range-example').click()");
    await until("!document.querySelector('#range-download').disabled && document.querySelector('#range-status').textContent.includes('fictional')");
    assert.equal(await evaluate("document.querySelectorAll('[data-candidate-id]').length"), 2);
    assert.match(await evaluate("document.querySelector('[data-candidate-id=\"Head neglected\"]').textContent"), /Held aside: No common starting amount/);
    assert.match(await evaluate("document.querySelector('[data-candidate-id=\"Pressure endpoint\"]').textContent"), /Held aside: A common starting amount/);
    const literal = '  Original <img src=x onerror="window.__rangeInjected=1"> range source with µ, retained literally  ';
    await evaluate('(()=>{const f=document.querySelector("#range-form");f.elements.namedItem("upper").value="1200";f.elements.namedItem("unit").value="mL";const s=f.elements.namedItem("rangeSource");s.value=' + JSON.stringify(literal) + ';s.dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("#range-run").click()})()');
    await until("!document.querySelector('#range-download').disabled");
    assert.equal(await evaluate('window.__rangeInjected??null'), null);
    assert.equal(await evaluate("document.querySelectorAll('#range-results img').length"), 0);
    assert.match(await evaluate("document.querySelector('#range-results').textContent"), /0–1,200 mL/);
    await evaluate("document.querySelector('[data-candidate-id=\"Pressure endpoint\"]').click()");
    assert.match(await evaluate("document.querySelector('#range-detail').textContent"), /calibration outer bracket/);
    assert.ok((await evaluate("document.querySelector('#range-detail').textContent")).includes(String(pressureInitialRangeExample().study.readings[0].volume)));
    assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), originalSite);
    groups.push('a shared calibration range keeps the pressure explanation while held-aside evidence rejects the head-neglected control; original mL/source precision and site are preserved');

    await evaluate("document.querySelector('#range-download').click()");
    const savedText = await file('experimental-earth-pressure-initial-range.json'), saved = parsePressureInitialRange(savedText);
    assert.deepEqual(Object.keys(saved), ['schema', 'study', 'initialWater', 'resolution']);
    assert.deepEqual(saved.study, pressureInitialRangeExample().study);
    assert.equal(saved.initialWater.unit, 'mL'); assert.equal(saved.initialWater.upper, 1200); assert.equal(saved.initialWater.source, literal);
    assert.deepEqual(saved.study.readings.map(r => r.role), ['calibration', 'challenge']);
    groups.push('actual inquiry download contains original course/range/resolution only, including the unchanged nominal point and reading roles');

    await evaluate("document.querySelector('#range-conflict-example').click()");
    await until("!document.querySelector('#range-download').disabled && document.querySelector('#range-source').textContent.includes('Each reading can fit')");
    assert.match(await evaluate("document.querySelector('[data-candidate-id=\"Pressure endpoint\"]').textContent"), /Calibration: No common starting amount/);
    assert.match(await evaluate("document.querySelector('#range-detail').textContent"), /Those requirements do not overlap/);
    assert.match(await evaluate("document.querySelector('[data-candidate-id=\"Slow head-neglected control\"]').textContent"), /Calibration: A common starting amount/);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await capture('conflict-mobile.png', '#range-detail');
    groups.push('two individually fitting but jointly incompatible readings reject the fast pressure explanation without inventing a different start for each row');

    await evaluate("(()=>{const x=document.querySelector('[name=lower]');x.value='1.1';x.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#range-run').click()})()");
    await until("document.querySelector('#range-status').textContent.includes('range must contain')");
    assert.equal(await evaluate("document.querySelector('#range-download').disabled"), true);
    assert.equal(await evaluate("document.querySelector('#range-results').textContent"), '');
    await evaluate("(()=>{const x=document.querySelector('[name=lower]');x.value='.2';x.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#range-run').click();const y=document.querySelector('[name=upper]');y.value='1.9';y.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await delay(100);
    assert.equal(await evaluate("document.querySelector('#range-results').textContent"), '');
    assert.equal(await evaluate("document.querySelector('#range-download').disabled"), true);
    assert.equal(await evaluate("document.querySelector('#range-run').disabled"), false);
    groups.push('range admission retains the original nominal declaration and edits cancel queued work without retaining a partial result');

    await evaluate('window.__oldRangeDocument=true');
    await send('Page.navigate', { url: baseUrl + 'pressure-initial-range.html?fresh=1' });
    await until("!window.__oldRangeDocument && !!document.querySelector('#range-example') && document.readyState==='complete'");
    await importText('inquiry-file', savedText, 'actual-downloaded-inquiry.json');
    await until("document.querySelector('#range-status').textContent.includes('Recomputed') && !document.querySelector('#range-download').disabled");
    const accepted = await evaluate("document.querySelector('#range-results').textContent");
    const editor = "({source:document.querySelector('#range-source').textContent,fields:[...document.querySelectorAll('#range-form input,#range-form select,#range-form textarea')].map(e=>({name:e.name,value:e.value}))})";
    const acceptedEditor = await evaluate(editor);
    await importText('inquiry-file', JSON.stringify({ ...saved, fittedStart: 0 }), 'forged-conclusion.json');
    await until("document.querySelector('#range-import-status').textContent.includes('Open refused')");
    assert.equal(await evaluate("document.querySelector('#range-results').textContent"), accepted); assert.deepEqual(await evaluate(editor), acceptedEditor);
    const expanded = structuredClone(saved), longSource = 'é'.repeat(220) + 'x'.repeat(780);
    expanded.study.title = 'Oversized normalized import must preserve the accepted inquiry';
    expanded.study.protocol.additions = Array.from({ length: 64 }, (_, i) => ({ id: 'Batch ' + i, minute: i, volume: 1, unit: 'mL', source: longSource }));
    expanded.study.hypotheses = Array.from({ length: 9 }, (_, i) => ({ ...saved.study.hypotheses[0], id: 'Hypothesis ' + i, conductivityMmHr: 10 + i, source: longSource }));
    expanded.study.readings = Array.from({ length: 100 }, (_, i) => ({ id: 'Reading ' + i, minute: .25 + i * .5, phase: 'no-addition', volume: 1, uncertainty: .1, unit: 'mL', role: 'challenge', source: longSource }));
    const expandedRaw = JSON.stringify(expanded), compactBytes = Buffer.byteLength(expandedRaw), normalizedBytes = Buffer.byteLength(JSON.stringify(normalizePressureInitialRange(expanded), null, 2));
    assert.ok(compactBytes <= PRESSURE_INITIAL_RANGE_FILE_LIMIT && normalizedBytes > PRESSURE_INITIAL_RANGE_FILE_LIMIT, JSON.stringify({ compactBytes, normalizedBytes }));
    parsePressureInitialRange(expandedRaw); assert.throws(() => serializePressureInitialRange(expanded), /exceed 240000/);
    await importText('inquiry-file', expandedRaw, 'compact-valid-normalized-too-large.json');
    await until("document.querySelector('#range-import-status').textContent.includes('exceed 240000')");
    assert.equal(await evaluate("document.querySelector('#range-results').textContent"), accepted); assert.deepEqual(await evaluate(editor), acceptedEditor);
    assert.equal(await evaluate("document.querySelector('#range-download').disabled"), false);
    groups.push('fresh replay recomputes the actual download; forged conclusions and compact-under-limit/normalized-over-limit inputs refuse before changing the accepted source, editor or result');

    const race = await evaluate('(async()=>{const original=File.prototype.text;let rejectOld;const assign=(name,text)=>{const f=document.querySelector("#range-inquiry-file"),d=new DataTransfer();d.items.add(new File([text],name));f.files=d.files;f.dispatchEvent(new Event("change",{bubbles:true}))};File.prototype.text=function(){if(this.name==="slow-bad.json")return new Promise((_,reject)=>{rejectOld=reject});return original.call(this)};try{assign("slow-bad.json","{");assign("new-valid.json",' + JSON.stringify(savedText) + ');for(let i=0;i<160&&!document.querySelector("#range-import-status").textContent.includes("Opened new-valid.json");i++)await new Promise(r=>setTimeout(r,10));const text=document.querySelector("#range-results").textContent,status=document.querySelector("#range-import-status").textContent;rejectOld(Error("late old file"));await new Promise(r=>setTimeout(r,50));return {newerAccepted:status.includes("Opened new-valid.json"),same:text===document.querySelector("#range-results").textContent,statusSame:status===document.querySelector("#range-import-status").textContent,enabled:!document.querySelector("#range-download").disabled}}finally{File.prototype.text=original}})()');
    assert.deepEqual(race, { newerAccepted: true, same: true, statusSame: true, enabled: true });
    const lateSuccess = await evaluate('(async()=>{const original=File.prototype.text;let finish;File.prototype.text=function(){return new Promise(resolve=>{finish=resolve})};try{const f=document.querySelector("#range-inquiry-file"),d=new DataTransfer();d.items.add(new File(["pending"],"slow-valid.json"));f.files=d.files;f.dispatchEvent(new Event("change",{bubbles:true}));const input=document.querySelector("[name=upper]");input.value="1800";input.dispatchEvent(new Event("input",{bubbles:true}));finish(' + JSON.stringify(savedText) + ');await new Promise(r=>setTimeout(r,70));return {upper:input.value,empty:document.querySelector("#range-results").textContent==="",disabled:document.querySelector("#range-download").disabled}}finally{File.prototype.text=original}})()');
    assert.deepEqual(lateSuccess, { upper: '1800', empty: true, disabled: true });
    await evaluate("document.querySelector('#range-example').click();document.querySelector('#range-cancel').click()");
    await delay(80);
    assert.match(await evaluate("document.querySelector('#range-status').textContent"), /Calculation stopped/);
    assert.equal(await evaluate("document.querySelector('#range-results').textContent"), '');
    assert.equal(await evaluate("document.querySelector('#range-download').disabled"), true);
    groups.push('late failed and successful file reads cannot erase newer acceptance or edits; explicit stop retires asynchronous work without a partial answer');

    await importText('inquiry-file', savedText, 'final-original-inquiry.json');
    await until("document.querySelector('#range-status').textContent.includes('Recomputed') && !document.querySelector('#range-download').disabled");
    await evaluate("document.querySelector('[data-candidate-id=\"Pressure endpoint\"]').click()");
    const layouts = [];
    for (const [width, height, label] of [[1440, 1000, 'desktop'], [390, 844, 'mobile']]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 390 });
      await capture(label + '-comparison.png', '#range-detail');
      const layout = await evaluate("(()=>({width:innerWidth,page:document.documentElement.scrollWidth,badControls:[...document.querySelectorAll('input,select,textarea,button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.left<-.5||r.right>innerWidth+.5)}).length,minimumChartFontPx:Math.min(...[...document.querySelectorAll('.range-chart svg text')].map(e=>parseFloat(getComputedStyle(e).fontSize)*e.ownerSVGElement.getBoundingClientRect().width/640))}))()");
      assert.ok(layout.page <= width + 1); assert.equal(layout.badControls, 0); assert.ok(layout.minimumChartFontPx >= 12);
      layouts.push(layout);
    }
    await capture('mobile-original-reading.png', '[data-reading-id="Later held-aside reading"]');
    assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), originalSite);
    assert.deepEqual(exceptions, []); assert.equal(sandbox.admitted, true);
    const changedDuringRun = paths.filter(p => hash(p) !== sourceHashes[p]); assert.deepEqual(changedDuringRun, []);
    groups.push('desktop and390px range/reading/contradiction views retain readable labels without overflow, script exceptions or site adoption');
    writeFileSync(runDirectory + '/receipt.json', JSON.stringify({ status: 'pass', groups, sourceHashes, changedDuringRun, layouts,
      importSizeControl: { compactBytes, normalizedBytes }, sandbox, interpretation: 'Authored mathematical and original-source consumer receiving, not field validation or remote integration.' }, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'pass', groups: groups.length, runDirectory }));
  });
} catch (error) {
  if (existsSync(runDirectory)) writeFileSync(runDirectory + '/failure.json', JSON.stringify({ status: 'failed', groupsCompleted: groups, sourceHashes, error: String(error.stack ?? error) }, null, 2) + '\n');
  throw error;
}
