import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { makeExample } from '../core.js';
import { receiveObservationTable } from './observation-table.receiving.mjs';

// Reuses the maintained browser receiver's real Chrome/CDP and HTTP lifecycle.
export async function receiveInfiltration({ evaluate, send, delay, report, artifactDirectory = fileURLToPath(new URL('../', import.meta.url)) }) {
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
  assert.equal(await evaluate("document.querySelector('#study-results .study-candidate').dataset.rate"), '10');
  assert.equal(await evaluate("document.querySelectorAll('#study-results .study-candidate').length"), 3);
  assert.ok(!(await evaluate("document.querySelector('#study-results .study-candidate').textContent")).includes('0.000000000000'));
  assert.ok((await evaluate("document.querySelector('#study-results').textContent")).includes('1 calibration · 1 held aside'));
  assert.ok((await evaluate("document.querySelector('#study-results .study-candidate details').textContent")).includes('analytic held-aside fixture'));
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
  assert.equal(await evaluate("document.querySelector('#study-results .study-candidate').dataset.rate"), '10');
  assert.ok((await evaluate("document.querySelector('#study-status').textContent")).includes('no replacement rate has been adopted'));
  report.push('contradictory held-aside import rejects predictions without changing calibration order');

  await evaluate("document.querySelector('#study-rates').value='0,,10';document.querySelector('#study-rates').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await state(), 'not-compared');
  await run();
  assert.ok((await evaluate("document.querySelector('#toast').textContent")).includes('distinct'));
  assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).infiltrationStudy.ratesMmHr, [0, 10, 20]);
  await evaluate("document.querySelector('#study-rates').value='0, 10, 20'"); await run();
  report.push('invalid candidate edit is refused without corrupting saved study');

  const broad = JSON.parse(saved); broad.observations[0].uncertaintyMm = 5;
  await importProject(JSON.stringify(broad)); await run();
  await evaluate("document.querySelector('[data-brush=garden]').click();document.querySelector('#find-infiltration-reading').click()");
  const questionText = await evaluate("document.querySelector('#infiltration-question').textContent");
  assert.ok(questionText.includes('A1, 60 min'), questionText);
  assert.ok(questionText.includes('20 mm difference'), questionText);
  assert.ok(questionText.includes('Held-aside values do not choose this question'), questionText);
  assert.equal(await evaluate("document.querySelector('#prepare-infiltration-reading').hidden"), false);
  const beforeQuestion = JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  await evaluate("document.querySelector('#prepare-infiltration-reading').click()");
  assert.equal(await evaluate("document.querySelector('#obs-minute').value"), '60');
  assert.equal(await evaluate("document.querySelector('#obs-scenario').value"), 'existing');
  assert.equal(await evaluate("document.querySelector('#obs-use').value"), 'challenge');
  assert.equal(await evaluate("document.querySelector('[data-brush=inspect]').getAttribute('aria-pressed')"), 'true');
  const afterQuestion = JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  assert.deepEqual(afterQuestion.observations, beforeQuestion.observations);
  assert.deepEqual(afterQuestion.existing, beforeQuestion.existing);
  assert.deepEqual(afterQuestion.proposal, beforeQuestion.proposal);
  report.push('calibration-candidate question prepares location/time/role without painting or inventing observations');

  await evaluate("document.querySelector('#obs-depth').value='20.001';document.querySelector('#obs-uncertainty').value='0.01';document.querySelector('#obs-source').value='new author-supplied analytic reading';document.querySelector('#observe-form').requestSubmit()");
  const submitted = JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  assert.equal(submitted.observations.length, 3);
  assert.equal(submitted.observations[2].scenario, 'existing');
  assert.equal(submitted.observations[2].use, 'challenge');
  assert.equal(submitted.observations[2].depthMm, 20.001);
  assert.equal(submitted.observations[2].uncertaintyMm, 0.01);
  report.push('new sourced reading is retained only after explicit form submit, preserving fractional values');

  const dry = structuredClone(broad); dry.weather.rainMmHr = 0;
  dry.observations.forEach(o => { o.depthMm = 0; o.uncertaintyMm = 0; });
  await importProject(JSON.stringify(dry)); await run();
  await evaluate("document.querySelector('#find-infiltration-reading').click()");
  assert.ok((await evaluate("document.querySelector('#infiltration-question').textContent")).includes('predict the same depths'));
  assert.equal(await evaluate("document.querySelector('#prepare-infiltration-reading').hidden"), true);
  report.push('dry indistinguishable event refuses to manufacture a useful measurement');
  await importProject(JSON.stringify(broad)); await run();
  await evaluate("document.querySelector('#find-infiltration-reading').click()");

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(100);
  const dims = await evaluate("({inner:innerWidth,scroll:document.documentElement.scrollWidth})");
  assert.ok(dims.scroll <= dims.inner + 1, JSON.stringify(dims));
  await evaluate("document.querySelector('.study').scrollIntoView({behavior:'instant',block:'start'})");
  await delay(120);
  const mobile = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(artifactDirectory, 'study-mobile-390.png'), Buffer.from(mobile.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await delay(100); await evaluate("document.querySelector('.study').scrollIntoView({behavior:'instant',block:'start'})");
  await delay(120);
  const desktop = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(artifactDirectory, 'study-desktop.png'), Buffer.from(desktop.data, 'base64'));
  report.push('candidate and evidence controls fit 390px mobile; mobile/desktop images captured');
  await receiveObservationTable({ evaluate, send, delay, report, artifactDirectory });
  await importProject(original);
}
