import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
import { inspectSoilAirBox, parseSoilAirBox } from '../soil-air-box.js';
import { makeSoilAirBoxExample } from '../soil-air-box-example.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? root + '.browser-air-box-' + randomUUID();
const chromeBin = process.env.CHROME_BIN ?? '/opt/google/chrome/chrome';
const paths = ['soil-air-box.js', 'soil-air-box-example.js', 'soil-air-box-page.js', 'soil-air-box.html',
  'soil-air-box.css', 'soil-air-boundary.html', 'soil-air-boundary.js', 'tests/soil-air-box.browser.mjs'];
const hash = path => createHash('sha256').update(readFileSync(root + path)).digest('hex');
const sourceHashes = Object.fromEntries(paths.map(path => [path, hash(path)]));
const groups = [], layouts = [];
const fixed = (overrides = {}) => {
  const source = makeSoilAirBoxExample();
  const values = { columnDepth: 100, initialFront: 10, pondingHead: 5, capillaryHead: 15, atmosphericHead: 1408, targetFront: 20, ...overrides };
  for (const [name, value] of Object.entries(values)) source.parameters[name] = { lower: value, upper: value, unit: 'mm', source: `Authored exact ${name} control.` };
  source.title = 'Authored exact threshold control'; return source;
};
function nextUp(value) {
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, false);
  view.setBigUint64(0, view.getBigUint64(0, false) + 1n, false); return view.getFloat64(0, false);
}
try {
  await withBrowserSession({ root, chromeBin, runDirectory }, async session => {
    const { send, evaluate, baseUrl, sandbox, exceptions } = session;
    await send('Runtime.enable'); await send('Page.enable');
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: runDirectory, eventsEnabled: true });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    async function until(expression) {
      for (let i = 0; i < 160; i++) { try { if (await evaluate(expression)) return; } catch {} await delay(40); }
      throw Error('Timed out: ' + expression + ' ' + JSON.stringify(await evaluate("({status:document.querySelector('#status')?.textContent,url:location.href})")));
    }
    async function importText(text, filename) {
      await evaluate('(()=>{const input=document.querySelector("#reopen"),transfer=new DataTransfer();transfer.items.add(new File([' + JSON.stringify(text) + '],' + JSON.stringify(filename) + ',{type:"application/json"}));input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));})()');
    }
    async function open(source, name = 'original-ranges.json') {
      await importText(JSON.stringify(source), name);
      await until("document.querySelector('#status').dataset.state==='ready'");
    }
    async function capture(name, selector = '#results') {
      await evaluate('document.querySelector(' + JSON.stringify(selector) + ').scrollIntoView({block:"start",behavior:"instant"});window.scrollBy({top:-12,left:0,behavior:"instant"})');
      await delay(80);
      const png = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(runDirectory + '/' + name, Buffer.from(png.data, 'base64'));
    }
    const fields = "[...document.querySelectorAll('#form input,#form select,#form textarea')].map(e=>({id:e.id,value:e.value,checked:e.checked}))";
    await send('Page.navigate', { url: baseUrl + 'soil-air-boundary.html' });
    await until("!!document.querySelector('#air-box-open') && document.readyState==='complete'");
    const site = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
    await evaluate("document.querySelector('#air-box-open').click()");
    await until("!!document.querySelector('#example') && document.readyState==='complete'");
    assert.equal(await evaluate("document.querySelector('#columnDepth-lower').value"), '');
    assert.equal(await evaluate("document.querySelector('#assumption-allRangeCombinations').checked"), false);
    assert.equal(await evaluate("document.querySelector('#export').disabled"), true);
    await evaluate("document.querySelector('#example').click()");
    assert.equal(await evaluate("document.querySelector('#results').dataset.classification"), 'all-require-removal');
    assert.equal(await evaluate("document.querySelector('[data-bound=lower]').textContent"), '50.6401%');
    assert.equal(await evaluate("document.querySelector('[data-bound=upper]').textContent"), '88.0316%');
    assert.match(await evaluate("document.querySelector('#results').textContent"), /71909 \/ 142000/);
    assert.match(await evaluate("document.querySelector('#results').textContent"), /48523 \/ 55120/);
    assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), site);
    groups.push('existing static inquiry opens a blank explicit range inquiry; the authored whole-box bounds and attained fractions agree without changing the working site');

    const literal = '  Original <img src=x onerror="window.__boxInjected=true"> & α\nfull range source  ';
    const original = makeSoilAirBoxExample();
    for (const [name, scale, unit] of [['columnDepth', 10, 'cm'], ['initialFront', 10, 'cm'], ['pondingHead', 10, 'cm'], ['atmosphericHead', 10, 'cm'], ['targetFront', 10, 'cm'], ['capillaryHead', 1000, 'm']]) {
      original.parameters[name].lower /= scale; original.parameters[name].upper /= scale; original.parameters[name].unit = unit;
    }
    original.parameters.columnDepth.source = literal; original.parameters.capillaryHead.source = literal;
    original.title = 'Original mixed-unit range declaration';
    await open(original);
    assert.equal(await evaluate("document.querySelector('#columnDepth-source').value"), literal);
    assert.equal(await evaluate("document.querySelector('#results img')!==null"), false);
    assert.equal(await evaluate('window.__boxInjected??null'), null);
    assert.equal(await evaluate("document.querySelector('#capillaryHead-unit').value"), 'm');
    await evaluate("document.querySelector('#export').click()");
    const savePath = runDirectory + '/experimental-earth-soil-air-ranges.json';
    for (let i = 0; i < 160 && !existsSync(savePath); i++) await delay(40);
    assert.ok(existsSync(savePath));
    const savedText = readFileSync(savePath, 'utf8'), saved = parseSoilAirBox(savedText);
    assert.deepEqual(saved, original);
    assert.deepEqual(Object.keys(saved), ['schema', 'title', 'parameters', 'assumptions']);
    assert.deepEqual(inspectSoilAirBox(saved).display, inspectSoilAirBox(makeSoilAirBoxExample()).display);
    groups.push('actual source-only download retains every original range, mixed unit, literal source and explicit assumption without exporting derived conclusions');

    await evaluate('window.__oldBoxPage=true');
    await send('Page.navigate', { url: baseUrl + 'soil-air-box.html?fresh=1' });
    await until("!window.__oldBoxPage && !!document.querySelector('#example') && document.readyState==='complete'");
    await importText(savedText, 'actual-download.json'); await until("document.querySelector('#status').dataset.state==='ready'");
    const textBefore = await evaluate("document.querySelector('#results').textContent"), fieldsBefore = await evaluate(fields);
    await importText(JSON.stringify({ ...saved, preferredRelease: .8 }), 'forged-conclusion.json');
    await until("document.querySelector('#status').dataset.state==='refused'");
    assert.equal(await evaluate("document.querySelector('#results').textContent"), textBefore);
    assert.deepEqual(await evaluate(fields), fieldsBefore); assert.equal(await evaluate("document.querySelector('#export').disabled"), false);
    groups.push('a fresh page independently reopens the actual download; imported conclusions refuse atomically while the previous original inquiry remains available');

    for (const [target, classification, drive] of [[11, 'none-forced', 'positive water drive'], [12, 'none-forced', 'exactly zero water drive'], [20, 'all-require-removal', 'exactly zero water drive']]) {
      await open(fixed({ targetFront: target }));
      assert.equal(await evaluate("document.querySelector('#results').dataset.classification"), classification);
      assert.ok((await evaluate("document.querySelector('#results').textContent")).includes(drive));
    }
    const mixed = fixed(); mixed.parameters.targetFront.lower = 11; await open(mixed);
    assert.equal(await evaluate("document.querySelector('#results').dataset.classification"), 'mixed-requirement');
    const tiny = fixed({ targetFront: nextUp(12) }); await open(tiny);
    assert.equal(await evaluate("document.querySelector('[data-bound=lower]').textContent"), '0.0000%');
    assert.equal(await evaluate("document.querySelector('#results').dataset.classification"), 'all-require-removal');
    assert.match(await evaluate("document.querySelector('[data-notice=positive-below-display]').textContent"), /strictly positive/);
    const nearBase = fixed({ columnDepth: 1, initialFront: .000001, pondingHead: .000001, capillaryHead: 0, atmosphericHead: 1000, targetFront: .99999998 });
    await open(nearBase);
    assert.equal(await evaluate("document.querySelector('[data-bound=upper]').textContent"), '100.0000%');
    assert.match(await evaluate("document.querySelector('[data-notice=rounded-to-100]').textContent"), /exact maximum is below 100%/);
    await evaluate("(()=>{const input=document.querySelector('#targetFront-upper');input.value='1';input.dispatchEvent(new Event('input',{bubbles:true}));})()");
    assert.equal(await evaluate("document.querySelector('#results').hidden"), true);
    assert.equal(await evaluate("document.querySelector('#export').disabled"), true);
    await evaluate("document.querySelector('#form').requestSubmit()");
    assert.match(await evaluate("document.querySelector('#status').textContent"), /whole incompatible box is refused/);
    groups.push('zero and positive drive at zero removal, mixed requirements, positive below display and outward100% remain distinct; a base-touching box refuses as a whole and edits retire old results');

    const race = await evaluate('(async()=>{const original=File.prototype.arrayBuffer;let rejectOld;const assign=(name,text)=>{const input=document.querySelector("#reopen"),transfer=new DataTransfer();transfer.items.add(new File([text],name));input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}))};File.prototype.arrayBuffer=function(){if(this.name==="slow-invalid.json")return new Promise((_,reject)=>{rejectOld=reject});return original.call(this)};try{assign("slow-invalid.json","{");assign("newer-original.json",' + JSON.stringify(savedText) + ');for(let i=0;i<160&&document.querySelector("#status").dataset.state!=="ready";i++)await new Promise(resolve=>setTimeout(resolve,10));const text=document.querySelector("#results").textContent,status=document.querySelector("#status").textContent;rejectOld(Error("old read failed"));await new Promise(resolve=>setTimeout(resolve,40));return{accepted:document.querySelector("#title").value===' + JSON.stringify(saved.title) + ',same:text===document.querySelector("#results").textContent,statusSame:status===document.querySelector("#status").textContent}}finally{File.prototype.arrayBuffer=original}})()');
    assert.deepEqual(race, { accepted: true, same: true, statusSame: true });
    const late = await evaluate('(async()=>{const original=File.prototype.arrayBuffer;let finish;File.prototype.arrayBuffer=function(){return new Promise(resolve=>{finish=resolve})};try{const input=document.querySelector("#reopen"),transfer=new DataTransfer();transfer.items.add(new File(["pending"],"old-valid.json"));input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));const field=document.querySelector("#targetFront-lower");field.value="24";field.dispatchEvent(new Event("input",{bubbles:true}));finish(new TextEncoder().encode(' + JSON.stringify(savedText) + ').buffer);await new Promise(resolve=>setTimeout(resolve,40));return{value:field.value,hidden:document.querySelector("#results").hidden,disabled:document.querySelector("#export").disabled}}finally{File.prototype.arrayBuffer=original}})()');
    assert.deepEqual(late, { value: '24', hidden: true, disabled: true });
    groups.push('late failed and successful file reads cannot replace a newer accepted original or subsequent endpoint edits');

    await open(saved);
    for (const [width, height, name] of [[1440, 1000, 'desktop'], [390, 844, 'mobile']]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 390 });
      await capture(name + '-gas-box.png');
      const layout = await evaluate("({width:innerWidth,page:document.documentElement.scrollWidth,badControls:[...document.querySelectorAll('input,select,textarea,button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.left<-.5||r.right>innerWidth+.5)}).length,clippedBounds:[...document.querySelectorAll('.bound-value')].filter(e=>e.scrollWidth>e.clientWidth).length})");
      assert.ok(layout.page <= width, JSON.stringify(layout)); assert.equal(layout.badControls, 0); assert.equal(layout.clippedBounds, 0); layouts.push(layout);
    }
    await capture('mobile-gas-witness.png', '[data-witness=lower]');
    await open(tiny); await capture('mobile-positive-below-display.png');
    await open(nearBase); await capture('mobile-outward-100.png');
    assert.equal(await evaluate("[...document.querySelectorAll('.bound-value')].filter(e=>e.scrollWidth>e.clientWidth).length"), 0);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
    assert.deepEqual(exceptions, []);
    for (const path of paths) assert.equal(hash(path), sourceHashes[path], 'source unchanged during receiving: ' + path);
    groups.push('desktop and390px bound displays and original witnesses remain readable; positive-zero and outward100% notices fit without page/control/value overflow');
    writeFileSync(runDirectory + '/receipt.json', JSON.stringify({ status: 'passed', groups, layouts, sourceHashes, sandbox,
      sourceDownloadSHA256: createHash('sha256').update(savedText).digest('hex') }, null, 2) + '\n');
  });
  console.log(JSON.stringify({ status: 'passed', groups: groups.length, runDirectory }));
} catch (error) {
  if (existsSync(runDirectory)) writeFileSync(runDirectory + '/failure.json', JSON.stringify({ status: 'failed', groups, sourceHashes,
    error: error.message, stack: error.stack, cause: error.cause?.message }, null, 2) + '\n');
  throw error;
}
