import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { makeExample } from '../core.js';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? root + '.browser-run-wetting-front-' + randomUUID();
const chromeBin = process.env.CHROME_BIN ?? '/opt/google/chrome/chrome';
function fixture() {
  const p = makeExample(); p.width = p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({ length: 4 }, () => ({ elevationM: 0, surface: 'turf', provenance: 'Authored analytic control' }));
  p.proposal = structuredClone(p.existing); p.proposal[0].surface = 'garden';
  Object.assign(p.weather, { rainMmHr: 30, stormMinutes: 60, durationMinutes: 60,
    stepMinutes: 5, cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0 });
  p.wettingFrontStudy = { target: 'existing', surface: 'turf',
    basis: 'Authored mechanism comparison; not field data. ' + 'long-source-'.repeat(14),
    hypotheses: [{ conductivityMmHr: 10, capillaryDriveMm: 0 },
      { conductivityMmHr: 10, capillaryDriveMm: 20 }, { conductivityMmHr: 10, capillaryDriveMm: 60 }] };
  p.observations = [
    { cellIndex: 0, minute: 20, depthMm: 0, uncertaintyMm: 1e-8,
      scenario: 'existing', use: 'calibration', source: '<img src=x onerror="window.__soilInjected=1"> Authored analytic onset' },
    { cellIndex: 0, minute: 60, depthMm: 5.40472088843459735, uncertaintyMm: 1e-8,
      scenario: 'existing', use: 'challenge', source: 'Independent 90-digit Decimal authored endpoint' },
    { cellIndex: 1, minute: 15, depthMm: 12, uncertaintyMm: 1,
      scenario: 'unassigned', use: 'unassigned', source: 'Retained unused authored reading' },
  ];
  return p;
}
const checks = [];
const sourceHashes = Object.fromEntries(['app.js', 'core.js', 'infiltration-study.js', 'wetting-front.js',
  'wetting-front-contract.js', 'wetting-front-study.js', 'wetting-front-panel.js', 'tests/wetting-front.browser.mjs']
  .map(path => [path, createHash('sha256').update(readFileSync(root + path)).digest('hex')]));
const received = await withBrowserSession({ root, chromeBin, runDirectory }, async session => {
  const { send, evaluate, baseUrl, exceptions } = session;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  async function until(expression) {
    for (let i = 0; i < 100; i++) {
      try { if (await evaluate(expression)) return; } catch {}
      await delay(50);
    }
    throw new Error('Timed out: ' + expression + ' ' + JSON.stringify(await evaluate("({status:document.querySelector('#wetting-front-status')?.textContent,active:document.activeElement?.id,valid:document.querySelector('#wetting-front-form')?.checkValidity(),exceptions:window.__soilInjected??null})")));
  }
  await send('Page.navigate', { url: baseUrl });
  await until("!!document.querySelector('#wetting-front-run')");
  const project = fixture();
  await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(project))})`);
  await send('Page.reload', { ignoreCache: true });
  await until("document.querySelectorAll('#existing-grid .cell').length===4");
  assert.equal(await evaluate("document.querySelectorAll('#wetting-front-hypotheses .wf-hypothesis').length"), 3);
  assert.equal(await evaluate("document.querySelector('#wetting-front-basis').value"), project.wettingFrontStudy.basis);
  checks.push('persisted source project restores explicit soil choices and original evidence');
  const original = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  await evaluate("document.querySelector('#wetting-front-run').focus()");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await until("!document.querySelector('#wetting-front-download').disabled");
  const live = await evaluate(`(()=>{const p=document.querySelector('#wetting-front-results');return {
    text:p.textContent, choices:p.querySelectorAll('[data-hypothesis]').length,
    polylines:p.querySelectorAll('polyline').length, images:p.querySelectorAll('img').length,
    injected:window.__soilInjected??null};})()`);
  assert.match(live.text, /One of these finite explanations/);
  assert.match(live.text, /1 calibration · 1 held aside · 1 unused/);
  assert.equal(live.choices, 3); assert.equal(live.polylines, 2);
  assert.equal(live.images, 0); assert.equal(live.injected, null);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), original);
  checks.push('keyboard comparison reaches real soil mechanism, retains all candidates and keeps source data unchanged');

  await evaluate("document.querySelector('#wetting-front-results [data-hypothesis=\"2\"]').click();document.querySelectorAll('#wetting-front-results details').forEach(d=>d.open=true)");
  assert.match(await evaluate("document.querySelector('#wetting-front-results').textContent"), /5\.4047/);
  assert.match(await evaluate("document.querySelector('#wetting-front-results').textContent"), /Source: <img src=x/);
  assert.equal(await evaluate("document.querySelector('#wetting-front-results [data-hypothesis=\"2\"]').getAttribute('aria-pressed')"), 'true');
  checks.push('candidate selection exposes original roles, literal source words, analytical curve and exact solver times');

  async function screenshot(name, selector = '#wetting-front-study') {
    const clip = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:Math.min(2000,r.height),scale:1}})()`);
    const png = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
    writeFileSync(runDirectory + '/' + name + '.png', Buffer.from(png.data, 'base64'));
  }
  await screenshot('desktop');
  await screenshot('desktop-curve', '#wetting-front-results .wf-detail');
  const download = await evaluate(`(async()=>{
    const prior=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;let blob,clicked=false;
    URL.createObjectURL=function(value){blob=value;return prior.call(this,value)};
    HTMLAnchorElement.prototype.click=function(){if(this.download==='experimental-earth-soil-investigation.json')clicked=true;return click.call(this)};
    try{document.querySelector('#wetting-front-download').click();window.__soilBundle=await blob.text();
      const b=JSON.parse(window.__soilBundle);return {clicked,keys:Object.keys(b),observations:b.project.observations,study:b.study};}
    finally{URL.createObjectURL=prior;HTMLAnchorElement.prototype.click=click;}
  })()`);
  assert.equal(download.clicked, true); assert.deepEqual(download.keys, ['schema', 'project', 'study']);
  assert.deepEqual(download.observations, project.observations); assert.deepEqual(download.study, project.wettingFrontStudy);
  checks.push('actual save download contains only complete source inputs, all readings and declared parameters');

  await evaluate("document.querySelector('#reset').click()");
  assert.equal(await evaluate("document.querySelector('#wetting-front-download').disabled"), true);
  assert.equal(await evaluate("document.querySelector('#wetting-front-results').textContent"), '');
  const reset = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  checks.push('changed working site retires prior comparison and disables stale export');
  async function importBundle(expression = 'window.__soilBundle') {
    await evaluate(`(()=>{const input=document.querySelector('#wetting-front-import'),transfer=new DataTransfer();transfer.items.add(new File([${expression}],'soil.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  }
  await importBundle(); await until("document.querySelector('#wetting-front-replay').textContent.includes('Recomputed from saved inputs')");
  assert.match(await evaluate("document.querySelector('#wetting-front-replay').textContent"), /One of these finite explanations/);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), reset);
  assert.equal(await evaluate("document.querySelector('#wetting-front-replay img')!==null"), false);
  checks.push('real file reopening recomputes original investigation without adopting its site or parsing source as HTML');

  await importBundle("JSON.stringify({...JSON.parse(window.__soilBundle),results:{winner:1}})");
  await until("document.querySelector('#wetting-front-replay').textContent.includes('Investigation refused:')");
  assert.match(await evaluate("document.querySelector('#wetting-front-replay').textContent"), /saved conclusions/);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), reset);
  checks.push('forged saved conclusions are refused with accepted project preserved');

  const stale = await evaluate(`(async()=>{const originalText=File.prototype.text;let finish;
    File.prototype.text=function(){return new Promise(resolve=>{finish=()=>resolve(window.__soilBundle)})};
    try{const input=document.querySelector('#wetting-front-import'),d=new DataTransfer();d.items.add(new File(['{}'],'delayed.json'));input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}));
      if(!finish)throw Error('File read did not start');const basis=document.querySelector('#wetting-front-basis');basis.value='New draft while reading';basis.dispatchEvent(new Event('input',{bubbles:true}));
      finish();await new Promise(resolve=>setTimeout(resolve,90));return {replay:document.querySelector('#wetting-front-replay').textContent,download:document.querySelector('#wetting-front-download').disabled};
    }finally{File.prototype.text=originalText;}})()`);
  assert.deepEqual(stale, { replay: '', download: true });
  checks.push('a delayed file cannot publish after newer user choices');

  await evaluate(`(()=>{const rows=[...document.querySelectorAll('#wetting-front-hypotheses .wf-hypothesis')];
    rows.forEach(row=>{row.querySelector('[data-parameter=conductivityMmHr]').value=9;row.querySelector('[data-parameter=capillaryDriveMm]').value=30;});document.querySelector('#wetting-front-run').click();})()`);
  await until("document.querySelector('#wetting-front-status').textContent.includes('distinct')");
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), reset);
  assert.equal(await evaluate("document.querySelector('#wetting-front-download').disabled"), true);
  checks.push('duplicate declarations are refused transactionally without changing saved inputs');

  await importBundle(); await until("document.querySelector('#wetting-front-replay').textContent.includes('Recomputed from saved inputs')");
  await evaluate("document.querySelector('#wetting-front-import').closest('details').open=true;document.querySelectorAll('#wetting-front-replay details').forEach(d=>d.open=true)");
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(80);
  const layout = await evaluate(`(()=>{const p=document.querySelector('#wetting-front-study'),r=p.getBoundingClientRect();return {
    viewport:innerWidth,page:document.documentElement.scrollWidth,panel:r.width,
    badControls:[...p.querySelectorAll('input,select,textarea,button')].filter(e=>{const b=e.getBoundingClientRect();return b.width&& (b.left<r.left-1||b.right>r.right+1)}).length};})()`);
  assert.ok(layout.page <= layout.viewport + 1, JSON.stringify(layout)); assert.equal(layout.badControls, 0);
  await screenshot('mobile');
  await screenshot('mobile-curve', '#wetting-front-replay .wf-detail');
  checks.push('390px expanded investigation keeps long sources, controls and exact-time disclosure within its panel');
  assert.deepEqual(exceptions, []);
  checks.push('no browser exceptions; same-browser Linux sandbox admission retained');
  const receipt = { passed: true, checks, sourceHashes, layout, browser: session.sandbox.browser.product,
    sandboxAdmitted: session.sandbox.admitted, exceptions, runDirectory };
  writeFileSync(runDirectory + '/browser-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
  writeFileSync(runDirectory + '/authored-project.json', JSON.stringify(project, null, 2) + '\n');
  return receipt;
});
const result = received.value;
assert.equal(result.passed, true);
console.log(JSON.stringify({ passed: result.passed, checks: checks.length, runDirectory, browser: result.browser }));
