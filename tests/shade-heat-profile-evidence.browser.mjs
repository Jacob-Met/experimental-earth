import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { prepareSolarStudy } from '../solar-occlusion.js';
import { serializeShadeHeatInvestigation } from '../shade-heat.js';
import { prepareShadeHeatProfileRangeSource } from '../shade-heat-profile-range.js';
import { prepareShadeHeatProfileEvidence, prepareShadeHeatProfileEvidenceSource, parseShadeHeatProfileEvidence } from '../shade-heat-profile-evidence.js';
import { authoredPowerWeather } from './weather-power-fixture.mjs';
import { parsePowerHourly, POWER_HOURLY_FORMAT } from '../weather-power.js';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = root + '.browser-run-sky-evidence-' + randomUUID(), checks = [];
const fixture = makeShadeHeatExample(); fixture.declaration.directNormalWm2 = 0;
fixture.project.title = 'Authored opposite-column reading control';
fixture.project.solarStudy = prepareSolarStudy(fixture.project, { ...fixture.project.solarStudy,
  existing: [{ cellIndex: 4, heightMinM: 3, heightMaxM: 3, source: 'Authored west column' }],
  proposal: [{ cellIndex: 6, heightMinM: 3, heightMaxM: 3, source: 'Authored east column' }] });
fixture.declaration.diffuseSky = { method: 'weighted-continuous-columns', azimuthWeights: Array(8).fill(1) };
const attribution = 'Authored independent final-surface band; no field measurement';
function query(declaration = fixture.declaration, temperatureC = 22, halfWidthC = .1, bins = 8) {
  return { bins, reading: { target: 'existing', store: 'surfaceC', aggregation: 'instant',
    cellIndex: fixture.project.heatColumnStudy.heatStudy.cellIndex, utc: new Date(declaration.path.endUtc).toISOString(),
    temperatureC, halfWidthC, source: attribution } };
}
try {
  const result = await withBrowserSession({ root, runDirectory, chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome' }, async session => {
    const { send, evaluate: value, exceptions } = session;
    await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
    async function until(expression) {
      for (let i = 0; i < 750; i++) { try { if (await value(expression)) return; } catch {} await delay(40); }
      throw Error('Timed out: ' + expression + '; ' + await value("document.getElementById('shade-profile-evidence-status')?.textContent"));
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
    async function compared(compatibility = 'compatible') {
      await until("document.getElementById('shade-profile-evidence-status').dataset.state===" + JSON.stringify(compatibility));
    }
    async function matches(report) {
      const actual = await value("({...document.getElementById('shade-profile-evidence-results').dataset})");
      assert.equal(actual.status, report.compatibility); assert.equal(Number(actual.bins), report.query.bins);
      if (report.ranges) for (const store of ['surfaceC', 'subsurfaceC']) for (const bound of ['lower', 'upper'])
        assert.equal(Number(actual[store + bound[0].toUpperCase() + bound.slice(1)]), report.ranges[store][bound].differenceC[bound]);
    }
    async function download(name) {
      const directory = runDirectory + '/download-' + name; await mkdir(directory);
      await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory }); await click('shade-profile-evidence-export');
      const path = directory + '/experimental-earth-shared-sky-final-reading-inputs.json'; let found = false;
      for (let i = 0; i < 500; i++) { try { await access(path); found = true; break; } catch { await delay(40); } }
      assert.ok(found); const text = await readFile(path, 'utf8'); return { path, text, parsed: parseShadeHeatProfileEvidence(text) };
    }
    await until("Boolean(document.getElementById('shade-profile-evidence-import'))"); const original = await stored();
    await value("window.evidenceRequests=[];window.evidencePost=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...a){window.evidenceRequests.push({operation:m.operation,query:m.query});return window.evidencePost.call(this,m,...a)}");
    const rangePath = runDirectory + '/opposite-profile.json';
    await writeFile(rangePath, JSON.stringify(prepareShadeHeatProfileRangeSource(fixture.project, fixture.declaration, { bins: 8 })));
    await file('#shade-profile-import', rangePath); await until("document.getElementById('shade-profile-status').dataset.state==='compared'");
    assert.equal(await value("document.getElementById('shade-profile-evidence-run').disabled"), false);
    await field('shade-profile-evidence-temperature', 22); await field('shade-profile-evidence-width', .1);
    await field('shade-profile-evidence-attribution', attribution); await click('shade-profile-evidence-run'); await compared();
    const expected = prepareShadeHeatProfileEvidence(fixture.project, fixture.declaration, query()).report; await matches(expected);
    assert.equal(expected.work.profileIntersection.admittedOriginalVertices, 0); assert.equal(expected.work.profileIntersection.mixedVertices, 24);
    assert.ok(expected.ranges.surfaceC.lower.differenceC.lower > 2.3);
    assert.equal(await value("window.evidenceRequests.filter(x=>x.query?.reading&&x.operation==='prepare').length"), 1);
    assert.match(await value("document.getElementById('shade-profile-evidence-results').textContent"), /opposite-column reading control.*saved point B2/);
    assert.equal(await stored(), original);
    checks.push('Actual worker retains compatible mixed skies when every one-bin profile is excluded and narrows both same-profile design consequences');

    await value("document.querySelector('#shade-profile-evidence-results button[data-store=surfaceC][data-bound=upper]').click()");
    assert.equal(Number(await value("document.getElementById('shade-profile-evidence-witness').dataset.witness")), expected.ranges.surfaceC.upper.witnessId);
    await field('shade-profile-evidence-witness-select', 0);
    await value("document.getElementById('shade-profile-evidence-witness-select').scrollIntoView({block:'center',behavior:'instant'});document.getElementById('shade-profile-evidence-witness-select').focus()");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    assert.equal(await value("document.getElementById('shade-profile-evidence-witness-select').value"), '1');
    assert.equal(await value("document.getElementById('shade-profile-evidence-witness').dataset.witness"), '1');
    assert.match(await value("document.getElementById('shade-profile-evidence-witness').textContent"), /Exact mixture fractions/);
    checks.push('Separate extrema and real keyboard selection inspect mixture masses, exact fractions and both same-profile thermal endpoints');

    const saved = await download('eight'), raw = JSON.parse(saved.text);
    assert.deepEqual(Object.keys(raw), ['kind', 'model', 'source', 'query']); assert.deepEqual(raw.query, query());
    assert.deepEqual(raw.source.declaration.diffuseSky, fixture.declaration.diffuseSky); assert.deepEqual(raw.source.project, fixture.project);
    await send('Page.reload', { ignoreCache: true }); await until("Boolean(document.getElementById('shade-profile-evidence-import'))");
    await file('#shade-profile-evidence-import', saved.path); await compared(); await matches(saved.parsed.report);
    assert.notEqual(await value("document.getElementById('shade-profile-status').dataset.state"), 'compared');
    assert.notEqual(await value("document.getElementById('shade-status').dataset.state"), 'compared');
    await field('shade-profile-evidence-bins', 4); assert.equal(await value("document.getElementById('shade-profile-evidence-export').disabled"), true);
    await click('shade-profile-evidence-run'); await compared('incompatible');
    await matches(prepareShadeHeatProfileEvidence(fixture.project, fixture.declaration, query(fixture.declaration, 22, .1, 4)).report);
    await field('shade-profile-evidence-bins', 16); await click('shade-profile-evidence-run'); await compared();
    const sixteen = prepareShadeHeatProfileEvidence(fixture.project, fixture.declaration, query(fixture.declaration, 22, .1, 16)).report; await matches(sixteen);
    assert.equal(await stored(), original);
    checks.push('Actual source-only download reopens independently on a fresh page and bin edits recompute its original source without parent results');

    const forged = runDirectory + '/forged-reading.json'; await writeFile(forged, JSON.stringify({ ...raw, report: saved.parsed.report }));
    await file('#shade-profile-evidence-import', forged); await until("document.getElementById('shade-profile-evidence-status').dataset.state==='file-refused'");
    await matches(sixteen); assert.equal(await value("document.getElementById('shade-profile-evidence-export').disabled"), false);
    const slow = runDirectory + '/slow-reading.json'; await writeFile(slow, saved.text);
    await value("window.originalEvidenceArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow-reading.json')return new Promise(resolve=>{window.finishOldEvidence=()=>window.originalEvidenceArrayBuffer.call(this).then(resolve)});return window.originalEvidenceArrayBuffer.call(this)}");
    await file('#shade-profile-evidence-import', slow); await until("typeof window.finishOldEvidence==='function'");
    await field('shade-profile-evidence-width', .2); await value('window.finishOldEvidence()'); await delay(150);
    assert.equal(await value("document.getElementById('shade-profile-evidence-results').children.length"), 0);
    assert.equal(await value("document.getElementById('shade-profile-evidence-export').disabled"), true);
    assert.equal(await value("document.getElementById('shade-profile-evidence-width').value"), '0.2');
    await value('File.prototype.arrayBuffer=window.originalEvidenceArrayBuffer'); await click('shade-profile-evidence-run'); await compared();
    await matches(prepareShadeHeatProfileEvidence(fixture.project, fixture.declaration, query(fixture.declaration, 22, .2, 16)).report);
    checks.push('Forged results refuse transactionally and edited original bands retire delayed file results and stale downloads');

    await value("window.realEvidencePost=Worker.prototype.postMessage;window.holdEvidenceWorker=true;Worker.prototype.postMessage=function(m,...a){if(window.holdEvidenceWorker&&m.query?.reading){window.holdEvidenceWorker=false;const handler=this.onmessage;this.onmessage=e=>{window.finishHeldEvidenceWorker=()=>handler(e)}}return window.realEvidencePost.call(this,m,...a)}");
    await click('shade-profile-evidence-run'); await until("typeof window.finishHeldEvidenceWorker==='function'");
    await field('shade-profile-evidence-width', .3); await click('shade-profile-evidence-run'); await compared();
    const newer = prepareShadeHeatProfileEvidence(fixture.project, fixture.declaration, query(fixture.declaration, 22, .3, 16)).report;
    await matches(newer); await value('window.finishHeldEvidenceWorker()'); await delay(100); await matches(newer);
    assert.equal(await value("document.getElementById('shade-profile-evidence-width').value"), '0.3');
    await value('Worker.prototype.postMessage=window.realEvidencePost');
    checks.push('A held actual worker response cannot replace a newer completed reading inquiry after input retirement');

    const slowRange = runDirectory + '/slow-range.json'; await writeFile(slowRange, await readFile(rangePath));
    await value("window.originalRangeArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow-range.json')return new Promise(resolve=>{window.finishOldRange=()=>window.originalRangeArrayBuffer.call(this).then(resolve)});return window.originalRangeArrayBuffer.call(this)}");
    await file('#shade-profile-import', slowRange); await until("typeof window.finishOldRange==='function'");
    await file('#shade-profile-evidence-import', saved.path); await compared(); await value('window.finishOldRange()'); await delay(150);
    await matches(saved.parsed.report); assert.notEqual(await value("document.getElementById('shade-profile-status').dataset.state"), 'compared');
    await value('File.prototype.arrayBuffer=window.originalRangeArrayBuffer');
    const slowParent = runDirectory + '/slow-parent.json'; await writeFile(slowParent, serializeShadeHeatInvestigation(fixture.project, fixture.declaration));
    await value("window.originalParentText=File.prototype.text;File.prototype.text=function(){if(this.name==='slow-parent.json')return new Promise(resolve=>{window.finishOldParent=()=>window.originalParentText.call(this).then(resolve)});return window.originalParentText.call(this)}");
    await file('#shade-import', slowParent); await until("typeof window.finishOldParent==='function'");
    await file('#shade-profile-evidence-import', saved.path); await compared(); await value('window.finishOldParent()'); await delay(150);
    await matches(saved.parsed.report); assert.notEqual(await value("document.getElementById('shade-status').dataset.state"), 'compared');
    await value('File.prototype.text=window.originalParentText');
    checks.push('Newer reading input retires both pending ancestor file loads so neither can relabel or replace the accepted source');

    await field('shade-profile-evidence-temperature', 40); await click('shade-profile-evidence-run'); await compared('incompatible');
    assert.equal(await value("document.getElementById('shade-profile-evidence-witness')"), null);
    assert.equal(await value("document.getElementById('shade-profile-evidence-export').disabled"), false);
    const rejected = await download('incompatible'); assert.equal(rejected.parsed.report.compatibility, 'incompatible');
    const uncertain = structuredClone(fixture); Object.assign(uncertain.project.solarStudy.existing[0], { heightMinM: 1, heightMaxM: 4 });
    const uncertainPath = runDirectory + '/unresolved-reading-operator.json';
    await writeFile(uncertainPath, JSON.stringify(prepareShadeHeatProfileEvidenceSource(uncertain.project, uncertain.declaration, query())));
    await file('#shade-profile-evidence-import', uncertainPath); await until("document.getElementById('shade-profile-evidence-status').dataset.state==='file-refused'");
    assert.match(await value("document.getElementById('shade-profile-evidence-status').textContent"), /unresolved forcing endpoints/);
    assert.equal(await value("document.getElementById('shade-profile-evidence-results').dataset.status"), 'incompatible');
    const unsupported = structuredClone(fixture);
    for (const target of ['existing', 'proposal']) {
      for (const study of [unsupported.project.surfaceHeatStudy, unsupported.project.heatColumnStudy.heatStudy])
        Object.assign(study[target], { capacityJm2K: 1000, exchangeWm2K: 0, absorptivity: 1 });
      unsupported.project.heatColumnStudy.lowerLayers[target].conductanceWm2K = 0;
    }
    const unsupportedPath = runDirectory + '/unsupported-basis.json';
    await writeFile(unsupportedPath, JSON.stringify(prepareShadeHeatProfileEvidenceSource(unsupported.project, unsupported.declaration, query())));
    await file('#shade-profile-evidence-import', unsupportedPath); await until("document.getElementById('shade-profile-evidence-status').dataset.state==='file-refused'");
    assert.match(await value("document.getElementById('shade-profile-evidence-status').textContent"), /No partial profile range is accepted/);
    assert.equal(await value("document.getElementById('shade-profile-evidence-results').dataset.status"), 'incompatible');
    checks.push('An incompatible band remains a complete empty-family result; unresolved observation operators and unsupported vertices refuse without survivor ranges');

    const rawText = JSON.stringify(authoredPowerWeather()), weather = parsePowerHourly(rawText);
    const hourly = { path: { ...fixture.declaration.path, startUtc: weather.startUtc, endUtc: weather.endUtc, stepMinutes: 60 },
      weather: { format: POWER_HOURLY_FORMAT, rawText }, diffuseSky: fixture.declaration.diffuseSky };
    const hourlyPath = runDirectory + '/hourly-reading.json';
    await writeFile(hourlyPath, JSON.stringify(prepareShadeHeatProfileEvidenceSource(fixture.project, hourly, query(hourly, 23, 20, 4))));
    await file('#shade-profile-evidence-import', hourlyPath); await compared();
    const hourlySaved = await download('hourly'); assert.equal(hourlySaved.parsed.investigation.source.declaration.weather.rawText, rawText);
    assert.equal(await stored(), original);
    await field('shade-profile-bins', 16);
    assert.equal(await value("document.getElementById('shade-profile-evidence-results').children.length"), 0);
    assert.equal(await value("document.getElementById('shade-profile-evidence-export').disabled"), true);
    assert.equal(await value("document.getElementById('shade-profile-evidence-temperature').value"), '');
    await file('#shade-profile-evidence-import', saved.path); await compared();
    await field('shade-gridColumnBearingDeg', 90);
    assert.equal(await value("document.getElementById('shade-profile-evidence-results').children.length"), 0);
    assert.equal(await value("document.getElementById('shade-profile-evidence-export').disabled"), true);
    await file('#shade-profile-evidence-import', saved.path); await compared();
    checks.push('Complete hourly weather and reading attribution survive download while either ancestor input retires dependent results and source attachment');

    await until("!document.getElementById('toast').classList.contains('show')");
    for (const [width, height, mobile] of [[1440, 1000, false], [390, 844, true]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, mobile, deviceScaleFactor: 1 }); await delay(100);
      assert.ok(await value('document.documentElement.scrollWidth<=innerWidth+1'));
      for (const [id, label] of [['shade-profile-evidence', 'controls'], ['shade-profile-evidence-results', 'range'], ['shade-profile-evidence-witness', 'witness']]) {
        await value('document.getElementById(' + JSON.stringify(id) + ').scrollIntoView({block:"start",behavior:"instant"})');
        await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        await writeFile(runDirectory + '/sky-evidence-' + label + '-' + width + '.png', Buffer.from(shot.data, 'base64'));
      }
    }
    assert.deepEqual(exceptions, []);
    checks.push('Actual reading controls, horizontally scrollable ranges and mixture inspection fit desktop and 390px with no application exceptions');
    return { checks, sandbox: session.sandbox, exceptions };
  });
  const receipt = { status: 'PASS', ...result.value, receipt: result.receipt };
  await writeFile(runDirectory + '/browser.json', JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error), checks, receipt: error.receipt ?? null, runDirectory }, null, 2));
  process.exitCode = 1;
}
