import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { makeExample } from '../core.js';

export async function receiveSurfaceHeat({ evaluate, send, delay, report, artifactDirectory }) {
  const stored = async () => JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  const load = async value => evaluate(`(async()=>{const input=document.querySelector('#import'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'heat-control.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,180));})()`);
  const state = () => evaluate("document.querySelector('#heat-status').dataset.state");
  async function run(expected = 'compared') {
    await evaluate("document.querySelector('#heat-run').click()");
    for (let i = 0; i < 50; i++) { if (!(await evaluate("document.querySelector('#heat-run').disabled"))) break; await delay(30); }
    assert.equal(await state(), expected, await evaluate("document.querySelector('#heat-status').textContent"));
  }
  const inspect = async minute => {
    await evaluate(`document.querySelector('#heat-minute').value=${JSON.stringify(String(minute))};document.querySelector('#heat-minute').dispatchEvent(new Event('input',{bubbles:true}))`);
    return Number(await evaluate("document.querySelector('#heat-inspect').dataset.differenceC"));
  };
  const initial = makeExample(); await load(initial);
  await evaluate("document.querySelector('#heat-example').click()");
  assert.equal((await stored()).surfaceHeatStudy, undefined);
  assert.equal(await evaluate("document.querySelector('#heat-run').disabled"), true);
  await evaluate("document.querySelector('#heat-form').requestSubmit()"); await run();
  const saved = await stored();
  assert.deepEqual(saved.existing, initial.existing); assert.deepEqual(saved.proposal, initial.proposal); assert.deepEqual(saved.weather, initial.weather);
  assert.equal(await evaluate("document.querySelectorAll('#heat-chart path').length"), 2);
  assert.ok(await inspect(60) < -20); assert.ok(await inspect(420) > 1);
  report.push('Actual example draft/save/compare gives cooler proposed layer during heating and warmer later cooling; rain model inputs remain identical');

  await evaluate("document.querySelector('#heat-proposal-capacityJm2K').value='40000';document.querySelector('#heat-proposal-capacityJm2K').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#heat-results').textContent"), '');
  assert.equal(await evaluate("document.querySelector('#heat-run').disabled"), true);
  await evaluate("document.querySelector('#heat-form').requestSubmit()"); await run();
  assert.ok(await inspect(420) < 0);
  report.push('Changed heat capacity alters the late-time comparison and retires stale results until the draft is saved');

  const beforeInvalid = await stored();
  await evaluate("document.querySelector('#heat-schedule').value='minutes,incident_w_m2,reservoir_c,source\\n60,,25,missing flux';document.querySelector('#heat-schedule').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#heat-form').requestSubmit()");
  assert.equal(await state(), 'refused'); assert.deepEqual(await stored(), beforeInvalid);
  report.push('Missing exposure flux refuses transactionally without replacing the accepted study');

  await load(saved);
  const hostile = '<img src=x onerror=window.__heatInjected=1> ' + 'original-source-'.repeat(30);
  await evaluate(`document.querySelector('#heat-proposal-source').value=${JSON.stringify(hostile)};document.querySelector('#heat-proposal-source').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#heat-form').requestSubmit()`);
  await run();
  assert.equal(await evaluate("document.querySelectorAll('#heat-evidence img').length"), 0);
  assert.equal(await evaluate("window.__heatInjected??null"), null);
  assert.ok((await evaluate("document.querySelector('#heat-evidence').textContent")).includes(hostile));
  const accepted = await stored(), downloadDir = artifactDirectory + '/heat-download'; await mkdir(downloadDir);
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
  await evaluate("document.querySelector('#export').click()");
  const path = downloadDir + '/experimental-earth-site.json';
  for (let i = 0; i < 60; i++) { try { await access(path); break; } catch { await delay(50); } }
  const exported = JSON.parse(await readFile(path, 'utf8')); assert.deepEqual(exported, accepted);
  await evaluate("document.querySelector('#heat-clear').click()"); assert.equal((await stored()).surfaceHeatStudy, undefined);
  await send('Page.reload', { ignoreCache: true }); await delay(400);
  // Reopen the actual downloaded file through the application's file input.
  const doc = await send('DOM.getDocument'); const input = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#import' });
  await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [path] }); await delay(220); await run();
  assert.deepEqual((await stored()).surfaceHeatStudy, exported.surfaceHeatStudy); assert.ok(await inspect(420) > 1);
  report.push('Source words render literally; actual project download, fresh reload and native file reopen preserve the declaration and recompute the comparison');

  const changed = structuredClone(exported); changed.proposal[changed.surfaceHeatStudy.cellIndex].elevationM += .025;
  await load(changed); await run('context-changed');
  assert.equal(await evaluate("document.querySelector('#heat-results').textContent"), '');
  await evaluate("document.querySelector('#heat-form').requestSubmit()");
  assert.equal(await state(), 'refused'); assert.deepEqual((await stored()).surfaceHeatStudy, exported.surfaceHeatStudy);
  report.push('A changed place refuses reuse and saving cannot silently rebind the original thermal declaration');

  await load(exported); await run();
  await evaluate("document.querySelector('#heat-run').click();document.querySelector('#heat-example').click()"); await delay(80);
  assert.equal(await evaluate("document.querySelector('#heat-results').textContent"), '');
  assert.equal(await evaluate("document.querySelector('#heat-run').disabled"), true);
  report.push('A changed draft cancels an in-flight comparison without publishing old results');

  await load(exported); await run();
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.querySelector('#heat-results').scrollIntoView({block:'start',behavior:'instant'})"); await delay(80);
  let image = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(artifactDirectory + '/surface-heat-desktop.png', Buffer.from(image.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.querySelector('#heat-evidence').open=true;document.querySelector('#heat-results').scrollIntoView({block:'start',behavior:'instant'})"); await delay(100);
  const dimensions = await evaluate('({viewport:innerWidth,scroll:document.documentElement.scrollWidth})');
  assert.ok(dimensions.scroll <= dimensions.viewport + 1, JSON.stringify(dimensions));
  image = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(artifactDirectory + '/surface-heat-mobile.png', Buffer.from(image.data, 'base64'));
  // Use real input events on the time control, with its current viewport geometry.
  await evaluate("document.querySelector('#heat-minute').scrollIntoView({block:'center',behavior:'instant'})"); await delay(80);
  const point = await evaluate("(()=>{const r=document.querySelector('#heat-minute').getBoundingClientRect();return{x:r.x+r.width*.15,y:r.y+r.height/2}})()");
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
  assert.ok(Number(await evaluate("document.querySelector('#heat-minute').value")) < 100);
  assert.ok(Number(await evaluate("document.querySelector('#heat-inspect').dataset.differenceC")) < 0);
  report.push('Wide and 390px rendered comparisons remain within the viewport; real pointer input inspects the opposite heating conclusion');
}
