import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { makeExample } from '../core.js';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? root + '.browser-run-wetting-question-' + randomUUID();
const checks = [];
const sourceHashes = Object.fromEntries(['app.js', 'depth-disagreement.js', 'infiltration-question.js',
  'wetting-front-question.js', 'wetting-front-contract.js', 'wetting-front-study.js', 'wetting-front-panel.js',
  'tests/wetting-front-question.browser.mjs'].map(path => [path,
  createHash('sha256').update(readFileSync(root + path)).digest('hex')]));
const project = makeExample(); project.width = project.height = 2; project.selectedIndex = 3;
project.existing = Array.from({ length: 4 }, () => ({ surface: 'turf', elevationM: 0,
  provenance: 'Authored identifiability control, not a field survey' }));
project.proposal = structuredClone(project.existing);
Object.assign(project.weather, { rainMmHr: 30, stormMinutes: 60, durationMinutes: 60,
  stepMinutes: 5, cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0 });
project.observations = [{ cellIndex: 0, minute: 60, depthMm: 5.404720888434597,
  uncertaintyMm: .05, source: 'Independent Decimal endpoint; authored mathematical control',
  scenario: 'existing', use: 'calibration' }];
project.wettingFrontStudy = { target: 'existing', surface: 'turf',
  basis: 'Equal endpoint does not identify the soil response. ' + 'long-basis-'.repeat(12),
  hypotheses: [{ conductivityMmHr: 10, capillaryDriveMm: 20 },
    { conductivityMmHr: 24.595279111565403, capillaryDriveMm: 0 }],
  question: { scope: 'selected', fromMinute: 0, toMinute: 60, uncertaintyMm: 1 } };

const received = await withBrowserSession({ root, runDirectory,
  chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome' }, async session => {
  const { send, evaluate, baseUrl, exceptions } = session;
  await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  async function until(expression) {
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if (await evaluate(expression)) return; } catch {}
      await delay(50);
    }
    throw Error('Timed out: ' + expression + ' ' + JSON.stringify(await evaluate(
      "({status:document.querySelector('#wetting-front-status')?.textContent,question:document.querySelector('.wf-question')?.textContent,valid:document.querySelector('#wetting-front-form')?.checkValidity()})")));
  }
  async function edit(id, value) {
    await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  }
  async function compare() {
    await evaluate("document.querySelector('#wetting-front-run').click()");
    await until("!document.querySelector('#wetting-front-download').disabled");
  }
  async function screenshot(name, selector) {
    const clip = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:Math.min(2000,r.height),scale:1}})()`);
    const png = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
    writeFileSync(runDirectory + '/' + name + '.png', Buffer.from(png.data, 'base64'));
  }
  await send('Page.navigate', { url: baseUrl }); await until("!!document.querySelector('#wetting-front-run')");
  await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(project))})`);
  await send('Page.reload', { ignoreCache: true }); await until("document.querySelectorAll('#existing-grid .cell').length===4");
  assert.equal(await evaluate("document.querySelector('#wetting-front-question-enabled').checked"), true);
  assert.equal(await evaluate("document.querySelector('#wetting-front-question-fields').disabled"), false);
  const original = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  await evaluate("document.querySelector('#wetting-front-run').focus()");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await until("!!document.querySelector('#wetting-front-results .wf-question[data-state=question]')");
  let text = await evaluate("document.querySelector('#wetting-front-results .wf-question').textContent");
  assert.match(text, /B2, minute 30/); assert.match(text, /2\.1116 mm difference/);
  assert.match(text, /All 1 tested pairs have disjoint/);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), original);
  checks.push('actual keyboard comparison restores saved planning inputs and separates equal-endpoint explanations at an earlier retained time');
  await screenshot('desktop-question', '#wetting-front-results .wf-question');

  await edit('wetting-front-question-uncertainty', '1.1');
  assert.equal(await evaluate("document.querySelector('#wetting-front-results').textContent"), '');
  assert.equal(await evaluate("document.querySelector('#wetting-front-download').disabled"), true);
  await compare();
  text = await evaluate("document.querySelector('#wetting-front-results .wf-question').textContent");
  assert.match(text, /0 of 1 tested pairs have disjoint/); assert.match(text, /Overlapping pairs remain unresolved/);
  checks.push('a broader declared reading band changes the separation conclusion and retires stale results before recomputation');

  await edit('wetting-front-question-from', '40'); await edit('wetting-front-question-to', '50'); await compare();
  assert.match(await evaluate("document.querySelector('#wetting-front-results .wf-question').textContent"), /B2, minute 40/);
  const accepted = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  await edit('wetting-front-question-to', '20'); await evaluate("document.querySelector('#wetting-front-run').click()");
  await until("document.querySelector('#wetting-front-status').textContent.includes('Comparison refused:')");
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), accepted);
  assert.equal(await evaluate("document.querySelector('#wetting-front-download').disabled"), true);
  checks.push('the requested time window changes the actual question and an inverted window is refused without changing accepted source inputs');

  await edit('wetting-front-question-from', '0'); await edit('wetting-front-question-to', '60');
  await edit('wetting-front-question-uncertainty', '1'); await edit('wetting-front-question-scope', 'grid'); await compare();
  assert.match(await evaluate("document.querySelector('#wetting-front-results .wf-question').textContent"), /A1, minute 30/);
  const beforePrepare = JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  await evaluate("document.querySelector('[data-brush=garden]').click();document.querySelector('#obs-depth').value='123';document.querySelector('#obs-source').value='Unrelated draft';document.querySelector('#wetting-front-prepare-reading').click()");
  const prepared = await evaluate(`(()=>{const p=JSON.parse(localStorage.getItem('experimental-earth-site-v1'));return {project:p,
    minute:document.querySelector('#obs-minute').value,scenario:document.querySelector('#obs-scenario').value,
    role:document.querySelector('#obs-use').value,depth:document.querySelector('#obs-depth').value,
    source:document.querySelector('#obs-source').value,uncertainty:document.querySelector('#obs-uncertainty').value,
    active:document.activeElement.id,inspect:document.querySelector('[data-brush=inspect]').getAttribute('aria-pressed')}})()`);
  assert.equal(prepared.project.selectedIndex, 0); assert.equal(prepared.minute, '30');
  assert.equal(prepared.scenario, 'existing'); assert.equal(prepared.role, 'challenge');
  assert.equal(prepared.depth, ''); assert.equal(prepared.source, ''); assert.equal(prepared.uncertainty, '1');
  assert.equal(prepared.active, 'obs-depth'); assert.equal(prepared.inspect, 'true');
  assert.deepEqual(prepared.project.observations, beforePrepare.observations);
  assert.deepEqual(prepared.project.existing, beforePrepare.existing); assert.deepEqual(prepared.project.proposal, beforePrepare.proposal);
  checks.push('explicit preparation selects the question, enters inspect mode and clears unrelated drafts without painting or inventing a reading');

  await evaluate("document.querySelector('#obs-depth').value='0.6';document.querySelector('#obs-source').value='Authored held-aside probe; not a field reading';document.querySelector('#observe-form button[type=submit]').click()");
  const measured = JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  assert.equal(measured.observations.length, 2); assert.deepEqual(measured.observations[0], project.observations[0]);
  assert.equal(measured.observations[1].depthMm, .6); assert.equal(measured.observations[1].use, 'challenge');
  await compare();
  text = await evaluate("document.querySelector('#wetting-front-results').textContent");
  assert.match(text, /One of these finite explanations/); assert.match(text, /B1, minute 30/);
  assert.equal(await evaluate("document.querySelectorAll('#wetting-front-results .wf-question-predictions li').length"), 2);
  checks.push('only explicit notebook submission retains the sourced reading; held-aside rejection does not remove a candidate from subsequent question selection');

  const saved = await evaluate(`(async()=>{const original=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;let blob,clicked=false;
    URL.createObjectURL=function(value){blob=value;return original.call(this,value)};
    HTMLAnchorElement.prototype.click=function(){if(this.download==='experimental-earth-soil-investigation.json')clicked=true;return click.call(this)};
    try{document.querySelector('#wetting-front-download').click();return {clicked,text:await blob.text()};}
    finally{URL.createObjectURL=original;HTMLAnchorElement.prototype.click=click;}})()`);
  assert.equal(saved.clicked, true); const bundle = JSON.parse(saved.text);
  assert.deepEqual(Object.keys(bundle), ['schema', 'project', 'study']);
  assert.deepEqual(Object.keys(bundle.study.question).sort(), ['fromMinute', 'scope', 'toMinute', 'uncertaintyMm']);
  assert.deepEqual(bundle.project.observations, measured.observations);
  const savedPath = runDirectory + '/saved-question-inputs.json'; writeFileSync(savedPath, saved.text);
  await evaluate("document.querySelector('#rain').value='40';document.querySelector('#rain').dispatchEvent(new Event('change',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#wetting-front-results').textContent"), '');
  assert.equal(await evaluate("document.querySelector('#wetting-front-download').disabled"), true);
  const changedSource = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  async function reopen() {
    await evaluate("document.querySelector('#wetting-front-import').closest('details').open=true");
    const document = await send('DOM.getDocument');
    const { nodeId } = await send('DOM.querySelector', { nodeId: document.root.nodeId, selector: '#wetting-front-import' });
    await send('DOM.setFileInputFiles', { nodeId, files: [savedPath] });
    await until("!!document.querySelector('#wetting-front-replay .wf-question[data-state=question]')");
  }
  await reopen();
  assert.match(await evaluate("document.querySelector('#wetting-front-replay .wf-question').textContent"), /B1, minute 30/);
  assert.equal(await evaluate("document.querySelector('#wetting-front-replay #wetting-front-prepare-reading')===null"), true);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), changedSource);
  checks.push('actual download and native file reopening preserve planning inputs and original readings, recompute the original question and leave the working event unchanged');

  await evaluate("document.querySelector('#wetting-front-run').click();const e=document.querySelector('#wetting-front-question-uncertainty');e.value='2';e.dispatchEvent(new Event('input',{bubbles:true}))");
  await delay(100);
  assert.equal(await evaluate("document.querySelector('#wetting-front-results').textContent"), '');
  assert.equal(await evaluate("document.querySelector('#wetting-front-replay').textContent"), '');
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), changedSource);
  checks.push('a changed planning draft cancels an in-flight comparison and retires the reopened question without publishing stale conclusions');

  await reopen();
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(80);
  const layout = await evaluate(`(()=>{const panel=document.querySelector('#wetting-front-study'),r=panel.getBoundingClientRect();return {
    viewport:innerWidth,page:document.documentElement.scrollWidth,panel:r.width,
    badControls:[...panel.querySelectorAll('input,select,textarea,button')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.left<r.left-1||b.right>r.right+1)}).length}})()`);
  assert.ok(layout.page <= layout.viewport + 1, JSON.stringify(layout)); assert.equal(layout.badControls, 0);
  await screenshot('mobile-controls', '#wetting-front-form');
  await screenshot('mobile-question', '#wetting-front-replay .wf-question');
  assert.deepEqual(exceptions, []);
  checks.push('390px controls and all predicted reading bands fit their panel; no browser exceptions and same-browser sandbox admission retained');
  const receipt = { passed: true, checks, sourceHashes, layout, exceptions, runDirectory,
    browser: session.sandbox.browser.product, sandboxAdmitted: session.sandbox.admitted };
  writeFileSync(runDirectory + '/browser-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
});
assert.equal(received.value.passed, true);
console.log(JSON.stringify({ passed: true, checks: checks.length, runDirectory, browser: received.value.browser }));
