import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { compareShadeHeat, parseShadeHeatInvestigation, serializeShadeHeatInvestigation } from '../shade-heat.js';
import { authoredPowerWeather } from './weather-power-fixture.mjs';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = root + '.browser-run-shade-sky-' + randomUUID(), checks = [];
const example = makeShadeHeatExample();
const declaration = { ...example.declaration, directNormalWm2: 0,
  diffuseSky: { azimuthSamples: 32, elevationBands: 16 } };
try {
  const result = await withBrowserSession({
    root, runDirectory, chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome',
  }, async session => {
    const { send, evaluate, exceptions } = session;
    await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
    async function until(expression) {
      for (let i = 0; i < 750; i++) {
        try { if (await evaluate(expression)) return; } catch {}
        await delay(40);
      }
      throw Error('Timed out: ' + expression + '; ' + await evaluate("document.getElementById('shade-status')?.textContent"));
    }
    const value = expression => evaluate(expression);
    const click = id => evaluate('document.getElementById(' + JSON.stringify(id) + ').click()');
    async function field(id, content) {
      await evaluate("(()=>{const e=document.getElementById(" + JSON.stringify(id)
        + ");e.value=" + JSON.stringify(String(content)) + ";e.dispatchEvent(new Event('input',{bubbles:true}));})()");
    }
    async function file(selector, path) {
      const document = await send('DOM.getDocument');
      const input = await send('DOM.querySelector', { nodeId: document.root.nodeId, selector });
      assert.ok(input.nodeId, selector);
      await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [path] });
    }
    const stored = () => value("localStorage.getItem('experimental-earth-site-v1')");
    const temperatures = () => value("({existing:Number(document.getElementById('shade-inspect').dataset.existingLower),proposal:Number(document.getElementById('shade-inspect').dataset.proposalUpper)})");
    async function run() {
      await value("document.getElementById('shade-form').requestSubmit()");
      await until("document.getElementById('shade-status').dataset.state==='compared'");
    }
    async function matches(report) {
      const actual = await temperatures(), final = report.trajectory.at(-1);
      assert.ok(Math.abs(actual.existing - final.existing.lower.surfaceC) < 1e-8, JSON.stringify({ actual, expectedExisting: final.existing.lower.surfaceC }));
      assert.ok(Math.abs(actual.proposal - final.proposal.upper.surfaceC) < 1e-8, JSON.stringify({ actual, expectedProposal: final.proposal.upper.surfaceC }));
    }
    async function download(name) {
      const directory = runDirectory + '/download-' + name;
      await mkdir(directory);
      await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
      await click('shade-export');
      const path = directory + '/experimental-earth-shade-heat-inputs.json';
      let found = false;
      for (let i = 0; i < 750; i++) {
        try { await access(path); found = true; break; } catch { await delay(40); }
      }
      assert.ok(found, 'The requested original-input download completed');
      const text = await readFile(path, 'utf8');
      return { path, text, parsed: parseShadeHeatInvestigation(text) };
    }
    await until("Boolean(document.getElementById('shade-sky-enabled'))");
    const original = await stored();
    await click('shade-example');
    await until("document.getElementById('shade-status').dataset.state==='compared'");
    assert.equal(await value("document.getElementById('shade-sky-enabled').checked"), false);
    await field('shade-directNormalWm2', 0); await run();
    let t = await temperatures();
    assert.ok(Math.abs(t.existing - t.proposal) < 1e-8);
    await click('shade-sky-enabled');
    assert.equal(await value("document.getElementById('shade-results').children.length"), 0);
    assert.equal(await value("document.getElementById('shade-export').disabled"), true);
    await run();
    const defaultReport = compareShadeHeat(example.project, declaration);
    await matches(defaultReport); t = await temperatures();
    assert.ok(t.proposal < t.existing - 1);
    assert.equal(await stored(), original);
    assert.match(await value("document.getElementById('shade-sky-inspection').textContent"), /512 equally weighted directions/);
    checks.push('Actual module worker connects optional mapped diffuse forcing to the DHI-only temperature response without editing the working site');

    await field('shade-sky-azimuthSamples', 12);
    await field('shade-sky-elevationBands', 3);
    declaration.diffuseSky = { azimuthSamples: 12, elevationBands: 3 };
    await run(); await matches(compareShadeHeat(example.project, declaration));
    const constant = await download('constant'), envelope = JSON.parse(constant.text);
    assert.equal(envelope.kind, 'experimental-earth/shade-heat-inputs/3');
    assert.deepEqual(envelope.declaration.diffuseSky, declaration.diffuseSky);
    assert.equal(Object.hasOwn(envelope, 'report'), false);
    assert.deepEqual(envelope.project, example.project);
    await send('Page.reload', { ignoreCache: true });
    await until("Boolean(document.getElementById('shade-import'))");
    await file('#shade-import', constant.path);
    await until("document.getElementById('shade-status').dataset.state==='compared'");
    assert.equal(await value("document.getElementById('shade-sky-enabled').checked"), true);
    assert.equal(await value("document.getElementById('shade-sky-azimuthSamples').value"), '12');
    assert.equal(await value("document.getElementById('shade-sky-elevationBands').value"), '3');
    await matches(constant.parsed.report);
    assert.equal(await stored(), original);
    checks.push('A real constant-weather v3 download retains arbitrary valid sampling, full original source and no saved report; fresh reopening recomputes');

    const accepted = await temperatures(), bad = JSON.parse(constant.text);
    bad.report = { diffuseSky: { proposal: { transmission: [1, 1] } } };
    const badPath = runDirectory + '/forged-sky-result.json';
    await writeFile(badPath, JSON.stringify(bad));
    await file('#shade-import', badPath);
    await until("document.getElementById('shade-status').dataset.state==='file-refused'");
    assert.deepEqual(await temperatures(), accepted);
    assert.equal(await value("document.getElementById('shade-export').disabled"), false);
    await value("window.__skyOriginalText=File.prototype.text;window.__skyReleaseRead=null;File.prototype.text=async function(){await new Promise(resolve=>window.__skyReleaseRead=resolve);return window.__skyOriginalText.call(this)}");
    await file('#shade-import', constant.path); await until('Boolean(window.__skyReleaseRead)');
    assert.equal(await value("document.getElementById('shade-export').disabled"), true);
    assert.equal(await value("document.getElementById('shade-status').dataset.state"), 'file-pending');
    assert.equal(await value("document.getElementById('shade-run').disabled"), true);
    await field('shade-diffuseHorizontalWm2', 81);
    await value('window.__skyReleaseRead();File.prototype.text=window.__skyOriginalText');
    await delay(100);
    assert.equal(await value("document.getElementById('shade-results').children.length"), 0);
    assert.notEqual(await value("document.getElementById('shade-status').dataset.state"), 'compared');
    assert.equal(await value("document.getElementById('shade-import').value"), '');
    await file('#shade-import', constant.path);
    await until("document.getElementById('shade-status').dataset.state==='compared'");
    checks.push('Forged derived reports refuse transactionally; a pending v3 file disables export and its late completion cannot revive a changed draft');

    await value("window.__skyNativeWorker=window.Worker;window.Worker=class{constructor(){throw Error('Authored worker startup failure')}}");
    await field('shade-diffuseHorizontalWm2', 82);
    await value("document.getElementById('shade-form').requestSubmit()");
    await until("document.getElementById('shade-status').dataset.state==='refused'");
    assert.equal(await value("document.getElementById('shade-results').children.length"), 0);
    assert.equal(await value("document.getElementById('shade-export').disabled"), true);
    await value('window.Worker=window.__skyNativeWorker');
    await file('#shade-import', constant.path);
    await until("document.getElementById('shade-status').dataset.state==='compared'");
    checks.push('Worker startup failure refuses visibly without a synchronous calculation or stale accepted result');

    // Each wrapped transport still runs the actual module worker. Only delivery
    // of its real completion is held, allowing a cancelled callback to arrive late.
    await value("window.__skyHeld=[];window.Worker=class{constructor(...args){const real=new window.__skyNativeWorker(...args);const record={terminated:false,deliver:null};const port={onmessage:null,onerror:null,postMessage(message){real.postMessage(message)},terminate(){record.terminated=true;real.terminate()}};real.onmessage=event=>{record.deliver=()=>port.onmessage?.(event)};real.onerror=event=>port.onerror?.(event);window.__skyHeld.push(record);return port}}");
    await field('shade-diffuseHorizontalWm2', 60);
    await value("document.getElementById('shade-form').requestSubmit()");
    await until('Boolean(window.__skyHeld[0]?.deliver)');
    await field('shade-diffuseHorizontalWm2', 100);
    await value("document.getElementById('shade-form').requestSubmit()");
    await until('Boolean(window.__skyHeld[1]?.deliver)');
    assert.equal(await value('window.__skyHeld[0].terminated'), true);
    assert.equal(await value('window.__skyHeld[1].terminated'), false);
    await value('window.__skyHeld[0].deliver()');
    assert.equal(await value('window.__skyHeld[1].terminated'), false);
    assert.notEqual(await value("document.getElementById('shade-status').dataset.state"), 'compared');
    assert.equal(await value("document.getElementById('shade-export').disabled"), true);
    await value('window.__skyHeld[1].deliver()');
    await until("document.getElementById('shade-status').dataset.state==='compared'");
    assert.equal(await value('window.__skyHeld[1].terminated'), true);
    await matches(compareShadeHeat(example.project, { ...declaration, diffuseHorizontalWm2: 100 }));
    await value('window.Worker=window.__skyNativeWorker');
    checks.push('A cancelled real worker completion cannot terminate or publish over its pending successor; only the newer forcing reaches the interface');

    const raw = JSON.stringify(authoredPowerWeather()), rawPath = runDirectory + '/authored-hourly.json';
    await writeFile(rawPath, raw);
    await file('#shade-weather-import', rawPath);
    await until("document.getElementById('shade-latitudeDeg').disabled");
    await run();
    assert.equal(await value("document.getElementById('shade-sky-enabled').checked"), true);
    const hourly = await download('hourly');
    assert.equal(hourly.parsed.investigation.kind, 'experimental-earth/shade-heat-inputs/3');
    assert.equal(hourly.parsed.investigation.declaration.weather.rawText, raw);
    assert.deepEqual(hourly.parsed.investigation.declaration.diffuseSky, declaration.diffuseSky);
    await send('Page.reload', { ignoreCache: true });
    await until("Boolean(document.getElementById('shade-import'))");
    await file('#shade-import', hourly.path);
    await until("document.getElementById('shade-status').dataset.state==='compared'");
    await matches(hourly.parsed.report);
    assert.equal(await value("document.getElementById('shade-startUtc').value"), '2025-06-21T00:00:00.000Z');
    assert.equal(await value("document.getElementById('shade-reservoirC').disabled"), true);
    assert.match(await value("document.getElementById('shade-inspect').textContent"), /Original weather hour/);
    assert.equal(await stored(), original);
    checks.push('Original hourly weather and mapped sky remain attached through actual v3 download and fresh reopen, with the source time and weather controls locked');

    const projectPath = runDirectory + '/original-site.json';
    await writeFile(projectPath, JSON.stringify(example.project));
    await file('#import', projectPath);
    await until("JSON.parse(localStorage.getItem('experimental-earth-site-v1')).title==='Authored courtyard · morning shade'");
    await file('#shade-import', constant.path);
    await until("document.getElementById('shade-status').dataset.state==='compared'");
    await click('shade-current'); await run();
    await value("(()=>{const e=document.getElementById('rain');e.value=25;e.dispatchEvent(new Event('change',{bubbles:true}));})()");
    assert.equal(await value("document.getElementById('shade-results').children.length"), 0);
    assert.equal(await value("document.getElementById('shade-run').disabled"), true);
    await file('#shade-import', constant.path);
    await until("document.getElementById('shade-status').dataset.state==='compared'");
    assert.equal(JSON.parse(await stored()).weather.rainMmHr, 25);
    assert.equal(constant.parsed.investigation.project.weather.rainMmHr, example.project.weather.rainMmHr);
    checks.push('Changing the working site retires its live sky investigation; original-file replay retains its independent source');

    const uncertain = structuredClone(example.project);
    uncertain.solarStudy.proposal[0].heightMinM = 0;
    const uncertainDeclaration = { ...declaration, diffuseSky: { azimuthSamples: 32, elevationBands: 16 } };
    const uncertainText = serializeShadeHeatInvestigation(uncertain, uncertainDeclaration);
    const uncertainReport = parseShadeHeatInvestigation(uncertainText).report;
    assert.ok(uncertainReport.diffuseSky.proposal.ambiguousDirections > 0);
    const uncertainPath = runDirectory + '/uncertain-sky.json';
    await writeFile(uncertainPath, uncertainText);
    await file('#shade-import', uncertainPath);
    await until("document.getElementById('shade-status').dataset.state==='compared'");
    await matches(uncertainReport);
    assert.match(await value("document.getElementById('shade-summary').textContent"), /unresolved incident input/);
    await value("document.getElementById('shade-sky-inspection').open=true");
    assert.match(await value("document.getElementById('shade-sky-inspection').textContent"), /unresolved directions/);
    await value("document.getElementById('shade-sky-direction').scrollIntoView({block:'center',behavior:'instant'});document.getElementById('shade-sky-direction').focus()");
    const before = await value("document.getElementById('shade-sky-direction').value");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    assert.notEqual(await value("document.getElementById('shade-sky-direction').value"), before);
    assert.match(await value("document.getElementById('shade-sky-ray').textContent"), /Heading from increasing grid columns/);
    checks.push('Uncertain height produces inspectable diffuse and thermal ranges, and keyboard input changes the actual sky witness');

    await until("!document.getElementById('toast').classList.contains('show')");
    for (const [width, height, mobile] of [[1440, 1000, false], [390, 844, true]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, mobile, deviceScaleFactor: 1 });
      await delay(100);
      assert.ok(await value('document.documentElement.scrollWidth<=innerWidth+1'));
      await value("document.getElementById('shade-sky-inspection').open=true;document.getElementById('shade-sky-inspection').scrollIntoView({block:'start',behavior:'instant'})");
      await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(runDirectory + '/sky-' + width + '.png', Buffer.from(screenshot.data, 'base64'));
    }
    await value("document.getElementById('shade-settings').open=true;document.getElementById('shade-sky-enabled').scrollIntoView({block:'center',behavior:'instant'})");
    await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    await delay(100);
    const checkbox = await value("(()=>{const r=document.getElementById('shade-sky-enabled').getBoundingClientRect();return {width:r.width,height:r.height,top:r.top,bottom:r.bottom}})()");
    assert.ok(checkbox.width > 0 && checkbox.width < 40 && checkbox.height > 0 && checkbox.top >= 0 && checkbox.bottom <= 844);
    const settings = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(runDirectory + '/sky-settings-390.png', Buffer.from(settings.data, 'base64'));
    assert.deepEqual(exceptions, []);
    checks.push('Sky controls and witness inspection fit desktop and 390px layouts without application exceptions');
    return { checks, sandbox: session.sandbox, exceptions };
  });
  const receipt = { status: 'PASS', ...result.value, receipt: result.receipt };
  await writeFile(runDirectory + '/browser.json', JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error), checks,
    receipt: error.receipt ?? null, runDirectory }, null, 2));
  process.exitCode = 1;
}
