import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { makeExample } from '../core.js';
import { prepareSurfaceHeatStudy } from '../surface-heat.js';
import { prepareHeatEvidence, authoredHeatEvidenceExample } from '../surface-heat-evidence.js';
import { formatHeatEnergyReadings } from '../surface-heat-evidence-table.js';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = root + '.browser-run-heat-energy-' + randomUUID(), checks = [];
const project = makeExample();
const h = { absorptivity: .4, capacityJm2K: 40000, exchangeWm2K: 10, initialC: 25, source: 'Authored material for browser control, not a measured property' };
project.surfaceHeatStudy = prepareSurfaceHeatStudy(project, { cellIndex: 0, existing: h, proposal: h, schedule: [
  { minutes: 60, incidentWm2: 600, reservoirC: 25, source: 'Authored heating control' },
  { minutes: 180, incidentWm2: 0, reservoirC: 25, source: 'Authored dark interval' },
] });
project.surfaceHeatEvidence = prepareHeatEvidence(project, authoredHeatEvidenceExample(project));
const literal = '<img src=x onerror=window.__heatEnergyInjected=1> Authored absorbed-input control, not a measured or independent reading';
const energy = [{ fromMinute: 0, toMinute: 60, energyJm2: 864000, halfWidthJm2: 20000, use: 'challenge', source: literal }];

try {
  const result = await withBrowserSession({ root, runDirectory, chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome' }, async session => {
    const { evaluate, send, exceptions } = session;
    await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
    async function until(expression) {
      for (let i = 0; i < 100; i++) { try { if (await evaluate(expression)) return; } catch {} await delay(40); }
      throw Error('Timed out: ' + expression + ' ' + await evaluate("document.querySelector('#heat-evidence-status')?.textContent"));
    }
    await until("Boolean(document.querySelector('#heat-energy-readings'))");
    async function nativeFile(selector, path) {
      const doc = await send('DOM.getDocument'), element = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
      await send('DOM.setFileInputFiles', { nodeId: element.nodeId, files: [path] }); await delay(150);
    }
    async function run(state) {
      await evaluate("document.querySelector('#heat-evidence-run').click()");
      await until("!document.querySelector('#heat-evidence-run').disabled");
      assert.equal(await evaluate("document.querySelector('#heat-evidence-status').dataset.state"), state,
        await evaluate("document.querySelector('#heat-evidence-status').textContent"));
    }
    const stored = async () => JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
    const basePath = runDirectory + '/temperature-only.json'; await writeFile(basePath, JSON.stringify(project));
    await nativeFile('#import', basePath); await run('ambiguous');
    assert.equal((await stored()).surfaceHeatEvidence.schema, 'experimental-earth-surface-heat-evidence/1');
    const energyPath = runDirectory + '/absorbed-energy.csv'; await writeFile(energyPath, formatHeatEnergyReadings(energy));
    await evaluate("document.querySelector('#heat-energy-fields').open=true");
    await nativeFile('#heat-energy-file', energyPath);
    assert.equal(await evaluate("document.querySelector('#heat-evidence-run').disabled"), true);
    await evaluate("document.querySelector('#heat-evidence-form').requestSubmit()"); await run('one-survivor');
    const accepted = await stored();
    assert.equal(accepted.surfaceHeatEvidence.schema, 'experimental-earth-surface-heat-evidence/2');
    assert.deepEqual(accepted.surfaceHeatEvidence.energyReadings, energy);
    assert.deepEqual(accepted.surfaceHeatEvidence.readings, project.surfaceHeatEvidence.readings);
    assert.deepEqual(accepted.surfaceHeatEvidence.hypotheses, project.surfaceHeatEvidence.hypotheses);
    assert.equal(await evaluate("document.querySelectorAll('.heat-energy-comparison').length"), 3);
    assert.equal(await evaluate("document.querySelectorAll('#heat-evidence-results img').length"), 0);
    assert.equal(await evaluate('window.__heatEnergyInjected??null'), null);
    checks.push('Actual v1 source import plus sourced absorbed-energy CSV creates v2, retains temperatures and screens common-scale energy ambiguity');

    const wide = [{ ...energy[0], energyJm2: 1296000, halfWidthJm2: 432000 }];
    const widePath = runDirectory + '/wide-energy.csv'; await writeFile(widePath, formatHeatEnergyReadings(wide));
    await nativeFile('#heat-energy-file', widePath); await evaluate("document.querySelector('#heat-evidence-form').requestSubmit()"); await run('ambiguous');
    assert.deepEqual((await stored()).surfaceHeatEvidence.hypotheses, accepted.surfaceHeatEvidence.hypotheses);
    await nativeFile('#heat-energy-file', energyPath); await evaluate("document.querySelector('#heat-evidence-form').requestSubmit()"); await run('one-survivor');
    checks.push('Changed energy precision restores the two original compatible candidates without fitting or adopting properties');

    const download = runDirectory + '/download'; await mkdir(download);
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: download });
    await evaluate("document.querySelector('#export').click()");
    const exportedPath = download + '/experimental-earth-site.json';
    for (let i = 0; i < 100; i++) { try { await access(exportedPath); break; } catch { await delay(40); } }
    const exported = JSON.parse(await readFile(exportedPath, 'utf8')); assert.deepEqual(exported.surfaceHeatEvidence, accepted.surfaceHeatEvidence);
    await evaluate("document.querySelector('#heat-evidence-clear').click()");
    await send('Page.reload', { ignoreCache: true }); await until("Boolean(document.querySelector('#heat-energy-readings'))");
    await nativeFile('#import', exportedPath); await run('one-survivor');
    assert.deepEqual((await stored()).surfaceHeatEvidence, accepted.surfaceHeatEvidence);
    checks.push('Actual whole-project download and fresh native-file reopening preserve both sourced quantities and recompute the result');

    const malformed = runDirectory + '/incident-power.csv'; await writeFile(malformed, 'from_minute,to_minute,incident_w_m2,half_width_j_m2,use,source\n0,60,600,1,challenge,raw');
    await nativeFile('#heat-energy-file', malformed);
    assert.match(await evaluate("document.querySelector('#heat-evidence-status').textContent"), /columns/);
    assert.deepEqual((await stored()).surfaceHeatEvidence, accepted.surfaceHeatEvidence);
    const moved = structuredClone(exported); moved.surfaceHeatStudy.schedule[0].incidentWm2 += 1;
    const movedPath = runDirectory + '/changed-exposure.json'; await writeFile(movedPath, JSON.stringify(moved));
    await nativeFile('#import', movedPath); await run('context-changed');
    await evaluate("document.querySelector('#heat-evidence-form').requestSubmit()");
    assert.equal(await evaluate("document.querySelector('#heat-evidence-status').dataset.state"), 'refused');
    assert.deepEqual((await stored()).surfaceHeatEvidence, accepted.surfaceHeatEvidence);
    checks.push('Incident-power columns and changed exposure cannot replace or silently relabel the accepted absorbed-energy evidence');

    await nativeFile('#import', exportedPath); await run('one-survivor');
    const late = runDirectory + '/late-energy.csv'; await writeFile(late, formatHeatEnergyReadings(wide));
    await evaluate("(()=>{const original=File.prototype.text;File.prototype.text=function(){if(this.name==='late-energy.csv')return new Promise(resolve=>{window.releaseEnergyFile=async()=>{File.prototype.text=original;resolve(await original.call(this));};});return original.call(this);};})()");
    await nativeFile('#heat-energy-file', late); assert.equal(await evaluate('typeof window.releaseEnergyFile'), 'function');
    const originalTable = await evaluate("document.querySelector('#heat-energy-readings').value");
    await evaluate("document.querySelector('#heat-evidence-association').value='Newer source draft';document.querySelector('#heat-evidence-association').dispatchEvent(new Event('input'));window.releaseEnergyFile()"); await delay(60);
    assert.equal(await evaluate("document.querySelector('#heat-energy-readings').value"), originalTable);
    await nativeFile('#import', exportedPath); await run('one-survivor');
    checks.push('A newer source draft cancels delayed energy-file intake without replacing accepted inputs');

    await delay(3900);
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await evaluate("document.querySelector('.heat-candidate').open=true;document.querySelector('#heat-evidence-results').scrollIntoView({block:'start',behavior:'instant'})");
    let shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(runDirectory + '/energy-desktop.png', Buffer.from(shot.data, 'base64'));
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate("document.querySelector('.heat-energy-comparison').scrollIntoView({block:'center',behavior:'instant'});document.querySelector('.heat-energy-comparison').focus()");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }); await delay(120);
    assert.ok(await evaluate("document.querySelector('.heat-energy-comparison').scrollLeft>0"));
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
    shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(runDirectory + '/energy-narrow.png', Buffer.from(shot.data, 'base64'));
    await evaluate("document.querySelector('.heat-candidate summary').focus()");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await delay(50);
    assert.equal(await evaluate("document.querySelector('.heat-candidate').open"), false);
    assert.deepEqual(exceptions, []);
    checks.push('Actual desktop and390px evidence remain within viewport; keyboard scrolls energy table and opens/closes the sourced candidate');
    return { checks, sandbox: session.sandbox, exceptions };
  });
  console.log(JSON.stringify({ status: 'PASS', ...result.value, receipt: result.receipt }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error), checks, receipt: error.receipt ?? null }, null, 2)); process.exitCode = 1;
}
