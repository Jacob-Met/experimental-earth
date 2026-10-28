import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { prepareSolarStudy } from '../solar-occlusion.js';
import { serializeShadeHeatInvestigation } from '../shade-heat.js';
import { prepareShadeHeatProfileRangeSource, compareShadeHeatProfileRange, parseShadeHeatProfileRange } from '../shade-heat-profile-range.js';
import { authoredPowerWeather } from './weather-power-fixture.mjs';
import { parsePowerHourly, POWER_HOURLY_FORMAT } from '../weather-power.js';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = root + '.browser-run-shared-sky-' + randomUUID(), checks = [];
const fixture = makeShadeHeatExample(); fixture.declaration.directNormalWm2 = 0;
fixture.project.title = 'Authored opposite-column shared-sky control';
fixture.project.solarStudy = prepareSolarStudy(fixture.project, { ...fixture.project.solarStudy,
  existing: [{ cellIndex: 4, heightMinM: 3, heightMaxM: 3, source: 'Authored west column' }],
  proposal: [{ cellIndex: 6, heightMinM: 3, heightMaxM: 3, source: 'Authored east column' }] });
fixture.declaration.diffuseSky = { method: 'weighted-continuous-columns', azimuthWeights: Array(8).fill(1) };
try {
  const result = await withBrowserSession({ root, runDirectory, chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome' }, async session => {
    const { send, evaluate: value, exceptions } = session;
    await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
    async function until(expression) {
      for (let i = 0; i < 750; i++) { try { if (await value(expression)) return; } catch {} await delay(40); }
      throw Error('Timed out: ' + expression + '; ' + await value("document.getElementById('shade-profile-status')?.textContent"));
    }
    const click = id => value('document.getElementById(' + JSON.stringify(id) + ').click()');
    async function field(id, content) {
      await value('(()=>{const e=document.getElementById(' + JSON.stringify(id) + ');e.value=' + JSON.stringify(String(content))
        + ';e.dispatchEvent(new Event("input",{bubbles:true}));})()');
    }
    async function file(selector, path) {
      const document = await send('DOM.getDocument');
      const input = await send('DOM.querySelector', { nodeId: document.root.nodeId, selector }); assert.ok(input.nodeId);
      await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [path] });
    }
    const stored = () => value("localStorage.getItem('experimental-earth-site-v1')");
    async function compared() { await until("document.getElementById('shade-profile-status').dataset.state==='compared'"); }
    async function matches(report) {
      const actual = await value("({...document.getElementById('shade-profile-results').dataset})");
      assert.equal(Number(actual.bins), report.query.bins);
      for (const field of ['surfaceC', 'subsurfaceC']) for (const bound of ['lower', 'upper'])
        assert.ok(Math.abs(Number(actual[field + bound[0].toUpperCase() + bound.slice(1)]) - report.ranges[field][bound].differenceC) < 2e-8);
    }
    async function download(name) {
      const directory = runDirectory + '/download-' + name; await mkdir(directory);
      await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory }); await click('shade-profile-export');
      const path = directory + '/experimental-earth-shared-sky-final-range-inputs.json'; let found = false;
      for (let i = 0; i < 500; i++) { try { await access(path); found = true; break; } catch { await delay(40); } }
      assert.ok(found); const text = await readFile(path, 'utf8'); return { path, text, parsed: parseShadeHeatProfileRange(text) };
    }
    await until("Boolean(document.getElementById('shade-profile-import'))"); const original = await stored();
    await value("window.profileRequests=[];window.profilePost=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...a){window.profileRequests.push({operation:m.operation,query:m.query});return window.profilePost.call(this,m,...a)}");
    const parentPath = runDirectory + '/opposite-parent.json'; await writeFile(parentPath, serializeShadeHeatInvestigation(fixture.project, fixture.declaration));
    await file('#shade-import', parentPath); await until("document.getElementById('shade-status').dataset.state==='compared'");
    assert.equal(await value("document.getElementById('shade-profile-run').disabled"), false);
    await click('shade-profile-run'); await compared();
    const expected = compareShadeHeatProfileRange(fixture.project, fixture.declaration, { bins: 8 }); await matches(expected);
    assert.ok(expected.ranges.surfaceC.lower.differenceC < -5 && expected.ranges.surfaceC.upper.differenceC > 5);
    assert.equal(await value("window.profileRequests.filter(x=>x.query?.bins===8&&x.operation==='prepare').length"), 1);
    assert.match(await value("document.getElementById('shade-profile-results').textContent"), /opposite-column.*saved ground point B2/);
    assert.equal(await stored(), original);
    checks.push('Actual child worker exposes both signs from one shared profile domain while retaining the original site and parent profile');

    await value("document.querySelector('#shade-profile-results button[data-store=surfaceC][data-bound=upper]').click()");
    assert.equal(Number(await value("document.getElementById('shade-profile-witness').dataset.bin")), expected.ranges.surfaceC.upper.bin);
    await field('shade-profile-witness-bin', 0);
    await value("document.getElementById('shade-profile-witness-bin').scrollIntoView({block:'center',behavior:'instant'});document.getElementById('shade-profile-witness-bin').focus()");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    assert.equal(await value("document.getElementById('shade-profile-witness-bin').value"), '1');
    assert.equal(await value("document.getElementById('shade-profile-witness').dataset.bin"), '1');
    assert.match(await value("document.getElementById('shade-profile-witness').textContent"), /Same-profile endpoint evidence/);
    checks.push('Separate extrema buttons and actual keyboard input inspect the complete same-bin transmission and paired terminal-temperature witnesses');

    const saved = await download('eight'), raw = JSON.parse(saved.text);
    assert.deepEqual(Object.keys(raw), ['kind', 'model', 'source', 'query']);
    assert.deepEqual(raw.source.declaration.diffuseSky, fixture.declaration.diffuseSky);
    assert.deepEqual(raw.source.project, fixture.project);
    await send('Page.reload', { ignoreCache: true }); await until("Boolean(document.getElementById('shade-profile-import'))");
    await file('#shade-profile-import', saved.path); await compared(); await matches(saved.parsed.report);
    assert.notEqual(await value("document.getElementById('shade-status').dataset.state"), 'compared');
    assert.equal(await stored(), original);
    await field('shade-profile-bins', 4); assert.equal(await value("document.getElementById('shade-profile-export').disabled"), true);
    await click('shade-profile-run'); await compared(); await matches(compareShadeHeatProfileRange(fixture.project, fixture.declaration, { bins: 4 }));
    checks.push('An actual source-only download reopens in a fresh document and changing bins recomputes that original child source without a parent result');

    const forged = runDirectory + '/forged-profile.json'; await writeFile(forged, JSON.stringify({ ...raw, report: saved.parsed.report }));
    await file('#shade-profile-import', forged); await until("document.getElementById('shade-profile-status').dataset.state==='file-refused'");
    assert.equal(await value("document.getElementById('shade-profile-results').dataset.bins"), '4');
    assert.equal(await value("document.getElementById('shade-profile-export').disabled"), false);
    const slow = runDirectory + '/slow-profile.json'; await writeFile(slow, saved.text);
    await value("window.originalProfileArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow-profile.json')return new Promise(resolve=>{window.finishOldProfile=()=>window.originalProfileArrayBuffer.call(this).then(resolve)});return window.originalProfileArrayBuffer.call(this)}");
    await file('#shade-profile-import', slow); await until("typeof window.finishOldProfile==='function'");
    await field('shade-profile-bins', 16); await value('window.finishOldProfile()'); await delay(150);
    assert.equal(await value("document.getElementById('shade-profile-results').children.length"), 0);
    assert.equal(await value("document.getElementById('shade-profile-export').disabled"), true);
    assert.equal(await value("document.getElementById('shade-profile-bins').value"), '16');
    await value('File.prototype.arrayBuffer=window.originalProfileArrayBuffer'); await click('shade-profile-run'); await compared();
    await matches(compareShadeHeatProfileRange(fixture.project, fixture.declaration, { bins: 16 }));
    checks.push('Forged derived results refuse transactionally and bin edits retire delayed input loads and their downloads before recomputation');

    const slowParent = runDirectory + '/slow-parent.json'; await writeFile(slowParent, await readFile(parentPath));
    await value("window.originalParentText=File.prototype.text;File.prototype.text=function(){if(this.name==='slow-parent.json')return new Promise(resolve=>{window.finishOldParent=()=>window.originalParentText.call(this).then(resolve)});return window.originalParentText.call(this)}");
    await file('#shade-import', slowParent); await until("typeof window.finishOldParent==='function'");
    await file('#shade-profile-import', saved.path); await compared();
    await value('window.finishOldParent()'); await delay(150); await matches(saved.parsed.report);
    assert.notEqual(await value("document.getElementById('shade-status').dataset.state"), 'compared');
    await value('File.prototype.text=window.originalParentText');
    checks.push('A newer independent child import retires an older pending parent import so its late completion cannot overwrite or invalidate the new result');

    const refused = makeShadeHeatExample(); refused.declaration.directNormalWm2 = 0;
    refused.project.solarStudy.existing = structuredClone(refused.project.solarStudy.proposal);
    for (const target of ['existing', 'proposal']) {
      for (const study of [refused.project.surfaceHeatStudy, refused.project.heatColumnStudy.heatStudy])
        Object.assign(study[target], { capacityJm2K: 1000, exchangeWm2K: 0, absorptivity: 1 });
      refused.project.heatColumnStudy.lowerLayers[target].conductanceWm2K = 0;
    }
    const refusalPath = runDirectory + '/unsupported-vertex.json';
    await writeFile(refusalPath, JSON.stringify(prepareShadeHeatProfileRangeSource(refused.project, refused.declaration, { bins: 8 })));
    await file('#shade-profile-import', refusalPath); await until("document.getElementById('shade-profile-status').dataset.state==='file-refused'");
    assert.match(await value("document.getElementById('shade-profile-status').textContent"), /No partial profile range is accepted/);
    await matches(saved.parsed.report);
    checks.push('One unsupported vertex refuses the complete new inquiry and visibly retains the prior accepted source instead of presenting a survivor range');

    const rawText = JSON.stringify(authoredPowerWeather()), weather = parsePowerHourly(rawText);
    const hourly = { path: { ...fixture.declaration.path, startUtc: weather.startUtc, endUtc: weather.endUtc, stepMinutes: 60 },
      weather: { format: POWER_HOURLY_FORMAT, rawText }, diffuseSky: fixture.declaration.diffuseSky };
    const hourlyPath = runDirectory + '/hourly-profile.json';
    await writeFile(hourlyPath, JSON.stringify(prepareShadeHeatProfileRangeSource(fixture.project, hourly, { bins: 8 })));
    await file('#shade-profile-import', hourlyPath); await compared();
    await matches(compareShadeHeatProfileRange(fixture.project, hourly, { bins: 8 }));
    const hourlySaved = await download('hourly'); assert.equal(hourlySaved.parsed.investigation.source.declaration.weather.rawText, rawText);
    assert.equal(await stored(), original);
    await field('shade-gridColumnBearingDeg', 90);
    assert.equal(await value("document.getElementById('shade-profile-results').children.length"), 0);
    assert.equal(await value("document.getElementById('shade-profile-export').disabled"), true);
    await file('#shade-profile-import', saved.path); await compared();
    checks.push('Original hourly weather remains byte-attached through actual download; parent input edits retire the child result and reopening restores its own source');

    await until("!document.getElementById('toast').classList.contains('show')");
    for (const [width, height, mobile] of [[1440, 1000, false], [390, 844, true]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, mobile, deviceScaleFactor: 1 }); await delay(100);
      assert.ok(await value('document.documentElement.scrollWidth<=innerWidth+1'));
      await value("document.getElementById('shade-profile-range').scrollIntoView({block:'start',behavior:'instant'})");
      await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(runDirectory + '/shared-sky-' + width + '.png', Buffer.from(shot.data, 'base64'));
      if (width === 390) {
        for (const [id, label] of [['shade-profile-results', 'range'], ['shade-profile-witness', 'witness']]) {
          await value('document.getElementById(' + JSON.stringify(id) + ').scrollIntoView({block:"start",behavior:"instant"})');
          await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
          const detail = await send('Page.captureScreenshot', { format: 'png' });
          await writeFile(runDirectory + '/shared-sky-' + label + '-390.png', Buffer.from(detail.data, 'base64'));
        }
      }
    }
    assert.deepEqual(exceptions, []);
    checks.push('Profile-range controls and scrollable evidence tables fit desktop and 390px screens with no application exceptions');
    return { checks, sandbox: session.sandbox, exceptions };
  });
  const receipt = { status: 'PASS', ...result.value, receipt: result.receipt };
  await writeFile(runDirectory + '/browser.json', JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error), checks, receipt: error.receipt ?? null, runDirectory }, null, 2));
  process.exitCode = 1;
}
