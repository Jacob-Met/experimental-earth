import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeExample } from '../core.js';

// Reuses the maintained browser receiver's real Chrome/CDP and HTTP lifecycle.
export async function receiveInfiltration({ evaluate, send, delay, report }) {
  const original = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  const p = makeExample(); p.width = 2; p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({ length: 4 }, () => ({ elevationM: 0, surface: 'turf', provenance: 'authored analytic fixture' }));
  p.proposal = structuredClone(p.existing);
  p.weather = { ...p.weather, rainMmHr: 30, stormMinutes: 60, durationMinutes: 60, mobilityPerHour: 0, boundaryExitPerHour: 0 };
  // Intentionally legacy entries: their roles must be explicitly assigned in UI.
  p.observations = [
    { cellIndex: 0, minute: 30, depthMm: 10, uncertaintyMm: 0.01, source: 'analytic calibration fixture' },
    { cellIndex: 1, minute: 60, depthMm: 20, uncertaintyMm: 0.01, source: 'analytic held-aside fixture' },
  ];
  async function importProject(data) {
    await evaluate(`(async()=>{const input=document.querySelector('#import');const file=new File([${JSON.stringify(data)}],'study.json',{type:'application/json'});const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,120));})()`);
  }
  async function assign(index, field, value) {
    await evaluate(`(()=>{const select=document.querySelectorAll('.observation')[${index}].querySelector('[data-evidence-field="${field}"]');select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  }
  const state = () => evaluate("document.querySelector('#study-status').dataset.state");
  const run = () => evaluate("document.querySelector('#infiltration-form').requestSubmit()");
  await importProject(JSON.stringify(p));
  assert.equal(await evaluate("document.querySelectorAll('.observation').length"), 2);
  assert.ok((await evaluate("document.querySelector('.observation strong').textContent")).includes('± 0.01'));
  assert.equal(await evaluate("document.querySelectorAll('[data-evidence-field=use]:disabled').length"), 2);
  await evaluate("document.querySelector('#study-rates').value='0, 10, 20'");
  await run(); assert.equal(await state(), 'need-calibration');
  report.push('legacy readings excluded until explicit scenario/evidence assignment');

  // The notebook shows newest first: row 0 is the t=60 challenge.
  await assign(0, 'scenario', 'existing'); await assign(0, 'use', 'challenge');
  await assign(1, 'scenario', 'existing'); await assign(1, 'use', 'calibration');
  await run(); assert.equal(await state(), 'one-survivor');
  assert.equal(await evaluate("document.querySelector('.study-candidate').dataset.rate"), '10');
  assert.equal(await evaluate("document.querySelectorAll('.study-candidate').length"), 3);
  assert.ok((await evaluate("document.querySelector('#study-results').textContent")).includes('1 calibration · 1 held aside'));
  assert.ok((await evaluate("document.querySelector('.study-candidate details').textContent")).includes('analytic held-aside fixture'));
  const saved = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  assert.deepEqual(JSON.parse(saved).infiltrationStudy.ratesMmHr, [0, 10, 20]);
  assert.equal(JSON.parse(saved).observations[1].use, 'challenge');
  report.push('actual notebook assignment, analytic candidate comparison and inspectable source residuals');

  await send('Page.reload', { ignoreCache: true }); await delay(350);
  assert.equal(await state(), 'not-compared');
  await run(); assert.equal(await state(), 'one-survivor');
  assert.equal(await evaluate("document.querySelectorAll('[data-evidence-field=use]')[0].value"), 'challenge');
  report.push('candidate choices and roles survive reload; stale reports are cleared');

  const contradictory = JSON.parse(saved); contradictory.observations[1].depthMm = 0;
  await importProject(JSON.stringify(contradictory)); await run();
  assert.equal(await state(), 'challenged');
  assert.equal(await evaluate("document.querySelector('.study-candidate').dataset.rate"), '10');
  assert.ok((await evaluate("document.querySelector('#study-status').textContent")).includes('no replacement rate has been adopted'));
  report.push('contradictory held-aside import rejects predictions without changing calibration order');

  await evaluate("document.querySelector('#study-rates').value='0,,10';document.querySelector('#study-rates').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await state(), 'not-compared');
  await run();
  assert.ok((await evaluate("document.querySelector('#toast').textContent")).includes('distinct'));
  assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).infiltrationStudy.ratesMmHr, [0, 10, 20]);
  await evaluate("document.querySelector('#study-rates').value='0, 10, 20'"); await run();
  report.push('invalid candidate edit is refused without corrupting saved study');

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(100);
  const dims = await evaluate("({inner:innerWidth,scroll:document.documentElement.scrollWidth})");
  assert.ok(dims.scroll <= dims.inner + 1, JSON.stringify(dims));
  await evaluate("document.querySelector('.study').scrollIntoView({behavior:'instant',block:'start'})");
  await delay(120);
  const mobile = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(fileURLToPath(new URL('../study-mobile-390.png', import.meta.url)), Buffer.from(mobile.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await delay(100); await evaluate("document.querySelector('.study').scrollIntoView({behavior:'instant',block:'start'})");
  await delay(120);
  const desktop = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(fileURLToPath(new URL('../study-desktop.png', import.meta.url)), Buffer.from(desktop.data, 'base64'));
  report.push('candidate and evidence controls fit 390px mobile; mobile/desktop images captured');
  await importProject(original);
}
