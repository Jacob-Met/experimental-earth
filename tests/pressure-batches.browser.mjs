import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
import { parsePressureBatches, serializePressureBatches, PRESSURE_BATCH_FILE_LIMIT } from '../pressure-batches.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? root + '.browser-batches-' + randomUUID();
const chromeBin = process.env.CHROME_BIN ?? '/opt/google/chrome/chrome';
const paths = ['pressure-batches.js', 'pressure-batches-example.js', 'pressure-batches.html', 'pressure-batches-page.js',
  'pressure-batches.css', 'pressure-head-panel.js', 'pressure-head.js', 'wetting-front.js', 'tests/pressure-batches.browser.mjs'];
const hash = path => createHash('sha256').update(readFileSync(root + path)).digest('hex');
const sourceHashes = Object.fromEntries(paths.map(p => [p, hash(p)])), groups = [];
try {
  await withBrowserSession({ root, chromeBin, runDirectory }, async session => {
    const { send, evaluate, baseUrl, exceptions, sandbox } = session;
    await send('Runtime.enable'); await send('Page.enable');
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: runDirectory, eventsEnabled: true });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    async function until(expression) {
      for (let i = 0; i < 120; i++) { try { if (await evaluate(expression)) return; } catch {} await delay(50); }
      throw Error('Timed out: ' + expression + ' ' + JSON.stringify(await evaluate("({status:document.querySelector('#batch-status')?.textContent,import:document.querySelector('#batch-import-status')?.textContent})")));
    }
    async function importText(text, name = 'original-inputs.json') {
      await evaluate('(()=>{const f=document.querySelector("#batch-import"),d=new DataTransfer();d.items.add(new File([' + JSON.stringify(text) + '],' + JSON.stringify(name) + ',{type:"application/json"}));f.files=d.files;f.dispatchEvent(new Event("change",{bubbles:true}));})()');
    }
    await send('Page.navigate', { url: baseUrl });
    await until("!!document.querySelector('#pressure-batches-open')");
    const site = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
    await evaluate("document.querySelector('#pressure-batches-open').click()");
    await until("!!document.querySelector('#batch-example') && document.readyState==='complete'");
    assert.match(await evaluate('location.pathname'), /pressure-batches\.html$/);
    assert.equal(await evaluate("document.querySelector('#batch-form').checkValidity()"), false);
    assert.equal(await evaluate("[...document.querySelectorAll('[data-field=moistureDeficit],[data-field=initialCumulativeMm]')].every(e=>e.value==='')"), true);
    assert.equal(await evaluate("document.querySelector('[name=assumptions]').checked"), false);
    groups.push('visible maintained-workbench entry, blank moisture/front admission and explicit instantaneous closed-account assumptions');

    await evaluate("document.querySelector('#batch-example').click()");
    await until("!document.querySelector('#batch-download').disabled");
    assert.equal(await evaluate("document.querySelectorAll('[data-candidate-id]').length"), 2);
    assert.match(await evaluate("document.querySelector('#batch-status').textContent"), /fictional/);
    assert.match(await evaluate("document.querySelector('#batch-detail').textContent"), /Before the addition/);
    assert.match(await evaluate("document.querySelector('#batch-detail').textContent"), /After the addition/);
    const literal = '<img src=x onerror="window.__batchInjected=1"> Authored original source, retained literally';
    await evaluate('(()=>{const a=document.querySelector("[data-kind=addition]");a.querySelector("[data-field=volume]").value="2000";a.querySelector("[data-field=unit]").value="mL";const r=document.querySelector("[data-kind=reading]");r.querySelector("[data-field=volume]").value="1.000000001";r.querySelector("[data-field=source]").value="Authored precision-display control, fictional reading and unchanged declared uncertainty";const s=document.querySelector("[name=source]");s.value=' + JSON.stringify(literal) + ';s.dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("#batch-run").click()})()');
    await until("!document.querySelector('#batch-download').disabled");
    assert.equal(await evaluate('window.__batchInjected??null'), null);
    assert.equal(await evaluate("document.querySelectorAll('#batch-results img').length"), 0);
    assert.match(await evaluate("document.querySelector('#batch-results').textContent"), /Original: 2,000 ± 50 mL/);
    assert.match(await evaluate("document.querySelector('#batch-results').textContent"), /Original: 1\.000000001 ± 0.1 L/);
    assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), site);
    groups.push('actual editable L/mL declarations compare both soil explanations and exact before/after readings without source markup execution or site adoption');

    await evaluate("document.querySelector('[data-candidate-id=\"Head neglected\"]').click()");
    assert.equal(await evaluate("document.querySelector('[data-candidate-id=\"Head neglected\"]').getAttribute('aria-pressed')"), 'true');
    assert.match(await evaluate("document.querySelector('#batch-detail').textContent"), /Outside the declared band/);
    await evaluate("document.querySelector('#batch-download').click()");
    const downloaded = runDirectory + '/experimental-earth-pressure-batches.json';
    for (let i = 0; i < 120 && !existsSync(downloaded); i++) await delay(50);
    assert.ok(existsSync(downloaded), 'actual browser file download');
    const savedText = readFileSync(downloaded, 'utf8'), saved = parsePressureBatches(savedText);
    assert.equal(saved.source, literal); assert.equal(saved.protocol.instantaneousBatches, true);
    assert.equal(saved.protocol.additions[0].volume, 2000); assert.equal(saved.protocol.additions[0].unit, 'mL');
    assert.equal(saved.readings[0].volume, 1.000000001);
    assert.deepEqual(saved.readings.filter(r => r.minute === 60).map(r => r.phase), ['before', 'after']);
    assert.deepEqual(Object.keys(saved), ['schema', 'title', 'place', 'source', 'protocol', 'hypotheses', 'readings']);
    groups.push('actual input-only download preserves original quantities, phases, sources and assumptions; a contradicted alternative remains inspectable');

    await evaluate("(()=>{const p=document.querySelectorAll('[data-kind=reading]')[1].querySelector('[data-field=phase]');p.value='no-addition';p.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#batch-run').click()})()");
    await until("document.querySelector('#batch-status').textContent.includes('Comparison refused')");
    assert.equal(await evaluate("document.querySelector('#batch-download').disabled"), true);
    assert.equal(await evaluate("document.querySelector('#batch-results').textContent"), '');
    await evaluate("(()=>{const p=document.querySelectorAll('[data-kind=reading]')[1].querySelector('[data-field=phase]');p.value='before';p.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#batch-run').click();const d=document.querySelector('[name=durationMinutes]');d.value='121';d.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await delay(40);
    assert.equal(await evaluate("document.querySelector('#batch-download').disabled"), true);
    assert.equal(await evaluate("document.querySelector('#batch-results').textContent"), '');
    assert.equal(await evaluate("document.querySelector('#batch-run').disabled"), false);
    groups.push('ambiguous batch-side reading refuses; edits retire export and an already queued comparison');

    await evaluate('window.__oldBatchDocument=true');
    await send('Page.navigate', { url: baseUrl + 'pressure-batches.html?fresh=1' });
    await until("!window.__oldBatchDocument && !!document.querySelector('#batch-example') && document.readyState==='complete'");
    await importText(savedText);
    await until("document.querySelector('#batch-status').textContent.includes('Recomputed') && !document.querySelector('#batch-download').disabled");
    const accepted = await evaluate("document.querySelector('#batch-results').textContent");
    assert.match(accepted, /Pressure endpoint/); assert.match(accepted, /Before the addition/); assert.match(accepted, /After the addition/);
    assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), site);
    await importText(JSON.stringify({ ...saved, result: { winner: 'forged' } }), 'forged.json');
    await until("document.querySelector('#batch-import-status').textContent.includes('Open refused')");
    assert.equal(await evaluate("document.querySelector('#batch-results').textContent"), accepted);
    assert.equal(await evaluate("document.querySelector('#batch-download').disabled"), false);
    groups.push('fresh page recomputes actual downloaded inputs; forged conclusions refuse atomically and preserve the previous accepted view');

    const expanded = structuredClone(saved), longSource = 'é'.repeat(150) + 'x'.repeat(850);
    expanded.title = 'Over-limit serialization must not change the accepted editor';
    expanded.protocol.additions = Array.from({ length: 64 }, (_, i) => ({ id: 'Batch ' + i, minute: i, volume: 1, unit: 'mL', source: longSource }));
    expanded.hypotheses = Array.from({ length: 9 }, (_, i) => ({ ...saved.hypotheses[0], id: 'Hypothesis ' + i, conductivityMmHr: 10 + i, source: longSource }));
    expanded.readings = Array.from({ length: 100 }, (_, i) => ({ id: 'Reading ' + i, minute: .25 + i * .5, phase: 'no-addition',
      volume: 1, uncertainty: .1, unit: 'mL', role: 'challenge', source: longSource }));
    const expandedRaw = JSON.stringify(expanded);
    assert.ok(Buffer.byteLength(expandedRaw) <= PRESSURE_BATCH_FILE_LIMIT);
    parsePressureBatches(expandedRaw);
    assert.throws(() => serializePressureBatches(expanded), /exceed220000/);
    const editorSnapshot = "[...document.querySelectorAll('#batch-form input,#batch-form select,#batch-form textarea')].map(e=>({name:e.name,field:e.dataset.field,value:e.value,checked:e.checked}))";
    const editorBeforeRefusal = await evaluate(editorSnapshot);
    await importText(expandedRaw, 'compact-valid-pretty-too-large.json');
    await until("document.querySelector('#batch-import-status').textContent.includes('Complete pressure-batch inputs exceed220000')");
    assert.deepEqual(await evaluate(editorSnapshot), editorBeforeRefusal);
    assert.equal(await evaluate("document.querySelector('#batch-results').textContent"), accepted);
    assert.equal(await evaluate("document.querySelector('#batch-download').disabled"), false);
    groups.push('compact input within the raw byte limit but beyond the saved-format limit refuses before changing any accepted editor field, view or export');

    const race = await evaluate('(async()=>{const original=File.prototype.text;let rejectOld;const assign=(name,text)=>{const f=document.querySelector("#batch-import"),d=new DataTransfer();d.items.add(new File([text],name));f.files=d.files;f.dispatchEvent(new Event("change",{bubbles:true}))};File.prototype.text=function(){if(this.name==="slow-bad.json")return new Promise((_,reject)=>{rejectOld=reject});return original.call(this)};try{assign("slow-bad.json","{");assign("new-valid.json",' + JSON.stringify(savedText) + ');for(let i=0;i<100&&!document.querySelector("#batch-import-status").textContent.includes("Opened new-valid.json");i++)await new Promise(r=>setTimeout(r,10));const text=document.querySelector("#batch-results").textContent,status=document.querySelector("#batch-import-status").textContent;rejectOld(Error("late old read"));await new Promise(r=>setTimeout(r,40));return {same:text===document.querySelector("#batch-results").textContent,statusSame:status===document.querySelector("#batch-import-status").textContent,enabled:!document.querySelector("#batch-download").disabled}}finally{File.prototype.text=original}})()');
    assert.deepEqual(race, { same: true, statusSame: true, enabled: true });
    groups.push('late failed file read cannot replace or erase a newer accepted original course');

    const layouts = [];
    for (const [width, height, label] of [[1440, 1000, 'desktop'], [390, 844, 'mobile']]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 390 });
      await evaluate("document.querySelector('#batch-detail').scrollIntoView({block:'start',behavior:'instant'});window.scrollBy({top:-10,left:0,behavior:'instant'})");
      await delay(70);
      const layout = await evaluate("(()=>({width:innerWidth,page:document.documentElement.scrollWidth,chart:document.querySelector('#batch-detail svg').getBoundingClientRect().toJSON(),badControls:[...document.querySelectorAll('input,select,textarea,button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.left<-.5||r.right>innerWidth+.5)}).length}))()");
      assert.ok(layout.page <= width + 1, 'page must not overflow horizontally'); assert.equal(layout.badControls, 0);
      const png = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(runDirectory + '/' + label + '-course.png', Buffer.from(png.data, 'base64')); layouts.push(layout);
    }
    await evaluate("document.querySelector('[data-reading-id=\"Before second batch\"]').scrollIntoView({block:'start',behavior:'instant'});window.scrollBy({top:-10,left:0,behavior:'instant'})");
    await delay(60);
    const phasePng = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(runDirectory + '/mobile-phases.png', Buffer.from(phasePng.data, 'base64'));
    assert.deepEqual(exceptions, []); assert.equal(sandbox.admitted, true);
    groups.push('desktop and390px source/curve/phase views captured with no horizontal overflow and ordinary Chromium sandbox admission');
    const changedDuringRun = paths.filter(p => sourceHashes[p] !== hash(p)); assert.deepEqual(changedDuringRun, []);
    writeFileSync(runDirectory + '/receipt.json', JSON.stringify({ status: 'pass', groups, sourceHashes, changedDuringRun, layouts, sandbox,
      interpretation: 'Authored mathematical course and input handling; no acquired field validation or remote publication.' }, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'pass', groups: groups.length, runDirectory }));
  });
} catch (error) {
  if (existsSync(runDirectory)) writeFileSync(runDirectory + '/failure.json', JSON.stringify({ status: 'failed', groupsCompleted: groups, sourceHashes, error: String(error.stack ?? error) }, null, 2) + '\n');
  throw error;
}
