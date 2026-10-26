import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { makeExample } from '../core.js';

export async function receiveOutletEvidence({ evaluate, send, delay, report, artifactDirectory }) {
  const p = makeExample(); p.width = 2; p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({length: 4}, () => ({elevationM: 0, surface: 'sealed', provenance: 'Authored analytic browser control'}));
  p.proposal = structuredClone(p.existing);
  p.weather = {...p.weather, rainMmHr: 61, stormMinutes: 60, durationMinutes: 60, stepMinutes: 30,
    cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0.38};
  await evaluate(`localStorage.setItem('experimental-earth-site-v1', ${JSON.stringify(JSON.stringify(p))})`);
  await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
  await send('Page.reload', {ignoreCache: true});
  for (let i = 0; i < 40; i++) {
    if (await evaluate("document.querySelectorAll('#existing-grid .cell').length === 4 && !!document.querySelector('#outlet-reading-form')")) break;
    await delay(100);
  }
  assert.equal(await evaluate("document.querySelectorAll('#existing-grid .cell').length"), 4);
  await evaluate(`(() => {
    const set=(id,value)=>document.getElementById(id).value=value;
    document.getElementById('outlet-entry').open=true;
    set('outlet-event','Authored arithmetic event; not measured');
    set('outlet-collection','Analytic complete four-cell boundary, not field data');
    document.getElementById('outlet-coverage').checked=true;
    set('outlet-rates','0, 0.1, 0.2'); set('outlet-end','30');
    set('outlet-volume','16000'); set('outlet-unit','mL'); set('outlet-uncertainty','0');
    set('outlet-source','Authored first interval = 16 L'); set('outlet-use','calibration');
    document.getElementById('outlet-reading-form').requestSubmit();
  })()`);
  assert.equal(await evaluate("document.querySelectorAll('#outlet-readings .observation').length"), 1);
  assert.equal(await evaluate("document.querySelector('#outlet-event').disabled"), true);
  await evaluate(`(() => {
    const set=(id,value)=>document.getElementById(id).value=value;
    set('outlet-start','30'); set('outlet-end','60'); set('outlet-volume','26.4'); set('outlet-unit','L');
    set('outlet-source','Authored second interval = 26.4 L'); set('outlet-use','challenge');
    document.getElementById('outlet-reading-form').requestSubmit(); document.getElementById('outlet-compare').click();
  })()`);
  assert.equal(await evaluate("document.querySelector('#outlet-status').dataset.state"), 'one-survivor');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-outlet-rate]')].map(e=>Number(e.dataset.outletRate))"), [0.1, 0, 0.2]);
  const saved = JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  assert.equal(saved.outletEvidence.readings[0].volume, 16000); assert.equal(saved.outletEvidence.readings[0].unit, 'mL');
  assert.equal(saved.outletEvidence.readings[1].use, 'challenge'); assert.equal(saved.weather.boundaryExitPerHour, 0.38);
  report.push('outlet: actual manual collection forms, mL-to-L scoring, fixed event/source, calibration versus held-aside interval');

  await evaluate("document.querySelector('#outlet-rates').value='0.1, 0.1'; document.querySelector('#outlet-compare').click()");
  assert.equal(await evaluate("document.querySelector('#outlet-status').dataset.state"), 'error');
  assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).outletEvidence, saved.outletEvidence);
  await evaluate("document.querySelector('#outlet-rates').value='0, 0.1, 0.2'; document.querySelector('#outlet-compare').click()");
  await send('Browser.setDownloadBehavior', {behavior: 'allow', downloadPath: artifactDirectory});
  await evaluate("document.querySelector('#export').click()");
  const path = artifactDirectory + '/experimental-earth-site.json';
  for (let i = 0; i < 30; i++) { try { await access(path); break; } catch { await delay(100); } }
  const exported = JSON.parse(await readFile(path, 'utf8'));
  assert.deepEqual(exported.outletEvidence, saved.outletEvidence);
  await send('Page.reload', {ignoreCache: true}); await delay(350);
  assert.equal(await evaluate("document.querySelectorAll('#outlet-readings .observation').length"), 2);
  assert.equal(await evaluate("document.querySelector('#outlet-status').dataset.state"), 'not-compared');
  await evaluate("document.querySelector('#outlet-compare').click()");
  assert.equal(await evaluate("document.querySelector('#outlet-status').dataset.state"), 'one-survivor');
  report.push('outlet: invalid candidate refusal preserves accepted record; actual project download and reload retain quantities/sources/roles');

  await evaluate("document.querySelector('#rain').value='62';document.querySelector('#rain').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#outlet-compare').click()");
  assert.equal(await evaluate("document.querySelector('#outlet-status').dataset.state"), 'context-changed');
  assert.equal(await evaluate("document.querySelectorAll('[data-outlet-rate]').length"), 0);
  await evaluate(`(async()=>{const input=document.querySelector('#import');const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(JSON.stringify(exported))}],'reopened-outlet-site.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,150));})()`);
  await evaluate("document.querySelector('#outlet-compare').click()");
  assert.equal(await evaluate("document.querySelector('#outlet-status').dataset.state"), 'one-survivor');
  report.push('outlet: changed storm refuses stale evidence and actual exported project import restores the comparison');

  const bad = structuredClone(exported); bad.outletEvidence.coverage = 'single-drain';
  await evaluate(`(async()=>{const input=document.querySelector('#import');const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(JSON.stringify(bad))}],'partial-collection.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,150));})()`);
  assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).outletEvidence, saved.outletEvidence);
  assert.ok(await evaluate("document.querySelector('#toast').textContent.includes('Import refused')"));
  await delay(4000); // Let the actual transient import notice finish before visual inspection.
  for (const width of [1280, 390]) {
    await send('Emulation.setDeviceMetricsOverride', {width, height: 900, deviceScaleFactor: 1, mobile: width === 390});
    await evaluate("document.documentElement.style.scrollBehavior='auto';document.querySelector('#outlet-entry').open=true;document.querySelector('#outlet-evidence-panel').scrollIntoView({block:'start',behavior:'instant'})");
    await delay(100);
    const size = await evaluate("(()=>{const panel=document.querySelector('#outlet-evidence-panel');return {width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,top:panel.getBoundingClientRect().top,scrollMarginTop:parseFloat(getComputedStyle(panel).scrollMarginTop)}})()");
    assert.ok(size.scroll <= size.width + 1, JSON.stringify(size));
    assert.ok(Number.isFinite(size.scrollMarginTop) && size.scrollMarginTop >= 0 && size.scrollMarginTop < size.height, JSON.stringify(size));
    assert.ok(Number.isFinite(size.top) && size.top >= 0 && size.top < size.height, JSON.stringify(size));
    assert.ok(Math.abs(size.top - size.scrollMarginTop) <= 1, JSON.stringify(size));
    let screenshot = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
    writeFileSync(artifactDirectory + `/outlet-evidence-${width}.png`, Buffer.from(screenshot.data, 'base64'));
    await evaluate("document.querySelector('#outlet-results').scrollIntoView({block:'start',behavior:'instant'})");
    await delay(100);
    screenshot = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
    writeFileSync(artifactDirectory + `/outlet-results-${width}.png`, Buffer.from(screenshot.data, 'base64'));
  }
  report.push('outlet: partial-collection import refused atomically; collection controls and results visually received at desktop and 390px');
}

