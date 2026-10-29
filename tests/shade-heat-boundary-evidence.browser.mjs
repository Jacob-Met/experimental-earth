import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { parseSkyBoundaryEvidence, prepareSkyBoundaryEvidence } from '../shade-heat-epoch-evidence.js';
import { makeSkyBoundaryExample } from '../shade-heat-boundary-example.js';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = root + '.browser-run-boundary-evidence-' + randomUUID(), checks = [];
const sourceText = JSON.stringify(makeSkyBoundaryExample());
const reference = parseSkyBoundaryEvidence(sourceText), raw = JSON.parse(sourceText);
let launcher = null, launcherUrl = null;
try {
  launcher = spawn('python3', ['serve.py', '--port', '0'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  launcherUrl = await new Promise((resolve, reject) => {
    let output = '', errors = '';
    const timer = setTimeout(() => reject(Error('Documented launcher readiness timed out: ' + errors)), 10000);
    launcher.stdout.on('data', data => {
      output += data.toString(); const match = /Serving Experimental Earth at (http:\/\/127\.0\.0\.1:\d+\/)/.exec(output);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    launcher.stderr.on('data', data => { errors = (errors + data.toString()).slice(-4096); });
    launcher.once('error', error => { clearTimeout(timer); reject(error); });
    launcher.once('exit', code => { clearTimeout(timer); reject(Error('Documented launcher exited ' + code + ': ' + errors)); });
  });
  const result = await withBrowserSession({ root, runDirectory,
    chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome', commandMs: 30000 }, async session => {
    const { send, evaluate: value, exceptions } = session;
    assert.ok(session.sandbox.admitted && session.sandbox.observation.active);
    await send('DOM.enable'); await send('Page.enable');
    async function until(expression) {
      for (let i = 0; i < 750; i++) { try { if (await value(expression)) return; } catch {} await delay(40); }
      throw Error('Timed out: ' + expression + '; ' + await value("document.getElementById('boundary-status')?.textContent"));
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
    const state = kind => until("document.getElementById('boundary-status').dataset.state===" + JSON.stringify(kind));
    const stored = () => value("localStorage.getItem('experimental-earth-site-v1')");
    async function matches(report) {
      const actual = await value("({...document.getElementById('boundary-results').dataset})");
      assert.equal(actual.status, report.compatibility); assert.equal(Number(actual.cell), report.cellIndex);
      assert.equal(Number(actual.offered), report.boundaries.length);
      assert.equal(actual.compatible, report.compatibleBoundaries.join(','));
      assert.equal(Number(actual.basis), report.work.executedBasisCourses);
      assert.equal(Number(actual.reused), report.work.reusedCompleteBasisCourses);
      for (const store of ['surfaceC', 'subsurfaceC']) for (const bound of ['lower', 'upper']) {
        const key = store + bound[0].toUpperCase() + bound.slice(1);
        if (report.ranges) assert.equal(Number(actual[key]), report.ranges[store][bound].differenceC[bound]);
        else assert.equal(actual[key], undefined);
      }
      assert.deepEqual(await value("Array.from(document.querySelectorAll('#boundary-alternatives button')).map(e=>[Number(e.dataset.split),e.dataset.status])"),
        report.boundaries.map(r=>[r.query.splitAfterInterval,r.compatibility]));
    }
    async function download(name) {
      const directory = runDirectory + '/download-' + name; await mkdir(directory);
      await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
      await click('boundary-export');
      const path = directory + '/experimental-earth-offered-sky-boundary-inputs.json'; let found = false;
      for (let i = 0; i < 500; i++) { try { await access(path); found = true; break; } catch { await delay(40); } }
      assert.ok(found); const text = await readFile(path, 'utf8');
      return { path, text, parsed: parseSkyBoundaryEvidence(text) };
    }
    await send('Page.navigate', { url: launcherUrl + 'sky-epoch-evidence.html' });
    await until("Boolean(document.querySelector('a[href=\"sky-boundary-evidence.html\"]'))");
    assert.equal(await value("document.querySelector('a[href=\"sky-boundary-evidence.html\"]').target"), '_blank');
    const originalStorage = await stored();
    await send('Page.navigate', { url: launcherUrl + 'sky-boundary-evidence.html' });
    await until("document.getElementById('boundary-example')?.disabled===false");
    assert.equal(await value("document.getElementById('boundary-run').disabled"), true);
    await click('boundary-example'); await state('compatible'); await matches(reference.report);
    assert.match(await value("document.getElementById('boundary-sources').textContent"), /point B2.*point D2/);
    assert.equal(await stored(), originalStorage);
    checks.push('Ordinary epoch-inquiry entry opens the actual15-boundary worker inquiry; all15 outcomes and compatible8–12 remain visible with1472new+448reused complete basis courses');

    for(const store of ['surfaceC','subsurfaceC']) for(const bound of ['lower','upper']) {
      const range=reference.report.ranges[store][bound];
      await value("document.querySelector('#boundary-results button[data-store="+store+"][data-bound="+bound+"]').click()");
      assert.equal(Number(await value("document.getElementById('boundary-detail').dataset.split")),range.splitAfterInterval);
      assert.equal(Number(await value("document.getElementById('boundary-witness').dataset.witness")),range.witnessId);
      assert.equal(Number(await value("document.getElementById('boundary-select').value")),range.boundaryIndex);
    }
    await field('boundary-select',7);
    const eight=reference.report.boundaries[7], ids=eight.witnesses.map(w=>w.id);
    assert.deepEqual(ids,[4,52]);
    await field('boundary-witness-select',ids[0]);
    await value("document.getElementById('boundary-witness-select').scrollIntoView({block:'center',behavior:'instant'});document.getElementById('boundary-witness-select').focus()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
    assert.equal(Number(await value("document.getElementById('boundary-witness').dataset.witness")),52);
    assert.equal(await value("document.getElementById('boundary-replay-note').dataset.replay"),'outside-original-band');
    assert.deepEqual(await value("Array.from(document.querySelectorAll('#boundary-witness [data-phase]')).map(e=>JSON.parse(e.dataset.weights))"),
      eight.witnesses[1].phaseProfiles.map(p=>p.map(w=>w.lower)));
    await field('boundary-select',0);
    assert.equal(await value("document.getElementById('boundary-detail').dataset.status"),'incompatible');
    assert.equal(await value("document.getElementById('boundary-witness')"),null);
    await field('boundary-select',7);
    checks.push('All four union-extremum buttons select the exact original boundary and witness; keyboard inspection retains noncontiguous IDs and outside-band replay, and incompatible alternatives remain inspectable');

    const saved=await download('authored');
    assert.deepEqual(Object.keys(JSON.parse(saved.text)),['kind','model','readings','query']);assert.deepEqual(JSON.parse(saved.text),raw);
    await send('Page.reload',{ignoreCache:true});await until("document.getElementById('boundary-example')?.disabled===false");
    await files('#boundary-reopen',[saved.path]);await state('compatible');await matches(reference.report);
    assert.equal(await stored(),originalStorage);
    checks.push('Actual compact source-only download reopens on a fresh document and recomputes all original boundary alternatives without saved results');

    const independent=structuredClone(raw.readings);independent[0].query.bins=4;independent[1].query.bins=16;
    const firstPath=runDirectory+'/original-first.json',secondPath=runDirectory+'/original-second.json';
    await writeFile(firstPath,JSON.stringify(independent[0]));await writeFile(secondPath,JSON.stringify(independent[1]));
    await files('#boundary-originals',[firstPath,secondPath]);await state('inputs-ready');
    await value("(()=>{const radio=document.querySelector('#boundary-sources input[value=\"1\"]');radio.checked=true;radio.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await field('boundary-splits','13, 3, 8');await click('boundary-run');await state('compatible');
    const reversed=prepareSkyBoundaryEvidence([...independent].reverse(),{...raw.query,splitAfterIntervals:[13,3,8]});await matches(reversed.report);
    const reverseSave=await download('reversed');assert.deepEqual(reverseSave.parsed.investigation.readings,[...independent].reverse());
    assert.deepEqual(reverseSave.parsed.investigation.query.splitAfterIntervals,[13,3,8]);
    assert.deepEqual(reverseSave.parsed.report.boundaries[0].readings.map(r=>r.originalBins),[16,4]);
    await field('boundary-splits','9, 8');await click('boundary-run');await state('compatible');
    const reordered=prepareSkyBoundaryEvidence([...independent].reverse(),{...raw.query,splitAfterIntervals:[9,8]});await matches(reordered.report);
    checks.push('Two actual original files preserve4/16-bin history and receiver reversal; nonmonotone and changed offered lists retain exact original order and recompute all consequences');

    const malformed=runDirectory+'/bad-original.json';await writeFile(malformed,JSON.stringify({...independent[1],report:{}}));
    await files('#boundary-originals',[firstPath,malformed]);await state('file-refused');await matches(reordered.report);
    await files('#boundary-originals',[firstPath]);await state('file-refused');await matches(reordered.report);
    const badUtf8=runDirectory+'/bad-utf8.json';await writeFile(badUtf8,Buffer.from([0xc3,0x28]));
    await files('#boundary-reopen',[badUtf8]);await state('file-refused');await matches(reordered.report);
    await field('boundary-splits','8,,9');await click('boundary-run');await state('refused');
    assert.equal(await value("document.getElementById('boundary-results').hidden"),true);
    assert.equal(await value("document.getElementById('boundary-export').disabled"),true);
    await field('boundary-splits','9, 8');await click('boundary-run');await state('compatible');await matches(reordered.report);
    checks.push('Malformed original member, incomplete pair and invalid UTF8 retain the prior inquiry; a missing interior offer refuses the entire new query without partial results');

    const slowPath=runDirectory+'/slow-original.json';await writeFile(slowPath,JSON.stringify(independent[1]));
    await value("window.originalBoundaryArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow-original.json')return new Promise(resolve=>{window.releaseOldBoundaryFile=()=>window.originalBoundaryArrayBuffer.call(this).then(resolve)});return window.originalBoundaryArrayBuffer.call(this)}");
    await files('#boundary-originals',[firstPath,slowPath]);await until("typeof window.releaseOldBoundaryFile==='function'");
    assert.equal(await value("document.getElementById('boundary-export').disabled"),true);
    await field('boundary-splits','10, 8, 9');await click('boundary-run');await state('compatible');
    const newer=prepareSkyBoundaryEvidence([...independent].reverse(),{...raw.query,splitAfterIntervals:[10,8,9]});await matches(newer.report);
    await value('window.releaseOldBoundaryFile()');await delay(120);await matches(newer.report);
    await value('File.prototype.arrayBuffer=window.originalBoundaryArrayBuffer');
    checks.push('Delayed two-file acquisition cannot restore old original order or boundaries after a newer complete query');

    await value("window.originalBoundaryPost=Worker.prototype.postMessage;window.holdBoundaryResponse=true;Worker.prototype.postMessage=function(m,...a){if(window.holdBoundaryResponse&&m.operation==='prepare'){window.holdBoundaryResponse=false;const handler=this.onmessage;this.onmessage=e=>{window.releaseOldBoundaryWorker=()=>handler(e)}}return window.originalBoundaryPost.call(this,m,...a)}");
    await click('boundary-run');await until("typeof window.releaseOldBoundaryWorker==='function'");
    await field('boundary-splits','13, 3');await click('boundary-run');await state('incompatible');
    const empty=prepareSkyBoundaryEvidence([...independent].reverse(),{...raw.query,splitAfterIntervals:[13,3]});await matches(empty.report);
    await value('window.releaseOldBoundaryWorker()');await delay(120);await matches(empty.report);
    await value('Worker.prototype.postMessage=window.originalBoundaryPost');
    checks.push('A held compatible actual-worker result cannot replace a newer all-incompatible offered list');

    const mismatch=structuredClone(raw);mismatch.readings[1].source.declaration.path.gridColumnBearingDeg+=10;
    const mismatchPath=runDirectory+'/mismatch.json';await writeFile(mismatchPath,JSON.stringify(mismatch));
    await files('#boundary-reopen',[mismatchPath]);await state('file-refused');await matches(empty.report);
    const impossible=structuredClone(raw);impossible.query.splitAfterIntervals=[13,3,8];impossible.readings[1].query.reading.temperatureC=50;
    const impossiblePath=runDirectory+'/impossible.json';await writeFile(impossiblePath,JSON.stringify(impossible));
    await files('#boundary-reopen',[impossiblePath]);await state('incompatible');await matches(parseSkyBoundaryEvidence(JSON.stringify(impossible)).report);
    assert.equal(await value("document.getElementById('boundary-export').disabled"),false);
    assert.deepEqual((await download('incompatible')).parsed.investigation,impossible);
    const forged=runDirectory+'/forged.json';await writeFile(forged,JSON.stringify({...raw,report:{}}));
    await files('#boundary-reopen',[forged]);await state('file-refused');assert.equal(await value("document.getElementById('boundary-results').dataset.status"),'incompatible');
    checks.push('Mismatched source and forged-result files refuse; an all-incompatible completed inquiry stays downloadable with every original offered boundary');

    await files('#boundary-reopen',[saved.path]);await state('compatible');
    await field('boundary-splits','8');await click('boundary-all');
    assert.equal(await value("document.getElementById('boundary-splits').value"),raw.query.splitAfterIntervals.join(', '));
    await click('boundary-run');await state('compatible');await matches(reference.report);
    await value("document.querySelector('#boundary-results button[data-store=surfaceC][data-bound=upper]').click()");
    for(const [width,height,mobile] of [[1440,1000,false],[390,844,true]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});await delay(80);
      assert.ok(await value('document.documentElement.scrollWidth<=innerWidth+1'));
      if(width===390) assert.ok(await value("Array.from(document.querySelectorAll('#boundary-results>.result-layout .range-card strong')).every(e=>e.getBoundingClientRect().height<=parseFloat(getComputedStyle(e).fontSize)*1.8)"), 'Authored range and its unit stay together on a narrow screen');
      for(const [id,label] of [['boundary-sources','originals'],['boundary-results','range'],['boundary-alternatives','alternatives'],['boundary-witness','witness'],['boundary-replay-note','replay']]) {
        await value('document.getElementById('+JSON.stringify(id)+').scrollIntoView({block:"start",behavior:"instant"})');
        await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/boundary-'+label+'-'+width+'.png',Buffer.from(shot.data,'base64'));
      }
    }
    assert.equal(await stored(),originalStorage);assert.deepEqual(exceptions,[]);
    checks.push('Explicit offer-all action, complete alternatives, union bounds and exact-witness inspection fit desktop/390px without exceptions or working-project storage changes');
    return { checks, sandbox: session.sandbox, exceptions,
      launcher: { command:'python3 serve.py --port 0',url:launcherUrl,
        scope:'Every interaction and worker module above uses the unchanged documented loopback launcher.' } };
  });
  const receipt={status:'PASS',...result.value,receipt:result.receipt};
  await writeFile(runDirectory+'/browser.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
} catch(error) {
  console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null,runDirectory},null,2));process.exitCode=1;
} finally {
  if(launcher&&launcher.exitCode===null&&launcher.signalCode===null) await new Promise(resolve=>{
    const timer=setTimeout(()=>launcher.kill('SIGKILL'),3000);launcher.once('close',()=>{clearTimeout(timer);resolve();});launcher.kill('SIGTERM');
  });
}
