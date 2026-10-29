import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { makeExample } from '../core.js';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? root + '.browser-pressure-' + randomUUID();
const chromeBin = process.env.CHROME_BIN ?? '/opt/google/chrome/chrome';
const project = makeExample(); project.width = project.height = 2; project.selectedIndex = 0;
project.title = 'Authored pressure-head receiving';
project.existing = Array.from({ length: 4 }, () => ({ elevationM: 0, surface: 'turf', provenance: 'Authored closed-cell control' }));
project.proposal = structuredClone(project.existing); project.proposal[0].surface = 'garden';
Object.assign(project.weather, { rainMmHr: 60, stormMinutes: 60, durationMinutes: 60,
  stepMinutes: 5, cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0 });
project.observations = [
  { cellIndex: 0, minute: 5, depthMm: 0, uncertaintyMm: 100, scenario: 'existing', use: 'calibration',
    source: '<img src=x onerror="window.__headInjected=1"> Authored wide calibration band' },
  { cellIndex: 0, minute: 60, depthMm: 30, uncertaintyMm: 100, scenario: 'existing', use: 'challenge',
    source: 'Authored held-aside wide band; not a field measurement' },
];
const checks = [], sourceHashes = Object.fromEntries(['app.js', 'core.js', 'pressure-head.js',
  'pressure-head-contract.js', 'pressure-head-study.js', 'pressure-head-panel.js', 'wetting-front-panel.js',
  'tests/pressure-head.browser.mjs'].map(path => [path, createHash('sha256').update(readFileSync(root + path)).digest('hex')]));
const received = await withBrowserSession({ root, chromeBin, runDirectory }, async session => {
  const { send, evaluate, baseUrl, exceptions } = session;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: runDirectory, eventsEnabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  async function until(expression) {
    for (let i = 0; i < 120; i++) {
      try { if (await evaluate(expression)) return; } catch {}
      await delay(50);
    }
    throw Error('Timed out: ' + expression + ' ' + JSON.stringify(await evaluate("({status:document.querySelector('#pressure-head-status')?.textContent,replay:document.querySelector('#pressure-head-replay-status')?.textContent})")));
  }
  async function importText(id, text, filename = 'input.json') {
    await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)}),d=new DataTransfer();d.items.add(new File([${JSON.stringify(text)}],${JSON.stringify(filename)},{type:'application/json'}));e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  }
  await send('Page.navigate', { url: baseUrl });
  await until("!!document.querySelector('#pressure-head-run')");
  await until("!!document.querySelector('#investigation-search')");
  await evaluate("(()=>{const input=document.querySelector('#investigation-search');input.value='standing water';input.dispatchEvent(new Event('input',{bubbles:true}))})()");
  await until("!!document.querySelector('#investigation-results a[data-investigation-id=\"pressure-head-study\"]')");
  await evaluate("document.querySelector('#investigation-results a[data-investigation-id=\"pressure-head-study\"]').click()");
  await until("document.activeElement?.id==='pressure-head-heading' && location.hash==='#pressure-head-study'");
  checks.push('maintained investigation search finds standing water and navigation focuses the new panel heading');
  const portable = await evaluate(`(async()=>{const {serializePortableProject}=await import('./project-portability.js');return serializePortableProject(${JSON.stringify(project)})})()`);
  await importText('import', portable, 'authored-site.json');
  await until("document.querySelectorAll('#existing-grid .cell').length===4");
  const original = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  assert.equal(await evaluate("document.querySelectorAll('#pressure-head-hypotheses [data-parameter=moistureDeficit]').length"), 2);
  assert.equal(await evaluate("[...document.querySelectorAll('#pressure-head-hypotheses [data-parameter=moistureDeficit]')].every(e=>e.value==='')"), true);
  await evaluate("document.querySelector('#pressure-head-run').click()");
  assert.equal(await evaluate("document.querySelector('#pressure-head-form').checkValidity()"), false);
  assert.equal(await evaluate("document.querySelector('#pressure-head-download').disabled"), true);
  checks.push('actual portable source import; blank deficit and basis cannot silently become zero/default assumptions');

  const basis = 'Authored head-control comparison <script>window.__headInjected=2</script>; deficit declared independently of A.';
  await evaluate(`(()=>{const $=s=>document.querySelector(s);$('#pressure-head-surface').value='turf';$('#pressure-head-basis').value=${JSON.stringify(basis)};
    [...document.querySelectorAll('#pressure-head-hypotheses .ph-row')].forEach((row,i)=>{row.querySelector('[data-parameter=conductivityMmHr]').value='10';row.querySelector('[data-parameter=capillaryDriveMm]').value='20';row.querySelector('[data-parameter=moistureDeficit]').value=String(i*.3)});
    $('#pressure-head-basis').dispatchEvent(new Event('input',{bubbles:true}));$('#pressure-head-run').click();})()`);
  await until("!document.querySelector('#pressure-head-download').disabled");
  const live = await evaluate(`(()=>{const e=document.querySelector('#pressure-head-results');return {text:e.textContent,choices:e.querySelectorAll('[data-hypothesis]').length,curves:e.querySelectorAll('polyline').length,injected:window.__headInjected??null,images:e.querySelectorAll('img').length}})()`);
  assert.equal(live.choices, 2); assert.equal(live.curves, 2); assert.equal(live.injected, null); assert.equal(live.images, 0);
  assert.match(live.text, /Head-neglected mathematical control/); assert.match(live.text, /Standing-water pressure included/);
  assert.match(live.text, /Current fixed-rate reference/); assert.match(live.text, /4 existing and 3 proposed turf cells/);
  assert.match(live.text, /1 calibration · 1 held aside/); assert.match(live.text, /Source: <img src=x/);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), original);
  checks.push('real kernel comparison retains both explicit hydraulic choices, held-aside scores and literal original sources without project adoption');

  await evaluate("document.querySelector('#pressure-head-results [data-hypothesis=\"2\"]').click()");
  assert.equal(await evaluate("document.querySelector('#pressure-head-results [data-hypothesis=\"2\"]').getAttribute('aria-pressed')"), 'true');
  await evaluate("document.querySelector('#pressure-head-download').click()");
  const downloadPath = runDirectory + '/experimental-earth-pressure-head.json';
  for (let i=0; i<120 && !existsSync(downloadPath); i++) await delay(50);
  assert.ok(existsSync(downloadPath), 'Actual browser download must exist');
  const savedText=readFileSync(downloadPath,'utf8'), saved=JSON.parse(savedText);
  assert.deepEqual(Object.keys(saved), ['schema','project','study']);
  assert.deepEqual(saved.project.observations, project.observations); assert.equal(saved.study.basis,basis);
  assert.deepEqual(saved.study.hypotheses.map(h=>h.moistureDeficit), [0,.3]);
  checks.push('actual downloaded file retains full original inputs and explicit deficit/basis only');

  await evaluate("document.querySelector('#pressure-head-basis').value+=' changed';document.querySelector('#pressure-head-basis').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#pressure-head-download').disabled"),true);
  assert.equal(await evaluate("document.querySelector('#pressure-head-results').textContent"),'');
  await evaluate("document.querySelector('#pressure-head-run').click();document.querySelector('#rain').value='61';document.querySelector('#rain').dispatchEvent(new Event('change',{bubbles:true}))");
  await delay(100);
  assert.equal(await evaluate("document.querySelector('#pressure-head-download').disabled"),true);
  assert.equal(await evaluate("document.querySelector('#pressure-head-run').disabled"),false);
  checks.push('changed draft and project retire live results/export, including a queued comparison');

  // Fresh page context; reconstruct only from the actual downloaded bytes.
  await evaluate('window.__pressureOldDocument=true');
  await send('Page.navigate', {url:baseUrl+'?pressure-reopen='+Date.now()});
  await until("!window.__pressureOldDocument && !!document.querySelector('#pressure-head-run') && document.readyState==='complete'");
  const working=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  await importText('pressure-head-import',savedText);
  await until("!document.querySelector('#pressure-head-replay-download').disabled");
  const replayText=await evaluate("document.querySelector('#pressure-head-replay').textContent");
  assert.match(replayText,/Recomputed from saved inputs/); assert.match(replayText,/deficit 0.3/);
  assert.match(await evaluate("document.querySelector('#pressure-head-replay .ph-source-context').textContent"), /Authored pressure-head receiving · 2 × 2 cells\. Rain 60 mm\/h · storm 60 min · run 60 min/);
  assert.equal(await evaluate("document.querySelector('#rain').value"),'61');
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),working);
  await importText('pressure-head-import',JSON.stringify({...saved,results:{winner:2}}));
  await until("document.querySelector('#pressure-head-replay-status').textContent.includes('Reopen refused')");
  assert.equal(await evaluate("document.querySelector('#pressure-head-replay').textContent"),replayText);
  assert.equal(await evaluate("document.querySelector('#pressure-head-replay-download').disabled"),false);
  checks.push('fresh reopen recomputes saved inputs independently; forged conclusions refuse atomically and preserve prior replay');

  const race=await evaluate(`(async()=>{const original=File.prototype.text;let rejectOld;
    const assign=(name,text)=>{const e=document.querySelector('#pressure-head-import'),d=new DataTransfer();d.items.add(new File([text],name));e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));};
    File.prototype.text=function(){if(this.name==='slow-bad.json')return new Promise((_,reject)=>{rejectOld=reject});return original.call(this)};
    try{assign('slow-bad.json','{');if(!rejectOld)throw Error('Delayed read not started');assign('new-valid.json',${JSON.stringify(savedText)});
      for(let i=0;i<100&&document.querySelector('#pressure-head-replay-download').disabled;i++)await new Promise(r=>setTimeout(r,10));
      const before=document.querySelector('#pressure-head-replay').textContent,status=document.querySelector('#pressure-head-replay-status').textContent;
      rejectOld(Error('old delayed read failed'));await new Promise(r=>setTimeout(r,40));return {same:before===document.querySelector('#pressure-head-replay').textContent,statusSame:status===document.querySelector('#pressure-head-replay-status').textContent,enabled:!document.querySelector('#pressure-head-replay-download').disabled};
    }finally{File.prototype.text=original}})()`);
  assert.deepEqual(race,{same:true,statusSame:true,enabled:true});
  await evaluate("document.querySelector('#pressure-head-basis').value='New live draft';document.querySelector('#pressure-head-basis').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#pressure-head-replay').textContent"),replayText);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),working);
  checks.push('old failed asynchronous import cannot erase a newer accepted replay; live drafts remain independent');

  const layouts=[];
  await evaluate("document.querySelector('#pressure-head-import').closest('details').open=true");
  for(const [width,height,name] of [[1440,1000,'desktop'],[390,844,'mobile']]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});
    await evaluate("document.querySelector('#pressure-head-replay').scrollIntoView({block:'start',behavior:'instant'});window.scrollBy({top:-16,left:0,behavior:'instant'})");await delay(80);
    const layout=await evaluate(`(()=>{const p=document.querySelector('#pressure-head-study'),r=p.getBoundingClientRect(),h=document.querySelector('#pressure-head-replay h3').getBoundingClientRect();return {width:innerWidth,height:innerHeight,page:document.documentElement.scrollWidth,panel:r.width,headingTop:h.top,headingBottom:h.bottom,headingVisible:h.top>=0&&h.bottom<=innerHeight,badControls:[...p.querySelectorAll('input,select,textarea,button')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.left<r.left-1||b.right>r.right+1)}).length}})()`);
    const png=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    writeFileSync(runDirectory+'/'+name+'.png',Buffer.from(png.data,'base64'));layouts.push(layout);
    writeFileSync(runDirectory+'/layout-progress.json',JSON.stringify(layouts,null,2));
    assert.ok(layout.page<=layout.width+1,JSON.stringify(layout));assert.equal(layout.badControls,0);assert.equal(layout.headingVisible,true,JSON.stringify(layout));
  }
  await evaluate("document.querySelector('#pressure-head-replay .ph-detail').scrollIntoView({block:'start',behavior:'instant'});window.scrollBy({top:-16,left:0,behavior:'instant'})");
  await delay(80);
  const curveLayout = await evaluate(`(()=>{const e=document.querySelector('#pressure-head-replay .ph-detail'),svg=e.querySelector('svg'),r=svg.getBoundingClientRect(),labels=[...svg.querySelectorAll('text')].map(t=>{const b=t.getBoundingClientRect();return {text:t.textContent,fontPx:parseFloat(getComputedStyle(t).fontSize)*r.width/svg.viewBox.baseVal.width,inside:b.left>=r.left&&b.right<=r.right&&b.top>=r.top&&b.bottom<=r.bottom}});return {width:innerWidth,height:innerHeight,curves:e.querySelectorAll('polyline').length,visible:r.top>=0&&r.bottom<=innerHeight,labels}})()`);
  assert.equal(curveLayout.width,390); assert.equal(curveLayout.curves,2); assert.equal(curveLayout.visible,true);
  assert.ok(curveLayout.labels.every(t=>t.fontPx>=10&&t.inside),JSON.stringify(curveLayout));
  let capture=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  writeFileSync(runDirectory+'/mobile-curve.png',Buffer.from(capture.data,'base64'));
  await evaluate("(()=>{const e=document.querySelector('#pressure-head-replay .ph-detail details:last-child');e.open=true;e.scrollIntoView({block:'start',behavior:'instant'});window.scrollBy({top:-16,left:0,behavior:'instant'})})()");
  await delay(80);
  const evidenceLayout=await evaluate(`(()=>{const e=document.querySelector('#pressure-head-replay .ph-detail details:last-child'),r=e.getBoundingClientRect();return {width:innerWidth,headingVisible:r.top>=0&&r.top<innerHeight,text:e.textContent,images:e.querySelectorAll('img').length}})()`);
  assert.equal(evidenceLayout.headingVisible,true); assert.match(evidenceLayout.text,/Source: <img src=x/); assert.equal(evidenceLayout.images,0);
  capture=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  writeFileSync(runDirectory+'/mobile-evidence.png',Buffer.from(capture.data,'base64'));
  assert.deepEqual(exceptions,[]);
  checks.push('desktop and390px actual result viewports retain readable result choices, bounded controls and sandbox admission without browser exceptions');
  const receipt={passed:true,checks,sourceHashes,layouts,curveLayout,evidenceLayout,browser:session.sandbox.browser.product,sandboxAdmitted:session.sandbox.admitted,exceptions,downloadPath,runDirectory};
  writeFileSync(runDirectory+'/browser-receipt.json',JSON.stringify(receipt,null,2)+'\n');
  return receipt;
});
assert.equal(received.value.passed,true);
console.log(JSON.stringify({passed:true,groups:checks.length,runDirectory,browser:received.value.browser}));
