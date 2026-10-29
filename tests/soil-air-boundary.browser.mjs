import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
import { parseSoilAirBoundary, inspectSoilAirBoundary } from '../soil-air-boundary.js';
import { soilAirBoundaryExample } from '../soil-air-boundary-example.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? root + '.browser-air-' + randomUUID();
const chromeBin = process.env.CHROME_BIN ?? '/opt/google/chrome/chrome';
const paths = ['soil-air-boundary.js', 'soil-air-boundary-example.js', 'soil-air-boundary-page.js',
  'soil-air-boundary.html', 'soil-air-boundary.css', 'pressure-batches.html', 'pressure-batches.css',
  'tests/soil-air-boundary.browser.mjs'];
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
      throw Error('Timed out: ' + expression + ' ' + JSON.stringify(await evaluate("({status:document.querySelector('#air-status')?.textContent,import:document.querySelector('#air-import-status')?.textContent})")));
    }
    async function importText(text, name) {
      await evaluate('(()=>{const f=document.querySelector("#air-import"),d=new DataTransfer();d.items.add(new File([' + JSON.stringify(text) + '],' + JSON.stringify(name) + ',{type:"application/json"}));f.files=d.files;f.dispatchEvent(new Event("change",{bubbles:true}));})()');
    }
    async function capture(name, selector) {
      await evaluate('document.querySelector(' + JSON.stringify(selector) + ').scrollIntoView({block:"start",behavior:"instant"});window.scrollBy({top:-10,left:0,behavior:"instant"})');
      await delay(70); const png = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(runDirectory + '/' + name, Buffer.from(png.data, 'base64'));
    }
    await until("!!document.querySelector('#pressure-batches-open') && document.readyState==='complete'");
    const site = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
    await evaluate("document.querySelector('#pressure-batches-open').click()");
    await until("!!document.querySelector('#batch-air-boundary-open') && document.readyState==='complete'");
    await evaluate("document.querySelector('#batch-air-boundary-open').click()");
    await until("!!document.querySelector('#air-example') && document.readyState==='complete'");
    assert.equal(await evaluate("document.querySelector('[name=atmosphericHead]').value"), '');
    assert.equal(await evaluate("document.querySelector('[name=assumptions]').checked"), false);
    assert.equal(await evaluate("document.querySelector('#air-download').disabled"), true);
    await evaluate("document.querySelector('#air-example').click()");
    assert.equal(await evaluate("document.querySelectorAll('[data-alternative-id]').length"), 3);
    assert.match(await evaluate("document.querySelector('#air-status').textContent"), /Authored mathematical example/);
    const example = inspectSoilAirBoundary(soilAirBoundaryExample());
    const displayed = await evaluate("document.querySelector('#air-results').textContent");
    for (const row of example.alternatives) {
      assert.ok(displayed.includes(String(row.closedAir.limitingFrontMm)));
      assert.ok(displayed.includes(String(row.target.minimumRemovedFraction)));
    }
    assert.match(displayed, /moles, or mass/); assert.match(displayed, /equality at the positive removal threshold gives zero driving force/);
    assert.match(displayed, /Counterfactual target head if all gas remained/);
    assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), site);
    groups.push('maintained workbench and batch entry reaches a blank explicit inquiry; authored static limits and counterfactual pressures match the executing API without changing the site');

    const literal = '  Original <img src=x onerror="window.__airInjected=true"> & α\nfull source  ';
    await evaluate('(()=>{const f=document.querySelector("#air-form"),set=(name,value)=>f.elements.namedItem(name).value=value;set("depth",40);set("initialFront",.5);set("columnUnit","cm");set("columnSource",' + JSON.stringify(literal) + ');set("pondingHead",.05);set("atmosphericHead",10.33);set("boundaryUnit","m");set("targetFront",.3);set("targetUnit","m");set("targetSource",' + JSON.stringify(literal) + ');f.dispatchEvent(new Event("input",{bubbles:true}));f.requestSubmit();})()');
    assert.equal(await evaluate("document.querySelectorAll('#air-results img').length"), 0);
    assert.equal(await evaluate('window.__airInjected??null'), null);
    assert.match(await evaluate("document.querySelector('#air-results').textContent"), /0.3 m/);
    assert.equal(await evaluate("document.querySelector('#air-download').disabled"), false);
    await evaluate("document.querySelector('#air-download').click()");
    const savePath = runDirectory + '/experimental-earth-soil-air-boundary.json';
    for (let i = 0; i < 160 && !existsSync(savePath); i++) await delay(40);
    assert.ok(existsSync(savePath)); const savedText = readFileSync(savePath, 'utf8'), saved = parseSoilAirBoundary(savedText);
    assert.equal(saved.column.source, literal); assert.equal(saved.target.source, literal);
    assert.equal(saved.column.unit, 'cm'); assert.equal(saved.boundary.unit, 'm'); assert.equal(saved.target.front, .3);
    assert.deepEqual(inspectSoilAirBoundary(saved).alternatives, example.alternatives);
    assert.deepEqual(Object.keys(saved), ['schema','title','column','boundary','target','hypotheses','assumptions']);
    groups.push('actual source-only download retains literal source text, distinct original units and exact physical declarations; no HTML executes or computed conclusions enter the file');

    await evaluate('window.__oldAirPage=true');
    await send('Page.navigate', { url: baseUrl + 'soil-air-boundary.html?fresh=1' });
    await until("!window.__oldAirPage && !!document.querySelector('#air-example') && document.readyState==='complete'");
    await importText(savedText, 'actual-downloaded-air-inquiry.json');
    await until("document.querySelector('#air-import-status').textContent.includes('Opened actual-downloaded-air-inquiry.json')");
    const accepted = await evaluate("document.querySelector('#air-results').textContent");
    const fields = "[...document.querySelectorAll('#air-form input,#air-form select,#air-form textarea')].map(e=>({name:e.name,value:e.value,checked:e.checked}))";
    const acceptedFields = await evaluate(fields);
    await importText(JSON.stringify({ ...saved, observedRelease: .5 }), 'forged-conclusion.json');
    await until("document.querySelector('#air-import-status').textContent.includes('Open refused')");
    assert.equal(await evaluate("document.querySelector('#air-results').textContent"), accepted);
    assert.deepEqual(await evaluate(fields), acceptedFields);
    assert.equal(await evaluate("document.querySelector('#air-download').disabled"), false);
    groups.push('fresh page recomputes the actual download; imported conclusions refuse atomically while the original accepted inquiry remains available');

    const control = soilAirBoundaryExample();
    control.column.depth = 100; control.column.initialFront = 10; control.boundary.pondingHead = 5; control.boundary.atmosphericHead = 1408;
    control.hypotheses = [{ id: 'Exact control', capillaryHead: 15, unit: 'mm', source: 'Authored exact 12 mm pressure-balance root.' }];
    for (const [front, text] of [[11,'No gas removal required'],[12,'numerical contact band'],[20,'At least 8.585859%']]) {
      control.target.front = front; await importText(JSON.stringify(control), 'static-front-' + front + '.json');
      await until('document.querySelector("#air-import-status").textContent.includes(' + JSON.stringify('Opened static-front-' + front + '.json') + ')');
      assert.ok((await evaluate("document.querySelector('#air-results').textContent")).includes(text));
    }
    await evaluate("(()=>{const f=document.querySelector('#air-form');f.elements.namedItem('targetFront').value=100;f.dispatchEvent(new Event('input',{bubbles:true}));})()");
    assert.equal(await evaluate("document.querySelector('#air-download').disabled"), true);
    assert.equal(await evaluate("document.querySelector('#air-results').textContent"), '');
    await evaluate("document.querySelector('#air-form').requestSubmit()");
    assert.match(await evaluate("document.querySelector('#air-status').textContent"), /Comparison refused.*before the base/);
    groups.push('before-root, exact numerical contact and beyond-root states stay distinct; an exact-base target refuses and edited inputs retire old conclusions');

    const race = await evaluate('(async()=>{const original=File.prototype.arrayBuffer;let rejectOld;const assign=(name,text)=>{const f=document.querySelector("#air-import"),d=new DataTransfer();d.items.add(new File([text],name));f.files=d.files;f.dispatchEvent(new Event("change",{bubbles:true}))};File.prototype.arrayBuffer=function(){if(this.name==="slow-invalid.json")return new Promise((_,reject)=>{rejectOld=reject});return original.call(this)};try{assign("slow-invalid.json","{");assign("newer-air.json",' + JSON.stringify(savedText) + ');for(let i=0;i<160&&!document.querySelector("#air-import-status").textContent.includes("Opened newer-air.json");i++)await new Promise(r=>setTimeout(r,10));const text=document.querySelector("#air-results").textContent,status=document.querySelector("#air-import-status").textContent;rejectOld(Error("old read failed"));await new Promise(r=>setTimeout(r,40));return {accepted:status.includes("Opened newer-air.json"),same:text===document.querySelector("#air-results").textContent,statusSame:status===document.querySelector("#air-import-status").textContent}}finally{File.prototype.arrayBuffer=original}})()');
    assert.deepEqual(race, { accepted: true, same: true, statusSame: true });
    const late = await evaluate('(async()=>{const original=File.prototype.arrayBuffer;let finish;File.prototype.arrayBuffer=function(){return new Promise(resolve=>{finish=resolve})};try{const f=document.querySelector("#air-import"),d=new DataTransfer();d.items.add(new File(["pending"],"old-valid.json"));f.files=d.files;f.dispatchEvent(new Event("change",{bubbles:true}));const input=document.querySelector("[name=targetFront]");input.value="0.2";input.dispatchEvent(new Event("input",{bubbles:true}));finish(new TextEncoder().encode(' + JSON.stringify(savedText) + ').buffer);await new Promise(r=>setTimeout(r,40));return {value:input.value,empty:document.querySelector("#air-results").textContent==="",disabled:document.querySelector("#air-download").disabled}}finally{File.prototype.arrayBuffer=original}})()');
    assert.deepEqual(late, { value: '0.2', empty: true, disabled: true });
    groups.push('late failed and successful file reads cannot replace a newer accepted inquiry or later physical input edits');

    await importText(savedText, 'final-original-air-inquiry.json');
    await until("document.querySelector('#air-import-status').textContent.includes('Opened final-original-air-inquiry.json')");
    const layouts = [];
    for (const [width, height, name] of [[1440,1000,'desktop'],[390,844,'mobile']]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 390 });
      await capture(name + '-air-limits.png', '#air-results');
      const layout = await evaluate("({width:innerWidth,page:document.documentElement.scrollWidth,badControls:[...document.querySelectorAll('input,select,textarea,button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.left<-.5||r.right>innerWidth+.5)}).length,chartFont:Math.min(...[...document.querySelectorAll('.air-chart svg text')].map(e=>parseFloat(getComputedStyle(e).fontSize)*e.ownerSVGElement.getBoundingClientRect().width/720))})");
      assert.ok(layout.page <= width, JSON.stringify(layout)); assert.equal(layout.badControls, 0); assert.ok(layout.chartFont >= 12, JSON.stringify(layout));
      const clippedLabels = await evaluate("[...document.querySelectorAll('.air-chart svg text')].map(e=>({text:e.textContent,box:e.getBBox()})).filter(x=>x.box.x<0||x.box.x+x.box.width>720||x.box.y<0||x.box.y+x.box.height>400).map(x=>x.text)");
      assert.deepEqual(clippedLabels, [], 'Every chart label fits inside the actual SVG view box'); layouts.push({...layout,clippedLabels});
    }
    await capture('mobile-air-chart.png', '.air-chart');
    await capture('mobile-air-target.png', '[data-alternative-id]');
    assert.deepEqual(exceptions, []);
    for (const p of paths) assert.equal(hash(p), sourceHashes[p], 'source unchanged during browser receiving: ' + p);
    groups.push('desktop and 390px original inquiry, chart and target results remain readable without horizontal overflow or browser exceptions');
    writeFileSync(runDirectory + '/receipt.json', JSON.stringify({ status:'passed',groups,layouts,sourceHashes,sandbox,sourceDownloadSha256:createHash('sha256').update(savedText).digest('hex') },null,2)+'\n');
  });
  console.log(JSON.stringify({status:'passed',groups:groups.length,runDirectory}));
} catch(error) {
  if(existsSync(runDirectory)) writeFileSync(runDirectory+'/failure.json',JSON.stringify({status:'failed',groups,sourceHashes,error:error.message,stack:error.stack,cause:error.cause?.message},null,2)+'\n');
  throw error;
}
