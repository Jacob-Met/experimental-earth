import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = process.env.BROWSER_RUN_DIRECTORY || root + '.observation-export-' + randomUUID();
const js = JSON.stringify;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const reports = [];
const csvField = value => /[",\r\n]/.test(String(value))
  ? '"' + String(value).replaceAll('"', '""') + '"' : String(value);
const sources = ['Imported, "centimetres"\nsecond line', 'Imported inches — 水位 🌧'];
const manualSource = 'Manual, "precision" — café 水';
const originalCSV = [
  'cell,minute,depth,uncertainty,unit,source,scenario,use',
  ['A1', 5, 1.25, .125, 'cm', sources[0], 'existing', 'calibration'].map(csvField).join(','),
  ['B1', 10, .5, .0625, 'in', sources[1], 'proposal', 'challenge'].map(csvField).join(','),
].join('\r\n') + '\r\n';

await withBrowserSession({
  root, runDirectory, chromeBin: process.env.CHROME_BIN || '/opt/google/chrome/chrome',
}, async ({ evaluate, send, exceptions, sandbox, baseUrl }) => {
  await send('Runtime.enable');
  await send('Page.enable');
  async function wait(expression, label = expression) {
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if (await evaluate(expression)) return; }
      catch (error) {
        if (!/Execution context.*destroyed|Cannot find context with specified id|Cannot find default execution context/i.test(String(error))) throw error;
      }
      await delay(100);
    }
    throw Error('Timed out: ' + label);
  }
  await wait("document.readyState==='complete' && !!document.getElementById('export-observation-csv')");
  let receivingUrl = baseUrl;
  if (process.env.EARTH_RECEIVING_URL) {
    const target = new URL(process.env.EARTH_RECEIVING_URL);
    assert.equal(target.protocol, 'http:'); assert.equal(target.hostname, '127.0.0.1');
    assert.ok(target.port && Number(target.port) > 0);
    assert.equal(target.username, ''); assert.equal(target.password, '');
    assert.equal(target.pathname, '/'); assert.equal(target.search, ''); assert.equal(target.hash, '');
    const prior = await evaluate('performance.timeOrigin');
    await send('Page.navigate', { url: target.href });
    await wait('performance.timeOrigin!==' + prior +
      " && document.readyState==='complete' && !!document.getElementById('export-observation-csv')");
    assert.equal(await evaluate('location.href'), target.href);
    receivingUrl = target.href;
  }
  // Observe real worker completion; only delivery/failure is controlled below.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "(() => {\n  const NativeWorker = window.Worker;\n  const control = window.__csvWorkerDelivery = {\n    hold: false, workers: [],\n    queued() { return this.workers.reduce((n,w)=>n+w.queue.length,0); },\n    release() {\n      this.hold=false;\n      for (const worker of this.workers) {\n        if(worker.stopped)continue;\n        for(const message of worker.queue.splice(0))worker.forward(message);\n      }\n    },\n    failCompleted() {\n      const worker=[...this.workers].reverse().find(w=>!w.stopped&&w.queue.length);\n      if(!worker)throw Error('No completed native reply to fault');\n      worker.queue.length=0;worker.faulted=true;\n      worker.dispatchEvent(new ErrorEvent('error',{message:'Controlled CSV receiver worker failure',cancelable:true}));\n    },\n  };\n  class ControlledDeliveryWorker extends EventTarget {\n    constructor(...args) {\n      super();this.native=new NativeWorker(...args);this.queue=[];\n      this.stopped=false;this.faulted=false;this.handlers={};control.workers.push(this);\n      this.native.addEventListener('message',event=>{\n        if(this.stopped||this.faulted)return;\n        const payload={data:event.data,origin:event.origin,lastEventId:event.lastEventId,ports:event.ports};\n        if(control.hold)this.queue.push(payload);else this.forward(payload);\n      });\n      this.native.addEventListener('error',event=>{\n        if(this.stopped||this.faulted)return;\n        const forwarded=new ErrorEvent('error',{message:event.message,filename:event.filename,\n          lineno:event.lineno,colno:event.colno,error:event.error,cancelable:true});\n        if(!this.dispatchEvent(forwarded))event.preventDefault();\n      });\n      this.native.addEventListener('messageerror',event=>{\n        if(!this.stopped&&!this.faulted)this.dispatchEvent(new MessageEvent('messageerror',{data:event.data}));\n      });\n    }\n    forward(payload) {\n      if(!this.stopped&&!this.faulted)this.dispatchEvent(new MessageEvent('message',payload));\n    }\n    postMessage(...args) { return this.native.postMessage(...args); }\n    terminate() { this.stopped=true;this.queue.length=0;return this.native.terminate(); }\n  }\n  for(const type of ['message','error','messageerror']) {\n    Object.defineProperty(ControlledDeliveryWorker.prototype,'on'+type,{\n      configurable:true,get(){return this.handlers[type]||null;},\n      set(handler){\n        const prior=this.handlers[type];if(prior)this.removeEventListener(type,prior);\n        this.handlers[type]=typeof handler==='function'?handler:null;\n        if(this.handlers[type])this.addEventListener(type,this.handlers[type]);\n      },\n    });\n  }\n  window.Worker=ControlledDeliveryWorker;\n})();" });
  const priorProbeOrigin = await evaluate('performance.timeOrigin');
  await send('Page.navigate', { url: receivingUrl });
  await wait('performance.timeOrigin!==' + priorProbeOrigin +
    " && !!window.__csvWorkerDelivery && document.getElementById('rain-comparison-status')?.dataset.state==='ready'");
  await evaluate("window.q=id=>document.getElementById(id);window.stored=()=>localStorage.getItem('experimental-earth-site-v1');");
  const stored = () => evaluate('stored()');
  const project = async () => JSON.parse(await stored());
  const click = id => evaluate('q(' + js(id) + ').click()');
  async function importProject(value) {
    await evaluate('(()=>{const dt=new DataTransfer();dt.items.add(new File([' +
      js(JSON.stringify(value)) + '],"receiving-project.json",{type:"application/json"}));' +
      'q("import").files=dt.files;q("import").dispatchEvent(new Event("change",{bubbles:true}));})()');
    await wait('JSON.parse(stored()).observations.length===' + value.observations.length);
    assert.deepEqual((await project()).observations, value.observations);
  }
  async function importCSV(text, name, count) {
    await evaluate('(()=>{const dt=new DataTransfer();dt.items.add(new File([' + js(text) +
      '],' + js(name) + ',{type:"text/csv"}));q("observation-table-file").files=dt.files;' +
      'q("observation-table-file").dispatchEvent(new Event("change",{bubbles:true}));})()');
    await wait("document.querySelectorAll('input[data-observation-line]').length===" + count);
    assert.equal(await evaluate("document.querySelectorAll('input[data-observation-line]:checked').length"), 0);
    await click('select-all-observation-rows');
    assert.equal(await evaluate("document.querySelectorAll('input[data-observation-line]:checked').length"), count);
    await click('append-observation-table');
    await wait('JSON.parse(stored()).observations.length===' + count);
  }
  async function downloadDirectory(name) {
    const path = runDirectory + '/' + name;
    await mkdir(path);
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: path });
    return path;
  }
  async function downloaded(directory, name) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const names = await readdir(directory);
      if (names.includes(name) && !names.some(n => n.endsWith('.crdownload')))
        return readFile(directory + '/' + name);
      await delay(100);
    }
    throw Error('Actual browser download did not complete: ' + name);
  }
  function independentlyParse(path) {
    return JSON.parse(execFileSync('python3', ['-c',
      'import csv,json,sys\nwith open(sys.argv[1],encoding="utf-8",newline="") as f:\n reader=csv.DictReader(f)\n rows=list(reader)\n print(json.dumps({"fields":reader.fieldnames,"rows":rows},ensure_ascii=True))',
      path], { encoding: 'utf8' }));
  }
  function assertRows(parsed, expected) {
    assert.deepEqual(parsed.fields, ['cell','minute','depth','uncertainty','unit','source','scenario','use']);
    assert.equal(parsed.rows.length, expected.observations.length);
    parsed.rows.forEach((row, index) => {
      const reading = expected.observations[index];
      const cell = String.fromCharCode(65 + reading.cellIndex % expected.width) +
        (Math.floor(reading.cellIndex / expected.width) + 1);
      assert.equal(row.cell, cell);
      assert.equal(Number(row.minute), reading.minute);
      assert.equal(Number(row.depth), reading.depthMm);
      assert.equal(Number(row.uncertainty), reading.uncertaintyMm);
      assert.equal(row.unit, 'mm'); assert.equal(row.source, reading.source);
      assert.equal(row.scenario, reading.scenario ?? 'unassigned');
      assert.equal(row.use, reading.use ?? 'unassigned');
    });
  }


  async function stageProject(value) {
    await evaluate('(()=>{const dt=new DataTransfer();dt.items.add(new File([' +
      js(JSON.stringify(value)) + '],"worker-receiving-project.json",{type:"application/json"}));' +
      'q("import").files=dt.files;q("import").dispatchEvent(new Event("change",{bubbles:true}));})()');
  }
  const stateIs = state => 'q("rain-comparison-status").dataset.state===' + js(state);
  async function heldReply() {
    await wait('(' + stateIs('pending') + ') && window.__csvWorkerDelivery.queued()>0');
  }
  async function assertInertExport(directory) {
    await evaluate('q("export-observation-csv").scrollIntoView({behavior:"instant",block:"center"})');
    await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    const bounds = await evaluate('(()=>{const b=q("export-observation-csv"),r=b.getBoundingClientRect();' +
      'return {inert:!!b.closest("[inert]"),disabled:b.disabled,x:r.x,y:r.y,right:r.right,bottom:r.bottom,' +
      'width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight};})()');
    assert.equal(bounds.inert,true);
    assert.equal(bounds.disabled,false,'An enabled button must be blocked by its inert ancestor.');
    assert.ok(bounds.width>0&&bounds.height>0&&bounds.x>=0&&bounds.y>=0);
    assert.ok(bounds.right<=bounds.viewportWidth&&bounds.bottom<=bounds.viewportHeight);
    const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
    await evaluate('q("export-observation-csv").focus()');
    assert.equal(await evaluate('!!document.activeElement?.closest("[inert]")'),false);
    await delay(600);
    assert.deepEqual(await readdir(directory),[]);
  }
  async function assertActualCSV(expected,directoryName) {
    const directory=await downloadDirectory(directoryName);
    await click('export-observation-csv');
    await downloaded(directory,name);
    assertRows(independentlyParse(directory+'/'+name),expected);
  }

  const servedHashes = {};
  for (const file of ['app.js','observation-export.js','observation-export-panel.js']) {
    const expected = await readFile(new URL('../' + file, import.meta.url));
    const actual = await evaluate('fetch(' + js(file) + ').then(r=>{if(!r.ok)throw Error("asset HTTP "+r.status);return r.text();})');
    assert.equal(sha256(actual), sha256(expected), 'Served asset must be the tested source: ' + file);
    servedHashes[file] = sha256(expected);
  }
  await click('reset');
  await wait('JSON.parse(stored()).observations.length===0');
  assert.equal(await evaluate('q("export-observation-csv").disabled'), true);
  const emptyBefore = await stored();
  const emptyDownloads = await downloadDirectory('empty-downloads');
  await click('export-observation-csv');
  await delay(100);
  assert.equal(await stored(), emptyBefore); assert.deepEqual(await readdir(emptyDownloads), []);
  reports.push('Empty notebook disables the actual export control and makes no file.');

  await importCSV(originalCSV, 'original-mixed-units.csv', 2);
  await evaluate('(()=>{const values=' + js({
    'obs-minute':'15.125', 'obs-depth':'2.123456789012345',
    'obs-uncertainty':'0.123456789012345', 'obs-source':manualSource,
    'obs-scenario':'existing', 'obs-use':'calibration',
  }) + ';for(const [id,value] of Object.entries(values)){q(id).value=value;' +
    'q(id).dispatchEvent(new Event("input",{bubbles:true}));q(id).dispatchEvent(new Event("change",{bubbles:true}));}' +
    'q("observe-form").requestSubmit();})()');
  await wait('JSON.parse(stored()).observations.length===3');
  const beforeText = await stored(), before = JSON.parse(beforeText);
  assert.deepEqual(before.observations.slice(0,2).map(o=>o.source), sources);
  assert.deepEqual(before.observations.slice(0,2).map(o=>o.tableSource.unit), ['cm','in']);
  assert.equal(before.observations[2].source, manualSource);
  assert.equal(before.observations[2].depthMm, 2.123456789012345);
  assert.equal(before.observations[2].uncertaintyMm, .123456789012345);
  assert.equal(await evaluate('q("export-observation-csv").disabled'), false);
  const normalDownloads = await downloadDirectory('normal-downloads');
  await click('export-observation-csv');
  const name = 'experimental-earth-observations.csv';
  const csvBytes = await downloaded(normalDownloads, name);
  assert.ok(csvBytes.length > 0 && csvBytes.length <= 128000);
  assert.equal(await stored(), beforeText, 'Export leaves complete original project bytes unchanged.');
  assertRows(independentlyParse(normalDownloads + '/' + name), before);
  assert.match(await evaluate('q("observation-export-status").textContent'), /export started for 3 readings/);
  reports.push('Real CSV download independently parsed: manual plus mixed cm/in readings, exact numbers, cells, quotes/newlines/Unicode, roles; original project unchanged.');

  const fresh = structuredClone(before); fresh.observations = [];
  await importProject(fresh);
  assert.equal(await evaluate('q("export-observation-csv").disabled'), true);
  await importCSV(new TextDecoder('utf-8',{fatal:true}).decode(csvBytes), name, 3);
  const received = await project();
  const semantic = o => ({cellIndex:o.cellIndex,minute:o.minute,depthMm:o.depthMm,
    uncertaintyMm:o.uncertaintyMm,source:o.source,scenario:o.scenario,use:o.use});
  assert.deepEqual(received.observations.map(semantic), before.observations.map(semantic));
  assert.ok(received.observations.every(o=>o.tableSource.unit==='mm' && o.tableSource.fileName===name));
  reports.push('Downloaded bytes reimport through fresh matching-grid JSON and explicit row choices; semantics preserved with new normalized table provenance.');

  const screenshots = [];
  for (const width of [1440,390]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
    await evaluate('q("export-observation-csv").scrollIntoView({block:"center",behavior:"instant"})');
    await delay(100);
    const bounds = await evaluate('(()=>{const r=q("export-observation-csv").getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,viewport:innerWidth,viewportHeight:innerHeight};})()');
    assert.ok(bounds.x>=0 && bounds.right<=bounds.viewport && bounds.y>=0 && bounds.bottom<=bounds.viewportHeight && bounds.width>0);
    const shot = await send('Page.captureScreenshot',{format:'png'});
    const bytes = Buffer.from(shot.data,'base64'), file='observation-export-'+width+'.png';
    await writeFile(runDirectory+'/'+file,bytes); screenshots.push({file,sha256:sha256(bytes),bounds});
  }
  reports.push('Export controls stay within desktop 1440px and narrow 390px viewports; actual PNGs retained.');

  const invalid = structuredClone(before);
  invalid.observations = [{cellIndex:0,minute:1,depthMm:2,uncertaintyMm:.1,source:'Original \uD800 source'}];
  await importProject(invalid);
  const invalidBefore = await stored();
  const refusedDownloads = await downloadDirectory('refused-downloads');
  await click('export-observation-csv');
  await wait('q("observation-export-status").textContent.startsWith("CSV export refused:")');
  assert.match(await evaluate('q("observation-export-status").textContent'), /row 1.*UTF-8 CSV.*Export JSON/);
  await delay(600);
  assert.deepEqual(await readdir(refusedDownloads), []);
  assert.equal(await stored(), invalidBefore);
  await click('export');
  const preserved = JSON.parse((await downloaded(refusedDownloads,'experimental-earth-site.json')).toString('utf8'));
  assert.equal(preserved.observations[0].source, invalid.observations[0].source);
  reports.push('Actual JSON-imported lone-surrogate source refuses CSV without file/mutation; actual Export JSON download preserves original string.');

  const maximal = structuredClone(fresh);
  maximal.observations = Array.from({length:100},(_,index)=>({
    cellIndex:index%(maximal.width*maximal.height), minute:index/2,
    depthMm:index+.123456789012345, uncertaintyMm:.0000001,
    source:String.fromCodePoint(0x4E00+index).repeat(200),
    scenario:index%2?'proposal':'existing', use:index%2?'challenge':'calibration',
  }));
  await importProject(maximal);
  const maximalBefore = await stored();
  const maxDownloads = await downloadDirectory('maximal-downloads');
  await click('export-observation-csv');
  const maxBytes = await downloaded(maxDownloads,name);
  assert.ok(maxBytes.length<=128000); assert.equal(await stored(),maximalBefore);
  assertRows(independentlyParse(maxDownloads+'/'+name),maximal);
  reports.push('Actual 100-reading Unicode notebook download fits importer byte ceiling; every row parsed with exact values and no mutation.');


  const smallOne=structuredClone(fresh);
  smallOne.observations=[{cellIndex:0,minute:15,depthMm:2,uncertaintyMm:.1,
    source:'Authored original',scenario:'existing',use:'calibration'}];
  const largeTwo=structuredClone(fresh);
  largeTwo.width=largeTwo.height=24;largeTwo.selectedIndex=0;
  largeTwo.existing=Array.from({length:576},()=>structuredClone(fresh.existing[0]));
  largeTwo.proposal=structuredClone(largeTwo.existing);
  largeTwo.observations=[structuredClone(smallOne.observations[0]),
    {cellIndex:575,minute:30,depthMm:3,uncertaintyMm:.2,
     source:'Accepted second reading — X24 boundary',scenario:'proposal',use:'challenge'}];
  const largeDifferent=structuredClone(largeTwo);
  largeDifferent.observations=[{cellIndex:575,minute:35,depthMm:97.25,uncertaintyMm:1.5,
    source:'Unaccepted reading must not replace the notebook',scenario:'proposal',use:'challenge'}];

  await evaluate('__csvWorkerDelivery.hold=false');
  await importProject(smallOne);await wait(stateIs('ready'));
  const acceptedSmallBytes=await stored();
  await evaluate('__csvWorkerDelivery.hold=true');
  const pendingDirectory=await downloadDirectory('worker-pending');
  await stageProject(largeTwo);await heldReply();
  assert.equal(await stored(),acceptedSmallBytes);
  await assertInertExport(pendingDirectory);
  assert.equal(await stored(),acceptedSmallBytes);
  await evaluate('__csvWorkerDelivery.release()');await wait(stateIs('ready'));
  await wait('JSON.parse(stored()).observations.length===2');
  assert.deepEqual((await project()).observations,largeTwo.observations);
  assert.equal(await evaluate('!!q("export-observation-csv").closest("[inert]")'),false);
  const acceptedLargeBytes=await stored();
  await assertActualCSV(largeTwo,'worker-accepted-two');
  assert.equal(await stored(),acceptedLargeBytes);
  reports.push('Real completed worker reply held then accepted: pending notebook blocks native pointer/focus, preserves accepted save, then CSV exports both current readings.');

  await evaluate('__csvWorkerDelivery.hold=true');
  const failedDirectory=await downloadDirectory('worker-failed');
  await stageProject(largeDifferent);await heldReply();
  assert.equal(await stored(),acceptedLargeBytes);
  await evaluate('__csvWorkerDelivery.failCompleted()');await wait(stateIs('failed'));
  assert.equal(await stored(),acceptedLargeBytes);
  await assertInertExport(failedDirectory);
  await click('restore-rain-comparison');await wait(stateIs('ready'));
  assert.equal(await stored(),acceptedLargeBytes);
  assert.deepEqual((await project()).observations,largeTwo.observations);
  await assertActualCSV(largeTwo,'worker-restored-two');
  assert.equal(await stored(),acceptedLargeBytes);
  await evaluate('__csvWorkerDelivery.hold=false');
  await importProject(fresh);await wait(stateIs('ready'));
  const acceptedEmptyBytes=await stored();assert.equal((await project()).observations.length,0);
  await evaluate('__csvWorkerDelivery.hold=true');
  await stageProject(largeDifferent);await heldReply();
  await evaluate('__csvWorkerDelivery.failCompleted()');await wait(stateIs('failed'));
  assert.equal(await stored(),acceptedEmptyBytes);
  await click('restore-rain-comparison');await wait(stateIs('ready'));
  assert.equal(await stored(),acceptedEmptyBytes);
  assert.equal((await project()).observations.length,0);
  assert.equal(await evaluate('q("export-observation-csv").disabled'),true);
  assert.equal(await evaluate('!!q("export-observation-csv").closest("[inert]")'),false);
  await evaluate('__csvWorkerDelivery.hold=false');
  reports.push('Controlled failure after real worker completion keeps CSV inert; restore exports accepted readings, excludes rejected input, and disables CSV when restoring an empty notebook.');

  assert.deepEqual(exceptions, []);
  const receipt = {schema:'experimental-earth.observation-csv-receiving/v1',
    receivingUrl,runDirectory,checks:reports,servedHashes,
    downloaded:{name,bytes:csvBytes.length,sha256:sha256(csvBytes),rows:3},
    maximal:{bytes:maxBytes.length,sha256:sha256(maxBytes),rows:100},
    screenshots,sandbox,browserExceptions:exceptions,
    workerReceiving:"Native worker computation; completed reply delivery is held and explicit failures are controlled for the two transition cases."};
  await writeFile(runDirectory+'/observation-export-receipt.json',JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));
});
