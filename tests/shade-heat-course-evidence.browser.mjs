import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { prepareSkyCourseEvidence, prepareSkyCourseSource } from '../shade-heat-course-evidence.js';
import { courseWitnessDifferences } from '../shade-heat-course-inputs.js';
import { makeThirdReceiverExample } from '../shade-heat-third-example.js';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = root + '.browser-run-original-course-' + randomUUID(), checks = [];
const raw = makeThirdReceiverExample(), query = { bins: 4, splitAfterInterval: 8, sharingSource: raw.query.sharingSource };
const reference = prepareSkyCourseEvidence(raw.readings, query);
const independent = structuredClone(raw.readings); independent.forEach((r, i) => { r.query.bins = [4, 16, 8][i]; });
const reversed = prepareSkyCourseEvidence([independent[2], independent[0], independent[1]], query);
const impossible = structuredClone(reference.investigation); impossible.readings[2].query.reading.temperatureC = 50;
const empty = prepareSkyCourseEvidence(impossible.readings, impossible.query);
let launcher = null, launcherUrl = null;
try {
  launcher = spawn('python3', ['serve.py', '--port', '0'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  launcherUrl = await new Promise((resolve, reject) => {
    let output = '', errors = ''; const timer = setTimeout(() => reject(Error('Documented launcher readiness timed out: ' + errors)), 10000);
    launcher.stdout.on('data', data => { output += data.toString(); const match = /Serving Experimental Earth at (http:\/\/127\.0\.0\.1:\d+\/)/.exec(output); if (match) { clearTimeout(timer); resolve(match[1]); } });
    launcher.stderr.on('data', data => { errors = (errors + data.toString()).slice(-4096); });
    launcher.once('error', error => { clearTimeout(timer); reject(error); });
    launcher.once('exit', code => { clearTimeout(timer); reject(Error('Documented launcher exited ' + code + ': ' + errors)); });
  });
  const result = await withBrowserSession({ root, runDirectory, chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome', commandMs: 30000 }, async session => {
    const { send, evaluate: value, exceptions } = session; assert.ok(session.sandbox.admitted && session.sandbox.observation.active);
    await send('DOM.enable'); await send('Page.enable');
    async function until(expression) { for (let i = 0; i < 1500; i++) { try { if (await value(expression)) return; } catch {} await delay(40); } throw Error('Timed out: ' + expression + '; ' + await value("document.getElementById('course-status')?.textContent")); }
    const click = id => value('document.getElementById(' + JSON.stringify(id) + ').click()');
    async function field(id, content) { await value('(()=>{const e=document.getElementById(' + JSON.stringify(id) + ');e.value=' + JSON.stringify(String(content)) + ';e.dispatchEvent(new Event("input",{bubbles:true}));})()'); }
    async function files(selector, paths) { const document = await send('DOM.getDocument'); const input = await send('DOM.querySelector', { nodeId: document.root.nodeId, selector }); assert.ok(input.nodeId); await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: paths }); }
    const state = async kind => {
      const expression = "document.getElementById('course-status').dataset.state";
      await until(expression + '===' + JSON.stringify(kind) + (['compatible', 'incompatible', 'inputs-ready'].includes(kind) ? "||['refused','file-refused'].includes(" + expression + ')' : ''));
      assert.equal(await value(expression), kind, await value("document.getElementById('course-status').textContent"));
    };
    const stored = () => value("localStorage.getItem('experimental-earth-site-v1')");
    async function matches(r) {
      const actual = await value("({...document.getElementById('course-results').dataset})");
      assert.equal(actual.status, r.compatibility); assert.equal(Number(actual.cell), r.cellIndex); assert.equal(Number(actual.split), r.query.splitAfterInterval);
      assert.equal(Number(actual.points), r.pointwiseCourse.length); assert.equal(Number(actual.basis), r.work.executedBasisCourses);
      assert.equal(Number(actual.courses), r.work.executedThermalCourses);
      assert.equal(actual.witnesses, r.witnesses.map(w => w.id).join(','));
      assert.deepEqual(await value("Array.from(document.querySelectorAll('#course-time-select option')).map(o=>Number(o.value))"), r.pointwiseCourse.map(p => p.index));
      for (const [store] of [['surfaceC'], ['subsurfaceC']]) {
        const rows = await value("Array.from(document.querySelectorAll('#course-plots [data-store=" + store + "] g[data-lower]')).map(e=>[Number(e.dataset.index),Number(e.dataset.lower),Number(e.dataset.upper),Number(e.dataset.lowerWitness),Number(e.dataset.upperWitness)])");
        assert.deepEqual(rows, r.compatibility === 'compatible' ? r.pointwiseCourse.map(p => [p.index, p.ranges[store].lower.differenceC.lower, p.ranges[store].upper.differenceC.upper, p.ranges[store].lower.witnessId, p.ranges[store].upper.witnessId]) : []);
      }
      assert.equal(await value("document.querySelectorAll('#course-plots polyline,#course-plots path').length"), 0);
      if (r.compatibility === 'compatible') {
        const id = Number(await value("document.getElementById('course-witness').dataset.witness"));
        const w = r.witnesses.find(w => w.id === id); assert.ok(w); const trace = courseWitnessDifferences(w);
        for (const store of ['surfaceC', 'subsurfaceC']) {
          const markers = await value("Array.from(document.querySelectorAll('#course-plots [data-store=" + store + "] circle[data-profile]')).map(e=>[Number(e.dataset.index),e.dataset.bound,Number(e.dataset.profile),Number(e.dataset.value)])");
          assert.deepEqual(markers, trace.flatMap(p => ['lower', 'upper'].map(bound => [p.index, bound, id, p.differenceC[store][bound][bound]])));
        }
      }
    }
    async function download(name) {
      const directory = runDirectory + '/download-' + name; await mkdir(directory); await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory }); await click('course-export');
      const path = directory + '/experimental-earth-original-sky-course-inputs.json'; let found = false;
      for (let i = 0; i < 500; i++) { try { await access(path); found = true; break; } catch { await delay(40); } } assert.ok(found);
      const text = await readFile(path, 'utf8'), source = JSON.parse(text); assert.deepEqual(Object.keys(source), ['kind', 'model', 'readings', 'query']);
      assert.deepEqual(prepareSkyCourseSource(source.readings, source.query), source); return { path, text, source };
    }
    await send('Page.navigate', { url: launcherUrl + 'sky-third-receiver.html' });
    await until("Boolean(document.querySelector('a[href=\"sky-course-evidence.html\"]'))");
    assert.equal(await value("document.querySelector('a[href=\"sky-course-evidence.html\"]').target"), '_blank'); const originalStorage = await stored();
    await send('Page.navigate', { url: launcherUrl + 'sky-course-evidence.html' }); await until("document.getElementById('course-example')?.disabled===false");
    const observeWorker = () => value("window.originalCoursePost=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){window.observedCourseRequest=structuredClone(m);const handler=this.onmessage;this.onmessage=e=>{window.observedCourseResult=structuredClone(e.data.result);handler(e)};return window.originalCoursePost.call(this,m,...args)}");
    await observeWorker();
    await click('course-example'); await state('compatible'); await matches(reference.report);
    assert.equal(await value("document.querySelectorAll('#course-sources .source-card').length"), 3);
    assert.equal(await value("document.querySelectorAll('#course-results .site-figure circle').length"), 3);
    assert.match(await value("document.querySelector('.course-notice').textContent"), /not asserted to be one possible course/);
    assert.equal(await value("document.getElementById('course-time-detail').dataset.index"), '8');
    assert.ok(Number(await value("document.getElementById('course-time-detail').dataset.surfaceCUpper")) < -2);
    checks.push('Ordinary parent entry runs the actual complete worker:17 original times,68 exact range endpoints,3 original points and correctly bound whole-profile markers');

    await value("window.coursePost=Worker.prototype.postMessage;window.coursePosts=0;Worker.prototype.postMessage=function(...args){window.coursePosts++;return window.coursePost.apply(this,args)}");
    for (const row of reference.report.pointwiseCourse) {
      await field('course-time-select', row.index);
      for (const store of ['surfaceC', 'subsurfaceC']) for (const bound of ['lower', 'upper']) {
        await value("document.querySelector('#course-time-detail button[data-store=" + store + "][data-bound=" + bound + "]').click()");
        assert.equal(Number(await value("document.getElementById('course-witness').dataset.witness")), row.ranges[store][bound].witnessId);
        assert.equal(Number(await value("document.getElementById('course-time-detail').dataset.index")), row.index);
      }
    }
    await field('course-witness-select', 0); await value("document.getElementById('course-witness-select').focus()");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    assert.equal(await value("document.getElementById('course-witness').dataset.witness"), '30');
    await field('course-time-slider', 8); await value("document.getElementById('course-time-slider').focus()");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    assert.equal(await value("document.getElementById('course-time-detail').dataset.index"), '9');
    assert.equal(await value("document.getElementById('course-witness').dataset.witness"), '30');
    await field('course-time-select', 10); assert.ok(Number(await value("document.getElementById('course-time-detail').dataset.surfaceCLower")) > 0);
    assert.ok(Number(await value("document.getElementById('course-time-detail').dataset.subsurfaceCUpper")) < 0);
    assert.equal(await value('window.coursePosts'), 0); await value('Worker.prototype.postMessage=window.coursePost'); await matches(reference.report);
    checks.push('All68 extrema select their exact time and noncontiguous witness ID; keyboard time/profile controls preserve the fixed profile and inspect cooling-to-warming without another computation');

    const saved = await download('authored'); assert.deepEqual(saved.source, reference.investigation);
    await send('Page.reload', { ignoreCache: true }); await until("document.getElementById('course-example')?.disabled===false");
    await observeWorker();
    await files('#course-reopen', [saved.path]); await state('compatible'); await matches(reference.report); assert.equal(await stored(), originalStorage);
    checks.push('Actual source-only download opens in a fresh document and recomputes the complete course; inspection choices and derived ranges are not saved as evidence');

    await field('course-time-select', 8);
    for (const [width, height, mobile] of [[1440, 1000, false], [390, 844, true]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, mobile, deviceScaleFactor: 1 }); await delay(80);
      assert.ok(await value('document.documentElement.scrollWidth<=innerWidth+1'));
      assert.ok(await value("Array.from(document.querySelectorAll('#course-time-detail strong>span')).every(e=>e.getBoundingClientRect().height<=parseFloat(getComputedStyle(e).fontSize)*1.8)"));
      for (const [id, label] of [['course-sources', 'originals'], ['course-plots', 'plots'], ['course-time-detail', 'time'], ['course-witness', 'witness']]) {
        await value('document.getElementById(' + JSON.stringify(id) + ').scrollIntoView({block:"start",behavior:"instant"})');
        await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(runDirectory + '/course-' + label + '-' + width + '.png', Buffer.from(shot.data, 'base64'));
      }
    }
    checks.push('Original-time whiskers,selected profile,range units and three-point source view fit desktop and390px without a continuous-time connecting curve');
    await value("window.retiredCourseExtreme=document.querySelector('#course-time-detail button');window.retiredCourseTime=document.getElementById('course-time-select');window.retiredCoursePoint=document.querySelector('#course-sources input[value=\"1\"]')");

    const paths = independent.map((_, i) => runDirectory + '/original-' + i + '.json'); await Promise.all(paths.map((path, i) => writeFile(path, JSON.stringify(independent[i]))));
    await files('#course-originals', paths); await state('inputs-ready');
    await value("(()=>{const e=document.querySelector('#course-sources input[value=\"2\"]');e.checked=true;e.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await click('course-run'); await state('compatible');
    // The maintained numerical evaluator can differ by a few binary64 units
    // between Node and Chromium. Exact UI bindings use this actual worker's
    // represented-coefficient result; cross-runtime numerical comparison stays
    // explicit and separate. Independently certified raw pairs are retained.
    const runtimeReversed = await value('window.observedCourseResult');
    assert.deepEqual(runtimeReversed.investigation, reversed.investigation);
    assert.deepEqual(runtimeReversed.report.work.profileIntersection, reversed.report.work.profileIntersection);
    let maximumRuntimeDifferenceC = 0;
    for (const row of runtimeReversed.report.pointwiseCourse) {
      const expected = reversed.report.pointwiseCourse[row.index];
      for (const key of ['index', 'utc', 'minute', 'thermalMinute']) assert.equal(row[key], expected[key]);
      for (const store of ['surfaceC', 'subsurfaceC']) for (const bound of ['lower', 'upper']) {
        const difference = Math.abs(row.ranges[store][bound].differenceC[bound] - expected.ranges[store][bound].differenceC[bound]);
        assert.ok(difference <= 1e-12, 'Separate cross-runtime comparison exceeded1e-12C'); maximumRuntimeDifferenceC = Math.max(maximumRuntimeDifferenceC, difference);
      }
    }
    const pairs = await value("(async()=>{const {buildOriginalBoundaryBasis}=await import('./shade-heat-epoch-kernel.js');const source=window.observedCourseResult.investigation;const split=source.query.splitAfterInterval;const bases=source.readings.map(input=>buildOriginalBoundaryBasis(input,split));return {split,readings:source.readings.map(input=>input.query.reading),points:bases.map(b=>({cellIndex:b.input.query.reading.cellIndex,pairs:b.pairs.map(p=>({early:p.early,late:p.late,final:p.trace.final,originalBoundaries:p.trace.originalBoundaries,states:p.trace.states}))}))}})()");
    await writeFile(runDirectory + '/runtime-original-pair-values.json', JSON.stringify(pairs, null, 2));
    await writeFile(runDirectory + '/runtime-course-comparison.json', JSON.stringify({ maximumRuntimeDifferenceC, expected: reversed.report, actual: runtimeReversed, request: await value('window.observedCourseRequest'), scope: 'Actual UI binding is exact to its worker report; the separate Node comparison is numerical, not a bit-identical cross-runtime claim.' }, null, 2));
    await matches(runtimeReversed.report);
    const changed = await download('changed-point'); assert.deepEqual(changed.source, reversed.investigation); assert.deepEqual(changed.source.readings.map(r => r.query.bins), [8, 4, 16]);
    await value("window.retiredCourseExtreme.click();window.retiredCourseTime.value='0';window.retiredCourseTime.dispatchEvent(new Event('input'));window.retiredCoursePoint.checked=true;window.retiredCoursePoint.dispatchEvent(new Event('input'))"); await matches(runtimeReversed.report);
    assert.equal(await value("document.getElementById('course-time-detail').dataset.index"), '8');
    const prior = runDirectory + '/three-reading-inputs.json'; await writeFile(prior, JSON.stringify(raw));
    await field('course-split', 9); await files('#course-originals', [prior]); await state('inputs-ready'); assert.equal(await value("document.getElementById('course-split').value"), '9');
    await field('course-split', 8); await click('course-run'); await state('compatible'); await matches(reference.report);
    checks.push('Actual three-file intake preserves4/16/8 histories and permits the third comparison point; a saved prior inquiry supplies originals without choosing a boundary; detached older controls cannot restore stale inputs or times');

    const bad = runDirectory + '/forged-prior.json', badUtf = runDirectory + '/bad-utf8.json', mismatch = runDirectory + '/mismatch.json';
    await writeFile(bad, JSON.stringify({ ...raw, report: {} })); await writeFile(badUtf, Buffer.from([0xc3, 0x28]));
    const mismatchSource = structuredClone(reference.investigation); mismatchSource.readings[2].source.declaration.reservoirC += 1; await writeFile(mismatch, JSON.stringify(mismatchSource));
    for (const inputs of [[bad], paths.slice(0, 2), [paths[0]]]) { await files('#course-originals', inputs); await state('file-refused'); await matches(reference.report); }
    for (const path of [badUtf, mismatch]) { await files('#course-reopen', [path]); await state('file-refused'); await matches(reference.report); }
    await field('course-split', 0); await click('course-run'); await state('refused'); assert.equal(await value("document.getElementById('course-results').hidden"), true); assert.equal(await value("document.getElementById('course-export').disabled"), true);
    await files('#course-reopen', [saved.path]); await state('compatible'); await matches(reference.report);
    checks.push('Malformed prior results,incomplete intake,invalidUTF8 and mismatched forcing refuse while retaining prior accepted results; an invalid new boundary clears the new inquiry whole');

    const slow = runDirectory + '/slow-original.json'; await writeFile(slow, JSON.stringify(independent[2]));
    await value("window.courseArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow-original.json')return new Promise(resolve=>{window.releaseCourseFile=()=>window.courseArrayBuffer.call(this).then(resolve)});return window.courseArrayBuffer.call(this)}");
    await files('#course-originals', [paths[0], paths[1], slow]); await until("typeof window.releaseCourseFile==='function'");
    await field('course-split', 8); await click('course-run'); await state('compatible'); await matches(reference.report);
    await value('window.releaseCourseFile()'); await delay(100); await matches(reference.report); await value('File.prototype.arrayBuffer=window.courseArrayBuffer');
    checks.push('A held actual third-file read cannot overwrite newer accepted originals or the selected course');

    await value("window.coursePost=Worker.prototype.postMessage;window.holdCourse=true;Worker.prototype.postMessage=function(m,...a){if(window.holdCourse&&m.operation==='prepare'){window.holdCourse=false;const handler=this.onmessage;this.onmessage=e=>{window.releaseCourseWorker=()=>handler(e)}}return window.coursePost.call(this,m,...a)}");
    await click('course-run'); await until("typeof window.releaseCourseWorker==='function'");
    const impossiblePath = runDirectory + '/impossible.json'; await writeFile(impossiblePath, JSON.stringify(impossible));
    await files('#course-reopen', [impossiblePath]); await state('incompatible'); await matches(empty.report);
    await value('window.releaseCourseWorker()'); await delay(100); await matches(empty.report); await value('Worker.prototype.postMessage=window.coursePost');
    assert.equal(await value("document.getElementById('course-witness')"), null); assert.equal(await value("document.querySelectorAll('#course-plots svg').length"), 0);
    assert.deepEqual((await download('incompatible')).source, impossible); await field('course-time-select', 16); assert.equal(await value("document.getElementById('course-time-detail').dataset.utc"), empty.report.finalUtc);
    assert.equal(await stored(), originalStorage); assert.deepEqual(exceptions, []);
    checks.push('A held older actual-worker result cannot replace a newer incompatible family; all17 original times and source-only export remain available without invented witnesses or ranges');
    return { checks, sandbox: session.sandbox, exceptions, launcher: { command: 'python3 serve.py --port 0', url: launcherUrl, scope: 'Every visible interaction and actual worker uses the maintained documented loopback launcher.' } };
  });
  const receipt = { status: 'PASS', ...result.value, receipt: result.receipt }; await writeFile(runDirectory + '/browser.json', JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt, null, 2));
} catch (error) { console.error(JSON.stringify({ status: 'FAIL', error: String(error), checks, receipt: error.receipt ?? null, runDirectory }, null, 2)); process.exitCode = 1; }
finally { if (launcher && launcher.exitCode === null && launcher.signalCode === null) await new Promise(resolve => { const timer = setTimeout(() => launcher.kill('SIGKILL'), 3000); launcher.once('close', () => { clearTimeout(timer); resolve(); }); launcher.kill('SIGTERM'); }); }
